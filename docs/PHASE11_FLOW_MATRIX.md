# Phase 11 Collector Flow Matrix

Status vocabulary:

- **IMPLEMENTED:** `YES`, `PARTIAL`, or `NO` from current source behavior.
- **TESTED iOS / Android:** `PASS`, `FAIL`, or `NOT RUN` from actual app use.
- Every non-pass entry includes the concrete remaining gate. Phase 11 cannot be
  declared product-complete while any unexplained gap remains.

Current iOS runtime evidence uses the installed EAS development build on the
 iPhone 17 Pro simulator with Metro and a checksum-verified Maestro 2.7.0 binary
in `/tmp`. Source has since received release-candidate hardening, so those new
changes require a final native regression. Android JavaScript export passes and
an Android EAS development build has been submitted; device/emulator execution
remains a gate.

| Area | User-visible flow/state | IMPLEMENTED | TESTED iOS | TESTED Android | Evidence / remaining work |
| --- | --- | --- | --- | --- | --- |
| Auth | Initial auth restoration/loading | YES | PASS | NOT RUN | Repeated full iOS process relaunch retained the authenticated Firebase session; Android runtime pending |
| Auth | Email/password sign-in | YES | PASS | NOT RUN | User-confirmed synthetic collector sign-in; password never accessed; Android pending |
| Auth | Empty required credentials | YES | NOT RUN | NOT RUN | Required-field errors, focus, and screen-reader announcements implemented; final signed-out native pass remains |
| Auth | Invalid email | YES | NOT RUN | NOT RUN | Client format feedback plus accessible announcement implemented; final signed-out native pass remains |
| Auth | Invalid credentials | YES | NOT RUN | NOT RUN | Safe Firebase error mapping implemented; requires signed-out runtime test without exposing credentials |
| Auth | Disabled/throttled account messages | YES | NOT RUN | NOT RUN | Disabled-account, too-many-attempts, and unavailable-provider mappings implemented; safe fixture/runtime proof remains |
| Auth | Network unavailable during sign-in | YES | NOT RUN | NOT RUN | Plain-language Firebase network recovery copy implemented; signed-out native offline test remains |
| Auth | Persistent signed-in session after relaunch | YES | PASS | NOT RUN | Passed across repeated terminate/launch cycles; Android pending |
| Account | Open/close collector profile | YES | NOT RUN | NOT RUN | Native interaction remains |
| Account | Collector identity/email | YES | NOT RUN | NOT RUN | Private in-app presentation implemented; CI privacy guard prevents identity telemetry |
| Account | Sign out confirmation/action | YES | NOT RUN | NOT RUN | Requires deliberate signed-out test and normal persistent re-auth without password access |
| Sites | Initial catalog loading | YES | NOT RUN | NOT RUN | Explicit loading indicator/state implemented; deterministic native capture remains |
| Sites | Available catalog | YES | PASS | NOT RUN | Live development project returned one valid mobile-safe synthetic site |
| Sites | Invalid-document handling | YES | NOT RUN | NOT RUN | Parser count/copy implemented; safe malformed fixture test remains |
| Sites | Permission/query error | YES | NOT RUN | NOT RUN | Plain-language error/retry implemented; injected denial/runtime test remains |
| Sites | Empty catalog | YES | PASS | NOT RUN | Observed before synthetic fixture; Start remained unavailable |
| Sites | Cached-offline catalog | YES | NOT RUN | NOT RUN | Firestore cache metadata path implemented; launch-offline catalog proof remains |
| Sites | Empty cache while offline | YES | NOT RUN | NOT RUN | Loading now times out to actionable reconnect/refresh guidance instead of spinning indefinitely; clean-install native proof remains |
| Sites | Refresh/retry | YES | NOT RUN | NOT RUN | Real server refresh implemented; explicit native tap/response proof remains |
| Sites | Site selection | YES | PASS | NOT RUN | Selected live safe site and persisted its safe name/code snapshot |
| Home | Start observation prerequisite | YES | PASS | NOT RUN | Enabled only for valid server/cached catalog; real draft created |
| Home | Draft list/loading | YES | PASS | NOT RUN | Partial/correction drafts persisted; explicit loading row added for release-candidate source |
| Home | Recent submissions loading/empty | YES | PASS | NOT RUN | Empty state observed; release-candidate source also exposes explicit loading feedback |
| Home | Recent submitted/correction records | YES | PASS | NOT RUN | Submitted record and pinned correction request rendered from Firestore |
| Home | Recent list error/offline | YES | NOT RUN | NOT RUN | Listener error/cache copy implemented; native runtime state remains |
| Observation | Create local draft | YES | PASS | NOT RUN | Atomic per-UID draft created without fake science defaults |
| Observation | Resume interrupted draft | YES | PASS | NOT RUN | Passed repeatedly for initial and correction revisions after full relaunch |
| Observation | Select site | YES | PASS | NOT RUN | Live catalog selection persisted |
| Observation | Collection date/time defaults | YES | PASS | NOT RUN | Native Expo UI controls rendered local date/time |
| Observation | Edit collection date/time | YES | NOT RUN | NOT RUN | Native controls wired; release-candidate source also wraps iOS rows for large text; changed-date runtime proof remains |
| GPS | First permission request | YES | PASS | NOT RUN | Real iOS system prompt exercised |
| GPS | Permission denied/blocked guidance | YES | PASS | NOT RUN | Denied first prompt; app exposed settings guidance and blocked continuation |
| GPS | Recheck after system settings | YES | PASS | NOT RUN | Permission recovery code implemented; simulator permission grant plus return exercised |
| GPS | Services/location unavailable | YES | PASS | NOT RUN | No simulated location produced unavailable state and retry action |
| GPS | Retry acquisition | YES | PASS | NOT RUN | Added simulator location, retried, and acquired a fix |
| GPS | Coordinates + reported accuracy | YES | PASS | NOT RUN | Device-reported coordinates/accuracy rendered and persisted; exact values excluded from log |
| Method | Select configured test type | YES | PASS | NOT RUN | Phase 10 choice selected; empty selection error exercised first |
| Method | Required collector provenance | YES | PASS | NOT RUN | Required feedback and persisted collector role exercised |
| Method | Required method/instrument | YES | PASS | NOT RUN | Required feedback, focus order, and review round-trip exercised |
| Measurements | Required core fields | YES | PASS | NOT RUN | Temperature, pH, DO, and conductivity entered and reviewed |
| Measurements | All configured optional fields | YES | PASS | NOT RUN | Every Phase 10 optional parameter entered and reviewed |
| Measurements | Numeric keyboard/editing | YES | PASS | NOT RUN | Decimal entry, select-all correction, drag dismiss, and repeated focus tested; Android pending |
| Measurements | Signed numeric entry | YES | PASS | NOT RUN | Accessible ORP sign toggle produced and persisted a negative value |
| Measurements | Required-entry feedback | YES | PASS | NOT RUN | Empty form and missing required core entry rejected without client scientific plausibility rules |
| Temperature | Entered unit selected first | YES | PASS | NOT RUN | Disabled entry before unit and required error exercised |
| Temperature | Preserve entered value/unit | YES | PASS | NOT RUN | Fahrenheit entered value/unit retained through draft, server, and revision history |
| Temperature | Immediate C/F derivation | YES | PASS | NOT RUN | Fahrenheit-to-Celsius derived display verified |
| Notes | Contract-permitted field notes | YES | PASS | NOT RUN | Privacy guidance, entry, review, server detail, and revision display exercised |
| Attachments | No fake v1 attachment controls | YES | PASS | NOT RUN | No attachment control exposed; explicit v1 explanation shown |
| Navigation | Five-step forward progression | YES | PASS | NOT RUN | Site → Visit → Method → Measurements → Review exercised twice |
| Navigation | Native back without data loss | YES | PASS | NOT RUN | Review/edit stack round-trip plus interrupted relaunch recovery passed |
| Navigation | Review edit round-trip | YES | PASS | NOT RUN | Measurements reopened, corrected, and returned to review |
| Review | Complete observation summary | YES | PASS | NOT RUN | Site, visit, provenance, all measurements, notes, and record state verified |
| Review | Missing-entry guidance | YES | PASS | NOT RUN | Method/measurement errors announce and focus relevant workflow entries |
| Review | Operational failure vs completeness copy | YES | PASS | NOT RUN | Real Firestore path defect was correctly separated from contract incompleteness after fix |
| Draft | Save locally | YES | PASS | NOT RUN | Complete draft queued while native Firestore network was disabled |
| Draft | Resume after relaunch | YES | PASS | NOT RUN | Full process interruption passed for revisions 1 and 2 |
| Sync | Saved locally state | YES | PASS | NOT RUN | Observed with pending offline Firestore writes |
| Sync | Syncing state | YES | NOT RUN | NOT RUN | Metadata mapping implemented; transient literal state not yet captured |
| Sync | Synced/server state | YES | PASS | NOT RUN | Observed after network re-enable and for submit/resubmit |
| Sync | Failed + retry | YES | NOT RUN | NOT RUN | Safe retry implementation exists; controlled rejected/unavailable write proof remains |
| Sync | Offline → reconnect → sync | YES | PASS | NOT RUN | Native Firestore network disabled, draft queued, network re-enabled, Synced observed |
| Submission | Submit observation | YES | PASS | NOT RUN | Real Firestore transition reached `SUBMITTED` and Synced |
| Submission | Prevent duplicate submission | YES | PASS | NOT RUN | Submitted revision/detail exposes no edit or submit action |
| Submission | Immutable submitted revision | YES | PASS | NOT RUN | Read-only revision detail and revision 1 preservation verified |
| Submission | Submission detail/status | YES | PASS | NOT RUN | Live status, sync, measurements, provenance, notes, and history rendered |
| Submission | Recent submissions list | YES | PASS | NOT RUN | Relaunch showed submitted record from Firestore |
| Validation | Permitted validation results | YES | PASS | NOT RUN | Server-authored warning/message/rule code rendered read-only |
| Validation | Server data-confidence result | YES | NOT RUN | NOT RUN | Release-candidate source parses server-owned confidence metadata and explicitly labels it data confidence, not water health; server-score fixture/native proof remains |
| Validation | Blocking ERROR presentation | YES | NOT RUN | NOT RUN | Severity mapping implemented; a safe server ERROR fixture remains |
| Correction | NEEDS_CORRECTION detail/action | YES | PASS | NOT RUN | Live server decision, reviewer comment, warning, and creation action exercised |
| Correction | New correction revision | YES | PASS | NOT RUN | Revision 2 copied prior science under existing contract and remained locally resumable |
| Correction | RESUBMITTED transition | YES | PASS | NOT RUN | Real Firestore transition reached `RESUBMITTED` and Synced |
| Correction | Prior revision remains immutable | YES | PASS | NOT RUN | Revision 1 retained original nitrate value; revision 2 retained corrected value |
| Correction | Two-revision history/detail | YES | PASS | NOT RUN | Both read-only rows and distinct detail values exercised |
| Offline | App launch with cached catalog/data | YES | NOT RUN | NOT RUN | Persistence exists; terminate/launch while network disabled remains |
| Offline | Empty cache explanation | YES | NOT RUN | NOT RUN | Release-candidate source now exits indefinite loading with explicit reconnect/refresh guidance; clean-install offline proof remains |
| Analytics | Fixed privacy-safe coarse events | YES | NOT RUN | NOT RUN | CI enforces wrapper-only Analytics, forbidden payload terms, no identity properties, iOS no-Ad-ID support, Android AD_ID blocking, and disabled automatic native screen reporting; runtime DebugView is optional evidence, not a privacy prerequisite |
| Accessibility | Accessible names/roles/states | YES | PASS | NOT RUN | Core hierarchy passed on iOS; source audit covers buttons, fields, status, progress, account, and loading states; Android/TalkBack remains |
| Accessibility | Dynamic Type/large text | YES | NOT RUN | NOT RUN | Scalable system type, min-height controls, wrapping status/header/date rows, and scrollable forms implemented; largest native text-size pass remains |
| Accessibility | Screen-reader announcements | YES | NOT RUN | NOT RUN | Alerts/live regions plus auth/method/measurement announcements implemented; VoiceOver/TalkBack pass remains |
| Accessibility | Contrast and non-color cues | YES | PASS | NOT RUN | Creekline token review plus semantic text/icons/state copy passed; final dark/light native spot-check remains |
| Accessibility | 48-point minimum targets | YES | PASS | NOT RUN | Buttons, rows, retry controls, account target, numeric toolbar, and primary interactions meet the source design minimum; Android native spot-check remains |
| Outdoor | Direct-sunlight light theme | YES | PASS | NOT RUN | Field-paper/ink/high-contrast light theme visually inspected; physical outdoor brightness test remains optional field acceptance evidence |
| Outdoor | High-legibility numeric entry | YES | PASS | NOT RUN | Large tabular numeric fields and persistent unit visibility exercised; Android pending |
| Platform | iOS product-complete parity | PARTIAL | NOT RUN | N/A | Main lifecycle passes; release-candidate auth/account negatives, cached launch, accessibility, and final EAS/native regression remain |
| Platform | Android product-complete parity | PARTIAL | N/A | NOT RUN | JavaScript export/CI passes and EAS native build is submitted; APK install/runtime, Firebase flow, and TalkBack remain |
