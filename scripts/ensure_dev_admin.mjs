#!/usr/bin/env node
// One-time/live-dev repair for the sole persistent human Firebase Auth account.
// Safe by default: dry-run unless --apply is supplied. Never creates a new account,
// never changes a password, and never rewrites historical submissions/audit records.

import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const PROJECT_ID = 'central-pa-watershed-dev';
const ADMIN_EMAIL = 'pzc5420@psu.edu';
const apply = process.argv.includes('--apply');

console.log(`Target project: ${PROJECT_ID}${apply ? ' (APPLY)' : ' (dry run)'}`);
console.log(`Persistent human admin: ${ADMIN_EMAIL}`);

if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('Refusing to run with Firebase emulator variables set; this tool is only for the live development project.');
  process.exit(1);
}

const app = initializeApp({ projectId: PROJECT_ID });
if (app.options.projectId !== PROJECT_ID) {
  throw new Error(`Refusing to run outside ${PROJECT_ID}.`);
}

const auth = getAuth(app);
const db = getFirestore(app);
const user = await auth.getUserByEmail(ADMIN_EMAIL);
const existingClaims = user.customClaims ?? {};

console.log(`Existing UID preserved: ${user.uid}`);
console.log(`Current role: ${typeof existingClaims.role === 'string' ? existingClaims.role : '(none)'}`);
console.log(`Disabled: ${user.disabled}`);

if (!apply) {
  console.log('Dry run only. Re-run with --apply to set ADMIN, activate users/{uid}, and revoke old sessions.');
  process.exit(0);
}

if (user.disabled) {
  await auth.updateUser(user.uid, { disabled: false });
}

await auth.setCustomUserClaims(user.uid, { ...existingClaims, role: 'ADMIN' });

const userRef = db.collection('users').doc(user.uid);
const userDoc = await userRef.get();
await userRef.set({
  ...(userDoc.exists ? {} : {
    display_name: user.displayName || ADMIN_EMAIL,
    created_at: FieldValue.serverTimestamp(),
  }),
  role: 'ADMIN',
  active: true,
  updated_at: FieldValue.serverTimestamp(),
}, { merge: true });

await auth.revokeRefreshTokens(user.uid);

const verified = await auth.getUser(user.uid);
if (verified.email !== ADMIN_EMAIL || verified.customClaims?.role !== 'ADMIN' || verified.disabled) {
  throw new Error('Post-write verification failed; persistent admin account is not in the expected state.');
}

console.log(`Verified ${ADMIN_EMAIL} as active ADMIN with unchanged UID ${verified.uid}; prior refresh sessions revoked.`);
console.log('Password was not read, changed, printed, or stored.');
