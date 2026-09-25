# PA Watershed Watch — Full System Audit (2026-09-19)

**Auditor:** Antigravity Engineering Agent (Second Agent)  
**Date:** 2026-09-19  
**Branch:** `agent/antigravity/system-audit-2026-09-19`  
**Base Commit:** `fc9b62784f96efaba2627b3d66825ae00571a4d6`  
**Scope:** Current-state audit (not a redesign) covering Native iOS (SwiftUI), Native Android (Jetpack Compose), Firebase/Auth/Firestore/Storage/validation, QC Console (`web/`), ArcGIS Approved Publication, Public Dashboard (`public-dashboard/`), GitHub Actions/release consistency, Design-language consistency, and Security/Privacy boundaries.

---

## 1. System Status Summary

| Row | Status | Verified Evidence | Blocker | Next Action |
| :--- | :--- | :--- | :--- | :--- |
| **iOS** | VERIFIED / IN_BETA (Local blocked by toolchain) | GitHub Actions Build 13 run [34787514559](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/actions/runs/34787514559) passed 14 native tests, produced signed archive, uploaded to TestFlight. App Store Connect reports build as `VALID` and `IN_BETA_TESTING` (compliance run [34788257765](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/actions/runs/34788257765)). Source implements 12 fully supported measurements (`ProductionData.swift`), pending-sync guard, and App Attest in Release. Hygiene check passes (0 forbidden media hits). | Local `xcodebuild` commands blocked: unaccepted Apple SDK license on host (`You have not agreed to the Xcode and Apple SDKs license`). Physical iPhone unavailable to current host. | Operator must run `sudo xcodebuild -license accept` to enable local tests. Human volunteer must install Build 13 on physical iPhone to verify real device flow. |
| **Android** | VERIFIED (Local blocked by toolchain) | Architecture complete with Room database (schemas 2, 3, 4 recorded in `app/schemas`), Jetpack Compose UI (`Theme.kt`, `WorkflowScreens.kt`), Repository pattern, and Firebase Auth/Firestore client. CI passes `testDebugUnitTest`, `lintDebug`, `assembleDebug`, `assembleRelease`, and emulator instrumentation. Hygiene check passes (0 forbidden media hits). | Missing Java Runtime (`Unable to locate a Java Runtime`) and missing `ANDROID_HOME` configuration on the macOS host blocks local `./gradlew` execution. | Install OpenJDK 17 (`brew install openjdk@17`) and configure `ANDROID_HOME` pointing to Android SDK. |
| **Firebase** | VERIFIED / LIVE-GATED (Emulator blocked locally) | Backend contracts pass 30/30 tests (`npm run test:contracts`). Validation engine, parameter catalog, and immutable revision persistence contracts verified. Firestore rules (42 tests) and Storage rules (6 tests) verified in CI. Live development Firebase has active `validateSubmittedObservation` function. Clean separation: collector accounts cannot author validation, review, or publication state. | Missing Java runtime blocks local Firebase Emulator Suite execution (`Error: Process java -version has exited with code 1`). | Install Java to unblock local `firebase emulators:exec`; keep emulator suite mandatory before touching rules or triggers. |
| **QC Console** | VERIFIED / PRODUCTION-READY | `web/` passes TypeScript typechecking (`npm run typecheck --prefix web`) with 0 errors. Next.js 16.3.0 production build (`npm run build --prefix web`) succeeded with code 0 (compiled in 1833ms, 4/4 static/dynamic routes generated: `/`, `/_not-found`, `/review`, `/review/[submissionId]`, `/api/submissions/[submissionId]/review`). Review actions enforce revision lock and append deterministic audit events. | None for build/typecheck. Live review blocked on real Penn State human reviewer credentials (`@psu.edu`). | Provision verified reviewer account in Firebase Auth using the exposed password-reset flow; perform human review of pending items. |
| **ArcGIS** | VERIFIED / GATED (EMPTY) | Publication contracts pass 15/15 tests (`npm run test:publication`). Python provisioning privacy tests pass 2/2 tests (`provision_test.py`). Scripts compile cleanly with `py_compile`. Private authoritative service `b5c738cc413f4f44b213885b8500c10d` confirmed fail-closed (HTTP 200, code 499 "Token Required"). Four public-safe hosted views live, verified anonymous, read-only (`"capabilities":"Query"`), and currently return count = 0. Unique attribute indexes on all key fields prevent duplicate insertion. | Feature toggle `ENABLE_ARCGIS_PUBLICATION_FUNCTION` is defaulted to `false` (omitted deployment gate). Live execution requires secret `ARCGIS_OAUTH_CLIENT_ID` and `ARCGIS_OAUTH_CLIENT_SECRET`. | Configure OAuth application secrets scoped exclusively to `b5c738cc413f4f44b213885b8500c10d`; activate Cloud Function only with a verified non-test publication candidate. |
| **Dashboard** | VERIFIED / EMPTY (PRODUCTION-BOUND) | Public dashboard test suite passes 6/6 tests (`npm test --prefix public-dashboard`). TypeScript typechecking (`npm run typecheck --prefix public-dashboard`) passes with 0 errors. Next.js 15.2.9 production build (`npm run build --prefix public-dashboard`) passes with code 0 (4/4 static pages generated: `/`, `/_not-found`). Production adapter (`ArcgisDashboardDataSource.ts`) binds directly to the 4 verified anonymous public views; fails closed on unexpected fields; explicitly displays "Monitoring source unavailable" or empty views with zero synthetic fallback unless explicitly in demo mode (`NEXT_PUBLIC_DASHBOARD_DATA_MODE=demo`). | None. Production dashboard is intentionally empty pending first real approved observation. | Address Node typeless package warning in `public-dashboard/package.json` (`"type": "module"`). Await real approved scientific observation for data populating. |
| **GitHub** | VERIFIED | Workflows in `.github/workflows/` cover `mobile-ci.yml`, `publication-ci.yml`, `public-dashboard-ci.yml`, `codeql.yml`, and `ios-testflight-build13.yml`. Release branches (`release/ios-existing-app-v0.1.0-b13`) and integration branches (`integration/pa-watershed-watch-2026-09`) are tracked cleanly. Build 13 upload is safely gated by comment command `!testflight-build13` from repository owner. Repository hygiene checks pass completely (0 tracked secrets, credentials, or generated files). | Final release tagging gated on physical iPhone verification and human QC review evidence. | Maintain green CI across all workflows; prepare branch consolidation into `main` once Phase 11 gates close. |
| **Design System** | DIVERGENT (Documented Facts) | Core tokens documented across all surfaces. iOS and Android share Hemlock (`#0D5C4B`), Water (`#167A8B`), and Limestone (`#F3F1E9`). QC Console uses Navy (`#0D2F3F`), Teal (`#135467`-`#2B8AA6`), and Slate (`#F2F5F8`). Dashboard uses Esri Calcite Blue (`#007AC2`), dark ink (`#17212B`), and Canvas (`#EDF1F4`). Iconography and typography vary per platform (SF Symbols vs Material vs Web Icons/SVG vs Calcite font). | None blocking functionality; stylistic divergence is intentional for surface context (field vs reviewer desktop vs public GIS), but requires design token harmonization before v1.0. | Catalog design tokens into a shared multi-surface design contract; preserve current functional implementations without premature speculative refactoring. |
| **Security** | VERIFIED / FAIL-CLOSED | No tracked `.env` files, `.key`, `.p8`, `.pem`, or `service_account.json` credentials. No hardcoded secrets in source. Authoritative ArcGIS FeatureServer refuses anonymous requests (HTTP 499 "Token Required"). Public ArcGIS views restrict capabilities to `"Query"` only. Dashboard fails closed on missing/unexpected fields. Review actions enforce Firestore emulator host requirement when testing. Private collector and reviewer IDs, raw notes, and GPS accuracy never leak to public views. | None. Fail-closed posture is strictly enforced across all layers. | Maintain secret scanning and automated hygiene checks in CI on all PRs. |

