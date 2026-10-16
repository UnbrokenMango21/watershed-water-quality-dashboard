# Supervisor implementation and verification ledger

This ledger distinguishes source implementation, isolated workflow evidence, and live release evidence. Dates and SHAs are snapshots, not continuing assurances.

## Repository and environment audit

- Requested canonical worktree: `/Users/parth/Developer/PAWatershedWatch-supervisor-feedback`.
- Branch: `feat/supervisor-feedback-2026-10-15`; initial clean head `b9580c91fb1e8da7f529e5e14ab5eb2cd7ab7ee7`.
- Refreshed `origin/main`: `741b415114089ee8736e2ad9065d913b1acdf6bf`. Initial comparison: main is an ancestor; 192 feature-side commits, zero main-only commits.
- Reconciled 39 later integration commits by fast-forward to `436447c560055e8437d5983f00dded34cea0fd3d`. No history rewritten. Temporary shelving covered only this session's dependency changes and was restored without conflict.
- Original `design/brand-system-overhaul` worktree preserved; its untracked Android Gradle JVM configuration was not touched.
- Existing Phase 12 approved-only publisher, private/public ArcGIS boundary, native release source, QC map, dashboard map, and trusted transaction path preserved.
- Node 22.23.2, npm 10.9.8, Xcode 27.0 and Java 25 are installed. Commands explicitly select Node 22 because the IDE monitor otherwise has a different Node path.
- GitHub access works; main reported no branch protection. This does not waive the user's required test and independent-review gates.
- Two Firebase App Hosting backends exist in `us-central1`: `qc-console-dev` rooted at `web`, and `public-dashboard-dev` rooted at `public-dashboard`. Live traffic branch and deployed SHAs still require explicit readback; backend existence does not establish deployment.

## Current architecture

Native SwiftUI iOS and Jetpack Compose Android retain local scientific records and authenticate against `central-pa-watershed-dev`. Private Firestore revisions are validated by trusted Cloud Functions. The private Next.js QC application reads authorized records and sends decisions through its existing revision-aware Admin SDK transaction. Human approval permits the server publisher to write the private authoritative ArcGIS service; restricted public views feed the anonymous Next.js/Calcite dashboard. Approval and publication success remain separate states.

## Account risk assessment

**COMPLETE & VERIFIED** — Read-only Auth/Firestore inventory, no mutations. Two designated identities exist and are enabled, but both have unverified email addresses, password-only provider identities, no role claims, and no server profile. The ignored inventory records historical UID references and orphan profiles without recreating accounts or rewriting attribution. Authenticated inventory stays outside Git in permission-restricted `artifacts/identity/` reports; only aggregate findings belong here.

**BLOCKED — USER INPUT REQUIRED** — Each designated person must verify ownership through Firebase's email verification/sign-in flow before privileged provisioning. No ADMIN or QC_REVIEWER grant was executed. No test accounts were recreated, disabled, or deleted. Existing historical records must remain attributable even when the original Auth identity is absent.

The original maintenance scripts were unsafe for the new directive: cleanup selected all accounts other than one email, and bootstrap did not require verified ownership. Their replacements are independently tested, default to read-only behavior, protect both designated identities, require explicit UID-bound reviewed operations, and do not offer account deletion.

## Handoff (2026-10-15/16)

Codex stopped on a usage limit with all work uncommitted. Claude audited it, preserved it as attributed baseline commits (`85c1813`–`949a35c`), re-ran every claimed check and completed the work on the same branch. Codex's "membership 12/12" was the whole profile suite (22 tests today); its coordinate 8/8 was confirmed. One release blocker was found: iOS wrote measurement provenance fields the Firestore rules rejected, so every iOS measurement write would have failed (fixed in `646c5ee`).

## Completion checklist

Status vocabulary: **COMPLETE & VERIFIED** (implemented and proven by automated and/or real-workflow evidence at the stated level), **IMPLEMENTED — AWAITING VERIFICATION**, **BLOCKED — USER INPUT REQUIRED**. Simulator, emulator and local-browser evidence is not proof of a physical device, a live reviewer decision or a deployment.

