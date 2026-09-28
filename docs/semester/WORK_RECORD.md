# PA Watershed Watch — Semester Work Record

**Prepared:** September 26, 2026  
**Project:** PA Watershed Watch / Central PA Watershed  
**Repository:** `UnbrokenMango21/watershed-water-quality-dashboard`  
**Authoritative integration branch:** `integration/pa-watershed-watch-2026-09`

## Summary

This record is organized for supervisor review and Workday reference. It separates semester work from the substantial summer foundation and does not move pre-semester work into Fall dates.

The first semester week with Workday time shown in the available record is **August 31–September 6**. No hours are claimed here for August 24–30.

| Week | Work dates | Hours | Main focus |
| --- | --- | ---: | --- |
| 01 | Aug 31–Sep 4 | 20 | Mobile app + Firebase workflow refinement |
| 02 | Sep 7–11 | 20 | Project consolidation, data review, ArcGIS/publication preparation |
| 03 | Sep 14–18 | 20 | iOS release work, integration testing, system verification |
| 04 | Sep 21–25 | 20 | Final testing, tooling, documentation, release preparation |
| **Total through Sep 25** |  | **80** |  |

Future weeks are not pre-filled.

---

## Week 01 — August 31 to September 6

**Work performed:** August 31–September 4  
**Hours:** 20  
**Workday status:** Previously entered in Workday

### What I worked on

Completed and reviewed the mobile field-collection application and Firebase workflow, then focused on the remaining field-data decisions needed for the release. This included reviewing which measurements should be required for a minimum viable reading, which measurements can remain optional, and what supporting information should be carried into the final dashboard and review workflow.

### Workday-ready comment

> Completed and reviewed the mobile app and Firebase workflow, then identified the remaining field-data decisions needed for release, including which measurements should be required, which can remain optional, and what information should appear in the final dashboard.

### Evidence

- Workday shows 20 regular hours for Aug 31–Sep 4.
- The Sep 4 Workday history contains a contemporaneous comment describing the mobile/Firebase implementation as complete and the remaining field-workflow questions.
- No Git activity is invented for this week; the Workday record is the primary timing evidence.

---

## Week 02 — September 7 to September 13

**Work performed:** September 7–11  
**Hours:** 20  
**Workday status:** Entered for the Sep 6–19 period

### What I worked on

Organized and consolidated the watershed project into a clearer source of truth, reviewed the existing data and system setup, and prepared the next ArcGIS/publication phase. I reviewed the historical data for suitability and provenance, organized pre-consolidation evidence, and brought the active mobile, Firebase/QC, ArcGIS and dashboard work together on the integration line.

### Workday-ready comment

> Organized and consolidated the watershed project, reviewed the existing data and overall system setup, and completed preparation for the ArcGIS and publication workflow.

### Evidence

- Sep 9 project artifacts include source-of-truth, audit, pre-consolidation and historical-data-suitability records.
- PR #34, **Integrate PA Watershed Watch release line**, was opened Sep 10.
- PR #34 integrates the native mobile apps, Firebase/QC workflow, approved-only ArcGIS publication and public dashboard.

**GitHub:** https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/pull/34

---

## Week 03 — September 14 to September 20

**Work performed:** September 14–18  
**Hours:** 20  
**Workday status:** Entered for the Sep 6–19 period

### What I worked on

Worked on iOS release preparation, dashboard testing, Firebase and ArcGIS integration, system verification and technical documentation. The mobile application reached a working release-candidate state while the remaining work shifted toward final human verification and publication readiness.

Release verification included the Build 13/TestFlight line, automated CI, native iOS/Android checks and a full-system audit of the mobile, backend, QC, GIS, dashboard and privacy boundaries.

### Workday-ready comment

> Worked on iOS release preparation, dashboard testing, Firebase and ArcGIS integration, system verification, and project documentation. The mobile app was brought to a working release-candidate state, with the remaining questions focused on refining the field workflow and final human verification.

### Evidence

