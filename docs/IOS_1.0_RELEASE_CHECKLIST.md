# iOS 1.0 human release checklist

**Status at 2026-09-28 16:41 UTC:** PR #46 merged as exact integration and draft PR #34 head `5efd92699bb71199e7bbcdd887bc89497ecb4034`. Its 14 reported non-Android PR #34 checks succeeded. [TestFlight release run 36444283202](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/actions/runs/36444283202) checked out that exact SHA, passed iOS unit tests, verified the signed archive identity, and uploaded `1.0.0 (17)` for `org.centralpawatershed.mobile`. The [16:07 UTC App Store Connect readback](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/actions/runs/36448724894) reports `VALID` processing and `IN_BETA_TESTING` internally. **Live Firebase readiness for the iPhone test: NO.** PR #34/main promotion and public submission remain blocked. The five UltraReview findings remain unavailable, and GitHub's managed AI scan previously failed before analysis with an unsupported model; do not claim a clean review.

## Signed internal TestFlight candidate — completed

Physical-device, live Firebase/reviewer, and real scientific publication checks follow the candidate upload. Scientific publication is not a prerequisite for internal TestFlight.

- [x] Select integration `5efd92699bb71199e7bbcdd887bc89497ecb4034`; PR #34 remains draft. PR #44's tested backend/QC changes and PR #45/#46 documentation are included in this source.
- [x] Verify all 14 reported non-Android PR #34 checks at that SHA succeeded. The release workflow independently passed iOS unit tests, signed archive, and upload. Android remains deferred from this iOS cycle.
- [x] Confirm the signed archive matches bundle `org.centralpawatershed.mobile`, version `1.0.0`, build `17`, and the expected team. The workflow used pinned release ref `ios-1.0.0-b17` and rejected a source SHA mismatch.
- [x] Recheck App Store Connect before upload: build 17 was unused. The exact-source workflow uploaded it successfully; Apple now reports `VALID` and internal `IN_BETA_TESTING`.

## After upload: internal device and live-service verification

- [x] Confirm the uploaded build processed `VALID` and reports `IN_BETA_TESTING` internally in App Store Connect.
- [x] Install that signed build on the physical iPhone from TestFlight (fresh install, 2026-09-28).
- [ ] Complete the existing [physical-iPhone runbook](PHYSICAL_IPHONE_HAPPY_PATH_2026-09-28.md). Attach actual device evidence; simulator success is not physical-device proof. Check sign-in, durable draft after relaunch, controlled test submission, and private readback after Firebase is ready.
- [x] Provision role-separated test identities with matching custom claims and active profiles; deploy the reviewed Firestore rules and the validation and profile functions, and read the live ruleset back identical to source (2026-09-28).
- [x] Roll out the QC Console and public dashboard from reviewed integration source; a test reviewer signed in to the live QC Console and loaded the queue (2026-09-28).
- [ ] Record the live collector → review → correction → approval and rejection run on test accounts, and a collector's "Not authorized" QC sign-in. Keep identities and evidence private.
- [ ] Complete real reviewer sign-in and revision-aware readback. A controlled test record may verify workflow behavior but must not be represented as environmental science.

## Separate final scientific-publication gate

- [x] UltraReview: the texts of findings 3–5 were never retrieved; the project owner waived recovering them on 2026-09-28. Record them as unavailable evidence, not resolved findings. The GitHub-managed AI Scan failure ([#47](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/issues/47)) is an external scanner failure, not a pass.
- [ ] Verify exact ArcGIS authoritative item scope and every public-view schema/capability before publishing. Publish only an authorized, provenance-cleared non-test observation after independent human scientific review; approval is not publication success.
- [ ] Read the approved revision back through the private service, anonymous public views, and dashboard; verify retry/idempotency and privacy. If no eligible observation or authorization exists, leave public views empty. Do not use controlled tests or unresolved-provenance history as public evidence.
- [ ] Keep PR #34/main promotion and public App Store submission **blocked** until combined CI is final, live/device and reviewer gates pass, the scientific publication gate is resolved, and final independent release review is recorded.

## Before public App Store submission

- [ ] Recheck the privacy worksheet, policy owner and public URL, support channel, legal entity, store privacy declarations, and listing copy with their owners.
- [ ] Capture current, real, redacted iOS screenshots from the selected release build. Do not use dashboard demo/empty captures as iOS app screenshots or use placeholder templates.
- [ ] Verify public dashboard views are anonymous, query-only, and exactly allowlisted. Keep the dashboard empty if no approved public observation exists; do not promote demo records as monitoring data.
- [ ] Refresh this repository's README, metric ledger, portfolio text, screenshot attribution, and release notes against the final release SHA. Preserve the 300-hour figure as a **planning target**; claim worked hours only from reconciled dated records.
- [ ] Perform final independent human review and record the release decision. A green build or approved observation alone does not prove a completed public release.
