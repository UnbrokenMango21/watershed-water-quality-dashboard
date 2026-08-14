# QC Trusted Web — Readiness

**Branch:** `codex/qc-trusted-web-v1` · **Baseline:** `7dbc714ca5a92b32ab159d09e8786fcc86f5bbeb`
**Date:** 2026-08-14 · Not committed, not pushed.

All results below are from commands actually executed in this environment against the
local Firebase emulator suite, local Gradle, and local Xcode — never claimed without a
real run. Where something could not be run (no live Firebase project, no physical
device), it is marked BLOCKED with the exact reason, not silently assumed passing.

## Acceptance gates

| # | Gate | Result | Evidence |
|---|---|---|---|
| 1 | Spark media never fails an otherwise-valid submission | PASS | Both platforms isolate per-attachment Storage failures in their own try/catch; the revision/submission Firestore writes commit independently and are never rolled back by a media failure. Verified by direct code reading (iOS `ProductionData.swift` sync(), Android `FirebaseData.kt` sync()) plus each platform's full test suite (below) passing with these paths exercised. Local media is never deleted on upload failure. |
| 2 | Entered + canonical measurement persisted for every non-temperature parameter | PASS | `entered_value`/`entered_unit_code` added to `config/firebase_schema.json`, `firebase/firestore.rules` (`validMeasurement()` now requires both), both mobile mappers, and the shared golden fixture. Enforced by `tests/firestore-rules` (new test: measurement rejected without them) and by each platform's own unit tests. |
| 3 | Final submission/workflow timestamps are trusted server timestamps | PASS | `firebase/firestore.rules` requires `submitted_at == request.time` on both `submissions` and `revisions`; both mobile clients write via `FieldValue.serverTimestamp()` at every finalization site (iOS also fixed a remaining client `updated_at` at the final-acknowledgement boundary). Verified by 2 new rules-emulator tests asserting a phone-supplied timestamp is rejected, plus each platform's own unit tests asserting the sentinel type is used. |
| 4 | Roles are exactly COLLECTOR / QC_REVIEWER / ADMIN | PASS | `config/firebase_schema.json` and `firebase/firestore.rules` are consistent; rules already gated on this role set before this phase, schema doc now matches. |
| 5 | Reviewers cannot edit scientific measurements; collectors cannot forge review fields; reviewer client cannot create audit records | PASS | Pre-existing rules already enforced this (confirmed by 3 pre-existing passing tests: `QC reviewer has read-only access...`, `collector cannot write audit records`, `collector cannot write validationFlags`), unmodified by this phase. The reviewer web app has zero client-side write paths — the only privileged write is the server-only API route. |
| 6 | Review action is atomic, transactional, idempotent, revision-aware, race-safe, audited exactly once per decision | PASS | `review/reviewSubmission.mjs`, 13 passing tests including a genuine concurrent-write race (two decisions fired simultaneously against the same emulator — exactly one wins, exactly one audit event is written) and an idempotent-replay test (identical repeated request returns the same result, no duplicate audit event). |
| 7 | Stale revision returns 409 | PASS | `ReviewConflictError` → HTTP 409 in the API route; covered by 3 emulator tests (stale revision id, non-`PENDING_REVIEW` status, later stale approval after a decision already applied). |
| 8 | Validation reuses the existing orchestrator; blocking errors never reach PENDING_REVIEW | PASS | No second validation engine was built. `review/reviewSubmission.mjs` imports nothing from `validation/`; it only acts on submissions already in `PENDING_REVIEW`, which `validation/persistence.mjs` only ever sets when `blocking === false`. New lifecycle test (scenario C) proves a blocking submission cannot be approved even via a direct call to the review action. |
| 9 | `/review` and `/review/{submissionId}` implemented, Firebase Email/Password auth, no public signup, Admin SDK server-only | PASS | `web/` — verified: `npx tsc --noEmit` clean, `npx next build` succeeds (routes: `/`, `/review`, `/review/[submissionId]`, `/api/submissions/[submissionId]/review`). No signup form exists anywhere in `web/`. `firebase-admin` is imported only in `web/lib/firebase-admin.ts` and the one API route; never in a `'use client'` file. |
| 10 | Queue shows only PENDING_REVIEW; required fields present | PASS | `web/lib/data.ts` `fetchQueue()` — `where('status','==','PENDING_REVIEW')`. Queue/detail field coverage checked directly against the spec by reading every page file. |
| 11 | Exactly three review actions, no scientific edit controls | PASS | `web/components/ReviewActions.tsx` — Approve/Request Correction/Reject only; `web/app/review/[submissionId]/page.tsx` renders every scientific field as read-only text/tables, no input bound to a measurement/revision field anywhere. |
| 12 | P0 mobile: submit-blocked-incorrectly bug root-caused and fixed on both platforms without weakening validation | PASS | See `docs/QC_TRUSTED_WEB_AUDIT.md` for the full root-cause writeup. Both platforms now gate the Measurements screen itself on the true completeness rule and make the requirement visible before the user ever reaches Review/Submit. |
| 13 | Strict numeric measurement validation with configured hard ranges | PASS | Non-numeric input already rejected on both platforms (Android via character-level filter, iOS via `Double(...)` parse); hard ranges for temperature/DO_MG_L/DO_PERCENT added from `config/validation_rules.json`'s actual numbers, pH's existing check kept. Blank optional fields remain non-blocking. |
| 14 | Error navigation (auto-expand/scroll/focus) | PASS | Both platforms now route Review/Submit failures back to the offending section and request focus on the specific field. |
| 15 | Required-field indicator mechanism, no duplicated hardcoded lists | PASS | Consolidated to one shared indicator per platform, derived from the same completeness rule used for validation. |
| 16 | Friendly test user display names | PASS (mobile) / BLOCKED (provisioning) | Mobile rendering was already correct on both platforms (verified by reading `AppModel.userDisplayName` / `AppViewModel.signedInName`). `scripts/provision_test_users.mjs` is built and verified end-to-end against the Firebase Auth + Firestore emulators (idempotent create-then-update proven by running it twice), but actually provisioning the real dev-project accounts requires live `central-pa-watershed-dev` credentials not available in this sandbox — **BLOCKED, not executed against production**. |
| 17 | Test site coverage (search/filter/similar names/multiple regions) | PASS | `scripts/seed_test_sites.mjs` — 18 sites across 8 counties, including 3 "Spring Creek" and 2 "Loyalhanna Creek" near-duplicates. Verified end-to-end against the Firestore emulator (dry-run + `--apply`). Actual seeding of the live dev project is the same BLOCKED-by-credentials situation as above. |
| 18 | Site proposal/admin workflow does not destabilize the locked QC lifecycle | PASS | Not implemented in this phase; fully designed in `docs/SITE_CATALOG_ADMINISTRATION_PHASE.md` as an explicit follow-on, per the task's own scope guidance. |

