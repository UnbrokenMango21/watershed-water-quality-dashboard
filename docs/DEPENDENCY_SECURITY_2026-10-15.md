# Dependency security audit — 2026-10-15

Status: **IMPLEMENTED — AWAITING VERIFICATION**. Compatible dependency fixes are installed and lockfiles updated. Remaining upstream advisories are explicitly retained below. This report does not establish deployment or complete workflow verification.

## Scope and method

Audited the six committed npm projects: root Functions/tooling, `web`, `public-dashboard`, `tests/firestore-rules`, `tests/validation-firestore`, and `tests/review`. Initial `npm audit --json` results were captured before remediation; the branch was then fast-forwarded to `436447c` to preserve existing integration work before finishing dependency changes. Public registry/advisory information was checked on 2026-10-15.

Commands used `node v22.23.2` / `npm 10.9.8` for compatible lockfile updates and verification. The first root Firebase CLI install used the command monitor's Node 24 environment; subsequent commands explicitly selected Node 22. No dependency lifecycle scripts, cloud deployments, account changes, forced fixes, or new overrides were used. Existing `uuid`, `qs`, and PostCSS overrides were preserved.

Counts below are npm's affected-package counts, including propagated parent-package findings; they are not independent vulnerability counts.

| Project | Initial findings | After remediation | Production/dev applicability |
| --- | --- | --- | --- |
| Root | 17: 1 critical, 12 high, 4 moderate | 5: 3 high, 2 moderate | `npm audit --omit=dev --json`: **0 findings**. Remaining five are Firebase CLI development tooling. |
| QC `web` | 8: 7 high, 1 moderate | 4 high | One retained Node gRPC dependency produces four propagated findings. Browser-only Firebase client usage does not expose the advisory's gRPC server authentication path. |
| `public-dashboard` | 3: 2 high, 1 moderate | **0 findings** | Public runtime and build tree audited. |
| Firestore rules tests | 5 high | 5 high | Same retained Firebase-client gRPC issue; test-only project. |
| Validation Firestore tests | 9: 3 high, 6 moderate | **0 findings** | Test-only project. |
| Review tests | 9: 2 high, 7 moderate | **0 findings** | Test-only project. |

`npm audit` correctly exits 1 in the three scopes with retained advisories. Those results have not been bypassed or relabeled as a clean audit.

## Applied fixes

| Change | Reason and compatibility |
| --- | --- |
| QC Next.js `16.3.6` → `16.3.8` | Patch release covering reported cache poisoning, metadata-route disclosure, development MCP disclosure, Draft Mode caching, and image-optimization SSRF ranges. Kept the existing major/minor and webpack build configuration. |
| Dashboard Next.js `15.5.26` → `15.5.28` | Patch release covering reported SSG/ISR cache poisoning ranges; preserved Next.js 15. |
| Dashboard and QC Sharp `0.35.4` → `0.35.5` | Fixes upstream librsvg memory-safety issue; QC receives this through Next's permitted optional dependency range. |
| Both web projects' `source-map-js` `1.2.1` → `1.2.2` | Compatible transitive patch for indexed-source-map denial of service. |
| Root Firebase CLI `15.31.0` → `15.34.0` | Compatible minor release removes the vulnerable `proxy-agent` / `get-uri` / `basic-ftp` subtree. |
| Root `proxy-addr` `2.0.7` → `2.0.8` | Compatible fix for critical IP spoofing advisory. No application trust-subnet configuration using the affected form was found, but the vulnerable runtime package is removed. |
| Root/Admin test gRPC `1.14.4` → `1.14.6`; Busboy → `3.2.3` | Compatible transitive fixes for gRPC certificate handling/error disclosure and multipart parser advisories. |
| Root MCP SDK → `1.32.1`, compression → `1.8.2`, ip-address → `10.7.4`, Undici → `6.29.1` / `8.12.2`, brace-expansion → `2.1.7` / `1.1.21` | Targeted updates within their parent dependency constraints. Removed the corresponding audit findings. |
| Validation/review test Firebase Admin `14.2.0` → `14.5.0` | Fits existing `>=13 <15` declarations and matches the QC Admin version. Its supported dependency tree removes old Storage/UUID chains. Package declarations were not broadened. |

Direct dependency changes were explicit installs with exact versions. Transitive remediation used targeted `npm update --ignore-scripts` commands. No `npm audit fix --force` or cross-range substitution was used. Test Firebase Admin's supported update changes its own Google Cloud dependency majors; integration verification is therefore required, not inferred from the successful install.

## Retained upstream findings and exposure

### Firebase client / gRPC (high; QC and rules-test dependency trees)

Firebase `12.17.1` pins `@firebase/firestore`'s Node gRPC transport to `~1.9.0`, resolving `@grpc/grpc-js 1.9.16`. Registry inspection of Firebase `12.19.0` and `13.0.0` still shows the same gRPC constraint. The patch is available in gRPC `1.13.6` / `1.14.5`, outside that upstream constraint. npm's suggested downgrade to Firebase 9 / old rules tooling is not an acceptable supported fix, and no gRPC override was forced.

