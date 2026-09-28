#!/usr/bin/env node
// READ-ONLY preflight for the reviewer access model (docs/QC_CONSOLE_RUNBOOK.md "Reviewer access").
//
// Lists every Firebase Auth account whose custom `role` claim is QC_REVIEWER or ADMIN and checks that it
// is enabled and has an active users/{uid} profile with a reviewer role: the rule enforced by the QC
// review API (web/lib/reviewSubmission.mjs reviewerAccessProblem). The Firestore and Storage rules
// check the claim and the active profile but cannot see the Auth `disabled` flag, so a disabled account
// that still has an active profile is reported here as a problem to fix (deactivate its profile).
// Never writes. Prints no emails, names or UIDs; accounts are reported by position with a
// masked email domain only.
//
// Exit code 0 only when at least one active reviewer or admin exists and none would be locked out, so
// this gates `firebase deploy --only firestore:rules` for the stricter rules.
//
// Usage:
//   node scripts/verify_reviewer_access.mjs            # live central-pa-watershed-dev (needs read access)
//   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
//     node scripts/verify_reviewer_access.mjs          # emulator

import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'central-pa-watershed-dev';
const REVIEWER_ROLES = new Set(['QC_REVIEWER', 'ADMIN']);

/** Mirrors reviewerAccessProblem() in web/lib/reviewSubmission.mjs; kept pure for tests. */
export function accessProblem({ disabled, claimRole, profile }) {
  if (disabled) return 'account disabled';
  if (!REVIEWER_ROLES.has(claimRole)) return 'no reviewer role claim';
  if (!profile) return 'no users/{uid} profile';
  if (profile.active !== true) return 'profile inactive';
  if (!REVIEWER_ROLES.has(profile.role)) return 'profile role is not a reviewer role';
  return null;
}

export async function reviewerAccessReport({ auth, db }) {
  const rows = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const user of page.users) {
      const claimRole = user.customClaims?.role;
      if (!REVIEWER_ROLES.has(claimRole)) continue;
      const snapshot = await db.collection('users').doc(user.uid).get();
      const profile = snapshot.exists ? snapshot.data() : null;
      rows.push({
        domain: user.email ? user.email.replace(/^.*@/, '*@') : '(no email)',
        claim: claimRole,
        disabled: user.disabled,
        profile: profile ? { active: profile.active === true, role: profile.role ?? '(none)' } : null,
        problem: accessProblem({ disabled: user.disabled, claimRole, profile }),
      });
    }
    pageToken = page.pageToken;
  } while (pageToken);
  const ready = rows.filter((row) => row.problem === null);
  return { rows, ready: ready.length, lockedOut: rows.length - ready.length, pass: ready.length > 0 && ready.length === rows.length };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const app = initializeApp({ projectId: PROJECT_ID }, 'reviewer-access-preflight');
  const target = process.env.FIRESTORE_EMULATOR_HOST ? 'emulator' : `live ${PROJECT_ID}`;
  const report = await reviewerAccessReport({ auth: getAuth(app), db: getFirestore(app) });
  console.log(`Reviewer access preflight · ${target} · read-only`);
  report.rows.forEach((row, index) => console.log(JSON.stringify({ account: index + 1, ...row })));
  console.log(`Reviewer/admin claims: ${report.rows.length}; access-ready: ${report.ready}; would be locked out: ${report.lockedOut}`);
  console.log(report.pass ? 'PASS: stricter reviewer rules would not lock anyone out.' : 'FAIL: do not deploy the stricter reviewer rules yet.');
  process.exitCode = report.pass ? 0 : 1;
}
