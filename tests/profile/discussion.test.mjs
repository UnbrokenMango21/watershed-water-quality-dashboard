import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { postSubmissionMessage } from '../../profile/discussion.mjs';
import { applyReviewDecision } from '../../web/lib/reviewSubmission.mjs';

test('message payloads cannot forge identity or review decisions', async () => {
  const data = { submissionId: 's', revisionId: 'r', messageId: 'm', kind: 'COLLECTOR_COMMENT', text: 'My comment' };
  for (const addition of [{ sender_uid: 'admin' }, { sender_role: 'ADMIN' }, { created_at: new Date() }, { decision: 'APPROVE' }]) {
    await assert.rejects(postSubmissionMessage({ data: { ...data, ...addition } }), error => error.code === 'invalid-argument');
  }
  await assert.rejects(postSubmissionMessage({ data: { ...data, kind: 'REVIEW_DECISION' } }), error => error.code === 'invalid-argument');
});

const emulated = Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST);
test('canonical discussion enforces ownership, review role, current revision, retries, and private notes', { skip: !emulated }, async () => {
  const suffix = randomUUID();
  const app = initializeApp({ projectId: 'central-pa-watershed-dev' }, `discussion-${suffix}`);
  const db = getFirestore(app), auth = getAuth(app), serverTimestamp = () => FieldValue.serverTimestamp();
  const [collector, outsider, reviewer, admin] = ['collector', 'outsider', 'reviewer', 'admin'].map(role => `discussion-${role}-${suffix}`);
  const submission = db.collection('submissions').doc(`discussion-${suffix}`);
  const revision = 'revision-one';
  try {
    for (const [uid, role] of [[collector, 'COLLECTOR'], [outsider, 'COLLECTOR'], [reviewer, 'QC_REVIEWER'], [admin, 'ADMIN']]) {
      await auth.createUser({ uid, email: `${uid}@example.test`, emailVerified: true });
      await auth.setCustomUserClaims(uid, { role });
      await db.collection('users').doc(uid).set({ active: true, role, display_name: `Test ${role}` });
    }
    await submission.set({ collector_user_id: collector, current_revision_id: revision, status: 'DRAFT' });
    await submission.collection('revisions').doc(revision).set({ revision_id: revision, revision_status: 'SUBMITTED', data_collected_by: 'Immutable Collector' });
    const base = { db, auth, serverTimestamp };
    const data = { submissionId: submission.id, revisionId: revision, messageId: randomUUID(), kind: 'COLLECTOR_COMMENT', text: 'A field observation question.' };
    await assert.rejects(postSubmissionMessage({ ...base, uid: outsider, data }), error => error.code === 'permission-denied');
    await assert.rejects(postSubmissionMessage({ ...base, uid: collector, data: { ...data, kind: 'REVIEWER_QUESTION' } }), error => error.code === 'permission-denied');
    assert.equal((await postSubmissionMessage({ ...base, uid: collector, data })).idempotent, false);
    assert.equal((await postSubmissionMessage({ ...base, uid: collector, data })).idempotent, true);
    await assert.rejects(postSubmissionMessage({ ...base, uid: collector, data: { ...data, text: 'Different replay content' } }), error => error.code === 'already-exists');
    await submission.collection('revisions').doc('old-revision').set({ revision_id: 'old-revision' });
    await assert.rejects(postSubmissionMessage({ ...base, uid: collector, data: { ...data, revisionId: 'old-revision', messageId: randomUUID() } }), error => error.code === 'aborted');
    const question = { ...data, kind: 'REVIEWER_QUESTION', messageId: randomUUID(), text: 'Please clarify this method.' };
    await postSubmissionMessage({ ...base, uid: reviewer, data: question });
    await assert.rejects(postSubmissionMessage({ ...base, uid: reviewer, data: { ...question, kind: 'ADMINISTRATIVE_NOTE' } }), error => error.code === 'permission-denied');
    await postSubmissionMessage({ ...base, uid: admin, data: { ...question, messageId: randomUUID(), kind: 'ADMINISTRATIVE_NOTE', text: 'Private administrative context.' } });
    assert.equal((await submission.collection('messages').get()).size, 2);
    assert.equal((await submission.collection('internalNotes').get()).size, 1);
    await submission.update({ status: 'PENDING_REVIEW' });
    await applyReviewDecision({ db, Timestamp, submissionId: submission.id, expectedRevisionId: revision, decision: 'NEEDS_CORRECTION', reviewerUid: reviewer, reviewerRole: 'QC_REVIEWER', reviewerDisplayName: 'Verified Reviewer', reason: 'Clarify the recorded method in a new revision.' });
    const messages = await submission.collection('messages').get();
    assert.equal(messages.size, 3);
    assert.equal(messages.docs.find(doc => doc.get('kind') === 'CORRECTION_REQUEST').get('sender_display_name'), 'Verified Reviewer');
    assert.equal((await submission.collection('revisions').doc(revision).get()).get('data_collected_by'), 'Immutable Collector');
  } finally {
    await db.recursiveDelete(submission);
    for (const uid of [collector, outsider, reviewer, admin]) { await auth.deleteUser(uid).catch(() => {}); await db.collection('users').doc(uid).delete(); }
    await deleteApp(app);
  }
});
