# AGENTS.md

## Mission

This repository implements the Central PA Watershed Monitoring Platform:

Field App -> Firebase staging -> automated validation -> ArcGIS Workflow Manager supervisor QC -> approved ArcGIS authoritative layers -> public dashboard.

The system prioritizes scientific provenance, offline field reliability, explicit review state, privacy, and a simple collector experience.

## Repository boundary

Treat `watershed-water-quality-dashboard/` as the only writable project boundary unless a task explicitly says otherwise.

Do not modify sibling/local ArcGIS Pro installations, ArcGIS project artifacts, user home configuration, Xcode installation files, simulator internals, or other machine-wide state as part of ordinary application work.

Before changing files, inspect the current branch and `git status`. Preserve unrelated user changes.

## Data ownership and invariants

- Firebase owns unapproved/staging submissions and workflow state.
- ArcGIS owns approved authoritative sampling sites/observations and public-safe views.
- GitHub owns source code, schemas, validation rules, docs, tests, issues, and releases.
- Preserve original submitted science. Corrections create a new revision; they do not silently overwrite a submitted revision.
- `event_id` remains the stable scientific event key across correction revisions.
- The collector client may write collector-owned draft/submission data only.
- Validation results, quality/confidence scores, anomaly results, review fields, publication fields, and server workflow fields remain server-owned.
- A blocking validation ERROR prevents review/publication regardless of quality score.
- Quality/confidence scoring describes data confidence, not water-body health.
- Landowner/private names and other private property information must never become public.

## Current roadmap position

Phases 1-10 are established. Phase 11 is the active implementation phase: the cross-platform collector mobile app.

Phase 8 Workflow Manager implementation is externally blocked by Penn State organization privileges. Do not spend Phase 11 time troubleshooting that organization-side permission unless the task explicitly returns to Phase 8.

## Phase 11 product contract

Build one field application for iOS and Android using the existing Expo / React Native / TypeScript codebase and existing design system.

Required behavior includes:

- Email/password collector authentication.
- Site catalog loading.
- New observation/draft workflow.
- Automatic GPS capture plus reported accuracy.
- Collection date/time.
- Test type plus required method/instrument or lab provenance.
- Core and optional scientific measurements driven by repository configuration/contracts rather than duplicated ad-hoc rules.
- Temperature unit selected first, with the counterpart derived immediately while preserving the entered value/unit.
- Offline-first draft behavior and clear states: Saved locally, Syncing, Synced, Submission failed/retry.
- `DRAFT -> SUBMITTED` and `NEEDS_CORRECTION -> RESUBMITTED` collector transitions only.
- Correction revisions rather than mutation of submitted science.
- Privacy-safe product analytics only.
- Accessibility and outdoor field usability.

Preserve the existing production UI/design work unless a concrete defect or requirement justifies a change. Do not replace the design system with a large UI framework or restart the app from a blank scaffold without explicit approval.

## Phase 11 development architecture

The preferred development path is cloud-native compilation rather than using the developer Mac as the normal native build server:

- Expo development builds, not Expo Go, for the React Native Firebase path.
- EAS Build for normal iOS and Android native compilation.
- iOS Simulator development build for routine iOS development before paid App Store/device distribution is required.
- Android development build/emulator for Android parity.
- Local Metro/Expo server for normal JavaScript/TypeScript/UI iteration after a compatible development client exists.
- Firebase project `central-pa-watershed-dev` for Phase 11 development data/auth.
- GitHub Actions/CI for static checks and existing automated tests.
- Generated `mobile/ios` and `mobile/android` directories remain untracked unless the architecture is intentionally changed and documented.

Do not reintroduce local CocoaPods/Xcode/Gradle troubleshooting as the default workflow when EAS can perform the native build.

