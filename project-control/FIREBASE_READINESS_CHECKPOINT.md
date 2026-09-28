# Firebase readiness checkpoint (read-only)

- Date: 2026-09-28
- Project: `central-pa-watershed-dev`
- Reconciled against integration `1da94e04b8a15a99aacd41210f78c8c6bd2288b3` (merge of PR #42). Its
  rules, functions, validation, publication, QC API and scripts are byte-identical to `b9580c9`.
- Method: Firebase MCP (read-only wrapper) and Firebase CLI read commands only. Nothing was deployed,
  written, approved, published or merged on the live project. No identities, keys or credentials are
  recorded here.

**FIREBASE READY FOR LIVE IPHONE TEST: NO** (blockers at the end).

## Live state versus integration

| Check | Result | Evidence |
| --- | --- | --- |
| Project identity | PASS | `central-pa-watershed-dev`, number 652403958133, ACTIVE, billing enabled; `default` and `dev` aliases resolve to it. |
| Auth configuration (providers, settings) | PASS (Work console) | Email/Password and Google providers enabled, matching the iOS sign-in methods. |
| Reviewer/admin role claims | BLOCKED | Custom claims not yet read by any route (Work console did not show them). This gates the stricter rules and QC rollout. |
| Active reviewer/admin `users/{uid}` profiles | PARTIAL (Work console) | 6 active profiles: 2 ADMIN, 2 QC_REVIEWER, 2 COLLECTOR. One enabled Auth account has a matching active ADMIN profile. Which of the other profiles map to enabled accounts, and their claims, was not reported. |
| Deployed Firestore rules | PASS (previous model) | Live ruleset is the previous release: reviewer/admin reads trust the role claim only. |
| Deployed rules vs integration | GAP (expected, not deployed) | Integration requires an active reviewer profile in `isAdmin()`/`isReviewer()`. Compiles cleanly (rules validation: no errors). |
| Deployed Storage rules | NOT DEPLOYED (expected) | No active Storage release; media capture deferred. Integration Storage rules compile cleanly. |
| Composite indexes | PASS | 4 live, 4 in `firebase/firestore.indexes.json`; identical apart from the server-added `__name__` tie-breaker. |
| Delete protection | PASS | Enabled. |
| Backups | PASS | Weekly (Sunday) schedule, 30-day retention; latest backup READY (snapshot 2026-09-27). |
| Point-in-time recovery | RISK | Disabled (1 h version retention). Recommended before real data; not a blocker. |
| `validateSubmittedObservation` | PASS (presence/config) | v2 Firestore document-updated trigger, us-east4, 512 MiB, nodejs22; matches `functions/index.mjs`. Deployed source revision not readable read-only; function code unchanged since `d2c2435`. |
| `updateMyDisplayName` | PASS (presence/config) | v2 callable, us-east4, 256 MiB, nodejs22; matches code. Same source caveat. |
| Approval publisher | PASS (gated off) | Not deployed while `ENABLE_ARCGIS_PUBLICATION_FUNCTION` is off. |
| Live QC review API authorization | PASS (previous model), GAP vs integration | QC backend serves build 2026-09-13. The review route changed only on 2026-08-14 and in PR #42, so the live route verifies the ID token with revocation, re-reads the live user, refuses disabled accounts and requires a reviewer claim, without the active-profile check. Consistent with the live rules. |
| QC App Hosting rollout source | FAIL (configuration) | Backend `qc-console-dev` rolls out from `codex/qc-console-production-v1`, which no longer exists on the remote. PR #42 cannot reach the live console without an explicit rollout. |
| Dashboard App Hosting rollout | PASS (Work console) | Development dashboard rolled out successfully at integration `1da94e0`. |
| Live `siteCatalog` audit | PASS with finding (Work console) | 19 documents. All 18 `site-test-001`..`018` are `active=false`. `SITE-SYNTHETIC-001` is `active=true` and is the only selectable site; it has 5 private submission references (2 NEEDS_CORRECTION, 2 RESUBMITTED, 1 SUBMITTED). No data was changed. |

## Work console readback (attributed)

Recorded by the Work coordinator from the Firebase console on 2026-09-28, read-only, no data mutation.
Identities are omitted here.

- Auth: Email/Password and Google enabled; one enabled account has a matching active ADMIN profile;
  custom claims not verified.
- `users`: 6 active profiles (2 ADMIN, 2 QC_REVIEWER, 2 COLLECTOR).
- `siteCatalog`: 19 documents; 18 TEST fixtures inactive; `SITE-SYNTHETIC-001` active with 5 private
  in-flight submissions. Publication requires `publication_approved == true` and a non-TEST site code
  (`publication/transform.mjs`); that flag was not reported, and the publisher is not deployed, so
  nothing can reach the public views today.
- Dashboard: development rollout at `1da94e0` succeeded.

## Post-merge review triage (PR #42)

| Report | Verdict | Resolution on this branch |
| --- | --- | --- |
| 4119220956: rules cannot enforce the API's Auth `disabled` check, so "parity" was overstated | Valid (documentation and procedure) | Rules, runbook and preflight now state exactly what is immediate: the active-profile flag suspends reads and decisions at once; disabling Auth stops sign-in, refresh and decisions, but reads with an already-issued token continue until it expires (at most about an hour). Suspension order is profile first. The preflight fails for a disabled account that still has an active profile. No access semantics changed. |
| 4119221009: async profile lookup can restore a stale review screen after sign-out or a user switch | Valid (bug) | The gate logic moved to `web/lib/reviewerGate.mjs`: every auth event starts a new generation, results from an older generation are dropped, and teardown cancels pending lookups. `tests/qc/reviewer_gate.test.mjs` covers sign-out, user switch, slow role read, teardown and late failures; 4 of its 5 tests fail against a copy without the guards. |

Both test folders now run in `npm run test:contracts` (CI).

## Access gap

The three BLOCKED reads (Auth claims and settings, `users/{uid}` profiles, `siteCatalog`) need a
credential that can call the Firebase Admin/Identity Toolkit and Firestore APIs. On this Mac:

- Application Default Credentials are not configured and `gcloud` is not installed.
- The project's MCP wrapper (`scripts/firebase-mcp-readonly.mjs`) deliberately exposes only core,
  functions and App Hosting tools; it has no Firestore document or Auth user reads.
- No GitHub Actions workflow holds a Firebase or Google Cloud credential (only App Store Connect keys).
- Deriving a credential from the Firebase CLI login was refused by the agent permission policy as
  credential materialization and was not attempted another way.
- Re-assessed after the PR #42 merge: no already-authorized route exists. The remaining options are
  credential extraction (refused), widening the MCP allowlist (access expansion), or `firebase
  auth:export` (writes password hashes to disk). None was used.

Any one of these, approved by the project owner, closes the gap: Application Default Credentials for a
project reader; a read-only service account used through Workload Identity in a manual workflow; or
adding the Firebase MCP read-only Firestore/Auth tools to the wrapper's allowlist.

## Development deployment and readback plan (not executed)

Ordered so reviewers cannot be locked out. Stop at the first failure.

1. Read-only preflight, live: `node scripts/verify_reviewer_access.mjs`. It lists every account with a
   QC_REVIEWER or ADMIN claim (masked domain only) and exits 0 only if at least one exists and every one
   is enabled with an active reviewer profile. Also run `node scripts/audit_site_catalog.mjs --auth`
   and review its catalog classification (read-only).
2. If step 1 fails: an administrator repairs the named accounts first (for the admin, the existing
   `scripts/ensure_dev_admin.mjs --apply`; reviewers are provisioned the same way). Repeat step 1 until
   it passes. Do not continue on a failing preflight.
3. Deploy the QC console from integration `1da94e0` with an explicit App Hosting rollout (the backend's
   configured branch no longer exists), then read back the backend's current build. The new route
   enforces the same active-profile rule the preflight just proved, so no reviewer loses decision
   access.
4. Deploy Firestore rules only: `firebase deploy --only firestore:rules`. Read back with the Firebase
   MCP `firebase_get_security_rules` and compare to `firebase/firestore.rules` at `1da94e0`. Storage
   rules stay undeployed while media is deferred.
5. Re-run step 1 and a reviewer sign-in to the QC console: the queue must load (reads) and a test
   record must show the decision panel (API). Record PASS/FAIL here.
6. Rollback if step 5 fails: re-release the previous Firestore ruleset (it remains in the rules
   release history) and roll the QC backend back to build `build-2026-09-13-001`. Both are reversible
   and leave data untouched.

Tested locally on this branch (integration `1da94e0` plus the fixes above): contracts 47/47 (includes the QC gate and profile tests), QC typecheck and production build, Firestore rules 45/45, Storage rules 6/6, validation 7/7, review API 17/17,
publication 17/17,
and an emulator run of the preflight: PASS with an active reviewer and admin, FAIL (exit 1) after the
reviewer profile was deactivated.

## Gates

- Stricter Firestore rules and the QC console rollout: CLOSED until custom claims are read and
  `scripts/verify_reviewer_access.mjs` passes on live data (every QC_REVIEWER/ADMIN claim enabled with an
  active reviewer profile).

## Blockers for a live iPhone test

1. Custom claims unverified, so the reviewer side of the loop (and the rules/QC gate) is unproven.
   Profiles alone do not grant access; the claim is required.
2. The only selectable site is `SITE-SYNTHETIC-001`, which already carries private in-flight
   submissions. A live iPhone run would collect against a synthetic site: acceptable only as a clearly
   labelled development smoke test, not as monitoring science. Its `publication_approved` flag is
   unreported.
3. The live QC console is still the 2026-09-13 build, and its App Hosting rollout branch no longer
   exists; review would use the older console until an explicit rollout (gated above).
