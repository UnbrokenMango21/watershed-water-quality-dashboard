# Changelog

All notable changes to the Watershed Monitoring Platform are documented here.

## [Unreleased]

### Current direction

- Native SwiftUI is the approved iOS product implementation.
- Native Jetpack Compose is the approved Android product implementation.
- The historical Expo/React Native `mobile/` tree remains engineering reference only and is not the current presentation architecture.
- Production integration is proceeding on `codex/mobile-production-integration-v1` against the locked Phase 1–10 Firebase/security/validation foundation.
- ArcGIS Workflow Manager Online is optional; licensing uncertainty must not block the scientific lifecycle.
- Preferred human-review path for the expected one-or-two reviewer population is a minimal authenticated QC page backed by trusted server actions.

### Added

- End-to-end platform architecture and ownership boundaries between native mobile clients, Firebase staging, validation, human QC, publishing, ArcGIS, and GitHub.
- Formal data dictionary, parameter catalog, workflow state machine, validation configuration, quality/confidence configuration, and versioned contracts.
- ArcGIS Pro geodatabase prototype with sites, events, measurements, validation flags, audit events, domains, relationships, GlobalIDs, and editor tracking.
- Private ArcGIS Online staging foundation and verified GIS schema.
- Workflow Manager Phase 8 design retained as an optional future adapter if ArcGIS Online licensing becomes available.
- Firebase development project, Firestore schema, ownership/security rules, immutable revision model, audit boundaries, and emulator coverage.
- Phase 10 automated validation engine, persistence, Firestore orchestration, confidence scoring, anomaly handling, and regression coverage.
- Approved production-quality iOS SwiftUI frontend under `Phone App/iPhone App/PAWatershedWatch`.
- Approved native Android Jetpack Compose frontend under `Phone App/Android App`.
- Native Android frontend validation for workflow, measurements, permissions, GPS, correction presentation, accessibility, and build/test behavior.
- Current production-integration master plan for native authentication, durable local persistence, Firestore mapping, Storage/media, idempotent synchronization, server validation trigger/readback, correction revisions, and cross-platform contract fixtures.
- Project roadmap documenting environment separation, schema/app compatibility, scientific provenance hardening, duplicate fingerprints, attachment checksums, trusted clock handling, advisory spatial flags, site-catalog versioning, multi-device policy, privacy-safe diagnostics, pilot testing, minimal QC, and publishing.
- Node-by-node happy-path/failure-path architecture covering local drafts, authentication, sites, GPS, media, Firestore, validation, review, correction, publishing, and dashboard behavior.
- Development workflow defining green-checkpoint pushes from Codex to GitHub for continuous independent review.

### Changed

- Product direction moved from the reset-era Expo/React Native presentation layer to approved native SwiftUI + Jetpack Compose applications.
- Human review no longer depends on Workflow Manager Online; Firebase remains the canonical private staging/workflow system and Workflow Manager can be integrated later as an adapter.
- The project roadmap now prioritizes production mobile integration, independent implementation audit, reliability/provenance hardening, minimal QC, verified ArcGIS publishing, dashboard integration, and controlled pilot testing.
- Public/research dashboard architecture explicitly reads approved ArcGIS data only rather than raw Firebase staging records.
- GPS/spatial and unusual measurement behavior is explicitly advisory/flag-oriented rather than automatic scientific deletion.
- Submitted science and corrections are explicitly modeled as immutable revisions throughout the planned native integration.

### Security and privacy

- Landowner/private access information remains outside collector-safe and public data paths.
- Collectors cannot write validation, confidence/quality, review, audit, or publication fields.
- Mobile apps never contain ArcGIS publishing credentials and never publish directly to ArcGIS.
- Reviewer actions are intended to execute through trusted backend authorization/state checks rather than arbitrary browser-side workflow mutation.
- Account-scoped durable local state and cross-user Firestore isolation remain release requirements.
- Diagnostics are intentionally limited to sanitized operational metadata and exclude scientific values, coordinates, notes, credentials, and private site details.

### Reliability / provenance requirements in progress

- Stable `submission_id`, `event_id`, `revision_id`, measurement IDs, attachment IDs, and deterministic publication identity.
- Offline-first durable iOS/Android persistence and retry-safe synchronization.
- Server-backed sync acknowledgement rather than simulated success.
- Explicit `America/New_York` collection-time behavior with DST coverage.
- Secure Firebase Storage rules and real durable media files.
- Attachment SHA-256 integrity metadata.
- Observation duplicate fingerprinting as an advisory signal.
- Site-catalog version/staleness preservation.
- Environment separation for Development, Staging/Pilot, and Production.
- Schema/app/validation-rule compatibility handling.
- Cross-platform golden serialization fixtures.

## [0.1.0] — Foundation

Phases 1–10 established the platform architecture, formal scientific data model, ArcGIS schema/staging foundation, Firebase staging/security model, and automated validation engine.

Phase 11 is the transition from approved native mobile frontends to production-connected iOS and Android clients.
