# Phase 12 — Approved ArcGIS Publication and Public Dashboard Foundation

## Current-state audit (2026-08-16)

The active transactional path is native mobile collection → Firestore immutable revisions → trusted validation → `PENDING_REVIEW` → authenticated QC Console review. Review approval is revision-aware and leaves the approved revision unchanged. The root Firestore schema already reserves `APPROVED`, `PUBLISHING`, `PUBLISH_FAILED`, and `PUBLISHED`, but `functions/index.mjs` previously contained only the submitted/resubmitted validation trigger.

ArcGIS is not a blank slate. The repository already contains a mature ArcGIS Pro geodatabase model with `SamplingSites`, `SamplingEvents`, `Measurements`, `ValidationFlags`, and `AuditEvents`, GlobalID/relationship hardening, and an ArcGIS Online private QC staging service:

- item: `b7775c1bdada4aa8b0787714eca3eb15`
- title: `Central_PA_Watershed_QC_Staging`
- purpose: private staging/QC, not public approved publication
- service IDs: sites 10, events 20, measurements 30, flags 40, audit 50

That item is preserved. Phase 12 creates a separate approved-authoritative GIS service rather than changing the staging service in place.

The active `web/` application is the Firebase App Hosting QC console. Its root redirects to `/review`; the earlier public dashboard implementation exists only as closed historical PR #1 and is not active production code.

No current repository reference identifies the legacy screenshot's 117-site ArcGIS item/service. Do not destroy or migrate that legacy dataset until its authenticated ArcGIS item inventory, schema, duplicate profile, geometry quality, and time range are captured.

## Target responsibility split

```text
Native field apps
  -> Firestore submissions + immutable revisions
  -> trusted validation
  -> QC Console
  -> APPROVED immutable revision
  -> publishApprovedObservation (Firebase v2 trigger)
  -> private approved-authoritative ArcGIS feature service
       0 SamplingSites
       1 ApprovedObservations
       2 Measurements
       3 LatestSiteConditions
  -> public read-only hosted feature layer views
  -> custom public dashboard / ArcGIS web map
```

Firestore remains authoritative for operational workflow, revision history, validation/review identity, and audit. ArcGIS becomes authoritative for approved geospatial publication and analysis. The public dashboard is read-only and consumes only approved public views.

## ArcGIS data model

`config/arcgis_publication_schema.json` is the versioned contract.

`SamplingSites` is one mutable public-safe feature per official site. `ApprovedObservations` is one immutable point feature per approved revision and uses the approved revision's actual collection geometry. It carries a wide set of typed scientific fields for fast map/popup use plus internal trace IDs and a SHA-256 record hash. `Measurements` is the normalized parameter table and includes one canonical `WATER_TEMP_C` row derived from the already-stored revision temperature. `LatestSiteConditions` is a materialized one-row-per-site view derived from the newest approved observation and approved sample count; it is never the historical record.

Scientific values are never silently recomputed by the publisher. Canonical Firestore values and units are published as stored.

## Privacy boundary

The approved-authoritative service remains private. Separate read-only hosted views are created for sites, observations, measurements, and latest conditions, each exposing only fields marked `public: true` in the schema.

Public views exclude collector account IDs, source submission/revision/event IDs, reviewer data, review comments, field notes, GPS accuracy, distance-to-site diagnostics, entered-value provenance, validator internals, and record hashes. Public `quality_score` / `quality_context` describe data confidence and validation context, not environmental impairment or regulatory compliance.

## Publisher behavior

`publication/orchestrator.mjs` and `publication/arcgisRest.mjs` implement an idempotent approved-only publisher. It triggers only on a transition into `APPROVED`; requires `review_decision == APPROVE`; requires `reviewed_revision_id == current_revision_id == approved revision`; requires immutable `revision_status == SUBMITTED`; claims `PUBLISHING`; serializes per-site publication with an expiring Firestore lease; upserts the site; creates the approved observation only if `source_revision_id` is absent; verifies immutable hashes on retry; inserts only missing measurement rows; recomputes latest-site state; then marks `PUBLISHED` and appends a deterministic publication audit record.

