# QC Trusted Web Readiness

**Branch:** `codex/qc-console-production-v1`

**Phase 11 baseline:** `d6900c2f45d39a00277a5df39a0af06adb28e2b4`

**Verification date:** 2026-08-14

## Current result

The QC implementation is source-complete and passes local production build,
backend/emulator, browser-emulator, and Phase 11 regression verification. It is
**not release-complete** because the real dev project cannot currently host the
dynamic Next.js API on Spark and no Admin SDK ADC or role-correct live reviewer
credential is available. Live deployment and real-project browser actions remain
explicitly BLOCKED in `docs/QC_CONSOLE_REMAINING_WORK.md`.

## Acceptance status

| Area | Result | Evidence |
|---|---|---|
| Exact roles and no public signup | PASS | `COLLECTOR`, `QC_REVIEWER`, `ADMIN`; AuthGate has sign-in/sign-out only. |
| Current server authorization | PASS | Revoked-token check, current Auth user fetch, disabled check, current custom-claim authorization. Emulator HTTP probes return 401/403 correctly. |
| Queue | PASS | Direct `status == PENDING_REVIEW`, oldest first; complete requested columns, Eastern time, loading/empty/error/refresh/clickable behavior. Browser run showed exactly three pending fixtures and excluded blocking/rejected fixtures. |
| Scientific detail | PASS | IDs, collector, county/watershed/GPS, collection, entered and canonical values/units, scores/versions, grouped flags, original notes, revisions, audit, and read-only historical attachment metadata. |
| No science editing | PASS | Detail fields are display-only; hostile rules tests deny reviewer/admin direct workflow, revision, measurement, audit, and role writes. |
| Approve / Correction / Reject | PASS locally | Exactly three controls; expected revision always sent; reasons enforced; server transaction and browser emulator actions pass. Live is BLOCKED. |
| Race/stale/idempotency | PASS | Concurrent domain tests and a two-browser-session run prove one winner/409 loser. Exact retry includes reviewer and normalized reason and writes no duplicate audit. |
| Audit and immutability | PASS | One review audit in the transaction; correction lifecycle asserts revision 1 byte-for-byte unchanged. Browser verification confirmed both revisions remained submitted. |
| Development identities/sites/data | PASS locally / BLOCKED live | Credential-free dry runs and emulator apply/reapply pass. Real apply needs ADC. |
| Real Firebase browser config | PASS | Registered dev Web app and ignored local env configured from `firebase apps:sdkconfig`; Email/Password provider probe passed. |
| Real dev deployment/browser | BLOCKED | App Hosting requires Blaze; no live role-correct reviewer or Admin ADC. |
| CI definition | PASS | Workflow runs web, backend/rules/validation/review, Android, iOS, legacy Expo, and hygiene on this branch. Final remote run is reported after push. |

## Verification commands

Run from repository root:

```bash
git diff --check
npm run test:contracts
firebase emulators:exec --project central-pa-watershed-dev --only firestore,storage \
  "node tests/firestore-rules/run-tests.cjs && node tests/firestore-rules/run-storage-tests.cjs && node tests/validation-firestore/run-tests.cjs"
firebase emulators:exec --project central-pa-watershed-dev --only firestore,functions \
  "npm run test:trigger"
firebase emulators:exec --project central-pa-watershed-dev --only firestore \
  "npm run test:review"
npm --prefix web run typecheck
npm --prefix web run build
```

## Final local results

| Gate | Result |
|---|---|
| Backend contracts | 30/30 PASS |
| Firestore rules | 42/42 PASS |
| Storage rules | 6/6 PASS |
| Validation persistence/orchestrator | 7/7 PASS |
| Validation trigger | 1/1 PASS |
| Review action/lifecycle | 16/16 PASS |
| Backend total | 102/102 PASS |
| Web typecheck / production build | PASS / PASS |
| Android unit, lint, debug, minified release, instrumentation APK | PASS |
| iOS simulator tests / unsigned release archive | 11/11 PASS / PASS |
| Legacy Expo contracts, typecheck, lint, privacy, iOS/Android export, doctor | PASS (doctor 21/21) |

The complete environment and browser evidence is in
`docs/QC_CONSOLE_LIVE_TEST.md`; operation/deployment commands are in
`docs/QC_CONSOLE_RUNBOOK.md`.
