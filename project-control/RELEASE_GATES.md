# PA Watershed Watch — finish and publish checklist

Updated 2026-09-25. Check a box only after its evidence is linked in this repository or GitHub. Software checks, human review, scientific publication, and verified semester hours are separate claims.

## 1. Keep the engineering line green

- [x] Confirm canonical repo and GitHub lineage: PR [#35](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/pull/35) merged into the integration branch on 2026-09-25; draft PR [#34](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/pull/34) targets `main`.
- [x] Verify finalization: PR #35's final commit passed all nine checks, including Android emulator instrumentation, before merge. The separately dispatched [full CI retry](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/actions/runs/36096251241) passed all five jobs on attempt 2. Attempt 1's Android emulator went offline before tests.
- [x] Verify integration at `d30d025`: draft PR #34 passed all 16 checks, including Android emulator, iOS, and CodeQL. [PR #36](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/pull/36) then passed its three dashboard checks and merged as `998d3af`.
- [x] Merge [PR #39](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/pull/39) after all eight checks pass; it fixes the App Hosting package that failed on `998d3af` and records Firebase safeguards. Integration merge commit: `adcdd8a`.
- [ ] Verify draft PR #34's full checks on the latest integration head before a release decision.
- [x] Run local science/publication contracts: 30 validation, 15 publication, and 2 provisioning privacy tests passed on 2026-09-25.
- [x] Finish and record the local website checker: six public-dashboard adapter tests, both TypeScript checks, and both production builds passed after targeted security updates. See [verification report](../docs/VERIFICATION_REPORT.md).
- [x] Reinstall local generated dependencies from lockfiles and pass Firebase emulator rules, validation, review, and trigger suites.
- [x] Patch high/critical production dependency advisories and confirm `npm audit --omit=dev` reports zero production vulnerabilities in the backend, QC Console, and public dashboard.
- [x] Merge the reviewed finalization changes into the integration line without deleting the release branch.
- [ ] Confirm CodeQL after the TestFlight workflow fix reaches PR #34/main.
- [x] Fix the public dashboard's browser connection and verify its empty public-view state locally without demo data; PR #36 passed build and browser checks before merge.
- [x] Verify the development App Hosting rollout of dashboard packaging fix `892a7b2` and its live empty public-view state in a browser on 2026-09-25: the [hosted development dashboard](https://public-dashboard-dev--central-pa-watershed-dev.us-central1.hosted.app/) connected to the public source, showed zero sites, and displayed no ArcGIS error or demo data. The first `998d3af` rollout failed because its standalone route manifest was missing; [PR #39](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/pull/39) fixes the packaging. A development deployment is not the final public release.

## Firebase safeguards

- [x] Enable and read back deletion protection for the development Firestore database.
- [x] Configure and read back weekly Sunday backups with 30-day retention; point-in-time recovery remains off by the user's choice. The first scheduled backup has not yet occurred.
- [x] Reconcile the tracked Firestore index declaration with the four existing remote indexes without removing the extra historical index.
- [x] Confirm no end-user Storage bucket exists; media upload is deferred, and the Storage rules pass emulator tests only. Do not claim live media storage for this release.
- [ ] Resolve the validation trigger source-to-deployment gap: the active Node 22 function predates the 2026-08-16 code update. A scoped CLI redeploy currently asks for ArcGIS publisher OAuth secrets even with the publisher gated. Do not create placeholder secrets or activate publication to bypass it; see [Firebase safeguards](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/issues/37).
- [ ] Confirm the first scheduled backup after it runs and record a recovery drill before calling recovery proven.

## 2. Prove the iPhone release on the actual device

- [x] Confirm signed TestFlight Build 13 was uploaded and is `VALID` / `IN_BETA_TESTING` in App Store Connect; evidence: [Phase 11 release record](../docs/PHASE11_RELEASE_LOCK.md).
- [ ] Install Build 13 on the project iPhone; record the displayed version/build.
- [ ] Verify sign-in and a durable draft after closing and reopening the app.
- [ ] Submit one deliberately controlled test observation and verify private Firebase readback. Keep test data out of public scientific claims.

## 3. Complete trusted human QC

- [ ] Complete the provisioned real reviewer's password setup and sign-in.
- [ ] Open TEST-014 Revision 2 in the QC Console for private reviewer sign-in and readback: verify identity, the unchanged revision, validation flags, timestamps, and the existing Revision 1 audit trail. Do not approve or otherwise change TEST-014 merely to complete this check; it is controlled development data and must not publish.
- [ ] Select a separate provenance-cleared **non-test** observation for the authorized review and eventual public scientific decision. Do not substitute the historical 117-record dataset.

## 4. Activate ArcGIS only after scope and privacy checks

- [x] Approved-only publisher, private authoritative service, four restricted public views, and fail-closed public dashboard are implemented; see [Phase 12 publication record](../docs/PHASE12_ARCGIS_PUBLICATION.md).
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
