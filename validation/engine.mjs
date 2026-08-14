import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

export function loadDefaultConfigs(baseDir = repoRoot) {
  return {
    rules: JSON.parse(fs.readFileSync(path.join(baseDir, 'config/validation_rules.json'), 'utf8')),
    quality: JSON.parse(fs.readFileSync(path.join(baseDir, 'config/quality_score.json'), 'utf8')),
  };
}

const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);
const nonBlank = (v) => typeof v === 'string' && v.trim().length > 0;
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const mean = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

function median(values) {
  if (!values.length) return null;
  const a = [...values].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function quantile(values, q) {
  if (!values.length) return null;
  const a = [...values].sort((x, y) => x - y);
  const pos = (a.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return a[base + 1] !== undefined ? a[base] + rest * (a[base + 1] - a[base]) : a[base];
}

function robustScale(values) {
  const center = median(values);
  const deviations = values.map((v) => Math.abs(v - center));
  const mad = median(deviations);
  if (mad && mad > 0) return { center, scale: mad, kind: 'MAD' };

  const q1 = quantile(values, 0.25);
  const q3 = quantile(values, 0.75);
  const iqr = q3 - q1;
  if (iqr > 0) return { center, scale: iqr / 1.349, kind: 'IQR' };
  return null;
}

function modifiedZ(x, baseline) {
  const rs = robustScale(baseline);
  if (!rs) return null;
  const z = rs.kind === 'MAD'
    ? 0.6745 * (x - rs.center) / rs.scale
    : (x - rs.center) / rs.scale;
  return { z, ...rs };
}

function parseDate(value) {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.valueOf()) ? null : value;
  if (typeof value?.toDate === 'function') {
    const d = value.toDate();
    return d instanceof Date && !Number.isNaN(d.valueOf()) ? d : null;
  }
  if (typeof value === 'object' && Number.isFinite(value.seconds)) {
    const d = new Date(value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6));
    return Number.isNaN(d.valueOf()) ? null : d;
  }
  const d = new Date(value);
  return Number.isNaN(d.valueOf()) ? null : d;
}

