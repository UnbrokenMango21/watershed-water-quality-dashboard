# PA Watershed Watch: where things are

Open this repository in IntelliJ as **PA Watershed Watch — Engineering**. The folder on disk remains `watershed-water-quality-dashboard` because GitHub, Firebase, CI, and existing worktrees use that path. The visible IntelliJ project name is shorter and clearer.

| What you want | Open this folder | What it contains |
| --- | --- | --- |
| iPhone field app | `Phone App/iPhone App/PAWatershedWatch` | Active SwiftUI app; use Xcode for native testing and signing |
| Android field app | `Phone App/Android App` | Active Kotlin/Compose app; use Android Studio for emulator/device work |
| Private reviewer website | `web` | QC Console, where authorized humans review submissions |
| Public water-quality website | `public-dashboard` | Only approved, public-safe ArcGIS observations |
| Scientific checks | `validation` and `config` | Validation code and measurement/workflow contracts |
| Private Firebase backend | `firebase` and `functions` | Security rules, indexes and cloud function entry points |
| ArcGIS release path | `publication` | Server-side approved-only publisher |
| Project decisions and current status | `project-control` | Release gates, test matrix and evidence index |
| Technical explanation | `docs` | Architecture, roadmap, runbooks and semester records |
| Submission package | `submission` | Curated semester hand-in material |
| Repeatable actions | `.run` | Plain-language IntelliJ Run menu actions |
| Shared tool commands | `scripts/dev.sh` | Same test environment for Codex and Claude |

Folders beginning with a dot are tool settings. `node_modules` is downloaded JavaScript dependencies. `mobile` is preserved retired Expo output; it is not the active field app. `artifacts` holds local evidence and must be reviewed before sharing. The sibling `Watershed Dashboard/MyProject` is the separate ArcGIS Pro workbench and geodatabases.

Use the top bar's **Run configurations** menu for **Check this Mac**, **Check science and publication rules**, **Check reviewer and public websites**, **Test private Firebase workflow**, **Build and check Android app**, or **Test iPhone app in Simulator**. The [engineering cockpit guide](docs/ENGINEERING_COCKPIT.md) explains those actions and the Git/agent/Firebase connections.

The current `setup/project-navigation` branch contains these cockpit and naming changes. Branch names are technical labels in Git; the actions above are the normal way to run checks. `integration/pa-watershed-watch-2026-09` is the draft release integration line. `main` is the GitHub default branch. Keep scientific completion and verified semester hours in separate records.
