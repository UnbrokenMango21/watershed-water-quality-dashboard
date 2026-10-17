#!/usr/bin/env node
// Dry-run privileged-identity bootstrap. Never creates users, changes passwords, or re-enables suspensions.
import { randomUUID } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { bootstrapBlockers, DESIGNATED_IDENTITIES, PROJECT_ID, verifiedDesignatedIdentity } from './lib/identity_safety.mjs';

async function main() {
  const args = process.argv.slice(2);
  const value = (key) => args.find((arg) => arg.startsWith(`${key}=`))?.slice(key.length + 1);
  if (args.some((arg) => arg !== '--apply' && !['--email=', '--uid=', '--confirm-grant=', '--verification-reference=', '--lift-suspension='].some((key) => arg.startsWith(key)))) {
    throw new Error('Unsupported flag. Use --email, --uid, --verification-reference, --confirm-grant (and only if approved, --lift-suspension) with = values.');
  }
  const email = (value('--email') ?? 'pzc5420@psu.edu').toLowerCase();
  const expectedUid = value('--uid');
  const role = DESIGNATED_IDENTITIES[email];
  if (!role) throw new Error('Only the two designated privileged identities are supported.');
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST) throw new Error('This bootstrap targets live development only; emulator fixture tools are separate.');
  const app = initializeApp({ projectId: PROJECT_ID });
  const auth = getAuth(app);
  const db = getFirestore(app);
  const user = await auth.getUserByEmail(email);
  // Even dry runs refuse unverified, suspended and mismatched provider identities.
  verifiedDesignatedIdentity(user, email, expectedUid ?? user.uid);
  console.log(JSON.stringify({ project_id: PROJECT_ID, designated_identity: email, email_verified: user.emailVerified,
    provider_ids: user.providerData.map((provider) => provider.providerId), proposed_role: role, apply: args.includes('--apply') }));
  if (!args.includes('--apply')) {
    console.log('Dry run only. A trusted operator must independently verify the existing UID and obtain specific approval before granting cloud privileges.');
    return;
  }
  if (!expectedUid || value('--confirm-grant') !== `${expectedUid}:${role}` || !value('--verification-reference')?.trim()) {
    throw new Error('Apply requires --uid, --confirm-grant=UID:ROLE and a private identity-verification/approval reference.');
  }
  verifiedDesignatedIdentity(user, email, expectedUid);
  const ref = db.collection('users').doc(user.uid);
  const existing = await ref.get();
  const liftSuspension = value('--lift-suspension') === expectedUid;
  const blockers = bootstrapBlockers({ profile: existing.data(), request: (await db.collection('reviewerAccessRequests').doc(user.uid).get()).data(), liftSuspension });
  if (blockers.length) {
    throw new Error(`Refusing to bootstrap: ${blockers.join(' ')} An administrator decision must not be undone silently; use --lift-suspension=${expectedUid} only with specific approval.`);
  }
  // Access-version fencing stops old role-bearing tokens; preserve all unrelated claims/profile fields.
  const accessVersion = randomUUID();
  await ref.set({ role, active: false, access_version: accessVersion, updated_at: FieldValue.serverTimestamp(),
    ...(existing.exists ? {} : { display_name: user.displayName || email, created_at: FieldValue.serverTimestamp() }),
  }, { merge: true });
  await auth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), role, access_version: accessVersion });
  await auth.revokeRefreshTokens(user.uid);
  await db.collection('identityAudit').add({ event_type: 'DESIGNATED_ROLE_BOOTSTRAP', subject_uid: user.uid, role, lifted_suspension: liftSuspension,
    access_version: accessVersion, verification_reference: value('--verification-reference'), occurred_at: FieldValue.serverTimestamp() });
  await ref.set({ active: true, updated_at: FieldValue.serverTimestamp() }, { merge: true });
  if (role === 'QC_REVIEWER') {
    // A settled request record lets an administrator later suspend or revoke this reviewer from the
    // QC access page, exactly like a reviewer approved through a self-service request.
    const requestRef = db.collection('reviewerAccessRequests').doc(user.uid);
    await requestRef.set({
      uid: user.uid, request_id: accessVersion, status: 'APPROVED', provisioning_state: 'COMPLETE', operation_expires_at_ms: 0,
      reason: 'Designated QC reviewer provisioned by a trusted operator.', display_name: (await ref.get()).get('display_name') ?? email,
      verified_email: email, decision_reason: 'Designated identity verified by a trusted operator.', decided_by: 'trusted-bootstrap',
      created_at: FieldValue.serverTimestamp(), decided_at: FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp(),
    });
    await requestRef.collection('audit').doc(accessVersion).set({ event: 'DESIGNATED_ROLE_BOOTSTRAP', actor_uid: 'trusted-bootstrap',
      target_uid: user.uid, request_id: accessVersion, status: 'APPROVED', access_version: accessVersion, occurred_at: FieldValue.serverTimestamp() });
  }
  const current = await auth.getUser(user.uid);
  const profile = await ref.get();
  verifiedDesignatedIdentity(current, email, expectedUid);
  if (current.customClaims?.role !== role || current.customClaims?.access_version !== accessVersion
    || profile.get('role') !== role || profile.get('active') !== true || profile.get('access_version') !== accessVersion) {
    throw new Error('Post-write role/profile verification failed; do not grant access until repaired.');
  }
  console.log('Verified the existing designated account role and active profile. Historical records and passwords were unchanged. Prior sessions require sign-in.');
}
main().catch((error) => { console.error(error instanceof Error && !error.code ? error.message : 'Privileged identity bootstrap failed. Check private operator permissions; no credentials were printed.'); process.exitCode = 1; });
