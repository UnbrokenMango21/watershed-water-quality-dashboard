#!/usr/bin/env node
// Provisions the fixed set of human-readable dev/test identities (2 collectors, 1 QC
// reviewer, 1 admin) used across iOS/Android manual testing and CI smoke tests.
//
// Sets the Firebase Auth displayName (the source both native apps already read for
// "friendly name" display) and the `role` custom claim (the source Firestore/Storage
// security rules already read), and mirrors a matching `users/{uid}` Firestore doc.
//
// Safe by default: requires --apply to write anything; otherwise prints a dry-run plan.
// Refuses to run against any project other than the configured dev project, so it can
// never accidentally touch real production accounts.
//
// Usage:
//   node scripts/provision_test_users.mjs                # dry run
//   node scripts/provision_test_users.mjs --apply         # actually create/update users
//
// Requires Application Default Credentials for the central-pa-watershed-dev project
// (e.g. `gcloud auth application-default login` or GOOGLE_APPLICATION_CREDENTIALS),
// or FIREBASE_AUTH_EMULATOR_HOST / FIRESTORE_EMULATOR_HOST set to target the emulator.

import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const DEV_PROJECT_ID = 'central-pa-watershed-dev';

const TEST_USERS = [
  { email: 'test.collector.01@central-pa-watershed-dev.local', displayName: 'Test Collector 01', role: 'COLLECTOR' },
  { email: 'test.collector.02@central-pa-watershed-dev.local', displayName: 'Test Collector 02', role: 'COLLECTOR' },
  { email: 'test.qc.reviewer@central-pa-watershed-dev.local', displayName: 'Test QC Reviewer', role: 'QC_REVIEWER' },
  { email: 'test.admin@central-pa-watershed-dev.local', displayName: 'Test Admin', role: 'ADMIN' },
];

const apply = process.argv.includes('--apply');

const app = initializeApp({ projectId: DEV_PROJECT_ID });
const usingEmulator = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST);

if (!usingEmulator && app.options.projectId !== DEV_PROJECT_ID) {
  console.error(`Refusing to run: resolved project '${app.options.projectId}' is not the dev project '${DEV_PROJECT_ID}'.`);
  process.exit(1);
}

const auth = getAuth(app);
const db = getFirestore(app);

async function upsertUser({ email, displayName, role }) {
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
    userRecord = null;
  }

  const plan = { email, displayName, role, action: userRecord ? 'update' : 'create', uid: userRecord?.uid ?? '(new)' };
  console.log(`[${apply ? 'apply' : 'dry-run'}] ${plan.action} ${email} -> displayName="${displayName}" role=${role} uid=${plan.uid}`);
  if (!apply) return plan;

  if (!userRecord) {
    userRecord = await auth.createUser({ email, emailVerified: true, displayName, disabled: false });
  } else if (userRecord.displayName !== displayName) {
    await auth.updateUser(userRecord.uid, { displayName });
  }

  await auth.setCustomUserClaims(userRecord.uid, { role });

  await db.collection('users').doc(userRecord.uid).set({
    display_name: displayName,
    role,
    active: true,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  }, { merge: true });

  return { ...plan, uid: userRecord.uid };
}

const results = [];
for (const user of TEST_USERS) {
  results.push(await upsertUser(user));
}

if (!apply) {
  console.log('\nDry run only — no changes made. Re-run with --apply to provision these accounts.');
  console.log('Passwords are not set here: use the Firebase Console or `auth.generatePasswordResetLink()` to issue credentials out of band.');
}
