import { ArcGISRestClient, ArcGISError } from './arcgisRest.mjs';
import { buildLatestFeature, buildPublicationBundle, PublicationEligibilityError } from './transform.mjs';

export class PublicationRetryableError extends Error { constructor(message) { super(message); this.name = 'PublicationRetryableError'; this.retryable = true; } }
const errorCode = (error) => error?.code != null ? String(error.code).slice(0, 120) : error instanceof PublicationEligibilityError ? 'PUBLICATION_NOT_ELIGIBLE' : 'PUBLICATION_UNEXPECTED';
const safeErrorMessage = (error) => String(error?.message ?? error ?? 'Unknown publication error').slice(0, 1500);

async function readApprovedInputs(db, submissionId, revisionId) {
  const submissionRef = db.collection('submissions').doc(submissionId); const submissionSnap = await submissionRef.get();
  if (!submissionSnap.exists) throw new PublicationEligibilityError(`Submission '${submissionId}' does not exist`);
  const submission = submissionSnap.data(); const revisionRef = submissionRef.collection('revisions').doc(revisionId);
  const [revisionSnap, measurementSnap] = await Promise.all([revisionRef.get(), revisionRef.collection('measurements').get()]);
  if (!revisionSnap.exists) throw new PublicationEligibilityError(`Approved revision '${revisionId}' does not exist`);
  const siteSnap = await db.collection('siteCatalog').doc(submission.site_id).get();
  if (!siteSnap.exists) throw new PublicationEligibilityError(`Site '${submission.site_id}' does not exist in siteCatalog`);
  return { submission, revision: revisionSnap.data(), measurements: measurementSnap.docs.map((d) => d.data()), site: siteSnap.data() };
}

async function claimPublication({ db, Timestamp, submissionId, revisionId }) {
  const submissionRef = db.collection('submissions').doc(submissionId); const jobRef = submissionRef.collection('publication').doc(revisionId);
  return db.runTransaction(async (tx) => {
    const [submissionSnap, jobSnap] = await Promise.all([tx.get(submissionRef), tx.get(jobRef)]);
    if (!submissionSnap.exists) throw new PublicationEligibilityError(`Submission '${submissionId}' does not exist`);
    const submission = submissionSnap.data();
    if (submission.current_revision_id !== revisionId || submission.reviewed_revision_id !== revisionId || submission.review_decision !== 'APPROVE') throw new PublicationEligibilityError('Live submission no longer points to the approved revision');
    if (submission.status === 'PUBLISHED' && jobSnap.exists && jobSnap.data().status === 'PUBLISHED') return { alreadyPublished: true, attempt: Number(jobSnap.data().attempt_count ?? 1) };
    if (!['APPROVED', 'PUBLISHING', 'PUBLISH_FAILED'].includes(submission.status)) throw new PublicationEligibilityError(`Cannot claim publication from status '${submission.status}'`);
    const attempt = Number(jobSnap.exists ? jobSnap.data().attempt_count ?? 0 : 0) + 1; const now = Timestamp.now();
    tx.update(submissionRef, { status: 'PUBLISHING', updated_at: now });
    tx.set(jobRef, { revision_id: revisionId, status: 'PUBLISHING', attempt_count: attempt, last_attempt_at: now, last_error_code: null, last_error_message: null, published_at: jobSnap.exists ? (jobSnap.data().published_at ?? null) : null }, { merge: true });
    return { alreadyPublished: false, attempt };
  });
}

async function acquireSiteLock({ db, Timestamp, siteId, revisionId, leaseMs = 180_000 }) {
  const ref = db.collection('publicationSiteLocks').doc(siteId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref); const nowMs = Date.now();
    if (snap.exists) { const lock = snap.data(); const expires = typeof lock.expires_at?.toMillis === 'function' ? lock.expires_at.toMillis() : 0; if (lock.revision_id !== revisionId && expires > nowMs) throw new PublicationRetryableError(`Site '${siteId}' publication is currently serialized by another revision`); }
    tx.set(ref, { site_id: siteId, revision_id: revisionId, acquired_at: Timestamp.fromMillis(nowMs), expires_at: Timestamp.fromMillis(nowMs + leaseMs) });
  });
}
async function releaseSiteLock({ db, siteId, revisionId }) {
  const ref = db.collection('publicationSiteLocks').doc(siteId); await db.runTransaction(async (tx) => { const snap = await tx.get(ref); if (snap.exists && snap.data().revision_id === revisionId) tx.delete(ref); });
}

