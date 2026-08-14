# QC Trusted Web — Readiness

**Branch:** `codex/qc-trusted-web-v1` · **Baseline:** `7dbc714ca5a92b32ab159d09e8786fcc86f5bbeb`
**Date:** 2026-08-14

This document describes the **final** state of the QC Trusted Web + Phase 11 final
repair work, after two implementation passes on this branch (see
`docs/QC_TRUSTED_WEB_AUDIT.md` for the full history of both). Every result below is
from a command actually executed in this environment against the local Firebase
emulator suite, local Gradle, and local Xcode, re-run independently at the end of the
second pass rather than trusted from an earlier run or from a subagent's self-report.
Where something could not be run (no live Firebase project, no physical device), it is
marked BLOCKED with the exact reason, not silently assumed passing.

## Acceptance gates

| # | Gate | Result | Evidence |
|---|---|---|---|
| 1 | Photo/audio capture is completely absent from production apps; no camera/mic permission prompts | PASS | CI hygiene grep (`.github/workflows/mobile-ci.yml`) and an independent manual re-run of the same grep against the current tree both return zero hits for camera/audio-capture APIs or permission declarations in `src/main`/the iOS app target. `NSCameraUsageDescription`/`NSMicrophoneUsageDescription` confirmed absent from `project.pbxproj`; `CAMERA`/`RECORD_AUDIO` confirmed absent from `AndroidManifest.xml`. See `docs/DEFERRED_MEDIA_FEATURE.md`. |
| 2 | A new submission never creates an attachment or attempts a Storage upload | PASS | Neither mobile UI has any control that can populate an attachment list anymore (confirmed by reading every touched view). Android's sync layer still contains upload code, but the attachments list it iterates is now always empty for a new submission, so the loop runs zero times - verified by reading `FirebaseSyncRepository.sync()`'s call site and confirming nothing populates `ObservationDraft.attachments`. |
| 3 | Water Temperature is the only required measurement, for every test type | PASS | `config/validation_rules.json`: every `testTypeProfiles` entry has `requiredMeasurements: []`/`minimumMeasurementCount: 0`. Both mobile clients' `requiredMeasurements` unconditionally return `[Temperature]`. New contract test asserts this holds for every test type including the previously-4-required "In-situ / Field Instrument". |
| 4 | Optional science fields do not block when blank; populated optional fields are still validated | PASS | Confirmed by contract test (`tests/validation/validation_engine.test.mjs`) and by each platform's own unit tests: a blank optional measurement never blocks `canonicalSnapshot()`/`toCanonicalSnapshot()`; an out-of-range optional value (e.g. pH 15) still throws. |
| 5 | No hidden extra-measurement requirement remains | PASS | `productionProfileComplete` (iOS) and `profileMinimumComplete` (Android) - the functions that enforced the prior pass's hidden rule - were deleted, along with their UI warnings, not merely bypassed. Grepped both codebases for their names post-deletion: zero remaining references. |
| 6 | Submit bug (misleading "complete" state) cannot reproduce | PASS | With the extra-measurement rule gone, the previous root cause (a completeness counter that didn't reflect the true gate) no longer applies - the counter and the gate are now the same simple check (`completedRequiredCount == requiredMeasurements.count`, i.e. "is temperature filled") on both platforms. |
| 7 | Error navigation (auto-expand/scroll/focus) preserved from the prior pass | PASS | Untouched by this pass; still covered by each platform's existing test suite. |
| 8 | Entered + canonical measurement provenance preserved | PASS | `entered_value`/`entered_unit_code` alongside canonical `value`/`unit_code`, enforced by `firebase/firestore.rules` and covered by rules-emulator and mobile unit tests; untouched by this pass. |
| 9 | Trusted server timestamps preserved (not reintroduced as phone-clock) | PASS | `firebase/firestore.rules` still requires `submitted_at == request.time`; both mobile clients still write it via `FieldValue.serverTimestamp()`. Untouched by this pass, re-verified passing. |
| 10 | Exact roles (COLLECTOR / QC_REVIEWER / ADMIN) preserved | PASS | Untouched; `config/firebase_schema.json` and `firebase/firestore.rules` consistent. |
| 11 | Reviewer cannot edit science; review transaction atomic/race-safe/revision-aware | PASS | `review/reviewSubmission.mjs` - one Firestore transaction, never writes to `revisions/{id}` or its measurements. Concurrent-race test (two decisions fired simultaneously) confirms exactly one wins. |
| 12 | Idempotency requires a genuinely identical replay (reviewer + decision + revision + reason must all match) | PASS | Hardened this pass: the replay check now compares `reviewer_user_id` and normalized `review_comment` in addition to revision/status/decision. 4 new tests: changed reason → conflict, changed reviewer → conflict, changed decision → conflict (original decision stands, never overwritten), exact replay → idempotent with no duplicate audit event. |
| 13 | Stale review returns 409 | PASS | `ReviewConflictError` → HTTP 409; covered by dedicated emulator tests (stale revision id, non-`PENDING_REVIEW` status, later stale approval, and the new identity-mismatch cases above). |
| 14 | Current reviewer authorization is rechecked server-side (not just an embedded token claim) | PASS | Hardened this pass: `web/app/api/submissions/[submissionId]/review/route.ts` now verifies the ID token with `checkRevoked: true`, then re-fetches the live Firebase Auth user record and authorizes off its current `customClaims.role`/`disabled` state, never the token's own (potentially stale) claim. Verified by `tsc`/`next build`; live claim-revocation timing is BLOCKED (no real Firebase project - see below). |
| 15 | Web reviewer console builds; console is in CI | PASS | `cd web && npm run typecheck && npm run build` both succeed. `.github/workflows/mobile-ci.yml` now has a `web` job (`npm ci`, `typecheck`, `build`) and `web/**`/`review/**` are in the trigger paths for both `pull_request` and `push` (including this branch). |
| 16 | Reviewer console preserved: read-only science, three actions only, reason required for Correction/Reject, Eastern time, entered+canonical, flags, revision history, audit trail | PASS | Unchanged by this pass; verified again by reading `web/app/review/[submissionId]/page.tsx` and `web/components/ReviewActions.tsx` end to end. |
| 17 | Backend tests green | PASS | 91/91 - see table below. |
| 18 | Android gates green | PASS | 16/16 unit tests, clean lint, debug + release build - see table below. |
| 19 | iOS gates green | PASS | 11/11 tests, unsigned release archive - see table below. |
| 20 | Repo hygiene green (no generated/local output tracked) | PASS | See hygiene section below. |
| 21 | Documentation matches reality | PASS | This document, `docs/QC_TRUSTED_WEB_AUDIT.md`, `docs/DATA_DICTIONARY.md` updated; `docs/DEFERRED_MEDIA_FEATURE.md` and `docs/PHASE_11_SUPERVISOR_DECISIONS.md` added. |
| 22 | Supervisor-decision gaps documented, not guessed | PASS | `docs/PHASE_11_SUPERVISOR_DECISIONS.md` - 15 open questions recorded, none answered speculatively. |
| 23 | GitHub branch pushed; required GitHub CI green | See final report | Local gates are green; the actual push and CI run happen after this document is written - see the top-level status report for the outcome. |
| 24 | Friendly test user display names | PASS (mobile) / BLOCKED (live provisioning) | Mobile rendering already correct on both platforms. `scripts/provision_test_users.mjs` verified end-to-end against the emulator (idempotent create-then-update); actually provisioning the real dev-project accounts needs live credentials unavailable here. |
| 25 | Test site coverage (search/filter/similar names/multiple regions) | PASS (fixture) / BLOCKED (live seeding) | `scripts/seed_test_sites.mjs` - 18 sites across 8 counties, verified against the emulator. Seeding the live dev project needs live credentials unavailable here. |
| 26 | Site proposal/admin workflow does not destabilize the locked QC lifecycle | PASS | Not implemented; fully designed in `docs/SITE_CATALOG_ADMINISTRATION_PHASE.md` as an explicit follow-on. |

## Test results actually executed

All commands run from the repo root unless noted. All emulator suites ran against the
real local Firestore/Storage/Auth/Functions emulators (`firebase emulators:exec`), not
mocks. Every number below is from a run executed after both implementation passes
were complete - not carried forward from an earlier, now-superseded run.

| Suite | Command | Result |
|---|---|---|
| Backend validation/contract unit tests | `npm run test:contracts` | **29/29 pass** |
| Firestore rules (emulator) | `node tests/firestore-rules/run-tests.cjs` | **32/32 pass** |
| Storage rules (emulator) | `node tests/firestore-rules/run-storage-tests.cjs` | **6/6 pass** |
| Validation persistence/orchestrator (emulator) | `node tests/validation-firestore/run-tests.cjs` | **7/7 pass** |
| Review action + lifecycle (emulator) | `npm run test:review` | **16/16 pass** (13 from the first pass + 3 new identity-aware idempotency tests) |
| Validation Firestore trigger (emulator, Functions) | `npm run test:trigger` | **1/1 pass** |
| **Backend total** | | **91/91 pass** |
| Web TypeScript check | `cd web && npx tsc --noEmit` | **Clean, 0 errors** |
| Web production build | `cd web && npx next build` | **Succeeds** - routes `/`, `/review`, `/review/[submissionId]`, `/api/submissions/[submissionId]/review` all compile |
| Android unit tests | `./gradlew --no-daemon :app:testDebugUnitTest` | **16/16 pass** (6 `ModelTest` + 10 `ProductionDomainTest`) |
| Android lint | `./gradlew --no-daemon :app:lintDebug` | **Pass** - 0 errors, 7 pre-existing-style warnings (unrelated to this work) |
| Android debug build | `./gradlew --no-daemon :app:assembleDebug` | **Succeeds** |
| Android release build | `./gradlew --no-daemon :app:assembleRelease` | **Succeeds** (minified R8 release APK) |
| Android instrumented tests (`connectedDebugAndroidTest`) | — | **BLOCKED** - no Android emulator/device available in this environment |
| iOS unit/UI tests | `xcodebuild test` (iPhone 17 Pro simulator, iOS 27) | **11/11 pass** (7 from the first pass + 4 new temperature-only-requirement tests) |
| iOS unsigned release archive | `xcodebuild archive -configuration Release` | **`** ARCHIVE SUCCEEDED **`** |
| iOS on-device testing | — | **BLOCKED** - no physical/provisioned device available in this environment |

### Media-removal hygiene check (independent verification)

The CI grep-based hygiene check (`.github/workflows/mobile-ci.yml`) was run manually
against the tree twice: once *before* the media-removal changes (confirmed it finds
real hits - `ProductionData.swift`, `WorkflowViews.swift`, `AndroidManifest.xml`,
`WorkflowScreens.kt` - proving the check actually detects the code it's meant to
detect, not a no-op), and once *after* (zero hits on both platforms). This is the same
verification technique used to prove a test can fail before trusting that it can pass.

### Environment notes carried forward from the first pass

- A stale Gradle daemon from an earlier background process previously caused spurious
  `Operation not permitted` errors on fresh resource-packaging tasks. `./gradlew
  --no-daemon` resolves it; every Android command in this document used it.
- The prior pass's iOS `FieldValue.serverTimestamp()` JSON-serialization test fix
  (see `docs/QC_TRUSTED_WEB_AUDIT.md`) remains in place and passing; no regression.

## Manual behavior checklist

Every item below was checked one of two ways: (a) **verified via the automated test
suite and/or direct source reading**, which is real verification of the underlying
logic, or (b) **BLOCKED** for live interactive confirmation, because driving a signed-in
session on either mobile app or the web console requires a real Firebase project with
real `QC_REVIEWER`/collector credentials, which does not exist in this sandbox. (a) is
not a substitute for (b) - it confirms the code is correct, not that the pixels are
correct - so BLOCKED items are reported as BLOCKED, not PASS.

| Item | Result | Basis |
|---|---|---|
| Collector signs in, friendly name visible | PASS (logic) / BLOCKED (live) | `AppModel.userDisplayName`/`AppViewModel.signedInName` read and confirmed correct; no live sign-in performed. |
| Select/search site | PASS (logic) / BLOCKED (live) | Site search/filter code read and unchanged by this pass; `scripts/seed_test_sites.mjs` fixture verified against the emulator. |
| GPS capture | BLOCKED | Requires a real device/simulator location fix; out of scope for this pass (untouched). |
| Choose test type | PASS (logic) / BLOCKED (live) | Test type selection UI unchanged by this pass. |
| Water Temperature visibly required, every other measurement optional | PASS | Directly covered by new automated tests on both platforms (see test table above) and by reading the "Required Measurements"/"Optional Measurements" section-rendering code on both platforms. |
| Leave every other measurement blank, continue succeeds | PASS | Directly covered by `temperatureOnlySucceedsForEveryTestType` (Android) / the four new iOS tests - both exercise this exact scenario for every test type via `canonicalSnapshot()`/`toCanonicalSnapshot()`. |
| Notes screen contains no media controls | PASS | Verified by reading `NotesScreen`/`WorkflowViews.swift`'s Notes section end to end - no photo/audio affordance of any kind remains; confirmed independently by the zero-hit hygiene grep. |
| Review screen looks complete, Submit does not say missing fields for a temperature-only draft | PASS (logic) / BLOCKED (live pixel check) | `ReviewContent.reviewIsValid`/`AppViewModel.reviewIssues()` both now agree with the Measurements screen's own gate - proven by the shared test coverage above - but no live screenshot was taken. |
| Valid submission reaches the validation workflow | PASS | End-to-end proven server-side by `tests/review/lifecycle.test.mjs` scenario A (`SUBMITTED → VALIDATING → PENDING_REVIEW → approve → APPROVED`) against the real Firestore/Functions emulator; mobile-to-live-server round trip is BLOCKED (no live project). |
| Invalid optional measurement routes to the field | PASS (logic) / BLOCKED (live) | Error-navigation code (unchanged by this pass) read and confirmed to still route to the specific field; no live interactive confirmation. |
| No camera/microphone permission prompt | PASS | This is directly and conclusively provable without a live device: the permission-request code and the Info.plist/Manifest declarations that would trigger such a prompt are verifiably absent from the source (see the media-removal hygiene check above) - if the code to request the permission doesn't exist, the prompt cannot appear, regardless of runtime environment. |
| QC reviewer signs in; collector cannot access reviewer actions | PASS (logic) / BLOCKED (live) | `AuthGate.tsx`'s role gate plus the API route's server-side role recheck (hardened this pass) read and confirmed; no live sign-in as either role performed. |
| Queue shows only PENDING_REVIEW | PASS | `fetchQueue()`'s Firestore query is a direct, unambiguous `where('status','==','PENDING_REVIEW')` - not dependent on runtime data to verify. |
| Detail is read-only | PASS | Confirmed by reading the entire detail page - zero input/textarea/select bound to any measurement or revision field. |
| Approve works; Request Correction requires reason; Reject requires reason | PASS | Directly proven server-side by emulator tests (`NEEDS_CORRECTION and REJECT require a non-empty reason`, scenario A/B/D); the web form's client-side `required` attribute read and confirmed present for both. |
| Stale revision fails | PASS | Directly proven by 3+ dedicated emulator tests. |
| Correction/resubmission produces a new immutable revision; previous science unchanged | PASS | Directly proven by `tests/review/lifecycle.test.mjs` scenario B, which asserts revision 1's document is byte-for-byte (`assert.deepEqual`) unchanged after a correction and resubmission cycle. |

## What was not run (and why) — BLOCKED items, consolidated

- **Live Firebase project** (`central-pa-watershed-dev`): no credentials available in
  this sandbox. Every emulator test above is a faithful stand-in (same rules file, same
  Cloud Functions code, same Admin SDK code path), but a true end-to-end run against
  the real hosted project - including the reviewer web app's sign-in flow in a real
  browser, and both mobile apps' sign-in/collection/submit flow against live data -
  was not performed. `scripts/provision_test_users.mjs` and `scripts/seed_test_sites.mjs`
  are ready to run the moment real credentials are available (`GOOGLE_APPLICATION_CREDENTIALS`
  or `gcloud auth application-default login` for the dev project) - see their `--apply` flag.
- **Android instrumented tests** (`connectedDebugAndroidTest`) and **iOS on-device
  testing**: no Android emulator or provisioned physical/booted iOS device available.
  The iOS Simulator run above does cover the full unit/UI test suite, just not a
  physical device.
- **Live claim-revocation timing** for the hardened reviewer-authorization check: would
  require a real Firebase project to actually revoke a role and observe the route
  reject the old token - not testable against the emulator's simplified auth model in
  the time available.
- **Site Catalog Administration phase**: intentionally not implemented; see
  `docs/SITE_CATALOG_ADMINISTRATION_PHASE.md`.

## Repository hygiene

Confirmed no generated or local-only output is tracked or staged: `node_modules`,
`.next`, `.gradle`, `build`/`app/build`, `DerivedData`, `local.properties`,
`xcuserdata`/`.xcuserstate`, `.DS_Store`, and `*.zip` were all checked via `git status`
and the existing CI hygiene step's own grep pattern - zero matches. The new
`.claude/launch.json` (added only to preview the reviewer web app locally in this
session) contains no secrets or local paths that need excluding.

## Git state

See the top-level status report for the final commit SHA and push/CI outcome. Run
`git status`, `git diff --stat`, and `git diff --name-status` against the working tree
for the exact file list and line counts - not restated here to avoid this document
going stale the moment another line changes.
