const REVIEWABLE_STATUS = 'PENDING_REVIEW';
const REVIEWER_ROLES = new Set(['QC_REVIEWER', 'ADMIN']);

const DECISIONS = {
  APPROVE: { nextStatus: 'APPROVED', requiresReason: false, auditEventType: 'REVIEW_APPROVED' },
  NEEDS_CORRECTION: { nextStatus: 'NEEDS_CORRECTION', requiresReason: true, auditEventType: 'REVIEW_NEEDS_CORRECTION' },
  REJECT: { nextStatus: 'REJECTED', requiresReason: true, auditEventType: 'REVIEW_REJECTED' },
};

export class ReviewValidationError extends Error {}
export class ReviewConflictError extends Error {}

function nonBlank(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function asDate(value) {
  if (value instanceof Date) return value;
  const d = new Date(value);
  if (Number.isNaN(d.valueOf())) throw new ReviewValidationError('Invalid review timestamp');
  return d;
}

/**
 * Apply a QC reviewer decision (Approve / Request Correction / Reject) to a submission.
 *
 * Guarantees: atomic (single Firestore transaction), transactional (read-check-write),
 * revision-aware (expectedRevisionId must match the submission's current_revision_id),
 * race-safe (Firestore transaction retries on conflicting concurrent writes), audited
 * (one immutable audit event per decision), and idempotent (an identical repeated request
 * for a decision that already applied returns the same result without a duplicate audit
 * event). Never writes to the revision document or its measurements: reviewers cannot
 * mutate scientific data.
 */
export async function applyReviewDecision({
  db,
  Timestamp,
  submissionId,
  expectedRevisionId,
  decision,
  reviewerUid,
  reviewerRole,
  reason = null,
  now = new Date(),
}) {
  if (!db || typeof db.runTransaction !== 'function') throw new Error('Firestore db is required');
  if (!Timestamp || typeof Timestamp.fromDate !== 'function') throw new Error('Firestore Timestamp is required');

  const spec = DECISIONS[decision];
  if (!spec) throw new ReviewValidationError(`Unknown review decision '${decision}'`);
  if (!submissionId) throw new ReviewValidationError('submissionId is required');
  if (!expectedRevisionId) throw new ReviewValidationError('expectedRevisionId is required');
  if (!reviewerUid) throw new ReviewValidationError('reviewerUid is required');
  if (!REVIEWER_ROLES.has(reviewerRole)) {
    throw new ReviewValidationError(`Role '${reviewerRole}' is not authorized to perform review actions`);
  }
  if (spec.requiresReason && !nonBlank(reason)) {
    throw new ReviewValidationError(`Decision '${decision}' requires a non-empty reason`);
  }

  const occurredAt = Timestamp.fromDate(asDate(now));
  const reasonValue = reason != null && nonBlank(reason) ? reason.trim() : null;
  const submissionRef = db.collection('submissions').doc(submissionId);
  const auditId = `review-${expectedRevisionId}-${decision}`;
  const auditRef = submissionRef.collection('audit').doc(auditId);

  return db.runTransaction(async (tx) => {
    const submissionSnap = await tx.get(submissionRef);
    if (!submissionSnap.exists) throw new ReviewConflictError(`Submission '${submissionId}' does not exist`);
    const submission = submissionSnap.data();

    const auditSnap = await tx.get(auditRef);
    if (auditSnap.exists) {
      // A replay is idempotent ONLY when the full decision identity matches - not just
      // the revision, resulting status and decision. A different reviewer, or the same
      // reviewer retrying with a different reason, is a genuinely different request that
      // happens to collide on the same audit id (same revision + same decision keyword)
      // and must be rejected as a conflict, never silently accepted as "already done."
      const identicalReplay = submission.current_revision_id === expectedRevisionId
        && submission.status === spec.nextStatus
        && submission.review_decision === decision
        && submission.reviewer_user_id === reviewerUid
        && (submission.review_comment ?? null) === reasonValue;
      if (identicalReplay) {
        return {
          idempotent: true,
          submission_id: submissionId,
          revision_id: expectedRevisionId,
          decision,
          status: submission.status,
          audit_id: auditId,
        };
      }
      throw new ReviewConflictError(
        `Review decision '${decision}' was already recorded for revision '${expectedRevisionId}' with a different reviewer, reason, or resulting state; this request is not an identical replay`,
      );
    }

    if (submission.current_revision_id !== expectedRevisionId) {
      throw new ReviewConflictError(
        `Submission current_revision_id '${submission.current_revision_id}' does not match expected revision '${expectedRevisionId}'`,
      );
    }
    if (submission.status !== REVIEWABLE_STATUS) {
      throw new ReviewConflictError(`Submission '${submissionId}' is not reviewable from status '${submission.status}'`);
    }

    const previousStatus = submission.status;

    tx.update(submissionRef, {
      status: spec.nextStatus,
      review_decision: decision,
      review_comment: reasonValue,
      reviewer_user_id: reviewerUid,
      reviewed_at: occurredAt,
      reviewed_revision_id: expectedRevisionId,
      updated_at: occurredAt,
    });

    tx.set(auditRef, {
      audit_id: auditId,
      event_type: spec.auditEventType,
      actor_type: 'QC_REVIEWER',
      actor_id: reviewerUid,
      occurred_at: occurredAt,
      previous_state: previousStatus,
      new_state: spec.nextStatus,
      revision_id: expectedRevisionId,
      reason: reasonValue,
      metadata: { reviewer_role: reviewerRole },
    });

    return {
      idempotent: false,
      submission_id: submissionId,
      revision_id: expectedRevisionId,
      decision,
      status: spec.nextStatus,
      audit_id: auditId,
    };
  });
}
