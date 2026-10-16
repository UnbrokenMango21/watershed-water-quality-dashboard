// Server-owned membership and reviewer authorization. Client payloads never carry roles.
import { randomUUID } from 'node:crypto';
import { normalizeDisplayName } from './display_name.mjs';

export class AccessError extends Error {
  constructor(code, message) { super(message); this.name = 'AccessError'; this.code = code; }
}
const fail = (code, message) => { throw new AccessError(code, message); };
function object(data, keys) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).some(key => !keys.includes(key))) {
    fail('invalid-argument', 'Unsupported account fields.');
  }
}
function identifier(value) {
  if (typeof value !== 'string' || !value || value.length > 128 || /[\/\u0000-\u001f]/.test(value)) fail('invalid-argument', 'Invalid account or request ID.');
  return value;
}
export async function currentAccount(auth, uid, { verified = true } = {}) {
  if (!uid) fail('unauthenticated', 'Sign in to continue.');
  const account = await auth.getUser(uid);
  if (account.disabled) fail('permission-denied', 'This account is disabled.');
  if (verified && !(account.emailVerified && account.email) && !account.phoneNumber) {
    fail('failed-precondition', 'Verify your email address before continuing.');
  }
  return account;
}

export async function initializeMembership({ db, auth, uid, data, serverTimestamp }) {
  object(data, ['displayName']);
  const displayName = normalizeDisplayName(data.displayName);
  const account = await currentAccount(auth, uid);
  const ref = db.collection('users').doc(uid);
  await db.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    const profile = snapshot.data() ?? {};
    // An existing suspension or privileged role can never be cleared by self-service signup.
    const ordinary = !profile.role && !['ADMIN', 'QC_REVIEWER'].includes(account.customClaims?.role);
    tx.set(ref, {
      display_name: displayName,
      verified_email: account.emailVerified ? account.email : null,
      verified_phone: account.phoneNumber ?? null,
      updated_at: serverTimestamp(),
      ...(snapshot.exists ? {} : { created_at: serverTimestamp() }),
      ...(ordinary ? { role: 'COLLECTOR', active: profile.active !== false } : {}),
    }, { merge: true });
    tx.set(db.collection('reviewerDisplayProfiles').doc(uid), {
      uid, display_name: displayName, identity_verified: true, updated_at: serverTimestamp(),
    });
  });
  await auth.updateUser(uid, { displayName });
  // Missing claims resolve to COLLECTOR. Signup never writes claims: a concurrent
  // administrator decision must not be overwritten with an older Auth snapshot.
  return { uid, displayName };
}

export async function requestReviewerAccess({ db, auth, uid, data, serverTimestamp }) {
  object(data, ['reason']);
  if (typeof data.reason !== 'string' || data.reason.trim().length < 5 || data.reason.length > 1000) {
    fail('invalid-argument', 'Explain your reviewer access request in 5 to 1000 characters.');
  }
  const account = await currentAccount(auth, uid);
  const requestRef = db.collection('reviewerAccessRequests').doc(uid);
  const profileRef = db.collection('users').doc(uid);
  return db.runTransaction(async tx => {
    const [existing, profileSnapshot] = await Promise.all([tx.get(requestRef), tx.get(profileRef)]);
    const profile = profileSnapshot.data();
    if (!profile || profile.active !== true || !profile.display_name) fail('failed-precondition', 'Complete your verified account profile first.');
    if (existing.exists) return { status: existing.data().status, requestId: existing.data().request_id };
    if (['ADMIN', 'QC_REVIEWER'].includes(profile.role)) fail('already-exists', 'This account already has review authorization.');
    const requestId = randomUUID();
    tx.create(requestRef, {
      uid, request_id: requestId, status: 'PENDING', reason: data.reason.trim(),
      display_name: profile.display_name, verified_email: account.emailVerified ? account.email : null,
      created_at: serverTimestamp(), updated_at: serverTimestamp(),
    });
    return { status: 'PENDING', requestId };
  });
}

