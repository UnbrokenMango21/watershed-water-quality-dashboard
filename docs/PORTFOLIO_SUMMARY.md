# Portfolio summary

Reusable descriptions of PA Watershed Watch. Every statement is backed by the repository, CI or release records listed in the [metric ledger](PROJECT_METRICS.md). Replace the bracketed placeholder with the lab or supervisor name you want to show; the repository does not record it.

Do not add users, adoption, environmental findings, institutional endorsement or completed-hour totals. None of these is established. The 300-hour figure is a semester planning target.

## Short pitch

I built PA Watershed Watch, a water-quality monitoring system for a Penn State watershed research program. Field readings are collected in a native iPhone app, validated on the server and reviewed by a person before they can appear on a public ArcGIS map. The design keeps every submitted revision and its provenance, so a reading on the public dashboard can be traced back to what was originally recorded.

## LinkedIn project description

**PA Watershed Watch**, Penn State watershed research program [lab or supervisor]

A system for collecting, reviewing and publishing stream water-quality readings in Central Pennsylvania. I built the native SwiftUI iPhone app, the Firebase backend (security rules, validation functions, private Firestore records), a Next.js review console where a scientist approves, rejects or requests corrections, and a public ArcGIS dashboard that reads only anonymous, schema-checked views. Submitted readings are immutable: a correction becomes a new revision and the original is kept. The iOS app is in TestFlight testing; the full pipeline runs under automated tests on every pull request.

## Experience bullets (LinkedIn)

- Built a native SwiftUI field-collection app that stores drafts on the device, captures GPS and site tolerance, keeps entered and canonical units, and submits immutable revisions to Firebase; shipped version 1.0.0 to TestFlight through a tag-pinned CI release pipeline.
- Designed the Firebase trust model: Firestore security rules that stop collectors from writing validation, review or publication fields, server-side validation in Cloud Functions, and reviewer access that requires both a role claim and an active profile, covered by 45 rules tests and 17 review-lifecycle tests.
- Built a Next.js QC Console for revision-aware human review (approve, request correction with a reason, reject), with audit history, stale-decision protection and an ArcGIS map of the sample position against the catalogued site.
- Built the public side of the pipeline: an approved-only ArcGIS publisher and a public dashboard that reads four query-only views through a fail-closed field allowlist, with watershed map layers, time-series charts and CSV export, tested across four viewport sizes.
- Worked with a research supervisor to keep scientific decisions (required measurements, thresholds, publication approval) with the scientists and out of the code.

## Resume bullets

- Built PA Watershed Watch, a native SwiftUI + Firebase + ArcGIS water-quality monitoring system for a Penn State research program; iOS 1.0.0 released to TestFlight via a tag-pinned GitHub Actions pipeline.
- Enforced data provenance with immutable revisions, server-side validation and Firestore rules that block client-authored review or publication state (45 rules tests, 30 iOS unit tests, 3 UI workflow tests).
- Developed a Next.js review console and a public ArcGIS dashboard; public data flows only through query-only views checked against a field allowlist, so collector and reviewer identities never leave the private system.
- Set up CI across Swift, TypeScript and Python with CodeQL, emulator-backed security tests and responsive visual QA on every pull request.

## Longer description

PA Watershed Watch treats a field observation as a record with history rather than a single chart point. A collector records a visit in a native SwiftUI app: site, GPS position, method, instrument and measurements, with values kept in the units entered alongside canonical units. Submitting freezes that revision. Firestore security rules prevent the phone from writing validation results, review decisions or publication state; a Cloud Function validates the submission and moves it to review.

A reviewer uses the QC Console to approve the current revision, request a correction with a reason the collector sees, or reject it. Corrections create a new revision and leave the previous one untouched, and a decision on an out-of-date revision is refused. Only the current approved revision can be published. A server-side publisher writes it to a private ArcGIS service, and the public dashboard reads four query-only views whose fields are checked against an allowlist; anything unexpected fails closed.

The iOS app is in TestFlight internal testing, and the backend, review console and dashboard run in a development environment. No observation has been published yet: the first publication waits for an authorized, non-test reading and a human scientific decision.

## Technical explanation

The collector writes to private Firestore under security rules. Server-owned validation code advances a submission to review. Reviewer actions go through an authenticated API route that re-reads the caller's current claims and profile, applies the decision in a transaction against the expected revision and writes one audit event. Approval makes a revision eligible for a separate publication job with idempotent keys and readback against a private ArcGIS service, exposed through a constrained field set in query-only public views. The Next.js dashboard reads those views anonymously and refuses to render if their schema changes.
