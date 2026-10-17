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
| Account inventory and safe maintenance tooling | COMPLETE & VERIFIED | Read-only inventory (Codex); identity tooling tests 10/10; no deletion path; bootstrap records a settled request so the designated reviewer can be revoked from the console, and refuses to run over a suspended, declined or revoked account unless a specific reinstatement is approved (`--lift-suspension`, audited) |
| Verified membership, reviewer requests and decisions | COMPLETE & VERIFIED (emulators + local browser) | Membership emulator tests; browser workflow: registration, verification gate, pending, approval reaching the queue without manual refresh, revocation, re-request, decline with reason |
| Live designated role provisioning (`pzc5420@psu.edu` ADMIN, `fpp5057@psu.edu` QC_REVIEWER) | BLOCKED — USER INPUT REQUIRED | Each person must verify email ownership; then a trusted operator runs `scripts/ensure_dev_admin.mjs` with `--uid`, `--confirm-grant` and a private verification reference |
| Email/password sign-in, reset, sign-out, verification | COMPLETE & VERIFIED (local browser) | QC registration/sign-in/reset/verification gate browser-tested; mobile flows unchanged from the release candidate |
| Google, Microsoft, Apple, phone, passwordless providers and in-app account linking | BLOCKED — USER INPUT REQUIRED | Read-only configuration refreshed in the continuation below: email/password and Google enabled; other providers unconfigured. iOS bindings match; Android OAuth client and web authorized domains need setup. In-app linking and external-provider workflow verification remain unfinished; see AUTH_PROVIDER_READINESS_2026-10-16.md |
| Onboarding, single Method / Instrument field, visual observations, optional numeric values, water depth (iOS + Android) | COMPLETE & VERIFIED (unit + Android emulator); iOS simulator journey verified | iOS 53 unit tests (local and CI); Android 38 unit tests (local) and 7 instrumented tests (CI emulator). Full emulator-backed iOS UI suite passed in the continuation; physical-device and additional lab/collaboration screen verification remain separate |
| Field → lab → submission workflow with analysis provenance | COMPLETE & VERIFIED (rules, engine, unit) | Rules 53/53 (provenance, field exception, legacy contract, no schema downgrade); engine 23/23; both apps' golden payload tests; pre-upgrade offline queues replay under the legacy contract. Cross-device draft discovery is not implemented |
| Shared discussion and correction requests | COMPLETE & VERIFIED (web, local browser); IMPLEMENTED — AWAITING VERIFICATION (mobile screens) | Browser workflow: reviewer question, trusted correction request in the thread, collector reply seen live, collector denied the private record. Mobile discussion screens are unit/compile-verified only |
| Site-coordinate proposals | COMPLETE & VERIFIED (web, local browser); IMPLEMENTED — AWAITING VERIFICATION (mobile screens) | Browser workflow: proposal, approval into the private catalog, original coordinates and audit; correction clears publication clearance (emulator test) |
| QC queue, history, filters, pending-approval screen, separation of duties | COMPLETE & VERIFIED (unit, emulators, local browser) | Queue filter tests; review suite 18/18 including own-submission refusal; browser checks; accessibility fixes (contrast, map region) |
| Authenticated supervisor history workspace | COMPLETE & VERIFIED | QC "All history" mode with site, collector, status, watershed, stream, lab and date filters |
| Public dashboard: USGS watershed context, watershed filter, water depth, states | COMPLETE & VERIFIED (tests, builds, desktop/laptop browser, CI visual QA) | Dashboard tests 11/11, typecheck/build; local visual QA passed desktop and laptop; CI visual QA (demo and empty-production) passed on the PR. Map outlines use Esri Living Atlas copies of the USGS boundaries because hydro.nationalmap.gov does not allow browser (CORS) access; selected-site HUC lookups go through the dashboard's own server route |
| Stream filtering on the public dashboard | BLOCKED — USER INPUT REQUIRED | Needs an authoritative stream attribute (NHDPlus/3DHP) and a reviewed public-view schema change (supervisor question 15) |
| Code-side scientific reconciliation | COMPLETE & VERIFIED | docs/SCIENTIFIC_SCHEMA_RECONCILIATION_2026-10-15.md; golden payload keys checked against rules allowlists by test |
| Excel workbook reconciliation | BLOCKED — USER INPUT REQUIRED | Workbook not supplied |
| Dependency remediation | COMPLETE & VERIFIED | Patch-level updates within ranges; all suites and builds pass; retained upstream advisories documented |
| Independent code/security review | COMPLETE & VERIFIED | Two independent passes (three reviewers each: backend/security, web, mobile; then security/permissions, scientific integrity, deployment configuration). No critical findings; every finding fixed with tests or recorded as a decision in docs/SUPERVISOR_QUESTIONS.md |
| Push, pull request, CI | COMPLETE & VERIFIED | PR #52 (https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/pull/52); all 15 checks pass (backend contracts and rules, QC web, dashboard build, dashboard visual QA demo and empty, iOS native, Android native with emulator instrumentation, CodeQL for five languages, publication contract, hygiene) |
| Merge into `main` | IMPLEMENTED — AWAITING VERIFICATION | Not merged. User authorizes verified code integration; PR #52 already contains #34 and must preserve its ancestry. Full iOS UI suite now passes; refreshed CI and final review remain gates |
| Deployments (Functions, Firestore rules/indexes, QC and dashboard App Hosting) | BLOCKED — USER INPUT REQUIRED | Not performed. The six new callables are not deployed; the QC backend's configured rollout branch no longer exists. See docs/RELEASE_PLAN_2026-10-16.md |
| Apple release | BLOCKED — USER INPUT REQUIRED | No TestFlight/App Store status is claimed |

