import test from 'node:test';
import assert from 'node:assert/strict';
import { validateObservation } from '../../validation/engine.mjs';

const NOW = '2026-08-08T17:00:00-04:00';

function revision(overrides = {}) {
  return {
    site_id: 'SITE-001',
    test_type: 'In-situ / Field Instrument',
    data_collected_by: 'Student/researcher',
    method_name: 'Calibrated multiparameter field meter',
    instrument_name: 'Test Sonde',
    collected_at: '2026-08-08T16:30:00-04:00',
    submitted_at: '2026-08-08T16:45:00-04:00',
    time_known: true,
    time_imputed: false,
    latitude: 40.7934,
    longitude: -77.86,
    gps_accuracy_m: 4,
    temp_entered_value: 68,
    temp_entered_unit: 'F',
    temp_c: 20,
    temp_f: 68,
    ...overrides,
  };
}

function measurement(code, value, unit = 'unit', overrides = {}) {
  return {
    measurement_id: `m-${code}`,
    parameter_code: code,
    display_name: code,
    value,
    unit_code: unit,
    method_name: 'Field meter',
    instrument_name: 'Test Sonde',
    entered_at: NOW,
    ...overrides,
  };
}

function core(extra = []) {
  return [
    measurement('PH', 7.2, 'pH'),
    measurement('DO_MG_L', 9, 'mg/L'),
    measurement('CONDUCTIVITY_US_CM', 350, 'uS/cm'),
    ...extra,
  ];
}

const site = {
  site_id: 'SITE-001',
  latitude: 40.7934,
  longitude: -77.86,
  site_tolerance_m: 30,
};

test('clean observation is review-ready with excellent confidence', () => {
  const result = validateObservation({ revision: revision(), measurements: core(), site, now: NOW });
  assert.equal(result.blocking, false);
  assert.equal(result.counts.error, 0);
  assert.ok(result.scores.overall_quality_score >= 90);
});

test('Phase 11 interim contract: temperature-only submission never blocks review for any test type', () => {
  // Only water temperature is required for now; every non-temperature measurement is
  // optional until the supervisor provides an authoritative requirement matrix (see
  // docs/PHASE_11_SUPERVISOR_DECISIONS.md). Zero measurement records, for any test
  // type, must not block review or reduce completeness.
  for (const testType of [
    'In-situ / Field Instrument', 'Continuous Sensor / Sonde', 'Mixed In-situ + Lab',
    'Penn State Lab', 'External Lab', 'Field Kit / Colorimetric', 'Other',
  ]) {
    const overrides = testType === 'Other' ? { test_type: testType, test_type_other: 'Custom protocol' } : { test_type: testType };
    const result = validateObservation({ revision: revision(overrides), measurements: [], site, now: NOW });
    assert.equal(result.blocking, false, `${testType} must not block on zero non-temperature measurements`);
    assert.equal(result.scores.completeness_score, 100, `${testType} completeness must not be reduced by missing optional measurements`);
    assert.ok(!result.flags.some((f) => f.rule_code === 'REQ_MEASUREMENT_MISSING' || f.rule_code === 'MIN_MEASUREMENT_COUNT'));
  }
});

test('a partially-entered optional measurement set still does not block review', () => {
  const result = validateObservation({
    revision: revision(),
    measurements: [measurement('PH', 7.2), measurement('CONDUCTIVITY_US_CM', 300)],
    site,
    now: NOW,
  });
  assert.equal(result.blocking, false);
  assert.ok(result.scores.overall_quality_score > 0);
});

test('pH outside 0-14 is ERROR', () => {
  const result = validateObservation({
    revision: revision(),
    measurements: [measurement('PH', 15), measurement('DO_MG_L', 8), measurement('CONDUCTIVITY_US_CM', 300)],
    site,
    now: NOW,
  });
  assert.equal(result.blocking, true);
  assert.ok(result.flags.some((f) => f.severity === 'ERROR' && f.parameter_code === 'PH'));
});

test('pH 5 is environmental alert, not a bad-data penalty', () => {
  const result = validateObservation({
    revision: revision(),
    measurements: [measurement('PH', 5), measurement('DO_MG_L', 8), measurement('CONDUCTIVITY_US_CM', 300)],
    site,
    now: NOW,
  });
  assert.equal(result.blocking, false);
  assert.ok(result.flags.some((f) => f.severity === 'ENVIRONMENTAL_ALERT' && f.parameter_code === 'PH'));
  assert.equal(result.scores.validation_quality_score, 100);
});

test('low DO is environmental alert and still review-ready', () => {
  const result = validateObservation({
    revision: revision(),
    measurements: [measurement('PH', 7), measurement('DO_MG_L', 2.5), measurement('CONDUCTIVITY_US_CM', 300)],
    site,
    now: NOW,
  });
  assert.equal(result.blocking, false);
  assert.ok(result.flags.some((f) => f.rule_code === 'ENV_DO_BELOW_3'));
  assert.equal(result.scores.validation_quality_score, 100);
});

