# Step 4 — Collection, Validation, Privacy, and UX Decisions

**Status:** Draft — Step 4 remains open

This document records design decisions for the Central PA Watershed Dashboard before ArcGIS Pro schema implementation.

## 1. Core required measurements

For new field submissions, the default core water-quality protocol requires:

- Water Temperature
- pH
- Dissolved Oxygen concentration (canonical storage: mg/L; legacy spreadsheet may display `DO (ppm)`)
- Specific Conductance / Conductivity (µS/cm)

Rationale: Pennsylvania DEP commonly configures continuous instream monitors for water temperature, specific conductance, pH, and dissolved oxygen. USGS also treats temperature, pH, specific conductance, and dissolved oxygen as routine field measurements.

Optional/configurable measurements:

- DO (%) saturation
- TDS (ppm)
- ORP (mV)
- Chloride (mg/L)
- Sulphate (mg/L)
- Nitrate (mg/L)
- Phosphate (mg/L)
- Q (m³/s)

A protocol may later make any optional parameter required for a specific project/site.

## 2. Temperature UX

The mobile app asks the collector to choose `°F` or `°C` before entering water temperature.

The collector enters only one value. The app immediately calculates and displays the other value:

- `C = (F - 32) × 5 / 9`
- `F = C × 9 / 5 + 32`

Rules:

- Preserve the exact entered value and entered unit.
- Store canonical Celsius for analysis.
- Store the derived counterpart with a `derived=true` marker.
- UI displays the converted value to at most 2 decimal places.
- Do not imply more source precision than the entered measurement.
- For historical imports containing both F and C, validate that the pair is conversion-consistent rather than overwriting either source value.

## 3. Test Type

Legacy/current rows use:

- `In-situ/Penn State Lab`

Future controlled choices:

- `In-situ / Field Instrument`
- `Penn State Lab`
- `External Lab`
- `Field Kit / Colorimetric`
- `Continuous Sensor / Sonde`
- `Mixed In-situ + Lab`
- `Other`

`Other` requires free-text detail.

Canonical design note: test type should ultimately be attached to each measurement or measurement group because one sampling event can combine field-meter and laboratory results. The spreadsheet-level `Test Type` remains for compatibility and summary display.

## 4. Method and instrument

For all future measurements, method and instrument identification are mandatory.

Minimum metadata:

- `testType`
- `measurementMethod`
- `instrumentNameOrId`

`Other` is always available and requires a text description.

The app should minimize repetitive entry by allowing an instrument profile to populate all parameters measured by the same multiparameter meter/sonde.

## 5. Validation philosophy

The system must distinguish three concepts:

### ERROR — impossible/invalid data

Examples: invalid coordinates, pH outside the supported physical scale, negative concentrations, impossible type/schema values, values outside a selected instrument's hard measurement range.

Errors block normal progression until corrected.

### PLAUSIBILITY WARNING — value may be inaccurate

A value is technically possible but unusual enough to deserve review. Warnings do not automatically reject a submission.

### ENVIRONMENTAL ALERT — water may actually be in poor condition

This is not a data-quality penalty. A real low-DO or out-of-criterion pH reading can be scientifically important and must not be treated as inaccurate solely because the water quality is poor.

The quality score should primarily reflect collection quality, completeness, GPS quality, method/instrument traceability, internal consistency, and validation confidence — not whether the water itself is healthy.

## 6. Draft threshold policy

Thresholds remain versioned and configurable. Selected instrument ranges override generic hard limits when appropriate.

- pH: ERROR `<0` or `>14`; environmental alert outside Pennsylvania's general `6.0–9.0` criterion.
- Water temperature: generic ERROR `<-5°C` or `>60°C`; plausibility warning outside `0–35°C`. Later, site-specific Pennsylvania designated-use and seasonal temperature criteria should drive environmental alerts.
- DO (mg/L): ERROR `<0` or `>50`; environmental alert `<5 mg/L`; stronger environmental alert `<3 mg/L`; plausibility warning for very high values such as `>20 mg/L` unless supported by instrument/site context.
- DO (%): ERROR `<0` or `>300`; values over 100% remain allowed because supersaturation is possible.
- Conductivity: ERROR `<0`; do not reject high conductivity. Use site baseline/historical context. A value above ~1500 µS/cm can trigger contextual review, not automatic rejection.
- TDS, ORP, chloride, sulphate, nitrate, phosphate: reject negative concentrations where chemically applicable; otherwise prefer instrument-range and method-aware checks over arbitrary global maximums.
- Q (m³/s): ERROR `<0`; `0` is valid. No generic high-flow rejection.

