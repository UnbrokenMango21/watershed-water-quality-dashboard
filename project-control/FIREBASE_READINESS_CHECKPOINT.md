# Firebase readiness checkpoint (read-only)

- Date: 2026-09-28
- Project: `central-pa-watershed-dev`
- Candidate commit: `b9580c9` (`agent/claude-firebase-readiness`)
- Method: Firebase MCP (read-only wrapper) and Firebase CLI read commands only. Nothing was deployed,
  written, approved, published or merged. No identities, keys or credentials are recorded here.

| Check | Result | Evidence |
| --- | --- | --- |
| Project identity | PASS | Project `central-pa-watershed-dev`, number 652403958133, ACTIVE, billing enabled; aliases `default` and `dev` both resolve to it. |
| Auth configuration (providers, settings) | BLOCKED | No read-only Auth config tool in the restricted MCP; the admin-SDK path needs Application Default Credentials, which are not configured on this Mac. |
| Reviewer/admin role claims | BLOCKED | Same credential requirement (`scripts/audit_site_catalog.mjs --auth`). |
| Active reviewer/admin `users/{uid}` profiles | BLOCKED | Same credential requirement. |
| Deployed Firestore rules | PASS (current model) | Deployed rules are the previously tracked ruleset: role claim only for reviewer/admin reads. |
| Deployed rules vs candidate | GAP (expected) | Candidate adds the active-reviewer-profile requirement to `isAdmin()`/`isReviewer()`; not deployed. Candidate compiles cleanly (rules validation: no errors). |
| Deployed Storage rules | NOT DEPLOYED (expected) | No active Storage release. Media capture is deferred; candidate Storage rules compile cleanly. |
| Composite indexes | PASS | 4 deployed, 4 in `firebase/firestore.indexes.json`; identical apart from the server-added `__name__` tie-breaker. No field overrides. |
| Delete protection | PASS | `DELETE_PROTECTION_ENABLED`. |
| Backups | PASS | One weekly (Sunday) schedule, 30-day retention; latest backup READY (snapshot 2026-09-27). |
| Point-in-time recovery | RISK | `POINT_IN_TIME_RECOVERY_DISABLED` (1 h version retention). Not a blocker; worth enabling before real data. |
| `validateSubmittedObservation` | PASS (presence/config) | Deployed v2, Firestore document-updated trigger, us-east4, 512 MiB, nodejs22; matches `functions/index.mjs`. Deployed source revision not verifiable read-only; function code is unchanged since `d2c2435`. |
| `updateMyDisplayName` | PASS (presence/config) | Deployed v2 callable, us-east4, 256 MiB, nodejs22; matches code. Same source caveat. |
| Approval publisher | PASS (gated off) | `publishApprovedObservation` not deployed, as intended while `ENABLE_ARCGIS_PUBLICATION_FUNCTION` is off. |
| QC review API authorization (deployed) | PASS (current model), GAP vs candidate | Live QC backend build 2026-09-13 from a branch no longer on the remote. The review route only changed on 2026-08-14 and in the candidate, so the live route verifies the ID token with revocation, re-reads the live user, refuses disabled accounts and requires a QC_REVIEWER/ADMIN claim, but does not require an active profile. Consistent with the deployed rules. |
| QC and dashboard hosting | INFO | QC backend serves 2026-09-13 build; dashboard serves 2026-09-25 build from `final/public-dashboard-v1`. Neither includes the PR #42 changes. |
| Live `siteCatalog` audit | BLOCKED | `scripts/audit_site_catalog.mjs` (read-only) needs Application Default Credentials. |

## To unblock

A person with project access runs `gcloud auth application-default login` (or supplies another approved
read-only credential), then:

```
node scripts/audit_site_catalog.mjs --auth --json <private path outside Git>
```

That one read-only run answers the catalog audit, role claims and account states. Active profiles need a
read of `users/{uid}` for the reviewer and admin accounts only.
