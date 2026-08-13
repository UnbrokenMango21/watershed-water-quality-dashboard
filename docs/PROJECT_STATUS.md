# PA Watershed Watch — Project Status

_Last updated: 2026-08-13_

This page is the quick operational snapshot for the repository. It is intentionally concise; detailed evidence lives in the linked phase/audit documents.

## Executive status

| Domain | Status | Notes |
| --- | --- | --- |
| Platform architecture | ✅ Complete | system boundaries and provenance rules established |
| Data dictionary / contracts | ✅ Complete with known contract repairs underway | Phase 10 remains the scientific/runtime authority |
| ArcGIS schema / staging | ✅ Complete | authoritative publication remains downstream |
| Firebase schema / Firestore rules | ✅ Complete baseline | native production integration in progress |
| Automated validation | ✅ Complete baseline | trigger/readback production wiring in progress |
| iOS frontend | ✅ Approved | native SwiftUI |
| Android frontend | ✅ Approved | native Jetpack Compose |
| Native production data layer | 🚧 In progress | Codex integration branch |
| Secure media storage | 🚧 In progress | Storage contract + client integration |
| Minimal QC reviewer page | 🧭 Planned next | deliberately small, 1–2 reviewer use case |
| Publishing service | 🧭 Planned next | approved revision → verified ArcGIS write |
| Public/research dashboard | 🧭 Planned | ArcGIS-approved data only |
| Field pilot | 🧭 Planned | TestFlight + Play Internal Testing |

## Active branch model

| Branch | Meaning |
| --- | --- |
| `main` | Phase 1–10 stable baseline |
| `codex/android-native-v1` | completed Android frontend checkpoint |
| `codex/mobile-production-integration-v1` | active native iOS/Android + backend integration target |
| `docs/project-roadmap-2026-08-13` | current roadmap/architecture/documentation cleanup |
| `sync/phase11-local-2026-08-13` | recovery snapshot of local Phase 11 work |
| `archive/*` | historical only |

Do not treat the old Expo/React Native `mobile/` tree as the current product architecture. It remains useful implementation evidence for Firebase and synchronization behavior.

## Current engineering gate

The next major milestone is not “more features.” It is a fully proven production mobile lifecycle:

```mermaid
flowchart LR
    A[Collect offline] --> B[Persist through restart]
    B --> C[Sync exactly once]
    C --> D[Validate]
    D --> E[Correction if needed]
    E --> F[Human review]
    F --> G[Publish exactly once]
    G --> H[ArcGIS authoritative record]
```

Before merging the production integration work, independently inspect:

- SwiftData and Room persistence/migrations;
- stable ID creation and retry behavior;
- Firebase Auth / account isolation;
- Firestore write/read mappings;
- Storage rules and media lifecycle;
- App Check and environment configuration;
- `America/New_York` collection-time behavior;
- validation trigger/readback;
- immutable revision behavior;
- cross-platform golden serialization fixtures;
- release/debug native builds.

## Known strategic decisions

- Native SwiftUI + native Jetpack Compose are the approved mobile direction.
- Firebase staging is private pre-publication state.
- ArcGIS is authoritative only after human approval + verified publication.
- Workflow Manager Online is optional because of current licensing uncertainty.
- Preferred human-review fallback is a minimal authenticated QC page, not a large operations console.
- Public/research dashboards must read approved ArcGIS data, never raw staging data.
- Unusual measurements and GPS anomalies are flagged for review rather than silently deleted.
- Submitted scientific records are immutable; corrections create revisions.

## Next after Codex integration

1. Independent implementation audit.
2. Reliability/provenance hardening: environments, compatibility, checksums, fingerprints, trusted clock handling, site catalog versioning, multi-device policy, diagnostics.
3. Minimal reviewer page.
4. Idempotent publishing service.
5. ArcGIS verification.
6. Dashboard integration.
7. Controlled real-user pilot.
8. v1.0 release gate.

See [`PROJECT_ROADMAP.md`](PROJECT_ROADMAP.md) for the complete plan and [`SYSTEM_FLOW_AND_FAILURES.md`](SYSTEM_FLOW_AND_FAILURES.md) for failure handling.