## Test results actually executed

All commands run from the repo root unless noted. All emulator suites ran against the
real local Firestore/Storage/Auth/Functions emulators (`firebase emulators:exec`), not
mocks.

| Suite | Command | Result |
|---|---|---|
| Backend validation/contract unit tests | `npm run test:contracts` | **28/28 pass** |
| Firestore rules (emulator) | `node tests/firestore-rules/run-tests.cjs` | **32/32 pass** (29 pre-existing + 3 new: forged submission timestamp, forged revision timestamp, measurement provenance) |
| Storage rules (emulator) | `node tests/firestore-rules/run-storage-tests.cjs` | **6/6 pass** |
| Validation persistence/orchestrator (emulator) | `node tests/validation-firestore/run-tests.cjs` | **7/7 pass** |
| Review action + lifecycle (emulator) | `npm run test:review` | **13/13 pass** (new) |
| Validation Firestore trigger (emulator, Functions) | `npm run test:trigger` | **1/1 pass** |
| Web TypeScript check | `cd web && npx tsc --noEmit` | **Clean, 0 errors** |
| Web production build | `cd web && npx next build` | **Succeeds** — routes `/`, `/review`, `/review/[submissionId]`, `/api/submissions/[submissionId]/review` all compile |
| Android unit tests | `./gradlew --no-daemon :app:testDebugUnitTest` | **14/14 pass** (6 `ModelTest` + 8 `ProductionDomainTest`) |
| Android lint | `./gradlew --no-daemon :app:lintDebug` | **Pass** — 0 errors, 7 pre-existing-style warnings |
| Android debug build | `./gradlew --no-daemon :app:assembleDebug` | **Succeeds** |
| Android release build | `./gradlew --no-daemon :app:assembleRelease` | **Succeeds** (minified R8 release APK) |
| iOS unit/UI tests | `xcodebuild test` (iPhone 17 Pro simulator, iOS 27) | **7/7 pass** |
| iOS unsigned release archive | `xcodebuild archive -configuration Release` | **`** ARCHIVE SUCCEEDED **`** |

