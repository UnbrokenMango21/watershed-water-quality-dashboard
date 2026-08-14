# QC Console Live Verification Record

**Executed:** 2026-08-14T18:18:31Z

**Project:** `central-pa-watershed-dev`

**Branch:** `codex/qc-console-production-v1`

**Connected deployment SHA:** `18f5d7b807a4b88c82f3d7531742313607e6fce7`

**App Hosting:** `qc-console-dev`, `us-central1`, Node.js 22, root `web`

**HTTPS:** `https://qc-console-dev--central-pa-watershed-dev.us-central1.hosted.app`

## Real cloud environment

| Check | Result | Actual evidence |
|---|---|---|
| Billing | PASS | Firebase console showed Blaze for `central-pa-watershed-dev`. |
| ADC | PASS | Application-default access token succeeded; Admin Auth `listUsers()` and Firestore reads succeeded. |
| Web SDK | PASS | Registered app `Watershed QC Console Dev`; all six CLI SDK values matched ignored `web/.env.local`; project id was exact. |
| Test users | PASS | Test Collector 01/02 (`COLLECTOR`), Test QC Reviewer (`QC_REVIEWER`), and Test Admin (`ADMIN`) were enabled with exact display names, claims, and active `users/{uid}` mirrors. Provisioning was repeated without resetting passwords. |
| Sites | PASS | 18 `TEST-*` sites across 8 counties and 11 watersheds, including similar and long names. |
| Firestore indexes | PASS | `submissions(status ASC, updated_at ASC)` reached READY; the queue then loaded oldest first. |
| App Hosting rollout | PASS | Source-upload rollout `build-2026-08-14-004` completed before the live action run. The final branch-connected rollout is recorded by the SHA above. |
| Runtime IAM | PASS | `firebase-app-hosting-compute@central-pa-watershed-dev.iam.gserviceaccount.com` has `roles/datastore.user` and `roles/firebaseauth.viewer`; no Owner or Editor grant was added. |

## Seeded live action scenarios

| Scenario | Submission | Expected live result |
|---|---|---|
| CLEAN | `2e0d82bd-8430-4fcb-9974-145477266e15` | `APPROVED` |
| WARNING | `baae3bf7-434d-4a16-b30e-e8548fa4b7b4` | `NEEDS_CORRECTION` |
| BLOCKING | `785582ea-dcbb-4266-a819-07c20ae0a25c` | remained excluded as `NEEDS_CORRECTION` |
| CORRECTION | `2795328f-5199-4f32-8da6-95a6e03295df` | revision 2 `REJECTED`; revision 1 retained |
| REJECTED HISTORY | `4252a316-08fa-428b-952d-62e87520e0d2` | retained as `REJECTED` |

Fresh presentation fixtures were seeded after destructive verification:

- CLEAN `88d21010-4db2-4d04-ba06-0183ce92f64f`
- WARNING `7027c919-feb8-4d97-aeda-283487d8895e`
- BLOCKING `04ae04d1-96ba-4352-96e3-767a37c05466`
- CORRECTION `d15fd590-fc94-4007-ac6f-427026d79ff5`
- REJECTED HISTORY `ac8e133a-7ddf-4396-a035-241d6d73e5e5`

## Deployed browser and API results

| Check | Result | Actual evidence |
|---|---|---|
| Login / refresh / sign-out / sign-in | PASS | Reviewer session survived refresh; sign-out and sign-in succeeded. |
| Invalid credentials | PASS | Deployed UI showed `Incorrect email or password.` without internal errors. |
| Queue | PASS | Only three `PENDING_REVIEW` records appeared; blocking and rejected fixtures were absent; order was oldest first. |
| Detail | PASS | Site/collection/location, entered and canonical measurements, validation, flags, notes, provenance, attachments, revisions, and audit rendered. |
| Responsive / accessibility | PASS | Desktop and 390 px layouts had no document overflow; labels, keyboard targets, focus styles, status text, and disabled/loading states were verified. |
| Approve | PASS | CLEAN became `APPROVED` and left the queue. |
| Request Correction | PASS | Blank reason kept submit disabled with visible guidance; exact approved reason produced `NEEDS_CORRECTION`. |
| Reject | PASS | Blank reason kept submit disabled with visible guidance; exact approved reason produced `REJECTED`. |
| Stale action | PASS | Two tabs loaded correction revision 2; tab A rejected; stale tab B received HTTP 409 and clear refresh guidance. |
| Idempotency | PASS | Identical CLEAN approval replay returned HTTP 200 with `idempotent: true`; audit count did not change. A changed reason replay returned HTTP 409. |
| Collector denial | PASS | Collector UI showed `Not authorized`; privileged review API returned 403. |
| Direct client writes | PASS | Collector parent/science/audit writes and reviewer science write returned 403 from real Firestore rules. |
| Audit | PASS | Each tested decision added exactly one matching review audit record with reviewer, revision, timestamp, decision, and reason. |
| Immutable science | PASS | Pre/post SHA-256 hashes for each current revision plus its three measurements were identical. |

## Immutable science evidence

| Scenario | SHA-256 before and after | Audit count delta |
|---|---|---|
| CLEAN | `3209eb6d2b2afcd587c8d26aa8ea88b66dffb93cabe5603343ff959ccc9fcc49` | 2 → 3 |
| WARNING | `1486d318ebfe0aad8a467ad6ce2741e67360781f8fa7614e78b08ad06b512fe4` | 2 → 3 |
| CORRECTION revision 2 | `db241f4e44e93c2a66a342fdfb3475156c93388a9de1415c070e452469fb0e0f` | 5 → 6 |

## Storage inspection

The Web SDK configuration names
`central-pa-watershed-dev.firebasestorage.app`, but direct bucket lookup returned
HTTP 404 and no Cloud Storage rules release exists. The real project currently
has only `firebaseapphosting-sources-652403958133-us-central1`, a regional
`STANDARD` App Hosting source bucket in `US-CENTRAL1`. At inspection it held 4
objects totaling 21,962,005 bytes. No media feature or storage bucket was added.

## Automated gates

| Gate | Result |
|---|---|
| Backend contracts | 30/30 PASS |
| Firestore rules | 42/42 PASS |
| Storage rules | 6/6 PASS |
| Validation persistence/orchestrator | 7/7 PASS |
| Validation trigger | 1/1 PASS |
| Review action/lifecycle | 16/16 PASS |
| Backend total | 102/102 PASS |
| Web typecheck / production build | PASS / PASS |

No password, token, ADC material, browser session data, or Admin credential is
recorded in this file.
