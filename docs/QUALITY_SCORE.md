# Water-Quality Observation Data Quality / Confidence Score

**Version:** 1.0.0  
**Status:** Phase 10 implementation baseline  
**Scope:** Central Pennsylvania freshwater streams and creeks

## Purpose

The score measures **confidence in the observation and its provenance**. It does **not** measure whether the stream itself has good or bad water quality.

A scientifically extreme observation can retain an excellent confidence score when it was collected at the intended site, with traceable methods, internally consistent values, and valid provenance. Environmental alerts and historical anomalies are therefore separated from data-quality errors.

An unresolved `ERROR` blocks progression regardless of any component score. Scores never auto-approve or auto-reject an observation.

## Severity behavior

- `ERROR`: missing required information, impossible/hard-invalid values, internal contradictions, or invalid location/time structure. Blocks supervisor review.
- `PLAUSIBILITY_WARNING`: possible but questionable data or internal consistency concern. Does not block; may reduce the relevant confidence component.
- `ENVIRONMENTAL_ALERT`: possible environmental condition worth human attention. Does not block and does not reduce confidence merely because the environment is unusual.
- `INFO`: explanatory/context information only. Does not block and does not reduce confidence.

The UI may present both warning subtypes under the human-facing label **WARNING**, while retaining their distinct internal classes.

## Overall formula

With every component available:

`Q = 0.20C + 0.20L + 0.20M + 0.20V + 0.10T + 0.10H`

Where:

- `C` = protocol completeness
- `L` = location quality
- `M` = method/instrument traceability
- `V` = validation/internal consistency
- `T` = temporal/provenance quality
- `H` = historical consistency

All components are 0–100. If a component is legitimately unavailable/not applicable, its weight is removed and remaining weights are renormalized. A missing required field is **not** treated as unavailable; it is an `ERROR`.

## C — Completeness (20%)

Completeness is evaluated against the active protocol and declared Test Type. Optional parameters that were not required by the selected protocol do not reduce the score and do not provide bonus points simply for being collected.

For the v1 in-situ/sonde/mixed profile, the core is:

- water temperature
- pH
- dissolved oxygen concentration (mg/L)
- conductivity (µS/cm)

Lab-only and field-kit profiles are configurable and are not forced to provide irrelevant in-situ parameters; they must provide at least one declared measurement and complete method/instrument provenance.

Missing required items produce an `ERROR`; the overall score remains unset until corrected.

## L — Location quality (20%)

`L = 0.65A + 0.35P`

GPS accuracy score `A`:

- ≤5 m → 100
- >5–10 m → 95
- >10–20 m → 85
- >20–50 m → 65
- >50 m → 40 + recapture/confirmation warning
- invalid/missing coordinates or accuracy → `ERROR`

Site proximity score `P`, with site tolerance `R` (default 30 m):

- distance ≤ R → 100
- R < distance ≤ 2R → 85
- 2R < distance ≤ 4R → 60
- distance > 4R → 30 + strong review warning

If an expected site geometry is legitimately unavailable, the proximity dimension is omitted rather than inventing a penalty.

## M — Method/instrument traceability (20%)

Nominal dimensions:

- Test Type → 20 points
- method → 30 points
- instrument/laboratory analytical source → 30 points
- calibration/verification/QC documentation → 20 points

When the active schema does not yet capture a traceability dimension, that dimension is unavailable and the applicable points are renormalized. Once calibration/QC metadata becomes an active protocol field, it receives its configured weight.

`Other` selections require explanatory text where supported.

## V — Validation/internal consistency (20%)

For observations without blocking errors:

`V = max(50, 100 - min(50, 10W))`

`W` counts unresolved **data-quality** plausibility warnings assigned to the validation component.

Environmental alerts, informational flags, and location warnings do not reduce `V`; location already has its own component and environmental conditions must not be mistaken for collection quality.

Examples include temperature C/F contradiction, DO concentration-vs-percent consistency, numeric/unit problems, and instrument-dependent hard-range checks.

## T — Temporal/provenance quality (10%)

- exact known collection datetime with normal provenance → 100
- legacy date-only / imputed technical time → 75 and must never be displayed as an observed time
- slightly future timestamp consistent with device-clock error → warning and reduced temporal score
- missing/invalid date or grossly contradictory timestamp ordering → `ERROR`

The application convention is Eastern Time for users and workflow presentation; backend platforms may normalize timestamps internally.

## H — Historical consistency (up to 10%)

Historical comparison is intentionally low-weight and uses only **approved** observations. Different-from-history is never treated as equivalent to wrong.

Comparison preference remains:

1. same site + parameter + method/test type + seasonal window;
2. same site + parameter + seasonal window;
3. same site + parameter across approved dates.

Seasonal window starts at ±45 days of day-of-year.

Baseline availability:

- fewer than 8 comparable observations → unavailable; remove H and renormalize
- 8–19 → provisional baseline, maximum nominal H weight 5%
- 20+ → established baseline, maximum nominal H weight 10%

Historical influence is further multiplied by a confidence factor derived from sample count, recency, and baseline stability. This means a small, old, or highly variable baseline exerts less influence than a large, recent, consistent baseline.

Primary robust statistic:

`z* = 0.6745 × (x - median) / MAD`

If MAD is zero but IQR is nonzero, use the robust fallback:

`z = (x - median) / (IQR / 1.349)`

If neither provides defensible variability, that parameter is unavailable for historical scoring.

Historical subscore:

- |z| ≤ 2 → 100
- 2 < |z| ≤ 3 → 90
- 3 < |z| ≤ 4 → 75
- |z| > 4 → 60

A large historical deviation creates an environmental/historical review alert, not a blocking validation error.

## Separate Anomaly Score

For each parameter with a usable baseline:

`a_i = min(100, 25 × |z_i|)`

`AnomalyScore = mean(a_i)`

Interpretation:

- 0–24 → typical
- 25–49 → mildly unusual
- 50–74 → unusual
- 75–100 → highly unusual

The key review combinations are:

- high Confidence + low Anomaly → routine trustworthy observation
- high Confidence + high Anomaly → potentially important environmental event
- low Confidence + high Anomaly → verify collection/method before environmental interpretation
- low Confidence + low Anomaly → ordinary-looking value with weak provenance

## Confidence display bands

- 90–100 — Excellent confidence
- 80–89 — Good confidence
- 70–79 — Acceptable confidence
- 60–69 — Review carefully
- <60 — Low confidence

Any public-facing indicator must be explicitly labeled as **Data Confidence** or equivalent, never simply “Water Quality Score.” If enabled on the public dashboard, use the latest approved observation's confidence score rather than a lifetime average.

## Critical invariants

1. Confidence measures data/provenance quality, not environmental health.
2. Environmental alerts do not automatically reduce confidence.
3. Historical anomalies never block solely because they differ from history.
4. Required-field/hard-validity `ERROR`s block workflow progression.
5. Numerical scores never override severity.
6. Optional uncollected parameters do not reduce or boost score.
7. Supervisors return scientific corrections to collectors rather than silently editing measurements.
8. Store `qualityAlgorithmVersion` with every result for reproducibility.
