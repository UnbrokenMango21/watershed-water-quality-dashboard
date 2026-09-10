import test from 'node:test';
import assert from 'node:assert/strict';

import { claimPublication, PublicationRetryableError } from '../../publication/orchestrator.mjs';

function ref(path, store) {
  return {
    path,
    collection(name) {
      return {
        doc(id) { return ref(`${path}/${name}/${id}`, store); },
      };
    },
  };
}

function fakeDb(seed = {}) {
  const store = new Map(Object.entries(seed).map(([path, value]) => [path, structuredClone(value)]));
  const snapshot = (r) => ({ exists: store.has(r.path), data: () => structuredClone(store.get(r.path)) });
  return {
    store,
    collection(name) {
      return { doc(id) { return ref(`${name}/${id}`, store); } };
    },
    async runTransaction(callback) {
      return callback({
        async get(r) { return snapshot(r); },
        update(r, patch) {
          if (!store.has(r.path)) throw new Error(`Missing ${r.path}`);
          store.set(r.path, { ...store.get(r.path), ...structuredClone(patch) });
        },
        set(r, value, options = {}) {
          const next = structuredClone(value);
          store.set(r.path, options.merge && store.has(r.path) ? { ...store.get(r.path), ...next } : next);
        },
        delete(r) { store.delete(r.path); },
      });
    },
  };
}

const Timestamp = {
  fromMillis(ms) { return ms; },
  now() { return Date.now(); },
};

const submissionPath = 'submissions/sub-1';
const jobPath = 'submissions/sub-1/publication/rev-2';
const approved = {
  submission_id: 'sub-1',
  status: 'APPROVED',
  review_decision: 'APPROVE',
  current_revision_id: 'rev-2',
  reviewed_revision_id: 'rev-2',
};

test('active publication lease fences concurrent duplicate approval delivery', async () => {
  const db = fakeDb({ [submissionPath]: approved });
  const first = await claimPublication({
    db, Timestamp, submissionId: 'sub-1', revisionId: 'rev-2', nowMs: 1_000, leaseMs: 240_000, leaseToken: 'lease-a',
  });
  assert.equal(first.attempt, 1);
  assert.equal(db.store.get(submissionPath).status, 'PUBLISHING');
  assert.equal(db.store.get(jobPath).active_lease_token, 'lease-a');

  await assert.rejects(
    () => claimPublication({
      db, Timestamp, submissionId: 'sub-1', revisionId: 'rev-2', nowMs: 1_100, leaseMs: 240_000, leaseToken: 'lease-b',
    }),
    PublicationRetryableError,
  );

  assert.equal(db.store.get(jobPath).attempt_count, 1);
  assert.equal(db.store.get(jobPath).active_lease_token, 'lease-a');
});

test('expired publication lease is recoverable and increments attempt without changing revision identity', async () => {
  const db = fakeDb({ [submissionPath]: approved });
  await claimPublication({
    db, Timestamp, submissionId: 'sub-1', revisionId: 'rev-2', nowMs: 1_000, leaseMs: 1_000, leaseToken: 'lease-a',
  });
  const recovered = await claimPublication({
    db, Timestamp, submissionId: 'sub-1', revisionId: 'rev-2', nowMs: 2_001, leaseMs: 1_000, leaseToken: 'lease-b',
  });
  assert.equal(recovered.attempt, 2);
  assert.equal(db.store.get(jobPath).active_lease_token, 'lease-b');
  assert.equal(db.store.get(jobPath).revision_id, 'rev-2');
  assert.equal(db.store.get(submissionPath).current_revision_id, 'rev-2');
});