**Backend total: 87/87 passing. Android: 14/14 unit tests + clean lint + debug/release
build. iOS: 7/7 tests + release archive. Web: clean typecheck + production build.**

### A note on environment flakiness encountered and resolved

Early in verification, a *fresh* (non-cached) Android Gradle resource-packaging task
failed with `Operation not permitted` copying an unrelated, unmodified XML resource —
reproducible even on a completely clean `app/build/` directory. This was **not** a code
regression: it was traced to a stale Gradle daemon left over from an earlier
background-agent process holding a mismatched sandbox context. `./gradlew --no-daemon`
resolved it immediately and every subsequent Android command (including a from-scratch
`assembleRelease`) succeeded cleanly. Recorded here so the same signature isn't
mistaken for a real defect in a future run.

### A genuine regression found and fixed during verification

`xcodebuild test` initially failed 3 assertions inside one iOS test
(`testGoldenCanonicalMappingAndStableMeasurementIDs`) with
`NSInvalidArgumentException: Invalid type in JSON write (FSTServerTimestampFieldValue)`
— a direct, mechanical consequence of correctly switching `submitted_at` to
`FieldValue.serverTimestamp()`: the test tried to `JSONSerialization`-encode that
opaque sentinel. Fixed in the test helper only (asserted the sentinel type directly,
excluded just that one key from the fixture diff); the production trusted-timestamp
code was never weakened. Full detail in `docs/QC_TRUSTED_WEB_AUDIT.md`. Re-ran to
confirm: 7/7 pass.

## What was not run (and why)

- **Live Firebase project** (`central-pa-watershed-dev`): no credentials available in
  this sandbox. Every emulator test above is a faithful stand-in (same rules file, same
  Cloud Functions code, same Admin SDK code path), but a true end-to-end run against
  the real hosted project — including the reviewer web app's OAuth/session flow in a
  real browser — was not performed. `scripts/provision_test_users.mjs` and
  `scripts/seed_test_sites.mjs` are ready to run the moment real credentials are
  available (`GOOGLE_APPLICATION_CREDENTIALS` or `gcloud auth application-default
  login` for the dev project) — see their `--apply` flag.
- **Android instrumented tests** (`connectedDebugAndroidTest`, Room/repository
  instrumentation) and **iOS on-device testing**: require an Android emulator/device
  and a physical/booted iOS device respectively beyond what was exercised here (the
  iOS Simulator run above does cover the full unit/UI suite, just not a physical
  device). Not run in this session.
- **Reviewer web app in a real browser against a live project**: `next build`/`tsc`
  confirm the app is structurally correct and the Admin SDK/client SDK wiring compiles,
  but no live sign-in, queue render, or review-action click-through was performed —
  there is no reachable Firebase project with real `QC_REVIEWER` credentials in this
  environment.
- **Site Catalog Administration phase**: intentionally not implemented; see
  `docs/SITE_CATALOG_ADMINISTRATION_PHASE.md`.

## Git state

Not committed, not pushed. `git diff --check` is clean (no whitespace errors). Run
`git status`, `git diff --stat`, and `git diff --name-status` against the working tree
before deciding to commit — the exact file list and line counts are reproducible from
those commands and are not restated here to avoid this document going stale the moment
another line changes.
