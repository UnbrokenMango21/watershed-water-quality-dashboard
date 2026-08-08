# Phase 11 — Mobile Field App

**Status:** implementation starting  
**Primary target:** Central Pennsylvania freshwater stream/creek field collection  
**Backend:** Firebase project `central-pa-watershed-dev`

## Stack

- Expo / React Native / TypeScript
- Expo development build rather than Expo Go for the final Firebase-native path
- React Native Firebase native SDKs
  - App
  - Authentication
  - Cloud Firestore
  - Analytics
- Expo Location for GPS capture
- Expo Router for a small screen flow

The native Firebase path is deliberate: Firestore provides offline persistence/synchronization on iOS and Android, while Firebase Analytics requires a native Firebase integration in an Expo app. Expo development builds allow those native modules while preserving the managed Expo development workflow.

## Collector flow

1. Sign in
2. View existing submissions/status
3. Start new observation
4. Select site
5. Capture collection date/time and GPS
6. Select Test Type
7. Enter method and instrument/lab source
8. Enter water temperature in C or F; derive the counterpart immediately
9. Enter required core measurements for the active Test Type
10. Optionally add other measurements
11. Add notes/attachments when applicable
12. Review
13. Save/submit
14. Show local/sync/server state clearly
15. If `NEEDS_CORRECTION`, create a new revision rather than overwriting submitted science

## Sync states

The UI must distinguish:

- Saved locally
- Syncing
- Synced
- Submission failed — retry

A local Firestore write is not described to the collector as server-accepted until the client has synchronized with the backend.

## Firebase document behavior

### New observation

Create one stable `submissions/{submissionId}` envelope and one `revisions/{revisionId}` document. Measurements are records under the revision.

The collector can transition only:

- `DRAFT -> SUBMITTED`
- `NEEDS_CORRECTION -> RESUBMITTED`

### Correction

A correction preserves:

- `submission_id`
- `event_id`
- prior submitted revision(s)

and creates a new `revision_id` with an incremented revision number.

The previous scientific revision is never silently edited.

## Required v1 field behavior

For new in-situ stream observations:

- authenticated collector identity
- site
- collection date/time
- GPS latitude/longitude
- GPS accuracy
- Test Type
- method
- instrument/lab source
- water temperature
- pH
- dissolved oxygen concentration
- conductivity

The exact requirements are driven by the repository validation configuration rather than duplicated as ad-hoc UI logic.

Optional parameters must not create artificial Data Quality / Confidence Score advantages.

## Temperature UX

1. Collector chooses `°F` or `°C`.
2. Collector enters one value.
3. App immediately calculates the counterpart:
   - `C = (F - 32) * 5 / 9`
   - `F = C * 9 / 5 + 32`
4. Display at two decimals.
5. Preserve entered value/unit and both derived values in the revision.

## GPS UX

GPS is captured automatically where permission is available. Show reported accuracy to the collector and encourage a better fix when accuracy is poor. The app does not convert an unusual location into an automatic scientific rejection; the Phase 10 validator handles location confidence and warnings.

## Analytics privacy contract

Firebase Analytics is product/UX telemetry only.

Never send as Analytics event parameters or user properties:

- scientific measurements
- exact GPS coordinates
- site-specific private information
- landowner/property information
- field notes
- collector/reviewer email addresses
- reviewer comments
- authentication tokens/secrets

Allowed examples are coarse product events such as screen viewed, draft created, submission attempted, sync succeeded/failed, or correction flow opened, provided no scientific/private payload is attached.

## Phase 10 validation handoff

The mobile app writes collector-owned data only. Validation, confidence scoring, anomaly scoring, validation flags, review fields, and publication fields remain server-owned.

The tested Phase 10 orchestrator accepts `SUBMITTED` or `RESUBMITTED`, moves the submission through `VALIDATING`, and produces either:

- `PENDING_REVIEW` when no blocking ERROR exists; or
- `NEEDS_CORRECTION` when blocking ERRORs exist.

Cloud deployment of that trigger is a separate infrastructure step because Firebase requires a billing-enabled project to deploy Cloud Functions. The mobile implementation can proceed independently against the dev Firestore schema.
