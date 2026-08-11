# Phase 11 iOS 27 toolchain note

## Root cause confirmed from physical-device crash report

A local physical-device build produced with Xcode 27 / the iOS 27 SDK compiles and installs, but terminates immediately at launch with `EXC_BREAKPOINT` / `SIGTRAP` on the main thread inside UIKit's `___UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption_block_invoke`.

This is not a Firebase, authentication, Expo Router, JavaScript, or Creekline UI crash. UIKit is stopping the process before the React Native application reaches normal startup.

Apple requires apps built with the iOS 27 SDK to adopt the UIKit scene-based lifecycle. The current Expo SDK 57 / React Native 0.86 prebuild path still emits the legacy application lifecycle, and Expo has an accepted upstream issue tracking the same Xcode 27 launch failure. A separate Expo SDK 57 report shows that manually adding scene lifecycle configuration is not yet a safe project-local workaround because React Native root-view attachment can fail under that manually patched lifecycle.

## Supported Phase 11 iOS build path

Until the upstream Expo / React Native scene-lifecycle implementation is available and verified:

- Do not use local Xcode 27 builds as the authoritative Phase 11 iOS runtime path.
- Do not patch generated `mobile/ios` files, Expo framework sources, Pods, or `node_modules` to force UIScene adoption.
- Keep generated native directories untracked.
- Use EAS Build with the Expo SDK 57 image. `mobile/eas.json` explicitly pins all iOS profiles to `image: "sdk-57"` so the build environment does not drift to Xcode 27.
- As of 2026-08-11, Expo documents `sdk-57` as `macos-tahoe-26.5-xcode-26.6` (Xcode 26.6), which does not trigger the iOS-27-SDK scene-lifecycle launch assertion.
- Continue normal UI/TypeScript development through GitHub/CI and an installed compatible development client when available.

## Physical-device evidence

Observed on a registered iPhone 15 running iOS 27.0 beta:

- native compilation: succeeded
- code signing: succeeded
- installation: succeeded
- process launch: succeeded briefly
- process termination: signal 5 (`SIGTRAP`)
- crash exception: `EXC_BREAKPOINT`
- faulting UIKit frame: `___UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption_block_invoke`

The crash occurs before normal app initialization, so changing Firebase setup or JavaScript application code cannot fix this specific failure.

## Release-candidate gate

Phase 11 iOS native verification remains valid only when the candidate is built using a supported Expo SDK 57 iOS build image and then installed/launched successfully on a target device or simulator.

Revisit this note when Expo / React Native ships and documents a UIScene-compatible template/runtime for Xcode 27. At that point, remove the temporary build-image pin only after a clean native build, launch, auth, offline-draft, and submission regression pass succeeds.