---

## 2. Exact Tests, Builds, and Checks Executed

### A. Successfully Executed Automated Checks (Pass: 53, Fail: 0)

1. **Backend & Scientific Contracts (`npm run test:contracts`)**
   - **Command:** `node --test tests/validation/*.test.mjs`
   - **Output:** 30 tests, 0 suites, 30 passed, 0 failed, 0 cancelled, duration 46.56 ms.
   - **Coverage:** Parameter catalog completeness (Phase 10 runtime measurement codes), workflow states, production measurement catalog (12 supported, 10 feature-gated), mobile golden fixtures, nonblocking review routing (`PENDING_REVIEW`), blocking routing (`NEEDS_CORRECTION`), environmental alert thresholds (pH 5, low DO, high chloride), internal engine flag stripping, coordinate validation, historical anomaly weighting, future collection time blocking, DO percent/mgL plausibility warnings.

2. **ArcGIS Publication Lifecycle & Security (`npm run test:publication`)**
   - **Command:** `node --test tests/publication/*.test.mjs`
   - **Output:** 15 tests, 0 suites, 15 passed, 0 failed, 0 cancelled, duration 48.20 ms.
   - **Coverage:** Sequential retry idempotency, immutable historical approved observation conflict detection, latest-site materialization, dataset ID discovery by name, active lease token fencing, expired lease recovery, canonical unit preservation (no silent conversions), unapproved/rejected exclusion, stale revision rejection, exact UTC instant preservation in ArcGIS epoch milliseconds, opaque public join ID generation, fail-closed behavior for unknown/private/test sites (`TEST-014` rejected), approval trigger claim filtering.

