# Documentation

This directory contains the current authoritative project documentation. Historical audits, remediation logs, superseded Expo/EAS material and Workflow Manager-as-required design documents live in Git history rather than the active tree.

## Start here

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — current native/Firebase/QC/ArcGIS trust architecture and lifecycle.
- [`ROADMAP.md`](ROADMAP.md) — current pre-release closure gates for the implemented Phase 11/12 system.
- [`semester/WORK_RECORD.md`](semester/WORK_RECORD.md) — supervisor-ready semester work record with weekly hours, plain-language comments and evidence.
- [`DATA_DICTIONARY.md`](DATA_DICTIONARY.md) — scientific/workflow field definitions and provenance.
- [`QUALITY_SCORE.md`](QUALITY_SCORE.md) — quality-score semantics.
- [`QC_CONSOLE_RUNBOOK.md`](QC_CONSOLE_RUNBOOK.md) — operating the trusted reviewer surface.
- [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) — shared brand tokens, status grammar and how each surface consumes them.
- [`DEFERRED_MEDIA_FEATURE.md`](DEFERRED_MEDIA_FEATURE.md) — explicit decision to keep photo/audio/media out of the current release.

## Source-of-truth contracts

Machine-readable contracts in `../config/` and executable tests in `../tests/` take precedence over prose when implementation details conflict. Security Rules in `../firebase/` and trusted backend code in `../functions/`/`../validation/` are the authorization and validation boundary.

## Release evidence

`PHASE11_RELEASE_LOCK.md` and `PHASE12_ARCGIS_PUBLICATION.md` record the current non-secret release and publication evidence. They must not contain credentials or imply that gated human/scientific steps are complete before they actually occur.

## Historical material

Use Git history/tags for old phase logs, remediation branches, Expo/EAS experiments, superseded screenshots and Workflow Manager design work. Those records are intentionally not presented as current status.
