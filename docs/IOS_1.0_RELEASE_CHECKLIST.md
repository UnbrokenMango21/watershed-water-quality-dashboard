# iOS 1.0 human release checklist

**Status at 2026-09-28 12:22 UTC:** PR #42 tested source `b9580c9` merged into integration as `1da94e0`; PR #34 reported 16/16 checks there. PR #44 merged from reviewed head `8d1c4f5` as integration `8ef5684`, with five PR checks passing. Combined PR #34 checks at exact head `8ef5684` were incomplete: 11/15 passed, the iOS-native and Swift CodeQL jobs were running, one CodeQL result was neutral, and the GitHub Advanced Security AI scan failed before analysis because its requested model was unsupported. **Live Firebase readiness for the iPhone test: NO.** This is not release authorization. Refresh evidence after integration CI settles and at any later release SHA.

## Before TestFlight upload

- [ ] Obtain the full UltraReview report. Record each of the five finding IDs, exact text, source location, disposition, and verifying evidence. The release checkpoint had **0/5 accounted**.
- [ ] Review PR #44's merged diff, checks, comments, and reviewer decisions. The merge commit `8ef5684` is not automatically the final release SHA; choose the final reviewed source after all release gates.
- [ ] Run required release checks on that exact source. Android product/release work remains deferred after the iOS submission/publication milestone; normal PR CI does not include Android native checks.
- [ ] Confirm both Xcode configurations at the chosen SHA declare bundle `org.centralpawatershed.mobile`, version `1.0.0`, build `17`. Record the full SHA and release ref.
- [ ] Complete the existing physical-iPhone verification runbook and attach its actual device evidence. Simulator success is not physical-device proof. Check sign-in, durable draft after relaunch, controlled test submission, and private readback.
- [ ] Complete real reviewer sign-in and revision-aware readback. Keep reviewer identities and evidence private. Do not treat a controlled test record as environmental proof.
- [ ] Resolve the live Firebase readiness gate: prove the required live custom claims and reviewer Auth linkage, then verify deployed rules and QC source against the selected release SHA. Readiness remains **NO** until this evidence is recorded.
- [ ] Verify exact ArcGIS authoritative item scope and all public-view schemas/capabilities. Complete the first publication only with an authorized, provenance-cleared non-test observation; read it back through the private service, public views, and dashboard, including retry/idempotency and privacy checks.
- [ ] Recheck App Store Connect availability for `1.0.0 (17)`, then upload only after the release SHA and review gates are settled. The last query at 2026-09-28 11:42 UTC found no upload or processed build.
- [ ] For the existing release workflow, explicitly supply `release_ref`, matching full `expected_sha`, `marketing_version=1.0.0`, and `build_number=17`. Checked-in defaults still target `0.1.0 (13)` and an older release ref. Confirm processing, internal-group availability, and installation after upload.

## Before public App Store submission

- [ ] Recheck the privacy worksheet, policy owner and public URL, support channel, legal entity, store privacy declarations, and listing copy with their owners.
- [ ] Capture current, real, redacted iOS screenshots from the selected release build. Do not use dashboard demo/empty captures as iOS app screenshots or use placeholder templates.
- [ ] Verify public dashboard views are anonymous, query-only, and exactly allowlisted. Keep the dashboard empty if no approved public observation exists; do not promote demo records as monitoring data.
- [ ] Refresh this repository's README, metric ledger, portfolio text, screenshot attribution, and release notes against the final release SHA. Preserve the 300-hour figure as a **planning target**; claim worked hours only from reconciled dated records.
- [ ] Perform final independent human review and record the release decision. A green build or approved observation alone does not prove a completed public release.
