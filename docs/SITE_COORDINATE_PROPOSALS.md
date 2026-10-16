# Private monitoring-site coordinate proposals

**COMPLETE & VERIFIED** — Server-domain and Auth/Firestore-emulator checks pass for proposing and reviewing coordinate corrections and new sites. This is a private catalog workflow; it does not publish scientific observations or modify ArcGIS resources.

**IMPLEMENTED — AWAITING VERIFICATION** — Native and QC screen integration, deployed callable/rule verification and an actual authorized supervisor review still need their separate workflow evidence.

A verified collector with an active server-owned profile calls `proposeSiteCoordinates`. The client supplies a stable UUID to make offline retries idempotent. A proposal records submitting UID/name snapshot, proposed coordinates, original authoritative coordinates, GPS accuracy or explicit unknown, reason and server timestamps. For an existing site, the server captures its current coordinate version and exact catalog-update timestamp. Original and proposed coordinates remain separate and immutable after creation.

The private record is `siteCoordinateProposals/{proposalId}`. Only its submitting user and authorized reviewers may read it. All direct client writes are denied. Audit records live beneath the same proposal and have the same read boundary. Collector clients cannot update `siteCatalog`.

`decideSiteCoordinates` accepts approval or rejection, with a required reason. It checks the current enabled, verified Auth identity and matching active reviewer/admin profile, including the authorization-version fence. The proposer cannot review their own proposal. The decision, authoritative catalog change and audit record commit in a single Firestore transaction. Repeating an identical decision by the same reviewer is idempotent; a different reviewer or changed decision is a conflict.

A correction approval requires that the current original coordinates, coordinate version and catalog timestamp still match the proposal snapshot. Any catalog change requires a fresh proposal; stale approval leaves no partial decision or catalog mutation. Rejection preserves the catalog. Corrections increment `coordinate_version` without rewriting submitted scientific revisions or historical coordinates.

New sites receive a stable server-assigned site ID. A reviewer must explicitly choose the approved site name, site code and positive site tolerance; no scientific tolerance is guessed. Approval creates a mobile-safe site record with `publication_approved: false`. County and watershed remain unknown until authoritative geographic reconciliation. Approving a site or coordinate proposal does not approve or publish an observation.

The callable request contracts are:

```ts
proposeSiteCoordinates({
  proposalId: string, // UUID generated once and reused for retries
  kind: 'NEW_SITE' | 'COORDINATE_CORRECTION',
  siteId?: string, // existing site only
  latitude: number,
  longitude: number,
  gpsAccuracyM?: number | null,
  reason: string,
  proposedSiteName?: string // new site only
})

decideSiteCoordinates({
  proposalId: string,
  status: 'APPROVED' | 'REJECTED',
  reason: string,
  siteName?: string, // required only when approving a new site
  siteCode?: string,
  siteToleranceM?: number
})
```

The emulator suite covers private payload injection, invalid coordinates, account verification, collector approval attempts, immutable original snapshots, idempotency, rejection, stale catalog changes, concurrent conflicting decisions, new-site metadata/publication gates, mismatched authorization versions and self-review. Run it against Auth and Firestore emulators:

```sh
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
node --test tests/profile/coordinate_proposals.test.mjs
```

Without both emulator hosts, the integration workflow is explicitly skipped and only pure input/authentication tests run. These checks never target live data.
