# Phase 11 Execution Log

This is the chronological implementation and verification record for the
product-complete collector app. Do not record passwords, tokens, private notes,
exact GPS test values, or other sensitive payloads.

## 2026-08-10 — Product-complete scope initialization

### Repository and branch

- Reconciled `platform-v0.1-foundation` at
  `0030b330cd839186de6b5f0c9acccaa7aa195746`, 0 ahead / 0 behind origin.
- Created local branch `phase11/mobile-v1`; no push performed.
- Preserved the unrelated untracked root `.DS_Store`; it is not part of Phase 11.
- Generated `mobile/ios` and `mobile/android` remain absent/untracked.

### Reference inspection

- Inspected `awesome-design-md-main.zip` read-only with `unzip -l` and
  `unzip -p`; no archive content was vendored.
- Reviewed the Apple, IBM, Starbucks, and Expo analyses plus the archive MIT
  license. Synthesized original project guidance rather than copying a brand.
- Inspected `awesome-codex-subagents-main.zip` read-only and selected only the
  mobile/design/quality/security/performance agents relevant to Phase 11.
- Installed selected agent TOMLs under `.codex/agents/` with the full VoltAgent
  MIT notice. Custom agents will be delegated explicitly.

### Design direction

- Created `mobile/DESIGN.md`: Creekline Field System.
- Retains the existing creek-teal identity, field-friendly controls, system
  type, semantic status colors, and numeric hierarchy.
- Refines the system toward warmer field-paper surfaces, restrained radii and
  shadows, flatter sections, clearer state language, native behavior, and
  direct-sunlight readability.
- Delegated a design-bridge review and a UI-designer screen review using the
  project-local agent definitions.
- Resolved their pre-implementation findings in the source design: accessible
  text/control-border roles, complete light/dark interaction states, explicit
  overlay and watershed-motif treatment, five-step native navigation, large
  text behavior, signed numeric editing, account-sheet behavior, and immutable
  submission/correction presentation.

### Phase 9/10 contract audit

- Confirmed `siteCatalog` exposes only the mobile-safe site ID, display name,
  code, location, tolerance, active state, and update timestamp.
- Confirmed collector ownership boundaries, allowed submission transitions,
  immutable submitted revisions, correction revisions, measurement records,
  field notes, and read-only validation flags directly from the schema and
  Firestore rules.
- The older presentation catalog uses `DO_PPM` and `TDS_PPM`, while the Phase 10
  validation profile and mobile collection protocol use `DO_MG_L` and
  `TDS_MG_L`. This does not require a schema alias or contract change: Phase 9
  already demonstrates a `DO_MG_L` measurement with a human display label, and
  Phase 11 explicitly defers scientific requirements to Phase 10. The mobile
  UI will use the Phase 10 parameter codes/units and neutral human-readable
  labels; it will not translate either code into the older spreadsheet codes
  or use the older catalog's `mvpStatus` as requiredness.
- A partial local draft cannot satisfy the existing Firestore revision-create
  rule because GPS, provenance, and temperature are required at creation. The
  implementation will preserve incomplete form state locally and write the
  contract-complete revision/measurements through Firestore once those fields
  exist; no fake scientific defaults or weakened rules are permitted.

### Runtime starting point

- User confirmed iOS Firebase Email/Password sign-in using the existing
  synthetic collector account.
- The account password was not read, requested, logged, or stored.
- Existing source includes auth-state persistence, sign-out, an account panel,
  and a placeholder-gated Start observation action.
- Phase 11B begins with Firestore `siteCatalog` loading under existing Phase 9
  schema/security rules.

### Verification performed

- Archive inspection: passed, read-only.
- Git branch reconciliation: passed.
- Selected agent TOMLs parsed successfully and match their archive sources;
  the checked-in full MIT license also matches the archive source.
- `mobile/DESIGN.md` contrast/state review: passed after required corrections;
  implementation fidelity remains pending.
- `git diff --check`: passed for the initial documentation/agent checkpoint.
- Product flow source/runtime audit: in progress.
- iOS/Android product flows: not yet claimed complete; see flow matrix.

### Next checkpoint

- Audit Phase 9/10 contracts and every exposed mobile control.
- Implement contract-backed site catalog states before enabling Start observation.