3. **ArcGIS Provisioning Privacy Verification (`tests/publication/provision_test.py`)**
   - **Command:** `python3 -m unittest discover -s tests/publication -p '*_test.py'`
   - **Output:** 2 tests run in 0.002s, Status: OK (2 passed, 0 failed).
   - **Coverage:** Verified public view layer definition schemas exclude private fields, non-public fields cannot be marked public, and authoritative service configuration disallows delete/anonymous editing.

4. **Public Dashboard Adapter & Data Contract (`npm test --prefix public-dashboard`)**
   - **Command:** `node --experimental-strip-types --test scripts/adapter.test.mjs`
   - **Output:** 6 tests, 0 suites, 6 passed, 0 failed, 0 cancelled, duration 86.88 ms.
   - **Coverage:** Public adapter joins opaque IDs, preserves zero/units and uses collection time (not approval time); ID pagination loads all rows even with 1 record per page; privacy/schema failures, private sources, and partial pages fail closed; orphan/wrong-site/duplicate measurements and unexpected units rejected; empty approved views stay empty; retry recovers transient failures; configured units match native production catalog.

5. **ArcGIS Automation Python Compilation (`python3 -m py_compile`)**
   - **Command:** `python3 -m py_compile scripts/provision_arcgis_publication.py scripts/verify_arcgis_publication.py scripts/inventory_arcgis_legacy.py`
   - **Output:** Exit code 0 (All 3 scripts compiled with zero syntax or import errors).

6. **Public Dashboard TypeScript Typecheck (`npm run typecheck --prefix public-dashboard`)**
   - **Command:** `tsc --noEmit`
   - **Output:** Exit code 0 (0 errors).

7. **Public Dashboard Production Build (`npm run build --prefix public-dashboard`)**
   - **Command:** `next build` (Next.js 15.2.9)
   - **Output:** Exit code 0. Compiled successfully. Static pages generated (4/4): `/` (14.1 kB, First Load JS 125 kB), `/_not-found` (994 B, First Load JS 112 kB).

8. **QC Console TypeScript Typecheck (`npm run typecheck --prefix web`)**
   - **Command:** `tsc --noEmit`
   - **Output:** Exit code 0 (0 errors).

9. **QC Console Production Build (`npm run build --prefix web`)**
   - **Command:** `next build` (Next.js 16.3.0 Turbopack)
   - **Output:** Exit code 0. Compiled successfully in 1833ms. TypeScript finished in 1183ms. 4/4 static/dynamic routes generated:
     - `○ /` (Static)
     - `○ /_not-found` (Static)
     - `ƒ /api/submissions/[submissionId]/review` (Dynamic)
     - `○ /review` (Static)
     - `ƒ /review/[submissionId]` (Dynamic)

