import { randomUUID } from 'node:crypto';

import { ArcGISRestClient, ArcGISError } from './arcgisRest.mjs';
import { buildLatestFeature, buildPublicationBundle, PublicationEligibilityError } from './transform.mjs';

export class PublicationRetryableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PublicationRetryableError';
    this.retryable = true;
  }
}

function errorCode(error) {
  if (error?.code != null) return String(error.code).slice(0, 120);
  if (error instanceof PublicationEligibilityError) return 'PUBLICATION_NOT_ELIGIBLE';
  if (error instanceof PublicationRetryableError) return 'PUBLICATION_RETRYABLE';
  return 'PUBLICATION_UNEXPECTED';
}

function safeErrorMessage(error) {
  return String(error?.message ?? error ?? 'Unknown publication error').slice(0, 1500);
}

function timestampMillis(value) {
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return 0;
}

async function readApprovedInputs(db, submissionId, revisionId) {
  const submissionRef = db.collection('submissions').doc(submissionId);
  const submissionSnap = await submissionRef.get();
  if (!submissionSnap.exists) throw new PublicationEligibilityError(`Submission '${submissionId}' does not exist`);
  const submission = submissionSnap.data();
  const revisionRef = submissionRef.collection('revisions').doc(revisionId);
  const [revisionSnap, measurementSnap] = await Promise.all([
    revisionRef.get(),
    revisionRef.collection('measurements').get(),
  ]);
  if (!revisionSnap.exists) throw new PublicationEligibilityError(`Approved revision '${revisionId}' does not exist`);
  const revision = revisionSnap.data();
  const siteSnap = await db.collection('siteCatalog').doc(submission.site_id).get();
  if (!siteSnap.exists) throw new PublicationEligibilityError(`Site '${submission.site_id}' does not exist in siteCatalog`);
  return {
    submission,
    revision,
    measurements: measurementSnap.docs.map((doc) => doc.data()),
    site: siteSnap.data(),
  };
}

export async function claimPublication({
  db,
  Timestamp,
  submissionId,
  revisionId,
  nowMs = Date.now(),
  leaseMs = 240_000,
  leaseToken = randomUUID(),
}) {
  const submissionRef = db.collection('submissions').doc(submissionId);
  const jobRef = submissionRef.collection('publication').doc(revisionId);
  return db.runTransaction(async (tx) => {
    const [submissionSnap, jobSnap] = await Promise.all([tx.get(submissionRef), tx.get(jobRef)]);
    if (!submissionSnap.exists) throw new PublicationEligibilityError(`Submission '${submissionId}' does not exist`);
    const submission = submissionSnap.data();
    const job = jobSnap.exists ? jobSnap.data() : null;

    if (
      submission.current_revision_id !== revisionId
      || submission.reviewed_revision_id !== revisionId
      || submission.review_decision !== 'APPROVE'
    ) {
      throw new PublicationEligibilityError('Live submission no longer points to the approved revision');
    }

    if (submission.status === 'PUBLISHED' && job?.status === 'PUBLISHED') {
      return {
        alreadyPublished: true,
        attempt: Number(job.attempt_count ?? 1),
        leaseToken: null,
      };
    }

    if (submission.status === 'PUBLISHING') {
      const leaseExpiresMs = timestampMillis(job?.lease_expires_at);
      if (job?.status === 'PUBLISHING' && job?.active_lease_token && leaseExpiresMs > nowMs) {
        throw new PublicationRetryableError(
          `Publication for revision '${revisionId}' is already claimed until ${new Date(leaseExpiresMs).toISOString()}`,
        );
      }
    }

    if (!['APPROVED', 'PUBLISHING', 'PUBLISH_FAILED'].includes(submission.status)) {
      throw new PublicationEligibilityError(`Cannot claim publication from status '${submission.status}'`);
    }

    const attempt = Number(job?.attempt_count ?? 0) + 1;
    const now = Timestamp.fromMillis(nowMs);
    const leaseExpiresAt = Timestamp.fromMillis(nowMs + leaseMs);
    tx.update(submissionRef, { status: 'PUBLISHING', updated_at: now });
    tx.set(jobRef, {
      revision_id: revisionId,
      status: 'PUBLISHING',
      attempt_count: attempt,
      last_attempt_at: now,
      active_lease_token: leaseToken,
      lease_expires_at: leaseExpiresAt,
      last_error_code: null,
      last_error_message: null,
      published_at: job?.published_at ?? null,
    }, { merge: true });
    return { alreadyPublished: false, attempt, leaseToken, leaseExpiresAt };
  });
}

