# Portfolio summary

Use these descriptions with the [metric ledger](PROJECT_METRICS.md). They describe the system at tested PR #42 source `b9580c9` and merged integration `1da94e0` on 2026-09-28. Draft PR #44 is pending on that base; claims remain provisional until its resulting integration SHA is checked. The iOS release and first non-test scientific publication remain pending. No institutional endorsement, public monitoring result, or completed semester-hour total is implied.

## 50 words

PA Watershed Watch connects field collection to a private scientific review workflow and an ArcGIS-backed public dashboard. Submitted readings keep immutable revisions and original units. Trusted validation and human approval guard publication; restricted public views protect identities and workflow details. The iOS candidate remains under review, with live publication pending.

## 100 words

PA Watershed Watch is a watershed monitoring platform built around the boundary between field records and public evidence. A native SwiftUI app collects readings into private Firebase records; trusted services validate submissions, and an authenticated QC Console supports revision-aware human decisions. Approved revisions are eligible for server-side ArcGIS publication through a private authoritative service and restricted public views. A dashboard reads those views without access to collector identities or review notes. Submitted science remains immutable, corrections create new revisions, and entered units survive normalization. The iOS release candidate is still under review; first non-test publication requires authorized review and readback.

## 250 words

PA Watershed Watch is a research engineering project for accountable watershed observations. Its native SwiftUI iPhone app supports field entry and durable local records. Firebase Authentication and private Firestore store submitted scientific revisions. Trusted server code validates the submitted record; collectors cannot assign validation outcomes, review decisions, audit events, or publication status. An authenticated web QC Console lets an authorized reviewer approve, request correction, or reject the current revision.

A submitted revision is immutable. When a collector corrects a reading, the system creates a revision and retains the earlier one. The record also preserves entered and canonical values and units. Water Temperature is the only confirmed mandatory science measurement. Validation warnings support human judgment; they do not silently rewrite a reading or declare an environmental condition.

Publication is a separate trusted step after approval. A server-side publisher is designed to write only the current approved revision into a private ArcGIS authoritative service. Restricted, query-only public views expose approved scientific fields to the dashboard while withholding identities, internal site labels, notes, and workflow identifiers. Demo data is visibly labeled and cannot replace production data when public views are empty.

The architecture, contracts, and interface have automated verification, but the release is still gated. The iOS candidate awaits final review and device evidence. A provenance-cleared, non-test observation, authorized human decision, scoped ArcGIS credential, schema check, and publication readback are needed before claiming a live scientific result. Android implementation remains in the repository; its release work follows the iOS submission and publication milestone.

## Resume bullets

- Built a native SwiftUI field collection workflow backed by Firebase Authentication, private Firestore revisions, and trusted validation, preserving entered and canonical measurement values.
- Implemented revision-aware human QC and an approved-only ArcGIS publication boundary with restricted public views and fail-closed schema checks.
- Developed a responsive public dashboard with explicit demo and empty states; documented exact-source CI evidence and separated software verification from live scientific publication.

## LinkedIn draft

I’m developing PA Watershed Watch, a watershed field-data system that links a native iPhone app to private validation and human QC, then to controlled ArcGIS publication and a public dashboard. The design preserves submitted revisions and original units, and keeps reviewer identities and workflow details out of public views. PR #42 source `b9580c9` merged into integration as `1da94e0`; PR #34 checks passed there. Draft PR #44 is pending, so those checks are not final release evidence. Physical-device review, live reviewer access, and the first provenance-cleared non-test publication remain open. Android release work follows the iOS submission and publication milestone. Project architecture and evidence: [repository README](../README.md).

## Technical explanation

The collector writes a revision to private Firestore under Security Rules. Server-owned validation and workflow code advances it to review. Reviewer actions are authenticated, revision-aware, and audited; the UI does not become the source of scientific values. Approval marks a revision eligible for a separate server-side publication job. That job uses idempotent keys and readback against a private ArcGIS authoritative service, then exposes a constrained field set through query-only public views. The Next.js dashboard reads those views anonymously. The public schema verifier fails if fields exceed the allowlist or edit capabilities appear. See [architecture](ARCHITECTURE.md), [publication contract](PHASE12_ARCGIS_PUBLICATION.md), and [metric limits](PROJECT_METRICS.md).

## Research explanation

The system treats a field observation as a record with provenance, not simply a chart point. Original entries, units, submission history, validation flags, review decisions, and publication outcomes have distinct roles. Corrections add a revision instead of erasing what was submitted. A warning invites human examination without silently changing science. Only a current human-approved revision can enter publication, and the public dashboard receives only fields cleared for anonymous use. This supports traceability, but it does not itself establish data quality, environmental impairment, or regulatory compliance. A non-test observation with known provenance and complete readback is still needed for the first public scientific claim.

## Suggested GitHub settings for coordinator review

Current remote description (read 2026-09-28): “Public-facing watershed water quality dashboard (ArcGIS-backed) with dynamic parameter charts, site map linking, and a future researcher-only mode.” The remote has no topics or homepage set. Suggested description: **“Native watershed field collection, private scientific QC, approved-only ArcGIS publication, and a public-safe dashboard.”** Suggested topics: `water-quality`, `watershed`, `swiftui`, `jetpack-compose`, `firebase`, `arcgis`, `nextjs`, `data-provenance`. Use [the proposed social preview](images/portfolio/social-preview.png) after visual review. These are suggestions only; no remote settings were changed.
