# Phase 11A — EAS Platform Proof

## Goal

Prove the existing Phase 11 mobile application can be developed reproducibly for both iOS and Android without making the developer Mac the normal native build server.

This milestone is infrastructure/platform proof only. Preserve the existing UI/design system and do not expand the field-data feature scope until both platforms and Firebase connectivity are proven.

## Locked development model

- Source: GitHub repository / `platform-v0.1-foundation`
- App: Expo + React Native + TypeScript
- Native Firebase: React Native Firebase (`app`, `auth`, `firestore`, `analytics`)
- Native compilation: EAS Build cloud
- Routine JS/TS/UI iteration: local Expo/Metro against installed development clients
- iOS development target: EAS iOS Simulator development build
- Android development target: EAS development APK usable on an emulator/device
- Backend: Firebase `central-pa-watershed-dev`
- Generated `mobile/ios` and `mobile/android`: untracked/regenerated
- CI: GitHub Actions for mobile static checks; do not consume EAS native-build quota on every commit

## Human-account boundaries

The agent may configure files, run local checks, use already-authenticated CLIs, create coherent commits, and push verified changes for this milestone.

Stop and request the minimum human action when an external service requires interactive authentication, account creation, billing/terms acceptance, or a credential that is not already available. Never ask the user to paste passwords, PATs, Firebase secrets, Apple credentials, or Expo tokens into chat or repository files.

Expected possible human gates:

- Sign in/create a free Expo account for EAS.
- Confirm/create the EAS project association.
- Create a synthetic Firebase Email/Password collector account if one does not already exist.

An Apple Developer Program membership is not required for the iOS Simulator proof.

## Repository reconciliation

Before changing mobile config:

1. Sync the branch with `origin/platform-v0.1-foundation` without discarding unrelated user work.
2. Confirm `.nvmrc` is removed from the branch; do not change the user's machine-wide Node default.
3. Confirm `mobile/ios` and `mobile/android` are absent or ignored/untracked.
4. Confirm Firebase client config files remain local/ignored.
5. Confirm the previously abandoned `npm audit fix --force` dependency churn is not present.
6. Run/record the current lightweight baseline when dependencies are installed.

Do not resurrect old local `expo prebuild`, CocoaPods, simulator-reset, or Xcode workaround state merely because it existed previously.

## Native Firebase configuration

Use React Native Firebase rather than replacing the Phase 11 backend integration.

For Expo iOS compatibility, use the current React Native Firebase / Expo-supported `expo-build-properties` configuration. Do not reuse the abandoned `useFrameworks: "dynamic"` workaround unless current primary documentation explicitly requires it.

Keep Analytics in privacy-safe mode. Preserve/configure the iOS Analytics option that removes Advertising ID support when supported by the installed React Native Firebase version.

Do not enable Google Sign-In merely to silence an optional Firebase Google authentication warning; Phase 11 authentication is Email/Password.

## Firebase service configuration in EAS

The real Firebase client files remain out of Git:

- `mobile/google-services.json`
- `mobile/GoogleService-Info.plist`

A cloud build must not depend on accidentally uploading gitignored local files.

Use EAS file environment variables for the development environment and dynamic Expo app configuration so the build runner receives file paths at build time while local development can fall back to the existing ignored files.

Recommended variable names:

- `GOOGLE_SERVICES_JSON`
- `GOOGLE_SERVICE_INFO_PLIST`

The Expo config should resolve approximately as follows:

- Android `googleServicesFile`: EAS file-variable path when present, otherwise local `./google-services.json`.
- iOS `googleServicesFile`: EAS file-variable path when present, otherwise local `./GoogleService-Info.plist`.

Do not print file contents into logs or source control.

## EAS build profiles

Create `mobile/eas.json` with simple profiles. Avoid unnecessary machine/toolchain pins.

Required behavior:

- `development`: `developmentClient: true`, internal distribution, development EAS environment.
- `ios-simulator`: extends `development` and sets `ios.simulator: true`.
- `preview`: internal distribution for later stakeholder testing.
- `production`: reserved for future store release.

Android development builds must produce an installable development APK through the development-client/internal-distribution profile.

Do not configure automatic native builds on every push during Phase 11A.

## CI

Add a focused GitHub Actions workflow for mobile checks. Use a CI-scoped Node 22.x environment rather than changing the user's machine-wide Node default.

On relevant mobile/config changes, CI should run at minimum:

1. `npm ci`
2. `npx expo install --check`
3. `npx tsc --noEmit`
4. `npx expo-doctor`

CI must not run `npm audit fix`, mutate lockfiles, commit generated code, or invoke paid/native EAS builds automatically.

## Platform proof sequence

### Gate A — repository/config health

Pass when:

- dependency graph is restored to the intended Expo SDK generation,
- EAS config is committed,
- Firebase cloud-file configuration is wired without committing the real files,
- mobile CI passes,
- generated native directories remain untracked.

### Gate B — iOS Simulator cloud build

Run an EAS iOS build using the `ios-simulator` profile.

Pass when:

- EAS cloud compilation succeeds,
- the produced simulator app installs/launches on an available iOS Simulator,
- the existing collector app shell renders.

Do not troubleshoot local CocoaPods/Xcode compilation unless the EAS build evidence proves a source/native-config defect that requires it.

### Gate C — Android cloud build

Run an EAS Android build using the `development` profile.

Pass when:

- EAS cloud compilation succeeds,
- the APK installs/launches on an emulator/device,
- the same collector app shell renders.

### Gate D — Firebase runtime proof

Pass when both platforms can initialize Firebase and a synthetic collector account can:

- sign in with Firebase Email/Password,
- reach the signed-in collector shell,
- sign out cleanly.

Do not store the synthetic account password in Git, issue comments, logs, analytics, or documentation.

## Not in Phase 11A

Do not use this milestone to implement or redesign:

- site catalog behavior,
- draft persistence,
- measurement forms beyond existing UI scaffolding,
- correction revisions,
- Workflow Manager integration,
- Phase 10 validation semantics,
- ArcGIS publication,
- production app-store signing/distribution.

Those follow after the platform proof.

## Required SITREP

At completion or a human gate, report:

### Objective
What Gate A/B/C/D was attempted.

### Changes
Files/configuration changed and why.

### Verification
Exact checks/builds that actually ran and their results.

### Git
Branch, commit(s), push/CI state, and whether the working tree is clean.

### External services
EAS project/build status and Firebase runtime status without exposing secrets.

### Blockers
Only genuine unresolved blockers or required human authentication/actions.

### Next
Exactly one recommended next gate/action.
