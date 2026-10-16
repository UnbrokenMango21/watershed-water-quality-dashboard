# Supervisor-feedback release plan — 2026-10-16

Every step below changes shared cloud state and needs explicit approval from the project owner. Nothing here has been run. Merging into `main` does not deploy anything.

## Current live state (read-only check, 2026-10-15)

| Component | Live state | Gap |
| --- | --- | --- |
| Cloud Functions (`us-east4`) | `updateMyDisplayName`, `validateSubmittedObservation` | The six new callables (`initializeMyAccount`, `requestMyReviewerAccess`, `decideReviewerMembership`, `proposeSiteCoordinates`, `decideSiteCoordinates`, `sendSubmissionMessage`) are not deployed |
| QC Console App Hosting `qc-console-dev` | `build-2026-09-28-003` at `8c443d8` | Its configured live branch `codex/qc-console-production-v1` no longer exists on GitHub; rollouts are created from explicit commits |
| Public dashboard App Hosting `public-dashboard-dev` | `build-2026-09-28-002` at `68a9c5a` | Live branch `final/public-dashboard-v1` is behind this work |
| Firestore rules | Active-profile reviewer rules; accepts schema 0.1.0 only (read back 2026-10-16) | The v0.2 contract, access_version fencing and the collaboration collections are not live; new app builds are rejected until the rules deploy |

## Order and commands

Run from the repository root after the pull request is merged and CI is green. Replace `<SHA>` with the merge commit on `main`. Note that PR #52 targets `main` from a branch built on `integration/pa-watershed-watch-2026-09`, so merging it also brings the 231 integration commits of draft PR #34 into `main`; review that scope (or merge #34 first) before merging.

1. **Firestore rules** (backward compatible: installed 0.1.0 app builds keep working):
   `firebase deploy --only firestore:rules --project central-pa-watershed-dev`
   No new composite indexes are required. Storage rules stay undeployed until the media bucket exists (see docs/ENGINEERING_COCKPIT.md).
2. **Cloud Functions** (adds the six callables; existing functions keep their names and regions):
   `firebase deploy --only functions --project central-pa-watershed-dev`
   Verify: `firebase functions:list --project central-pa-watershed-dev` lists eight functions in `us-east4`.
3. **QC Console**: `firebase apphosting:rollouts:create qc-console-dev --project central-pa-watershed-dev --git-commit <SHA>`. Optionally point the backend's live branch at `main` in the Firebase console so future merges deploy predictably.
4. **Public dashboard**: `firebase apphosting:rollouts:create public-dashboard-dev --project central-pa-watershed-dev --git-commit <SHA>`. Also point the backend's live branch at `main` (or turn off automatic rollouts) in the Firebase console: it still follows `final/public-dashboard-v1`, so any later push there would replace this build with older code.
5. **Smoke tests** (no scientific data is written):
   - QC `/review` shows the sign-in page; a signed-in collector sees the access panel, not records.
   - An unauthenticated callable request returns `unauthenticated`.
   - The dashboard loads anonymously, shows only approved public views, and fails closed on schema errors.
   - Record the rollout build IDs and source SHAs in docs/PROJECT_METRICS.md.
6. **Designated roles** (after each person verifies email ownership; requires operator Application Default Credentials, `gcloud auth application-default login`). Flags take `=` values:
   - Dry run: `node scripts/ensure_dev_admin.mjs --email=pzc5420@psu.edu --uid=<UID>`; apply: add `--apply --confirm-grant=<UID>:ADMIN --verification-reference=<private reference>`.
   - Dry run: `node scripts/ensure_dev_admin.mjs --email=fpp5057@psu.edu --uid=<UID>`; apply: add `--apply --confirm-grant=<UID>:QC_REVIEWER --verification-reference=<private reference>`.
   - The script refuses to run over a suspended profile, a declined/suspended/revoked request or an in-flight decision; `--lift-suspension=<UID>` exists only for a specifically approved reinstatement and is recorded in `identityAudit`.
7. **Mobile**: first re-run `scripts/dev.sh ios-ui` on an awake Mac (lid open, display on, preferably on power) and confirm all three UI tests pass; on 2026-10-16 most runs were invalidated because the development Mac was asleep with its lid closed. Also find why XCTest stops receiving "animations complete" after a decimal-pad measurement field is focused on the Measurements and Correction Revision screens (for example with Instruments on a device). Then build TestFlight through the existing workflow after the rules deploy. Android remains on the deferred release track; development devices that ran an earlier build of this branch must reinstall (Room schema 5 changed in place before release).
8. **Retire the 0.1.0 contract**: once every installed iOS build is 0.2-capable, remove `validLegacyScience` and the 0.1.0 submission schema from `firebase/firestore.rules` in a separate reviewed release (decide the date with the program lead).

## Rollback

- App Hosting: route traffic back to `build-2026-09-28-003` (QC) and `build-2026-09-28-002` (dashboard) in the Firebase console.
- Firestore rules: redeploy `firebase/firestore.rules` from `436447c`. New 0.2.0 clients cannot submit under the old rules, so roll back the rules only together with the clients.
- Functions: redeploy from the previous commit. Removing the new callables requires an explicit delete approval.
