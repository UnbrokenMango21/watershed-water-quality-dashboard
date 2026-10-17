import { createHash } from 'node:crypto';

export const PROJECT_ID = 'central-pa-watershed-dev';
export const DESIGNATED_IDENTITIES = Object.freeze({
  'pzc5420@psu.edu': 'ADMIN',
  'fpp5057@psu.edu': 'QC_REVIEWER',
});
const VERIFIED_EMAIL_PROVIDERS = new Set(['password', 'google.com', 'microsoft.com', 'apple.com']);

export function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/** Admin-owned emailVerified plus a matching linked email identity; a typed address is no evidence. */
export function verifiedDesignatedIdentity(user, expectedEmail, expectedUid) {
  const email = normalizeEmail(expectedEmail);
  if (!Object.hasOwn(DESIGNATED_IDENTITIES, email)) throw new Error('Not a designated privileged identity.');
  if (!expectedUid || user.uid !== expectedUid) throw new Error('The independently verified UID must match the existing identity.');
  if (normalizeEmail(user.email) !== email || user.emailVerified !== true) throw new Error('The designated email must be verified by Firebase Authentication.');
  if (user.disabled) throw new Error('Refusing to reactivate a disabled identity; resolve its suspension separately.');
  const providers = user.providerData ?? user.provider_identities ?? [];
  if (!providers.some((provider) => VERIFIED_EMAIL_PROVIDERS.has(provider.providerId ?? provider.provider_id)
    && normalizeEmail(provider.email) === email && (provider.uid || provider.provider_uid))) {
    throw new Error('A supported linked provider with the same verified email is required.');
  }
  return DESIGNATED_IDENTITIES[email];
}

/** Explicit allowlist: never serialize Admin UserRecord, password hashes, salts or tokens. */
export function identitySnapshot(user) {
  const providers = (user.providerData ?? user.provider_identities ?? []).map((p) => ({
    provider_id: p.providerId ?? p.provider_id,
    provider_uid: p.uid ?? p.provider_uid,
    email: p.email ?? null,
  })).sort((a, b) => `${a.provider_id}:${a.provider_uid}`.localeCompare(`${b.provider_id}:${b.provider_uid}`));
  return {
    uid: user.uid,
    email: user.email ?? null,
    email_verified: user.emailVerified ?? user.email_verified ?? false,
    display_name: user.displayName ?? user.display_name ?? null,
    disabled: user.disabled === true,
    provider_identities: providers,
    custom_claims: user.customClaims ?? user.custom_claims ?? {},
    created_at: user.metadata?.creationTime ?? user.created_at ?? null,
    last_sign_in_at: user.metadata?.lastSignInTime ?? user.last_sign_in_at ?? null,
    tokens_valid_after: user.tokensValidAfterTime ?? user.tokens_valid_after ?? null,
  };
}

export function identityFingerprint(user) {
  const snapshot = identitySnapshot(user);
  // Name and last login can change without affecting cleanup authorization. Claim/provider/UID changes cannot.
  return createHash('sha256').update(JSON.stringify({
    uid: snapshot.uid, email: snapshot.email, email_verified: snapshot.email_verified,
    disabled: snapshot.disabled, providers: snapshot.provider_identities, claims: sortObject(snapshot.custom_claims),
  })).digest('hex');
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortObject(value[key])]));
  return value;
}

/** Return field paths only. Scientific contents, names, notes and values never enter the inventory. */
export function uidReferences(value, knownUids, prefix = '') {
  if (typeof value === 'string') return knownUids.has(value) ? [{ uid: value, field: prefix }] : [];
  if (Array.isArray(value)) return value.flatMap((item, index) => uidReferences(item, knownUids, `${prefix}[${index}]`));
  if (!value || typeof value !== 'object' || typeof value.toDate === 'function' || typeof value.path === 'string') return [];
  return Object.entries(value).flatMap(([key, item]) => uidReferences(item, knownUids, prefix ? `${prefix}.${key}` : key));
}

