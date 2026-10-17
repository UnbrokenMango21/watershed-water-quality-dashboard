# Changelog

All notable repository-level changes are recorded here. Git history remains the detailed implementation record.

## Unreleased — Phase 11 release lock

### Consolidation
- Promoted the native SwiftUI + Jetpack Compose architecture and trusted QC Console as the sole current product path.
- Retired the superseded Expo/React Native application from the active tree; its history remains recoverable from Git.
- Removed obsolete Workflow Manager-as-required architecture material. Workflow Manager is optional future integration only.
- Removed stale Phase 11 remediation/audit/readiness documents and the obsolete camera-permission preview.
- Replaced the repository landing page, architecture, roadmap and documentation index with current-state documentation.

### CI and hygiene
- CI now targets pull requests and `main`, covering backend contracts/rules/validation/review lifecycle, QC web build, native Android, native iOS and repository hygiene.
- Removed the legacy Expo regression job.
- Added tracked-secret/private-key guards and expanded generated/local artifact checks.
- Added `*.patch` and `*.diff` handoff artifacts plus private signing/admin credential patterns to `.gitignore`.

### Native iOS
- Current release candidate targets the existing App Store Connect application with bundle identifier `org.centralpawatershed.mobile`; the next internal TestFlight candidate is version `0.1.0` build `10`.
- The matching Firebase Apple app remains registered in `central-pa-watershed-dev`.
- Release uses App Attest; the App Check debug provider is compiled only in Debug.
- Camera and microphone permissions/capture remain absent. Media is deferred.

### Trusted QC
- The QC Console remains the authoritative human review surface with Approve, Request Correction and Reject lifecycle protection.
- Review decisions do not mutate submitted scientific revisions.

### Next release gates
- Prove the validation trigger in live development Firebase.
- Upload/process the iOS Release archive in the existing App Store Connect application and enable internal TestFlight.
- Complete a real iPhone submission, QC decision and correction revision roundtrip.
- Record the successful evidence in `docs/PHASE11_RELEASE_LOCK.md` and tag the tested commit.

## Phase 10 baseline

Phase 10 established the pre-native-mobile project baseline. The exact milestone is retained in Git history and is intended to receive a permanent milestone tag during repository consolidation.
