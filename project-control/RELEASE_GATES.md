# Release Gates

## Gate A — Software verification
- [ ] Backend contract/publication/review/trigger verification.
- [ ] Public dashboard test/typecheck/build.
- [ ] QC console typecheck/build.
- [ ] Android unit/lint/debug build.
- [ ] iOS simulator tests.
- [ ] GitHub CI green.

## Gate B — Physical iOS
- [ ] Install TestFlight Build 13 on physical iPhone.
- [ ] Confirm authentication, durable draft behavior and a controlled Firebase submission.

## Gate C — Trusted reviewer
- [ ] Authorized reviewer completes login.
- [ ] Review a provenance-cleared non-test observation.
- [ ] Verify review decision and audit readback.

## Gate D — ArcGIS credential
- [ ] Item-scoped OAuth credential.
- [ ] Secrets stored only in Firebase Functions.
- [ ] Reverify private authoritative service and query-only public views.

## Gate E — First live publication
- [ ] Non-test observation only: mobile → Firebase → validation → QC → APPROVED → ArcGIS → public views → dashboard.
- [ ] Verify retry/idempotency without duplication.

Do not use TEST-014 or unresolved historical data for Gate E.
