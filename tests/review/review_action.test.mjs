import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import { applyReviewDecision, ReviewConflictError, ReviewValidationError } from '../../web/lib/reviewSubmission.mjs';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('FIRESTORE_EMULATOR_HOST is not set. Refusing to run review tests against a non-emulator Firestore instance.');
}

const PROJECT_ID = 'central-pa-watershed-dev';
const app = initializeApp({ projectId: PROJECT_ID }, `review-action-${randomUUID()}`);
const db = getFirestore(app);
const NOW = new Date('2026-08-13T18:00:00Z');

async function seedPendingReview({ submissionId = randomUUID(), revisionId = randomUUID(), status = 'PENDING_REVIEW' } = {}) {
  const submissionRef = db.collection('submissions').doc(submissionId);
  const revisionRef = submissionRef.collection('revisions').doc(revisionId);

  await submissionRef.set({
    submission_id: submissionId,
    event_id: randomUUID(),
    collector_user_id: 'collector-review-test',
    site_id: 'SITE-REVIEW-001',
    status,
    current_revision_id: revisionId,
    current_revision_no: 1,
    latest_collected_at: Timestamp.fromDate(NOW),
    created_at: Timestamp.fromDate(NOW),
    updated_at: Timestamp.fromDate(NOW),
    submitted_at: Timestamp.fromDate(NOW),
    schema_version: '0.1.0',
    mobile_app_version: 'review-test',
    error_flag_count: 0,
    warning_flag_count: 0,
    info_flag_count: 0,
  });
  await revisionRef.set({
    revision_id: revisionId,
    revision_no: 1,
    submission_id: submissionId,
    revision_status: 'SUBMITTED',
    temp_c: 20,
  });

  return { submissionId, revisionId, submissionRef, revisionRef };
}

after(async () => {
  await deleteApp(app);
});

test('APPROVE transitions PENDING_REVIEW to APPROVED, writes one audit event, and never touches the revision', async () => {
  const seeded = await seedPendingReview();

  const result = await applyReviewDecision({
    db,
    Timestamp,
    submissionId: seeded.submissionId,
    expectedRevisionId: seeded.revisionId,
    decision: 'APPROVE',
    reviewerUid: 'reviewer-1',
    reviewerRole: 'QC_REVIEWER',
    now: NOW,
  });

  assert.equal(result.idempotent, false);
  assert.equal(result.status, 'APPROVED');

  const submissionSnap = await seeded.submissionRef.get();
  assert.equal(submissionSnap.data().status, 'APPROVED');
  assert.equal(submissionSnap.data().review_decision, 'APPROVE');
  assert.equal(submissionSnap.data().reviewer_user_id, 'reviewer-1');
  assert.equal(submissionSnap.data().reviewed_revision_id, seeded.revisionId);
  assert.ok(submissionSnap.data().reviewed_at);

  const revisionSnap = await seeded.revisionRef.get();
  assert.equal(revisionSnap.data().revision_status, 'SUBMITTED');
  assert.equal(revisionSnap.data().temp_c, 20);

  const auditSnap = await seeded.submissionRef.collection('audit').get();
  assert.equal(auditSnap.size, 1);
  assert.equal(auditSnap.docs[0].data().event_type, 'REVIEW_APPROVED');
  assert.equal(auditSnap.docs[0].data().actor_id, 'reviewer-1');
  assert.equal(auditSnap.docs[0].data().previous_state, 'PENDING_REVIEW');
  assert.equal(auditSnap.docs[0].data().new_state, 'APPROVED');
});

test('NEEDS_CORRECTION and REJECT require a non-empty reason', async () => {
  const seeded = await seedPendingReview();

  await assert.rejects(
    () => applyReviewDecision({
      db, Timestamp, submissionId: seeded.submissionId, expectedRevisionId: seeded.revisionId,
      decision: 'NEEDS_CORRECTION', reviewerUid: 'reviewer-1', reviewerRole: 'QC_REVIEWER', reason: '  ', now: NOW,
    }),
    ReviewValidationError,
  );

  const seededReject = await seedPendingReview();
  await assert.rejects(
    () => applyReviewDecision({
      db, Timestamp, submissionId: seededReject.submissionId, expectedRevisionId: seededReject.revisionId,
      decision: 'REJECT', reviewerUid: 'reviewer-1', reviewerRole: 'QC_REVIEWER', now: NOW,
    }),
    ReviewValidationError,
  );

  const applied = await applyReviewDecision({
    db, Timestamp, submissionId: seeded.submissionId, expectedRevisionId: seeded.revisionId,
    decision: 'NEEDS_CORRECTION', reviewerUid: 'reviewer-1', reviewerRole: 'QC_REVIEWER', reason: 'Dissolved oxygen looks miskeyed.', now: NOW,
  });
  assert.equal(applied.status, 'NEEDS_CORRECTION');
});

