# QC Trusted Web — Implementation Audit

**Branch:** `codex/qc-trusted-web-v1`
**Starting checkpoint:** `7dbc714ca5a92b32ab159d09e8786fcc86f5bbeb`
**Scope:** trusted QC reviewer backend/web, mobile P0 defects, mobile/data-contract closeouts.

This document is a historical record of two implementation passes on this branch. The
first pass (everything below up to "A regression introduced and fixed within this
phase") built the QC reviewer backend/web app and closed the original mobile P0
defects. A second pass, "Phase 11 final repair, polish, and lock" at the end of this
document, changed two of that pass's product decisions (media capture is now deferred;
measurement requirements are now temperature-only) and hardened the review action's
trust boundary further. Where the two passes disagree, the later section is current;
the earlier section is kept for provenance, not as a description of current behavior.

## Why the supplied reference patch did not apply

The task handoff referenced a previously generated patch as implementation guidance.
That patch was never present in this worktree, and inspection of the actual repository
showed it would not have applied regardless: the codebase had already moved well past
whatever snapshot it was generated from. Concretely, before any work in this phase
began, the repository already had:

- A native iOS (SwiftUI/SwiftData) and native Android (Compose/Room) app, both with
  real Firebase Auth/Firestore/Storage integration — not the mock/prototype state
  `docs/ANDROID_PORT_AUDIT.md` and `docs/MOBILE_PRODUCTION_INTEGRATION_AUDIT.md`
  describe. Those two audit documents are themselves stale relative to `HEAD` and
  should not be trusted for current status; this document supersedes them for the
  QC Trusted Web phase.
- A fully implemented validation engine/orchestrator/persistence pipeline
  (`validation/*.mjs`) with 28 passing contract tests and a working Firestore trigger
  (`functions/index.mjs`), already wired to the exact `VALIDATING -> PENDING_REVIEW` /
  `VALIDATING -> NEEDS_CORRECTION` transitions this phase was asked to reuse.
- Firestore/Storage security rules that already recognized a `QC_REVIEWER` role and
  granted it read access, with 29 passing rules tests and 6 passing storage tests.
- No reviewer web app, no server-side review action, and no `QC_REVIEWER` role listed
  in `config/firebase_schema.json`'s schema (the rules referenced the role; the schema
  document hadn't caught up) — this is the actual gap this phase closes.

Given that, the correct approach was to treat the task's requirements as the
specification, audit the real source tree directly (two parallel deep-read agents for
iOS and Android, plus direct reading of every backend/config file), and implement
against the current contracts rather than attempt to reconcile a non-existent patch.

## What changed, by area

### Trusted QC backend/security

