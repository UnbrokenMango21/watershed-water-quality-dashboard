import { validateObservation } from './engine.mjs';
import { buildValidationPersistencePlan } from './persistence.mjs';
import { commitValidationPlanToFirestore } from './firestore_adapter.mjs';

const CLAIMABLE_STATUSES = new Set(['SUBMITTED', 'RESUBMITTED']);
const APPROVED_HISTORY_STATUSES = new Set(['APPROVED', 'PUBLISHING', 'PUBLISH_FAILED', 'PUBLISHED']);

function asDate(value) {
  if (value instanceof Date) return value;
  if (value && typeof value.toDate === 'function') return value.toDate();
  const d = new Date(value);
  if (Number.isNaN(d.valueOf())) throw new Error('Invalid validation timestamp');
  return d;
}

function validationAuditId(prefix, revisionId, now) {
  return `${prefix}-${revisionId}-${asDate(now).getTime()}`;
}

export async function claimSubmissionForValidation({ db, Timestamp, submissionId, now = new Date() }) {
  if (!db || typeof db.runTransaction !== 'function') throw new Error('Firestore db is required');
  if (!Timestamp || typeof Timestamp.fromDate !== 'function') throw new Error('Firestore Timestamp is required');
  if (!submissionId) throw new Error('submissionId is required');

  const submissionRef = db.collection('submissions').doc(submissionId);
  const occurredAt = Timestamp.fromDate(asDate(now));

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(submissionRef);
    if (!snap.exists) throw new Error(`Submission '${submissionId}' does not exist`);

    const data = snap.data();
    if (!CLAIMABLE_STATUSES.has(data.status)) {
      throw new Error(`Submission '${submissionId}' is not claimable from status '${data.status}'`);
    }
    if (!data.current_revision_id) throw new Error(`Submission '${submissionId}' has no current_revision_id`);

    const sourceStatus = data.status;
    const auditRef = submissionRef.collection('audit').doc(
      validationAuditId('validation-started', data.current_revision_id, now),
    );

    tx.update(submissionRef, {
      status: 'VALIDATING',
      updated_at: occurredAt,
    });

    tx.set(auditRef, {
      audit_id: auditRef.id,
      event_type: 'VALIDATION_STARTED',
      actor_type: 'VALIDATION_SERVICE',
      actor_id: null,
      occurred_at: occurredAt,
      previous_state: sourceStatus,
      new_state: 'VALIDATING',
      revision_id: data.current_revision_id,
      reason: 'Server validation claimed submitted revision',
      metadata: null,
    });

    return {
      ...data,
      submission_id: data.submission_id || submissionId,
      status: 'VALIDATING',
      source_status: sourceStatus,
      updated_at: occurredAt,
    };
  });
}

export async function loadApprovedHistoryByParameter({ db, siteId, excludeSubmissionId = null, limit = 100 }) {
  if (!siteId) return {};

  const snap = await db.collection('submissions')
    .where('site_id', '==', siteId)
    .limit(limit)
    .get();

  const candidates = snap.docs.filter((docSnap) => {
    if (docSnap.id === excludeSubmissionId) return false;
    const data = docSnap.data();
    return data.review_decision === 'APPROVE' || APPROVED_HISTORY_STATUSES.has(data.status);
  });

  const historyByParameter = {};

  await Promise.all(candidates.map(async (submissionSnap) => {
    const submission = submissionSnap.data();
    if (!submission.current_revision_id) return;

    const revisionRef = submissionSnap.ref.collection('revisions').doc(submission.current_revision_id);
    const [revisionSnap, measurementsSnap] = await Promise.all([
      revisionRef.get(),
      revisionRef.collection('measurements').get(),
    ]);
    if (!revisionSnap.exists) return;

    const revision = revisionSnap.data();
    for (const measurementSnap of measurementsSnap.docs) {
      const measurement = measurementSnap.data();
      if (typeof measurement.value !== 'number' || !Number.isFinite(measurement.value)) continue;
      if (!measurement.parameter_code) continue;

      historyByParameter[measurement.parameter_code] ??= [];
      historyByParameter[measurement.parameter_code].push({
        value: measurement.value,
        collected_at: revision.collected_at ?? submission.latest_collected_at ?? null,
        method_name: measurement.method_name ?? revision.method_name ?? null,
        instrument_name: measurement.instrument_name ?? revision.instrument_name ?? null,
        test_type: revision.test_type ?? null,
        submission_id: submission.submission_id || submissionSnap.id,
        revision_id: revision.revision_id || revisionSnap.id,
      });
    }
  }));

  return historyByParameter;
}

