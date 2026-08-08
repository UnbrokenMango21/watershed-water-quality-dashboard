# Water-Quality Observation Quality Score

**Version:** 0.1.0  
**Status:** Approved for MVP / Step 4 completion  
**Scope:** Central PA Watershed Dashboard

## Purpose

The quality score measures **confidence in the observation and its provenance**, not whether the water itself is healthy. An environmentally extreme reading can still receive a high quality score if it was collected correctly, at the correct place, with traceable methods/instruments, and passes internal QA checks.

A separate **Anomaly Score** measures how unusual the measured values are compared with prior approved observations. This prevents a real pollution or low-DO event from being mislabeled as poor-quality data simply because it differs from history.

The supervisor remains the approval authority. The score is decision support only and never auto-approves or auto-rejects scientific data.

## Overall quality formula

For an observation with all components available:

`Q = 0.20C + 0.20L + 0.20M + 0.20V + 0.10T + 0.10H`

Where:

- `C` = protocol completeness, 0–100
- `L` = location quality, 0–100
- `M` = method/instrument traceability, 0–100
- `V` = validation/internal consistency, 0–100
- `T` = temporal/provenance quality, 0–100
- `H` = historical consistency, 0–100

The final quality score is rounded to the nearest whole number for display while the unrounded value may be retained internally.

If a component is legitimately unavailable/not-applicable, its weight is removed and the remaining weights are renormalized. Missing a required field is not treated as unavailable: it is an ERROR and blocks progression.

## C — Protocol completeness (20%)

Hard rule: if any protocol-required field or measurement is missing, validation returns an ERROR and the observation cannot advance to supervisor review.

For observations that pass required-field validation:

`C = 100 × (required_present + 0.25 × recommended_present) / (required_total + 0.25 × recommended_total)`

Optional measurements that are not marked `recommended` by the active protocol do not reduce completeness.

## L — Location quality (20%)

GPS is mandatory for new mobile submissions. Location quality combines the phone-reported horizontal GPS accuracy with the distance from the expected sampling-site location.

`L = 0.65A + 0.35P`

### GPS accuracy subscore A

- `≤ 5 m` → 100
- `> 5–10 m` → 95
- `> 10–20 m` → 85
- `> 20–50 m` → 65
- `> 50 m` → 40 and recapture/confirmation warning
- missing/invalid GPS → ERROR

### Site-proximity subscore P

Each site has a configurable `siteToleranceM`; MVP default is 30 m.

Let `d` be measured distance from the expected site point and `R = siteToleranceM`:

- `d ≤ R` → 100
- `R < d ≤ 2R` → 85
- `2R < d ≤ 4R` → 60
- `d > 4R` → 30 and strong review warning

The site tolerance can later be tuned for locations where safe/realistic sampling occurs along a reach rather than at an exact point.

## M — Method/instrument traceability (20%)

Method and instrument identification are mandatory for future user-collected measurements.

`M` is additive:

- Test Type identified → 20 points
- Test method identified → 30 points
- Instrument, laboratory, or analytical source identified → 30 points
- Calibration / verification / QC status documented, or explicitly marked not applicable with rationale → 20 points

If `Other` is selected for method/instrument/test type, the accompanying description is required for that portion to receive credit.

## V — Validation and internal consistency (20%)

Physical impossibilities and schema errors block progression and therefore do not receive a normal final quality score.

For observations without blocking errors:

`V = max(50, 100 - min(40, 10W) - min(10, 5I))`

Where:

- `W` = unresolved **data-quality** warnings
- `I` = unresolved data-quality informational flags

Environmental-condition alerts do not reduce `V`. For example, genuinely low dissolved oxygen may be environmentally concerning but is not automatically evidence of bad collection.

Examples of checks contributing to `V` include numeric/type validity, unit consistency, temperature F/C conversion agreement, impossible values, duplicate-submission checks, and method-dependent consistency checks.

## T — Temporal/provenance quality (10%)

- exact collection date/time with timezone/source plus server receipt timestamp → 100
- exact collection datetime but timezone must be inferred → 90
- historical date known but time not recorded → 75, with `timePrecision = DATE_ONLY`
- imputed technical placeholder time → 75 and must never be displayed as an observed time
- missing collection date → ERROR

New mobile submissions require date and time. Historical records may remain date-only and are not falsified with a displayed invented collection time.

## H — Historical consistency (10%)

Historical comparison is deliberately low-weight because natural environmental change must not be mistaken for measurement error.

Only previously **approved** observations may be used as the baseline. Comparison order is:

1. same site + same parameter + same method/test type + seasonal window when enough data exist;
2. same site + same parameter + seasonal window;
3. same site + same parameter across all approved dates.

A seasonal window is initially ±45 days of day-of-year.

Baseline minimums:

- fewer than 8 comparable observations → H unavailable; remove its weight and renormalize
- 8–19 observations → provisional baseline; use an effective H weight of 5% and renormalize the remaining score
- 20+ observations → established baseline; use the full H weight of 10%

The project's initial historical dataset may seed a provisional baseline. It is never treated as a permanent gold standard; the baseline continuously improves as new approved observations accumulate.

### Robust historical comparison

For each parameter with a usable baseline, compute the modified z-score:

`z* = 0.6745 × (x - median) / MAD`

where MAD is the median absolute deviation. If MAD is zero and no defensible fallback variability estimate exists, that parameter's historical score is treated as unavailable rather than inventing precision.

Parameter historical-consistency subscore:

- `|z*| ≤ 2` → 100
- `2 < |z*| ≤ 3` → 90
- `3 < |z*| ≤ 4` → 75
- `|z*| > 4` → 60

`H` is the mean of the available parameter historical-consistency subscores.

Because H bottoms at 60 and carries only 5–10% weight, even a very unusual but otherwise well-collected observation loses only a few quality-score points.

## Separate Anomaly Score

The system also computes a supervisor-facing anomaly score that does **not** directly determine quality:

For each parameter with a historical baseline:

`a_i = min(100, 25 × |z*_i|)`

`AnomalyScore = mean(a_i)`

Suggested interpretation:

- 0–24: typical relative to baseline
- 25–49: mildly unusual
- 50–74: unusual
- 75–100: highly unusual

A powerful review pattern is therefore:

- high Quality + low Anomaly → routine trustworthy observation
- high Quality + high Anomaly → potentially important environmental event
- low Quality + high Anomaly → scrutinize collection/method before interpreting the event
- low Quality + low Anomaly → routine-looking value with weak collection/provenance

The Anomaly Score is internal/supervisor-facing for MVP. It is not required on the public dashboard.

## Quality-score display bands

- 90–100: Excellent confidence
- 80–89: Good confidence
- 70–79: Review attention
- 60–69: Low confidence
- below 60: Very low confidence

These bands never replace supervisor review.

For the public ArcGIS dashboard, if implemented, the site indicator should display the **latest approved observation's quality score**, not a lifetime average. A rolling site-level score can be added later if useful.

## Critical rules

1. Quality Score measures data confidence, not water health.
2. Anomaly Score measures difference from history.
3. Historical data seeds the model but does not define permanent truth.
4. Environmental alerts do not automatically reduce data quality.
5. Blocking validation ERRORs stop workflow progression.
6. Scores never auto-approve observations.
7. Supervisors do not edit scientific measurements; corrections return to the collector and are revalidated.
8. Every score stores `qualityAlgorithmVersion` so past decisions remain reproducible.