## Verification evidence (final branch head)

### Codex continuation — 2026-10-16, after `02a5b24`

Exclusive-writer inspection found a clean checkout and no competing write/build task; the previous Claude process is exiting with no workspace files open. The local Xcode is now **27.1 (27A9275), Swift 6.4**, with the iOS 27.0 simulator runtime. No production deployment, account grant/deletion or scientific publication has been performed.

- Reproduced the numeric-keyboard stall in Correction Revision: XCTest reported `App animations complete notification not received` at 171.45 s after focus at 111.42 s. A process sample showed the app main thread idle throughout 274 samples; this is not evidence of an application CPU loop. The baseline was canceled after the confirmed stall, not reported as a passed test.
- Immediate scroll dismissal was tested and rejected: it caused the numeric field to lose keyboard focus. Explicit dismissal (`.scrollDismissesKeyboard(.never)` on Measurements and Correction Revision, with existing Done/step controls) then completed the **entire submission → correction → N+1 → approval journey in 124.880 s**, zero failures and zero animation-timeout notifications. The full three-test suite then passed with **0 failures in 246.790 s**: submission/correction/approval (123.527 s), accessibility-large first run (61.469 s), and name change plus draft restoration after relaunch (61.795 s). There were zero animation-timeout notifications. Result: `/tmp/pww-ios-ui-full-20261016.xcresult`; extracted screenshots: ignored `artifacts/supervisor-qa/ios-continuation/full-attachments/`. This covers an iPhone 18 Pro simulator, not a physical device or every lab/collaboration screen.
- The UI runner now preserves argument boundaries, uses the existing webpack build, waits for its own QC process and cleans up only that PID. It does not use a broad process-name kill or a live project service for tests.
- Fixed missing watershed coordinates being interpreted as `(0, 0)`. Strict input parsing rejects omitted, blank, duplicate, extra, nonnumeric and out-of-range parameters. Dashboard **12/12 tests, typecheck and production build PASS**; QC typecheck/production build also PASS. Six malformed requests returned HTTP 400 through the built server. Refreshed GitHub CI is pending.
- CI is prepared to test the release **Xcode 26.6** and stable **Xcode 27.0**. Swift CodeQL is pinned to the release toolchain instead of drifting with `macos-latest`. The current-SDK runner image is GitHub's public-preview image; it selects the released Xcode 27.0, not a beta SDK. Actual GitHub verification is pending.
- [Branch audit](GIT_BRANCH_AUDIT_2026-10-16.md): all 49 local/tracking references and 71 distinct non-ancestral commits classified and preserved. PR #52 contains PR #34, so prepare one merge of #52 after its gates pass; do not perform duplicate integration. The user's current directive authorizes verified code merge without an additional merge-scope permission request.
- [Provider readiness](AUTH_PROVIDER_READINESS_2026-10-16.md): read-only live configuration confirms email/password and Google enabled; other requested providers are unconfigured. iOS project/bundle/callback bindings match. Android lacks an OAuth client. App Hosting domains are not authorized for web OAuth. No provider configuration was changed. This replaces the earlier unknown/permission-refused provider inspection result; linking and real external-provider tests remain unfinished.
- Fresh six-project dependency audits match the retained upstream findings in the security report. Public dashboard, validation-test and review-test dependency trees are clean; CLI and Firebase-client advisory counts remain documented, without forced overrides.

