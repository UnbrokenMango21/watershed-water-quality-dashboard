import test from 'node:test';
import assert from 'node:assert/strict';
import { attributionReferences, classifyIdentity, identityFingerprint, identitySnapshot, PROJECT_ID, uidReferences, validateCleanupPlan, verifiedDesignatedIdentity } from '../../scripts/lib/identity_safety.mjs';
import { bootstrapBlockers } from '../../scripts/lib/identity_safety.mjs';
import { collectAccountInventory, privateIdentityReportPath } from '../../scripts/audit_auth_accounts.mjs';

const now = new Date('2026-10-15T19:00:00.000Z');
const fixture = { uid: 'fixture-uid', email: 'fixture@example.test', emailVerified: true, disabled: false,
  customClaims: { role: 'COLLECTOR', fixture: true }, providerData: [{ providerId: 'password', uid: 'provider-id', email: 'fixture@example.test' }],
  passwordHash: 'NEVER_SERIALIZE_HASH', passwordSalt: 'NEVER_SERIALIZE_SALT', refreshToken: 'NEVER_SERIALIZE_TOKEN' };
function cleanupInput() {
  return {
    report: { schema_version: '1.0.0', project_id: PROJECT_ID, target: 'LIVE', complete: true, generated_at: now.toISOString(),
      accounts: [{ ...identitySnapshot(fixture), identity_fingerprint: identityFingerprint(fixture), profile: null, references: [] }] },
    reportSha256: 'inventory-digest', approval: { action: 'DISABLE_TEST_ACCESS', project_id: PROJECT_ID,
      inventory_sha256: 'inventory-digest', approved_by: 'verified-admin', approval_reference: 'private-approval-17', approved_at: now.toISOString(), uids: [fixture.uid] },
    uids: [fixture.uid], currentUsers: [structuredClone(fixture)], now,
  };
}

test('identity snapshot allowlist never exports password hashes, salts or tokens', () => {
  const json = JSON.stringify(identitySnapshot(fixture));
  assert.ok(!json.includes('NEVER_SERIALIZE'));
  assert.deepEqual(identitySnapshot(fixture).provider_identities, [{ provider_id: 'password', provider_uid: 'provider-id', email: 'fixture@example.test' }]);
});

test('privileged bootstrap requires verified email, matching provider and independently confirmed UID', () => {
  const user = { ...fixture, uid: 'admin-uid', email: 'pzc5420@psu.edu', providerData: [{ providerId: 'password', email: 'pzc5420@psu.edu', uid: 'email-provider' }] };
  assert.equal(verifiedDesignatedIdentity(user, user.email, user.uid), 'ADMIN');
  for (const variant of [{ ...user, emailVerified: false }, { ...user, disabled: true }, { ...user, providerData: [] },
    { ...user, providerData: [{ providerId: 'google.com', email: 'another@example.test', uid: 'google-uid' }] }]) {
    assert.throws(() => verifiedDesignatedIdentity(variant, user.email, user.uid));
  }
  assert.throws(() => verifiedDesignatedIdentity(user, user.email, 'wrong-uid'));
  assert.throws(() => verifiedDesignatedIdentity(user, user.email));
  const supervisor = { ...user, email: 'fpp5057@psu.edu', providerData: [{ providerId: 'microsoft.com', email: 'fpp5057@psu.edu', uid: 'ms-uid' }] };
  assert.equal(verifiedDesignatedIdentity(supervisor, supervisor.email, supervisor.uid), 'QC_REVIEWER');
});

test('no email/name heuristic classifies real or unknown users as disposable fixtures', () => {
  assert.equal(classifyIdentity({ email: 'test.collector@example.test', display_name: 'Test User' }), 'UNCLASSIFIED_REQUIRES_OWNER_REVIEW');
  for (const email of ['pzc5420@psu.edu', 'fpp5057@psu.edu']) {
    assert.equal(classifyIdentity({ email, custom_claims: { fixture: true }, references: [] }), 'DESIGNATED_IDENTITY_PRESERVE');
  }
  assert.equal(classifyIdentity({ custom_claims: { fixture: true }, references: [{ path: 'submissions/a', profile_only: false }] }), 'HISTORY_REFERENCED_PRESERVE');
});

