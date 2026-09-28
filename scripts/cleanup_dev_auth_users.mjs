#!/usr/bin/env node
// Removes every Firebase Auth identity in central-pa-watershed-dev except the
// single persistent human admin account. Firestore documents are deliberately
// untouched so historical collector/reviewer UIDs and audit evidence remain intact.
//
// Safe by default: dry-run. Destructive mode requires BOTH:
//   --apply
//   --confirm-only-email=pzc5420@psu.edu

import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const PROJECT_ID = 'central-pa-watershed-dev';
const KEEP_EMAIL = 'pzc5420@psu.edu';
const apply = process.argv.includes('--apply');
const confirmation = process.argv
  .find((arg) => arg.startsWith('--confirm-only-email='))
  ?.slice('--confirm-only-email='.length);

if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('Refusing to run with Firebase emulator variables set; this tool is only for the live development project.');
  process.exit(1);
}

const app = initializeApp({ projectId: PROJECT_ID });
if (app.options.projectId !== PROJECT_ID) {
  throw new Error(`Refusing to run outside ${PROJECT_ID}.`);
}

const auth = getAuth(app);
const keeper = await auth.getUserByEmail(KEEP_EMAIL);

if (keeper.disabled || keeper.customClaims?.role !== 'ADMIN') {
  throw new Error(
    `${KEEP_EMAIL} must already be enabled with role=ADMIN. Run scripts/ensure_dev_admin.mjs --apply first.`,
  );
}

async function listAllUsers() {
  const users = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

const before = await listAllUsers();
const deleteTargets = before.filter((user) => user.uid !== keeper.uid);

console.log(`Target project: ${PROJECT_ID}${apply ? ' (APPLY)' : ' (dry run)'}`);
console.log(`Keeper: ${KEEP_EMAIL} uid=${keeper.uid} role=ADMIN`);
console.log(`Auth users before cleanup: ${before.length}`);
for (const user of deleteTargets) {
  console.log(`[delete] ${user.email ?? '(no email)'} uid=${user.uid}`);
}

if (!apply) {
  console.log(
    `Dry run only. Re-run with --apply --confirm-only-email=${KEEP_EMAIL} to delete the ${deleteTargets.length} non-keeper Auth identities.`,
  );
  process.exit(0);
}

if (confirmation !== KEEP_EMAIL) {
  throw new Error(`Destructive cleanup requires --confirm-only-email=${KEEP_EMAIL}.`);
}

for (const user of deleteTargets) {
  await auth.revokeRefreshTokens(user.uid);
  await auth.deleteUser(user.uid);
}

const after = await listAllUsers();
if (after.length !== 1 || after[0].uid !== keeper.uid || after[0].email !== KEEP_EMAIL) {
  throw new Error(
    `Cleanup verification failed: expected only ${KEEP_EMAIL}, found ${after.length} Auth user(s).`,
  );
}

console.log(`Cleanup complete. Firebase Auth now contains exactly one persistent human account: ${KEEP_EMAIL}.`);
console.log('No Firestore user, submission, revision, audit, or scientific record was deleted or rewritten.');