test('APPROVE does not require a reason but accepts an optional comment', async () => {
  const seeded = await seedPendingReview();
  const applied = await applyReviewDecision({
    db, Timestamp, submissionId: seeded.submissionId, expectedRevisionId: seeded.revisionId,
    decision: 'APPROVE', reviewerUid: 'reviewer-1', reviewerRole: 'QC_REVIEWER', reason: 'Looks great.', now: NOW,
  });
  assert.equal(applied.status, 'APPROVED');
  const submissionSnap = await seeded.submissionRef.get();
  assert.equal(submissionSnap.data().review_comment, 'Looks great.');
});

test('a stale revision id is rejected as a conflict', async () => {
  const seeded = await seedPendingReview();
  await assert.rejects(
    () => applyReviewDecision({
      db, Timestamp, submissionId: seeded.submissionId, expectedRevisionId: 'not-the-current-revision',
      decision: 'APPROVE', reviewerUid: 'reviewer-1', reviewerRole: 'QC_REVIEWER', now: NOW,
    }),
    ReviewConflictError,
  );
  const submissionSnap = await seeded.submissionRef.get();
  assert.equal(submissionSnap.data().status, 'PENDING_REVIEW');
});

test('a submission that is not PENDING_REVIEW is rejected as a conflict', async () => {
  const seeded = await seedPendingReview({ status: 'DRAFT' });
  await assert.rejects(
    () => applyReviewDecision({
      db, Timestamp, submissionId: seeded.submissionId, expectedRevisionId: seeded.revisionId,
      decision: 'APPROVE', reviewerUid: 'reviewer-1', reviewerRole: 'QC_REVIEWER', now: NOW,
    }),
    ReviewConflictError,
  );
});

test('a later stale approval fails after the submission was already rejected', async () => {
  const seeded = await seedPendingReview();
  const rejected = await applyReviewDecision({
    db, Timestamp, submissionId: seeded.submissionId, expectedRevisionId: seeded.revisionId,
    decision: 'REJECT', reviewerUid: 'reviewer-1', reviewerRole: 'QC_REVIEWER', reason: 'Fabricated data.', now: NOW,
  });
  assert.equal(rejected.status, 'REJECTED');

  await assert.rejects(
    () => applyReviewDecision({
      db, Timestamp, submissionId: seeded.submissionId, expectedRevisionId: seeded.revisionId,
      decision: 'APPROVE', reviewerUid: 'reviewer-2', reviewerRole: 'ADMIN', now: NOW,
    }),
    ReviewConflictError,
  );

  const submissionSnap = await seeded.submissionRef.get();
  assert.equal(submissionSnap.data().status, 'REJECTED');
  assert.equal(submissionSnap.data().reviewer_user_id, 'reviewer-1');
});

test('an identical repeated decision is idempotent and does not create a second audit event', async () => {
  const seeded = await seedPendingReview();
  const first = await applyReviewDecision({
    db, Timestamp, submissionId: seeded.submissionId, expectedRevisionId: seeded.revisionId,
    decision: 'APPROVE', reviewerUid: 'reviewer-1', reviewerRole: 'QC_REVIEWER', now: NOW,
  });
  const second = await applyReviewDecision({
    db, Timestamp, submissionId: seeded.submissionId, expectedRevisionId: seeded.revisionId,
    decision: 'APPROVE', reviewerUid: 'reviewer-1', reviewerRole: 'QC_REVIEWER', now: NOW,
  });

  assert.equal(first.idempotent, false);
  assert.equal(second.idempotent, true);
  assert.equal(second.audit_id, first.audit_id);

  const auditSnap = await seeded.submissionRef.collection('audit').get();
  assert.equal(auditSnap.size, 1, 'a repeated identical decision must not write a duplicate audit event');

  const revisionSnap = await seeded.revisionRef.get();
  assert.equal(revisionSnap.data().revision_status, 'SUBMITTED', 'the revision must remain byte-for-byte unchanged across an idempotent replay');
  assert.equal(revisionSnap.data().temp_c, 20);
});

test('a replay with the same revision/status/decision but a different reason is a conflict, not an idempotent replay', async () => {
  const seeded = await seedPendingReview();
  const first = await applyReviewDecision({
    db, Timestamp, submissionId: seeded.submissionId, expectedRevisionId: seeded.revisionId,
    decision: 'REJECT', reviewerUid: 'reviewer-1', reviewerRole: 'QC_REVIEWER', reason: 'bad sample', now: NOW,
  });
  assert.equal(first.idempotent, false);

  await assert.rejects(
    () => applyReviewDecision({
      db, Timestamp, submissionId: seeded.submissionId, expectedRevisionId: seeded.revisionId,
      decision: 'REJECT', reviewerUid: 'reviewer-1', reviewerRole: 'QC_REVIEWER', reason: 'different reason', now: NOW,
    }),
    ReviewConflictError,
  );

  const submissionSnap = await seeded.submissionRef.get();
  assert.equal(submissionSnap.data().review_comment, 'bad sample', 'the original decision must not be overwritten by the conflicting retry');
  const auditSnap = await seeded.submissionRef.collection('audit').get();
  assert.equal(auditSnap.size, 1, 'a rejected conflicting replay must not write a second audit event');
});

