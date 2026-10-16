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

## Implementation sequence and completion checklist

| Workstream | Status | Evidence / outstanding work |
| --- | --- | --- |
| Preserve worktree and reconcile integration history | COMPLETE & VERIFIED | Git status, ancestry and fast-forward above |
| Private account inventory and safe maintenance tooling | COMPLETE & VERIFIED | Read-only inventory; focused maintenance tests |
| Canonical verified membership and reviewer request decisions | IMPLEMENTED — AWAITING VERIFICATION | New callables, pending/denied/suspended/revoked screens, admin decision UI; full browser and rules verification pending |
| Live designated role provisioning | BLOCKED — USER INPUT REQUIRED | Both identities need verified ownership |
| Provider readiness and secure linking | IMPLEMENTED — AWAITING VERIFICATION | Existing native Google/email flows retained; provider configuration, entitlement and linking audit in progress; no new unconfigured buttons enabled |
| Onboarding, method simplification, visual observations, optional numeric measurements, depth | IMPLEMENTED — AWAITING VERIFICATION | Coordinated native/rules/validation/publication work in progress; native and schema checks pending |
| Deferred laboratory workflow and cloud draft sync | IMPLEMENTED — AWAITING VERIFICATION | Local durable stage and submit gates in progress; synchronization and cross-device journey pending |
| Cross-platform discussion and correction communication | IMPLEMENTED — AWAITING VERIFICATION | Existing review comments retained; canonical discussion implementation pending |
| Coordinate proposals and trusted catalog approval | IMPLEMENTED — AWAITING VERIFICATION | Domain transaction and UI implementation in progress |
| QC queue, history, site/collector/watershed/status filters | IMPLEMENTED — AWAITING VERIFICATION | Existing workspace retained; expansion pending |
| Geographic provenance, real watershed selection, service failures | IMPLEMENTED — AWAITING VERIFICATION | Public source audit in progress; no authenticated ArcGIS resources changed |
| Public dashboard responsiveness and privacy | IMPLEMENTED — AWAITING VERIFICATION | Existing anonymous approved-only adapter retained; regression workflow pending |
| Code-side scientific reconciliation | IMPLEMENTED — AWAITING VERIFICATION | Field-by-field mapping audit in progress |
| Actual Excel reconciliation | BLOCKED — USER INPUT REQUIRED | No source workbook supplied or found in tracked repository |
| Dependency remediation | IMPLEMENTED — AWAITING VERIFICATION | See dependency security report; builds and final audit pending |
| Full independent review, CI, PR and main merge | IMPLEMENTED — AWAITING VERIFICATION | No candidate has passed release gates yet |
| Exact-SHA deployments and live smoke tests | IMPLEMENTED — AWAITING VERIFICATION | No new deployment performed |
| Apple release | BLOCKED — USER INPUT REQUIRED | No TestFlight/App Store release claimed; Apple confirmation and release authorization remain separate |

Rows marked awaiting verification are unfinished; some still require implementation. The required three-state reporting vocabulary does not imply source completion.

## Verification evidence

- Membership/profile emulator run: **PASS 12/12**, zero skips. Includes verified registration, request idempotency, unauthorized decision rejection, stale request rejection, approval, revocation, membership-version fencing, display-name update and immutable historical attribution.
- Maintenance safety unit tests: **PASS 9/9**.
- QC TypeScript initially failed due to incomplete dependency installation after interrupted install; a clean lockfile-based install restored Firebase declarations. Typecheck **PASS** after repair. No type stubs or weakened checks introduced.
- Other backend, publication, privacy, native, browser and deployment evidence is being collected; do not infer results from these initial passes.