## 2026-08-10 — Collector vertical slice and correction lifecycle

### Product implementation

- Replaced the placeholder collector shell with contract-backed home, account,
  five-step observation, submission detail, and immutable revision-detail
  routes.
- Added strict mobile parsers for the checked-in Phase 9/10 contracts. The app
  imports those canonical JSON files through an Expo Metro watch root; no
  schema, validation, quality, security-rule, or ArcGIS contract was changed.
- Added a live `siteCatalog` listener with server, cache, loading, empty, error,
  refresh, and invalid-document handling. Start observation is enabled only
  when a valid server or cached catalog is available.
- Added per-collector atomic JSON drafts with raw numeric text, deterministic
  revision intent, relaunch recovery, and Firestore listener metadata.
- Added ordered Firestore submission/revision/measurement writes, safe
  finalization retries, recent records, validation flags, correction creation,
  resubmission, and revision history.
- Added configured test types, provenance, all required and optional
  measurements, entered-unit-first temperature conversion, signed ORP entry,
  field notes, native date/time, Expo Location GPS/accuracy, and permission
  recovery.
- Attachments remain intentionally absent from collector v1; no fake attachment
  control is exposed.
- Removed unused Expo starter screens/components that were not reachable
  collector functionality.

### Visual system

- Applied the Creekline Field System across light/dark tokens, restrained
  section surfaces, field-paper backgrounds, creek/hemlock colors, native
  headers, status language, large numeric entry, and 48-point-or-larger primary
  interactions.
- Added an original watershed tributary mark and generated app, adaptive,
  monochrome, favicon, and splash assets from the project-owned SVG sources.
- Added drag-to-dismiss behavior for form keyboards, select-all-on-focus for
  scientific numeric correction, and an explicit accessible sign toggle for
  measurements such as ORP whose iOS numeric keyboard does not expose a minus
  key.

### Synthetic development fixtures

- The authenticated development project initially returned an empty catalog.
  Created one mobile-safe synthetic Central PA test site through the existing
  authenticated Firebase CLI session. No landowner/private fields or rule
  changes were introduced.
- After a real submitted synthetic observation, applied a synthetic reviewer
  `NEEDS_CORRECTION` decision and one permitted validation warning through
  authenticated Firestore administration. This exercised the existing
  correction contract rather than simulating client status.
- No collector password was read, requested, logged, or stored.

### Actual iOS verification

- Used the installed EAS development build on the booted iPhone 17 Pro
  simulator with Metro. Because Air device-driving tools were unavailable,
  used a checksum-verified Maestro 2.7.0 binary from `/tmp`; nothing was added
  to the repository or system installation.
- Verified Firebase auth persistence through repeated full process
  termination/relaunch.
- Verified catalog availability, observation creation, site selection,
  date/time rendering, first-run location denial, blocked/settings guidance,
  unavailable GPS, retry, acquired coordinates, and reported accuracy.
- Verified required method and measurement errors, all configured optional
  measurements, negative ORP, Fahrenheit entry with Celsius derivation, field
  notes, review, edit round-trip, and repeated interrupted draft recovery.
- Temporarily disabled the native Firestore network in the development runtime,
  queued a complete draft, observed `Saved locally`, removed the temporary
  harness, and observed `Synced`. The harness was removed from source after the
  test.
- Submitted the real Firestore record and observed `SUBMITTED` plus `Synced` in
  submission detail and Recent submissions.
- Verified the synthetic reviewer comment and validation warning, created
  revision 2, changed the requested nitrate reading, interrupted/resumed the
  correction, resubmitted, and observed `RESUBMITTED` plus `Synced`.
- Verified revision history contains two read-only revisions and that revision
  1 retains the original nitrate value while revision 2 retains the corrected
  value.

### Runtime defects found and corrected

- Fixed Hermes date formatting that combined unsupported formatter options.
- Fixed the root Expo Router screen registration for nested observation routes.
- Prevented unsynchronized local-only drafts from opening permission-denied
  Firestore document listeners and falsely reporting sync failure.
- Rechecked foreground location permission after returning from system
  settings.
