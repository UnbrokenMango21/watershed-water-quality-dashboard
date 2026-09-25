# Watershed engineering cockpit

The existing `Watershed Project` folder is the human-facing home. Its `watershed-water-quality-dashboard` directory owns the one Git repository. GitHub `UnbrokenMango21/watershed-water-quality-dashboard` is the permanent source of truth.

## Daily entry point

Open the repository root in IntelliJ IDEA as **PA Watershed Watch — Engineering**. Use [PROJECT_MAP.md](../PROJECT_MAP.md) for the plain-language folder and action map. Project shows source and documentation; Git shows branches/history; Commit shows diffs; Terminal runs the shared commands; Run configurations expose repeatable checks. Xcode remains authoritative for SwiftUI and Apple signing/simulators. Android Studio remains authoritative for Android SDK/device management and native debugging.

Run `bash scripts/dev.sh doctor` from the repository. The wrapper scopes Android SDK and Java selection to its child process; it never modifies shell defaults. Node 22 is required by the backend. The Mac currently supplies Node 22 and Python 3.13 through mise, and Java 25 through Android Studio's bundled runtime. The wrapper selects those project-scoped versions because system Node 26 and Python 3.14 do not match the verified project checks. Existing lockfiles remain authoritative. Install dependencies only through the existing lockfiles when required.

| Run configuration / command | Purpose |
| --- | --- |
| `doctor` | Repository and toolchain identity |
| `contracts` | Scientific and publication contracts, provisioning privacy |
| `web-checks` | QC and public dashboard tests/typechecks/builds |
| `emulators` | Firestore, Storage, validation, review, trigger tests |
| `android` | Native unit tests, lint and debug build |
| `ios` | Existing native simulator tests; override `IOS_DESTINATION` as needed |
| `codex`, `claude` | Start either agent in this exact repository/environment |

Every command is invoked as `bash scripts/dev.sh COMMAND`. Read test results before claiming verification. Simulator proof does not certify a physical device, live reviewer decision, or real scientific publication.

## Shared Firebase connection

Both `.codex/config.toml` and `.mcp.json` start the same `firebase-mcp` wrapper using the installed Firebase CLI and its existing local login. The local adapter exposes environment/project/app inspection, active rules, rule validation, function inventory and hosting inventory. It blocks deployment, account mutation, messaging and scientific record writes, including direct tool calls. This is a restricted MCP surface, not a reduction of the CLI account's IAM permissions. Never place credentials in either configuration. Restart a project agent to load changes; client trust/approval may be required.

The active aliases `default` and `dev` target `central-pa-watershed-dev`. Firestore/Storage rules are in `firebase/`, the function source is `functions/index.mjs`, and the two App Hosting roots are `web/` and `public-dashboard/`. Use emulators for tests. Do not activate the gated publisher or deploy rules as an environment check.

IntelliJ's MCP Server plugin is installed. If not yet enabled, enable it through Settings → Tools → MCP Server and use project-level auto-configuration for Codex and Claude. Keep normal command confirmation enabled. Do not expose its local endpoint publicly. The Firebase connection works independently of the IDE server.

## Controlled worktrees

One active writer per checkout. Before creating a worktree, inspect `git worktree list --porcelain`, branch, status and upstream. Use an explicit task branch with a known base and record owner, location, base/head and purpose in `project-control/AGENT_TASKS.md`. Prefer `$HOME/Developer/PA-Watershed-Agent-Worktrees/<task>` for future disposable build/review worktrees; this shares the original repository, it is not another clone. Never automatically prune or remove a worktree with uncertain local or ignored data.

Existing Phase 12, QC, Antigravity and simulator worktrees are retained historical/task workspaces. Their stale instructions are not the current architecture. `mobile/` contains retired Expo artifacts, not active app source. `Watershed Dashboard/MyProject` is the GIS workbench with unique geodatabases, not the web dashboard. Supervisor materials and local authenticated audit evidence remain private.

## iCloud and evidence

On September 25, tracked source placeholders were downloaded through macOS; all tracked files were verified locally resident before editing. No move was necessary. If eviction recurs, use Finder Keep Downloaded for the project or plan a verified migration; never overwrite unread cloud placeholders from Git to force hydration. Build outputs and caches should not be treated as evidence or source history.

Keep semester records in `docs/semester/` and `project-control/SEMESTER_WORK_LOG.md`. Completion assessments and test durations are not certified Workday hours. Record only independently supported work time.

## Supported integration references

- [OpenAI project MCP configuration](https://developers.openai.com/codex/mcp)
- [Firebase MCP](https://firebase.google.com/docs/ai-assistance/mcp-server)
- [IntelliJ MCP and project client configuration](https://www.jetbrains.com/help/idea/mcp-server.html)
