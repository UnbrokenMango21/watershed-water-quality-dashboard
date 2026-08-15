# Documentation

This directory contains the current authoritative project documentation. Historical audits, remediation logs, superseded Expo/EAS material and Workflow Manager-as-required design documents live in Git history rather than the active tree.

## Start here

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — current native/Firebase/QC/ArcGIS trust architecture and lifecycle.
- [`ROADMAP.md`](ROADMAP.md) — current Phase 11 release-lock gates and the approved-only ArcGIS publisher next phase.
- [`DATA_DICTIONARY.md`](DATA_DICTIONARY.md) — scientific/workflow field definitions and provenance.
- [`QUALITY_SCORE.md`](QUALITY_SCORE.md) — quality-score semantics.
- [`QC_CONSOLE_RUNBOOK.md`](QC_CONSOLE_RUNBOOK.md) — operating the trusted reviewer surface.
- [`DEFERRED_MEDIA_FEATURE.md`](DEFERRED_MEDIA_FEATURE.md) — explicit decision to keep photo/audio/media out of the current release.

## Source-of-truth contracts

Machine-readable contracts in `../config/` and executable tests in `../tests/` take precedence over prose when implementation details conflict. Security Rules in `../firebase/` and trusted backend code in `../functions/`/`../validation/` are the authorization and validation boundary.

## Release evidence

`PHASE11_RELEASE_LOCK.md` is intentionally created only after the real internal-TestFlight and live Firebase/QC lifecycle succeeds. It must record exact non-secret IDs, Git SHA, CI run and build evidence without credentials.

## Historical material

Use Git history/tags for old phase logs, remediation branches, Expo/EAS experiments, superseded screenshots and Workflow Manager design work. Those records are intentionally not presented as current status.