test('cleanup permits only explicit fresh reviewed unchanged fixtures and never deletion', () => {
  const input = cleanupInput();
  assert.deepEqual(validateCleanupPlan(input), [{ uid: fixture.uid, action: 'DISABLE_TEST_ACCESS', preserve_profile_and_history: true }]);
  for (const change of [
    (v) => { v.uids = []; }, (v) => { v.uids.push(v.uids[0]); },
    (v) => { v.report.complete = false; }, (v) => { v.report.target = 'EMULATOR'; },
    (v) => { v.report.generated_at = '2026-10-13T19:00:00.000Z'; },
    (v) => { v.approval.action = 'DELETE'; }, (v) => { v.approval.inventory_sha256 = 'wrong-digest'; },
    (v) => { v.approval.uids = ['another-uid']; }, (v) => { v.approval.approval_reference = ''; },
    (v) => { v.currentUsers[0].customClaims.role = 'ADMIN'; },
    (v) => { v.currentUsers[0].providerData[0].uid = 'changed-provider'; },
    (v) => { v.report.accounts[0].references.push({ path: 'submissions/historical', profile_only: false }); },
    (v) => { v.report.accounts[0].custom_claims.fixture = false; },
  ]) { const variant = cleanupInput(); change(variant); assert.throws(() => validateCleanupPlan(variant)); }
});

test('UID-reference scan records paths only and detects orphaned attribution', () => {
  assert.deepEqual(uidReferences({ collector_user_id: fixture.uid, field_notes_original: 'Private notes', nested: { actor: fixture.uid } }, new Set([fixture.uid])), [
    { uid: fixture.uid, field: 'collector_user_id' }, { uid: fixture.uid, field: 'nested.actor' },
  ]);
  assert.deepEqual(attributionReferences({ collector_user_id: 'removed-uid', note: 'not-a-uid', nested: { sender_uid: 'sender' } }), [
    { uid: 'removed-uid', field: 'collector_user_id' }, { uid: 'sender', field: 'nested.sender_uid' },
  ]);
});

test('inventory paginates Auth and traverses missing ancestors without publishing scientific contents', async () => {
  const pages = [];
  const auth = { async listUsers(size, token) { pages.push({ size, token }); return token ? { users: [{ ...fixture, uid: 'second' }] } : { users: [fixture], pageToken: 'next' }; } };
  const doc = (path, data, children = []) => ({ path, id: path.split('/').at(-1), async get() { return { exists: data !== null, data: () => data }; }, async listCollections() { return children; } });
  const collection = (refs) => ({ async listDocuments() { return refs; } });
  const audit = collection([doc('submissions/missing/audit/review', { actor_id: 'removed-uid', reason: 'PRIVATE_REVIEW_REASON' })]);
  const submissions = collection([doc('submissions/missing', null, [audit]), doc('submissions/sample', { collector_user_id: fixture.uid, value: 7.2, notes: 'PRIVATE_SCIENCE' })]);
  const users = collection([doc(`users/${fixture.uid}`, { display_name: 'Fixture Person', role: 'COLLECTOR', active: true }), doc('users/removed-uid', { role: 'QC_REVIEWER', active: false })]);
  const report = await collectAccountInventory({ auth, db: { async listCollections() { return [submissions, users]; } }, now, target: 'EMULATOR' });
  assert.equal(pages.length, 2);
  assert.equal(report.accounts.length, 2);
  assert.equal(report.complete, true);
  assert.equal(report.scanned_documents, 4);
  assert.equal(report.accounts.find((a) => a.uid === fixture.uid).classification, 'HISTORY_REFERENCED_PRESERVE');
  assert.equal(report.profiles_without_auth[0].uid, 'removed-uid');
  assert.equal(report.unmatched_attribution_references[0].uid, 'removed-uid');
  assert.ok(!JSON.stringify(report).includes('PRIVATE_'));
});

