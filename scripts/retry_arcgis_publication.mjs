#!/usr/bin/env node
import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) initializeApp();
const db = getFirestore();
const [submissionId, expectedRevisionId] = process.argv.slice(2);

if (!submissionId || !expectedRevisionId) {
  console.error('Usage: node scripts/retry_arcgis_publication.mjs <submission_id> <approved_revision_id>');
  process.exit(2);
}

const submissionRef = db.collection('submissions').doc(submissionId);
const publicationRef = submissionRef.collection('publication').doc(expectedRevisionId);

const result = await db.runTransaction(async (tx) => {
  const [submissionSnap, publicationSnap] = await Promise.all([
    tx.get(submissionRef),
    tx.get(publicationRef),
  ]);
  if (!submissionSnap.exists) throw new Error(`Submission '${submissionId}' does not exist`);

  const submission = submissionSnap.data();
  if (submission.status === 'APPROVED') return { idempotent: true, status: 'APPROVED' };
  if (submission.status !== 'PUBLISH_FAILED') {
    throw new Error(`Refusing recovery from status '${submission.status}'; expected PUBLISH_FAILED`);
  }
  if (
    submission.review_decision !== 'APPROVE'
    || submission.current_revision_id !== expectedRevisionId
    || submission.reviewed_revision_id !== expectedRevisionId
  ) {
    throw new Error('Refusing recovery because the requested revision is not the current reviewed-and-approved revision');
  }

  const failedAttempt = Number(publicationSnap.exists ? publicationSnap.data().attempt_count ?? 0 : 0);
  if (!Number.isInteger(failedAttempt) || failedAttempt < 1) {
    throw new Error('Refusing recovery because no failed publication attempt is recorded for the approved revision');
  }

  const auditId = `publication-requeued-${expectedRevisionId}-${failedAttempt}`;
  const auditRef = submissionRef.collection('audit').doc(auditId);
  const auditSnap = await tx.get(auditRef);
  if (auditSnap.exists) {
    throw new Error(`Publication attempt ${failedAttempt} has already been requeued; refusing to overwrite immutable audit '${auditId}'`);
  }

  tx.update(submissionRef, {
    status: 'APPROVED',
    updated_at: FieldValue.serverTimestamp(),
  });
  tx.set(auditRef, {
    audit_id: auditId,
    event_type: 'ARCGIS_PUBLICATION_REQUEUED',
    actor_type: 'PUBLISHING_SERVICE',
    actor_id: null,
    occurred_at: FieldValue.serverTimestamp(),
    previous_state: 'PUBLISH_FAILED',
    new_state: 'APPROVED',
    revision_id: expectedRevisionId,
    reason: 'Explicit operator requeue after publication failure remediation.',
    metadata: { failed_attempt: failedAttempt },
  });

  return { idempotent: false, status: 'APPROVED', failed_attempt: failedAttempt, audit_id: auditId };
});

console.log(JSON.stringify({ submission_id: submissionId, revision_id: expectedRevisionId, ...result }, null, 2));