- `config/firebase_schema.json`: `users.role` now documents `COLLECTOR | QC_REVIEWER |
  ADMIN` (rules already enforced this; the schema doc was the only thing out of date).
  Added `reviewer_user_id` / `reviewed_revision_id` to `submissions`, documented
  `submitted_at` as a trusted-server-timestamp-only field, added `entered_value` /
  `entered_unit_code` to the `measurements` schema, added a `reviewWorkflow` block
  documenting the three review actions and their atomicity/idempotency/race-safety
  guarantees, and added `county`/`watershed_name` to `siteCatalog` (already read by
  both mobile clients' search UI but never documented).
- `firebase/firestore.rules`: `submitted_at` on both `submissions/{id}` and
  `submissions/{id}/revisions/{id}` now requires `request.resource.data.submitted_at
  == request.time` instead of merely `is timestamp` — this is the actual mechanism
  that makes the timestamp trusted; before this change any client could write an
  arbitrary phone-supplied `Timestamp` and rules would accept it. Measurement
  documents now require `entered_value`/`entered_unit_code` alongside the canonical
  `value`/`unit_code`.
- `review/reviewSubmission.mjs` (new): `applyReviewDecision()` — the single privileged
  write path for Approve / Request Correction / Reject. One Firestore transaction:
  reads the submission, verifies it is `PENDING_REVIEW` and that the caller's
  `expectedRevisionId` matches `current_revision_id` (revision-aware staleness check,
  409 on mismatch), verifies the reason is present for Request Correction/Reject,
  writes the submission patch and exactly one audit event keyed by a deterministic
  `review-{revisionId}-{decision}` audit ID (so a literal retry is idempotent even
  under a race), and never touches the revision document or its measurements. Callable
  only with the Firebase Admin SDK.
- 13 new tests in `tests/review/` (`review_action.test.mjs`,
  `lifecycle.test.mjs`) covering unauthorized-role rejection, missing-reason
  rejection, stale-revision rejection, already-decided rejection, idempotent replay,
  a genuine concurrent-write race (two decisions fired simultaneously — exactly one
  wins), and all four required end-to-end lifecycle scenarios (A: clean
  approve, B: correction → resubmit revision 2 → approve with revision 1 verified
  byte-for-byte unchanged, C: blocking validation never reaches reviewable state, D:
  reject then a later stale approval fails).
- `scripts/provision_test_users.mjs` (new): idempotent, dry-run-by-default,
  dev-project-only-guarded provisioning of the four named test identities (`Test
  Collector 01`/`02`, `Test QC Reviewer`, `Test Admin`) — sets Firebase Auth
  `displayName` and the `role` custom claim, mirrors `users/{uid}`.
- `scripts/seed_test_sites.mjs` (new): same safety pattern, seeds 18 fixture sites
  spanning 8 counties with deliberately similar names (three "Spring Creek" sites, two
  "Loyalhanna Creek" sites) to exercise site search/filter/disambiguation.
- `docs/SITE_CATALOG_ADMINISTRATION_PHASE.md` (new): full design (schema,
  authorization model, UI route, sync design, required tests) for collector-proposed
  sites, deliberately deferred rather than folded into the locked review slice.

### Reviewer web app (`web/`, new)

Minimal Next.js (App Router, TypeScript) app. Client-side Firebase Auth
(Email/Password only, no signup) gates `/review` and `/review/{submissionId}`; reads
go directly through the Firestore client SDK under the reviewer's own rules-enforced
credentials (no rule changes needed — `QC_REVIEWER`/`ADMIN` already had read access).
The only privileged path is `POST /api/submissions/{id}/review`, a Node.js route
handler that verifies the caller's ID token and `role` claim with the Admin SDK, then
calls the exact same `review/reviewSubmission.mjs` module the emulator tests exercise
— no review logic is reimplemented in TypeScript. Queue shows site, collection time
(America/New_York via `Intl.DateTimeFormat`, no date library), revision, test type,
warning/info counts, status, and waiting age. Detail shows every field the spec
requires — entered vs. canonical measurements (canonical only rendered when it
actually differs from entered), temperature entered + derived, validation flags
grouped by severity, full revision history, and the audit timeline — with zero
scientific edit controls anywhere.

### Mobile P0 defects (iOS + Android)

Two independent deep-read audits (full file/line citations preserved in the
conversation, not reproduced here) found the **same root cause** on both platforms for
the "Submit says fields are missing" complaint: for lab/kit/other test types, the
visible "required" measurement list is temperature only, and the visible progress
counter reaches a green "1/1" the moment temperature is filled — but a second, hidden
rule (`productionProfileComplete` on iOS, `profileMinimumComplete` on Android)
additionally requires one more non-temperature measurement, matching the server's real
`config/validation_rules.json` `minimumMeasurementCount: 1` rule for those test types.
The hidden rule was real and correct (removing it would just cause the server to
bounce the submission to `NEEDS_CORRECTION` anyway); the bug was that neither UI told
the collector about it until three screens later. Both platforms now: gate the
Measurements screen's own Continue button on the full profile (not just the visible
required list), show an always-visible note when the extra result is still needed, and
stop lying with a false "complete" progress readout.

Also fixed, both platforms:

- **Hard-range validation**: added the missing checks (temperature -5–60 °C, DO_MG_L
  0–50 mg/L, DO_PERCENT 0–300%) sourced from `config/validation_rules.json`'s actual
  numbers — no invented thresholds. pH's existing 0–14 check was kept and its message
  tightened to a consistent "must be between X and Y" pattern.
- **Error navigation**: Review/Submit failures now route back to the specific
  offending section and, for measurement fields, request focus on that field, instead
  of a generic unnavigable banner.
- **Keyboard navigation**: measurement fields now chain via `FocusRequester`
  (Android) / `FocusState` (iOS) with a real "Next" action instead of every field's IME
  action just dismissing the keyboard.
- **Required-field indicators**: consolidated to one shared indicator per platform,
  extended to fields that had no indicator at all before (site, method, instrument,
  test type), all still derived from the same single source of truth the server
  validation already used — no invented requirements, no duplicated hardcoded lists.
- **Trusted timestamps**: this is the one closeout that is a genuine breaking change —
  once `firebase/firestore.rules` requires `submitted_at == request.time`, any client
  still writing a concrete phone-clock `Timestamp` would have every submit rejected.
  Both platforms now write `submitted_at` via `FieldValue.serverTimestamp()` at every
  finalization write site (initial submit and the correction/resubmit path). iOS also
  had one remaining client timestamp on the submission's `updated_at` at the exact
  final-acknowledgement boundary (`Timestamp(date: .now)`); changed to
  `FieldValue.serverTimestamp()` to match. `collected_at` (the scientific
  observation time) is intentionally untouched on both platforms — it is event
  provenance the collector controls, not a workflow-finalization timestamp.
