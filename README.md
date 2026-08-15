# PA Watershed Watch

Native watershed field collection, Firebase validation and trusted QC, approved ArcGIS publication, and public water-quality visualization.

![CI](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/actions/workflows/mobile-ci.yml/badge.svg?branch=main)
![Phase](https://img.shields.io/badge/phase-11%20release%20candidate-blue)
![TestFlight](https://img.shields.io/badge/TestFlight-next-lightgrey)

## Current product flow

```mermaid
flowchart LR
  A[Native iOS / Android collection] --> B[Durable local data]
  B --> C[Firebase Authentication]
  C --> D[Private Firestore staging]
  D --> E[Trusted automated validation]
  E --> F[PENDING_REVIEW]
  F --> G[Trusted QC Console]
  G -->|Approve| H[Approved-only ArcGIS publisher]
  G -->|Request correction| I[Immutable revision N+1]
  I --> D
  G -->|Reject| J[Rejected]
  H --> K[ArcGIS authoritative / public-safe views]
  K --> L[Public & research dashboard]
```

Firebase/Firestore is the private pre-publication scientific workflow system. The QC Console is the authoritative human review surface. ArcGIS Workflow Manager is not a release dependency. The retired Expo/React Native client is preserved in Git history, not in the active tree.

## Current state

Status vocabulary: **LIVE** means operating in a connected environment; **VERIFIED** means implemented and covered by current automated verification; **NEXT** is the active release sequence; **DEFERRED** is intentionally excluded.

| Component | Status | Current reality |
| --- | --- | --- |
| Native iOS / SwiftUI | VERIFIED | Shipping architecture; Firebase Auth/Firestore, durable local records, GPS, revisions, App Attest in Release |
| Native Android / Jetpack Compose | VERIFIED | Native collector kept healthy by unit, lint, build and emulator instrumentation CI |
| Firebase Authentication | VERIFIED | Native and QC authentication integration present |
| Firestore private staging | VERIFIED | Security Rules and persistence contracts are emulator-tested |
| Automated validation | VERIFIED | Engine, persistence and trigger integration are tested; live development trigger proof is the next release gate |
| Trusted QC Console | VERIFIED | Authenticated reviewer UI and review lifecycle tests are green |
| ArcGIS private staging | VERIFIED | Existing ArcGIS schema/staging foundation remains; it is not the human QC system |
| Approved-only ArcGIS publisher | NEXT | Next engineering phase after TestFlight/live lifecycle proof |
| Public/research dashboard | NEXT | Consumes approved public-safe ArcGIS views after publisher completion |
| iOS TestFlight | NEXT | Internal distribution and physical-device lifecycle proof |
| Photo/audio/media capture | DEFERRED | Zero scientific attachments in the current production candidate |

## Repository map

- `Phone App/iPhone App/PAWatershedWatch` — native SwiftUI iPhone application.
- `Phone App/Android App` — native Jetpack Compose Android application.
- `web` — authenticated trusted QC Console.
- `functions` — Firebase Cloud Function entry points.
- `firebase` — Firestore/Storage rules and indexes.
- `validation` — trusted validation engine, orchestration and persistence.
- `config` — scientific/workflow contracts and catalogs.
- `tests` — contract, rules, validation and review lifecycle tests.
- `scripts` — controlled environment/bootstrap utilities.
- `docs` — current authoritative technical documentation.

## Scientific principles

- Submitted scientific revisions are immutable.
- Entered value and entered unit provenance are preserved alongside canonical values.
- Validation, workflow, review and publication state are server-owned.
- An unusual measurement is not automatically invalid science.
- Human approval is required before publication.
- Corrections create a new immutable revision rather than mutating old submitted science.
- Private collector/reviewer fields must never enter public ArcGIS views.
- Water Temperature is the only currently confirmed mandatory science measurement for the first release.
- Media capture/upload is deliberately deferred.

## Current development target

Finish the Phase 11 release lock by proving the development iPhone → Firebase → live validation → QC Console roundtrip through internal TestFlight. After that, build the **approved-only ArcGIS publisher** as a trusted, server-side, idempotent publication boundary.

## Developing

Backend/contracts:

```bash
npm ci
npm run test:contracts
```

QC Console:

```bash
cd web
npm ci
npm run typecheck
npm run build
```

Android and iOS are verified in `.github/workflows/mobile-ci.yml`; platform-specific setup is documented beside each native project. Do not commit credentials, private keys, local build state, DerivedData, Gradle outputs or App Store Connect keys.

## Documentation

Start with [`docs/README.md`](docs/README.md). Architecture, roadmap, scientific contracts, QC operations and deferred-feature decisions are indexed there.