10. **Repository Hygiene & Privacy Checks (Automated Script)**
    - Tracked temporary/generated files (`.DS_Store`, `DerivedData`, `.gradle`, `build/`, `local.properties`, `.zip`, `.patch`, `.diff`): **0 found (CLEAN)**.
    - Tracked credential files (`service[-_]?account[^/]*\.json`, `*.p8`, `*.pem`): **0 found (CLEAN)**.
    - Tracked private key markers (`BEGIN PRIVATE KEY`, `"type": "service_account"`): **0 found (CLEAN)**.
    - Deferred media capture/upload code (iOS: `AVAudioRecorder`, `AVCaptureSession`, `PHPickerViewController`, `PhotosPicker`, `UIImagePickerController`, `NSCameraUsageDescription`; Android: `MediaRecorder`, `androidx.camera`, `PickVisualMedia`, `CAMERA`, `RECORD_AUDIO`, `FirebaseStorage`): **0 found (CLEAN)**.

11. **Live Read-Only Public ArcGIS View Verification (HTTP GET / curl)**
    - `SamplingSites` View (`Central_PA_Watershed_Public_Sites`): HTTP 200, `{"count":0}`. Capabilities: `"Query"`.
    - `ApprovedObservations` View (`Central_PA_Watershed_Public_Observations`): HTTP 200, `{"count":0}`. Capabilities: `"Query"`. Field schema: 27 fields, all on public allowlist.
    - `Measurements` View (`Central_PA_Watershed_Public_Measurements`): HTTP 200, `{"count":0}`. Capabilities: `"Query"`.
    - `LatestSiteConditions` View (`Central_PA_Watershed_Public_Latest`): HTTP 200, `{"count":0}`. Capabilities: `"Query"`.
    - Authoritative Service (`Central_PA_Watershed_Approved_Authoritative`): HTTP 200, `{"error":{"code":499,"message":"Token Required"}}` (Fail-closed verified).

---

### B. Toolchain-Blocked Checks & Safest Remediations

| Target Check | Exact Toolchain Blocker | Safest Remediation |
| :--- | :--- | :--- |
| **iOS Build & Tests** (`xcodebuild test`, `swift --version`) | Error: `You have not agreed to the Xcode and Apple SDKs license. You must agree to the license below in order to use Xcode.` | Host administrator must run `sudo xcodebuild -license accept` in terminal. No source code modifications or bypasses. |
| **Android Build & Unit Tests** (`./gradlew :app:testDebugUnitTest`) | Error: `The operation couldn’t be completed. Unable to locate a Java Runtime. Please visit http://www.java.com for information on installing Java.` AND `ANDROID_HOME` is not set. | Install OpenJDK 17 (e.g. `brew install openjdk@17` or Temurin 17), configure `JAVA_HOME`, and export `ANDROID_HOME="$HOME/Library/Android/sdk"`. |
| **Firebase Emulator Suite** (`npx firebase emulators:exec ...`) | Error: `Error: Process java -version has exited with code 1. Please make sure Java is installed and on your system PATH.` | Firebase Local Emulators (Firestore, Storage) run as a Java jar. Installing OpenJDK 17/21 satisfies this requirement. |
| **Validation Trigger Integration** (`npm run test:trigger`) | Fails with `ERR_MODULE_NOT_FOUND` when run standalone without emulator environment variables; requires running under `firebase emulators:exec --only firestore,functions`. Blocked by missing Java. | Install Java, run under `npx firebase emulators:exec --project central-pa-watershed-dev --only firestore,functions "npm run test:trigger"`. |
| **Review Lifecycle Integration** (`npm run test:review`) | Requires active `FIRESTORE_EMULATOR_HOST` (fails safe with: `Refusing to run review tests against a non-emulator Firestore instance`). Blocked by missing Java for emulator. | Install Java, run under `npx firebase emulators:exec --project central-pa-watershed-dev --only firestore "npm run test:review"`. |

---

## 3. Exact Human-Only Gates

The following decisions and execution steps are strictly reserved for human stakeholders and cannot be bypassed, automated, or executed by AI agents:

1. **Apple Developer & TestFlight Physical Verification:**
   - Physical device installation: Verifying Build 13 (`0.1.0 (13)`) on real iPhone hardware under varied network conditions.
   - App Store Connect release submission and compliance confirmations.
   - Triggering TestFlight builds requires comment `!testflight-build13` on issue #26 by repo owner `UnbrokenMango21` with Apple Team private key secrets.

