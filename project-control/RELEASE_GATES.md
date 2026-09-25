# PA Watershed Watch — finish and publish checklist

Updated 2026-09-25. Check a box only after its evidence is linked in this repository or GitHub. Software checks, human review, scientific publication, and verified semester hours are separate claims.

## 1. Keep the engineering line green

- [x] Confirm canonical repo and GitHub lineage: PR [#35](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/pull/35) merged into the integration branch on 2026-09-25; draft PR [#34](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/pull/34) targets `main`.
- [x] Verify finalization: PR #35's final commit passed all nine checks, including Android emulator instrumentation, before merge. The separately dispatched [full CI retry](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/actions/runs/36096251241) passed all five jobs on attempt 2. Attempt 1's Android emulator went offline before tests.
- [x] Verify integration at `d30d025`: draft PR #34 passed all 16 checks, including Android emulator, iOS, and CodeQL. [PR #36](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/pull/36) then passed its three dashboard checks and merged as `998d3af`.
- [x] Merge [PR #39](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/pull/39) after all eight checks pass; it fixes the App Hosting package that failed on `998d3af` and records Firebase safeguards. Integration merge commit: `adcdd8a`.
- [x] Merge [PR #29](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/pull/29) after its five native/backend checks passed; the TestFlight helper now requires an Admin Team key. Merge commit: `65b6c28`.
- [x] Merge [PR #40](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/pull/40) after the Android emulator rerun passed alongside every other check. It fixes disabled-publisher Firebase deployments. Merge commit: `0c59e93`.
- [x] Merge [PR #41](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/pull/41) after its production build and both browser checks passed. It keeps the demo warning readable on small phones. Merge commit: `7dcac7d`.
- [x] Verify draft PR #34's full checks on integration commit `7dcac7d`: all 17 checks passed, including iOS, Android emulator, Swift CodeQL, both websites, publication contracts, visual QA, and the development App Hosting rollout. This verifies software only; PR #34 remains draft for the human/scientific gates below.
- [x] Run local science/publication contracts: 30 validation, 15 publication, and 2 provisioning privacy tests passed on 2026-09-25.
- [x] Finish and record the local website checker: six public-dashboard adapter tests, both TypeScript checks, and both production builds passed after targeted security updates. See [verification report](../docs/VERIFICATION_REPORT.md).
- [x] Reinstall local generated dependencies from lockfiles and pass Firebase emulator rules, validation, review, and trigger suites.
- [x] Patch high/critical production dependency advisories and confirm `npm audit --omit=dev` reports zero production vulnerabilities in the backend, QC Console, and public dashboard.
- [x] Merge the reviewed finalization changes into the integration line without deleting the release branch.
- [ ] Confirm CodeQL after the TestFlight workflow fix reaches PR #34/main.
- [x] Fix the public dashboard's browser connection and verify its empty public-view state locally without demo data; PR #36 passed build and browser checks before merge.
- [x] Verify the development App Hosting rollout of dashboard packaging fix `892a7b2` and its live empty public-view state in a browser on 2026-09-25: the [hosted development dashboard](https://public-dashboard-dev--central-pa-watershed-dev.us-central1.hosted.app/) connected to the public source, showed zero sites, and displayed no ArcGIS error or demo data. The first `998d3af` rollout failed because its standalone route manifest was missing; [PR #39](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/pull/39) fixes the packaging. A development deployment is not the final public release.
- [x] Deploy integration commit `7dcac7d` to the existing development dashboard; App Hosting reported success. Reopen the actual hosted URL and verify the connected zero-site state, map, Sites/Readings/Time series phone views, and no horizontal overflow at 1440, 390, and 320 px. The demo warning itself passed PR #41's demo browser check at desktop and phone sizes.

## Firebase safeguards

- [x] Enable and read back deletion protection for the development Firestore database.
- [x] Configure and read back weekly Sunday backups with 30-day retention; point-in-time recovery remains off by the user's choice. The first scheduled backup has not yet occurred.
- [x] Read back the recovery settings after the final dashboard deployment: deletion protection enabled, one Sunday schedule with 30-day retention, PITR disabled, and no backup yet available. Do not claim a restore drill until the first backup exists.
- [x] Reconcile the tracked Firestore index declaration with the four existing remote indexes without removing the extra historical index.
- [x] Confirm no end-user Storage bucket exists; media upload is deferred, and the Storage rules pass emulator tests only. Do not claim live media storage for this release.
- [x] Resolve the validation trigger source-to-deployment gap: [PR #40](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/pull/40) keeps the disabled ArcGIS publisher and its secrets out of the development function manifest, supplies non-secret development parameters, and packages only backend sources. A scoped deployment updated `validateSubmittedObservation` on 2026-09-25; Firebase reports Node 22 / ACTIVE and the new Cloud Run revision passed its startup probe. No publisher function or OAuth secret was deployed. A 30-day container-image cleanup policy is set for `us-east4`.
- [ ] Confirm the first scheduled backup after it runs and record a recovery drill before calling recovery proven.

## 2. Prove the iPhone release on the actual device

- [x] Confirm signed TestFlight Build 13 was uploaded and is `VALID` / `IN_BETA_TESTING` in App Store Connect; evidence: [Phase 11 release record](../docs/PHASE11_RELEASE_LOCK.md).
- [x] Recheck Build 13 on 2026-09-25 using the [read-only App Store Connect status run](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/actions/runs/36157613290): `VALID`, internal `IN_BETA_TESTING`, unexpired, and no export-compliance warning.
- [ ] Install Build 13 on the project iPhone; record the displayed version/build.
- [ ] Verify sign-in and a durable draft after closing and reopening the app.
- [ ] Submit one deliberately controlled test observation and verify private Firebase readback. Keep test data out of public scientific claims.

## 3. Complete trusted human QC

- [ ] Complete the provisioned real reviewer's password setup and sign-in.
- [ ] Open TEST-014 Revision 2 in the QC Console for private reviewer sign-in and readback: verify identity, the unchanged revision, validation flags, timestamps, and the existing Revision 1 audit trail. Do not approve or otherwise change TEST-014 merely to complete this check; it is controlled development data and must not publish.
- [ ] Select a separate provenance-cleared **non-test** observation for the authorized review and eventual public scientific decision. Do not substitute the historical 117-record dataset.

## 4. Activate ArcGIS only after scope and privacy checks

- [x] Approved-only publisher, private authoritative service, four restricted public views, and fail-closed public dashboard are implemented; see [Phase 12 publication record](../docs/PHASE12_ARCGIS_PUBLICATION.md).
- [x] Recheck anonymous ArcGIS REST access on 2026-09-25: all four views returned HTTP 200, `Query` only, zero records, and no protected fields; the authoritative service returned a 499 authentication error with no layers exposed.
- [ ] Create or verify an item-scoped OAuth credential for the approved-authoritative service. Store credentials only as Firebase Functions secrets.
- [ ] Rerun the read-only ArcGIS schema/capability/privacy verifier against the exact authoritative item and four public views.
- [ ] Enable the publisher only after credential scope, service URL, reviewer evidence, and final CI are verified.

## 5. Prove one real publication end to end

- [ ] An authorized human approves one provenance-cleared non-test observation.
- [ ] Trace that exact approved revision through Firebase → publisher → private ArcGIS authoritative service → public-safe views → production dashboard.
- [ ] Verify retry/idempotency without duplicate observations or measurements, and verify no private fields appear publicly.
- [ ] Record the result and limits as non-secret release evidence. Do not call an empty dashboard or software-only test a scientific publication.

## 6. Deliver the finished release

- [ ] Reconcile tested release/integration history into `main`; run full CI and privacy checks on the final `main` SHA.
- [ ] Confirm [CodeQL alert #1](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/security/code-scanning/1) closes after the TestFlight workflow patch is scanned. The separate AI-scanner run failed because its requested model was unavailable; treat that as a service/configuration issue, not a code finding.
- [ ] Audit temporary Firebase repair privileges, Artifact Registry cleanup policy, and one-time workflows/worktrees before cleanup. Preserve unique evidence.
- [ ] Complete the [submission checklist](SUBMISSION_CHECKLIST.md), including links, screenshots, and a final independent review.
- [ ] Tag the tested release candidate only after physical-device, reviewer, and final-line evidence is complete.
- [ ] Publish the finished public release only after the non-test scientific publication proof and approved presentation are complete.

Verified semester hours stay in [the semester work log](SEMESTER_WORK_LOG.md); CI duration and Git activity do not create hours.