export async function decideReviewerAccess({ db, auth, uid, data, serverTimestamp, now = Date.now }) {
  object(data, ['uid', 'requestId', 'status', 'reason']);
  const targetUid = identifier(data.uid), requestId = identifier(data.requestId);
  if (!['APPROVED', 'REJECTED', 'SUSPENDED', 'REVOKED'].includes(data.status)) fail('invalid-argument', 'Choose an access decision.');
  const reason = typeof data.reason === 'string' ? data.reason.trim() : '';
  if (reason.length < 5 || reason.length > 1000) fail('invalid-argument', 'Record a decision reason in 5 to 1000 characters.');
  const actor = await currentAccount(auth, uid);
  if (actor.customClaims?.role !== 'ADMIN') fail('permission-denied', 'Administrator authorization is required.');
  const target = await currentAccount(auth, targetUid, { verified: data.status === 'APPROVED' });
  if (targetUid === uid || target.customClaims?.role === 'ADMIN' || target.email?.toLowerCase() === 'pzc5420@psu.edu') {
    fail('permission-denied', 'Administrator membership cannot be changed here.');
  }
  const actorRef = db.collection('users').doc(uid), targetRef = db.collection('users').doc(targetUid);
  const requestRef = db.collection('reviewerAccessRequests').doc(targetUid);
  const operation = randomUUID();
  const acquired = await db.runTransaction(async tx => {
    const [actorSnapshot, targetSnapshot, requestSnapshot] = await Promise.all([tx.get(actorRef), tx.get(targetRef), tx.get(requestRef)]);
    const admin = actorSnapshot.data(), profile = targetSnapshot.data(), request = requestSnapshot.data();
    if (!admin || admin.role !== 'ADMIN' || admin.active !== true || (admin.access_version && admin.access_version !== actor.customClaims?.access_version)) {
      fail('permission-denied', 'Active administrator authorization is required.');
    }
    if (!request || request.request_id !== requestId) fail('aborted', 'This access request has changed. Refresh before deciding.');
    if (!profile || profile.role === 'ADMIN') fail('permission-denied', 'This membership cannot be changed here.');
    if (request.operation_expires_at_ms > now()) fail('aborted', 'An access decision is already in progress.');
    if (request.status === data.status && request.decision_reason === reason && request.provisioning_state === 'COMPLETE') return false;
    if (data.status === 'APPROVED' && !['PENDING', 'SUSPENDED', 'REVOKED', 'APPROVED'].includes(request.status)) {
      fail('failed-precondition', 'A rejected request cannot be approved without a new authorization review.');
    }
    // Both systems deny review while the cross-service update is in progress. A crash leaves it closed.
    tx.update(targetRef, { role: 'COLLECTOR', access_version: operation, updated_at: serverTimestamp() });
    tx.update(requestRef, {
      provisioning_state: 'APPLYING', operation_id: operation, operation_expires_at_ms: now() + 60000,
      updated_at: serverTimestamp(),
    });
    return true;
  });
  if (!acquired) return { status: data.status, idempotent: true };
  const role = data.status === 'APPROVED' ? 'QC_REVIEWER' : 'COLLECTOR';
  // Preserve unrelated custom claims. Version fencing prevents an expired worker's claims from granting access.
  const freshTarget = await currentAccount(auth, targetUid, { verified: data.status === 'APPROVED' });
  await auth.setCustomUserClaims(targetUid, { ...freshTarget.customClaims, role, access_version: operation });
  const freshActor = await currentAccount(auth, uid);
  if (freshActor.customClaims?.role !== 'ADMIN') fail('permission-denied', 'Administrator authorization changed during this decision.');
  await db.runTransaction(async tx => {
    const [requestSnapshot, actorSnapshot] = await Promise.all([tx.get(requestRef), tx.get(actorRef)]);
    const admin = actorSnapshot.data();
    if (requestSnapshot.data()?.operation_id !== operation || admin?.active !== true || admin?.role !== 'ADMIN'
      || (admin.access_version && admin.access_version !== freshActor.customClaims?.access_version)) {
      fail('aborted', 'Authorization changed during this decision. Access remains closed.');
    }
    tx.update(targetRef, { role, access_version: operation, updated_at: serverTimestamp() });
    tx.update(requestRef, {
      status: data.status, provisioning_state: 'COMPLETE', operation_expires_at_ms: 0,
      decided_by: uid, decided_at: serverTimestamp(), decision_reason: reason, updated_at: serverTimestamp(),
    });
    tx.create(requestRef.collection('audit').doc(operation), {
      actor_uid: uid, target_uid: targetUid, request_id: requestId, status: data.status,
      reason, occurred_at: serverTimestamp(), access_version: operation,
    });
  });
  return { status: data.status, idempotent: false };
}