Important nutrient note: `Nitrate (mg/L)` and `Phosphate (mg/L)` are scientifically ambiguous unless the analyte basis/method is known (for example nitrate as N vs nitrate ion; phosphorus forms vs orthophosphate). Method metadata must resolve this before criterion-based validation is applied.

## 7. GPS

GPS is mandatory for new mobile submissions.

The app captures, rather than asks the user to type:

- latitude
- longitude
- horizontal accuracy in meters
- capture timestamp

Draft quality bands:

- `≤10 m`: preferred/full location-quality credit
- `10–20 m`: acceptable, minor quality reduction
- `20–50 m`: warning; prompt user to wait/recapture
- `>50 m`: strong warning and explicit confirmation/retry path
- missing GPS or invalid latitude/longitude: ERROR

Do not hard-reject merely because the phone reports imperfect accuracy if the collector can document the situation; route poor accuracy to review.

## 8. Supervisor correction rule

Supervisors do **not** edit scientific measurements directly.

`PENDING_REVIEW → NEEDS_CORRECTION → collector edits staging submission → RESUBMITTED → VALIDATING → PENDING_REVIEW`

Reviewer comments and every transition are recorded in the immutable audit trail.

## 9. Public quality score

ArcGIS Dashboards supports feature-based numeric indicators and conditional formatting. Therefore a single public quality score may be displayed for a selected/latest site observation.

This is optional polish, not a release blocker. The dashboard must remain useful without it.

## 10. Privacy and site names

Backend site names may remain unchanged, including landowner-identifying names, but those fields must never be exposed in public layers/views.

Public dashboard title: **Central PA Watershed Dashboard**.

If a backend `SiteName` contains private/landowner information, the public layer uses a safe generated label such as `Sampling Site <SiteCode>` or another non-identifying alias. No landowner name, private access note, reviewer identity, or collector identity is exposed publicly.

## 11. Historical missing time

New records require both date and time.

Historical rows with date but no recorded time must never be presented as if a real time were known. If ArcGIS requires a complete datetime for technical storage, use a neutral internal placeholder (recommended: 12:00 local) plus:

- `timeKnown = false`
- `timeImputed = true`
- `timePrecision = DATE_ONLY`

Public UI displays the date only or `Time not recorded`; it must not display the placeholder as an observed sampling time.

## 12. Acceptance-test principle

The existing historical spreadsheet will not be pre-ingested during development. After the complete collection → validation → review → publication pipeline is working, the real dataset will be uploaded by the project owner as an acceptance test of the same ingestion path expected for users.

## Research basis

- Pennsylvania DEP Continuous Instream Monitoring: https://www.pa.gov/agencies/dep/programs-and-services/water/clean-water/water-quality/continuous-instream-monitoring-reports
- Pennsylvania Chapter 93 Water Quality Standards: https://www.pacodeandbulletin.gov/Display/pacode?file=%2Fsecure%2Fpacode%2Fdata%2F025%2Fchapter93%2Fs93.7.html
- USGS National Field Manual: https://www.usgs.gov/mission-areas/water-resources/science/national-field-manual-collection-water-quality-data-nfm
- EPA Dissolved Oxygen indicator: https://www.epa.gov/national-aquatic-resource-surveys/indicators-dissolved-oxygen
- EPA Conductivity indicator: https://www.epa.gov/national-aquatic-resource-surveys/indicators-conductivity
- GPS accuracy reference: https://www.gps.gov/gps-accuracy
- ArcGIS Dashboard indicator documentation: https://doc.arcgis.com/en/dashboards/latest/get-started/indicator.htm