export async function loadValidationInputs({ db, submission, historyLimit = 100 }) {
  const submissionRef = db.collection('submissions').doc(submission.submission_id);
  const revisionRef = submissionRef.collection('revisions').doc(submission.current_revision_id);

  const [revisionSnap, measurementsSnap, siteSnap, historyByParameter] = await Promise.all([
    revisionRef.get(),
    revisionRef.collection('measurements').get(),
    db.collection('siteCatalog').doc(submission.site_id).get(),
    loadApprovedHistoryByParameter({
      db,
      siteId: submission.site_id,
      excludeSubmissionId: submission.submission_id,
      limit: historyLimit,
    }),
  ]);

  if (!revisionSnap.exists) throw new Error(`Current revision '${submission.current_revision_id}' does not exist`);
  if (!siteSnap.exists) throw new Error(`Site '${submission.site_id}' does not exist in siteCatalog`);

  return {
    revision: revisionSnap.data(),
    measurements: measurementsSnap.docs.map((d) => d.data()),
    site: siteSnap.data(),
    historyByParameter,
  };
}

async function releaseValidationClaimAfterFailure({ db, Timestamp, submission, now, error }) {
  const submissionRef = db.collection('submissions').doc(submission.submission_id);
  const occurredAt = Timestamp.fromDate(asDate(now));

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(submissionRef);
    if (!snap.exists) return;

    const current = snap.data();
    if (current.status !== 'VALIDATING') return;
    if (current.current_revision_id !== submission.current_revision_id) return;

    const auditRef = submissionRef.collection('audit').doc(
      validationAuditId('validation-failed', submission.current_revision_id, now),
    );

    tx.update(submissionRef, {
      status: submission.source_status,
      updated_at: occurredAt,
    });

    tx.set(auditRef, {
      audit_id: auditRef.id,
      event_type: 'VALIDATION_SYSTEM_FAILURE',
      actor_type: 'VALIDATION_SERVICE',
      actor_id: null,
      occurred_at: occurredAt,
      previous_state: 'VALIDATING',
      new_state: submission.source_status,
      revision_id: submission.current_revision_id,
      reason: 'Validation execution failed before a complete result could be committed',
      metadata: {
        error_name: error?.name || 'Error',
        error_message: String(error?.message || error || 'Unknown validation failure').slice(0, 500),
      },
    });
  });
}

export async function runValidationForSubmission({
  db,
  Timestamp,
  submissionId,
  now = new Date(),
  historyLimit = 100,
  validate = validateObservation,
}) {
  const claimed = await claimSubmissionForValidation({ db, Timestamp, submissionId, now });

  try {
    const inputs = await loadValidationInputs({ db, submission: claimed, historyLimit });
    const result = validate({
      revision: inputs.revision,
      measurements: inputs.measurements,
      site: inputs.site,
      historyByParameter: inputs.historyByParameter,
      now,
    });

    const plan = buildValidationPersistencePlan({
      submission: claimed,
      revision: inputs.revision,
      result,
      now,
    });

    const committed = await commitValidationPlanToFirestore({ db, Timestamp, plan });

    return {
      submission_id: claimed.submission_id,
      revision_id: inputs.revision.revision_id,
      source_status: claimed.source_status,
      final_status: committed.next_status,
      blocking: plan.blocking,
      result,
      commit: committed,
    };
  } catch (error) {
    try {
      await releaseValidationClaimAfterFailure({ db, Timestamp, submission: claimed, now, error });
    } catch {
      // Preserve the original validation failure. Operational monitoring should surface release failures separately.
    }
    throw error;
  }
}
