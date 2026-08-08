# Phase 9 — Firebase / Firestore Foundation

**Status:** Active  
**Goal:** Create the clean mobile/backend source-of-truth environment without loading real watershed observations.

## Actual development environment

The development Firebase project now exists.

- Firebase project name: `Central PA Watershed Dev`
- Firebase project ID: `central-pa-watershed-dev`
- Firestore database: `(default)`
- Firestore edition: Standard
- Firestore location: `nam5` — United States (Central)
- Google Analytics: enabled for product/UX telemetry only

### Firestore location decision

The originally preferred location was `nam7` (United States Central and East), but the created default database is in `nam5`.

We are intentionally keeping `nam5` rather than recreating the environment. `nam5` is still a US multi-region Firestore location with read/write replicas in Iowa and Google's Oklahoma region and a witness in South Carolina. It provides multi-region availability/durability and is fully suitable for this development environment.

The database location is immutable after creation, so `nam5` is now the locked development location.

## Environment separation

Development:

`central-pa-watershed-dev`

Reserved for later production deployment:

`central-pa-watershed-prod`

This prevents validation experiments, synthetic mobile records and destructive development work from contaminating production science data.

## Firebase services for Phase 9

Enabled / being configured:

1. Firebase project
2. Cloud Firestore — Standard edition
3. Firebase Authentication
4. Firestore Security Rules
5. Google Analytics

Deferred until needed:

- Cloud Storage for photographs/attachments — Phase 11 mobile work
- App Check enforcement — before mobile production release
- Cloud Functions / validation backend — Phase 10
- Hosting — only if the eventual architecture requires it

## Analytics policy

Google Analytics is enabled, but Analytics must never receive scientific or private payloads.

Do not send these as Analytics events, parameters, user properties, or screen metadata:

- scientific measurement values;
- exact latitude/longitude;
- landowner/private property information;
- field notes;
- collector/reviewer email addresses;
- reviewer comments;
- authentication tokens or identifiers that expose a person's identity.

Analytics may later record privacy-safe product telemetry such as screen navigation, generic form completion, offline-sync usage, validation-screen visits, and non-sensitive performance/error events.

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

Revision 1 remains preserved. Revision 2 becomes the current revision. This makes the correction history auditable and aligns with the decision that supervisors do not edit scientific measurements directly.

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

Server-owned validation data is excluded from collector create/update fields.

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

## Authentication recommendation

For the development MVP, use email/password accounts restricted to known research/test users. Do not expose a public self-registration workflow in the mobile app.

Later, if Penn State identity integration is desired, evaluate an institutional identity provider separately rather than redesigning the scientific data model.

## CLI deployment

Repository Firebase configuration is version controlled:

- `.firebaserc`
- `firebase.json`
- `firebase/firestore.rules`
- `firebase/firestore.indexes.json`
- `config/firebase_schema.json`

After installing the Firebase CLI and authenticating, deploy with:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

## Acceptance criteria

Phase 9 is complete when:

- dev Firebase project exists;
- project ID is recorded as `central-pa-watershed-dev`;
- Firestore Standard database exists in `nam5`;
- database remains empty of real science data;
- Authentication Email/Password is enabled for controlled test accounts;
- version-controlled rules and indexes are deployed;
- rules pass expected allow/deny tests;
- collector cannot overwrite server-owned validation/review/publication fields;
- revision history prevents silent replacement of previously submitted measurements;
- schema can feed Phase 10 validation without redesign;
- mobile app can later use the same structure offline in Phase 11.