Completed incremental Codex Security scan `eeadf8f3-2b18-4474-aabf-17f59af3efc1` reviewed all nine changed files at immutable `02a5b24..b7ed783`, with **zero findings**. Parent source review and an independent second pass agreed. Coverage excludes unrelated unchanged source, credential/environment files, authenticated inventory and live cloud state; this does not replace the prior full-PR reviews or establish deployment security. The sealed report and SARIF remain in the local Codex Security workbench. Host usage attribution is thread-wide (8,087,638 total tokens, including 7,749,248 cached input); it is not isolated elapsed work or cost for this nine-file review. UI evidence is under ignored `artifacts/supervisor-qa/ios-continuation/`, with the successful journey result bundle at `/tmp/pww-ios-keyboard-explicit-20261016.xcresult`.

### Previous checkpoint

Results below are from the final code on 2026-10-16 (`af46e10`; later commits change only a UI-test helper, CI configuration and documentation), run locally with Node 22.23.2, Xcode 27.0 (iPhone 18 Pro simulator) and an Android 14 emulator unless noted. GitHub CI re-ran the backend, rules, QC, dashboard, iOS and Android suites on the pull request.

| Check | Result |
| --- | --- |
| `npm run test:contracts` (includes validation engine 23/23 and identity tooling 10/10) | 75 pass, 0 fail, 3 skipped (the emulator-only profile tests, run below); same result in CI |
| `npm run test:publication` | 19/19 |
| Provisioning privacy (`python3 -m unittest`) | 2/2 |
| `scripts/dev.sh emulators`: Firestore rules / Storage rules / validation persistence / review / trigger / profile | 53/53, 6/6, 7/7, 18/18, 1/1, 22/22 |
| `scripts/dev.sh web-checks`: dashboard tests, QC typecheck + production build, dashboard typecheck + production build | 11/11, PASS, PASS |
| QC unit tests (`tests/qc/*.test.mjs`) | 12/12 |
| iOS unit tests (`PAWatershedWatchTests`) and Release simulator build | 53/53, PASS (CI: 53/53 and unsigned archive on Xcode 16.4) |
| Android unit tests, lint, assembleDebug; instrumented tests | 38/38, PASS, PASS; 7/7 (CI emulator) |
| Real browser, local emulators (at `16ed394`; the later rules/callable fixes were re-verified by the emulator suites): `tests/qc/identity-workflow.mjs` | 7/7 (sign-in a11y/layout at 1440/820/390, failed login, verified registration, pending, approval without manual refresh, revocation, re-request and decline) |
| Real browser, local emulators: `tests/qc/collaboration-workflow.mjs` | 7/7 (provenance and visual observations at three widths, reviewer question, correction request, live collector reply, private-record denial, coordinate proposal approval) |
| Public dashboard visual QA (demo mode, local) | Desktop and laptop PASS; tablet/phone run stalled locally on live map tiles and is covered by the CI workflow on the PR |
| iOS emulator-backed UI journey (`scripts/dev.sh ios-ui`) | **Partial — re-run required on an awake Mac.** Name change and draft relaunch: PASS. First run through correction: in a run with the display on, the app completed account creation, site selection, site observations, measurements, submission, the real QC correction request (collector token refused with 403) and the correction revision; a later run confirmed the submission was acknowledged within seconds and the correction request reached the phone. Open item: on the Measurements and Correction Revision screens, once a decimal-pad measurement field is focused, XCTest stops receiving "animations complete" until the screen is left (60 s timeout per action, observed with the display on). The app defines no repeating animations and the journey still proceeds, so the cause (app layout or the system keyboard) is not yet identified. Every other failure on 2026-10-16 happened while the Mac was asleep with its lid closed on battery: `pmset` shows dark-wake windows of about 45 s, a monitor recorded 756 s of host sleep in one 20-minute run, and the network path dropped on each wake. That accounts for a final sync left at "Syncing", the large-text GPS timeout and an event-synthesis timeout |

Evidence screenshots and JSON results are written to the git-ignored `artifacts/supervisor-qa/`.
