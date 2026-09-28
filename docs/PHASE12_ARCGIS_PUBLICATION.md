# Phase 12 — Approved ArcGIS Publication and Public Dashboard Foundation

## Current-state audit (2026-09-13)

The active transactional path is native mobile collection → Firestore immutable revisions → trusted validation → `PENDING_REVIEW` → authenticated QC Console review. Review approval is revision-aware and leaves the approved revision unchanged. The root Firestore schema already reserves `APPROVED`, `PUBLISHING`, `PUBLISH_FAILED`, and `PUBLISHED`, but `functions/index.mjs` previously contained only the submitted/resubmitted validation trigger.

ArcGIS is not a blank slate. The repository already contains a mature ArcGIS Pro geodatabase model with `SamplingSites`, `SamplingEvents`, `Measurements`, `ValidationFlags`, and `AuditEvents`, GlobalID/relationship hardening, and an ArcGIS Online private QC staging service:

- item: `b7775c1bdada4aa8b0787714eca3eb15`
- title: `Central_PA_Watershed_QC_Staging`
- purpose: private staging/QC, not public approved publication
- service IDs: sites 10, events 20, measurements 30, flags 40, audit 50

That item is preserved. Phase 12 creates a separate approved-authoritative GIS service rather than changing the staging service in place.

The active `web/` application remains the private Firebase App Hosting QC console and redirects to `/review`. The separate `public-dashboard/` application is now active production code: it is deployed independently, reads only the verified public ArcGIS views, and intentionally renders an empty/unavailable monitoring state until approved public records exist.

The authenticated inventory found the historical layer: 117 records across 5 distinct site IDs, with date-only 2025 measurements and no recorded approval/provenance policy. It remains excluded from the approved-authoritative service and public dashboard.

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

`config/arcgis_publication_schema.json` is the versioned GIS contract. `config/publication_contract.json` is the server-only Firestore publication job/lease/idempotency contract.

`SamplingSites` is one mutable public-safe feature per official site. `ApprovedObservations` is one immutable point feature per approved revision and uses the approved revision's actual collection geometry. It carries typed public scientific fields plus private trace fields and a SHA-256 record hash. `Measurements` is the normalized parameter table and includes one canonical `WATER_TEMP_C` row derived from the already-stored revision temperature. `LatestSiteConditions` is a materialized one-row-per-site view derived from the newest approved observation and approved sample count; it is never the historical record. ArcGIS assigned the final authoritative IDs by returned dataset name: sites 0, observations 1, latest 2, measurements 3; all four hosted public views expose physical layer 0.

Each dataset's `keyField` is provisioned with a unique ArcGIS attribute index. The unique constraint is a database-level last line of defense against duplicate site, approved-revision, measurement-publication-key, and latest-site rows; the publisher still performs read-before-write idempotency and immutable hash verification.

Scientific values are never silently recomputed by the publisher. Canonical Firestore values and units are published as stored.

## Privacy boundary

The approved-authoritative service `b5c738cc413f4f44b213885b8500c10d` remains private. Separate read-only hosted views are created for sites `a969e961c152463080b410e040879ca6`, observations `4609ca6693ef42afbf52f0f95c42f5ed`, measurements `1094591a993449b59031e9eab25d934a`, and latest conditions `a84f9c8ea7ef4f1898cf2ffe190f02d5`, each exposing only fields marked `public: true` in the schema. All four views passed the independent anonymous verifier and currently contain zero records.

Public views exclude collector account IDs, source submission/revision/event IDs, reviewer data, review comments, field notes, GPS accuracy, distance-to-site diagnostics, entered-value provenance, validator internals, and record hashes. Public `quality_score` / `quality_context` describe data confidence and validation context, not environmental impairment or regulatory compliance.

The read-only verifier fails if a protected field appears in a public view or if a public view exposes create/update/delete/edit capabilities.

## Publisher behavior

`publication/orchestrator.mjs` and `publication/arcgisRest.mjs` implement an idempotent approved-only publisher. It triggers only on a transition into `APPROVED`; requires `review_decision == APPROVE`; requires `reviewed_revision_id == current_revision_id == approved revision`; requires immutable `revision_status == SUBMITTED`; claims `PUBLISHING`; serializes per-site publication with an expiring Firestore lease; upserts the site; creates the approved observation only if `source_revision_id` is absent; verifies immutable hashes on retry; inserts only missing measurement rows; recomputes latest-site state; then marks `PUBLISHED` and appends a deterministic publication audit record.

Because Firestore triggers are at-least-once, the revision publication job also carries an expiring lease token. A duplicate delivery cannot claim the same revision while that lease is active. Expired leases are recoverable, and final success/failure writes are fenced by the token so a stale invocation cannot overwrite a newer attempt. The site-level lease uses the same token and blocks concurrent latest-site materialization even for duplicate deliveries of the same revision.

