# PA Watershed Watch — release verification

Checked 2026-09-25. This records what was actually verified. Passing software tests do not establish a scientific publication or a finished public release.

| Surface | Result | Evidence and limit |
|---|---|---|
| GitHub finalization | PASS on prior PR head | [PR #35](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/pull/35) had 5/5 successful checks; the [full CI retry](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/actions/runs/36096251241) passed all five jobs on attempt 2. Recheck on this report's updated commit. |
| GitHub integration | PASS on prior integration head | [PR #34](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/pull/34) had 16/16 successful checks; it remains a draft targeting `main`. |
| Local scientific contracts | PASS | `bash scripts/dev.sh contracts`: 30 validation, 15 publication, and 2 provisioning privacy tests. |
| Firebase rules, validation, review, trigger | PASS | `bash scripts/dev.sh emulators`: 42 Firestore-rule, 6 Storage-rule, 7 validation persistence/orchestration, 16 reviewer lifecycle, and 1 Firestore-trigger tests passed. The first local attempt stalled on iCloud placeholder dependencies; reinstalling the existing lockfile dependencies resolved it. |
| QC Console and public dashboard | PASS locally | `bash scripts/dev.sh web-checks`: six public adapter tests, both TypeScript checks, and both production builds passed after dependency updates. |
| Production dependency audit | PASS for known production advisories | `npm audit --omit=dev` in the backend, `web/`, and `public-dashboard/` reports zero vulnerabilities after targeted patched dependencies. The backend's full development-tool audit still reports three moderate advisories in the Firebase CLI's OpenTelemetry/PubSub dependency chain; npm offers no nonbreaking fix. Reassess when that CLI dependency is patched. |
| Firebase development project | CONNECTED | CLI selected `central-pa-watershed-dev`; the `validateSubmittedObservation` Node 22 function is ACTIVE, both App Hosting backends are configured from this GitHub repository, and both development site URLs returned HTTP 200. This is configuration/availability evidence, not a fresh deployment or reviewer sign-in. |
| iOS | CI PASS / device PENDING | CI iOS job passed; signed TestFlight `0.1.0 (13)` is in beta. Physical iPhone install, durable draft, sign-in, and private test submission remain unverified. |
| Android | CI PASS | Android unit, lint, build, and emulator instrumentation completed in the full CI retry. No claim of a new physical Android device test. |
| ArcGIS publication | SOFTWARE VERIFIED / LIVE PROOF PENDING | Approved-only publisher and four public-safe views are documented in [Phase 12](PHASE12_ARCGIS_PUBLICATION.md). Fresh item-scoped OAuth, exact-item privacy verification, authorized non-test approval, and end-to-end publication remain gates. |
| Repository security alert | PATCHED LOCALLY / SCAN PENDING | The privileged TestFlight workflow no longer accepts issue-comment release commands; it now uses explicit `workflow_dispatch` input. [CodeQL alert #1](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/security/code-scanning/1) remains open on the default branch until the fix reaches the main-branch scan and its resolution is confirmed. |

The separate GitHub AI code-scanner failure attempted an unavailable model; it is not evidence of a code finding. TEST-014 is controlled development data, and the historical 117-record/5-site inventory has unresolved provenance. Neither may be used as the first public scientific proof.

Next gates, in order: review and merge the finalization PR into integration; verify CI on that combined commit; complete physical iPhone and real-reviewer evidence; verify exact ArcGIS item scope and privacy; approve and trace one provenance-cleared non-test observation; then reconcile, test, tag, and publish the final `main` release. See [the active checklist](../project-control/RELEASE_GATES.md).
