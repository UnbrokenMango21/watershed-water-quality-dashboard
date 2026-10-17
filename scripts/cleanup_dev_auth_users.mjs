#!/usr/bin/env node
// Explicit reviewed fixture-access suspension only. This script has NO account deletion path.
// Both designated identities and all historically referenced/unknown users are always preserved.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { PROJECT_ID, validateCleanupPlan } from './lib/identity_safety.mjs';
import { collectAccountInventory, privateIdentityReportPath } from './audit_auth_accounts.mjs';

async function main() {
  const args = process.argv.slice(2);
  const value = (key) => args.find((arg) => arg.startsWith(`${key}=`))?.slice(key.length + 1);
  if (args.some((arg) => arg !== '--apply' && !['--report=', '--approval=', '--uids='].some((key) => arg.startsWith(key)))) {
    throw new Error('Blanket/legacy cleanup flags are refused. Use explicit --report=, --approval= and --uids=.');
  }
  if (!value('--report') || !value('--approval') || !value('--uids')) {
    console.log('No action. First create a private complete account inventory; review exact fixture UIDs and supply --report=, --approval=, --uids=. Deletion is unavailable.');
    return;
  }
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Mixed/live emulator cleanup is refused.');
  const reportBytes = readFileSync(privateIdentityReportPath(value('--report')));
  const report = JSON.parse(reportBytes);
  const approval = JSON.parse(readFileSync(privateIdentityReportPath(value('--approval'))));
  const reportSha256 = createHash('sha256').update(reportBytes).digest('hex');
  const uids = value('--uids').split(',');
  const app = initializeApp({ projectId: PROJECT_ID });
  const auth = getAuth(app);
  const db = getFirestore(app);
  const currentUsers = await Promise.all(uids.map((uid) => auth.getUser(uid)));
  const plan = validateCleanupPlan({ report, reportSha256, approval, uids, currentUsers });
  console.log(JSON.stringify({ project_id: PROJECT_ID, selected_accounts: plan.length, action: 'DISABLE_TEST_ACCESS', apply: args.includes('--apply'), deletion_available: false }));
  if (!args.includes('--apply')) { console.log('Dry run only. Specific human approval is required before --apply; the manifest records that approval.'); return; }
  // A review report cannot authorize suspension after a new historical reference has appeared.
  const currentInventory = await collectAccountInventory({ auth, db });
  const currentPlan = validateCleanupPlan({ report: currentInventory, reportSha256, approval, uids, currentUsers: await Promise.all(uids.map((uid) => auth.getUser(uid))) });
  if (currentPlan.length !== plan.length) throw new Error('Inventory changed; repeat review.');
  for (const { uid } of plan) {
    // Re-read immediately before suspension. Never alter scientific or historical profile documents.
    validateCleanupPlan({ report, reportSha256, approval: { ...approval, uids: [uid] }, uids: [uid], currentUsers: [await auth.getUser(uid)] });
    // Stop active reviewer/profile authorization before Auth suspension; preserve other profile fields.
    const profileRef = db.collection('users').doc(uid);
    const profile = await profileRef.get();
    if (profile.exists) await profileRef.update({ active: false, updated_at: FieldValue.serverTimestamp() });
    await auth.updateUser(uid, { disabled: true });
    await auth.revokeRefreshTokens(uid);
    await db.collection('identityAudit').add({ event_type: 'TEST_FIXTURE_ACCESS_DISABLED', subject_uid: uid,
      inventory_sha256: reportSha256, approval_reference: approval.approval_reference, approved_by: approval.approved_by,
      occurred_at: FieldValue.serverTimestamp() });
    if (!(await auth.getUser(uid)).disabled) throw new Error('Account suspension verification failed.');
  }
  console.log('Selected fixture access disabled and sessions revoked. No account or scientific/audit record was deleted.');
}
main().catch((error) => { console.error(error instanceof Error && !error.code ? error.message : 'Fixture suspension failed. Check private operator permissions; no credentials were printed.'); process.exitCode = 1; });