async function markFailure({ db, Timestamp, submissionId, revisionId, attempt, error }) {
  const submissionRef = db.collection('submissions').doc(submissionId); const jobRef = submissionRef.collection('publication').doc(revisionId); const auditRef = submissionRef.collection('audit').doc(`publish-failed-${revisionId}-${attempt}`);
  const code = errorCode(error); const message = safeErrorMessage(error);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(submissionRef); if (!snap.exists) return; const submission = snap.data(); if (submission.current_revision_id !== revisionId || submission.status === 'PUBLISHED') return;
    const now = Timestamp.now(); tx.update(submissionRef, { status: 'PUBLISH_FAILED', updated_at: now });
    tx.set(jobRef, { status: 'PUBLISH_FAILED', last_error_code: code, last_error_message: message, last_failed_at: now }, { merge: true });
    tx.set(auditRef, { audit_id: `publish-failed-${revisionId}-${attempt}`, event_type: 'ARCGIS_PUBLISH_FAILED', actor_type: 'PUBLISHING_SERVICE', actor_id: null, occurred_at: now, previous_state: 'PUBLISHING', new_state: 'PUBLISH_FAILED', revision_id: revisionId, reason: message, metadata: { error_code: code, attempt } });
  });
}

async function markPublished({ db, Timestamp, submissionId, revisionId, attempt, observationResult, latestResult }) {
  const submissionRef = db.collection('submissions').doc(submissionId); const jobRef = submissionRef.collection('publication').doc(revisionId); const auditRef = submissionRef.collection('audit').doc(`publish-${revisionId}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(submissionRef); if (!snap.exists) throw new PublicationEligibilityError(`Submission '${submissionId}' disappeared during publication`); const submission = snap.data();
    if (submission.current_revision_id !== revisionId || submission.reviewed_revision_id !== revisionId) throw new PublicationEligibilityError('Submission revision changed during publication');
    if (submission.status === 'PUBLISHED') return { idempotent: true }; if (!['PUBLISHING', 'PUBLISH_FAILED'].includes(submission.status)) throw new PublicationEligibilityError(`Cannot finalize publication from status '${submission.status}'`);
    const now = Timestamp.now(); tx.update(submissionRef, { status: 'PUBLISHED', published_at: now, updated_at: now });
    tx.set(jobRef, { status: 'PUBLISHED', published_at: now, last_error_code: null, last_error_message: null, arcgis_observation_object_id: observationResult.objectId ?? null, arcgis_observation_global_id: observationResult.globalId ?? null, latest_site_object_id: latestResult.objectId ?? null }, { merge: true });
    tx.set(auditRef, { audit_id: `publish-${revisionId}`, event_type: 'ARCGIS_PUBLISHED', actor_type: 'PUBLISHING_SERVICE', actor_id: null, occurred_at: now, previous_state: submission.status, new_state: 'PUBLISHED', revision_id: revisionId, reason: null, metadata: { attempt, arcgis_observation_object_id: observationResult.objectId ?? null, arcgis_observation_global_id: observationResult.globalId ?? null } });
    return { idempotent: false, publishedAt: now };
  });
}

export async function publishApprovedSubmission({ db, Timestamp, submissionId, approvedRevisionId, arcgis = null, arcgisConfig = null }) {
  if (!db || !Timestamp) throw new Error('db and Timestamp are required'); if (!submissionId || !approvedRevisionId) throw new PublicationEligibilityError('submissionId and approvedRevisionId are required');
  const claim = await claimPublication({ db, Timestamp, submissionId, revisionId: approvedRevisionId });
  if (claim.alreadyPublished) return { idempotent: true, submission_id: submissionId, revision_id: approvedRevisionId, status: 'PUBLISHED' };
  let siteId = null; let lockAcquired = false;
  try {
    const inputs = await readApprovedInputs(db, submissionId, approvedRevisionId); siteId = inputs.site.site_id; const bundle = buildPublicationBundle({ ...inputs, publishedAt: Date.now() });
    await acquireSiteLock({ db, Timestamp, siteId, revisionId: approvedRevisionId }); lockAcquired = true;
    const client = arcgis ?? new ArcGISRestClient(arcgisConfig); const siteResult = await client.ensureSite(bundle.siteFeature); const observationResult = await client.ensureObservation(bundle.observationFeature);
    const measurementResult = await client.ensureMeasurements(bundle.revisionId, bundle.measurements); const latestResult = await client.refreshLatestForSite(bundle.siteFeature, buildLatestFeature);
    await markPublished({ db, Timestamp, submissionId, revisionId: approvedRevisionId, attempt: claim.attempt, observationResult, latestResult });
    return { idempotent: !observationResult.created, submission_id: submissionId, revision_id: approvedRevisionId, status: 'PUBLISHED', site: siteResult, observation: observationResult, measurements: measurementResult, latest: latestResult };
  } catch (error) {
    await markFailure({ db, Timestamp, submissionId, revisionId: approvedRevisionId, attempt: claim.attempt, error });
    if (error?.retryable === true || (error instanceof ArcGISError && error.retryable)) throw error;
    return { idempotent: false, submission_id: submissionId, revision_id: approvedRevisionId, status: 'PUBLISH_FAILED', error_code: errorCode(error) };
  } finally {
    if (lockAcquired && siteId) { try { await releaseSiteLock({ db, siteId, revisionId: approvedRevisionId }); } catch { /* lease expiry is recoverable */ } }
  }
}
export function shouldHandleApprovalEvent(before, after) { return Boolean(after && after.status === 'APPROVED' && before?.status !== 'APPROVED'); }
