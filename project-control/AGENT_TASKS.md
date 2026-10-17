# Agent Task Ledger

ChatGPT/Codex is the release orchestrator. GitHub is permanent engineering truth.

| Agent | Branch/worktree | Task |
|---|---|---|
| Codex | `agent/codex/finalization-2026-09-24` | Fresh verification, release controls, submission package |
| Claude | `agent/claude/final-red-team` | Independent architecture/security/privacy/idempotency review |
| Antigravity | isolated UI/worktree | Visual/system audit assistance |

No two agents edit the same worktree. Every agent report must include branch/worktree, task, files, tests, results, commit SHA, risks and integration recommendation.

## Active supervisor-feedback continuation — 2026-10-16

- Writer: Codex, `/Users/parth/Developer/PAWatershedWatch-supervisor-feedback`, branch `feat/supervisor-feedback-2026-10-15`, baseline `02a5b24416129d93626fa04124fe1e74a0920507`.
- Ownership check: clean index/worktree; no competing build or write task; previous Claude process is exiting and holds no workspace files. Historical worktrees remain untouched. Recheck status before each change.
- Focus: reproduce and fix the iOS decimal-keyboard idle stall, complete large-text verification, align CI/release toolchains, refresh security and branch evidence, then integrate PR #52 after its gates pass.
- One heavyweight local build/simulator at a time. Cloud deployment, privileged grants, deletion, publication and Apple release require explicit approval.

Agents must not make scientific approval decisions, expose secrets, certify Workday, send final supervisor email without confirmation, submit publicly to the App Store, or perform irreversible production actions.
