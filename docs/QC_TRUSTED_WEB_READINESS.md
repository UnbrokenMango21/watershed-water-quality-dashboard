# QC Trusted Web Readiness

**Project:** `central-pa-watershed-dev`

**Branch:** `codex/qc-console-production-v1`

**Phase 11 baseline:** `d6900c2f45d39a00277a5df39a0af06adb28e2b4`

**Connected deployment SHA:** `18f5d7b807a4b88c82f3d7531742313607e6fce7`

**Verification date:** 2026-08-14

**Live URL:** `https://qc-console-dev--central-pa-watershed-dev.us-central1.hosted.app/review`

## Current result

The DEV QC console is release-ready. It is connected to real Firebase Auth and
Firestore, deployed on the single `qc-console-dev` App Hosting backend, and
verified through the deployed reviewer and collector workflows. There are no
current QC-console release blockers.

## Acceptance status

| Area | Result | Evidence |
|---|---|---|
| Blaze / ADC / target project | PASS | Blaze shown in Firebase; ADC Admin Auth and Firestore reads succeeded only against `central-pa-watershed-dev`. |
| Exact roles and no public signup | PASS | Two collectors, one QC reviewer, and one admin have exact enabled claims and active user mirrors; login has no signup. |
| Current server authorization | PASS | Token verification includes revocation, current Auth user lookup, disabled-state check, and current custom claim. |
| Queue | PASS | Real READY index; only `PENDING_REVIEW`, oldest first, useful scientific counts/context, loading/error/empty/refresh states. |
| Scientific detail | PASS | Review status first; site/collection/location, entered/canonical values, grouped flags, metrics/versions, notes, revisions, audit, and historical attachment metadata. |
| Review actions | PASS | Exactly Approve, Request Correction, Reject; required reasons, disabled/loading state, revision context, success and conflict feedback. |
| Race / stale / idempotency | PASS | Two live tabs produced one winner and clear HTTP 409 loser; exact replay returned idempotent 200; changed replay returned 409. |
| Audit and immutable science | PASS | Each live decision added one audit record; three before/after revision-plus-measurement hashes matched exactly. |
| Security | PASS | Collector UI and API denied; real rules returned 403 for collector parent/science/audit and reviewer science writes. |
| Responsive / accessibility | PASS | Desktop and 390 px browser passes; no document overflow; labels, keyboard targets, focus, contrast, and non-color status text verified. |
| Runtime IAM | PASS | App Hosting service account has only `roles/datastore.user` and `roles/firebaseauth.viewer`; no Owner/Editor grant. |
| Storage | PASS inspected | Only the App Hosting source bucket exists; the configured Firebase Storage bucket is not provisioned. Media remains deferred and no storage resource was created. |
| Real deployment/browser | PASS | HTTPS login, queue, detail, all three decisions, denial, stale conflict, idempotency, and presentation screenshots completed. |

## Final automated results

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

The full cloud, live-browser, scenario, IAM, Storage, and immutability evidence
is in `docs/QC_CONSOLE_LIVE_TEST.md`; operational commands are in
`docs/QC_CONSOLE_RUNBOOK.md`.
