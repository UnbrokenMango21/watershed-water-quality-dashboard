# Branch reconciliation audit — 2026-10-16

Audit baseline: candidate `02a5b24416129d93626fa04124fe1e74a0920507`; refreshed main `741b415114089ee8736e2ad9065d913b1acdf6bf`. All remote heads were fetched explicitly. The existing remote fetch configuration tracks only the integration branch, so an ordinary fetch is insufficient for release comparisons. No branch or worktree was deleted or rewritten.

## Integration decision

PR #52 contains the complete head of draft PR #34 (`436447c`). Merge #52 once, with a merge commit to preserve the original integration and release history, after its complete verification gates pass. Do not merge or cherry-pick #34 separately. This is a prepared action, not a merge claim. The user has authorized verified non-destructive code integration into main; cloud deployment and scientific approval remain separate gates.

## Complete local/reference inventory

`Unique` counts commits not reachable from the candidate. A nonzero count is not proof that product changes are missing: cherry-picks, merge-only commits and historical operations need individual classification. Remote refs absent from the live GitHub branch listing are retained local tracking references, not active remote branches.

| Reference | Scope | Unique | Disposition |
| --- | --- | ---: | --- |
| `agent/antigravity-public-verification` | local branch | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |
| `agent/claude-final-polish` | local branch | 8 | All eight patches already present (`git cherry` reports `-` for each); do not duplicate. |
| `agent/claude-firebase-readiness` | local branch | 2 | Dated operational documentation; preserve as historical evidence, do not overwrite newer release facts. |
| `chore/release-records-and-firebase-index` | local branch | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |
| `codex/release-readiness` | local branch | 11 | Dated operational documentation; preserve as historical evidence, do not overwrite newer release facts. |
| `design/brand-system-overhaul` | local branch | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |
| `docs/final-publication-pass` | local branch | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |
| `docs/publication-ready-repository` | local branch | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |
| `docs/release-checklist-order` | local branch | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |
| `feat/supervisor-feedback-2026-10-15` | local branch | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |
| `feature/arcgis-map-context` | local branch | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |
| `fix/mobile-demo-warning` | local branch | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |
| `fix/public-dashboard-connection` | local branch | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |
| `fix/qc-webpack-build` | local branch | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |
| `fix/testflight-admin-key-bootstrap` | local branch | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |
| `fix/validation-trigger-deploy-gate` | local branch | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |
| `integration/pa-watershed-watch-2026-09` | local branch | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |
| `origin/agent/antigravity-public-verification` | live remote | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |
| `origin/agent/claude-firebase-readiness` | live remote | 2 | Dated operational documentation; preserve as historical evidence, do not overwrite newer release facts. |
| `origin/agent/claude/final-red-team` | retained tracking ref | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |
| `origin/agent/codex/finalization-2026-09-24` | retained tracking ref | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |
| `origin/chore/release-records-and-firebase-index` | retained tracking ref | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |
| `origin/codex/release-readiness` | live remote | 11 | Dated operational documentation; preserve as historical evidence, do not overwrite newer release facts. |
| `origin/concept/public-dashboard-codex-v2` | live remote | 8 | Eight isolated experimental/synthetic dashboard commits; keep separate from the proven production application. |
| `origin/design/brand-system-overhaul` | live remote | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |
| `origin/docs/final-publication-pass` | live remote | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |
| `origin/docs/publication-ready-repository` | live remote | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |
| `origin/docs/release-checklist-order` | live remote | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |
| `origin/feat/supervisor-feedback-2026-10-15` | live remote | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |
| `origin/feature/arcgis-map-context` | retained tracking ref | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |
| `origin/final/public-dashboard-v1` | live remote | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |
| `origin/fix/codeql-nested-android-build` | live remote | 2 | Two workflow commits; their nested native manual-build behavior is already in the current CodeQL workflow. |
| `origin/fix/ios-correction-pending-sync-guard` | live remote | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |
| `origin/fix/ios-correction-resubmit-ack` | retained tracking ref | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |
| `origin/fix/mobile-demo-warning` | retained tracking ref | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |
| `origin/fix/public-dashboard-connection` | retained tracking ref | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |
| `origin/fix/qc-webpack-build` | live remote | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |
| `origin/fix/testflight-admin-key-bootstrap` | retained tracking ref | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |
| `origin/fix/validation-trigger-deploy-gate` | retained tracking ref | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |
| `origin/integration/pa-watershed-watch-2026-09` | live remote | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |
| `origin/main` | live remote | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |
| `origin/ops/asc-existing-app-audit` | live remote | 30 | Thirty historical App Store/EAS/signing operations; preserve release evidence, do not reactivate credential recovery or old release tooling. |
| `origin/ops/firebase-control` | live remote | 9 | Nine historical live-repair/audit/patch workflows; preserve references, do not reintroduce live repair or backfill side effects. |
| `origin/ops/permanent-testflight-ci` | retained tracking ref | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |
| `origin/phase12/arcgis-publication-dashboard-v1` | retained tracking ref | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |
| `origin/release/ios-existing-app-v0.1.0-b10` | live remote | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |
| `origin/release/ios-existing-app-v0.1.0-b11` | live remote | 1 | One release merge commit; no unique files relative to its merge base; underlying correction guard is integrated. |
| `origin/release/ios-existing-app-v0.1.0-b12` | live remote | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |
| `origin/release/ios-existing-app-v0.1.0-b13` | live remote | 0 | Contained in candidate; preserve release/deployment/worktree dependencies before any retirement. |