function slug(s) {
  return String(s).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function createFlag(ruleCode, severity, category, message, parameterCode = null, options = {}) {
  return {
    flag_id: `${slug(ruleCode)}${parameterCode ? `__${slug(parameterCode)}` : ''}`,
    severity,
    category,
    parameter_code: parameterCode,
    message,
    rule_code: ruleCode,
    resolved: false,
    affects_quality_component: options.affectsQualityComponent ?? null,
    context_only: Boolean(options.contextOnly),
  };
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371008.8;
  const rad = (d) => d * Math.PI / 180;
  const p1 = rad(lat1);
  const p2 = rad(lat2);
  const dp = rad(lat2 - lat1);
  const dl = rad(lon2 - lon1);
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bandScore(value, bands, key) {
  for (const band of bands) {
    if (band[key] == null || value <= band[key]) return band.score;
  }
  return bands.at(-1)?.score ?? null;
}

// Weiss (1970) freshwater O2 solubility at 1 atm, salinity 0; ml/L -> mg/L.
// This is only a consistency screen because elevation/barometric pressure change saturation.
function oxygenSaturationMgLAtSeaLevel(tempC) {
  const T = tempC + 273.15;
  const lnMlL = -173.4292
    + 249.6339 * (100 / T)
    + 143.3483 * Math.log(T / 100)
    - 21.8492 * (T / 100);
  return Math.exp(lnMlL) * 1.4276;
}

function parameterMap(measurements) {
  const map = new Map();
  for (const m of measurements || []) {
    if (m && nonBlank(m.parameter_code)) map.set(m.parameter_code, m);
  }
  return map;
}

function validateCompleteness(revision, measurements, rules, flags) {
  let requiredTotal = 0;
  let requiredPresent = 0;

  for (const field of rules.requiredRevisionFields || []) {
    requiredTotal += 1;
    const v = revision?.[field];
    const present = v !== null && v !== undefined && (typeof v !== 'string' || v.trim() !== '');
    if (present) requiredPresent += 1;
    else {
      flags.push(createFlag(
        `REQ_FIELD_MISSING_${field}`,
        'ERROR',
        'COMPLETENESS',
        `Required field '${field}' is missing.`,
        null,
        { affectsQualityComponent: 'completeness' },
      ));
    }
  }

  if (revision?.temp_entered_unit && !['C', 'F'].includes(revision.temp_entered_unit)) {
    flags.push(createFlag(
      'TEMP_UNIT_INVALID',
      'ERROR',
      'COMPLETENESS',
      "Temperature entered unit must be 'C' or 'F'.",
      'WATER_TEMP_C',
      { affectsQualityComponent: 'completeness' },
    ));
  }

  if (revision?.test_type === 'Other' && !nonBlank(revision?.test_type_other)) {
    flags.push(createFlag(
      'TEST_TYPE_OTHER_DESCRIPTION_REQUIRED',
      'ERROR',
      'COMPLETENESS',
      'Test Type Other requires a description.',
      null,
      { affectsQualityComponent: 'completeness' },
    ));
  }

  if (/^other$/i.test(revision?.instrument_name || '') && !nonBlank(revision?.instrument_other)) {
    flags.push(createFlag(
      'INSTRUMENT_OTHER_DESCRIPTION_REQUIRED',
      'ERROR',
      'COMPLETENESS',
      'Instrument Other requires a description.',
      null,
      { affectsQualityComponent: 'method' },
    ));
  }

  const mMap = parameterMap(measurements);
  const profile = rules.testTypeProfiles?.[revision?.test_type]
    || rules.testTypeProfiles?.Other
    || { requiredMeasurements: [], minimumMeasurementCount: 0 };

  for (const code of profile.requiredMeasurements || []) {
    requiredTotal += 1;
    if (mMap.has(code)) requiredPresent += 1;
    else {
      flags.push(createFlag(
        'REQ_MEASUREMENT_MISSING',
        'ERROR',
        'COMPLETENESS',
        `Required measurement '${code}' is missing for Test Type '${revision?.test_type}'.`,
        code,
        { affectsQualityComponent: 'completeness' },
      ));
    }
  }

  if ((measurements || []).length < (profile.minimumMeasurementCount || 0)) {
    flags.push(createFlag(
      'MIN_MEASUREMENT_COUNT',
      'ERROR',
      'COMPLETENESS',
      `At least ${profile.minimumMeasurementCount} measurement record(s) are required for Test Type '${revision?.test_type}'.`,
      null,
      { affectsQualityComponent: 'completeness' },
    ));
  }

  for (const m of measurements || []) {
    if (!nonBlank(m.parameter_code)) {
      flags.push(createFlag('MEAS_PARAMETER_MISSING', 'ERROR', 'COMPLETENESS', 'A measurement is missing parameter_code.', null, { affectsQualityComponent: 'completeness' }));
    }
    if (!isFiniteNumber(m.value)) {
      flags.push(createFlag('MEAS_VALUE_INVALID', 'ERROR', 'COMPLETENESS', 'A measurement value is missing or non-numeric.', m.parameter_code || null, { affectsQualityComponent: 'completeness' }));
    }
    if (!nonBlank(m.unit_code)) {
      flags.push(createFlag('MEAS_UNIT_MISSING', 'ERROR', 'COMPLETENESS', 'Measurement unit is required.', m.parameter_code || null, { affectsQualityComponent: 'completeness' }));
    }
    if (!nonBlank(m.method_name)) {
      flags.push(createFlag('MEAS_METHOD_MISSING', 'ERROR', 'COMPLETENESS', 'Method is required for each collected measurement.', m.parameter_code || null, { affectsQualityComponent: 'method' }));
    }
    if (!nonBlank(m.instrument_name)) {
      flags.push(createFlag('MEAS_INSTRUMENT_MISSING', 'ERROR', 'COMPLETENESS', 'Instrument or laboratory source is required for each collected measurement.', m.parameter_code || null, { affectsQualityComponent: 'method' }));
    }
  }

  return requiredTotal ? 100 * requiredPresent / requiredTotal : 100;
}

function validateTemperature(revision, rules, flags) {
  const t = rules.temperature;
  const c = revision?.temp_c;
  const f = revision?.temp_f;
  const entered = revision?.temp_entered_value;
  const unit = revision?.temp_entered_unit;

  if (![c, f, entered].every(isFiniteNumber) || !['C', 'F'].includes(unit)) return;

  const expectedC = unit === 'F' ? (entered - 32) * 5 / 9 : entered;
  const expectedF = unit === 'C' ? entered * 9 / 5 + 32 : entered;

  if (Math.abs(c - expectedC) > t.conversionToleranceC || Math.abs(f - expectedF) > t.conversionToleranceF) {
    flags.push(createFlag(
      'TEMP_CONVERSION_MISMATCH',
      'ERROR',
      'DATA_CONSISTENCY',
      'Stored Celsius/Fahrenheit values do not agree with the entered temperature and unit.',
      'WATER_TEMP_C',
      { affectsQualityComponent: 'validation' },
    ));
  }

  if (c < t.hardRangeC[0] || c > t.hardRangeC[1]) {
    flags.push(createFlag(
      'TEMP_OUTSIDE_HARD_RANGE',
      'ERROR',
      'VALUE_VALIDITY',
      `Water temperature ${c} °C is outside the generic hard validation range ${t.hardRangeC[0]} to ${t.hardRangeC[1]} °C.`,
      'WATER_TEMP_C',
      { affectsQualityComponent: 'validation' },
    ));
  } else if (c < t.contextRangeC[0] || c > t.contextRangeC[1]) {
    flags.push(createFlag(
      'ENV_TEMP_OUTSIDE_TYPICAL_STREAM_RANGE',
      'ENVIRONMENTAL_ALERT',
      'ENVIRONMENTAL',
      `Water temperature ${c} °C is unusual for the v1 Central Pennsylvania stream profile; verify context and site conditions without assuming the reading is wrong.`,
      'WATER_TEMP_C',
      { contextOnly: true },
    ));
  }
}

function validateMeasurements(measurements, rules, flags) {
  for (const m of measurements || []) {
    const code = m.parameter_code;
    const rule = rules.parameters?.[code];
    if (!rule || !isFiniteNumber(m.value)) continue;
    const value = m.value;

    if (rule.hardRange && (value < rule.hardRange[0] || value > rule.hardRange[1])) {
      flags.push(createFlag(
        'VALUE_OUTSIDE_HARD_RANGE',
        'ERROR',
        'VALUE_VALIDITY',
        `${code} value ${value} is outside the generic hard range ${rule.hardRange[0]} to ${rule.hardRange[1]} ${rule.unit || ''}.`,
        code,
        { affectsQualityComponent: 'validation' },
      ));
      continue;
    }

    if (rule.hardMin != null && value < rule.hardMin) {
      flags.push(createFlag(
        'VALUE_BELOW_HARD_MIN',
        'ERROR',
        'VALUE_VALIDITY',
        `${code} cannot be below ${rule.hardMin} ${rule.unit || ''}.`,
        code,
        { affectsQualityComponent: 'validation' },
      ));
      continue;
    }

    if (rule.plausibilityAbove != null && value > rule.plausibilityAbove) {
      flags.push(createFlag(
        'VALUE_HIGH_PLAUSIBILITY',
        'PLAUSIBILITY_WARNING',
        'PLAUSIBILITY',
        `${code} value ${value} ${rule.unit || ''} is unusually high; verify method/instrument/context rather than rejecting automatically.`,
        code,
        { affectsQualityComponent: 'validation' },
      ));
    }

    if (rule.environmentalOutsideRange && (value < rule.environmentalOutsideRange[0] || value > rule.environmentalOutsideRange[1])) {
      flags.push(createFlag(
        rule.environmentalRuleCode || 'ENVIRONMENTAL_RANGE_ALERT',
        'ENVIRONMENTAL_ALERT',
        'ENVIRONMENTAL',
        `${code} value ${value} is outside the contextual environmental range ${rule.environmentalOutsideRange[0]}–${rule.environmentalOutsideRange[1]}. This does not imply bad data.`,
        code,
        { contextOnly: true },
      ));
    }

    if (rule.environmentalBelow) {
      const crossed = [...rule.environmentalBelow]
        .sort((a, b) => a.value - b.value)
        .find((x) => value < x.value);
      if (crossed) {
        flags.push(createFlag(crossed.ruleCode, 'ENVIRONMENTAL_ALERT', 'ENVIRONMENTAL', crossed.message, code, { contextOnly: true }));
      }
    }

    if (rule.environmentalAbove != null && value > rule.environmentalAbove) {
      flags.push(createFlag(
        rule.environmentalRuleCode || 'ENVIRONMENTAL_HIGH_CONTEXT',
        'ENVIRONMENTAL_ALERT',
        'ENVIRONMENTAL',
        `${code} value ${value} ${rule.unit || ''} exceeds a contextual reference value (${rule.environmentalAbove} ${rule.unit || ''}); interpret using designated use, averaging period, method, and site context.`,
        code,
        { contextOnly: true },
      ));
    }

    if (rule.requiresAnalyteBasis) {
      const basis = String(m.analyte_basis ?? m.qualifier ?? '').trim().toUpperCase();
      if (!basis) {
        flags.push(createFlag(
          'ANALYTE_BASIS_UNSPECIFIED',
          'INFO',
          'METHOD_CONTEXT',
          `${code} was collected, but analyte basis/form is not explicit; criterion-based interpretation is intentionally withheld.`,
          code,
        ));
      } else if (
        code === 'NITRATE_MG_L'
        && ['AS_N', 'N', 'NITRITE_PLUS_NITRATE_AS_N'].includes(basis)
        && rule.criterionAsN != null
        && value > rule.criterionAsN
      ) {
        flags.push(createFlag(
          'ENV_NITRATE_AS_N_ABOVE_10',
          'ENVIRONMENTAL_ALERT',
          'ENVIRONMENTAL',
          'Nitrate/nitrite-nitrate reported as nitrogen is above 10 mg/L as N; this is a contextual Pennsylvania public-water-supply reference and does not prove invalid data.',
          code,
          { contextOnly: true },
        ));
      }
    }
  }
}

function validateCrossParameter(revision, measurements, rules, flags) {
  const mMap = parameterMap(measurements);
  const doMg = mMap.get('DO_MG_L');
  const doPct = mMap.get('DO_PERCENT');

  if (doMg && doPct && isFiniteNumber(doMg.value) && isFiniteNumber(doPct.value) && isFiniteNumber(revision?.temp_c)) {
    const saturation = oxygenSaturationMgLAtSeaLevel(revision.temp_c);
    const expected = saturation * doPct.value / 100;
    if (expected > 0) {
      const relativeDifference = Math.abs(doMg.value - expected) / expected;
      if (relativeDifference > rules.crossChecks.doSaturationRelativeDifferenceWarning) {
        flags.push(createFlag(
          'DO_PERCENT_MGL_INCONSISTENT',
          'PLAUSIBILITY_WARNING',
          'DATA_CONSISTENCY',
          `DO concentration and percent saturation differ by about ${Math.round(relativeDifference * 100)}% from a sea-level freshwater temperature-based consistency check. Elevation/barometric pressure can explain some difference; verify meter settings/context.`,
          'DO_MG_L',
          { affectsQualityComponent: 'validation' },
        ));
      }
    }
  }

  const tds = mMap.get('TDS_MG_L');
  const ec = mMap.get('CONDUCTIVITY_US_CM');
  if (tds && ec && isFiniteNumber(tds.value) && isFiniteNumber(ec.value) && ec.value > 0) {
    const ratio = tds.value / ec.value;
    const [lo, hi] = rules.crossChecks.tdsConductivityRatioInfoRange;
    if (ratio < lo || ratio > hi) {
      flags.push(createFlag(
        'TDS_EC_RATIO_CONTEXT',
        'INFO',
        'CROSS_PARAMETER',
        `TDS/conductivity ratio is ${ratio.toFixed(2)}, outside the simple screening range ${lo}–${hi}. This is informational because the relationship depends on ionic composition and meter conversion method.`,
        'TDS_MG_L',
      ));
    }
  }
}

function validateTemporal(revision, rules, now, flags) {
  const collected = parseDate(revision?.collected_at);
  const submitted = parseDate(revision?.submitted_at);
  let score = 100;

  if (!collected) {
    flags.push(createFlag('COLLECTED_AT_INVALID', 'ERROR', 'TEMPORAL', 'Collection date/time is missing or invalid.', null, { affectsQualityComponent: 'temporal' }));
    return 0;
  }

  if (revision?.time_imputed === true || revision?.time_known === false) {
    score = 75;
    flags.push(createFlag('TIME_IMPUTED_OR_DATE_ONLY', 'INFO', 'TEMPORAL', 'Collection time is imputed/date-only and must not be displayed as an observed time.'));
  }

  const diffMs = collected - now;
  if (diffMs > rules.temporal.futureErrorHours * 3600_000) {
    flags.push(createFlag('COLLECTED_AT_FAR_FUTURE', 'ERROR', 'TEMPORAL', 'Collection time is more than 24 hours in the future relative to validation time.', null, { affectsQualityComponent: 'temporal' }));
  } else if (diffMs > rules.temporal.futureWarningMinutes * 60_000) {
    flags.push(createFlag('COLLECTED_AT_SLIGHT_FUTURE', 'PLAUSIBILITY_WARNING', 'TEMPORAL', 'Collection time is slightly in the future; verify device clock/timezone.', null, { affectsQualityComponent: 'temporal' }));
    score = Math.min(score, 85);
  }

  if (submitted && submitted.getTime() + rules.temporal.submittedBeforeCollectedToleranceSeconds * 1000 < collected.getTime()) {
    flags.push(createFlag('SUBMITTED_BEFORE_COLLECTED', 'ERROR', 'TEMPORAL', 'Submission timestamp occurs before collection timestamp beyond the allowed clock tolerance.', null, { affectsQualityComponent: 'temporal' }));
  }

  return score;
}

function scoreLocation(revision, site, rules, flags) {
  const lat = revision?.latitude;
  const lon = revision?.longitude;
  const accuracy = revision?.gps_accuracy_m;

  if (
    !isFiniteNumber(lat)
    || !isFiniteNumber(lon)
    || lat < -90
    || lat > 90
    || lon < -180
    || lon > 180
    || !isFiniteNumber(accuracy)
    || accuracy < 0
  ) {
    flags.push(createFlag('GPS_INVALID', 'ERROR', 'LOCATION', 'Valid latitude, longitude, and nonnegative GPS accuracy are required.', null, { affectsQualityComponent: 'location' }));
    return { score: 0, gpsAccuracyScore: null, siteProximityScore: null, siteDistanceM: null };
  }

  const gpsScore = bandScore(accuracy, rules.gps.accuracyBands, 'max');
  if (accuracy > 50) {
    flags.push(createFlag('GPS_ACCURACY_POOR', 'PLAUSIBILITY_WARNING', 'LOCATION', `Reported GPS accuracy is ${accuracy.toFixed(1)} m; confirm or recapture if practical.`, null, { affectsQualityComponent: 'location' }));
  } else if (accuracy > 20) {
    flags.push(createFlag('GPS_ACCURACY_RECAPTURE', 'PLAUSIBILITY_WARNING', 'LOCATION', `Reported GPS accuracy is ${accuracy.toFixed(1)} m; recapture is recommended when field conditions allow.`, null, { affectsQualityComponent: 'location' }));
  }

  let distance = isFiniteNumber(revision?.site_distance_m) ? revision.site_distance_m : null;
  if (site && [site.latitude, site.longitude].every(isFiniteNumber)) {
    distance = haversineMeters(lat, lon, site.latitude, site.longitude);
  }

  if (distance == null) {
    return { score: gpsScore, gpsAccuracyScore: gpsScore, siteProximityScore: null, siteDistanceM: null };
  }

  const tolerance = site && isFiniteNumber(site.site_tolerance_m) && site.site_tolerance_m > 0
    ? site.site_tolerance_m
    : rules.gps.defaultSiteToleranceM;
  const multiple = distance / tolerance;
  const proximityScore = bandScore(multiple, rules.gps.siteProximityBands, 'maxMultiple');

  if (multiple > 4) {
    flags.push(createFlag('SITE_DISTANCE_STRONG_WARNING', 'PLAUSIBILITY_WARNING', 'LOCATION', `Captured point is ${Math.round(distance)} m from the expected site (>4× tolerance). Confirm site selection/location.`, null, { affectsQualityComponent: 'location' }));
  } else if (multiple > 2) {
    flags.push(createFlag('SITE_DISTANCE_WARNING', 'PLAUSIBILITY_WARNING', 'LOCATION', `Captured point is ${Math.round(distance)} m from the expected site (>2× tolerance). Verify sampling location.`, null, { affectsQualityComponent: 'location' }));
  }

  return {
    score: 0.65 * gpsScore + 0.35 * proximityScore,
    gpsAccuracyScore: gpsScore,
    siteProximityScore: proximityScore,
    siteDistanceM: distance,
  };
}

function scoreMethod(revision, quality) {
  const cfg = quality.methodInstrumentTraceability;
  const dimensions = [
    { available: true, points: cfg.testTypePoints, ok: nonBlank(revision?.test_type) && (revision.test_type !== 'Other' || nonBlank(revision?.test_type_other)) },
    { available: true, points: cfg.methodPoints, ok: nonBlank(revision?.method_name) },
    { available: true, points: cfg.instrumentOrLabSourcePoints, ok: nonBlank(revision?.instrument_name) && (!/^other$/i.test(revision.instrument_name) || nonBlank(revision?.instrument_other)) },
  ];

  const calibrationFieldExists = Object.prototype.hasOwnProperty.call(revision || {}, 'calibration_verification_status');
  dimensions.push({
    available: calibrationFieldExists,
    points: cfg.calibrationVerificationQcPoints,
    ok: calibrationFieldExists && nonBlank(revision.calibration_verification_status),
  });

  const applicable = dimensions.filter((d) => d.available);
  const denominator = applicable.reduce((sum, d) => sum + d.points, 0);
  const earned = applicable.reduce((sum, d) => sum + (d.ok ? d.points : 0), 0);
  return denominator ? 100 * earned / denominator : null;
}

function scoreValidation(flags, quality) {
  const cfg = quality.validationConsistency;
  const count = flags.filter((f) => f.severity === 'PLAUSIBILITY_WARNING' && f.affects_quality_component === 'validation').length;
  return Math.max(cfg.floor, 100 - Math.min(cfg.warningPenaltyCap, cfg.warningPenalty * count));
}

function historicalSubscore(absZ, bands) {
  for (const band of bands) {
    if (band.maxAbsZInclusive == null || absZ <= band.maxAbsZInclusive) return band.score;
  }
  return bands.at(-1).score;
}

function historyConfidence(historyEntries, n, now, cfg) {
  if (n < cfg.minimumBaselineCount) return 0;

  let sampleFactor;
  if (n < cfg.establishedBaselineCount) {
    const span = Math.max(1, cfg.establishedBaselineCount - cfg.minimumBaselineCount);
    const t = (n - cfg.minimumBaselineCount) / span;
    sampleFactor = cfg.confidence.provisionalSampleFactorMin
      + (1 - cfg.confidence.provisionalSampleFactorMin) * clamp(t, 0, 1);
  } else {
    sampleFactor = 1;
  }

  const dates = historyEntries.map((h) => parseDate(h.collected_at)).filter(Boolean);
  let recencyFactor = 1;
  if (dates.length) {
    const newest = Math.max(...dates.map((d) => d.getTime()));
    const ageDays = Math.max(0, (now.getTime() - newest) / 86400000);
    recencyFactor = Math.max(
      cfg.confidence.recencyFloor,
      Math.pow(0.5, ageDays / cfg.confidence.recencyHalfLifeDays),
    );
  }

  const values = historyEntries.map((h) => typeof h === 'number' ? h : h.value).filter(isFiniteNumber);
  const rs = robustScale(values);
  let stabilityFactor = 1;
  if (rs && Math.abs(rs.center) > 1e-9) {
    const relativeScale = Math.abs(rs.scale / rs.center);
    stabilityFactor = Math.max(cfg.confidence.stabilityFloor, 1 - Math.min(0.3, relativeScale));
  }

  return clamp(sampleFactor * recencyFactor * stabilityFactor, 0, 1);
}

function scoreHistory(measurements, historyByParameter, quality, now, flags) {
  const cfg = quality.historicalConsistency;
  const details = [];

  for (const m of measurements || []) {
    if (!isFiniteNumber(m.value)) continue;
    const raw = historyByParameter?.[m.parameter_code] || [];
    const entries = raw
      .map((x) => typeof x === 'number' ? { value: x } : x)
      .filter((x) => isFiniteNumber(x.value));

    if (entries.length < cfg.minimumBaselineCount) continue;
    const values = entries.map((x) => x.value);
    const mz = modifiedZ(m.value, values);
    if (!mz) continue;

    const absZ = Math.abs(mz.z);
    const score = historicalSubscore(absZ, cfg.bands);
    const confidence = historyConfidence(entries, entries.length, now, cfg);
    const anomaly = Math.min(100, 25 * absZ);

    details.push({
      parameter_code: m.parameter_code,
      n: entries.length,
      z: mz.z,
      score,
      anomaly,
      confidence,
      center: mz.center,
      scale: mz.scale,
      scale_method: mz.kind,
    });

    if (absZ > 3) {
      flags.push(createFlag(
        'HISTORICAL_ANOMALY',
        'ENVIRONMENTAL_ALERT',
        'HISTORICAL',
        `${m.parameter_code} differs substantially from the approved historical baseline (modified z=${mz.z.toFixed(2)}). This is a review signal, not evidence the observation is wrong.`,
        m.parameter_code,
        { contextOnly: true },
      ));
    }
  }

  if (!details.length) {
    return { score: null, anomalyScore: null, effectiveWeight: 0, details: [] };
  }

  const confidenceDenominator = details.reduce((sum, d) => sum + d.confidence, 0);
  const score = confidenceDenominator > 0
    ? details.reduce((sum, d) => sum + d.score * d.confidence, 0) / confidenceDenominator
    : mean(details.map((d) => d.score));
  const anomalyScore = mean(details.map((d) => d.anomaly));
  const avgN = mean(details.map((d) => d.n));
  const avgConfidence = mean(details.map((d) => d.confidence));
  const nominalWeight = avgN >= cfg.establishedBaselineCount ? cfg.fullMaxWeight : cfg.provisionalMaxWeight;
  const effectiveWeight = nominalWeight * avgConfidence;

  return { score, anomalyScore, effectiveWeight, details };
}

function overallQuality(components, quality, historicalEffectiveWeight, hasError) {
  if (hasError && quality.principles.blockingErrorsPreventScoring) return null;
  const base = quality.weights;
  const entries = [
    [components.completeness_score, base.completeness],
    [components.location_quality_score, base.location],
    [components.method_quality_score, base.methodInstrumentTraceability],
    [components.validation_quality_score, base.validationConsistency],
    [components.temporal_quality_score, base.temporalProvenance],
    [components.historical_quality_score, historicalEffectiveWeight],
  ].filter(([score, weight]) => isFiniteNumber(score) && weight > 0);

  const denominator = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (!denominator) return null;
  return entries.reduce((sum, [score, weight]) => sum + score * weight, 0) / denominator;
}

export function validateObservation(input, configs = loadDefaultConfigs()) {
  const { rules, quality } = configs;
  const revision = input?.revision || {};
  const measurements = input?.measurements || [];
  const now = parseDate(input?.now) || new Date();
  const flags = [];

  const completeness = validateCompleteness(revision, measurements, rules, flags);
  validateTemperature(revision, rules, flags);
  validateMeasurements(measurements, rules, flags);
  validateCrossParameter(revision, measurements, rules, flags);
  const location = scoreLocation(revision, input?.site || null, rules, flags);
  const temporal = validateTemporal(revision, rules, now, flags);
  const method = scoreMethod(revision, quality);
  const history = scoreHistory(measurements, input?.historyByParameter || {}, quality, now, flags);
  const validation = scoreValidation(flags, quality);

  const uniqueFlags = [...new Map(flags.map((f) => [f.flag_id, f])).values()];
  const counts = {
    error: uniqueFlags.filter((f) => f.severity === 'ERROR').length,
    warning: uniqueFlags.filter((f) => ['PLAUSIBILITY_WARNING', 'ENVIRONMENTAL_ALERT'].includes(f.severity)).length,
    plausibility_warning: uniqueFlags.filter((f) => f.severity === 'PLAUSIBILITY_WARNING').length,
    environmental_alert: uniqueFlags.filter((f) => f.severity === 'ENVIRONMENTAL_ALERT').length,
    info: uniqueFlags.filter((f) => f.severity === 'INFO').length,
  };

  const components = {
    completeness_score: clamp(completeness),
    location_quality_score: isFiniteNumber(location.score) ? clamp(location.score) : null,
    method_quality_score: isFiniteNumber(method) ? clamp(method) : null,
    validation_quality_score: clamp(validation),
    temporal_quality_score: clamp(temporal),
    historical_quality_score: isFiniteNumber(history.score) ? clamp(history.score) : null,
  };

  const overall = overallQuality(components, quality, history.effectiveWeight, counts.error > 0);

  return {
    validation_rules_version: rules.validationRulesVersion,
    quality_algorithm_version: quality.qualityAlgorithmVersion,
    validation_profile_id: rules.profileId,
    blocking: counts.error > 0,
    review_ready: counts.error === 0,
    flags: uniqueFlags,
    counts,
    scores: {
      ...components,
      overall_quality_score: overall == null ? null : clamp(overall),
      overall_quality_score_display: overall == null ? null : Math.round(clamp(overall)),
      anomaly_score: history.anomalyScore == null ? null : clamp(history.anomalyScore),
      historical_effective_weight: history.effectiveWeight,
    },
    derived: {
      site_distance_m: location.siteDistanceM,
      gps_accuracy_score: location.gpsAccuracyScore,
      site_proximity_score: location.siteProximityScore,
      historical_details: history.details,
    },
  };
}

export const _internal = {
  median,
  quantile,
  robustScale,
  modifiedZ,
  haversineMeters,
  oxygenSaturationMgLAtSeaLevel,
};
