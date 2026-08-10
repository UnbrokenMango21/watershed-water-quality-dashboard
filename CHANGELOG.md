# Changelog

All notable changes to the Watershed Monitoring Platform will be documented here.

## [Unreleased]

### Added
- End-to-end platform architecture and ownership boundaries between Firebase, Workflow Manager, ArcGIS, and GitHub.
- Formal data dictionary, parameter catalog, workflow state machine, validation configuration, and versioned contracts.
- ArcGIS Pro geodatabase prototype with sites, events, measurements, validation flags, audit events, domains, relationships, global IDs, and editor tracking.
- Private ArcGIS Online QC staging service for sites, events, measurements, flags, and audit records.
- Workflow Manager Phase 8 review/approval design; implementation awaits the required Penn State organization privilege/item.
- Firebase development project, production-oriented Firestore schema, ownership/security rules, revision model, audit boundaries, and emulator coverage.
- Phase 10 automated validation, persistence, Firestore orchestration, confidence scoring, anomaly handling, and regression coverage.
- Phase 11 Expo/React Native collector for iOS and Android with Firebase Email/Password authentication and native Firestore offline support.
- Mobile-safe site catalog, five-step field observation workflow, GPS/accuracy capture, method/instrument provenance, required and optional measurements, entered-unit-first temperature handling, field notes, review, local drafts, sync status, recent submissions, and immutable revision history.
- Collector correction/resubmission workflow for `NEEDS_CORRECTION -> RESUBMITTED` without overwriting prior scientific revisions.
- Creekline Field System design language, project-owned watershed brand assets, light/dark themes, outdoor-readable controls, and accessibility semantics.
- Privacy-safe coarse Firebase Analytics with CI guards, iOS no-Ad-ID support, blocked Android advertising ID permission, and disabled automatic native screen reporting.
- Mobile CI for repository hygiene, Phase 9/10 contract drift, Expo dependency compatibility, TypeScript, lint, privacy, iOS/Android JavaScript bundles, and Expo Doctor.
- EAS development, iOS Simulator, preview, and production build profiles with remote developer-facing version management.

### Changed
- Collector user-facing version aligned to the v0.1 development cycle (`0.1.0`).
- Collector deep-link scheme changed from the Expo-template `mobile` scheme to `centralpawatershed`.
- Mobile numeric handling now accepts standard decimal/scientific notation only and rejects permissive JavaScript-only numeric forms before Firestore serialization.
- Submission detail can present the server-owned overall data-confidence result while explicitly distinguishing confidence from water health.

### Security and privacy
- Landowner/private access information remains outside the collector-safe site catalog and public-data path.
- Collectors cannot write validation, confidence/quality, review, or publication fields.
- Submitted scientific revisions remain immutable; corrections create new revisions.
- Firebase client configuration files and generated native projects remain untracked.

## [0.1.0] - Foundation

### In progress
- Complete Phase 11 release-candidate native runtime verification.
- Implement Workflow Manager item when Penn State organization privileges are available.
- Continue Phases 12–16: workflow integration, authoritative ArcGIS publication, dashboard, end-to-end testing, and v1.0 release.
