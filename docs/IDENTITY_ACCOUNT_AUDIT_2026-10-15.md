# Identity and account safety — October 15, 2026

## Verified read-only inventory

**COMPLETE & VERIFIED** — The development project `central-pa-watershed-dev` was read using the existing authenticated Firebase CLI operator session. No sign-in, role grant, account deletion, session revocation, scientific edit, or cloud configuration change was performed.

The inventory found 2 Firebase Authentication accounts and recursively scanned 274 Firestore documents, including subcollections beneath missing ancestors. Both designated identities exist and are enabled:

| Designated identity | Intended role | Verified email | Linked provider | Current custom role | Current UID profile |
| --- | --- | --- | --- | --- | --- |
| `pzc5420@psu.edu` | ADMIN | No | Email/password | Absent | Absent |
| `fpp5057@psu.edu` | QC_REVIEWER | No | Email/password | Absent | Absent |

Neither current UID matched a historical scientific/review attribution reference. Separately, 12 `users/{uid}` profiles have no current Authentication account, and 72 attribution fields refer to IDs absent from Authentication. Some actor IDs may represent automated services; these counts are not a classification of people or a deletion recommendation. Historical accounts cannot be reconstructed or linked by email/name inference. Existing UIDs, profiles, submissions, revisions, decisions and audit records must remain unchanged.

The raw inventory contains private account identifiers, provider identities, profile authorization state and reference paths. It is stored only in ignored `artifacts/identity/` with file permissions `0600`; it is intentionally excluded from this document and Git. The report never includes passwords, password hashes, password salts, OAuth tokens or scientific note/measurement contents. It records exact UID string references in Firestore; Storage/ArcGIS references and legacy non-UID aliases still need separate review before any migration.

**BLOCKED — USER INPUT REQUIRED** — Verify ownership of both designated accounts through their actual email verification/sign-in flow and independently confirm their existing UIDs. Obtain specific approval for the intended cloud role grants. An address entered at registration does not establish ownership. No role has been provisioned by this implementation run.

## Reproducible inventory

```sh
node scripts/audit_auth_accounts.mjs
# If ADC is unavailable, use the operator's existing CLI session in memory:
node scripts/audit_auth_accounts.mjs --firebase-cli-credentials
node --test tests/identity/*.test.mjs
```

The first command uses Application Default Credentials. The optional CLI adapter reads the already selected operator session and refreshes its existing token only in memory; it never performs login, changes granted scopes, stores refreshed credentials, or prints tokens. Console output contains project, counts and report path only. Report creation is exclusive, so an existing report is never overwritten. Any partial or failed read prevents a complete inventory report.

The Firestore adapter permits only document reads and `listCollectionIds` (a read-only POST). The inventory traverses every discovered collection and subcollection, including historical orphaned ancestors, and records field paths rather than scientific content. Firebase Auth pagination is included.

## Privileged bootstrap

**IMPLEMENTED — AWAITING VERIFICATION** — `scripts/ensure_dev_admin.mjs` supports only the two designated identities and their exact intended roles. It defaults to a read-only dry run. Apply requires an independently confirmed `--uid`, exact `--confirm-grant=UID:ROLE`, and a private `--verification-reference`. Firebase must report a verified email with a matching linked supported provider, and the account must already be enabled. The script cannot create accounts, alter passwords, or reactivate suspended accounts.

The write sequence closes profile access, sets the server claim with a new authorization version, revokes prior sessions, records an audit event, then activates and verifies the profile. A failure during provisioning leaves access closed. Existing unrelated claims and profile fields are preserved. Auth and Firestore cannot commit together, so the version fence and inactive intermediate profile are required. Cloud execution remains an approval gate and has not been exercised against the designated accounts.

## Cleanup and migration

**COMPLETE & VERIFIED** — The former blanket cleanup implementation has been removed. `scripts/cleanup_dev_auth_users.mjs` has no account deletion operation. Both designated identities are always preserved. Unknown identities, name/email-based fixture guesses and historically referenced accounts cannot be selected for this utility.

The utility can suspend only explicitly marked, individually reviewed, history-free fixtures. It requires a complete inventory less than 24 hours old, an exact target UID list, and a private approval manifest matching the report SHA-256 digest. Apply rescans current references and rechecks current account fingerprints before suspending access. It deactivates the selected profile, disables the existing Auth account, revokes sessions and records an audit event. Scientific records and historical profiles are retained. A dry run performs no writes.

A private approval manifest has these fields:

```json
{
  "action": "DISABLE_TEST_ACCESS",
  "project_id": "central-pa-watershed-dev",
  "inventory_sha256": "SHA-256 of the exact reviewed inventory file",
  "approved_by": "verified approving administrator",
  "approval_reference": "private record of specific human approval",
  "approved_at": "ISO-8601 timestamp",
  "uids": ["individually reviewed fixture UID"]
}
```

No current live account is eligible for this cleanup: both belong to the protected designated set. No account cleanup or migration was performed.

## Validation and limitations

**COMPLETE & VERIFIED** — Nine focused tests passed: private-field allowlisting; verified-provider/UID bootstrap gates; protection of both designated users; refusal of unknown/history-linked accounts; exact reviewed cleanup selection; stale/change detection; UID-path-only scanning; Auth/Firestore pagination and orphan traversal; rejection of legacy blanket cleanup flags; and REST read-only operations. The safe empty cleanup command also returned without cloud operations.

This proves the maintenance tooling and the current read-only inventory. It does not prove configured provider sign-in, mobile account linking, live reviewer authorization, privilege provisioning or end-to-end scientific publication. Those features require their separate implementation and workflow evidence.
