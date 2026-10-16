import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp, GeoPoint } from 'firebase-admin/firestore';
import { coordinatePair, proposeCoordinates, decideCoordinates } from '../../profile/coordinate_proposals.mjs';

const correction = (siteId, overrides = {}) => ({ proposalId: randomUUID(), kind: 'COORDINATE_CORRECTION', siteId,
  latitude: 40.794, longitude: -77.861, gpsAccuracyM: 4.5, reason: 'The measured site location is north of the current point.', ...overrides });
const rejection = (id) => ({ proposalId: id, status: 'REJECTED', reason: 'The submitted coordinates require another field check.' });
const approval = (id) => ({ proposalId: id, status: 'APPROVED', reason: 'Coordinates checked against the verified field survey.' });

test('coordinate input rejects invalid/invented points and private workflow-field injection', async () => {
  assert.deepEqual(coordinatePair(40.79, -77.86), { latitude: 40.79, longitude: -77.86 });
  for (const pair of [[0, 0], [91, -77], [40, -181], [NaN, -77], [40, Infinity], ['40', -77], [null, null]]) {
    assert.throws(() => coordinatePair(...pair), (error) => error.code === 'invalid-argument');
  }
  for (const extra of ['status', 'submitted_by_uid', 'original_coordinates', 'role', 'decided_by_uid']) {
    await assert.rejects(proposeCoordinates({ data: { ...correction('site-a'), [extra]: 'forged' } }), error => error.code === 'invalid-argument');
  }
  await assert.rejects(proposeCoordinates({ data: correction('site-a', { gpsAccuracyM: -1 }) }), error => error.code === 'invalid-argument');
  await assert.rejects(proposeCoordinates({ data: correction('site-a', { proposalId: '../../other' }) }), error => error.code === 'invalid-argument');
  await assert.rejects(proposeCoordinates({ data: correction('site-a', { proposedSiteName: 'Unauthorized rename' }) }), error => error.code === 'invalid-argument');
});

test('coordinate proposals require authenticated verified users and decision paths reject collectors', async () => {
  await assert.rejects(proposeCoordinates({ data: correction('site-a') }), error => error.code === 'unauthenticated');
  const auth = { getUser: async () => ({ disabled: false, email: 'unverified@example.test', emailVerified: false }) };
  await assert.rejects(proposeCoordinates({ data: correction('site-a'), uid: 'unverified', auth }), error => error.code === 'failed-precondition');
  const collectorAuth = { getUser: async () => ({ disabled: false, email: 'verified@example.test', emailVerified: true, customClaims: { role: 'COLLECTOR' } }) };
  await assert.rejects(decideCoordinates({ data: approval(randomUUID()), uid: 'collector', auth: collectorAuth }), error => error.code === 'permission-denied');
});

