# Supervisor-feedback release plan — 2026-10-16

Every step below changes shared cloud state and needs explicit approval from the project owner. Nothing here has been run. Merging into `main` does not deploy anything.

## Current live state (read-only check, 2026-10-15)

| Component | Live state | Gap |
| --- | --- | --- |
| Cloud Functions (`us-east4`) | `updateMyDisplayName`, `validateSubmittedObservation` | The six new callables (`initializeMyAccount`, `requestMyReviewerAccess`, `decideReviewerMembership`, `proposeSiteCoordinates`, `decideSiteCoordinates`, `sendSubmissionMessage`) are not deployed |
| QC Console App Hosting `qc-console-dev` | `build-2026-09-28-003` at `8c443d8` | Its configured live branch `codex/qc-console-production-v1` no longer exists on GitHub; rollouts are created from explicit commits |
| Public dashboard App Hosting `public-dashboard-dev` | `build-2026-09-28-002` at `68a9c5a` | Live branch `final/public-dashboard-v1` is behind this work |
| Firestore rules | Earlier tracked rules | The v0.2 contract (visual observations, provenance, collaboration collections) is not live |

## Order and commands

Run from the repository root after the pull request is merged and CI is green. Replace `<SHA>` with the merge commit on `main`.

1. **Firestore rules** (backward compatible: installed 0.1.0 app builds keep working):
   `firebase deploy --only firestore:rules --project central-pa-watershed-dev`
   No new composite indexes are required. Storage rules stay undeployed until the media bucket exists (see docs/ENGINEERING_COCKPIT.md).
2. **Cloud Functions** (adds the six callables; existing functions keep their names and regions):
   `firebase deploy --only functions --project central-pa-watershed-dev`
   Verify: `firebase functions:list --project central-pa-watershed-dev` lists eight functions in `us-east4`.
3. **QC Console**: `firebase apphosting:rollouts:create qc-console-dev --project central-pa-watershed-dev --git-commit <SHA>`. Optionally point the backend's live branch at `main` in the Firebase console so future merges deploy predictably.
4. **Public dashboard**: `firebase apphosting:rollouts:create public-dashboard-dev --project central-pa-watershed-dev --git-commit <SHA>`.
5. **Smoke tests** (no scientific data is written):
   - QC `/review` shows the sign-in page; a signed-in collector sees the access panel, not records.
   - An unauthenticated callable request returns `unauthenticated`.
   - The dashboard loads anonymously, shows only approved public views, and fails closed on schema errors.
   - Record the rollout build IDs and source SHAs in docs/PROJECT_METRICS.md.
6. **Designated roles** (after each person verifies email ownership): run `node scripts/ensure_dev_admin.mjs` as a dry run, then with `--apply --uid <UID> --confirm-grant <UID>:<ROLE> --verification-reference <private reference>` for `pzc5420@psu.edu` (ADMIN) and `fpp5057@psu.edu` (QC_REVIEWER).
7. **Mobile**: re-run `scripts/dev.sh ios-ui` on a machine with enough free memory, then build TestFlight through the existing workflow. Android remains on the deferred release track.

## Rollback

- App Hosting: route traffic back to `build-2026-09-28-003` (QC) and `build-2026-09-28-002` (dashboard) in the Firebase console.
- Firestore rules: redeploy `firebase/firestore.rules` from `436447c`. New 0.2.0 clients cannot submit under the old rules, so roll back the rules only together with the clients.
- Functions: redeploy from the previous commit. Removing the new callables requires an explicit delete approval.
