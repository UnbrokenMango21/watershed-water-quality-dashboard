import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeMembership, requestReviewerAccess, decideReviewerAccess } from '../../profile/access.mjs';
import { reviewerAccessProblem } from '../../web/lib/reviewSubmission.mjs';

test('self-service payloads cannot choose UID, role, active state, or verified email', async () => {
  for (const field of ['role', 'uid', 'active', 'verified_email']) {
    await assert.rejects(initializeMembership({ data: { displayName: 'Test Person', [field]: 'ADMIN' } }), error => error.code === 'invalid-argument');
    await assert.rejects(requestReviewerAccess({ data: { reason: 'Project scientist', [field]: 'ADMIN' } }), error => error.code === 'invalid-argument');
  }
});
test('server review rejects stale membership versions and role mismatches', () => {
  const profile = { active: true, role: 'QC_REVIEWER', access_version: 'new' };
  assert.equal(reviewerAccessProblem({ disabled: false, claimRole: 'QC_REVIEWER', profile, accessVersion: 'new' }), null);
  assert.ok(reviewerAccessProblem({ disabled: false, claimRole: 'QC_REVIEWER', profile, accessVersion: 'old' }));
  assert.ok(reviewerAccessProblem({ disabled: false, claimRole: 'ADMIN', profile, accessVersion: 'new' }));
});
test('unverified email cannot initialize membership or request reviewer access', async () => {
  const auth = { getUser: async () => ({ email: 'unverified@example.test', emailVerified: false, disabled: false }) };
  await assert.rejects(initializeMembership({ uid: 'unverified', auth, data: { displayName: 'Unverified Person' } }), error => error.code === 'failed-precondition');
  await assert.rejects(requestReviewerAccess({ uid: 'unverified', auth, data: { reason: 'Project scientist' } }), error => error.code === 'failed-precondition');
});

