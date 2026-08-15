# PA Watershed Watch Roadmap

Updated: 2026-08-15

## Current: Phase 11 release lock

The native mobile + trusted QC implementation is the current product. Repository consolidation and CI are prerequisites, not a new architecture phase.

Remaining release-lock gates:

1. Consolidate the green authoritative lineage into `main` and remove obsolete active branches/material.
2. Keep complete CI green on `main`.
3. Verify the real `validateSubmittedObservation` trigger in `central-pa-watershed-dev` and prove a real submission reaches `PENDING_REVIEW` or the appropriate correction state.
4. Produce a signed iOS Release archive, upload it to App Store Connect and wait for successful processing.
5. Enable internal TestFlight and install the build on the project iPhone.
6. Prove iPhone → Firebase Auth → Firestore → live validation → QC Console.
7. Approve one controlled development observation and verify audit/reviewer/timestamp/revision invariants.
8. Exercise Request Correction and revision N+1 when practical.
9. Record exact non-secret evidence in `PHASE11_RELEASE_LOCK.md` and tag the tested release candidate.

## Next: approved-only ArcGIS publisher

Build a trusted server-side publisher from an APPROVED immutable Firebase revision to private ArcGIS staging, then verify/read back publication state.

Required properties:

- server-side only;
- stable submission/event/revision identity;
- idempotent retries;
- only APPROVED revisions may publish;
- PENDING_REVIEW, NEEDS_CORRECTION and REJECTED may not publish;
- no mobile ArcGIS credentials;
- ArcGIS failure cannot silently mark publication success;
- public-safe views exclude private collector/reviewer data.

## Then: public/research dashboard

Consume only approved, public-safe ArcGIS views. Add researcher-oriented analytical capabilities after the publication boundary is proven.

## Deferred

- Photo capture.
- Audio recording.
- Firebase Storage scientific attachment uploads.
- Camera/microphone permissions.
- Additional mandatory science measurements beyond Water Temperature.
- ArcGIS Workflow Manager as a required QC system.
- Public App Store release (internal TestFlight comes first).
