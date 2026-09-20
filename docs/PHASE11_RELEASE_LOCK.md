# Phase 11 release evidence

Updated September 20, 2026. Release closure is still pending physical-device verification and final human reviewer approval/readback.

## Tested release source

The current iOS release line is `a23358ad1f3c32f5b9c12a2a10e864ca5d1ca7d7`: bundle `org.centralpawatershed.mobile`, version **0.1.0**, build **13**. GitHub Actions run [34787514559](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/actions/runs/34787514559) passed 14 native tests, produced a signed archive, and uploaded the build. App Store Connect reports the build as `VALID`, `IN_BETA_TESTING`, and `usesNonExemptEncryption=false` after the compliance carry-forward run [34788257765](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/actions/runs/34788257765).

The workflow checked out the exact release ref `release/ios-existing-app-v0.1.0-b13`; the release branch remains separate from the integration branch until final review evidence is complete.

Build 12 includes correction acknowledgment ordering and the pending-sync guard against phantom revisions. A collector cannot create another correction until the accepted revision is acknowledged. Submission listeners preserve pending local revisions against stale server state.

## Current verification

- On September 20, local Xcode 27 / iOS 27 simulator verification passed 14/14 native tests on an iPhone 18 Pro simulator; the debug app installed and launched successfully. Physical TestFlight installation on the project iPhone remains a human/device checkpoint.
- On September 20, Android local verification passed `testDebugUnitTest`, `lintDebug`, `assembleDebug`, `assembleRelease`, and `assembleDebugAndroidTest`; 3/3 connected instrumentation tests passed on the `PAWatershed_API_34` Pixel 8 AVD.
- Firestore rules: 42 tests passed; Storage rules: 6; validation persistence: 7; review lifecycle: 16. These are emulator evidence, not substitutes for live reviewer readback.
- Live development Firebase has the active validation function.
- TEST-014 has accepted revision 2 in `PENDING_REVIEW`, with zero error flags. Its previous review decision refers to revision 1. No final approval of revision 2 is claimed here.

## Closure gate

An authenticated real reviewer must approve accepted revision 2 through the trusted review action. Verify the unchanged revision, reviewer identity, timestamps, parent state and deterministic audit entry. Keep raw IDs and reviewer details in private operational evidence. The normal Penn State reviewer identity has been provisioned with the reviewer role; password setup/login through Firebase's reset flow remains a human checkpoint.

The development identity `test.qc.reviewer@central-pa-watershed-dev.local` remains because `scripts/seed_qc_smoke_data.mjs` and review fixtures depend on it. It is not the normal reviewer account and is not used for public publication.

Do not issue a final Phase 11 release tag until that evidence exists. TEST-014 is a controlled development record and must not silently become production monitoring science.