2. **QC Console Reviewer Authentication & Authority:**
   - Reviewer identity: Real human reviewer account provisioning requires an authentic Penn State email (`@psu.edu`). The test reviewer `test.qc.reviewer@central-pa-watershed-dev.local` is restricted to smoke fixtures and cannot author production approvals.
   - Initial reviewer password setup: Must be executed by the human reviewer via the console's exposed Firebase password-reset flow.

3. **Scientific Review Decision on `TEST-014`:**
   - `TEST-014` revision 2 is currently in `PENDING_REVIEW` with 0 error flags.
   - Only a human reviewer may approve, request correction on, or reject this record.
   - `TEST-014` is a test site and is explicitly blocked from public ArcGIS publication clearance by `buildPublicationBundle`.

4. **ArcGIS Production Publisher Deployment & Secret Provisioning:**
   - Creating and scoping the ArcGIS OAuth application credential in ArcGIS Online to only feature service item `b5c738cc413f4f44b213885b8500c10d`.
   - Setting Firebase Functions secrets: `ARCGIS_OAUTH_CLIENT_ID` and `ARCGIS_OAUTH_CLIENT_SECRET`.
   - Explicitly enabling the deployment parameter `ENABLE_ARCGIS_PUBLICATION_FUNCTION=true` and setting `ARCGIS_PUBLICATION_FEATURE_SERVICE_URL`.

5. **First Live Scientific Publication Clearance:**
   - Approving the first real-world, non-test observation for live transmission to ArcGIS. Test sites (`TEST-*`) fail closed and will not publish.

6. **Historical Data Migration (117-record / 5-site inventory):**
   - The 2025 legacy dataset remains excluded because its provenance does not establish publication approval, collector privacy handling, or canonical parameter lineage. Stakeholders must decide whether to migrate or permanently archive it.

7. **Git Release Tagging & Production Branch Merges:**
   - Merging `release/ios-existing-app-v0.1.0-b13` and `integration/pa-watershed-watch-2026-09` into `main`.
   - Tagging official Phase 11 / Phase 12 production release tags.

---

## 4. Stale Documentation Found

1. **`Phone App/Android App/README.md` (Line 17):**
   - *Text:* `"Location, camera, and microphone permissions are requested only in the field action that needs them. Existing photos use Android's system photo picker and need no broad media-library permission."*
   - *Issue:* Media capture/storage is completely deferred (`docs/DEFERRED_MEDIA_FEATURE.md`). The Android codebase contains no camera, microphone, or photo picker code, and CI hygiene actively fails if these permissions or APIs appear.
   - *Remediation:* Update Android `README.md` to state that media capture is deferred, Water Temperature is the only mandatory measurement, and only Location permission is requested.

2. **`README.md` (Lines 74–75):**
   - *Text:* `"Finish the Phase 11 release lock by proving the development iPhone → Firebase → live validation → QC Console roundtrip through internal TestFlight. After that, build the approved-only ArcGIS publisher as a trusted, server-side, idempotent publication boundary."*
   - *Issue:* The approved-only ArcGIS publisher has *already* been fully designed, implemented, and verified in Phase 12 (`publication/`, `config/arcgis_publication_schema.json`, `config/publication_contract.json`, 15/15 tests passing, 4 public views provisioned).
   - *Remediation:* Update the roadmap narrative in root `README.md` to reflect that the publisher is already built and gated, awaiting Phase 11 physical verification and live credential activation.

3. **`docs/ROADMAP.md` (Lines 21–39):**
   - *Text:* Lists *"Next: approved-only ArcGIS publisher"* and *"Then: public/research dashboard"* as future development stages.
   - *Issue:* Last updated 2026-08-15. Both the ArcGIS publisher (`publication/`) and the public dashboard (`public-dashboard/`) have already been implemented, tested, and integrated into the repository as of September 2026.
   - *Remediation:* Update `docs/ROADMAP.md` to mark Phase 12 publication and public dashboard foundation as implemented and verified.