The [certificate authorization advisory](https://github.com/advisories/GHSA-m9gg-hp2v-232j) requires running a gRPC server that uses `getAuthContext` for authentication with optional client certificates. The [error disclosure advisory](https://github.com/advisories/GHSA-f596-whhp-79r4) also concerns gRPC servers. Repository searches found no `getAuthContext` or gRPC server credential construction. `web/lib/firebase-client.ts` is explicitly browser-only; server routes use Firebase Admin, whose gRPC copy is patched. Rules tests are gRPC clients against the local emulator. Consequently the reported server attack conditions are not present in the inspected application paths. The package remains flagged and must be revisited when Firebase publishes a compatible transport update or application usage changes.

### Firebase CLI / braces (high; development only)

Firebase CLI → Chokidar → `braces 3.0.3` remains affected by [deeply nested pattern stack exhaustion](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). The advisory lists no patched version. The CLI processes local project/watch patterns; no public application request handler calls this package. This is a development/tooling risk when handling untrusted project patterns. Do not treat the CLI as a service for arbitrary untrusted input. npm's suggested CLI downgrade is not a justified remediation.

### Firebase CLI / OpenTelemetry (moderate; development only)

Firebase CLI → `@google-cloud/pubsub 5.3.1` → `@opentelemetry/core 1.30.1` remains affected by [oversized inbound W3C Baggage allocation](https://github.com/advisories/GHSA-8988-4f7v-96qf). The patch is `2.8.0`; Pub/Sub currently requests `^1.30.1`, so a forced major replacement was avoided. This dependency is absent from the root production-only audit. No production application Baggage extraction path through this CLI tree was found. Keep emulator/tooling access local and reassess on an upstream compatible update.

## Important fixed-advisory context

- [Next.js image SSRF](https://github.com/advisories/GHSA-cjq9-62q9-8jv4) requires configured remote image patterns; neither Next config currently declares them. The package was patched regardless.
- [Sharp/librsvg](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) concerns SVG decoding under particular Linux runtime conditions. No application Sharp upload/decoder call was found; Next's installed image dependency was still patched.
- [proxy-addr](https://github.com/advisories/GHSA-jqcg-44mw-7w3h) requires affected IPv4-mapped IPv6 trust-subnet configuration; no matching application configuration was found. The runtime package was patched.
- [source-map-js](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) concerns parsing attacker-controlled indexed source maps. No such public ingestion route was found; the build/runtime dependency was patched.

## Verification evidence

| Check | Result |
| --- | --- |
| Six `npm audit --json` runs after remediation | PASS for completed inventory; retained findings exactly as listed above. |
| Root `npm audit --omit=dev --json` | PASS: zero findings. |
| `npm run test:contracts` first run during science changes | FAIL: 46/47 passed; only catalog expectation missing concurrently added `waterDepth`. Requires rerun after schema/test changes settle. |
| `npm run test:publication` | PASS: 17/17; includes immutable revision, concurrent lease, approved-only and fail-closed public clearance cases. |
| `npm run test:profile` | PASS: 5/5 at the time of this baseline run. |
| `python3 -m unittest discover -s tests/publication -p '*_test.py'` | PASS: 2/2 provisioning privacy cases. |
| `npm test --prefix public-dashboard` | PASS: 7/7; includes public-schema fail-closed behavior, empty observations and no demo fallback. |
| QC clean install and typecheck | PASS: Node 22 `npm ci --ignore-scripts --no-fund --prefix web`, then `npm run typecheck --prefix web`. The clean install repaired missing declarations left by an interrupted installation; the official Firebase tarball was verified to contain them. |
| QC/dashboard production builds and dashboard typecheck | Coordinated by the implementation lead after installs; do not infer PASS from package installation. |
| Firebase emulator suites | Pending scientific fixture migration; must run before final integration acceptance. |
| Browser/native workflow checks | Required independently; dependency audit is not workflow proof. |

Raw audit JSON is held outside Git under `/tmp/watershed-dependency-audit-2026-10-15`. It contains public package/advisory metadata only. No authenticated inventory, credentials, or environment files were added to this report.

## Read-only refresh — 2026-10-16

Six fresh npm audit reports under `/tmp/pww-security-refresh-2026-10-16/` retain the same post-remediation counts: root 5 (3 high, 2 moderate), QC 4 high, Firestore-rules tests 5 high; dashboard, validation tests and review tests 0. Applicable exposure and upstream constraints remain as assessed above. No forced override, unsupported downgrade or new dependency change was introduced. QC/dashboard typechecks and production builds pass after this refresh. The earlier production-only root audit is dated evidence; this refresh used full dependency trees.