async function acquireSiteLock({ db, Timestamp, siteId, revisionId, leaseToken, leaseMs = 240_000 }) {
  const lockRef = db.collection('publicationSiteLocks').doc(siteId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(lockRef);
    const nowMs = Date.now();
    if (snap.exists) {
      const lock = snap.data();
      const expiresMs = timestampMillis(lock.expires_at);
      if (lock.lease_token !== leaseToken && expiresMs > nowMs) {
        throw new PublicationRetryableError(`Site '${siteId}' publication is currently serialized by another active lease`);
      }
    }
    tx.set(lockRef, {
      site_id: siteId,
      revision_id: revisionId,
      lease_token: leaseToken,
      acquired_at: Timestamp.fromMillis(nowMs),
      expires_at: Timestamp.fromMillis(nowMs + leaseMs),
    });
  });
}

async function releaseSiteLock({ db, siteId, leaseToken }) {
  const lockRef = db.collection('publicationSiteLocks').doc(siteId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(lockRef);
    if (snap.exists && snap.data().lease_token === leaseToken) tx.delete(lockRef);
  });
}

async function markFailure({ db, Timestamp, submissionId, revisionId, attempt, leaseToken, error }) {
  const submissionRef = db.collection('submissions').doc(submissionId);
  const jobRef = submissionRef.collection('publication').doc(revisionId);
  const auditRef = submissionRef.collection('audit').doc(`publish-failed-${revisionId}-${attempt}`);
  const code = errorCode(error);
  const message = safeErrorMessage(error);
  return db.runTransaction(async (tx) => {
    const [submissionSnap, jobSnap] = await Promise.all([tx.get(submissionRef), tx.get(jobRef)]);
    if (!submissionSnap.exists) return { stale: true };
    const submission = submissionSnap.data();
    const job = jobSnap.exists ? jobSnap.data() : null;
    if (submission.current_revision_id !== revisionId || submission.status === 'PUBLISHED') return { stale: true };
    if (job?.active_lease_token !== leaseToken) return { stale: true };

    const now = Timestamp.now();
    tx.update(submissionRef, { status: 'PUBLISH_FAILED', updated_at: now });
    tx.set(jobRef, {
      status: 'PUBLISH_FAILED',
      active_lease_token: null,
      lease_expires_at: null,
      last_error_code: code,
      last_error_message: message,
      last_failed_at: now,
    }, { merge: true });
    tx.set(auditRef, {
      audit_id: `publish-failed-${revisionId}-${attempt}`,
      event_type: 'ARCGIS_PUBLISH_FAILED',
      actor_type: 'PUBLISHING_SERVICE',
      actor_id: null,
      occurred_at: now,
      previous_state: 'PUBLISHING',
      new_state: 'PUBLISH_FAILED',
      revision_id: revisionId,
      reason: message,
      metadata: { error_code: code, attempt },
    });
    return { stale: false };
  });
}

async function markPublished({
  db,
  Timestamp,
  submissionId,
  revisionId,
  attempt,
  leaseToken,
  observationResult,
  latestResult,
}) {
  const submissionRef = db.collection('submissions').doc(submissionId);
  const jobRef = submissionRef.collection('publication').doc(revisionId);
  const auditRef = submissionRef.collection('audit').doc(`publish-${revisionId}`);
  return db.runTransaction(async (tx) => {
    const [submissionSnap, jobSnap] = await Promise.all([tx.get(submissionRef), tx.get(jobRef)]);
    if (!submissionSnap.exists) {
      throw new PublicationEligibilityError(`Submission '${submissionId}' disappeared during publication`);
    }
    const submission = submissionSnap.data();
    const job = jobSnap.exists ? jobSnap.data() : null;
    if (submission.current_revision_id !== revisionId || submission.reviewed_revision_id !== revisionId) {
      throw new PublicationEligibilityError('Submission revision changed during publication');
    }
    if (submission.status === 'PUBLISHED' && job?.status === 'PUBLISHED') return { idempotent: true };
    if (job?.active_lease_token !== leaseToken) {
      throw new PublicationRetryableError(`Publication lease for revision '${revisionId}' changed before finalization`);
    }
    if (!['PUBLISHING', 'PUBLISH_FAILED'].includes(submission.status)) {
      throw new PublicationEligibilityError(`Cannot finalize publication from status '${submission.status}'`);
    }

    const now = Timestamp.now();
    tx.update(submissionRef, { status: 'PUBLISHED', published_at: now, updated_at: now });
    tx.set(jobRef, {
      status: 'PUBLISHED',
      active_lease_token: null,
      lease_expires_at: null,
      published_at: now,
      last_error_code: null,
      last_error_message: null,
      arcgis_observation_object_id: observationResult.objectId ?? null,
      arcgis_observation_global_id: observationResult.globalId ?? null,
      latest_site_object_id: latestResult.objectId ?? null,
    }, { merge: true });
    tx.set(auditRef, {
      audit_id: `publish-${revisionId}`,
      event_type: 'ARCGIS_PUBLISHED',
      actor_type: 'PUBLISHING_SERVICE',
      actor_id: null,
      occurred_at: now,
      previous_state: submission.status,
      new_state: 'PUBLISHED',
      revision_id: revisionId,
      reason: null,
      metadata: {
        attempt,
        arcgis_observation_object_id: observationResult.objectId ?? null,
        arcgis_observation_global_id: observationResult.globalId ?? null,
      },
    });
    return { idempotent: false, publishedAt: now };
  });
}

