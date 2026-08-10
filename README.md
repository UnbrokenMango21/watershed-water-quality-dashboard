# Watershed Monitoring Platform

A watershed data platform for field collection, automated validation, supervisor QC, authoritative ArcGIS publication, and public/research dashboards.

## Product flow

Field App → Firebase Staging → Automated Validation → ArcGIS Workflow Manager Review → Publishing Service → ArcGIS Authoritative Data → Dashboard & Analytics

Correction requests loop back to Firebase staging as a new collector revision; submitted scientific values are not silently overwritten.

## Data ownership

- **Firebase:** unapproved/staging submissions, immutable collector revisions, validation state, and workflow state
- **ArcGIS:** approved authoritative sampling sites and observations
- **GitHub:** source code, schemas, validation rules, documentation, changelog, issues, and releases

## Development roadmap

1. Architecture + mind map — complete
2. GitHub repository — complete
3. GitHub documentation / CHANGELOG / Issues / Projects — complete
4. Formal data dictionary — complete
5. ArcGIS Pro geodatabase prototype — complete
6. ArcGIS domains + relationships + IDs — complete
7. Publish clean ArcGIS Online staging environment — complete
8. Design Workflow Manager — design complete; Penn State organization privilege required for item creation
9. Create Firebase project and production schema — complete
10. Build validation engine — complete
11. Build mobile app — **in progress**
12. Connect Firebase → Workflow Manager
13. Connect approval → ArcGIS publication
14. Build dashboard
15. End-to-end testing
16. v1.0 release

## Core principles

- Preserve original field submissions.
- Record who changed what, when, and why.
- Version schemas, validation rules, and applications.
- Flag unusual measurements without automatically treating them as invalid.
- Treat quality scores as data-confidence signals, not water-health grades.
- Publish only data that has been approved and successfully written to ArcGIS.
- Keep sampling sites separate from time-stamped observations.
- Make all important state transitions auditable.
- Never expose landowner/private access information in the collector-safe catalog or public views.

## Current phase

**v0.1 — Phase 11 mobile collector**

The active Phase 11 work delivers the Expo/React Native iOS and Android collector, Firebase Email/Password authentication, mobile-safe site catalog, offline-first drafts, GPS and provenance capture, configured water-quality measurements, immutable submission revisions, correction/resubmission, validation feedback, and privacy-safe product telemetry.

Phase 11 remains open until the release-candidate native builds and remaining iOS/Android runtime, offline, and accessibility gates are complete. See `docs/PHASE11_EXECUTION_LOG.md` and `docs/PHASE11_FLOW_MATRIX.md` for evidence and remaining checks.