test('private report cannot be written into tracked docs or arbitrary destinations', () => {
  assert.throws(() => privateIdentityReportPath('docs/identity-inventory.json'));
  assert.throws(() => privateIdentityReportPath('/tmp/identity-inventory.json'));
  assert.match(privateIdentityReportPath('artifacts/identity/example.json'), /artifacts\/identity\/example\.json$/);
});

test('legacy blanket cleanup is refused before any cloud operation', async () => {
  const { spawnSync } = await import('node:child_process');
  const blocked = spawnSync(process.execPath, ['scripts/cleanup_dev_auth_users.mjs', '--apply', '--confirm-only-email=pzc5420@psu.edu'], { encoding: 'utf8' });
  assert.equal(blocked.status, 1);
  assert.match(blocked.stderr, /Blanket\/legacy cleanup flags are refused/);
  const dry = spawnSync(process.execPath, ['scripts/cleanup_dev_auth_users.mjs'], { encoding: 'utf8' });
  assert.equal(dry.status, 0);
  assert.match(dry.stdout, /No action/);
});

test('read-only REST inventory paginates collections/documents and detects missing ancestors', async () => {
  const { firestoreReadInventory } = await import('../../scripts/lib/firestore_read_inventory.mjs');
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, method: options.method ?? 'GET', body: options.body });
    assert.equal(options.headers.Authorization, 'Bearer private-test-token');
    if (url.endsWith(':listCollectionIds')) {
      const body = JSON.parse(options.body);
      return { ok: true, async json() { return body.pageToken ? { collectionIds: ['users'] } : { collectionIds: ['submissions'], nextPageToken: 'collection-next' }; } };
    }
    if (url.includes('pageToken=document-next')) return { ok: true, async json() { return { documents: [] }; } };
    return { ok: true, async json() { return { documents: [
      { name: 'projects/test/databases/(default)/documents/submissions/missing' },
      { name: 'projects/test/databases/(default)/documents/submissions/sample', createTime: now.toISOString(), fields: {
        collector_user_id: { stringValue: fixture.uid }, nested: { mapValue: { fields: { role: { stringValue: 'COLLECTOR' } } } },
      } },
    ], nextPageToken: 'document-next' }; } };
  };
  try {
    const db = firestoreReadInventory({ credential: { async getAccessToken() { return { access_token: 'private-test-token' }; } }, projectId: PROJECT_ID });
    const collections = await db.listCollections();
    assert.equal(collections.length, 2);
    const refs = await collections[0].listDocuments();
    assert.equal((await refs[0].get()).exists, false);
    assert.deepEqual((await refs[1].get()).data(), { collector_user_id: fixture.uid, nested: { role: 'COLLECTOR' } });
    assert.equal(calls.length, 4);
    assert.ok(calls.every((call) => call.method === 'GET' || (call.method === 'POST' && call.url.endsWith(':listCollectionIds'))));
  } finally { globalThis.fetch = originalFetch; }
});

test('bootstrap never silently undoes a suspension, a declined/revoked request or an in-flight decision', () => {
  const now = 1_000_000;
  assert.deepEqual(bootstrapBlockers({ profile: { active: true }, request: { status: 'APPROVED', provisioning_state: 'COMPLETE' }, now }), []);
  assert.deepEqual(bootstrapBlockers({ profile: undefined, request: undefined, now }), []);
  assert.equal(bootstrapBlockers({ profile: { active: false }, now }).length, 1);
  for (const status of ['SUSPENDED', 'REVOKED', 'REJECTED']) assert.equal(bootstrapBlockers({ profile: { active: true }, request: { status }, now }).length, 1, status);
  assert.equal(bootstrapBlockers({ request: { status: 'PENDING', provisioning_state: 'APPLYING' }, now }).length, 1);
  assert.equal(bootstrapBlockers({ request: { status: 'APPROVED', operation_expires_at_ms: now + 5 }, now }).length, 1);
  // An explicit, audited lift clears suspension blockers but never an in-flight decision.
  assert.deepEqual(bootstrapBlockers({ profile: { active: false }, request: { status: 'REVOKED' }, now, liftSuspension: true }), []);
  assert.equal(bootstrapBlockers({ request: { status: 'SUSPENDED', provisioning_state: 'APPLYING' }, now, liftSuspension: true }).length, 1);
});
