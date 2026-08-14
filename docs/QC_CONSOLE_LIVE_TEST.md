# QC Console Verification Record

**Executed:** 2026-08-14T16:19:27Z

**Project:** `central-pa-watershed-dev`

**Branch:** `codex/qc-console-production-v1`

## Real development Firebase

| Check | Result | Actual evidence |
|---|---|---|
| Firebase CLI access | PASS | Project listing returned only `central-pa-watershed-dev`. |
| Firestore | PASS | `(default)` is active in `nam7`; the tested rules and indexes were deployed successfully to the real dev database. |
| Web SDK registration | PASS | Created dev Web app `Watershed QC Console Dev`; `firebase apps:sdkconfig` returned all six required public values and ignored `web/.env.local` was configured. |
| Email/Password provider | PASS | A non-mutating invalid credential probe returned `INVALID_LOGIN_CREDENTIALS`, not `OPERATION_NOT_ALLOWED`. |
| Expected test accounts | BLOCKED | Auth export found three unrelated existing accounts; none had an approved reviewer/admin claim and none matched the dev fixture identities. |
| Admin SDK provisioning | BLOCKED | `node scripts/provision_test_users.mjs --apply` cannot run without ADC. Firebase CLI login is present but is not exposed to the Admin SDK as ADC. |
| Site/QC fixture seeding | BLOCKED | Depends on the same missing ADC. Dry runs pass and both scripts pass against the emulators. |
| App Hosting | BLOCKED | The project is Spark. `firebase apphosting:backends:list` reports that Blaze is required before `firebaseapphosting.googleapis.com` can be enabled. |
| Live reviewer browser/API | BLOCKED | No real `QC_REVIEWER` credential, no local Admin ADC for the API route, and no deployable App Hosting backend. No live action was claimed as passing. |

## Local Firebase emulator + browser

| Check | Result |
|---|---|
| Provision four users, repeat provisioning idempotently | PASS |
| Seed 18 sites and five representative QC scenarios | PASS |
| Reviewer Email/Password login and persistent role session | PASS |
| Queue contains only the three `PENDING_REVIEW` fixtures | PASS |
| Oldest-first operational columns, Eastern time, refresh | PASS |
| County/watershed/location/provenance/detail rendering | PASS |
| Entered `0.35 mS/cm` and canonical `350 µS/cm` rendered distinctly | PASS |
| Environmental pH flag and all validation scores rendered | PASS |
| Revision 1 and revision 2 history plus audit history rendered | PASS |
| Approve action, queue removal, visible success | PASS |
| Request Correction reason disabled while empty; action succeeds | PASS |
| Reject reason disabled while empty; action succeeds | PASS |
| Two open sessions: winner succeeds, stale loser gets HTTP 409 guidance | PASS |
| Collector login sees `Not authorized`; direct collector API call gets 403 | PASS |
| Invalid token gets sanitized 401 | PASS |
| Identical review retry gets 200/idempotent and no duplicate review audit | PASS |
| Parent final status and both immutable revision documents verified | PASS |

This emulator run used the same Security Rules, Admin SDK route, review domain
module, validation engine, and Next.js UI as deployment. It is strong local
evidence, but it is not relabeled as real-project or deployed-browser evidence.