- **Measurement provenance**: `entered_value`/`entered_unit_code` (the collector's
  actual typed value and the stable unit ID they selected, per each platform's own
  `MeasurementUnit`/`UnitSpec` domain model) are now written alongside the canonical
  `value`/`unit_code` for every non-temperature measurement. Temperature already had
  the equivalent `temp_entered_value`/`temp_entered_unit`/`temp_c`/`temp_f` fields and
  was untouched.
- **Spark media resilience** *(superseded — see the Phase 11 remediation section
  below)*: at the time, both platforms already isolated per-attachment Storage
  failures from the scientific submission (confirmed by direct code reading, not
  assumed) — a failed photo/audio upload was recorded against that one attachment and
  retried later; it never blocked or reverted the revision/submission reaching
  `SUBMITTED`, and local media was never deleted on failure. This entire code path —
  photo/audio capture, permission requests, and Storage upload — was subsequently
  **removed** from both production apps; see `docs/DEFERRED_MEDIA_FEATURE.md`. This
  bullet is kept only as a record of the resilience behavior that existed while media
  capture was still part of the product.
- **Friendly test user names**: both platforms already correctly render the Firebase
  Auth `displayName`, falling back to the email's local part and then a generic label
  — never a raw UID. No mobile code change was needed; `scripts/provision_test_users.mjs`
  (above) is the actual provisioning half of this requirement.

### A regression introduced and fixed within this phase

Tightening `submitted_at` to `FieldValue.serverTimestamp()` broke one iOS golden test
(`ModelTests.testGoldenCanonicalMappingAndStableMeasurementIDs`): the test JSON-diffed
the Firestore mapper output directly against a static fixture, and `FieldValue` is an
opaque sentinel `JSONSerialization` cannot encode. Fixed by asserting the trusted
mechanism directly (`submission["submitted_at"] is FieldValue`) and excluding only that
one key from the byte-for-byte fixture diff — every other field, including all
science/provenance data, still goes through the exact same strict comparison as
before. The shared fixture (`tests/mobile-contract-fixtures/mobile_golden.json`) was
also updated to include `entered_value`/`entered_unit_code` in its `expected`
measurements block, which in turn required removing a now-unnecessary field-exclusion
workaround from the equivalent Android test so both platforms compare against the same
accurate, current contract.

---

## Phase 11 final repair, polish, and lock

A second pass on this branch, after the work above had already landed. Two new
product decisions arrived from the supervisor and one trust-boundary gap was found
in the review action's idempotency check; this section records what changed and why.

### Media capture is deferred, not just resilient to failure

The first pass made Storage-upload failure non-fatal to a scientific submission. This
pass goes further: **photo capture, photo-library attachment, and audio recording are
removed from both production apps entirely** for the first release — no camera UI, no
photo picker, no microphone recording UI, no camera/microphone permission prompt
anywhere. See `docs/DEFERRED_MEDIA_FEATURE.md` for the product rationale.

- **iOS**: removed `FieldPermissionRequester`'s camera/mic permission requests,
  `CameraCaptureView`, `PhotoPanel`/`PhotoThumbnail`, `AudioPanel`, `AudioNoteRecorder`,
  the Storage `upload(...)`/`storagePath(...)` machinery, and the `FirebaseStorage`
  package dependency (confirmed via a full-app grep that nothing else referenced it —
  removed from `project.pbxproj`). `NSCameraUsageDescription`/
  `NSMicrophoneUsageDescription` removed from both Debug and Release build settings.
  `AttachmentRecord`/`LocalAttachmentEntity`/`FirebaseMapper.attachment(...)` were kept
  as dormant code rather than deleted — the golden-fixture test still exercises the
  mapper as a serialization-format check, and removing the SwiftData entity would need
  a schema migration that isn't warranted here. The collection workflow itself (draft
  → submit → sync) can no longer construct, upload, or carry an attachment forward.
- **Android**: removed the camera (`TakePicture`)/photo-picker
  (`PickMultipleVisualMedia`)/`MediaRecorder` implementation from what was
  `NotesMediaScreen` (now `NotesScreen`), the `CAMERA`/`RECORD_AUDIO` manifest
  permissions and `<uses-feature>` entries, and the `FileProvider` provider block and
  its `file_paths.xml` (confirmed via grep it had no other purpose). Unlike iOS,
  **the Firebase Storage dependency and `FirebaseSyncRepository`'s upload code were
  kept** — that code is still live and reachable (it's the sync layer, not
  capture-only UI), so removing it would be a larger, riskier change than the task
  called for. Since no UI can populate `ObservationDraft.attachments` anymore, that
  list is always empty for a new submission, so the upload loop runs zero times and no
  Storage call ever fires — the "no Storage call for a new submission" requirement is
  met without touching the sync/Firestore layer. `ObservationAttachment`/
  `LocalAttachmentEntity`/`FirestoreObservationMapper.attachment(...)` were likewise
  kept dormant for the same golden-fixture and no-risky-Room-migration reasons as iOS.