test('temperature conversion contradiction blocks review', () => {
  const result = validateObservation({ revision: revision({ temp_c: 25 }), measurements: core(), site, now: NOW });
  assert.equal(result.blocking, true);
  assert.ok(result.flags.some((f) => f.rule_code === 'TEMP_CONVERSION_MISMATCH'));
});

test('poor GPS warns and lowers location score but does not block', () => {
  const result = validateObservation({ revision: revision({ gps_accuracy_m: 60 }), measurements: core(), site, now: NOW });
  assert.equal(result.blocking, false);
  assert.ok(result.flags.some((f) => f.rule_code === 'GPS_ACCURACY_POOR'));
  assert.ok(result.scores.location_quality_score < 80);
});

test('invalid coordinates block review', () => {
  const result = validateObservation({ revision: revision({ latitude: 140 }), measurements: core(), site, now: NOW });
  assert.equal(result.blocking, true);
  assert.ok(result.flags.some((f) => f.rule_code === 'GPS_INVALID'));
});

test('missing optional measurements do not reduce completeness', () => {
  const result = validateObservation({ revision: revision(), measurements: core(), site, now: NOW });
  assert.equal(result.scores.completeness_score, 100);
});

test('lab test type accepts a single non-core measurement without requiring the in-situ core', () => {
  const result = validateObservation({
    revision: revision({ test_type: 'Penn State Lab' }),
    measurements: [measurement('NITRATE_MG_L', 2, 'mg/L')],
    site,
    now: NOW,
  });
  assert.equal(result.blocking, false);
});

test('nitrate without analyte basis gets INFO only', () => {
  const result = validateObservation({
    revision: revision(),
    measurements: core([measurement('NITRATE_MG_L', 12, 'mg/L')]),
    site,
    now: NOW,
  });
  assert.ok(result.flags.some((f) => f.rule_code === 'ANALYTE_BASIS_UNSPECIFIED' && f.severity === 'INFO'));
  assert.equal(result.blocking, false);
});

test('chloride above contextual reference is environmental alert, not bad-data warning', () => {
  const result = validateObservation({
    revision: revision(),
    measurements: core([measurement('CHLORIDE_MG_L', 300, 'mg/L')]),
    site,
    now: NOW,
  });
  assert.ok(result.flags.some((f) => f.severity === 'ENVIRONMENTAL_ALERT' && f.parameter_code === 'CHLORIDE_MG_L'));
  assert.equal(result.scores.validation_quality_score, 100);
});

test('historical anomaly warns but remains review-ready and low-weight', () => {
  const history = Array.from({ length: 20 }, (_, i) => ({
    value: 7.0 + (i % 5 - 2) * 0.05,
    collected_at: `2026-0${(i % 7) + 1}-01T12:00:00-05:00`,
  }));
  const result = validateObservation({
    revision: revision(),
    measurements: [measurement('PH', 9.5), measurement('DO_MG_L', 9), measurement('CONDUCTIVITY_US_CM', 350)],
    site,
    historyByParameter: { PH: history },
    now: NOW,
  });
  assert.equal(result.blocking, false);
  assert.ok(result.flags.some((f) => f.rule_code === 'HISTORICAL_ANOMALY'));
  assert.ok(result.scores.anomaly_score > 75);
  assert.ok(result.scores.historical_quality_score <= 60.1);
  assert.ok(result.scores.overall_quality_score > 90);
});

test('history under eight observations is unavailable and score renormalizes', () => {
  const history = Array.from({ length: 7 }, (_, i) => ({
    value: 7 + i * 0.01,
    collected_at: '2026-06-01T12:00:00-04:00',
  }));
  const result = validateObservation({
    revision: revision(),
    measurements: core(),
    site,
    historyByParameter: { PH: history },
    now: NOW,
  });
  assert.equal(result.scores.historical_quality_score, null);
  assert.equal(result.scores.historical_effective_weight, 0);
  assert.ok(result.scores.overall_quality_score >= 99);
});

test('slightly future collection time warns but does not block', () => {
  const result = validateObservation({
    revision: revision({ collected_at: '2026-08-08T17:10:00-04:00', submitted_at: null }),
    measurements: core(),
    site,
    now: NOW,
  });
  assert.equal(result.blocking, false);
  assert.ok(result.flags.some((f) => f.rule_code === 'COLLECTED_AT_SLIGHT_FUTURE'));
});

test('far-future collection time blocks', () => {
  const result = validateObservation({
    revision: revision({ collected_at: '2026-08-10T17:00:00-04:00', submitted_at: null }),
    measurements: core(),
    site,
    now: NOW,
  });
  assert.equal(result.blocking, true);
});

test('DO percent/mgL mismatch is a plausibility warning, not an error', () => {
  const result = validateObservation({
    revision: revision(),
    measurements: core([measurement('DO_PERCENT', 200, '%')]),
    site,
    now: NOW,
  });
  assert.equal(result.blocking, false);
  assert.ok(result.flags.some((f) => f.rule_code === 'DO_PERCENT_MGL_INCONSISTENT'));
  assert.ok(result.scores.validation_quality_score < 100);
});
