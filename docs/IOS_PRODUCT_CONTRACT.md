# PA Watershed Watch 1.0 — collector product contract

The iOS app is the reference implementation. Android must match the **behavior, terminology,
information architecture and scientific semantics** below using native Compose conventions; it does
not need to match pixels. Source of truth for code: `Phone App/iPhone App/PAWatershedWatch`.
Frozen at branch `agent/claude-final-polish` (see `git log` for the exact commit).

## 1. Screen order

```
First launch → Welcome (once per device) → Sign In | Create Account → Ready to collect (confirm name)
→ Home ─┬─ Start New Observation → 1 Choose Site → 2 Visit Details → 3 Method → 4 Measurements
        │                           → 5 Notes → 6 Review → Submit (confirm) → Submission Status
        └─ Observations tab → Observation Detail → (Needs Correction) Correction Revision → Revision Status
Top-right account control (Home and Observations) → Account sheet → Full Name · About · Sign Out
```

- Bottom navigation has exactly two destinations: **Home** and **Observations**. Account is never a tab.
- The tab bar is hidden inside the observation and correction flows.
- Welcome is reopenable from Sign In ("About PA Watershed Watch") and Account → About.

## 2. Terminology (user-facing)

| Concept | Label |
|---|---|
| Primary action | Start New Observation |
| Step titles | Choose Site · Visit Details · Method · Measurements · Notes · Review |
| Method question | How was this observation measured? |
| Method choices (new observations) | Field instrument (in situ) · Field test kit / colorimetric · Penn State laboratory · External laboratory · Other method |
| Legacy-only choices (shown if already on a record) | Continuous sensor / sonde · Field instrument and laboratory |
| Details section | Method details — *Needed so reviewers can trace how each value was produced.* |
| Detail fields | Instrument / Test kit / Laboratory / Instrument, kit, or laboratory (by type) → `instrument_name`; Method or Sample collection → `method_name` |
| Identity | Full name — "your real name, not a username" |
| Correction | Correction Revision · "Resubmit as Revision N+1" · "Revision N stays in the record unchanged" |

Stored `test_type` values are unchanged: `In-situ / Field Instrument`, `Penn State Lab`, `External Lab`,
`Field Kit / Colorimetric`, `Continuous Sensor / Sonde`, `Mixed In-situ + Lab`, `Other`.

## 3. Authentication and identity

- Email/password sign-in, **Create Account** (full name, email, password ≥ 8), and **Continue with Google**.
- **Password reset** sends Firebase's reset email; the confirmation never reveals whether an account exists.
- Account creation sends a verification email; verification is *not* required to collect (supervisor question 11).
- Provider collisions: "An account already uses this email…" / "…uses a password. Sign in with your email and password instead." Firebase one-account-per-email is relied on; the app never creates a second person.
- **Ready to collect**: shown after the first sign-in on a device, and whenever the account has no name. The confirmed name is the collector recorded as `data_collected_by` on new revisions. No email-fragment fallback.
- **Name change** (Account → Full name): updates the Firebase Auth display name, then calls `updateMyDisplayName` (region `us-east4`) to mirror `users/{uid}.display_name`. The callable accepts only `displayName`, 2–80 characters, whitespace collapsed, no control characters. Historical revisions keep the name they were submitted with.
- Account shows: name, email, sign-in method, email verification (password accounts), password reset (password accounts), connection, waiting-to-sync count, sites available, About, Version `x.y.z (build)` from the bundle, Sign Out (warns when observations are unsynced). No UID, claims or tokens. Privacy/Support rows appear only when real URLs are configured.

## 4. Site picker

- Data: `siteCatalog` where `active == true`. Decode `county` and `watershed_name`, falling back to legacy `county_display` / `watershed_display`; also `site_code`, `site_tolerance_m`. Reject missing/blank names, `0,0`, out-of-range coordinates, and documents whose `site_id` ≠ document ID.
- Cache: replacing the catalog marks missing sites **inactive** (kept for historical record names), never deleted; only active sites are selectable.
- UI: pinned search field (name, code, county, watershed) · map with a pin per site and the user's location when permitted · list sorted by distance when a location fix exists, else A–Z · "Nearest" label only for the first result when a real fix exists and no search is active · selecting from list or map highlights the site; choosing a result closes the keyboard · "Continue with This Site".
- Collectors never move or create sites.

