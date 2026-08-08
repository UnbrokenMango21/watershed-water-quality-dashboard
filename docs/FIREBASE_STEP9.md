# Phase 9 — Firebase / Firestore Foundation

**Status:** Active  
**Goal:** Create the clean mobile/backend source-of-truth environment without loading real watershed observations.

## Environment separation

Do not use one Firebase project for both experimentation and final production.

Create first:

`central-pa-watershed-dev`

Reserve for later deployment:

`central-pa-watershed-prod`

This prevents validation experiments, synthetic mobile records and destructive development work from contaminating production science data.

## Firestore location

Recommended location for this project: **`nam7` — United States (Central and East)**.

Reasoning:

- Pennsylvania users benefit from the eastern read/write region in Northern Virginia.
- Multi-region replication gives stronger availability/durability than a single regional deployment.
- The application is small enough that the availability benefit is more valuable than optimizing for the lowest possible regional write cost.
- The location is immutable after database creation, so choose deliberately.

If Penn State/Google account policy does not offer `nam7`, stop and record the available choices before selecting an alternative.

## Firebase services for Phase 9

Enable only what we need now:

1. Firebase project
2. Cloud Firestore — Standard edition
3. Firebase Authentication
4. Firestore Security Rules

Defer until needed:

- Cloud Storage for photographs/attachments — Phase 11 mobile work
- App Check enforcement — before mobile production release
- Cloud Functions / validation backend — Phase 10
- Hosting — only if the eventual architecture requires it
- Analytics — optional, not required for scientific data collection

## Firestore data model

```text
users/{uid}

siteCatalog/{siteId}

submissions/{submissionId}
|-- current envelope / workflow pointer
|
|-- revisions/{revisionId}
|   |-- immutable-after-submit field snapshot
|   |
|   |-- measurements/{measurementId}
|   |-- validationFlags/{flagId}       [server-owned]
|   `-- attachments/{attachmentId}     [metadata; Storage later]
|
`-- audit/{auditId}                    [server-owned]
```

### Why revisions exist

A collector must never silently replace a previously submitted scientific record.

Example:

```text
Revision 1
submitted
pH = 7.42
      |
      v
Supervisor requests correction
      |
      v
Revision 2
submitted
pH = 7.24
```

Revision 1 remains preserved. Revision 2 becomes the current revision. This makes the correction history auditable and aligns with the earlier decision that supervisors do not edit scientific measurements directly.

## Submission vs SamplingEvent IDs

Keep both IDs:

- `submission_id` — mobile/form envelope identity.
- `event_id` — scientific sampling-event identity and ArcGIS/Workflow Manager integration key.

The same `event_id` survives correction revisions.

Do not use Firestore auto-increment-style identifiers or ArcGIS ObjectIDs for integration.

## Site catalog privacy

`siteCatalog` is a mobile-safe lookup collection. It may contain:

- site ID/code
- safe display name
- latitude/longitude
- GeoPoint
- site tolerance
- active flag

It must not contain:

- landowner name
- private owner notes
- private access instructions intended only for backend administrators

Those remain in the controlled backend/ArcGIS architecture.

## Scientific measurement model

Measurements remain records rather than permanent top-level columns:

```json
{
  "measurement_id": "...",
  "parameter_code": "DO_MG_L",
  "display_name": "DO (ppm)",
  "value": 8.31,
  "unit_code": "mg/L",
  "method_name": "...",
  "instrument_name": "..."
}
```

This preserves the extensible architecture already used in ArcGIS.

## Temperature UX contract

The mobile app asks the user to select C or F before entry.

If F is entered:

`C = (F - 32) * 5 / 9`

If C is entered:

`F = C * 9 / 5 + 32`

Store:

- entered value
- entered unit
- Celsius value
- Fahrenheit value

Display the derived value to two decimal places. Preserve full numeric precision internally where practical.

## New mobile observation requirements

Required metadata:

- collector identity from Firebase Auth
- site
- date and time
- GPS latitude/longitude
- GPS accuracy
- temperature
- pH
- DO concentration
- conductivity
- test type
- method
- instrument/lab

Optional/protocol-dependent parameters remain measurement records.

`Other` test/instrument choices require descriptive text.

## Status ownership

Collector client may initiate only:

```text
DRAFT -> SUBMITTED
NEEDS_CORRECTION -> RESUBMITTED
```

Trusted server/backend owns:

```text
SUBMITTED -> VALIDATING
VALIDATING -> PENDING_REVIEW
PENDING_REVIEW -> NEEDS_CORRECTION
PENDING_REVIEW -> APPROVED
PENDING_REVIEW -> REJECTED
RESUBMITTED -> VALIDATING
APPROVED -> PUBLISHING
PUBLISHING -> PUBLISHED
PUBLISHING -> PUBLISH_FAILED
```

Collectors cannot write quality scores, anomaly scores, review decisions, Workflow Manager IDs or publication fields.

## Security model

Mobile/web SDKs use Firebase Authentication + Firestore Security Rules.

Server-side validation/integration uses Admin SDK/IAM. Server SDKs bypass Firestore Security Rules, so server IAM credentials must be treated as privileged backend credentials.

Security rules are default-deny. The collector can:

- read their own submissions;
- create a draft;
- edit/delete only draft revision content;
- submit a draft revision;
- create a new correction revision after `NEEDS_CORRECTION`;
- resubmit the corrected work.

Once a revision is `SUBMITTED`, collector science in that revision is immutable.

QC reviewers may receive read access later if needed, but Workflow Manager/ArcGIS is the intended review interface.

## Offline-first behavior

Firestore mobile SDKs support offline persistence. The mobile app should therefore allow field drafting and measurement entry with poor/no connectivity, then synchronize when connectivity returns.

The UI must distinguish at least:

- Saved locally
- Syncing
- Synced
- Submission failed / retry needed

Do not tell the collector that a submission is accepted for review until the backend has actually received it.

## Index policy

Commit only indexes that support known application queries. Avoid speculative indexing of every possible combination because indexes add write/storage cost.

Initial composites support:

- collector + most recently updated submissions
- workflow status + most recently updated submissions
- site + latest collected time

Add more indexes when Phase 10/11 queries require them.

## Firebase console creation checklist

1. Open Firebase Console.
2. Add project.
3. Project name: `Central PA Watershed Dev`.
4. Preferred project ID: `central-pa-watershed-dev` if available; otherwise use the closest available suffix and record the actual ID in GitHub.
5. Google Analytics: leave disabled for now unless there is a separate research requirement.
6. Create project.
7. Open **Build / Firestore Database**.
8. Create database.
9. Choose **Standard edition**.
10. Start in **Production mode** / locked rules rather than open test mode.
11. Choose location **`nam7` United States (Central and East)**.
12. Create database.
13. Open **Authentication** and enable the development sign-in method selected for the app.
14. Do not manually create fake production observations.
15. Deploy/enter the version-controlled rules and indexes after the Firebase CLI is connected.

## Authentication recommendation

For the development MVP, use email/password accounts restricted to known research/test users. Do not implement public self-registration.

Later, if Penn State identity integration is desired, evaluate an institutional identity provider separately rather than redesigning the scientific data model.

## Version-controlled Phase 9 files

- `config/firebase_schema.json`
- `firebase/firestore.rules`
- `firebase/firestore.indexes.json`
- `docs/FIREBASE_STEP9.md`

## Acceptance criteria

Phase 9 is complete when:

- dev Firebase project exists;
- actual project ID/location are recorded;
- Firestore is Standard edition and empty of real data;
- Authentication is enabled for test users;
- rules are deployed/tested;
- expected collector actions succeed;
- forbidden server-field/scientific-history overwrites fail;
- schema can feed Phase 10 validation without redesign;
- mobile app can later use the same structure offline in Phase 11.
