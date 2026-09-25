# PA Watershed Watch Roadmap

Updated: 2026-09-25

The [finish and publish checklist](../project-control/RELEASE_GATES.md) is the release gate record. The [weekly plan and work log](../project-control/SEMESTER_WORK_LOG.md) organizes the 300-hour semester target separately from verified time worked.

## Current: pre-release closure

The end-to-end architecture is implemented: native collection → private Firebase workflow → trusted validation → QC review → approved-only ArcGIS publication → public-safe views → public dashboard. Current work is release verification and controlled activation, not another architecture rewrite.

Remaining pre-release gates:

1. Keep the integration line and all CI workflows green.
2. Confirm TestFlight Build 13 on the physical project iPhone.
3. Complete the provisioned real reviewer account's password setup/login and preserve private review evidence.
4. Perform the final controlled human review/readback without treating TEST-014 as publishable monitoring science.
5. Create an ArcGIS OAuth application credential scoped only to the approved-authoritative item and store its client credentials as Firebase Functions secrets.
6. Enable the approved-only publisher only after the OAuth scope, service URL, privacy verifier and CI are rechecked.
7. Use a provenance-cleared, non-test observation for the first live publication; verify authoritative ArcGIS write/readback and idempotent retry behavior.
8. Verify the resulting record through all four anonymous public-safe views and the production dashboard.
9. Consolidate the verified release/integration lineage into `main` and tag the tested release.

## Implemented and gated: approved-only ArcGIS publication

The server-side publisher, immutable/idempotent publication contract, private approved-authoritative service, and four public-safe read-only views are implemented and verified. Live publication stays disabled until item-scoped OAuth credentials and a deliberately selected non-test record are ready.

## Implemented and empty: public/research dashboard

The responsive Next.js dashboard is implemented and deployed against the verified public-safe ArcGIS views. Production intentionally shows no monitoring observations while those views contain zero approved records. Demo monitoring data is local-only and is never a production fallback.

## Deferred

- Photo capture.
- Audio recording.
- Firebase Storage scientific attachment uploads.
- Camera/microphone permissions.
- Additional mandatory science measurements beyond Water Temperature.
- ArcGIS Workflow Manager as a required QC system.
- Historical 117-record/5-site migration until provenance is documented.
- Public App Store release until internal TestFlight and release-lock evidence are complete.
