#!/usr/bin/env node
// Provisions role-separated test identities in the Firebase Emulator Suite only.
//
// This script is intentionally incapable of creating persistent live-dev users.
// Automated/manual test identities belong in the local Auth + Firestore emulators;
// the live development project keeps only the single persistent human admin account.
//
// Usage:
//   node scripts/provision_test_users.mjs
//   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
//   node scripts/provision_test_users.mjs --apply
//
// No password is created or printed. These identities exist only inside the emulator
// session and are used to preserve COLLECTOR / QC_REVIEWER / ADMIN role separation.

import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const PROJECT_ID = 'central-pa-watershed-dev';

const TEST_USERS = [
  { email: 'test.collector.01@emulator.invalid', displayName: 'Test Collector 01', role: 'COLLECTOR' },
  { email: 'test.collector.02@emulator.invalid', displayName: 'Test Collector 02', role: 'COLLECTOR' },
  { email: 'test.qc.reviewer@emulator.invalid', displayName: 'Test QC Reviewer', role: 'QC_REVIEWER' },
  { email: 'test.admin@emulator.invalid', displayName: 'Test Admin', role: 'ADMIN' },
];

const apply = process.argv.includes('--apply');
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;

console.log(`Target: Firebase Emulator Suite for ${PROJECT_ID}${apply ? ' (APPLY)' : ' (dry run)'}`);

if (!apply) {
  for (const { email, displayName, role } of TEST_USERS) {
    console.log(`[dry-run] ensure emulator identity ${email} -> displayName="${displayName}" role=${role}`);
  }
  console.log('\nDry run only. --apply is accepted only when both Auth and Firestore emulator hosts are set.');
  process.exit(0);
}

if (!authHost || !firestoreHost) {
  console.error(
    'Refusing to run outside the Firebase Emulator Suite. Set both FIREBASE_AUTH_EMULATOR_HOST and FIRESTORE_EMULATOR_HOST.',
  );
  process.exit(1);
}

const app = initializeApp({ projectId: PROJECT_ID });
const auth = getAuth(app);
const db = getFirestore(app);

async function upsertUser({ email, displayName, role }) {
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
    userRecord = await auth.createUser({
      email,
      emailVerified: true,
      displayName,
      disabled: false,
    });
  }

  if (userRecord.displayName !== displayName || userRecord.disabled) {
    userRecord = await auth.updateUser(userRecord.uid, { displayName, disabled: false });
  }

  await auth.setCustomUserClaims(userRecord.uid, { role });

  const userRef = db.collection('users').doc(userRecord.uid);
  const userDoc = await userRef.get();
  await userRef.set({
    display_name: displayName,
    role,
    active: true,
    ...(userDoc.exists ? {} : { created_at: FieldValue.serverTimestamp() }),
    updated_at: FieldValue.serverTimestamp(),
  }, { merge: true });

  console.log(`[emulator] ready ${email} role=${role} uid=${userRecord.uid}`);
  return userRecord.uid;
}

for (const user of TEST_USERS) {
  await upsertUser(user);
}

console.log(`Provisioned ${TEST_USERS.length} emulator-only test identities. No live Firebase Auth users were created.`);