## 5. Visit details

Date and time in Pennsylvania (Eastern) time; GPS captured on arrival with accuracy (good ≤ 20 m); Reacquire GPS; distance from the site location, with a non-blocking note when beyond `site_tolerance_m`; collector name from the account (read-only here). Continuing requires a GPS position.

## 6. Measurements

- Offered: only `FULLY_SUPPORTED` parameters from `config/production_measurement_catalog.json`. Feature-gated parameters are hidden; an older draft holding a gated value shows that row only to clear it.
- Required: **Water Temperature only** (supervisor question 1). Hard ranges only: temperature −5–60 °C, pH 0–14, DO 0–50 mg/L, DO saturation 0–300 %, non-negative for the other supported parameters except ORP.
- Entered value and unit are preserved with the canonical value. Unit picker shows a standard checkmark on the current unit; units that cannot be converted safely require confirmation to clear.

## 7. Keyboard and bottom bars

Every flow step has one bottom bar: save note + step N of 6 + progress + primary action. While the keyboard is up the bar collapses to **[Next Field] … [Done]** above the primary action and sits directly on the keyboard. No floating keyboard toolbars. At accessibility text sizes the save note is dropped; the step count remains.

## 8. Notes

Optional, full-height editor that fills the screen above the bottom bar, placeholder guidance, character count, saved with the draft.

## 9. Review and submit

Readiness card first: **Ready to submit** (seal icon) or **Must fix before submitting** (octagon icon) listing every blocking issue with a Fix action, plus **Worth checking (won't block)** warnings (GPS accuracy > 20 m, beyond site tolerance). Then cards: Site · Date and time · Location · Method · Measurements (value and unit right-aligned, temperature conversion beneath) · Field notes · Collector, each with Edit. Submit asks for confirmation and states that revision N will be locked.

## 10. Statuses

Workflow (server): Submitted · Validating · Pending Review · Needs Correction · Resubmitted · Approved · Rejected · Publishing · Publish Failed · Published — each with its own icon. Sync (device): Saved on this phone · Waiting to sync · Syncing · Synced · Sync failed. Lifecycle view: Saved on this phone → Received by the archive → Automated validation → QC review → Public release. **Approved shows "Approved, not yet published."** Each stage states its outcome in words, not color alone.

## 11. Drafts and sync

One draft per account on the device, autosaved on every change, restored after relaunch with a Resume card on Home (site, step N of 6). Submitting locks the revision locally and queues it; sync retries automatically when online and on demand.

## 12. Correction workflow

Home and Observations surface Needs Correction first. Detail shows the reviewer's comment and validation flags, and **Create Correction Revision**. The correction screen shows Revision N as submitted (read-only), editable measurements, and a required "What did you check?" note, then **Resubmit as Revision N+1**. Revision N is never modified; the server expects exactly N+1 and the parent in `NEEDS_CORRECTION`.

## 13. Design tokens

| Token | Light | Dark |
|---|---|---|
| Hemlock (primary) | #0D5C4B | #63D3B3 |
| Water (secondary) | #167A8B | #6BC9D5 |
| Fern (success) | #2E7D52 | #66D49A |
| Goldenrod (attention) | #955600 | #F3B65C |
| Limestone (background) | #F3F1E9 | #171A18 |
| Ink (text) | #17211E | #F1F5F3 |

Spacing 4/8/16/24/32; corner radius 12/16/24; primary buttons ≥ 56 pt tall; touch targets ≥ 44 pt.

## 14. Accessibility rules

Every control has a label; decorative icons are hidden; status is conveyed by icon and text, never color alone; screens work at accessibility text sizes (verified by UI test); map has a list equivalent; headers carry the header trait; selected rows carry the selected trait; every SF Symbol used is verified to exist (unit test).

## 15. Verification

- `bash scripts/dev.sh ios` — unit tests (product contract, canonical mapping, immutability).
- `bash scripts/dev.sh ios-ui` — emulator-backed end-to-end UI tests (first run through correction Revision 2; large text; name change and draft relaunch). `IOS_UI_DEVICE_TYPE` and `IOS_UI_APPEARANCE=dark` vary device and theme.