- Both platforms: "Notes and Media" renamed to "Notes" everywhere it's user-visible.
- A CI hygiene check (`.github/workflows/mobile-ci.yml`, `hygiene` job) now fails the
  build if production source reintroduces concrete camera/audio-capture API usage,
  scoped to `src/main`/the app target so it can't false-positive on docs or tests.

### Water Temperature is now the only required measurement, for every test type

The first pass fixed a *hidden* one-extra-measurement rule for lab-style test types.
This pass removes that rule entirely (rather than just surfacing it) **and** removes
the separate, larger rule that "In-situ / Field Instrument" / "Continuous Sensor /
Sonde" / "Mixed In-situ + Lab" required four measurements (temperature, pH, DO,
conductivity). For every test type now, Water Temperature is the only required
measurement; every other supported parameter is optional but still fully validated
(format + hard range) when entered. This is an interim engineering default, not a
final scientific decision — see `docs/PHASE_11_SUPERVISOR_DECISIONS.md` for the
still-open requirement-matrix question.

- `config/validation_rules.json`: every `testTypeProfiles` entry now has
  `requiredMeasurements: []` and `minimumMeasurementCount: 0` (previously some had 3
  required core measurements, others had a minimum-count-of-1 hidden rule).
  `validationRulesVersion` bumped to `1.1.0`. `validation/engine.mjs`'s fallback
  profile default (used only if `test_type` matches no known profile) was changed to
  match. Two contract tests were rewritten to assert the new behavior (a
  temperature-only submission never blocks, for every test type) rather than the old
  one.
- **iOS**: `ObservationDraft.requiredMeasurements` simplified to unconditionally
  `[.temperature]`. Deleted `requiresAdditionalResult`, `hasAdditionalResult`,
  `productionProfileComplete`, and the "+1 result needed" UI note entirely — they
  existed solely to enforce the now-fully-removed extra-measurement rule.
- **Android**: `ObservationDraft.requiredMeasurements` simplified to unconditionally
  `listOf(MeasurementKind.Temperature)`. Deleted `requiresAdditionalResult`,
  `hasAdditionalResult`, `profileMinimumComplete`, and the "one result is still
  required" `StatusPanel` warning for the same reason.
- Both platforms' progress indicators now honestly read "complete" the moment
  temperature is filled — there is no longer any state where the UI claims
  completeness and Submit later disagrees on measurement requirements.

### Review action idempotency was too loose — hardened

Audit of `review/reviewSubmission.mjs` found the idempotent-replay check compared
only `current_revision_id` + resulting `status` + `decision`. A retry from a
*different reviewer*, or the *same* reviewer resubmitting with a *different reason*,
on the same revision/decision would have been silently accepted as "already applied"
instead of rejected as a conflict — technically safe (no double state transition,
since the audit-id collision already prevented a second write) but semantically wrong:
it would return a success response to a caller whose specific request was never
actually the one that was recorded. Fixed by requiring the full decision identity to
match — `current_revision_id`, resulting `status`, `decision`, `reviewer_user_id`, and
normalized `review_comment` — before treating a request as an idempotent replay;
anything less than an exact match now throws `ReviewConflictError` (409), including
when a different decision is retried after one has already been applied (the original
decision stands; it is never silently overwritten). Four new tests cover: changed
reason, changed reviewer, changed decision, and that a rejected conflicting replay
never overwrites the original decision or writes a second audit event.

### Reviewer web app authorization was trusting a potentially-stale token claim

The API route (`web/app/api/submissions/[submissionId]/review/route.ts`) verified the
caller's ID token but authorized off the `role` claim embedded *in that token* — which
can be stale until the client's next token refresh if an admin has since changed or
revoked the role. Hardened to: verify the token with `checkRevoked: true` (rejects a
token whose refresh tokens were explicitly revoked, e.g. a disabled account, even
before the token's own expiry), then re-fetch the *current* Firebase Auth user record
via the Admin SDK and authorize off its live `customClaims.role` and `disabled` state,
never the token's own claim. Verified with `npx tsc --noEmit` and `next build`; no
live-project test of actual claim-revocation timing was possible in this environment
(no real Firebase project — see the readiness document's blocked-checks section).

### Independent re-verification

Every claim in the two mobile agent reports above was independently re-run rather
than taken on trust: `git diff --check` (clean after fixing one trailing-blank-line
violation), the media-removal hygiene grep (zero hits on the current tree, confirmed
non-trivial by running the same grep against the pre-removal tree first and seeing
real hits), Android's full Gradle gate, and iOS's full `xcodebuild test` +
`xcodebuild archive` — all re-run from a clean invocation, not read from a cached
agent claim. Results are in `docs/QC_TRUSTED_WEB_READINESS.md`.
