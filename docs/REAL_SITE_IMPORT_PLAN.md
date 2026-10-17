# Real site and historical observation import plan

Status: **waiting for the workbook.** Nothing has been imported and no site has been invented. This
plan describes how the program's Excel workbook (about five sites with existing observations) will
be reconciled into `siteCatalog` and, separately, reviewed before any observation is published.

## Principles

- Preserve the workbook exactly as received (checksum it; keep it outside Git with the other private
  evidence). Every derived row points back to its sheet, row number and column.
- Preserve entered values and units alongside canonical values. Convert only with a documented
  conversion from `config/production_measurement_catalog.json`; never infer a missing value, unit,
  time or method.
- Flag, do not guess: ambiguous rows go to a review list, not the import.
- Sites and observations are separate steps. Sites can go live for collection once approved;
  historical observations need their own scientific review before publication.

## Step 1 — Inspect (read-only)

1. List sheets, header rows, column names, data types, empty and merged cells.
2. Write an explicit column map (workbook column → schema field) for review. Expected site fields:
   `site_code`, `site_name_display`, `county`, `watershed_name`, `latitude`, `longitude`,
   `site_tolerance_m`. Expected observation fields: site, date, time and timezone, collector (if
   present), method or test type, instrument or laboratory, each parameter with its unit.
3. Identify coordinate format and datum. Reject coordinates that are missing, `0,0`, or outside
   Pennsylvania's bounding box without silently correcting them.
4. Record any provenance columns (who collected, lab report numbers, QA notes).

## Step 2 — Sites

1. Produce a proposed `siteCatalog` document per site with `active: false` and
   `publication_approved: false`, plus a diff against the current catalog.
2. The program confirms names, codes, coordinates and tolerance. **Tolerance is a program decision**
   (see `docs/SUPERVISOR_QUESTIONS.md` #7); the engineering placeholder of 30 m is not assumed.
3. After confirmation, the release lane writes the documents and flips `active: true`. The apps show
   them automatically (they query `active == true`).
4. Deactivate the 18 `TEST-` fixtures with the plan printed by `scripts/audit_site_catalog.mjs`
   (update `active: false`; never delete, because historical submissions load their site document).

## Step 3 — Historical observations (separately reviewable)

1. Map each row to a revision-shaped record: `collected_at` (with explicit timezone handling),
   `test_type` stored value, `method_name`, `instrument_name`, and one measurement per parameter with
   `entered_value`, `entered_unit_code`, canonical `value`, `unit_code`.
2. Rows missing required contract fields (temperature, method, instrument/laboratory) are listed
   for the program, not filled in.
3. Values outside hard ranges are flagged, not dropped.
4. Load into the Firestore emulator first, run the existing validation engine, and review the flags.
5. Import into the live project only after sign-off, marked with provenance (import batch ID and
   workbook row), with collector identity handled as the program directs. Imported observations go
   through QC review like any other submission, and publication stays approved-only.

## Deliverables when the workbook arrives

- Column map and anomaly report (for review, not applied).
- Proposed site documents plus the TEST-fixture deactivation plan.
- Emulator validation report for the historical rows.
- A single reviewed import script with dry-run by default, matching the other `scripts/` tools.
