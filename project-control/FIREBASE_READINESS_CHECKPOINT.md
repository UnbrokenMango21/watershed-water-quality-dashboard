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
| Auth configuration (providers, settings) | BLOCKED | See access gap. |
| Reviewer/admin role claims | BLOCKED | See access gap. |
| Active reviewer/admin `users/{uid}` profiles | BLOCKED | See access gap. By code, `scripts/ensure_dev_admin.mjs --apply` writes both the ADMIN claim and an active ADMIN profile, but no read has confirmed the live state. |
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
| Dashboard App Hosting rollout source | INFO | Backend `public-dashboard-dev` tracks `final/public-dashboard-v1` (`1fe71e4`), not integration; live build 2026-09-25 predates PR #42. |
| Live `siteCatalog` audit | BLOCKED | See access gap. |

## Access gap

The three BLOCKED reads (Auth claims and settings, `users/{uid}` profiles, `siteCatalog`) need a
credential that can call the Firebase Admin/Identity Toolkit and Firestore APIs. On this Mac:

- Application Default Credentials are not configured and `gcloud` is not installed.
- The project's MCP wrapper (`scripts/firebase-mcp-readonly.mjs`) deliberately exposes only core,
  functions and App Hosting tools; it has no Firestore document or Auth user reads.
- No GitHub Actions workflow holds a Firebase or Google Cloud credential (only App Store Connect keys).
- Deriving a credential from the Firebase CLI login was refused by the agent permission policy as
  credential materialization and was not attempted another way.

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

Tested locally at `1da94e0`: Firestore rules 45/45, Storage rules 6/6, validation 7/7, review API 17/17,
contracts 37/37, publication 17/17, profile 5/5 (including the preflight's parity with the review API),
and an emulator run of the preflight: PASS with an active reviewer and admin, FAIL (exit 1) after the
reviewer profile was deactivated.

## Blockers for a live iPhone test

1. `siteCatalog` not audited: which sites the phone offers, and whether test fixtures are selectable, is
   unverified.
2. Reviewer and admin claims and active profiles not verified; the stricter rules must not deploy until
   the preflight passes.
3. Live QC console (2026-09-13) and dashboard (2026-09-25) predate PR #42, and the QC backend's rollout
   branch no longer exists.
