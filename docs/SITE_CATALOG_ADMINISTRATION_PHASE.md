# Site Catalog Administration — Next Phase (Design Only)

**Status:** Not implemented. This document exists so the collector-proposed-site workflow
(items 8–9 of the mobile UX/data-quality follow-on requirements) is fully specified and
ready to build, without forcing site administration into the locked QC Trusted Web
review slice (`/review`, `review/reviewSubmission.mjs`, the reviewer Firestore rules).
Mixing site-catalog governance into that surface would expand its authorization surface
and blast radius right after it was locked down and tested — this phase is deliberately
sequenced to come after, as its own reviewed change.

## Why this is out of scope for the current phase

The current QC Trusted Web phase implements exactly one thing: scientific submission
review (Approve / Request Correction / Reject) by `QC_REVIEWER`/`ADMIN`, with a
revision-aware, atomic, audited, idempotent server-side action and a minimal reviewer
UI. `siteCatalog` today is already correctly modeled as reference data (`firebase/firestore.rules`:
`match /siteCatalog/{siteId} { allow read: if signedIn(); allow write: if false; }`) —
every current site document is written by trusted server tooling
(`scripts/seed_test_sites.mjs` in dev), never by a client. Adding collector-initiated
site proposals means adding a **new** privileged write path, a **new** approval
authority, and a **new** admin surface — each of those is a real, separate piece of
work with its own security review, not a checkbox to bolt onto `/review`.

## Proposed schema

New top-level collection, `siteProposals/{proposalId}`:

| Field | Type | Notes |
|---|---|---|
| `proposal_id` | string | Document ID |
| `proposed_name` | string | Collector-entered site name |
| `latitude` / `longitude` | number | Collector-captured or manually entered coordinates |
| `location` | GeoPoint | Derived from lat/long |
| `proposed_by_user_id` | string | Collector's Firebase Auth uid |
| `created_at` | Timestamp | Trusted server timestamp (`request.time`, same pattern as `submitted_at` — see `firebase/firestore.rules`) |
| `notes` | string\|null | Collector's reason/context for the proposal |
| `status` | `PENDING_APPROVAL \| APPROVED \| REJECTED` | |
| `reviewed_by_user_id` | string\|null | Server-owned, set on decision |
| `reviewed_at` | Timestamp\|null | Server-owned, trusted server timestamp |
| `review_comment` | string\|null | Server-owned |
| `resulting_site_id` | string\|null | Set only on `APPROVED`, points at the new `siteCatalog/{site_id}` document created by the same server transaction |
| `duplicate_of_site_id` | string\|null | Server-owned; set by the approval reviewer if this proposal turns out to duplicate an existing catalog site instead of becoming a new one — approving as a duplicate should link the existing site, not create a second one |

`siteCatalog/{siteId}` gains one field to preserve provenance once a site originated
from a proposal:

| Field | Type | Notes |
|---|---|---|
| `origin_proposal_id` | string\|null | Links back to `siteProposals/{proposalId}` when the site was created via this workflow; `null` for sites seeded directly (current behavior) |

## Authorization model

- `COLLECTOR`: may `create` a `siteProposals/{id}` document for themselves
  (`proposed_by_user_id == uid()`), with `status` forced to `PENDING_APPROVAL` and every
  server-owned field forced absent/null at creation — mirrors the existing
  `validCollectorRevisionCreate()` pattern in `firebase/firestore.rules`. Collectors may
  `read` only their own proposals. Collectors can never transition `status` themselves
  (no client-side approve/reject path), matching how submissions can never reach
  `APPROVED`/`REJECTED` via a client write today.
- `QC_REVIEWER`/`ADMIN`: may `read` all proposals (same `isReviewer()`/`isAdmin()`
  pattern already in the rules file). Only `ADMIN` may **decide** a proposal
  (approve/reject) — reviewers approving *scientific submissions* is a distinct
  authority from approving *new sites entering the trusted catalog*, so this phase
  should not silently grant `QC_REVIEWER` that power without an explicit product
  decision; default to `ADMIN`-only until stated otherwise.