Failures become `PUBLISH_FAILED` with attempt/error metadata and a failure audit event. The Firebase trigger has retry enabled. ArcGIS network/429/5xx/token-expiry errors are retryable; permanent schema/auth/immutability conflicts stop automatic retry after being recorded. `scripts/retry_arcgis_publication.mjs` provides an explicit server-side requeue after remediation and only for the same current reviewed-and-approved revision.

## ArcGIS authentication

Use an ArcGIS OAuth application credential with `client_credentials`, scoped only to the approved-authoritative item and granted required feature-edit privileges. Firebase Functions secrets are `ARCGIS_OAUTH_CLIENT_ID` and `ARCGIS_OAUTH_CLIENT_SECRET`. Non-secret deploy parameters are `ARCGIS_PUBLICATION_FEATURE_SERVICE_URL` and `ARCGIS_PORTAL_URL=https://www.arcgis.com`.

Never commit OAuth secrets, user passwords, long-lived tokens, Firebase private keys, or App Store credentials.

## One-time ArcGIS Pro / ArcGIS Online provisioning

Run from ArcGIS Pro's Python environment while signed in:

```bash
python scripts/provision_arcgis_publication.py
```

The script refuses to overwrite an existing service and never edits private QC staging item `b7775c1bdada4aa8b0787714eca3eb15`. It creates the four-dataset authoritative service, four field-restricted read-only public hosted views, and prints the resulting non-secret item IDs/URLs.

Before enabling the Firebase publisher:

```bash
python scripts/verify_arcgis_publication.py <authoritative_item_id>
```

The read-only verifier checks required fields, confirms Delete is not enabled, counts datasets, verifies the public views query, and fails if a protected field is exposed.

## Deployment gate

Do not deploy `publishApprovedObservation` until the new ArcGIS service and views pass verification; the OAuth app is item-restricted; Firebase secrets are set; `ARCGIS_PUBLICATION_FEATURE_SERVICE_URL` points to the new approved-authoritative service and never the QC staging item; CI is green; and a controlled approved observation is explicitly selected for first live publication.

TEST-014 must not be altered or backfilled merely to prove the publisher. Use its existing immutable data only if/when it is deliberately approved as the controlled publication candidate.

## Dashboard architecture decision

Use the hybrid/custom option: ArcGIS Online is the GIS publication/analysis backend; the public product should be a custom responsive Next.js dashboard using the ArcGIS Maps SDK for JavaScript and server-side ArcGIS queries. This preserves the current web engineering stack while allowing stronger site-driven interaction, scientific time-series, responsive composition, accessibility, and future researcher-mode exports than a default ArcGIS Dashboard layout. ArcGIS Pro remains the workbench for cartography, spatial enrichment, geometry QA, duplicate checks, and reproducible analysis. Core publication logic stays outside Arcade/Experience Builder.

Experience Builder can remain an optional outreach wrapper, not a source of business/scientific publication logic.

## Legacy 117-site migration gate

The old 117-site dataset remains unresolved because its ArcGIS item ID is not in the active repository and no authenticated ArcGIS inventory connector is available in this session. Once authenticated inventory is available: snapshot/export first; classify site vs observation records; profile duplicates; validate geometry; establish time range/timezone; screen private names/notes; map legacy parameter aliases without silent conversions; stage migration in a separate geodatabase; reconcile official site IDs; and publish only after historical provenance/approval policy is explicit. Never delete or overwrite the legacy item as part of this migration.

## Test coverage

`npm run test:publication` verifies approved WGS84 mapping, canonical values/units, rejected/unapproved exclusion, stale-revision rejection, UTC timestamp preservation, retry idempotency, immutable-history conflict detection, latest-site selection with retained history, and approval-trigger filtering. Live integration gates require the actual new ArcGIS item/OAuth credential: first controlled publication, ArcGIS readback, public-view readback, then dashboard selection/time-series integration tests.