- iOS Build 13 (`0.1.0 (13)`) passed 14 native tests, produced a signed archive and was uploaded to TestFlight.
- Build 13 is recorded as valid and in beta testing.
- Sep 19 Antigravity system audit documented the full current-state review.
- Sep 20 local verification recorded 14/14 iOS tests and 3/3 Android connected instrumentation tests, plus Android unit/lint/build checks.
- Current integration CI is green across publication, dashboard, visual QA, CodeQL and the full PA Watershed Watch workflow.

**Selected GitHub evidence:**
- Build 13 workflow: https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/actions/runs/34787514559
- Integration PR: https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/pull/34

---

## Week 04 — September 21 to September 27

**Work performed:** September 21–25  
**Hours:** 20  
**Workday status:** Current Sep 20–Oct 3 period

### What I worked on

Continued final testing and integration across the iOS and Android applications, Firebase/QC workflow, ArcGIS publication setup and project tooling. I also worked through development-environment issues, connected the current engineering/AI toolchain, verified GitHub and Firebase access, set up command-line control of the Windows/Parallels environment, and organized the remaining verification and documentation work.

This work also identified that ArcGIS Pro is not currently installed in the Windows 11 VM, making that a clear environment/setup item rather than an undocumented project blocker.

### Workday-ready comment

> Continued final testing and integration across the mobile apps, Firebase/QC workflow, ArcGIS publication setup and project tooling. Also resolved development-environment issues and organized the remaining verification and documentation work.

### Evidence

- Workday contains 4-hour entries for Sep 21–25, totaling 20 hours for this work week.
- Sep 24–26 project-session evidence shows GitHub/Firebase authentication, Xcode 27, Android SDK/ADB, Claude/Codex/Antigravity, Desktop Commander and Parallels checks.
- The Windows 11 VM and Parallels Tools are controllable from the Mac; ArcGIS Pro installation remains an environment task.
- No hours are claimed for Sep 26–27 in this weekly total.

---

## Pre-semester / summer foundation — not billed as Fall semester time

The project already had a substantial engineering foundation before the semester work record above began. Git history from Aug 8–17 documents:

- platform architecture and data dictionary;
- ArcGIS Pro geodatabase setup and publication planning;
- Firebase security rules and validation testing;
- field-collection application development;
- native Android and native iOS implementation;
- durable Firebase collection;
- trusted QC/reviewer workflow;
- privacy and security hardening;
- CI and TestFlight release tooling.

This work remains part of the technical project history but is **not moved into semester dates or counted toward the 80 semester hours above**.

---

## Current project state

- **iOS:** Build 13 is in TestFlight; automated/native verification is green. Physical iPhone verification remains.
- **Android:** native unit, lint, build and emulator instrumentation verification is green.
- **Firebase:** validation and security contracts are tested; development validation is live.
- **QC Console:** implemented and tested; final real-reviewer login/readback remains a human step.
- **ArcGIS:** private approved-authoritative service and four public-safe read-only views are provisioned; live publisher activation is still gated.
- **Dashboard:** production dashboard is implemented and reads only public-safe ArcGIS views; it remains intentionally empty until a real approved observation is published.
- **Historical data:** the 117-record / 5-site historical dataset remains excluded until provenance is resolved.
- **Scientific publication:** TEST-014 remains controlled test data and is not used as final environmental publication proof.

## Remaining human / release steps

1. Confirm Build 13 on the physical project iPhone.
2. Complete real reviewer sign-in and review/readback.
3. Provision the item-scoped ArcGIS OAuth credential and store it only in Firebase Functions secrets.
4. Use a provenance-cleared non-test observation for the first live publication.
5. Verify private ArcGIS readback, public-view readback, dashboard appearance and retry/idempotency behavior.
6. Merge/tag the release only after those gates are complete.

## Hours status

**Semester hours documented through September 25, 2026: 80.0 hours.**

The 300-hour semester target is not pre-filled. Future weeks will be documented only after the work occurs.