- The actual `siteCatalog` write on approval remains server-only via Application
  Default Credentials, exactly like `review/reviewSubmission.mjs` — never exposed to
  browser code. A new sibling module, e.g. `site-catalog/decideSiteProposal.mjs`,
  should reuse the same shape: one Firestore transaction that (a) validates the
  proposal is still `PENDING_APPROVAL` (revision/version-aware, race-safe — same
  optimistic-concurrency pattern as `applyReviewDecision`), (b) on approval, creates
  the new `siteCatalog/{site_id}` doc **and** patches the proposal to `APPROVED` with
  `resulting_site_id` in the same transaction, (c) on rejection, patches the proposal
  to `REJECTED` with a required reason, (d) writes one audit event either way, (e) is
  idempotent under retry the same way review decisions already are.

## UI route

`/review/sites` (or a distinct `/admin/sites` route if the product decision above
lands on admin-only — the route should not live under a path an unprivileged
`QC_REVIEWER` bearer token could reach if reviewers end up excluded from this
authority). Two views, mirroring the existing review queue/detail split:

- **Queue**: list `siteProposals` where `status == 'PENDING_APPROVAL'`, showing
  proposed name, coordinates (rendered on a simple map or as lat/long text — no new
  mapping dependency is required for a first cut), proposer, submitted-at age, and any
  nearby existing catalog sites (a naive proximity check against `siteCatalog` using
  the same `site_tolerance_m`/haversine approach already implemented in
  `validation/engine.mjs`'s `haversineMeters` — reuse it, don't reimplement) to help
  the admin spot likely duplicates before approving.
- **Detail/decision**: full proposal detail, the same three-action pattern as
  submission review (Approve / Reject / "Approve as duplicate of existing site X"),
  each with the same reason-required-for-rejection contract already established for
  submission review.
- A second, simpler view over the **existing authoritative catalog** — list
  `siteCatalog`, allow toggling `active`/`inactive` (an authorized, audited server
  write; never a raw client `update`), and show `origin_proposal_id` provenance.

## Synchronization to mobile clients

No new sync mechanism is needed: mobile clients already read `siteCatalog` live via
the Firestore client SDK (`FirebaseSiteRepository`/`FirebaseMobileService.fetchSites()`
per the current native app implementations), filtered to `active == true`. Once a
proposal is approved and the new `siteCatalog` document is written server-side, it
becomes visible to every mobile client through the exact same read path already in
production — no additional plumbing required on the mobile side. The only mobile-side
work this phase would add is the **proposal submission form** itself (a new, small
screen: name, map-pin/manual coordinates, notes, submit — writing directly to
`siteProposals` under the collector-create rule above) and a "My proposals" status list
so a collector can see what happened to something they proposed.

## Required tests (when this phase is implemented)

- Firestore rules emulator tests: collector can create only their own proposal with
  forced `PENDING_APPROVAL` status and no server-owned fields; collector cannot
  read another collector's proposal; collector cannot write `status`/`reviewed_*`/
  `resulting_site_id`; non-admin (or non-reviewer, depending on the authorization
  decision above) cannot decide a proposal; `siteCatalog` remains server-write-only.
- `site-catalog/decideSiteProposal.mjs` unit/emulator tests mirroring
  `tests/review/review_action.test.mjs`: approve creates exactly one new `siteCatalog`
  doc plus one audit event; reject requires a reason and creates no site; a stale
  decision (proposal already decided) returns a conflict; a repeated identical decision
  is idempotent; concurrent conflicting decisions on the same proposal resolve to
  exactly one winner (same race-safety proof already written for submission review).
  Include a "approve as duplicate" case that links `duplicate_of_site_id` instead of
  creating a second `siteCatalog` document for the same real-world location.
  Also test the duplicate-warning surfaced to the admin at decision time — that it
  fires for a proposal near an existing site (within `site_tolerance_m` or a
  configurable proposal-review radius) and does not fire for genuinely new locations.
- Mobile: a unit test that a proposal submission round-trips through the domain
  model into the correct `siteProposals` document shape.
- Web: the same TypeScript-check/`next build` verification pattern already used for
  `/review`.
