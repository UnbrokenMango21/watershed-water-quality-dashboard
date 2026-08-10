# Phase 11 Collector Flow Matrix

Status vocabulary:

- **IMPLEMENTED:** `YES`, `PARTIAL`, or `NO` based on current source behavior.
- **TESTED iOS / Android:** `PASS`, `FAIL`, or `NOT RUN` based on actual app use.
- A `NOT RUN` entry is a tracked gap, not an implied pass.

This matrix must contain no unexplained `PARTIAL`, `NO`, `FAIL`, or `NOT RUN`
entries before Phase 11 is declared product-complete.

| Area | User-visible flow/state | IMPLEMENTED | TESTED iOS | TESTED Android | Evidence / remaining work |
| --- | --- | --- | --- | --- | --- |
| Auth | Initial auth restoration/loading | YES | PASS | NOT RUN | iOS development client rendered after Firebase initialization; Android Gate C pending |
| Auth | Email/password sign-in | YES | PASS | NOT RUN | User confirmed synthetic collector sign-in; password not accessed |
| Auth | Empty required credentials | YES | NOT RUN | NOT RUN | Runtime negative test pending |
| Auth | Invalid email | YES | NOT RUN | NOT RUN | Runtime negative test pending |
| Auth | Invalid credentials | YES | NOT RUN | NOT RUN | Runtime negative test pending |
| Auth | Disabled account message | YES | NOT RUN | NOT RUN | Requires safe test condition or static mapping evidence |
| Auth | Network unavailable during sign-in | YES | NOT RUN | NOT RUN | Offline runtime test pending |
| Auth | Persistent signed-in session after relaunch | PARTIAL | NOT RUN | NOT RUN | RNFirebase listener exists; repeated relaunch proof pending |
| Account | Open/close collector profile | YES | NOT RUN | NOT RUN | Runtime interaction pending |
| Account | Collector identity/email | YES | NOT RUN | NOT RUN | Runtime interaction pending; never log identity |
| Account | Sign out | YES | NOT RUN | NOT RUN | Repeated sign-in/out test pending |
| Sites | Initial catalog loading | NO | NOT RUN | NOT RUN | Phase 11B first implementation |
| Sites | Available catalog | NO | NOT RUN | NOT RUN | Must use Phase 9 `siteCatalog` contract |
| Sites | Loading state | NO | NOT RUN | NOT RUN | Implement stable progress state |
| Sites | Permission/query error | NO | NOT RUN | NOT RUN | Implement plain-language retry state |
| Sites | Empty catalog | NO | NOT RUN | NOT RUN | Implement without fake Start action |
| Sites | Cached-offline catalog | NO | NOT RUN | NOT RUN | Firestore cache/source state required |
| Sites | Refresh/retry | NO | NOT RUN | NOT RUN | Implement real query retry/refresh |
| Sites | Site selection | NO | NOT RUN | NOT RUN | Enable only after valid catalog |
| Home | Start observation prerequisite | PARTIAL | PASS | NOT RUN | Visible disabled placeholder must become actionable state or be removed |
| Home | Recent drafts/submissions loading | NO | NOT RUN | NOT RUN | Contract-backed query required |
| Home | Recent list empty | PARTIAL | PASS | NOT RUN | Current static empty state; connect to real query |
| Home | Recent list error/offline | NO | NOT RUN | NOT RUN | Implement |
| Observation | Create/resume draft shell | NO | NOT RUN | NOT RUN | Implement contract-backed draft model |
| Observation | Select site | NO | NOT RUN | NOT RUN | Implement after catalog |
| Observation | Collection date/time defaults | NO | NOT RUN | NOT RUN | Native controls required |
| Observation | Edit collection date/time | NO | NOT RUN | NOT RUN | Native controls and review round-trip |
| GPS | Permission request | NO | NOT RUN | NOT RUN | Expo location integration required |
| GPS | Acquiring location | PARTIAL | NOT RUN | NOT RUN | UI component exists; real acquisition missing |
| GPS | Coordinates + reported accuracy | PARTIAL | NOT RUN | NOT RUN | UI component exists; real acquisition missing |
| GPS | Permission denied | PARTIAL | NOT RUN | NOT RUN | UI copy exists; permission flow/retry missing |
| GPS | Services unavailable/error | PARTIAL | NOT RUN | NOT RUN | UI copy exists; runtime flow missing |
| GPS | Retry acquisition | NO | NOT RUN | NOT RUN | Implement real retry |
| Method | Select test type | NO | NOT RUN | NOT RUN | Drive from existing configuration/contract |
| Method | Method/instrument provenance | NO | NOT RUN | NOT RUN | Drive required fields from contract |
| Measurements | Required core fields | PARTIAL | NOT RUN | NOT RUN | Components exist; contract-backed screen/model missing |
| Measurements | Configured optional fields | PARTIAL | NOT RUN | NOT RUN | Components exist; configuration wiring missing |
| Measurements | Numeric keyboard/editing | PARTIAL | NOT RUN | NOT RUN | Components exist; adversarial device testing pending |
| Measurements | Required-entry feedback | PARTIAL | NOT RUN | NOT RUN | Must not invent Phase 10 scientific semantics |
| Temperature | Entered unit selected first | PARTIAL | NOT RUN | NOT RUN | Component exists; workflow integration missing |
| Temperature | Preserve entered value/unit | PARTIAL | NOT RUN | NOT RUN | Component-level behavior requires integration proof |
| Temperature | Immediate C/F derivation | PARTIAL | NOT RUN | NOT RUN | Component-level behavior requires integration proof |
| Notes | Contract-permitted notes | NO | NOT RUN | NOT RUN | Confirm Phase 9 field before exposure |
| Attachments | No fake v1 attachment controls | YES | PASS | NOT RUN | No attachment controls currently exposed |
| Navigation | Forward progression | NO | NOT RUN | NOT RUN | Implement native-feeling stack flow |
| Navigation | Back without data loss | NO | NOT RUN | NOT RUN | Interrupted workflow test required |
| Navigation | Review edit round-trip | PARTIAL | NOT RUN | NOT RUN | Review component exists; navigation missing |
| Review | Complete observation summary | PARTIAL | NOT RUN | NOT RUN | Review components exist; integration missing |
| Review | Missing-entry navigation | NO | NOT RUN | NOT RUN | Implement entry-shape guidance only |
| Draft | Save locally | NO | NOT RUN | NOT RUN | Firestore offline persistence required |
| Draft | Resume after navigation/relaunch | NO | NOT RUN | NOT RUN | Implement and interrupt-test |
| Draft | Saved locally state | PARTIAL | NOT RUN | NOT RUN | Status component exists; real state missing |
| Sync | Syncing state | PARTIAL | NOT RUN | NOT RUN | Status component exists; real Firestore state missing |
| Sync | Synced/server state | PARTIAL | NOT RUN | NOT RUN | Status component exists; acknowledgement mapping missing |
| Sync | Failed + retry | PARTIAL | NOT RUN | NOT RUN | Status component exists; real retry missing |
| Sync | Offline → reconnect → sync | NO | NOT RUN | NOT RUN | Required end-to-end runtime proof |
| Submission | Submit observation | NO | NOT RUN | NOT RUN | Existing ownership/state contract required |
| Submission | Prevent duplicate submission | NO | NOT RUN | NOT RUN | Implement idempotent UI behavior within contract |
| Submission | Immutable submitted revision | NO | NOT RUN | NOT RUN | Must preserve Phase 9 revision model |
| Submission | Submission detail/status | NO | NOT RUN | NOT RUN | Implement permitted server fields only |
| Submission | Recent submissions list | NO | NOT RUN | NOT RUN | Implement query and state display |
| Validation | Permitted validation results | NO | NOT RUN | NOT RUN | Read-only presentation from Phase 10 output |
| Validation | Blocking ERROR presentation | NO | NOT RUN | NOT RUN | Do not reinterpret Phase 10 semantics |
| Correction | NEEDS_CORRECTION detail/action | NO | NOT RUN | NOT RUN | Contract mapping required |
| Correction | New correction revision | NO | NOT RUN | NOT RUN | Never mutate submitted science |
| Correction | RESUBMITTED transition | NO | NOT RUN | NOT RUN | Existing transition contract only |
| Correction | Prior revision remains visible/immutable | NO | NOT RUN | NOT RUN | Query/display proof required |
| Offline | App launch with cached data | NO | NOT RUN | NOT RUN | Runtime airplane/offline proof required |
| Offline | Empty cache explanation | NO | NOT RUN | NOT RUN | Implement explicit recovery guidance |
| Analytics | Privacy-safe coarse events | PARTIAL | NOT RUN | NOT RUN | Audit event names/payloads; no sensitive values |
| Accessibility | Accessible names/roles/states | PARTIAL | NOT RUN | NOT RUN | Existing components have partial semantics; full audit pending |
| Accessibility | Dynamic Type/large text | PARTIAL | NOT RUN | NOT RUN | Device verification pending |
| Accessibility | Screen-reader state announcements | PARTIAL | NOT RUN | NOT RUN | Auth/sync/error runtime verification pending |
| Accessibility | Contrast and non-color cues | PARTIAL | NOT RUN | NOT RUN | DESIGN.md defines target; implementation audit pending |
| Accessibility | 48-point minimum targets | PARTIAL | NOT RUN | NOT RUN | Shared tokens exist; every exposed control audit pending |
| Outdoor | Direct-sunlight light theme | PARTIAL | NOT RUN | NOT RUN | Token refinement and brightness/contrast inspection pending |
| Outdoor | High-legibility measurement entry | PARTIAL | NOT RUN | NOT RUN | Numeric token/component exists; workflow proof pending |
| Platform | iOS complete parity | NO | NOT RUN | N/A | Full product flow pending |
| Platform | Android complete parity | NO | N/A | NOT RUN | EAS APK/emulator proof pending |