4. **`docs/PHASE12_ARCGIS_PUBLICATION.md` (Line 16):**
   - *Text:* *"The active web/ application is the Firebase App Hosting QC console. Its root redirects to /review; the earlier public dashboard implementation exists only as closed historical PR #1 and is not active production code."*
   - *Issue:* `public-dashboard/` now exists in the active tree as a standalone Next.js 15 application connected to verified live public ArcGIS views (`ArcgisDashboardDataSource.ts`), with CI workflows (`public-dashboard-ci.yml`) and passing test suites.
   - *Remediation:* Clarify that while `web/` remains the dedicated QC Console, `public-dashboard/` is the active, verified public dashboard application.

5. **`public-dashboard/package.json`:**
   - *Warning during test:* `[MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of ... ArcgisDashboardDataSource.ts is not specified and it doesn't parse as CommonJS... To eliminate this warning, add "type": "module" to public-dashboard/package.json.`
   - *Remediation:* Add `"type": "module"` to `public-dashboard/package.json`.

---

## 5. Cross-Surface Design Inconsistencies (Facts Only, No Redesign Yet)

An audit of the design tokens, component styles, and layouts across the four user-facing surfaces reveals notable divergences:

| Dimension | Native iOS (SwiftUI) | Native Android (Compose) | QC Console (`web/`) | Public Dashboard (`public-dashboard/`) |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Brand Color** | Hemlock `#0D5C4B` (Dark: `#63D3B3`) | Hemlock `#0D5C4B` (Dark: `#8FD5C0`) | Navy `#0D2F3F` / Brand-700 `#135467` / Brand-500 `#2B8AA6` | Esri Calcite Blue `--accent: #007AC2` / Deep: `#005A91` |
| **Secondary Accent** | Deep Water `#167A8B` (Dark: `#6BC9D5`) | Water `#167A8B` (Dark: `#7DCBD6`) | Brand-600 `#1A6A84` / Brand-100 `#D5E6EC` | Light Blue Soft `--accent-soft: #EAF4FB` |
| **Background / Canvas** | Limestone `#F3F1E9` (Dark: `#171A18`) | Limestone `#F3F1E9` (Dark: `#111714`) | Cool Neutral Slate `--bg: #F2F5F8` | Canvas `--canvas: #EDF1F4` / `--surface-soft: #F6F8FA` |
| **Typography Stack** | Apple SF Pro (System text styles, tabular figures) | Roboto / Android SansSerif (Material 3 type scale) | System UI stack (`system-ui, -apple-system, Segoe UI, Roboto...`), mono for UUIDs | Esri Calcite font stack (`"Avenir Next", "Avenir", "Helvetica Neue", sans-serif`) |
| **Brand Mark / Glyph** | Squircle (radius `size * 0.22`) with SF Symbol `"water.waves"` | Custom vector launcher icon | 8px rounded square with opacity border, text/glyph `#9FD4E4` | Circular badge (radius 50%) with mathematical tilde `≈` in `#005A91` |
| **Attention / Warning Color** | Goldenrod `#A76100` (Dark: `#F3B65C`) | Goldenrod `#A76100` (Material Tertiary) | Warning `#8A5300` / bg `#FDF4E5` / border `#E5C98E` | Warning `#9A650C` |
| **Success Color** | Fern `#2E7D52` (Dark: `#66D49A`) | Fern `#2E7D52` | Ok `#1A6344` / bg `#E8F3ED` / border `#A9CDBA` | Success `#2D6F47` |
| **Corner Radii** | Small: 12pt, Medium: 16pt, Large: 24pt | M3 shapes: 12dp, 16dp, 28dp | Micro-radii: 3px, 5px, 8px, 10px, Pill: 999px | Sharp: 4px, 6px |
| **Layout Paradigm** | Single-column form, persistent bottom action shelf (progress + local save state) | Scaffold with TopAppBar, scrollable form, bottom action bar | Dense desktop workspace: 56px appbar, 340px queue rail, record pane, sticky decision panel | Fullscreen split layout: 58px header, responsive map canvas, site picker rail, expandable chart drawer |
| **Required Field Marker** | Bold red asterisk `*` (`RequiredMark`) only on canonical schema fields | Inline label / text indication | Structural badge indication in form rows | N/A (Read-only data presentation) |

---

## 6. Top 10 Integration Actions in Priority Order

