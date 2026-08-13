# PA Watershed Watch Android Port Audit

Date: 2026-08-13

Branch: `codex/android-native-v1`

Scope: native Android frontend with realistic mock data; no production Firebase integration

## Decision

Build the Android product as a native Kotlin application with Jetpack Compose and Material 3 under `Phone App/Android App/`.

Skip/SkipUI is not the right dependency boundary for this port. The approved iOS app is a standalone Xcode project rather than a Skip-compatible Swift package, and it directly uses Core Location, AVFoundation, UIKit, iOS permission flows, SwiftUI focus behavior, and iOS presentation conventions. Adopting Skip would require restructuring or modifying the approved iOS source, introduce a transpilation/runtime dependency, and still require Android-specific Compose work for lifecycle, restoration, permissions, predictive back, and field-device behavior. The Android port will share product semantics and visual intent, not runtime code.

## Sources inspected

### Approved product source

- `Phone App/iPhone App/PAWatershedWatch/PAWatershedWatch/*.swift`
- `Phone App/iPhone App/PAWatershedWatch/README.md`
- `Phone App/iPhone App/PAWatershedWatch/brand-spec.md`
- `Phone App/iPhone App/PAWatershedWatch/MeasurementUnits.md`
- `Phone App/iPhone App/PAWatershedWatch/DesignReview.md`

The iOS product defines the screen hierarchy, field sequence, task emphasis, field-language copy, mock Pennsylvania data, scientific unit presentation, revision UX, and the separation between workflow and transport state.

### Locked product and scientific contracts

- `config/collection_protocol.json`
- `config/parameter_catalog.json`
- `config/validation_rules.json`
- `config/workflow_states.json`
- `config/firebase_schema.json`
- `config/quality_score.json`
- `config/validation_contracts/*.json`
- `firebase/firestore.rules`
- `docs/ARCHITECTURE.md`
- `docs/DATA_DICTIONARY.md`
- `docs/STEP4_COLLECTION_VALIDATION.md`
- `docs/VALIDATION_ENGINE_STEP10.md`
- `docs/WORKFLOW_MANAGER_PHASE8_DESIGN_LOCK.md`
- Phase 11 mobile design and execution documents

These files remain unchanged. Client behavior must not weaken or replace server-side validation, ownership, workflow transitions, immutable revisions, or read-only server-derived fields.

### Engineering reference

- `mobile/src/config/contracts.ts`
- `mobile/src/domain/*`
- `mobile/src/lib/*`
- `mobile/src/services/*`
- `mobile/src/state/*`

The React Native app is useful for contract parsing, raw numeric draft storage, lifecycle flushes, cache/source state, retry-safe submission sequencing, and privacy-preserving analytics boundaries. Its visual composition is not the Android design source.

## Product inventory

### App shell

- Sign In
- Home
- Recent
- Account
- A single active observation workflow presented above the tab shell

### Observation workflow

1. Select Site
2. Visit Details
3. Test & Method
4. Measurements
5. Notes & Media
6. Review
7. Submit confirmation
8. Submission Status

### Record workflow

- Recent Observations
- Observation Detail
- Correction Revision
- Revision Review
- Revision Status
- Immutable revision history

### Product states

Workflow state and transport state are orthogonal:

| Concern | Values shown to the researcher |
| --- | --- |
| Scientific record | Draft, Submitted, Needs Correction, Resubmitted |
| Transport | Saved locally, Waiting to sync, Syncing, Synced, Sync failed |
| Site source | Loading, Live, Cached, Empty, Error |
| Location | Acquiring, Accurate, Poor accuracy, Approximate only, Denied, Unavailable |

No UI may say that an observation reached the archive until the mock transport reports a confirmed sync.

## Locked contract boundary

### Structural data

An observation draft includes a site, collection date/time, coordinates and accuracy, collector, test type, method, instrument or lab, measurements, notes, photos, and optional audio.

### Phase 10 parameter codes

Core:

- `WATER_TEMP_C`
- `PH`
- `DO_MG_L`
- `CONDUCTIVITY_US_CM`

Optional:

- `DO_PERCENT`
- `TDS_MG_L`
- `ORP_MV`
- `CHLORIDE_MG_L`
- `SULFATE_MG_L`
- `NITRATE_MG_L`
- `PHOSPHATE_MG_L`
- `DISCHARGE_M3_S`