## Unique commit inventory

Each non-ancestral reference was inspected with its complete commit list and changed-file inventory. The list below preserves every distinct non-ancestral commit (duplicates across local/remote refs appear once).

### `agent/claude-final-polish`

- `37bf2da49e` — feat(profile): add secure self-service display-name update
- `f5d0c99bf6` — tools: add read-only siteCatalog audit for legacy test-site cleanup
- `a55baaa1b5` — docs: add supervisor question register and real-site import plan
- `fdda2a0ec5` — feat(ios): 1.0 collector experience — onboarding, identity, site map, method and review
- `2a9408d559` — test(ios): emulator-backed end-to-end collector workflow UI tests
- `b5d4f79e8b` — feat(ios): name-change and draft-relaunch coverage, dark-mode fixes, product contract
- `184c1dc4ff` — fix(ios): keep the sign-in screen up until account creation finishes
- `bac6dce4b7` — fix(ios): address review findings on validation counts and the submit gate

### `agent/claude-firebase-readiness`

- `79f1ec6e0f` — docs: record blocked live preflight at integration 8ef5684
- `db25970b2b` — docs: record Auth linkage FAIL (1 account, no reviewer or collector) from Work console

### `codex/release-readiness`

- `4ad59edea3` — docs: record post-merge release readiness checkpoint
- `f4c0870ec7` — docs: record morning release control state
- `8cd3500789` — docs: checkpoint merged Firebase fixes and current release gates
- `bb2623f926` — docs: record live Auth blocker and AI CI failure
- `d60c272c01` — docs: checkpoint public runbook merge and managed scan blocker
- `31c820e7a7` — docs: checkpoint signed TestFlight and morning release gates
- `a1dec6a3d7` — docs: checkpoint isolated QC map follow-up PR
- `6103f2dffa` — docs: checkpoint PR 49 merge and release source drift
- `ce4ff72645` — docs: reconcile live dev and current release evidence
- `8a454f85b7` — docs: record current App Store Connect readback
- `61f895f5fa` — docs: record complete release CI and human gates

### `origin/concept/public-dashboard-codex-v2`

- `da4a7a4082` — concept: scaffold isolated public dashboard experiment
- `4a3e9340e7` — concept: add isolated dashboard build configuration
- `01414d36bf` — concept: configure strict TypeScript
- `a16d9cc5ee` — concept: document prototype safety and interactions
- `e092efb351` — concept: add synthetic public data adapter
- `5144d5d8db` — concept: add rigorous accessible time-series chart
- `6f0527f6c8` — concept: build interactive scientific map instrument
- `67b105b320` — concept: add public dashboard and editorial surfaces