test('a replay with the same revision/status/decision but a different reviewer is a conflict', async () => {
  const seeded = await seedPendingReview();
  await applyReviewDecision({
    db, Timestamp, submissionId: seeded.submissionId, expectedRevisionId: seeded.revisionId,
    decision: 'REJECT', reviewerUid: 'reviewer-1', reviewerRole: 'QC_REVIEWER', reason: 'bad sample', now: NOW,
  });

  await assert.rejects(
    () => applyReviewDecision({
      db, Timestamp, submissionId: seeded.submissionId, expectedRevisionId: seeded.revisionId,
      decision: 'REJECT', reviewerUid: 'reviewer-2', reviewerRole: 'QC_REVIEWER', reason: 'bad sample', now: NOW,
    }),
    ReviewConflictError,
    'a different reviewer submitting the same decision/reason must not be treated as an idempotent replay of reviewer-1\'s decision',
  );

  const submissionSnap = await seeded.submissionRef.get();
  assert.equal(submissionSnap.data().reviewer_user_id, 'reviewer-1');
  const auditSnap = await seeded.submissionRef.collection('audit').get();
  assert.equal(auditSnap.size, 1);
});

test('retrying with a different decision after one has already applied is a conflict, not a silent overwrite', async () => {
  const seeded = await seedPendingReview();
  await applyReviewDecision({
    db, Timestamp, submissionId: seeded.submissionId, expectedRevisionId: seeded.revisionId,
    decision: 'APPROVE', reviewerUid: 'reviewer-1', reviewerRole: 'QC_REVIEWER', now: NOW,
  });

  await assert.rejects(
    () => applyReviewDecision({
      db, Timestamp, submissionId: seeded.submissionId, expectedRevisionId: seeded.revisionId,
      decision: 'REJECT', reviewerUid: 'reviewer-1', reviewerRole: 'QC_REVIEWER', reason: 'changed my mind', now: NOW,
    }),
    ReviewConflictError,
  );

  const submissionSnap = await seeded.submissionRef.get();
  assert.equal(submissionSnap.data().status, 'APPROVED', 'the original decision must stand; a later different decision must not overwrite it');
});

test('concurrent conflicting decisions on the same revision: exactly one wins, the other is rejected', async () => {
  const seeded = await seedPendingReview();

  const [approveResult, rejectResult] = await Promise.allSettled([
    applyReviewDecision({
      db, Timestamp, submissionId: seeded.submissionId, expectedRevisionId: seeded.revisionId,
      decision: 'APPROVE', reviewerUid: 'reviewer-a', reviewerRole: 'QC_REVIEWER', now: NOW,
    }),
    applyReviewDecision({
      db, Timestamp, submissionId: seeded.submissionId, expectedRevisionId: seeded.revisionId,
      decision: 'REJECT', reviewerUid: 'reviewer-b', reviewerRole: 'QC_REVIEWER', reason: 'Racing decision.', now: NOW,
    }),
  ]);

  const outcomes = [approveResult, rejectResult];
  const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
  const rejected = outcomes.filter((o) => o.status === 'rejected');
  assert.equal(fulfilled.length, 1, 'exactly one of the two racing decisions must win');
  assert.equal(rejected.length, 1, 'the losing decision must be rejected, not silently applied');

  const submissionSnap = await seeded.submissionRef.get();
  assert.ok(['APPROVED', 'REJECTED'].includes(submissionSnap.data().status));

  const auditSnap = await seeded.submissionRef.collection('audit').get();
  assert.equal(auditSnap.size, 1, 'only the winning decision may write an audit event');
});

test('an unauthorized role cannot apply a review decision', async () => {
  const seeded = await seedPendingReview();
  await assert.rejects(
    () => applyReviewDecision({
      db, Timestamp, submissionId: seeded.submissionId, expectedRevisionId: seeded.revisionId,
      decision: 'APPROVE', reviewerUid: 'collector-review-test', reviewerRole: 'COLLECTOR', now: NOW,
    }),
    ReviewValidationError,
  );
  const submissionSnap = await seeded.submissionRef.get();
  assert.equal(submissionSnap.data().status, 'PENDING_REVIEW');
});
