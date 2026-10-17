// Self-service display-name contract. Pure validation runs anywhere; the persistence cases need the
// Firestore and Auth emulators (see `npm run test:profile`) and are skipped without them, so this file
// can never write to a live project.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { DisplayNameError, normalizeDisplayName, parseDisplayNameRequest } from '../../profile/display_name.mjs';
import { handleDisplayNameUpdate } from '../../functions/index.mjs';

const emulated = Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST);
const PROJECT_ID = 'central-pa-watershed-dev';

test('display names are trimmed, whitespace-collapsed and length-bounded', () => {
  assert.equal(normalizeDisplayName('  Ada   Lovelace '), 'Ada Lovelace');
  assert.equal(normalizeDisplayName('José Núñez'), 'José Núñez');
  assert.throws(() => normalizeDisplayName(' A '), DisplayNameError);
  assert.throws(() => normalizeDisplayName('x'.repeat(81)), DisplayNameError);
  assert.throws(() => normalizeDisplayName('Ada\u0000Lovelace'), DisplayNameError);
  assert.throws(() => normalizeDisplayName(42), DisplayNameError);
});

test('the request may carry only displayName', () => {
  assert.equal(parseDisplayNameRequest({ displayName: 'Ada Lovelace' }), 'Ada Lovelace');
  for (const forged of [
    { displayName: 'Ada', role: 'ADMIN' },
    { displayName: 'Ada', active: true },
    { displayName: 'Ada', uid: 'someone-else' },
    null,
    ['Ada'],
  ]) {
    assert.throws(() => parseDisplayNameRequest(forged), (error) => error.code === 'invalid-argument');
  }
});

test('an unauthenticated call is refused before any write', async () => {
  await assert.rejects(
    handleDisplayNameUpdate({ auth: null, data: { displayName: 'Ada Lovelace' }, db: {}, adminAuth: {} }),
    (error) => error.code === 'unauthenticated',
  );
});

if (emulated) {
  const app = initializeApp({ projectId: PROJECT_ID }, 'profile-display-name-test');
  const db = getFirestore(app);
  const auth = getAuth(app);
  const uid = 'profile-test-collector';

  after(async () => {
    await db.collection('users').doc(uid).delete().catch(() => {});
    await db.collection('users').doc('profile-test-new').delete().catch(() => {});
    await auth.deleteUser(uid).catch(() => {});
    await auth.deleteUser('profile-test-new').catch(() => {});
    await deleteApp(app);
  });

  test('updates only the caller\'s display_name, mirrors Auth, and preserves role and active', async () => {
    await auth.createUser({ uid, email: 'profile-test@example.test', displayName: 'Old Name' }).catch(() => {});
    await db.collection('users').doc(uid).set({ display_name: 'Old Name', role: 'COLLECTOR', active: true, created_at: FieldValue.serverTimestamp() });
    const submission = db.collection('submissions').doc('profile-test-submission');
    await submission.set({ collector_user_id: uid, status: 'SUBMITTED' });
    await submission.collection('revisions').doc('r1').set({ data_collected_by: 'Old Name' });

    const result = await handleDisplayNameUpdate({ auth: { uid }, data: { displayName: '  New   Name ' }, db, adminAuth: auth });
    assert.deepEqual(result, { displayName: 'New Name' });

    const profile = (await db.collection('users').doc(uid).get()).data();
    assert.equal(profile.display_name, 'New Name');
    assert.equal(profile.role, 'COLLECTOR');
    assert.equal(profile.active, true);
    assert.equal((await auth.getUser(uid)).displayName, 'New Name');
    // Historical attribution is provenance and is never rewritten.
    assert.equal((await submission.collection('revisions').doc('r1').get()).data().data_collected_by, 'Old Name');
    await db.recursiveDelete(submission);
  });

  test('role escalation through the callable is refused and leaves the profile untouched', async () => {
    await assert.rejects(
      handleDisplayNameUpdate({ auth: { uid }, data: { displayName: 'Mallory', role: 'ADMIN' }, db, adminAuth: auth }),
      (error) => error.code === 'invalid-argument',
    );
    const profile = (await db.collection('users').doc(uid).get()).data();
    assert.equal(profile.role, 'COLLECTOR');
    assert.notEqual(profile.display_name, 'Mallory');
  });

  test('a first-time profile is created with owned fields only', async () => {
    await auth.createUser({ uid: 'profile-test-new', email: 'profile-new@example.test' }).catch(() => {});
    await handleDisplayNameUpdate({ auth: { uid: 'profile-test-new' }, data: { displayName: 'First Person' }, db, adminAuth: auth });
    const profile = (await db.collection('users').doc('profile-test-new').get()).data();
    assert.deepEqual(Object.keys(profile).sort(), ['created_at', 'display_name', 'updated_at']);
  });
}
