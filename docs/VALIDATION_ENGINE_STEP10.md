# Phase 10 — Validation Engine

**Implementation baseline:** 1.0.0  
**Primary profile:** `central_pa_freshwater_stream_v1`

## Design goal

Detect questionable data without suppressing legitimate environmental anomalies.

The engine deliberately separates:

- hard data validity / structural errors;
- data-quality plausibility warnings;
- environmental alerts;
- informational context.

`ERROR` blocks review. Warning classes do not block. Environmental alerts do not reduce confidence merely because the stream condition is poor or unusual.

## Scientific basis used for v1

### Core field parameters

Pennsylvania DEP's Continuous Instream Monitoring program commonly configures monitors for four parameters: water temperature, specific conductance, pH, and dissolved oxygen. This is the basis for the v1 in-situ core profile.

Source: Pennsylvania DEP, Continuous Instream Monitoring Reports  
https://www.pa.gov/agencies/dep/programs-and-services/water/clean-water/water-quality/continuous-instream-monitoring-reports

USGS National Field Manual Chapter A6 provides standardized field guidance for temperature, dissolved oxygen, specific conductance, pH, ORP, and related field measurements.

Source: USGS National Field Manual  
https://www.usgs.gov/mission-areas/water-resources/science/national-field-manual-collection-water-quality-data-nfm

### Pennsylvania contextual criteria

Current 25 Pa. Code §93.7 includes, among other designated-use criteria:

- pH 6.0–9.0 for CWF/WWF/TSF/MF;
- dissolved oxygen minimum 5.0 mg/L for the main flowing-water categories, with additional averaging/designated-use requirements;
- chloride 250 mg/L for PWS;
- sulfate 250 mg/L for PWS;
- nitrite plus nitrate 10 mg/L as nitrogen for PWS;
- TDS 500 mg/L monthly average and 750 mg/L maximum for PWS.

Source: 25 Pa. Code §93.7  
https://www.pacodeandbulletin.gov/Display/pacode?file=%2Fsecure%2Fpacode%2Fdata%2F025%2Fchapter93%2Fs93.7.html

These values are **not** treated as universal single-sample validity limits. Where used by this engine, they generate contextual `ENVIRONMENTAL_ALERT`s. Designated use, averaging period, natural conditions, and site-specific criteria still matter.

### Dissolved oxygen

EPA notes that DO below 5 mg/L is generally stressful for fish, below 3 mg/L is too low to support many fish, and very low values can be natural/real environmental conditions. These therefore remain environmental alerts, not bad-data errors.

Source: EPA Dissolved Oxygen indicator  
https://www.epa.gov/national-aquatic-resource-surveys/indicators-dissolved-oxygen

When both DO mg/L and DO % are supplied, the engine performs a broad temperature-based consistency screen using the Weiss oxygen-solubility equation at sea level. EPA/USGS documentation emphasizes that saturation also changes with elevation/barometric pressure and salinity, so the cross-check can only produce a nonblocking plausibility warning.

Sources:
- https://www.epa.gov/caddis/dissolved-oxygen
- https://water.usgs.gov/admin/memo/QW/qw81.11.html

### Conductivity and TDS

EPA recommends interpreting conductivity relative to a waterbody's established range; significant changes can indicate disturbance. The v1 engine therefore does not reject high conductivity solely from a generic national cutoff. Site history becomes more important as approved observations accumulate.

Source: EPA Conductivity indicator  
https://www.epa.gov/national-aquatic-resource-surveys/indicators-conductivity

The TDS/conductivity relationship is used only as informational context. USGS research shows that simple TDS-to-specific-conductance conversion factors can vary substantially with ionic composition, so this relationship is not a hard validity rule.

## Validation pipeline

1. required metadata / protocol completeness;
2. Test-Type-specific required measurements;
3. numeric and hard-range checks;
4. temperature C/F conversion consistency;
5. GPS accuracy and expected-site distance;
6. method/instrument traceability;
7. timestamp consistency;
8. cross-parameter consistency;
9. environmental/context alerts;
10. approved-history robust anomaly comparison;
11. quality component calculation;
12. overall Data Quality / Confidence Score;
13. separate Anomaly Score;
14. persistence/status-transition plan.

## Test Type behavior

For v1:

- `In-situ/Penn State Lab`
- `In-situ / Field Instrument`
- `Continuous Sensor / Sonde`
- `Mixed In-situ + Lab`

require pH, DO mg/L, conductivity, plus the event-level water temperature.

