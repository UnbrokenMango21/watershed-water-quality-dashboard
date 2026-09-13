# Phase 11 release evidence

Updated September 9, 2026. Release closure is still pending final reviewer approval/readback.

## Tested release source

The tested iOS line is `ad0dedaa74f55fb97a8201098f4e457d39c7bef9`: bundle `org.centralpawatershed.mobile`, version **0.1.0**, build **12**. It is integrated through merge `7938d58`.

[GitHub Actions run 31961107397](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/actions/runs/31961107397) checked out that exact source, passed 14 tests, produced a signed archive and uploaded build 12 to TestFlight. The workflow was triggered from main by an issue comment; that is not the source branch of the archived application.

Build 12 includes correction acknowledgment ordering and the pending-sync guard against phantom revisions. A collector cannot create another correction until the accepted revision is acknowledged. Submission listeners preserve pending local revisions against stale server state.

## Current verification

- Local iOS simulator `xcodebuild test` passed on September 9 with code signing disabled. Signed distribution evidence is the workflow above.
- Android `testDebugUnitTest`, `lintDebug`, `assembleDebug` and `assembleRelease` passed after restoring the tracked `Model.kt` from Git. SDK configuration was supplied through `ANDROID_HOME`.
- Firestore rules: 42 tests passed; Storage rules: 6; validation persistence: 7; review lifecycle: 16. These are emulator evidence, not substitutes for live reviewer readback.
- Live development Firebase has the active validation function.
- TEST-014 has accepted revision 2 in `PENDING_REVIEW`, with zero error flags. Its previous review decision refers to revision 1. No final approval of revision 2 is claimed here.

## Closure gate

An authenticated reviewer must approve accepted revision 2 through the trusted review action. Verify the unchanged revision, reviewer identity, timestamps, parent state and deterministic audit entry. Keep raw IDs and reviewer details in private operational evidence.

Do not issue a final Phase 11 release tag until that evidence exists. TEST-014 is a controlled development record and must not silently become production monitoring science.