const emulated = Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST);
test('private coordinate workflow is atomic, revision checked, idempotent and keeps authoritative history intact', { skip: !emulated }, async t => {
  const suffix = randomUUID();
  const app = initializeApp({ projectId: 'central-pa-watershed-dev' }, `coordinate-${suffix}`);
  const db = getFirestore(app), auth = getAuth(app), serverTimestamp = () => FieldValue.serverTimestamp();
  const input = { db, auth, serverTimestamp };
  const collector = `coord-collector-${suffix}`, reviewer = `coord-reviewer-${suffix}`, otherReviewer = `coord-other-${suffix}`;
  const siteId = `coord-site-${suffix}`;
  const siteRef = db.collection('siteCatalog').doc(siteId);
  const ids = [];
  const newSites = [];
  try {
    for (const [uid, role] of [[collector, 'COLLECTOR'], [reviewer, 'QC_REVIEWER'], [otherReviewer, 'ADMIN']]) {
      await auth.createUser({ uid, email: `${uid}@example.test`, emailVerified: true });
      await auth.setCustomUserClaims(uid, { role, access_version: 'v1' });
      await db.collection('users').doc(uid).set({ role, active: true, display_name: uid, access_version: 'v1' });
    }
    const original = { site_id: siteId, active: true, latitude: 40.7934, longitude: -77.8600,
      location: new GeoPoint(40.7934, -77.86), site_name_display: 'Private field site', site_code: 'COORD-TEST',
      site_tolerance_m: 30, publication_approved: false, updated_at: Timestamp.fromMillis(1000) };
    await siteRef.set(original);
    const historical = db.collection('submissions').doc(`coord-history-${suffix}`);
    await historical.set({ site_id: siteId, collector_user_id: collector, status: 'APPROVED' });
    await historical.collection('revisions').doc('immutable-r1').set({ latitude: original.latitude, longitude: original.longitude });
    const proposal = correction(siteId); ids.push(proposal.proposalId);
    const created = await proposeCoordinates({ ...input, uid: collector, data: proposal });
    assert.equal(created.status, 'PENDING');
    assert.deepEqual((await siteRef.get()).data(), original);
    const stored = (await db.collection('siteCoordinateProposals').doc(proposal.proposalId).get()).data();
    assert.deepEqual(stored.original_coordinates, { latitude: original.latitude, longitude: original.longitude });
    assert.equal(stored.gps_accuracy_m, 4.5);
    assert.equal(stored.submitted_by_uid, collector);
    assert.equal((await proposeCoordinates({ ...input, uid: collector, data: proposal })).idempotent, true);
    await assert.rejects(proposeCoordinates({ ...input, uid: collector, data: { ...proposal, latitude: 40.8 } }), error => error.code === 'already-exists');
    await assert.rejects(decideCoordinates({ ...input, uid: collector, data: approval(proposal.proposalId) }), error => error.code === 'permission-denied');
    const decided = await decideCoordinates({ ...input, uid: reviewer, data: approval(proposal.proposalId) });
    assert.equal(decided.status, 'APPROVED');
    const updated = (await siteRef.get()).data();
    assert.equal(updated.latitude, proposal.latitude);
    assert.equal(updated.coordinate_version, 1);
    assert.equal(updated.site_name_display, original.site_name_display);
    assert.equal((await historical.collection('revisions').doc('immutable-r1').get()).data().latitude, original.latitude);
    assert.equal((await decideCoordinates({ ...input, uid: reviewer, data: approval(proposal.proposalId) })).idempotent, true);
    await assert.rejects(decideCoordinates({ ...input, uid: otherReviewer, data: approval(proposal.proposalId) }), error => error.code === 'aborted');
    const after = (await db.collection('siteCoordinateProposals').doc(proposal.proposalId).get()).data();
    assert.deepEqual(after.original_coordinates, stored.original_coordinates);
    assert.deepEqual(after.proposed_coordinates, stored.proposed_coordinates);
    assert.equal((await db.collection('siteCoordinateProposals').doc(proposal.proposalId).collection('audit').get()).size, 2);

    await t.test('rejection preserves authoritative coordinates and supports unknown GPS accuracy', async () => {
      const data = correction(siteId, { gpsAccuracyM: null }); ids.push(data.proposalId);
      await proposeCoordinates({ ...input, uid: collector, data });
      const before = (await siteRef.get()).data();
      await decideCoordinates({ ...input, uid: reviewer, data: rejection(data.proposalId) });
      assert.deepEqual((await siteRef.get()).data(), before);
      assert.equal((await decideCoordinates({ ...input, uid: reviewer, data: rejection(data.proposalId) })).idempotent, true);
    });

    await t.test('stale original site changes reject approval with no partial audit/decision', async () => {
      const data = correction(siteId); ids.push(data.proposalId);
      await proposeCoordinates({ ...input, uid: collector, data });
      await siteRef.update({ longitude: -77.9, updated_at: FieldValue.serverTimestamp() });
      await assert.rejects(decideCoordinates({ ...input, uid: reviewer, data: approval(data.proposalId) }), error => error.code === 'aborted');
      const pending = db.collection('siteCoordinateProposals').doc(data.proposalId);
      assert.equal((await pending.get()).data().status, 'PENDING');
      assert.equal((await pending.collection('audit').get()).size, 1);
    });

    await t.test('concurrent decisions commit exactly one reviewer action', async () => {
      const data = correction(siteId); ids.push(data.proposalId);
      await proposeCoordinates({ ...input, uid: collector, data });
      const results = await Promise.allSettled([
        decideCoordinates({ ...input, uid: reviewer, data: approval(data.proposalId) }),
        decideCoordinates({ ...input, uid: otherReviewer, data: rejection(data.proposalId) }),
      ]);
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
      assert.equal(results.filter(result => result.status === 'rejected').length, 1);
      assert.equal((await db.collection('siteCoordinateProposals').doc(data.proposalId).collection('audit').get()).size, 2);
    });

    await t.test('new sites need explicit approved metadata and remain ineligible for publication', async () => {
      const data = { proposalId: randomUUID(), kind: 'NEW_SITE', latitude: 40.78, longitude: -77.85,
        reason: 'Request monitoring at a new surveyed location.', proposedSiteName: 'Proposed field site' };
      ids.push(data.proposalId);
      const result = await proposeCoordinates({ ...input, uid: collector, data }); newSites.push(result.siteId);
      assert.equal((await db.collection('siteCatalog').doc(result.siteId).get()).exists, false);
      await assert.rejects(decideCoordinates({ ...input, uid: reviewer, data: approval(data.proposalId) }), error => error.code === 'invalid-argument');
      await decideCoordinates({ ...input, uid: reviewer, data: { ...approval(data.proposalId), siteName: 'Approved field site', siteCode: 'REVIEW-NEW', siteToleranceM: 25 } });
      const site = (await db.collection('siteCatalog').doc(result.siteId).get()).data();
      assert.equal(site.publication_approved, false);
      assert.equal(site.site_name_display, 'Approved field site');
      assert.equal(site.site_tolerance_m, 25);
      assert.equal(site.watershed_name, null);
    });

    await t.test('role/profile version mismatch and self-review are refused', async () => {
      await db.collection('users').doc(reviewer).update({ access_version: 'v2' });
      const data = correction(siteId); ids.push(data.proposalId);
      await proposeCoordinates({ ...input, uid: collector, data });
      await assert.rejects(decideCoordinates({ ...input, uid: reviewer, data: approval(data.proposalId) }), error => error.code === 'permission-denied');
      await db.collection('users').doc(reviewer).update({ access_version: 'v1' });
      const selfProposal = correction(siteId); ids.push(selfProposal.proposalId);
      await proposeCoordinates({ ...input, uid: reviewer, data: selfProposal });
      await assert.rejects(decideCoordinates({ ...input, uid: reviewer, data: approval(selfProposal.proposalId) }), error => error.code === 'permission-denied');
    });
    await db.recursiveDelete(historical);
  } finally {
    for (const uid of [collector, reviewer, otherReviewer]) {
      await auth.deleteUser(uid).catch(() => {});
      await db.collection('users').doc(uid).delete();
    }
    for (const id of ids) await db.recursiveDelete(db.collection('siteCoordinateProposals').doc(id));
    for (const id of [siteId, ...newSites]) await db.collection('siteCatalog').doc(id).delete();
    await deleteApp(app);
  }
});