| Workstream | Status | Evidence / remaining work |
| --- | --- | --- |
| Preserve worktree, reconcile history, preserve Codex work | COMPLETE & VERIFIED | Fast-forward only; Codex changes committed as attributed baselines; no history rewritten |
| Account inventory and safe maintenance tooling | COMPLETE & VERIFIED | Read-only inventory (Codex); tooling tests 9/9; no deletion path; bootstrap now records a settled request so the designated reviewer can be revoked from the console |
| Verified membership, reviewer requests and decisions | COMPLETE & VERIFIED (emulators + local browser) | Membership emulator tests; browser workflow: registration, verification gate, pending, approval reaching the queue without manual refresh, revocation, re-request, decline with reason |
| Live designated role provisioning (`pzc5420@psu.edu` ADMIN, `fpp5057@psu.edu` QC_REVIEWER) | BLOCKED — USER INPUT REQUIRED | Each person must verify email ownership; then a trusted operator runs `scripts/ensure_dev_admin.mjs` with `--uid`, `--confirm-grant` and a private verification reference |
| Email/password sign-in, reset, sign-out, verification | COMPLETE & VERIFIED (local browser) | QC registration/sign-in/reset/verification gate browser-tested; mobile flows unchanged from the release candidate |
| Google, Microsoft, Apple, phone, passwordless providers and in-app account linking | BLOCKED — USER INPUT REQUIRED | Provider enablement could not be confirmed (the read-only console check was refused by the session's permission policy). No unconfigured provider button is shown; collisions show a recovery message. Confirm which providers are enabled, OAuth clients, Apple entitlement and authorized domains before adding buttons |
| Onboarding, single Method / Instrument field, visual observations, optional numeric values, water depth (iOS + Android) | COMPLETE & VERIFIED (unit + simulator/emulator) | iOS 49 unit tests; Android 35 unit + 6 instrumented tests. The emulator-backed iOS UI journey (`scripts/dev.sh ios-ui`) could not complete on the final head: Claude Code stopped it when the Mac ran critically low on memory (not a test failure). Re-run it before a TestFlight build |
| Field → lab → submission workflow with analysis provenance | COMPLETE & VERIFIED (rules, engine, unit) | Rules 53/53 (provenance, field exception, legacy contract, no schema downgrade); engine 23/23; both apps' golden payload tests; pre-upgrade offline queues replay under the legacy contract. Cross-device draft discovery is not implemented |
| Shared discussion and correction requests | COMPLETE & VERIFIED (web, local browser); IMPLEMENTED — AWAITING VERIFICATION (mobile screens) | Browser workflow: reviewer question, trusted correction request in the thread, collector reply seen live, collector denied the private record. Mobile discussion screens are unit/compile-verified only |
| Site-coordinate proposals | COMPLETE & VERIFIED (web, local browser); IMPLEMENTED — AWAITING VERIFICATION (mobile screens) | Browser workflow: proposal, approval into the private catalog, original coordinates and audit; correction clears publication clearance (emulator test) |
| QC queue, history, filters, pending-approval screen, separation of duties | COMPLETE & VERIFIED (unit, emulators, local browser) | Queue filter tests; review suite 18/18 including own-submission refusal; browser checks; accessibility fixes (contrast, map region) |
| Authenticated supervisor history workspace | COMPLETE & VERIFIED | QC "All history" mode with site, collector, status, watershed, stream, lab and date filters |
| Public dashboard: USGS watershed context, watershed filter, water depth, states | COMPLETE & VERIFIED (tests, builds, desktop/laptop browser) | Dashboard tests 10/10, typecheck/build; local visual QA passed desktop and laptop; tablet/phone run in CI on the PR |
| Stream filtering on the public dashboard | BLOCKED — USER INPUT REQUIRED | Needs an authoritative stream attribute (NHDPlus/3DHP) and a reviewed public-view schema change (supervisor question 15) |
| Code-side scientific reconciliation | COMPLETE & VERIFIED | docs/SCIENTIFIC_SCHEMA_RECONCILIATION_2026-10-15.md; golden payload keys checked against rules allowlists by test |
| Excel workbook reconciliation | BLOCKED — USER INPUT REQUIRED | Workbook not supplied |
| Dependency remediation | COMPLETE & VERIFIED | Patch-level updates within ranges; all suites and builds pass; retained upstream advisories documented |
| Independent code/security review | COMPLETE & VERIFIED | Two independent passes (three reviewers each: backend/security, web, mobile; then security/permissions, scientific integrity, deployment configuration). No critical findings; every finding fixed with tests or recorded as a decision in docs/SUPERVISOR_QUESTIONS.md |
| Push, pull request, CI | COMPLETE & VERIFIED | PR #52 (https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/pull/52); all 15 checks pass (backend contracts and rules, QC web, dashboard build, dashboard visual QA demo and empty, iOS native, Android native with emulator instrumentation, CodeQL for five languages, publication contract, hygiene) |
| Merge into `main` | BLOCKED — USER INPUT REQUIRED | Not merged: awaiting human review of PR #52, a decision on merging the 231 integration commits (draft PR #34) with it, and the iOS UI-journey re-run below |
| Deployments (Functions, Firestore rules/indexes, QC and dashboard App Hosting) | BLOCKED — USER INPUT REQUIRED | Not performed. The six new callables are not deployed; the QC backend's configured rollout branch no longer exists. See docs/RELEASE_PLAN_2026-10-16.md |
| Apple release | BLOCKED — USER INPUT REQUIRED | No TestFlight/App Store status is claimed |

## Verification evidence (final branch head)

All results below are from the final branch head on 2026-10-16, run locally with Node 22.23.2, Xcode 27.0 (iPhone 18 Pro simulator) and an Android 14 emulator.

| Check | Result |
| --- | --- |
| `npm run test:contracts` | 65 pass, 0 fail, 3 skipped (the emulator-only profile tests, run below) |
| `npm run test:publication` | 19/19 |
| Provisioning privacy (`python3 -m unittest`) | 2/2 |
| `scripts/dev.sh emulators`: Firestore rules / Storage rules / validation persistence / review / trigger / profile | 53/53, 6/6, 7/7, 18/18, 1/1, 22/22 |
| `scripts/dev.sh web-checks`: dashboard tests, QC typecheck + production build, dashboard typecheck + production build | 10/10, PASS, PASS |
| QC unit tests (`tests/qc/*.test.mjs`) | 12/12 |
| iOS unit tests (`PAWatershedWatchTests`) and Release simulator build | 49/49, PASS |
| Android unit tests, lint, assembleDebug; instrumented tests | 35/35, PASS, PASS; 6/6 |
| Real browser, local emulators: `tests/qc/identity-workflow.mjs` | 7/7 (sign-in a11y/layout at 1440/820/390, failed login, verified registration, pending, approval without manual refresh, revocation, re-request and decline) |
| Real browser, local emulators: `tests/qc/collaboration-workflow.mjs` | 7/7 (provenance and visual observations at three widths, reviewer question, correction request, live collector reply, private-record denial, coordinate proposal approval) |
| Public dashboard visual QA (demo mode, local) | Desktop and laptop PASS; tablet/phone run stalled locally on live map tiles and is covered by the CI workflow on the PR |
| iOS emulator-backed UI journey (`scripts/dev.sh ios-ui`) | Partial. Name change and draft relaunch: PASS. First run through correction: completed account, measurements, submission, the real QC correction request and the correction revision in one run, but the final sync stayed at "Syncing"; a second run stalled at the first submission. Large text: the simulator returned no location (CoreLocation reported location unknown to MapKit as well). The host was swapping heavily (5.5 GB of 7 GB swap in use) during every run, which explains the stalls, but a sync hang is not ruled out: re-run on a machine with free memory before TestFlight |

Evidence screenshots and JSON results are written to the git-ignored `artifacts/supervisor-qa/`.