Local Xcode 27 / iOS 27 SDK builds are currently not a supported Phase 11 iOS path for Expo SDK 57. A physical-device crash report confirmed UIKit terminating the process at launch because the generated native app does not yet adopt the required UIScene lifecycle. Do not patch generated native files, Pods, Expo framework sources, or `node_modules` to force scene adoption. Use the pinned EAS `sdk-57` iOS image and follow `docs/PHASE11_IOS27_TOOLCHAIN_NOTE.md` until the upstream Expo / React Native scene-lifecycle implementation is available and verified.

Do not pin or change the user's machine-wide Node default as part of project setup. If a reproducible Node version is required for CI/EAS, scope it to the CI/EAS configuration or document the compatibility requirement rather than changing unrelated projects on the machine.

## Dependency rules

- Never run `npm audit fix --force`.
- Do not perform broad dependency upgrades to clear audit warnings.
- Prefer Expo-compatible dependency resolution (`npx expo install`, `npx expo install --check`) for Expo/React Native packages.
- Treat npm audit findings separately from framework compatibility.
- Review package and lockfile diffs before accepting dependency changes.
- Do not downgrade Expo/React Native or mix SDK generations to satisfy an automated audit suggestion.

## Firebase and secrets

- Never commit passwords, API tokens, service-account keys, PATs, signing credentials, or other secrets.
- Keep the real `mobile/GoogleService-Info.plist` and `mobile/google-services.json` out of Git if repository ignore rules require that.
- Firebase client configuration is not permission to expose private project data; Firestore Security Rules remain the authorization boundary.
- Do not weaken Firestore rules merely to make the mobile app work.

Analytics must never contain:

- scientific measurement values,
- exact GPS coordinates,
- landowner/private property information,
- field notes,
- collector/reviewer email addresses,
- reviewer identities/comments,
- authentication tokens or secrets.

Allowed analytics should remain coarse product/UX telemetry without scientific/private payloads.

## Validation and schema boundaries

Phase 9 Firebase schema and Phase 10 validation behavior are upstream contracts for the mobile app. Adapt the client to those contracts; do not redesign them casually from Phase 11.

When a mobile change appears to require changing server schema, validation semantics, quality scoring, security rules, or ArcGIS contracts, stop and report the proposed cross-phase change before implementing it.

## Working method

For each task:

1. Read this file plus the relevant docs/issues before editing.
2. Inspect `git status`, branch, and relevant diffs.
3. Make the smallest coherent change that advances the task.
4. Preserve unrelated local work.
5. Run the relevant existing checks/tests.
6. Review the diff for secrets, privacy violations, generated native files, schema drift, and accidental dependency churn.
7. Commit only verified coherent changes with descriptive messages. Never force-push or rewrite shared history.
8. Push only when the task authorizes it or the workflow clearly requires a remote build/CI run.

Do not claim a command/test/build succeeded unless it actually ran successfully in the current task environment.

## Mobile verification baseline

When mobile dependencies are installed and the command is applicable, prefer these lightweight checks before requesting a native build:

- `npx expo install --check`
- `npx tsc --noEmit`
- `npx expo-doctor`

Use the existing repository test suites relevant to the files changed. Do not alter test expectations merely to obtain a green result.

## Phase 11A immediate objective

Establish a reproducible platform proof before adding more field functionality:

1. Reconcile the repository after the abandoned local-native-build experiment without deleting UI/design/product work.
2. Configure clean EAS development-build profiles for iOS Simulator and Android development.
3. Keep native directories generated/untracked.
4. Produce a successful cloud native build for each platform when credentials/quota permit.
5. Launch the development client and confirm the existing app shell loads.
6. Confirm Firebase initializes and perform a real Email/Password sign-in/sign-out test using a synthetic dev collector account.
7. Only after that platform proof, proceed to site catalog -> offline draft -> observation vertical slice.

Do not jump into broader feature work until the platform proof is stable.

## Definition of done for an agent task

At task completion, provide a concise SITREP containing:

- Objective
- Changes made
- Verification actually run and results
- Git state/commit(s)
- Blockers or required human actions
- Recommended next step

A task is not complete when known relevant checks are failing, secrets/private data are exposed, generated native projects are accidentally tracked, or required manual actions are hidden from the report.
