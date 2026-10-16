// Private coordinate proposals. Collector proposals never change the authoritative site catalog.
// Reviewer decision, catalog write and audit event commit together in one Firestore transaction.
import { createHash } from 'node:crypto';
import { GeoPoint } from 'firebase-admin/firestore';
import { AccessError, currentAccount } from './access.mjs';

export class CoordinateProposalError extends AccessError {
  constructor(code, message) { super(code, message); this.name = 'CoordinateProposalError'; }
}
const fail = (code, message) => { throw new CoordinateProposalError(code, message); };
const roles = new Set(['COLLECTOR', 'QC_REVIEWER', 'ADMIN']);
const reviewers = new Set(['QC_REVIEWER', 'ADMIN']);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function object(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) {
    fail('invalid-argument', 'Unsupported coordinate proposal fields.');
  }
}
function text(value, label, minimum = 1, maximum = 160) {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/.test(value)) fail('invalid-argument', `${label} must be text without control characters.`);
  const normalized = value.normalize('NFC').trim().replace(/\s+/g, ' ');
  if ([...normalized].length < minimum || [...normalized].length > maximum) fail('invalid-argument', `${label} must be ${minimum} to ${maximum} characters.`);
  return normalized;
}
function proposalId(value) {
  if (typeof value !== 'string' || !uuidPattern.test(value)) fail('invalid-argument', 'Use a stable UUID for the proposal.');
  return value.toLowerCase();
}
function siteId(value) {
  if (typeof value !== 'string' || !value || value.length > 128 || /[\/\u0000-\u001f\u007f]/.test(value)) fail('invalid-argument', 'Choose a valid monitoring site.');
  return value;
}
export function coordinatePair(latitude, longitude) {
  if (typeof latitude !== 'number' || typeof longitude !== 'number' || !Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || (latitude === 0 && longitude === 0)) {
    fail('invalid-argument', 'Provide a valid monitoring-site latitude and longitude.');
  }
  return { latitude, longitude };
}
function accuracy(value) {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100_000) fail('invalid-argument', 'GPS accuracy must be a nonnegative number of meters, or left unknown.');
  return value;
}
function version(site) {
  const value = site.coordinate_version ?? 0;
  if (!Number.isSafeInteger(value) || value < 0 || value >= Number.MAX_SAFE_INTEGER) fail('failed-precondition', 'The site coordinate version requires administrative repair.');
  return value;
}
function timestampKey(value) {
  if (value == null) return null;
  if (typeof value.seconds === 'number' && typeof value.nanoseconds === 'number') return `${value.seconds}:${value.nanoseconds}`;
  if (typeof value.toMillis === 'function') return `milliseconds:${value.toMillis()}`;
  if (value instanceof Date) return value.valueOf();
  fail('failed-precondition', 'The site catalog timestamp requires administrative repair.');
}
function activeProfile(profile, account, reviewer = false) {
  const role = account.customClaims?.role ?? 'COLLECTOR';
  if (!profile || profile.active !== true || !roles.has(profile.role)
    || (reviewer && (!reviewers.has(role) || profile.role !== role))
    || (Object.hasOwn(profile, 'access_version') && profile.access_version !== account.customClaims?.access_version)) {
    fail('permission-denied', reviewer ? 'Active reviewer authorization is required.' : 'Complete your active verified account profile first.');
  }
  return role;
}
function fingerprint(payload) { return createHash('sha256').update(JSON.stringify(payload)).digest('hex'); }

