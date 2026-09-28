# Project metrics and claim ledger

**Evidence cutoff:** 2026-09-28, evening UTC. Each claim below names its source and its limit. Recheck any claim against a later release SHA before reusing it. "Public-safe" means an aggregate can be stated publicly, not that the underlying private records can be shared.

## Release identity

| Item | Value |
| --- | --- |
| iOS release candidate | **1.0.0 (17)**, bundle `org.centralpawatershed.mobile`, tag [`ios-1.0.0-b17`](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/tree/ios-1.0.0-b17) at `5efd92699bb71199e7bbcdd887bc89497ecb4034` |
| Web and backend source | Integration after PR #49 (QC and dashboard map work) and PR #50 (QC webpack build). No iOS, rules, function, validation or configuration source changed after `5efd926`, so build 17 remains the iOS candidate. |
| Release PR | [PR #34](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/pull/34) (integration → `main`), draft, awaiting human approval |

## Supported claims

| Claim | Evidence | Limit |
| --- | --- | --- |
| **iOS 1.0.0 (17) is in TestFlight internal testing.** | [Release run 36444283202](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/actions/runs/36444283202) checked out the pinned tag, proved the exact SHA, ran unit tests, archived, verified bundle/version/build/team and uploaded. [App Store Connect readback 36448724894](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/actions/runs/36448724894): processing `VALID`, internal `IN_BETA_TESTING`, export compliance answered. | Internal testing only. Not submitted for App Store review. |
| **Normal CI and CodeQL are green at the release source.** | At `5efd926`: 14/14 checks, including iOS native (unit tests and unsigned release archive) and CodeQL for Swift, Kotlin, JavaScript/TypeScript, Python and Actions. Web changes after it passed the same PR checks before merging. | GitHub's managed AI Scan fails before analysis on an unsupported model ([issue #47](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/issues/47)). It returned no findings and is not a pass or a security review. Android native CI is deferred. |
| **Automated test counts.** | iOS: 30 unit tests, 3 UI workflow tests (emulator-backed). Backend: 47 contract, 17 publication, 45 Firestore rules, 6 Storage rules, 7 validation, 17 review lifecycle, 1 trigger, 8 profile. Dashboard: 7 adapter tests and visual QA at 4 viewports in demo and empty modes. | Counts from runs on 2026-09-28; they change as tests are added. |
| **Firebase development backend is deployed from reviewed source.** | Firestore rules and the `validateSubmittedObservation` and `updateMyDisplayName` functions deployed from `1ac4347` (backend source identical at the current head); the live ruleset was read back identical to `firebase/firestore.rules`. The read-only reviewer-access gate passed with no account locked out. | The ArcGIS publisher function is intentionally not deployed. No Storage rules release exists; media is deferred and the default bucket does not exist. |
| **QC Console and public dashboard are deployed to development.** | App Hosting rollouts at the current integration source, verified by build source hash and 100% traffic. Live dashboard smoke test: production mode, reads only the public views, no demo banner, no test data, no console errors, no overflow at four viewports. | Development environment. |
| **Four anonymous ArcGIS public views, query-only, currently empty.** | Anonymous REST readback 2026-09-28: each view reports capability `Query`, 0 records, and fields that exactly match the dashboard's fail-closed allowlist. The private authoritative service refuses anonymous access (HTTP 499, token required). | Empty because no observation has been approved and published. Not proof of a publication. |
| **Review workflow works end to end on emulators.** | Browser QA through the real QC review route against seeded emulator records: collector account refused ("Not authorized"); queue, record, revision history and correction reason shown; approve, request correction and reject recorded; queue empties; revision 1 unchanged after revision 2 is approved; reasons stored in the audit trail. 24/24 checks. | Emulator evidence. The live physical-iPhone and reviewer run is manual and is recorded separately when complete. |
| **Water temperature is the only confirmed required measurement.** | [`production_measurement_catalog.json`](../config/production_measurement_catalog.json), [iOS product contract](IOS_PRODUCT_CONTRACT.md), [supervisor question register](SUPERVISOR_QUESTIONS.md). | Other requirements wait for the research supervisor's decision. |
| **300 hours is a Fall 2026 planning target.** | [Semester plan](../project-control/SEMESTER_WORK_LOG.md): 15 weeks × 20 planned hours. | A schedule, not a record of completed time. |

## Claims held back

- **A published scientific observation.** None exists. It needs an authorized, provenance-cleared, non-test reading, a human scientific decision, and readback through the private service, public views and dashboard.
- **Live physical-iPhone and reviewer proof.** Build 17 is installed on a physical iPhone from TestFlight. The collector → review → correction → approval and rejection run on live test accounts is a manual step still to be recorded.
- **Clean independent review.** Five UltraReview findings were reported on 2026-09-28. Two were matched to fixes; the texts of findings 3–5 were never retrieved from the cloud session, and the project owner waived recovering them on 2026-09-28. They are unavailable evidence, not resolved findings.
- **Users, adoption, environmental impact, institutional endorsement or completed hours.** Nothing in the repository establishes any of these.
- **Android release.** Deferred until after the iOS milestone.

## Evidence handling

Screenshots and their sources are listed in [image provenance](images/portfolio/README.md). Demo mode is labeled on screen; emulator screenshots contain only emulator test identities. Test observations on the development project stay private and are never published.