### `origin/fix/codeql-nested-android-build`

- `ff84a026d8` — fix(ci): build nested Android project for CodeQL
- `1cc373d146` — fix(ci): manually build nested iOS project for CodeQL

### `origin/ops/asc-existing-app-audit`

- `ea86f377a0` — chore(ci): audit existing App Store Connect app
- `2c1b66333b` — chore(ci): trigger existing App Store audit
- `d2b1670870` — chore(ci): query App Store app metadata directly
- `15513f6cae` — chore(ci): rerun App Store metadata audit
- `58104379b1` — chore(ci): inspect prior TestFlight builds
- `b784679362` — chore(ci): query TestFlight builds via App Store API
- `c6ee2533c2` — chore(ci): audit legacy Firebase and signing resources
- `e07bbd022b` — chore(ci): test recovery of Expo-managed iOS signing credentials
- `4dd06022d1` — chore(ci): recover EAS signing credentials via GraphQL
- `9f858e28f0` — chore(ci): trigger direct EAS signing audit
- `939c67dcd6` — chore(ci): download existing EAS signing credentials read-only
- `91e0b30542` — chore(ci): restore historical Firebase config for EAS audit
- `ac2f4901fa` — chore(ci): regenerate App Store profile with App Attest
- `dbb69bb514` — chore(ci): run App Attest profile regeneration
- `5e155cddb2` — chore(ci): use EAS-compatible GraphQL transport
- `84a75c11d2` — ci(ios): build and submit native release to TestFlight
- `6ff1844669` — ci(ios): add deterministic EAS wrapper lockfile
- `d0a1bf16cc` — ci(ios): inspect failed EAS native build
- `e0f313be65` — ci(ios): print single EAS remote log URL
- `81872f849c` — ci(ios): decode compressed EAS remote log
- `df4f0cbba5` — ci(ios): build native SPM app through EAS and submit TestFlight
- `c9a539004f` — ci(ios): inspect second native EAS build failure
- `10e06fa1ec` — ci(ios): workaround EAS TargetAttributes mutator and submit build 10
- `095c4ce744` — ci(ios): submit finished build 10 without enterprise changelog
- `2f4a6ccbc9` — ci(ios): submit verified finished EAS build directly
- `7b1f3e5c89` — ci(ios): distribute build 10 to internal TestFlight account
- `2795929f2f` — ci(ios): finish internal TestFlight tester enrollment
- `f39b594e76` — ci(ios): audit build 10 TestFlight beta state
- `a2d8a76dac` — ci(ios): compare build 9 and 10 export compliance
- `5bc73a69d9` — ci(ios): clear build 10 compliance and force internal testing

### `origin/ops/firebase-control`

- `61fac7127f` — ci(firebase): add live read-only audit via GitHub OIDC
- `bcf710a75d` — ci(firebase): deploy validation and backfill live iOS submissions
- `e81cf31236` — ci(firebase): continue repair after function deploy
- `99e4193426` — ci(firebase): audit fresh automatic validation trigger
- `0728529599` — ci(firebase): audit correction roundtrip state
- `0ab74f9917` — ci(firebase): compare live Firestore rules during correction audit
- `a513364293` — ci(ios): patch correction resubmit acknowledgement ordering
- `cdedca13c0` — ci(ios): rerun correction patch after branch creation
- `ef8a4e6e0c` — ci(ios): apply correction resubmit patch safely

### `origin/release/ios-existing-app-v0.1.0-b11`

- `4a062e6289` — Merge PR #30: prevent phantom iOS correction revisions

## Preservation and remaining checks

- Original design and other worktrees remain untouched. Original release branches and the App Hosting live-branch dependency remain preserved.
- The prototype is intentionally isolated and carries synthetic data. Its existence does not authorize importing that data or replacing the active dashboard.
- Repeat main/head comparisons immediately before merging and verify the resulting main SHA and CI afterward.
- Do not change App Hosting traffic branches, deploy rules/functions, grant roles, or execute archived operational workflows as part of Git consolidation.