export async function proposeCoordinates({ db, auth, uid, data, serverTimestamp }) {
  object(data, ['proposalId', 'kind', 'siteId', 'latitude', 'longitude', 'gpsAccuracyM', 'reason', 'proposedSiteName']);
  const id = proposalId(data.proposalId);
  if (!['NEW_SITE', 'COORDINATE_CORRECTION'].includes(data.kind)) fail('invalid-argument', 'Choose a new site or a coordinate correction.');
  const coordinates = coordinatePair(data.latitude, data.longitude);
  const targetSiteId = data.kind === 'COORDINATE_CORRECTION' ? siteId(data.siteId) : `site-${id}`;
  if (data.kind === 'NEW_SITE' && data.siteId != null) fail('invalid-argument', 'A new site ID is assigned by the server.');
  if (data.kind === 'COORDINATE_CORRECTION' && data.proposedSiteName != null) fail('invalid-argument', 'A coordinate correction cannot rename a site.');
  const payload = { kind: data.kind, site_id: targetSiteId, proposed_coordinates: coordinates,
    gps_accuracy_m: accuracy(data.gpsAccuracyM), reason: text(data.reason, 'Reason', 5, 1000),
    proposed_site_name: data.kind === 'NEW_SITE' ? text(data.proposedSiteName, 'Proposed site name', 2) : null };
  const account = await currentAccount(auth, uid);
  const proposalRef = db.collection('siteCoordinateProposals').doc(id);
  const profileRef = db.collection('users').doc(uid);
  const siteRef = db.collection('siteCatalog').doc(targetSiteId);
  return db.runTransaction(async tx => {
    const [existing, profileSnapshot, siteSnapshot] = await Promise.all([tx.get(proposalRef), tx.get(profileRef), tx.get(siteRef)]);
    activeProfile(profileSnapshot.data(), account);
    if (existing.exists) {
      const previous = existing.data();
      if (previous.submitted_by_uid !== uid || previous.request_fingerprint !== fingerprint(payload)) {
        fail('already-exists', 'This proposal ID is already in use.');
      }
      return { proposalId: id, siteId: targetSiteId, status: previous.status, idempotent: true };
    }
    if (data.kind === 'COORDINATE_CORRECTION' && (!siteSnapshot.exists || siteSnapshot.data().active !== true)) {
      fail('failed-precondition', 'The selected monitoring site is unavailable.');
    }
    if (data.kind === 'NEW_SITE' && siteSnapshot.exists) fail('already-exists', 'The proposed monitoring site already exists.');
    const site = siteSnapshot.data();
    const original = site ? coordinatePair(site.latitude, site.longitude) : null;
    tx.create(proposalRef, {
      proposal_id: id, ...payload, request_fingerprint: fingerprint(payload), submitted_by_uid: uid,
      submitted_by_display_name: profileSnapshot.data().display_name ?? account.displayName ?? null,
      original_coordinates: original, original_coordinate_version: site ? version(site) : null,
      original_site_updated_at_key: site ? timestampKey(site.updated_at) : null,
      status: 'PENDING', created_at: serverTimestamp(), updated_at: serverTimestamp(),
      decided_by_uid: null, decided_at: null, decision_reason: null,
    });
    tx.create(proposalRef.collection('audit').doc('proposed'), {
      event_type: 'COORDINATES_PROPOSED', proposal_id: id, site_id: targetSiteId,
      actor_uid: uid, occurred_at: serverTimestamp(),
    });
    return { proposalId: id, siteId: targetSiteId, status: 'PENDING', idempotent: false };
  });
}

