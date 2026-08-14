# Phase 11 Supervisor Decisions

This document separates what is **currently locked and implemented** from what is
**still an open question for the project supervisor**. Do not treat anything in the
open-questions section as answered — none of it has been invented or assumed by
implementation work; each item is genuinely undecided.

## Current interim rules (implemented)

- **Water Temperature is the only required science measurement**, for every test
  type, with no exceptions. This applies at the server (`config/validation_rules.json`
  — every `testTypeProfiles` entry has `requiredMeasurements: []` and
  `minimumMeasurementCount: 0`) and on both mobile clients.
- **Every other supported measurement is optional** for every test type: pH,
  Dissolved Oxygen, DO Saturation, Conductivity, TDS, ORP, Chloride, Sulfate,
  Nitrate, Phosphate, Discharge.
- **Optional values are still validated when entered.** A populated optional
  measurement goes through the same parsing (reject non-numeric input) and hard-range
  checks as before (e.g. pH 0–14, DO_MG_L 0–50 mg/L, DO_PERCENT 0–300%, temperature
  −5–60 °C). Only its *requiredness* was relaxed, not its validity checking.
  Blank optional fields never block Continue/Review/Submit.
- **Photo and audio capture are deferred.** See `docs/DEFERRED_MEDIA_FEATURE.md`.
  No camera/microphone UI or permission prompts exist in either mobile app; no new
  submission creates an attachment or attempts a Storage upload.
- **Site proposal/administration workflow is deferred.** See
  `docs/SITE_CATALOG_ADMINISTRATION_PHASE.md` for the full design; it is not
  implemented, and the locked QC review slice (`/review`, `review/reviewSubmission.mjs`,
  the reviewer Firestore rules) was not expanded to accommodate it.
- **The existing test-type catalog is retained** (`In-situ / Field Instrument`,
  `Penn State Lab`, `External Lab`, `Field Kit / Colorimetric`, `Continuous Sensor /
  Sonde`, `Mixed In-situ + Lab`, `Other`) unless a future decision changes it.
- **The existing QC review lifecycle is retained**: `PENDING_REVIEW` →
  Approve/Request Correction/Reject, with the atomic/idempotent/revision-aware/
  race-safe server-side review action, exactly three roles (`COLLECTOR`,
  `QC_REVIEWER`, `ADMIN`), and reviewers never editing scientific data.

## Open questions for the supervisor

None of the following have an authoritative answer yet. Where the app currently
behaves a particular way, that is an interim engineering default chosen to keep the
product usable — not a supervisor decision, and it should be expected to change once
these are answered.

1. **Required measurements by test type.** Is "temperature only, always" the
   permanent rule, or should specific test types (e.g. in-situ field-instrument
   readings) eventually require a specific measurement set again? If so, what set,
   per test type?
2. **Hard blockers vs. warnings.** Beyond the currently-implemented hard ranges
   (physically/chemically impossible values), which additional conditions should
   block submission outright versus merely warn the collector or flag the record for
   reviewer attention?
3. **Lab pending-results workflow.** When a collector selects a lab-based test type
   and results aren't back yet, what should the submission workflow actually look
   like — submit now with no results and a distinct "awaiting lab" state, submit a
   placeholder revision, or hold the whole submission client-side until results
   arrive?
4. **GPS requirement/accuracy.** Is GPS capture still mandatory for every submission,
   and what accuracy threshold (if any) should be a hard blocker versus a quality
   warning?
5. **Method/instrument requirements.** Should method name and instrument/lab source
   remain required for every submission and every test type, or should that vary?
6. **Site creation/proposals.** When (if ever) should the deferred site-proposal
   workflow (`docs/SITE_CATALOG_ADMINISTRATION_PHASE.md`) be built, and who is
   authorized to decide proposals — `ADMIN` only, or also `QC_REVIEWER`?
7. **Collector identity.** Is the collector's free-text display name sufficient
   long-term, or should collector identity be more structured (e.g. tied to a
   roster/organization)?
8. **Collection date/time rules.** Are there constraints beyond the existing
   future-timestamp and submitted-before-collected checks — e.g. a maximum age for a
   "current" observation, or different rules for historical/backfilled data entry?
9. **Notes.** Is free-text field notes sufficient, or should there be structured
   fields (e.g. weather, flow condition) beyond what already exists?
10. **Correction behavior.** Is the current one-new-revision-per-correction model
    (immutable prior revisions) the intended long-term behavior, or should collectors
    be able to make lighter-weight edits under some circumstances?
11. **Review comments.** Should Approve's optional comment or a Request
    Correction/Reject reason ever be visible to anyone besides `QC_REVIEWER`/`ADMIN`
    and the submitting collector (e.g. surfaced on a public dashboard, redacted or
    otherwise)?
12. **Offline behavior.** What are the expected guarantees when a collector submits
    with no connectivity — how long should a queued submission be retried locally,
    and what should the collector see if it can't sync?
13. **Future media requirements.** When photo/audio capture is reintroduced, what are
    the actual requirements — mandatory site photo, optional-only, size/format
    limits, retention/deletion policy, and moderation before a reviewer sees it?
14. **QC queue/filter preferences.** Does the reviewer queue need sorting/filtering
    beyond "oldest `PENDING_REVIEW` first" (e.g. by site, by collector, by flag
    severity, by test type)?
15. **Notifications.** Should collectors be notified when a submission is reviewed
    (approved/corrected/rejected), and should reviewers be notified when new
    submissions enter the queue? Via what channel?

Route answers to these back into `config/validation_rules.json` (measurement
requirements), the mobile apps' required-field indicators, and this document, rather
than re-deciding them ad hoc in a future implementation pass.
