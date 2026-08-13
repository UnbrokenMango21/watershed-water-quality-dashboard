# Mobile Production Integration Audit

Audit baseline: `7efabaaf733c3b8888a8453360506aefdce93dde` on `codex/mobile-production-integration-v1`  
Development Firebase project: `central-pa-watershed-dev`  
Approved native identifiers: `org.watershed.pawatershedwatch`

This is the pre-integration audit required before production Firebase writes. Statuses will be updated only when the cited evidence exists.

| Contract area | Status | Evidence / exact next action |
|---|---|---|
| Phase 9/10 validation engine | PASS | `node --test tests/validation/*.test.mjs` — 24/24 tests passed at the baseline commit. |
| Phase 9/10 Firestore rules | PASS | `firebase emulators:exec --only firestore 'node tests/firestore-rules/run-tests.cjs && node tests/validation-firestore/run-tests.cjs'` — rules 25/25 and validation persistence 7/7 passed. |
| Android approved frontend baseline | PASS | `./gradlew testDebugUnitTest lintDebug assembleDebug assembleRelease` on local Android SDK — debug/release builds and current unit/lint checks passed. |
| iOS approved frontend baseline | PASS | `xcodebuild test ... -destination 'platform=iOS Simulator,id=963236D7-0F8A-442D-9C61-EA2E533BD6BF'` — iPhone 17 Pro, iOS 27.0, 6/6 tests passed; result `Test-PAWatershedWatch-2026.08.13_12-26-16-+0200.xcresult`. |
| Development Firebase project access | PASS | `firebase projects:list` and `firebase apps:list --project central-pa-watershed-dev` — project exists with registered iOS and Android apps. |
| DO/TDS canonical parameter codes | FAIL | `collection_protocol.json` and `validation_rules.json` use `DO_MG_L` / `TDS_MG_L`; `parameter_catalog.json` still uses `DO_PPM` / `TDS_PPM`. Add a failing consistency guard, then preserve legacy aliases while making the Phase 10 codes canonical. |
| Blocking validation workflow transition | FAIL | `validation_persistence_contract.json` and runtime route blocking validation to `NEEDS_CORRECTION`; `workflow_states.json` omits `VALIDATING -> NEEDS_CORRECTION`. Add a failing consistency guard, then add the system transition. |
| Production measurement support boundary | FAIL | Both approved UIs expose 22 measurement kinds; Phase 10 supports only the canonical core/optional set plus temperature revision fields. Add one production catalog and feature-gate unsupported kinds so they cannot serialize or silently drop. |
| Canonical stable IDs and retry identity | FAIL | Both prototypes generate record/measurement IDs at submit time; neither persists submission/event/revision/measurement/attachment IDs at draft creation. |
| Android durable account-scoped storage | FAIL | `MockObservationRepository` uses `SharedPreferences`; Room, migrations, queue rows, durable attachment metadata, and owner scoping are absent. |
| iOS durable account-scoped storage | FAIL | `AppModel` is in-memory; SwiftData schemas, migrations, durable queue rows, durable attachment metadata, and owner scoping are absent. |
| Firebase email/password authentication | FAIL | Both prototypes use hard-coded local credentials; session restore, disabled-user handling, and two-account isolation are absent. |
| Firestore site catalog and cache | FAIL | Both prototypes use embedded Pennsylvania sample sites; real `siteCatalog` read/cache/refresh is absent. |
| Real GPS without scientific fallback | FAIL | Android location permission plumbing exists but stored prototype records fall back to site coordinates; iOS uses display-state GPS only. Production capture/readiness semantics are absent. |
| Pennsylvania collection time | FAIL | Both prototypes store epoch/date values without an explicit `America/New_York` offset contract or DST regression tests. |
| Golden Firestore serialization | FAIL | No shared cross-platform fixture proves exact parent/revision/measurement/attachment serialization. |
| Durable idempotent sync and acknowledgement | FAIL | Both prototypes simulate sync with timers; no durable queue, safe write order, stable retry, or server-backed acknowledgement exists. |
| Real media capture and local ownership | FAIL | Prototypes persist photo counts/audio booleans only; app-owned files and durable attachment objects are absent. |
| Firebase Storage contract | FAIL | No `firebase/storage.rules`, Storage emulator tests, upload constraints, or orphan cleanup policy exists. |
| Validation trigger | FAIL | Validation engine/orchestrator exists, but no deployed/emulated submission trigger is wired to submitted revisions. |
| Native validation readback | FAIL | Neither client observes server workflow/validation flags or distinguishes server acknowledgement from transport completion. |
| Immutable correction snapshots | FAIL | UI communicates revisions, but the prototypes mutate local record summaries and do not write a new immutable Firebase revision snapshot. |
| Firestore malformed/cross-user hardening | NOT TESTED | Existing rule suite is green; master-prompt forgery/type/cross-user additions have not yet run. |
| App Check release enforcement | BLOCKED | Missing external prerequisite: Apple App Attest/DeviceCheck and Android Play Integrity registrations plus release signing identities in Firebase/Apple/Google consoles. Blocks production mobile release. Owner action: platform owners register release apps/signing keys and provide CI-safe attestation configuration; development/emulator integration continues independently. |
| Real development smoke-test identities | BLOCKED | Missing external prerequisite: two disposable enabled Firebase Auth test-user credentials supplied through a secure local/CI mechanism. Blocks the real two-account dev smoke test, not local emulator implementation. Owner action: Firebase project owner creates two non-privileged collector users and supplies credentials outside Git. |
| Apple signed device/release archive | BLOCKED | Missing external prerequisite: Apple Developer team access, distribution certificate, provisioning profile, and registered test device. Blocks iOS release evidence, not simulator integration. Owner action: Apple team owner grants signing access and registers the production bundle ID/capabilities. |
| Android Play-signed release | BLOCKED | Missing external prerequisite: production upload/release keystore and Play Console app/signing configuration. Blocks Android release evidence, not local minified release builds. Owner action: Android release owner supplies CI signing configuration outside Git and registers Play Integrity. |
| Phase 8 Workflow Manager deployment | BLOCKED | Missing external prerequisite: Penn State organization privileges documented in repository instructions. Blocks downstream orchestration only, not native collection, staging, validation-emulator, QC contract, or ArcGIS boundary work. Owner action: Penn State cloud administrator grants the required organization-level Workflow Manager privileges and performs the documented deployment. |
| ArcGIS publication smoke test | BLOCKED | Missing external prerequisite: downstream Workflow Manager/ArcGIS deployment and service credentials. Blocks downstream publication verification only. Owner action: publishing-service owner completes Phase 8 deployment and provides a disposable staging publication path. |
| Native CI, device flows, accessibility, release regression | NOT TESTED | Required production implementation does not exist yet; add native CI and run simulator/emulator/device flows after integration. |

## Reconciliation decision

- Phase 9/10 validation and Firestore contracts remain authoritative.
- `DO_MG_L` and `TDS_MG_L` are the only runtime codes new native clients may serialize. Historical `DO_PPM` and `TDS_PPM` remain explicit read/import aliases only.
- Blocking validation must support the server transition `VALIDATING -> NEEDS_CORRECTION`.
- Unsupported approved-UI measurements remain visible only as clearly unavailable production options until a versioned backend contract adds codes, units, validation, rules, and publishing mappings.
- Sync is confirmed only by a server read after the final write; a local upload attempt never implies archival confirmation.