const emulated = Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST);
test('verified registration → request → authorized decision → revoke preserves science and rejects escalation', { skip: !emulated }, async t => {
  const app = initializeApp({ projectId: 'central-pa-watershed-dev' }, `membership-${Date.now()}`);
  const db = getFirestore(app), auth = getAuth(app), serverTimestamp = () => FieldValue.serverTimestamp();
  const uids = ['membership-collector', 'membership-admin', 'membership-unverified'];
  const input = { db, auth, serverTimestamp };
  try {
    for (const uid of uids) {
      await auth.deleteUser(uid).catch(() => {});
      await db.collection('users').doc(uid).delete();
      await db.recursiveDelete(db.collection('reviewerAccessRequests').doc(uid));
      await auth.createUser({ uid, email: `${uid}@example.test`, emailVerified: uid !== uids[2] });
    }
    await auth.setCustomUserClaims(uids[1], { role: 'ADMIN', unrelated: 'preserved' });
    await db.collection('users').doc(uids[1]).set({ role: 'ADMIN', active: true });
    await initializeMembership({ ...input, uid: uids[0], data: { displayName: 'Original Collector' } });
    assert.equal((await db.collection('users').doc(uids[0]).get()).data().role, 'COLLECTOR');
    assert.equal((await auth.getUser(uids[0])).customClaims?.role ?? 'COLLECTOR', 'COLLECTOR');
    const request = await requestReviewerAccess({ ...input, uid: uids[0], data: { reason: 'I supervise this research project.' } });
    assert.equal(request.status, 'PENDING');
    assert.deepEqual(await requestReviewerAccess({ ...input, uid: uids[0], data: { reason: 'Repeat request must remain pending.' } }), request);
    const decision = { uid: uids[0], requestId: request.requestId, status: 'APPROVED', reason: 'Project membership verified by administrator.' };
    await assert.rejects(decideReviewerAccess({ ...input, uid: uids[0], data: decision }), error => error.code === 'permission-denied');
    await assert.rejects(decideReviewerAccess({ ...input, uid: uids[1], data: { ...decision, requestId: 'stale' } }), error => error.code === 'aborted');
    await assert.rejects(decideReviewerAccess({ ...input, uid: uids[1], data: { ...decision, uid: uids[1] } }), error => error.code === 'permission-denied');
    const historical = db.collection('submissions').doc('membership-historical');
    await historical.set({ collector_user_id: uids[0], status: 'SUBMITTED', data_collected_by: 'Original Collector' });
    assert.equal((await decideReviewerAccess({ ...input, uid: uids[1], data: decision })).status, 'APPROVED');
    assert.equal((await decideReviewerAccess({ ...input, uid: uids[1], data: decision })).idempotent, true);
    const approved = await auth.getUser(uids[0]);
    const profile = (await db.collection('users').doc(uids[0]).get()).data();
    assert.equal(reviewerAccessProblem({ disabled: approved.disabled, claimRole: approved.customClaims.role, accessVersion: approved.customClaims.access_version, profile }), null);
    await initializeMembership({ ...input, uid: uids[0], data: { displayName: 'Renamed Reviewer' } });
    assert.equal((await db.collection('users').doc(uids[0]).get()).data().role, 'QC_REVIEWER');
    assert.equal((await historical.get()).data().data_collected_by, 'Original Collector');
    await assert.rejects(decideReviewerAccess({ ...input, uid: uids[1], data: { ...decision, uid: 'membership-missing-account' } }), error => error.code === 'not-found');
    // Revocation must work even when the reviewer's Auth account has been disabled.
    await auth.updateUser(uids[0], { disabled: true });
    await decideReviewerAccess({ ...input, uid: uids[1], data: { ...decision, status: 'REVOKED', reason: 'Project review assignment has ended.' } });
    await auth.updateUser(uids[0], { disabled: false });
    const revoked = (await db.collection('users').doc(uids[0]).get()).data();
    assert.ok(reviewerAccessProblem({ disabled: false, claimRole: approved.customClaims.role, accessVersion: approved.customClaims.access_version, profile: revoked }));
    assert.equal((await auth.getUser(uids[0])).customClaims.role, 'COLLECTOR');
    assert.equal((await db.collection('reviewerAccessRequests').doc(uids[0]).collection('audit').get()).size, 2);
    // A revoked (or rejected) applicant can ask again; the stale request ID can no longer be decided.
    const again = await requestReviewerAccess({ ...input, uid: uids[0], data: { reason: 'Assigned to review the spring season.' } });
    assert.equal(again.status, 'PENDING'); assert.equal(again.resubmitted, true); assert.notEqual(again.requestId, request.requestId);
    assert.deepEqual(await requestReviewerAccess({ ...input, uid: uids[0], data: { reason: 'Duplicate while pending.' } }), { status: 'PENDING', requestId: again.requestId });
    await assert.rejects(decideReviewerAccess({ ...input, uid: uids[1], data: decision }), error => error.code === 'aborted');
    await decideReviewerAccess({ ...input, uid: uids[1], data: { uid: uids[0], requestId: again.requestId, status: 'REJECTED', reason: 'Spring review roster is already complete.' } });
    const rejectedRequest = (await db.collection('reviewerAccessRequests').doc(uids[0]).get()).data();
    assert.equal(rejectedRequest.status, 'REJECTED'); assert.equal((await auth.getUser(uids[0])).customClaims.role, 'COLLECTOR');
    const third = await requestReviewerAccess({ ...input, uid: uids[0], data: { reason: 'Assigned to the summer review roster.' } });
    assert.equal(third.status, 'PENDING');
    assert.equal((await decideReviewerAccess({ ...input, uid: uids[1], data: { uid: uids[0], requestId: third.requestId, status: 'APPROVED', reason: 'Summer roster confirmed.' } })).status, 'APPROVED');
    const events = (await db.collection('reviewerAccessRequests').doc(uids[0]).collection('audit').get()).docs.map(doc => doc.data());
    assert.equal(events.filter(event => event.event === 'REQUEST_RESUBMITTED').length, 2);
    assert.equal(events.length, 6);
    await historical.delete();
  } finally {
    for (const uid of uids) {
      await auth.deleteUser(uid).catch(() => {});
      await db.collection('users').doc(uid).delete();
      await db.recursiveDelete(db.collection('reviewerAccessRequests').doc(uid));
    }
    await deleteApp(app);
  }
});