/** Surface historical attribution whose Auth identity has already been removed, without rewriting it. */
export function attributionReferences(value, prefix = '') {
  if (Array.isArray(value)) return value.flatMap((item, index) => attributionReferences(item, `${prefix}[${index}]`));
  if (!value || typeof value !== 'object' || typeof value.toDate === 'function') return [];
  return Object.entries(value).flatMap(([key, item]) => {
    const field = prefix ? `${prefix}.${key}` : key;
    if (typeof item === 'string' && item && /(?:^uid$|_uid$|_user_id$|^actor_id$)/.test(key)) {
      return [{ uid: item, field }];
    }
    return attributionReferences(item, field);
  });
}

export function classifyIdentity(account) {
  if (Object.hasOwn(DESIGNATED_IDENTITIES, normalizeEmail(account.email))) return 'DESIGNATED_IDENTITY_PRESERVE';
  if ((account.references ?? []).some((ref) => !ref.profile_only)) return 'HISTORY_REFERENCED_PRESERVE';
  if (account.profile?.is_test === true || account.custom_claims?.fixture === true) return 'FIXTURE_MARKER_REQUIRES_REVIEW';
  return 'UNCLASSIFIED_REQUIRES_OWNER_REVIEW';
}

export function validateCleanupPlan({ report, reportSha256, approval, uids, currentUsers, now = new Date() }) {
  if (report?.schema_version !== '1.0.0' || report.project_id !== PROJECT_ID || report.complete !== true || report.target !== 'LIVE') {
    throw new Error('Cleanup requires a complete live-project identity inventory.');
  }
  const age = now.valueOf() - Date.parse(report.generated_at);
  if (!Number.isFinite(age) || age < 0 || age > 24 * 60 * 60 * 1000) throw new Error('Inventory must be less than 24 hours old.');
  if (!Array.isArray(uids) || !uids.length || new Set(uids).size !== uids.length || uids.some((uid) => !uid || uid.includes('/'))) {
    throw new Error('Provide unique, explicit target UIDs; blanket cleanup is unavailable.');
  }
  const approvedAge = now.valueOf() - Date.parse(approval?.approved_at);
  if (approval?.action !== 'DISABLE_TEST_ACCESS' || approval.project_id !== PROJECT_ID
    || approval.inventory_sha256 !== reportSha256 || !approval.approved_by?.trim()
    || !approval.approval_reference?.trim() || !Number.isFinite(approvedAge) || approvedAge < 0 || approvedAge > 24 * 60 * 60 * 1000
    || !Array.isArray(approval.uids) || JSON.stringify([...approval.uids].sort()) !== JSON.stringify([...uids].sort())) {
    throw new Error('An explicit, fresh reviewed approval manifest must match the inventory digest and exact UIDs.');
  }
  return uids.map((uid) => {
    const account = report.accounts?.find((entry) => entry.uid === uid);
    const current = currentUsers.find((entry) => entry.uid === uid);
    if (!account || !current || identityFingerprint(current) !== account.identity_fingerprint) throw new Error('Identity changed or is absent; repeat inventory and review.');
    if (Object.hasOwn(DESIGNATED_IDENTITIES, normalizeEmail(account.email))
      || Object.hasOwn(DESIGNATED_IDENTITIES, normalizeEmail(current.email))) throw new Error('Both designated privileged identities are always preserved.');
    if (classifyIdentity(account) !== 'FIXTURE_MARKER_REQUIRES_REVIEW') throw new Error('Only explicitly marked fixtures without historical references are eligible.');
    return { uid, action: 'DISABLE_TEST_ACCESS', preserve_profile_and_history: true };
  });
}

/**
 * Why a designated-role bootstrap must not proceed. A suspended profile, a declined/suspended/revoked
 * reviewer request or an in-flight access decision is an administrator decision the bootstrap must
 * not silently undo; lifting a suspension needs an explicit, audited operator flag.
 */
export function bootstrapBlockers({ profile, request, now = Date.now(), liftSuspension = false }) {
  const blockers = [];
  if (profile?.active === false && !liftSuspension) blockers.push('The profile is suspended (active: false).');
  if (request && ['SUSPENDED', 'REVOKED', 'REJECTED'].includes(request.status) && !liftSuspension) {
    blockers.push(`The reviewer access request is ${request.status}.`);
  }
  if (request?.provisioning_state === 'APPLYING' || Number(request?.operation_expires_at_ms ?? 0) > now) {
    blockers.push('An access decision is still being applied.');
  }
  return blockers;
}