Failures become `PUBLISH_FAILED` with attempt/error metadata and a failure audit event. The Firebase trigger has retry enabled. ArcGIS network/429/5xx/token-expiry errors are retryable; permanent schema/auth/immutability conflicts stop automatic retry after being recorded. `scripts/retry_arcgis_publication.mjs` provides an explicit server-side requeue after remediation and only for the same current reviewed-and-approved revision. Each requeue is keyed by the failed attempt number so it appends a new immutable audit event and refuses to overwrite a prior requeue record.

## ArcGIS authentication

Use an ArcGIS OAuth application credential with `client_credentials`, scoped only to the approved-authoritative item and granted required feature-edit privileges. Firebase Functions secrets are `ARCGIS_OAUTH_CLIENT_ID` and `ARCGIS_OAUTH_CLIENT_SECRET`. Non-secret deploy parameters are `ENABLE_ARCGIS_PUBLICATION_FUNCTION`, `ARCGIS_PUBLICATION_FEATURE_SERVICE_URL`, and `ARCGIS_PORTAL_URL=https://www.arcgis.com`.

`ENABLE_ARCGIS_PUBLICATION_FUNCTION` defaults to `false`. The development project's tracked, non-secret `.env.central-pa-watershed-dev` makes that disabled setting explicit and gives the Firebase CLI the values it requires for repeatable, non-interactive deploys. The publisher and its OAuth secret parameters are registered only when the enable flag is true and `ARCGIS_PUBLICATION_FEATURE_SERVICE_URL` is non-empty. The endpoint also retains its parameterized `omit` gate. This matters because the Firebase CLI resolves every declared secret before applying an endpoint-specific `--only` filter; leaving the publisher disabled must not prevent a validation-only redeploy. The disabled configuration exposes no publisher endpoint and requires no ArcGIS OAuth secret.

Never commit OAuth secrets, user passwords, long-lived tokens, Firebase private keys, or App Store credentials.

## One-time ArcGIS Pro / ArcGIS Online provisioning

Run from ArcGIS Pro's Python environment while signed in:

```bash
python scripts/provision_arcgis_publication.py
```

The script refuses to overwrite an existing service and never edits private QC staging item `b7775c1bdada4aa8b0787714eca3eb15`. It creates the four-dataset authoritative service, unique indexes on every publication key, four field-restricted read-only public hosted views, and prints the resulting non-secret item IDs/URLs.

Before enabling the Firebase publisher:

```bash
python scripts/verify_arcgis_publication.py <authoritative_item_id>
```

The read-only verifier checks required fields, unique key indexes, confirms Delete is not enabled on the authoritative service, checks record counts, verifies the public views query, verifies public views expose no edit capabilities, and fails if a protected field is exposed.

## Deployment gate

Do not enable `publishApprovedObservation` until the new ArcGIS service and views pass verification; the OAuth app is item-restricted; Firebase secrets are set; `ARCGIS_PUBLICATION_FEATURE_SERVICE_URL` points to the new approved-authoritative service and never the QC staging item; CI is green; and a controlled approved observation is explicitly selected for first live publication.

Activation requires setting `ENABLE_ARCGIS_PUBLICATION_FUNCTION=true` together with the verified FeatureServer URL. With the default `false`, the publisher endpoint is omitted and cannot react to approvals.

TEST-014 must not be altered, backfilled, approved, or published merely to prove the publisher. It is controlled test data and is ineligible to serve as the final scientific publication proof. The first live end-to-end publication proof must use a provenance-cleared, non-test observation approved by an authorized human reviewer.

## Dashboard architecture decision

The implemented architecture uses the hybrid/custom option: ArcGIS Online is the GIS publication/analysis backend; the public product is a custom responsive Next.js dashboard using the ArcGIS Maps SDK for JavaScript and server-side ArcGIS queries. This preserves the current web engineering stack while allowing stronger site-driven interaction, scientific time-series, responsive composition, accessibility, and future researcher-mode exports than a default ArcGIS Dashboard layout. ArcGIS Pro remains the workbench for cartography, spatial enrichment, geometry QA, duplicate checks, and reproducible analysis. Core publication logic stays outside Arcade/Experience Builder.

Experience Builder can remain an optional outreach wrapper, not a source of business/scientific publication logic.

Production does not use placeholder JSON or silently fall back to demo monitoring data. The deployed frontend binds to the verified public hosted views; local demo mode remains explicit and isolated for visual/interaction testing.

## Legacy 117-site migration gate

The historical 117-record/5-site dataset is excluded because its provenance does not establish publication approval, collector/privacy handling, or canonical parameter lineage. Keep the inventory evidence private and do not migrate it until those decisions are documented.

## Test coverage

`npm run test:publication` verifies approved WGS84 mapping, canonical values/units, rejected/unapproved exclusion, stale-revision rejection, UTC timestamp preservation, sequential retry idempotency, immutable-history conflict detection, latest-site selection with retained history, approval-trigger filtering, duplicate-delivery lease fencing, and expired-lease recovery. Live integration gates require the actual new ArcGIS item/OAuth credential: first controlled publication, ArcGIS readback, public-view readback, then dashboard selection/time-series integration tests.
