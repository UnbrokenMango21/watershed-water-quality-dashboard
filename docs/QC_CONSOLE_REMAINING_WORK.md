# QC Console Remaining Work

## 1. Enable and deploy Firebase App Hosting

- **Issue:** `central-pa-watershed-dev` is on Spark; a dynamic Next.js/API
  backend cannot be created.
- **Severity:** Release blocker for a deployed QC console.
- **Files:** `web/`, `docs/QC_CONSOLE_RUNBOOK.md`.
- **Command attempted:** `firebase apphosting:backends:list --project central-pa-watershed-dev --json`.
- **Exact error:** `Your project central-pa-watershed-dev must be on the Blaze (pay-as-you-go) plan to complete this command. Required API firebaseapphosting.googleapis.com can't be enabled until the upgrade is complete.`
- **Completed:** Production build passes; the dev Web app exists; browser env names,
  backend creation, and rollout commands are documented.
- **Missing dependency:** Authorized Blaze upgrade for the dev project.
- **Next action:** Upgrade only `central-pa-watershed-dev`, create
  `qc-console-dev` with the runbook command, set the six public Firebase env
  variables, and grant its runtime service account Firestore data access and
  Firebase Auth user-read access.
- **Verify:** `firebase apphosting:backends:list --project central-pa-watershed-dev`
  followed by the HTTPS live-test checklist.
- **Blocks release:** Yes.

## 2. Provision live dev users and fixtures

- **Issue:** The required collector/reviewer/admin accounts and representative
  dev records do not exist in the real project.
- **Severity:** Release blocker for live authorization/action verification.
- **Files:** `scripts/provision_test_users.mjs`, `scripts/seed_test_sites.mjs`,
  `scripts/seed_qc_smoke_data.mjs`.
- **Command attempted:** `node scripts/provision_test_users.mjs --apply` (the
  same credential path is required by both seed scripts).
- **Exact error:** `Credential implementation provided to initializeApp() via the "credential" property failed to fetch a valid Google OAuth2 access token ... Could not load the default credentials.`
- **Completed:** Credential-free dry runs pass; emulator create/update
  idempotency, role claims, 18 sites, and all five QC scenarios pass.
- **Missing dependency:** Dev-project Application Default Credentials and a
  user-supplied temporary `QC_DEV_TEST_PASSWORD`.
- **Next action:** Configure ADC, export a temporary password, then run the
  three `--apply` commands in the runbook. Existing passwords are not reset.
- **Verify:** Re-run provisioning, export Auth users to a temporary directory,
  inspect exact claims, and query seeded Firestore IDs/statuses.
- **Blocks release:** Yes.

## 3. Run deployed real-project browser verification

- **Issue:** The full local emulator/browser run passes, but real Firebase and
  deployed HTTPS actions could not be exercised without items 1 and 2.
- **Severity:** Release blocker under the requested definition of done.
- **Files:** `docs/QC_CONSOLE_LIVE_TEST.md`.
- **Command attempted:** Local live startup was configured with real public Web
  SDK values, but the API and reviewer sign-in have no usable real Admin/reviewer
  credentials; no review action was attempted or faked.
- **Exact error:** Dependency blockers above; there is no authorized
  `QC_REVIEWER` account and the Admin SDK reports `Could not load the default credentials`.
- **Completed:** Browser-level emulator verification passed login, queue,
  detail, all three actions, audit, immutability, collector denial, 401/403,
  idempotency, and two-session 409 conflict.
- **Missing dependency:** Deployed backend plus provisioned real dev accounts/data.
- **Next action:** Execute all 22 checks in the task's live-browser checklist
  against the App Hosting HTTPS URL and record timestamps/results in
  `docs/QC_CONSOLE_LIVE_TEST.md`.
- **Verify:** Inspect the final parent, audit event count, and old revision in
  live Firestore after the browser actions.
- **Blocks release:** Yes.

## Continuation prompt

Upgrade `central-pa-watershed-dev` to Blaze, create/deploy the documented Firebase App Hosting backend, configure Admin runtime permissions and the six public Web SDK variables, provision the dev users/sites/QC fixtures with ADC, run the complete live HTTPS reviewer/collector/stale browser checklist, update `docs/QC_CONSOLE_LIVE_TEST.md`, and commit/push the verified results without starting ArcGIS/public-dashboard work.
