# PA Watershed Watch Android Frontend Validation

Date: 2026-08-13

Branch: `codex/android-native-v1`

Device: Android API 37 emulator, 1080 × 2400 phone viewport

## Automated checks

- `./gradlew testDebugUnitTest assembleDebug lintDebug --continue`: passed
- Android unit coverage: temperature, conductivity, and nitrate conversions; signed ORP and invalid-range handling; immutable correction snapshots
- Phase 10 validation unit suite: 24/24 passed
- Firestore rules emulator suite: 25/25 passed
- Validation/Firestore emulator integration suite: 7/7 passed
- `git diff --check`: passed

Existing Firebase rules, validation, workflow, mobile, and iOS sources were not modified.

## Emulator flows

- Happy path: Sign In → Home → Start New Observation → Select Site → Visit Details → Test & Method → Measurements → Notes & Media → Review → Submit → confirmed archive status → Observation Detail
- Correction: retained Revision 1 dissolved oxygen at 91 mg/L; created Revision 2 at 9.1 mg/L with a required source-check note; verified Resubmitted/Synced status and both immutable history entries
- Offline: selected cached site, submitted locally, verified Submitted + Waiting to sync and Archive Not confirmed, restored Online, retried from Observation Detail, and reached Synced
- Restoration: killed and relaunched the app during Step 4; the saved draft resumed with its selected site, temperature, unit, and signed ORP intact
- GPS: exercised the native precise/approximate prompt, denial with Settings recovery, reacquisition, good ±5 m quality, and persistence of captured coordinates/accuracy into Observation Detail
- Media: exercised native camera and microphone prompts, denial explanations, and Settings recovery; existing photos use the system photo picker without broad storage permission
- Back: system back returned through Compose navigation without losing the auto-saved draft

## Scientific and accessibility checks

- Required and Optional sections remain visible for every test profile; all approved optional rows are present without an add-one-at-a-time interaction
- Temperature stores one entered value and shows a one-decimal derived counterpart
- Conductivity unit selection converted 328 µS/cm to 0.328 mS/cm
- ORP accepted and restored -122.4 mV using the signed control
- Review and Observation Detail showed only entered measurements and retained the selected units
- Mathematical unit controls remained tappable and exposed spoken unit names
- UI hierarchy exposed measurement name, required/optional state, value, unit, completion, unit-change action, and signed-value action for TalkBack
- Home and Measurements remained readable, scrollable, and operable at 150% font scale
- Long Pennsylvania site names wrapped without truncating critical context
- Workflow state and sync state remained separate in Home, Recent, Detail, and Submission Status

Runtime screenshots and UI hierarchy captures are intentionally kept out of source control.