Lab-only, external-lab, field-kit, and Other profiles require at least one declared measurement rather than forcing irrelevant field parameters. Every collected measurement still requires method and instrument/lab provenance.

This structure is config-driven so later ponds/lakes/wetlands can use separate profiles without replacing the engine.

## Generic hard checks versus environmental context

Hard checks are intentionally conservative. Examples:

- pH outside 0–14 → `ERROR`;
- negative concentration/flow where physically nonsensical → `ERROR`;
- invalid latitude/longitude or negative GPS accuracy → `ERROR`;
- inconsistent stored temperature conversion → `ERROR`;
- gross timestamp contradiction → `ERROR`.

Possible but unusual values usually remain warnings/alerts. For example pH 5 or DO 2.5 mg/L may represent a real degraded stream and must not be rejected just because the environmental condition is concerning.

Instrument-specific hard ranges should supersede generic hard ranges when a validated instrument profile is available.

## GPS scoring

GPS is required for new collection.

Accuracy bands:

- ≤5 m: 100
- 5–10 m: 95
- 10–20 m: 85
- 20–50 m: 65 + recapture warning
- >50 m: 40 + confirmation warning

Expected-site distance uses a configurable tolerance, default 30 m. Distance warnings do not block because safe/legal stream access may require sampling along a reach rather than at a mathematically exact point.

## Historical comparison

Only approved observations enter history.

- n < 8: unavailable;
- n 8–19: provisional, max nominal historical weight 5%;
- n ≥20: established, max nominal historical weight 10%.

The engine uses median/MAD modified z-scores. If MAD is zero but IQR is usable, it falls back to `IQR/1.349`; otherwise it refuses to invent variability.

Historical influence is multiplied by confidence based on sample count, recency, and baseline stability. A highly unusual historical result creates an `ENVIRONMENTAL_ALERT` and a high Anomaly Score, not an automatic validation error.

## Quality formula

See `docs/QUALITY_SCORE.md` and `config/quality_score.json`.

The full-weight formula remains:

`Q = 0.20C + 0.20L + 0.20M + 0.20V + 0.10T + 0.10H`

Unavailable components are removed and remaining weights renormalized. Any blocking `ERROR` leaves the overall score unset until correction.

Approved display bands:

- 90–100: Excellent confidence
- 80–89: Good confidence
- 70–79: Acceptable confidence
- 60–69: Review carefully
- <60: Low confidence

## Code

- `validation/engine.mjs` — pure/config-driven validation engine
- `config/validation_rules.json` — versioned thresholds/profile behavior
- `config/quality_score.json` — versioned scoring mathematics
- `config/validation_output_contract.json` — Firestore/ArcGIS persistence mapping
- `tests/validation/validation_engine.test.mjs` — synthetic acceptance tests

The core engine has no Firebase dependency. This is intentional: scientific logic remains deterministic and testable independently from Cloud Functions, Firestore, or ArcGIS adapters.

## Run tests

From the repository root:

```bash
node --test tests/validation/validation_engine.test.mjs
```

The synthetic suite covers clean observations, missing core parameters, impossible pH, low DO environmental alerts, C/F contradictions, bad GPS, optional-parameter behavior, lab-only Test Types, nitrate analyte-basis handling, contextual chloride alerts, historical anomalies, insufficient history, timestamp issues, and DO mg/L-vs-percent consistency.

## Persistence behavior

The trusted validation service will persist:

- revision validation map;
- deterministic validation flags;
- submission score/count summary;
- validation versions;
- audit event.

If `error_flag_count > 0`, the submission does not advance to supervisor review. If zero, the trusted service can transition `VALIDATING -> PENDING_REVIEW`.

Actual Firebase trigger deployment is kept separate from the scientific engine so infrastructure/runtime changes cannot silently change validation mathematics.

## Known v1 limitations / future extensions

- Site-specific Pennsylvania designated uses are not yet stored in the mobile-safe site catalog; v1 environmental criteria are therefore contextual rather than compliance determinations.
- Nitrate and phosphate require explicit analyte form/basis for defensible criterion interpretation. If basis is unavailable, the engine emits INFO and withholds criterion-based conclusions.
- DO percent cross-check does not yet use site elevation/current barometric pressure.
- Calibration/QC metadata has reserved quality weight but is renormalized out until the active collection schema captures it explicitly.
- Ponds, lakes, wetlands, and other waterbody profiles will have separate validation configuration later.
