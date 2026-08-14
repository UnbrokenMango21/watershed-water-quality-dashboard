# QC Trusted Web — Implementation Audit

**Branch:** `codex/qc-trusted-web-v1`
**Starting checkpoint:** `7dbc714ca5a92b32ab159d09e8786fcc86f5bbeb`
**Scope:** trusted QC reviewer backend/web, mobile P0 defects, mobile/data-contract closeouts.

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
- **Spark media resilience**: both platforms already isolated per-attachment Storage
  failures from the scientific submission (confirmed by direct code reading, not
  assumed) — a failed photo/audio upload is recorded against that one attachment and
  retried later; it never blocks or reverts the revision/submission reaching
  `SUBMITTED`, and local media is never deleted on failure.
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