- Fixed nested measurement document paths to use a Firestore collection
  reference. The previous document-reference overload type-checked but threw at
  runtime on the first real write.
- Distinguished client completeness errors from operational Firestore queue
  failures so the UI no longer mislabels infrastructure defects as missing
  science.

### Verification at this checkpoint

- `npx tsc --noEmit`: passed.
- `npx expo lint`: passed.
- `npx expo install --check`: passed.
- `npx expo-doctor`: 20/20 checks passed.
- Expo iOS export: passed.
- Expo Android export: passed.
- Phase 10 validation unit suite: 24/24 passed.
- Firestore security-rules emulator suite: 25/25 passed.
- Validation/Firestore emulator integration suite: 7/7 passed. Its first
  invocation intentionally refused to run without `FIRESTORE_EMULATOR_HOST`;
  the suite was rerun under `firebase emulators:exec` and passed.
- `git diff --check`: passed.
- Native EAS rebuilds, Android device flows, remaining auth/account negative
  tests, accessibility/outdoor audits, and final delegated reviews remain open.

## 2026-08-10 — Release-candidate hardening after agent handoff

### Repository and CI hardening

- Preserved the completed Air/Codex work on `phase11/mobile-v1` and moved the
  remaining work to direct GitHub changes plus small human native-runtime
  checks.
- Removed accidentally tracked macOS `.DS_Store` metadata and added repository
  hygiene enforcement so generated native projects and local Firebase client
  files cannot silently enter source control.
- Expanded Mobile CI to run dependency compatibility, a Phase 9/10 mobile
  contract guard, TypeScript, lint, privacy telemetry enforcement, iOS bundle
  export, Android bundle export, and Expo Doctor on the PR.
- Added a mobile contract guard that fails if configured measurements lose
  Phase 10 units/profiles, collector workflow transitions drift, quality/review
  ownership boundaries weaken, the safe-site privacy boundary disappears, or
  entered-temperature preservation changes.

### Product resilience and accessibility

- Added explicit loading feedback for saved field work and recent submissions
  on collector home instead of rendering transient blank sections.
- Added a clean-install/offline catalog timeout that changes an otherwise
  indefinite empty-cache loading state into an actionable reconnect/refresh
  error while still allowing a later server listener to recover automatically.
- Improved signed-out validation and Firebase error guidance, including
  accessibility announcements for required fields and authentication failures.
- Added large-text wrapping to native date/time rows and strengthened account
  control accessibility hints while preserving the Creekline 48-point target
  policy and native screen-reader semantics.

### Privacy and validation presentation

- Kept Firebase Analytics behind the single coarse-event wrapper and added CI
  enforcement for the native privacy configuration.
- Disabled automatic native screen reporting, retained only coarse manual
  screen names, kept iOS Analytics without Ad ID support, and blocked the
  Android advertising-ID permission.
- Added read-only parsing/presentation of the server-owned overall data
  confidence score and validation rule version. The collector explicitly says
  the score represents data confidence, not stream/water health, and it cannot
  write quality fields.

### EAS/versioning preparation

- Adopted EAS remote developer-facing version management with production
  auto-increment and retained separate development/iOS-simulator/preview/
  production profiles.
- Aligned the user-facing collector version with the project development cycle
  at `0.1.0`; the earlier `1.0.0` value was Expo-template metadata and did not
  represent the platform's v1.0 release milestone.
- Submitted Android development build
  `8529b68b-f133-4e9b-8feb-380387467172` from verified commit `8dc198b` as the
  Android native-platform proof. It predates this final hardening pass, so a
  release-candidate rebuild from the final branch head remains required after
  runtime proof.

### Verification at this checkpoint

- Mobile CI after the hardening changes passed the Phase 9/10 contract guard,
  TypeScript, lint, privacy guard, iOS JavaScript export, Android JavaScript
  export, and Expo Doctor. Subsequent documentation/version-only changes must
  remain green before the release-candidate native builds.
- No Phase 9 schema, Phase 10 validation semantics, Firestore rules, Workflow
  Manager design, or ArcGIS contract was changed.
- Remaining gates are native Android runtime parity, focused iOS negative/
  offline/accessibility checks, then final Android and iOS release-candidate EAS
  builds from the latest branch head.
