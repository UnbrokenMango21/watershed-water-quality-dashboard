import test from 'node:test';
import assert from 'node:assert/strict';

import { createAuthSequence, resolveReviewerGate } from '../../web/lib/reviewerGate.mjs';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

/** Drives the gate the way AuthGate's onAuthStateChanged listener does. */
function harness() {
  const sequence = createAuthSequence();
  const states = [];
  return {
    states,
    sequence,
    event(user, lookups) {
      const isCurrent = sequence.begin();
      if (!user) { states.push({ kind: 'signed-out' }); return Promise.resolve(); }
      return resolveReviewerGate({ user, ...lookups, isCurrent, apply: (next) => states.push({ ...next, uid: user.uid }) });
    },
  };
}

test('an active reviewer profile makes the gate ready; claims or profiles that do not qualify do not', async () => {
  for (const [role, profile, expected] of [
    ['QC_REVIEWER', { active: true, role: 'QC_REVIEWER' }, 'ready'],
    ['ADMIN', { active: true, role: 'ADMIN' }, 'ready'],
    ['QC_REVIEWER', { active: false, role: 'QC_REVIEWER' }, 'unauthorized'],
    ['QC_REVIEWER', null, 'unauthorized'],
    [undefined, { active: true, role: 'QC_REVIEWER' }, 'unauthorized'],
  ]) {
    const h = harness();
    await h.event({ uid: 'u1' }, { readRole: async () => role, readProfile: async () => profile });
    assert.equal(h.states.at(-1).kind, expected, JSON.stringify({ role, profile }));
  }
});

test('a profile lookup that finishes after sign-out cannot restore the review workspace', async () => {
  const h = harness();
  const profile = deferred();
  const pending = h.event({ uid: 'reviewer-a' }, { readRole: async () => 'QC_REVIEWER', readProfile: () => profile.promise });
  await h.event(null);
  profile.resolve({ active: true, role: 'QC_REVIEWER' });
  await pending;
  assert.deepEqual(h.states, [{ kind: 'signed-out' }]);
});

test('a slow lookup for the previous user cannot overwrite the next user\'s state', async () => {
  const h = harness();
  const slow = deferred();
  const first = h.event({ uid: 'reviewer-a' }, { readRole: async () => 'QC_REVIEWER', readProfile: () => slow.promise });
  await h.event({ uid: 'collector-b' }, { readRole: async () => 'COLLECTOR', readProfile: async () => null });
  slow.resolve({ active: true, role: 'QC_REVIEWER' });
  await first;
  assert.deepEqual(h.states.map((s) => [s.kind, s.uid]), [['unauthorized', 'collector-b']]);
});

test('a slow role read is also dropped, and teardown cancels pending lookups', async () => {
  const h = harness();
  const role = deferred();
  const pending = h.event({ uid: 'reviewer-a' }, { readRole: () => role.promise, readProfile: async () => ({ active: true, role: 'QC_REVIEWER' }) });
  h.sequence.invalidate();
  role.resolve('QC_REVIEWER');
  await pending;
  assert.deepEqual(h.states, []);
});

test('a failed lookup shows not authorized only while it is still current', async () => {
  const h = harness();
  await h.event({ uid: 'u1' }, { readRole: async () => 'QC_REVIEWER', readProfile: async () => { throw new Error('permission-denied'); } });
  assert.equal(h.states.at(-1).kind, 'unauthorized');
  const late = deferred();
  late.promise.catch(() => {}); // the gate may abandon this lookup before awaiting it
  const pending = h.event({ uid: 'u2' }, { readRole: async () => 'QC_REVIEWER', readProfile: () => late.promise });
  await h.event(null);
  late.reject(new Error('late failure'));
  await pending;
  assert.equal(h.states.at(-1).kind, 'signed-out');
});