export async function decideCoordinates({ db, auth, uid, data, serverTimestamp }) {
  object(data, ['proposalId', 'status', 'reason', 'siteName', 'siteCode', 'siteToleranceM']);
  const id = proposalId(data.proposalId);
  if (!['APPROVED', 'REJECTED'].includes(data.status)) fail('invalid-argument', 'Approve or reject the coordinate proposal.');
  const reason = text(data.reason, 'Decision reason', 5, 1000);
  const account = await currentAccount(auth, uid);
  if (!reviewers.has(account.customClaims?.role)) fail('permission-denied', 'Reviewer authorization is required.');
  const proposalRef = db.collection('siteCoordinateProposals').doc(id);
  const profileRef = db.collection('users').doc(uid);
  return db.runTransaction(async tx => {
    const [proposalSnapshot, profileSnapshot] = await Promise.all([tx.get(proposalRef), tx.get(profileRef)]);
    const reviewerRole = activeProfile(profileSnapshot.data(), account, true);
    if (!proposalSnapshot.exists) fail('not-found', 'The coordinate proposal could not be found.');
    const proposal = proposalSnapshot.data();
    if (proposal.submitted_by_uid === uid) fail('permission-denied', 'Another reviewer must decide your coordinate proposal.');
    const siteRef = db.collection('siteCatalog').doc(siteId(proposal.site_id));
    const siteSnapshot = await tx.get(siteRef);
    let approvedMetadata = null;
    if (proposal.kind === 'NEW_SITE' && data.status === 'APPROVED') {
      const tolerance = data.siteToleranceM;
      if (typeof tolerance !== 'number' || !Number.isFinite(tolerance) || tolerance <= 0 || tolerance > 10_000) {
        fail('invalid-argument', 'Choose a positive site tolerance in meters for the approved new site.');
      }
      approvedMetadata = { site_name_display: text(data.siteName, 'Approved site name', 2),
        site_code: text(data.siteCode, 'Approved site code', 2, 40), site_tolerance_m: tolerance };
    } else if (data.siteName != null || data.siteCode != null || data.siteToleranceM != null) {
      fail('invalid-argument', 'Site identity fields are only used when approving a new site.');
    }
    const decisionPayload = { status: data.status, reason, approved_metadata: approvedMetadata };
    const decisionFingerprint = fingerprint(decisionPayload);
    if (proposal.status !== 'PENDING') {
      if (proposal.status === data.status && proposal.decided_by_uid === uid && proposal.decision_fingerprint === decisionFingerprint) {
        return { proposalId: id, siteId: proposal.site_id, status: proposal.status, idempotent: true };
      }
      fail('aborted', 'Another coordinate decision is already recorded. Refresh the proposal.');
    }
    if (data.status === 'APPROVED') {
      const coordinates = coordinatePair(proposal.proposed_coordinates?.latitude, proposal.proposed_coordinates?.longitude);
      if (proposal.kind === 'COORDINATE_CORRECTION') {
        const site = siteSnapshot.data();
        if (!site || site.active !== true || site.latitude !== proposal.original_coordinates?.latitude
          || site.longitude !== proposal.original_coordinates?.longitude || version(site) !== proposal.original_coordinate_version
          || timestampKey(site.updated_at) !== proposal.original_site_updated_at_key) {
          fail('aborted', 'The approved site catalog changed after this proposal. Submit a fresh coordinate proposal.');
        }
        tx.update(siteRef, { ...coordinates, location: new GeoPoint(coordinates.latitude, coordinates.longitude),
          coordinate_version: version(site) + 1, updated_at: serverTimestamp() });
      } else if (proposal.kind === 'NEW_SITE') {
        if (siteSnapshot.exists) fail('aborted', 'The monitoring site already exists. Submit a fresh proposal.');
        tx.create(siteRef, { site_id: proposal.site_id, ...approvedMetadata, ...coordinates,
          location: new GeoPoint(coordinates.latitude, coordinates.longitude), coordinate_version: 1,
          county: null, watershed_name: null, active: true, publication_approved: false,
          created_at: serverTimestamp(), updated_at: serverTimestamp() });
      } else fail('failed-precondition', 'The proposal kind requires administrative repair.');
    }
    tx.update(proposalRef, { status: data.status, decided_by_uid: uid, decided_by_role: reviewerRole,
      decision_reason: reason, approved_metadata: approvedMetadata, decision_fingerprint: decisionFingerprint,
      decided_at: serverTimestamp(), updated_at: serverTimestamp() });
    tx.create(proposalRef.collection('audit').doc('decision'), {
      event_type: data.status === 'APPROVED' ? 'COORDINATES_APPROVED' : 'COORDINATES_REJECTED',
      actor_uid: uid, actor_role: reviewerRole, proposal_id: id, site_id: proposal.site_id,
      original_coordinates: proposal.original_coordinates, proposed_coordinates: proposal.proposed_coordinates,
      reason, occurred_at: serverTimestamp(),
    });
    return { proposalId: id, siteId: proposal.site_id, status: data.status, idempotent: false };
  });
}
