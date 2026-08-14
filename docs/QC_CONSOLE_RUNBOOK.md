# QC Console Runbook

## Architecture and trust boundary

The QC console is the Next.js app in `web/`. Reviewers sign in with Firebase
Email/Password and read Firestore through the browser SDK under
`firebase/firestore.rules`. The browser has no write permission. All Approve,
Request Correction, and Reject writes go through
`POST /api/submissions/{submissionId}/review`, which verifies the ID token,
checks the current Auth user and custom claim, and calls
`web/lib/reviewSubmission.mjs`. That module owns the single Firestore transaction
and immutable audit event.

Development resources are confined to `central-pa-watershed-dev`, Firestore
`(default)` in `nam7`. No production project or ArcGIS publication is part of
this runbook.

## Environment

Copy `web/.env.example` to ignored `web/.env.local` and set these public Web SDK
values from the registered dev Web app:

```text
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
```

Retrieve the source values without guessing:

```bash
firebase apps:list WEB --project central-pa-watershed-dev
firebase apps:sdkconfig WEB <web-app-id> --project central-pa-watershed-dev
```

The API uses Application Default Credentials. In Firebase App Hosting this is
the runtime service account. For local live-project work, set
`GOOGLE_APPLICATION_CREDENTIALS` to an untracked dev service-account file or run
`gcloud auth application-default login`. Never put Admin credentials, passwords,
or real `.env` files in Git.

## Local startup against the dev project

```bash
npm ci
npm ci --prefix web
npm --prefix web run dev -- --hostname 127.0.0.1
```

Open `http://127.0.0.1:3000/review`. Sign-in persists through Firebase Auth;
there is no signup route or form.

## Test users and sites

Dry runs do not load credentials:

```bash
node scripts/provision_test_users.mjs
node scripts/seed_test_sites.mjs
node scripts/seed_qc_smoke_data.mjs
```

After obtaining dev-only ADC, provision the named users with an uncommitted
temporary password and seed the fixtures:

```bash
QC_DEV_TEST_PASSWORD='<temporary-password>' node scripts/provision_test_users.mjs --apply
node scripts/seed_test_sites.mjs --apply
node scripts/seed_qc_smoke_data.mjs --apply
```

The user script creates two collectors, one `QC_REVIEWER`, and one `ADMIN`, sets
friendly display names and exact claims, and does not reset existing passwords.
The site script upserts 18 `TEST-*` sites covering similar names, long names,
counties, and watersheds. The QC script creates new UUID-scoped clean, warning,
blocking, correction-revision-2, and rejected records; it never overwrites an
existing submission or revision.

## Emulator workflow

Terminal 1:

```bash
firebase emulators:start --project central-pa-watershed-dev --only auth,firestore
```

Terminal 2:

```bash
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
QC_DEV_TEST_PASSWORD='<emulator-only-password>' node scripts/provision_test_users.mjs --apply
node scripts/seed_test_sites.mjs --apply
node scripts/seed_qc_smoke_data.mjs --apply
```

Terminal 3:

```bash
export NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export GOOGLE_CLOUD_PROJECT=central-pa-watershed-dev
npm --prefix web run dev -- --hostname 127.0.0.1
```

`NEXT_PUBLIC_USE_FIREBASE_EMULATORS` must never be set in a deployed backend.

## Tests

```bash
npm ci
npm ci --prefix tests/firestore-rules
npm ci --prefix tests/validation-firestore
npm ci --prefix tests/review
npm run test:contracts
firebase emulators:exec --project central-pa-watershed-dev --only firestore,storage \
  "node tests/firestore-rules/run-tests.cjs && node tests/firestore-rules/run-storage-tests.cjs && node tests/validation-firestore/run-tests.cjs"
firebase emulators:exec --project central-pa-watershed-dev --only firestore,functions \
  "npm run test:trigger"
firebase emulators:exec --project central-pa-watershed-dev --only firestore \
  "npm run test:review"
npm ci --prefix web
npm --prefix web run typecheck
npm --prefix web run build
```

The Android, iOS, legacy Expo, and hygiene commands are also encoded in
`.github/workflows/mobile-ci.yml`.

## Review lifecycle

The active queue contains only `PENDING_REVIEW`, oldest `updated_at` first.
Reviewers inspect the immutable current revision and send its
`expectedRevisionId`. Approve moves to `APPROVED`; Request Correction requires a
reason and moves to `NEEDS_CORRECTION`; Reject requires a reason and moves to
`REJECTED`. A stale or competing decision returns HTTP 409. An identical retry
by the same reviewer with the same normalized reason is successful and writes no
second audit event.

## Development deployment

The intended host is Firebase App Hosting because this is a dynamic Next.js app
with a Node API route. Static Firebase Hosting alone cannot execute the review
API. App Hosting requires Blaze; see the
[Firebase App Hosting cost documentation](https://firebase.google.com/docs/app-hosting/costs).

The live dev backend is:

- backend: `qc-console-dev`
- region: `us-central1`
- runtime: Node.js 22
- root: `web`
- URL: `https://qc-console-dev--central-pa-watershed-dev.us-central1.hosted.app`
- live branch: `codex/qc-console-production-v1`
- runtime service account: `firebase-app-hosting-compute@central-pa-watershed-dev.iam.gserviceaccount.com`

Create it once only if it does not already exist:

```bash
firebase apphosting:backends:create \
  --project central-pa-watershed-dev \
  --backend qc-console-dev \
  --primary-region us-central1 \
  --root-dir web \
  --app 1:652403958133:web:c59e5003a134740586f33c \
  --runtime nodejs22 \
  --non-interactive
```

Set the six `NEXT_PUBLIC_FIREBASE_*` variables on that backend from
`firebase apps:sdkconfig`. The runtime service account has only
`roles/datastore.user` and `roles/firebaseauth.viewer` for the review API. Do
not grant Owner or Editor. Create a rollout from the pushed branch:

```bash
firebase apphosting:rollouts:create qc-console-dev \
  --project central-pa-watershed-dev \
  --git-branch codex/qc-console-production-v1
```

Then run every item in `docs/QC_CONSOLE_LIVE_TEST.md` against the HTTPS URL.

## Storage state

The registered Web SDK names `central-pa-watershed-dev.firebasestorage.app`, but
the Cloud Storage JSON API currently returns 404 for that bucket and there is no
Cloud Storage for Firebase rules release. The only real bucket is the regional
App Hosting source bucket
`firebaseapphosting-sources-652403958133-us-central1` (`STANDARD`,
`US-CENTRAL1`). This is not a QC-console blocker: the console does not upload
media, and mobile photo/audio capture remains intentionally deferred.

## Troubleshooting

- `Could not load the default credentials`: configure dev ADC; Firebase CLI
  login alone is not Admin SDK ADC.
- `must be on the Blaze plan`: upgrade only `central-pa-watershed-dev`, then
  retry backend creation.
- `401`: sign out and back in; the ID token is invalid, expired, or revoked.
- `403`: verify the current Auth user is enabled and has exactly
  `QC_REVIEWER` or `ADMIN`, then refresh the token by signing in again.
- `409`: another reviewer decided the record or its current revision changed;
  refresh before acting.
- Queue index error: deploy the checked-in Firestore indexes with
  `firebase deploy --only firestore:indexes --project central-pa-watershed-dev`.
- Never work around a rules denial with a browser-side Admin credential.