export async function publishApprovedSubmission({
  db,
  Timestamp,
  submissionId,
  approvedRevisionId,
  arcgis = null,
  arcgisConfig = null,
}) {
  if (!db || !Timestamp) throw new Error('db and Timestamp are required');
  if (!submissionId || !approvedRevisionId) {
    throw new PublicationEligibilityError('submissionId and approvedRevisionId are required');
  }

  const claim = await claimPublication({ db, Timestamp, submissionId, revisionId: approvedRevisionId });
  if (claim.alreadyPublished) {
    return {
      idempotent: true,
      submission_id: submissionId,
      revision_id: approvedRevisionId,
      status: 'PUBLISHED',
    };
  }

  let siteId = null;
  let lockAcquired = false;
  try {
    const inputs = await readApprovedInputs(db, submissionId, approvedRevisionId);
    siteId = inputs.site.site_id;
    const bundle = buildPublicationBundle({ ...inputs, publishedAt: Date.now() });
    await acquireSiteLock({
      db,
      Timestamp,
      siteId,
      revisionId: approvedRevisionId,
      leaseToken: claim.leaseToken,
    });
    lockAcquired = true;

    const client = arcgis ?? new ArcGISRestClient(arcgisConfig);
    const siteResult = await client.ensureSite(bundle.siteFeature);
    const observationResult = await client.ensureObservation(bundle.observationFeature);
    const measurementResult = await client.ensureMeasurements(bundle.revisionId, bundle.measurements);
    const latestResult = await client.refreshLatestForSite(bundle.siteFeature, buildLatestFeature);

    await markPublished({
      db,
      Timestamp,
      submissionId,
      revisionId: approvedRevisionId,
      attempt: claim.attempt,
      leaseToken: claim.leaseToken,
      observationResult,
      latestResult,
    });
    return {
      idempotent: !observationResult.created,
      submission_id: submissionId,
      revision_id: approvedRevisionId,
      status: 'PUBLISHED',
      site: siteResult,
      observation: observationResult,
      measurements: measurementResult,
      latest: latestResult,
    };
  } catch (error) {
    const failure = await markFailure({
      db,
      Timestamp,
      submissionId,
      revisionId: approvedRevisionId,
      attempt: claim.attempt,
      leaseToken: claim.leaseToken,
      error,
    });
    if (failure.stale) {
      throw new PublicationRetryableError(
        `Publication lease for revision '${approvedRevisionId}' changed while handling failure`,
      );
    }
    if (error?.retryable === true || (error instanceof ArcGISError && error.retryable)) throw error;
    return {
      idempotent: false,
      submission_id: submissionId,
      revision_id: approvedRevisionId,
      status: 'PUBLISH_FAILED',
      error_code: errorCode(error),
    };
  } finally {
    if (lockAcquired && siteId) {
      try {
        await releaseSiteLock({ db, siteId, leaseToken: claim.leaseToken });
      } catch {
        // Lease expiry makes a release failure recoverable; never mask the publication result.
      }
    }
  }
}

export function shouldHandleApprovalEvent(before, after) {
  return Boolean(after && after.status === 'APPROVED' && before?.status !== 'APPROVED');
}
