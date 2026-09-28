# Supervisor question register

Open scientific and program decisions that engineering must not answer on its own. Each entry records
what the software does **today** so a reviewer can see the consequence of leaving it unanswered.
Answers belong to the research supervisor or program lead; record the decision, the decider, and the
date here, then engineering changes configuration and tests to match.

Last updated: 2026-09-27 (branch `agent/claude-final-polish`).

| # | Question | Current engineering default (not a scientific decision) | Where it lives |
|---|---|---|---|
| 1 | **Which measurements are required?** | Water Temperature only, for every method. | `requiredMeasurements` (iOS `Model.swift`, Android `Model.kt`); `config/validation_rules.json` `testTypeProfiles` |
| 2 | **Which measurements are optional?** | Every other parameter the production contract enables: pH, dissolved oxygen (mg/L and % saturation), conductivity, TDS, ORP, chloride, sulfate, nitrate, phosphate, discharge. | `config/production_measurement_catalog.json` (`FULLY_SUPPORTED`) |
| 3 | **Which planned parameters should be enabled?** | Hidden from collectors: turbidity, salinity, total suspended solids, alkalinity, hardness, ammonia nitrogen, nitrite nitrogen, total phosphorus, chlorophyll a, *E. coli*. Each lacks a parameter code, validation rule, Firestore unit contract and publication mapping. | catalog `FEATURE_GATED` entries |
| 4 | **Which planned parameters should stay hidden?** | All ten above, until item 3 is answered per parameter. | same |
| 5 | **What lower and upper bounds apply to each measurement?** | Hard ranges only where physically defined or already configured: temperature −5 to 60 °C; pH 0–14; DO 0–50 mg/L; DO saturation 0–300 %; non-negative for conductivity, TDS, chloride, sulfate, nitrate, phosphate, discharge; ORP unbounded (signed). | `config/validation_rules.json` `temperature.hardRangeC`, `parameters[*].hardRange/hardMin`; mirrored in both apps |
| 6 | **Which bounds are impossible (blocking) versus warning-only, and what is program-specific?** | Three tiers exist but are engineering placeholders. **Hard** (blocks): the ranges in #5. **Plausibility warning**: DO > 25 mg/L, DO saturation > 200 %. **Environmental context** (information for reviewers, never blocks): temperature outside 0–35 °C, pH outside 6.0–9.0, DO below 5 mg/L, TDS > 750 mg/L, chloride/sulfate > 250 mg/L, nitrate criterion 10 mg/L as N. The apps enforce only the hard tier. | `config/validation_rules.json`; `docs/QUALITY_SCORE.md` |
| 7 | **What real site catalog is authoritative?** | None yet. The development catalog holds 18 synthetic `TEST-` fixtures, which should be deactivated (not deleted) before production. Real sites will come from the program's workbook (about five sites). See `docs/REAL_SITE_IMPORT_PLAN.md`. | `siteCatalog`; `scripts/audit_site_catalog.mjs` |
| 8 | **What method and laboratory terminology does the program prefer?** | Collectors choose: Field instrument (in situ), Field test kit / colorimetric, Penn State laboratory, External laboratory, Other method. Stored values are unchanged (`In-situ / Field Instrument`, …). "Continuous sensor / sonde" and "Field instrument and laboratory" remain valid stored values but are not offered for new observations. | `TestType` (iOS), stored enum in `firebase/firestore.rules` `validTestType` |
| 9 | **Should method and instrument/laboratory details be optional?** | Required. The Firestore rules, validation errors `MEAS_METHOD_MISSING` / `MEAS_INSTRUMENT_MISSING`, and 60 quality-score points all depend on them. The apps no longer pre-fill invented values (for example "Grab sample" or an instrument model); collectors enter what they used, with suggestions only from their own earlier entries. Making them optional needs a rules change, a validation change, and a quality-score decision together. | `firebase/firestore.rules` `validCollectorRevisionCreate`; `validation/engine.mjs`; `config/quality_score.json` |
| 10 | **Which real observations are cleared for public ArcGIS publication?** | None. Publication is approved-only, refuses `TEST-` sites, requires `publication_approved` on the site, and remains gated off. | `publication/transform.mjs`; `functions/index.mjs` `ENABLE_ARCGIS_PUBLICATION_FUNCTION` |
| 11 | **Should email verification be required before collecting?** | Offered, not required: a verification email is sent at account creation, and Account shows the status. | iOS `FirebaseMobileService.createAccount` |
| 12 | **Is open self-registration intended?** | Anyone who can install the app may create a collector account (email or Google), matching the existing Google sign-in behavior. Every account starts as `COLLECTOR`; reviewer and admin roles stay server-provisioned. If the program wants invitation-only access, that needs an allowlist or claim check on the server. | `firebase/firestore.rules` `role()` default |

`docs/DATA_DICTIONARY.md` cites `docs/PHASE_11_SUPERVISOR_DECISIONS.md` for the temperature-only rule. That
file is not in this repository; if it exists privately, link or summarize it here so the decision
has a reviewable source.