Temperature preserves the entered value and entered unit while displaying the derived counterpart. ORP accepts signed values. pH is limited to 0–14. Negative concentrations and flow are invalid.

### Approved iOS taxonomy beyond Phase 10

The approved iOS experience also exposes turbidity, salinity, total suspended solids, alkalinity, hardness, ammonia nitrogen, nitrite nitrogen, total phosphorus, chlorophyll-a, and E. coli. The Android mock frontend will present these rows for visual and workflow parity, but they are not assigned invented production parameter codes. They remain UI/mock measurements until the locked catalog is expanded through the normal contract process.

### Required-profile distinction

Phase 10 configuration remains authoritative for future backend validation. The approved iOS prototype provides a more specific field-facing required/optional layout for some test types. The Android frontend mirrors the approved field experience, while the repository boundary retains the original test type and individual measurements so later backend integration can apply the actual configuration without rewriting the UI.

## Scientific unit behavior

Unit labels use mathematical presentation rather than flattened inline strings where it improves scanability. Compatible selections convert the value immediately and preserve its physical meaning. Method-dependent units require confirmation before clearing an existing value.

Examples retained from the approved iOS product include:

- °C / °F
- mg O₂/L / µmol O₂/L
- µS/cm / mS/cm / S/m
- mg/L / µg/L / g/L
- mg N/L / mg NO₃⁻/L and µg equivalents
- m³/s / L/s / ft³/s / gal/min
- mg CaCO₃/L / meq/L
- NTU / FNU, PSS-78 / ‰, and CFU/100 mL / MPN/100 mL as non-convertible method choices

## Android architecture

The implementation stays intentionally small:

- Compose UI screens and reusable field components
- One activity and one app-level state holder/ViewModel
- Domain data classes for sites, drafts, measurements, records, revisions, and state enums
- Repository contracts for observations, media, location, and sync boundaries
- Local mock implementations only
- Android platform launchers for location permission, photo picker/camera, and microphone permission
- Draft persistence using app-private preferences so aggressive auto-save survives activity and process recreation

No Firebase SDK, service locator, dependency injection framework, database, networking layer, or speculative multi-module architecture is added in this phase.

## Android-native behavior

- Edge-to-edge layout with system and IME insets respected
- Material 3 top app bars, sheets/dialogs, menus, snackbars, date/time pickers, navigation bar, and native ripple feedback
- System back and predictive-back-compatible navigation through the Compose navigation stack
- Draft changes saved immediately and flushed on lifecycle transitions
- Runtime location permission with precise/approximate handling and a clear reacquire action
- System photo picker for existing photos; camera and microphone requested only when their actions are used
- Permission denial leaves a recoverable explanation and Settings path
- Keyboard-safe numeric entry with decimal/signed input where scientifically valid
- Minimum 48 dp targets and 56 dp primary actions
- TalkBack labels expose measurement name, entered value, unit, completion state, and action
- Layouts scroll and reflow at large font sizes and on compact/expanded widths
- Long site and method names wrap instead of truncating critical scientific context

## Visual translation

The Android app uses the approved calm environmental identity without imitating iPhone chrome:

- Hemlock `#0D5C4B`
- Water `#167A8B`
- Goldenrod `#A76100`
- Fern `#2E7D52`
- Limestone `#F3F1E9`
- Ink `#17211E`

Android typography, motion, menus, dialogs, navigation, touch feedback, and system surfaces remain native Material 3. The visual hierarchy stays field-oriented: one dominant next action, restrained surfaces, outdoor contrast, generous type, and no dashboard-like density.

## Implementation and validation sequence

1. Create and build the native project.
2. Implement Sign In through Measurements and prove build/install/launch on the available emulator.
3. Complete notes/media, review, submission, recent/detail, correction, account, offline, and recovery states.
4. Run local domain tests for units, validation, and immutable revisions.
5. Build lint and test variants.
6. Install and drive the happy path, correction path, offline retry, permissions, negative ORP, long text, large font, back navigation, and accessibility semantics.

## Explicit non-goals

- Production Firebase integration
- Contract or rules changes
- iOS changes
- React Native changes
- Background sync scheduling
- Real lab/instrument integration
- Invented scientific thresholds, scoring rules, or server state transitions