1. **Accept Local Xcode License (`sudo xcodebuild -license accept`):** Unblocks local Mac execution of `xcodebuild test` and Swift compiler verification for the iOS project.
2. **Install OpenJDK 17/21 on Development Host:** Unblocks local Android Gradle compilation (`./gradlew`) and local Firebase Emulator Suite execution (`firestore`, `storage`, `functions`).
3. **Verify Build 13 on Physical iPhone via TestFlight:** Confirm manual installation, Firebase Authentication login, local draft storage, and submission dispatch on real hardware.
4. **Provision Real Human Reviewer Account in Firebase Auth:** Create an authorized reviewer identity with a valid Penn State (`@psu.edu`) email and complete the password-reset flow in the QC Console.
5. **Conduct Authoritative Human Review on `TEST-014` in QC Console:** Have the human reviewer evaluate revision 2 in `PENDING_REVIEW`, verifying the immutable revision record, parent state update, and audit trail.
6. **Provision ArcGIS OAuth Secrets in Firebase Functions:** Create an ArcGIS OAuth app in ArcGIS Online scoped exclusively to authoritative item `b5c738cc413f4f44b213885b8500c10d`; set `ARCGIS_OAUTH_CLIENT_ID` and `ARCGIS_OAUTH_CLIENT_SECRET`.
7. **Deploy and Activate the Approved ArcGIS Publisher:** Deploy `functions/index.mjs` with `ENABLE_ARCGIS_PUBLICATION_FUNCTION=true` and `ARCGIS_PUBLICATION_FEATURE_SERVICE_URL`.
8. **Conduct First Controlled Live Publication:** Select a provenance-cleared, non-test approved observation and verify automated publication into `Central_PA_Watershed_Approved_Authoritative` and anonymous propagation to the 4 public hosted views.
9. **Update Stale Documentation & Add `"type": "module"` in Dashboard:** Fix Android `README.md` media references, update `ROADMAP.md` and root `README.md` to reflect Phase 12 completion, and eliminate the Node warning in `public-dashboard/package.json`.
10. **Perform Final Branch Consolidation & Tag Phase 11 / Phase 12:** Merge `release/ios-existing-app-v0.1.0-b13` and `integration/pa-watershed-watch-2026-09` into `main`, and apply official release tags.

---

## 7. SAFE_FOR_PRIMARY_AGENT

The following actions are **100% safe** for execution by the primary engineering agent right now, as they do not modify production databases, do not trigger premature scientific publication, do not approve/reject `TEST-014`, and do not alter scientific invariants:

1. **Add `"type": "module"` to `public-dashboard/package.json`:** Eliminates Node's typeless package warning when running tests with experimental type stripping.
2. **Update Stale Documentation:**
   - Remove obsolete camera/microphone/photo-picker wording from `Phone App/Android App/README.md`.
   - Update `docs/ROADMAP.md` to document Phase 12 ArcGIS publication and public dashboard as verified accomplishments rather than pending items.
   - Update `README.md` to reflect current Phase 12 verified status.
   - Clarify `docs/PHASE12_ARCGIS_PUBLICATION.md` regarding the active `public-dashboard/` application.
3. **Execute Contract, Publication, and Hygiene Tests:** Run `npm run test:contracts`, `npm run test:publication`, Python unittests, and the repository hygiene script to maintain continuous verification.
4. **Compile and Build Web Frontends:** Run `npm run typecheck` and `npm run build` in both `web/` and `public-dashboard/` to verify bundling and typing integrity.
5. **Perform Read-Only Live ArcGIS Verification:** Query public hosted views via anonymous HTTPS GET to confirm schema conformance, record counts (currently 0), and read-only query capabilities.
6. **Audit Data Catalogs and Schemas:** Review `config/production_measurement_catalog.json`, `config/arcgis_publication_schema.json`, and `config/publication_contract.json` to ensure exact parity across native mobile enums, Firestore documents, and ArcGIS layer definitions.
7. **Lint and Typecheck Mobile Codebases (when toolchains are installed):**
   - Run `xcodebuild test -project PAWatershedWatch.xcodeproj ...` on iOS simulator once the Xcode license is accepted.
   - Run `./gradlew :app:testDebugUnitTest :app:lintDebug` once OpenJDK 17 is installed.
8. **Audit Firestore and Storage Security Rules Locally:** Run emulator test suites under `tests/firestore-rules/` and `tests/validation-firestore/` once Java is available.