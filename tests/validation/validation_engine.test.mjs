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

test('entered measurement conversion contradiction blocks review', () => {
  const valid = measurement('CONDUCTIVITY_US_CM', 350, 'uS/cm', {
    entered_value: 0.35,
    entered_unit_code: 'ms-cm',
  });
  const accepted = validateObservation({ revision: revision(), measurements: [valid], site, now: NOW });
  assert.equal(accepted.blocking, false);
  assert.ok(!accepted.flags.some((f) => f.rule_code === 'MEAS_CONVERSION_MISMATCH'));

  const contradicted = validateObservation({
    revision: revision(),
    measurements: [{ ...valid, value: 35 }],
    site,
    now: NOW,
  });
  assert.equal(contradicted.blocking, true);
  assert.ok(contradicted.flags.some((f) => f.rule_code === 'MEAS_CONVERSION_MISMATCH'));
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

test('v0.2 visual-only record accepts explicit Unknown and preserves absent numerical measurements', () => {
  const record = revision({ schema_version: '0.2.0', weather_condition: 'Unknown', water_color: 'Unknown', flow_condition: 'Unknown', collection_stage: 'READY_FOR_REVIEW', temp_entered_value: null, temp_entered_unit: null, temp_c: null, temp_f: null, instrument_name: null });
  const result = validateObservation({ revision: record, measurements: [], site, now: NOW });
  assert.equal(result.blocking, false);
  for (const field of ['weather_condition', 'water_color', 'flow_condition']) {
    const absent = validateObservation({ revision: { ...record, [field]: '' }, measurements: [], site, now: NOW });
    assert.ok(absent.flags.some((flag) => flag.rule_code === `VISUAL_INVALID_${field}`));
  }
  assert.ok(validateObservation({ revision: { ...record, collection_stage: 'LAB_PENDING' }, measurements: [], site, now: NOW }).blocking);
  for (const invalid of [{ temp_c: 0 }, { temp_entered_value: NaN, temp_entered_unit: 'C', temp_c: 0, temp_f: 32 }]) {
    assert.ok(validateObservation({ revision: { ...record, ...invalid }, measurements: [], site, now: NOW }).flags.some((flag) => flag.rule_code === 'TEMP_GROUP_INVALID'));
  }
});

test('water depth uses length units without inventing discharge or an upper scientific threshold', () => {
  const depth = measurement('WATER_DEPTH_M', 0.3048, 'm', { entered_value: 1, entered_unit_code: 'ft' });
  assert.equal(validateObservation({ revision: revision(), measurements: [depth], site, now: NOW }).blocking, false);
  assert.ok(validateObservation({ revision: revision(), measurements: [{ ...depth, value: -0.3048, entered_value: -1 }], site, now: NOW }).flags.some((flag) => flag.rule_code === 'DEPTH_NEGATIVE'));
  assert.ok(validateObservation({ revision: revision(), measurements: [{ ...depth, value: 1 }], site, now: NOW }).flags.some((flag) => flag.rule_code === 'MEAS_CONVERSION_MISMATCH'));
});

test('v0.2 analysis provenance: lab results later than collection, field exceptions documented, never before sampling', () => {
  const record = revision({ schema_version: '0.2.0', weather_condition: 'Clear', water_color: 'Clear', flow_condition: 'Low', collection_stage: 'LAB_COMPLETED', submitted_at: '2026-08-09T12:00:00-04:00' });
  const field = (code, value, unit) => measurement(code, value, unit, { analysis_stage: 'FIELD', analyzed_at: '2026-08-08T16:30:00-04:00', field_exception_reason: null });
  const lab = measurement('NITRATE_MG_L', 1.2, 'mg/L as N', { entered_value: 1.2, entered_unit_code: 'mg-n-l', analysis_stage: 'LAB', analyzed_at: '2026-08-09T10:15:00-04:00', field_exception_reason: null });
  const clean = validateObservation({ revision: record, measurements: [field('PH', 7.2, 'pH'), lab], site, now: NOW });
  assert.equal(clean.blocking, false, JSON.stringify(clean.flags));
  const codes = (measurements) => validateObservation({ revision: record, measurements, site, now: NOW }).flags.map((flag) => flag.rule_code);
  assert.ok(codes([{ ...lab, analysis_stage: undefined }]).includes('ANALYSIS_PROVENANCE_MISSING'));
  // A non-laboratory value may leave provenance unrecorded, but never half-recorded.
  assert.equal(codes([{ ...field('PH', 7.2, 'pH'), analysis_stage: null, analyzed_at: null }]).includes('ANALYSIS_PROVENANCE_MISSING'), false);
  assert.ok(codes([{ ...field('PH', 7.2, 'pH'), analyzed_at: null }]).includes('ANALYSIS_PROVENANCE_MISSING'));
  assert.ok(codes([{ ...lab, analyzed_at: null }]).includes('ANALYSIS_PROVENANCE_MISSING'));
  assert.ok(codes([{ ...lab, analyzed_at: '2026-08-08T12:00:00-04:00' }]).includes('ANALYSIS_BEFORE_COLLECTION'));
  assert.ok(codes([{ ...lab, analyzed_at: '2026-08-10T12:00:00-04:00' }]).includes('ANALYSIS_AFTER_SUBMISSION'));
  const fieldNitrate = { ...lab, analysis_stage: 'FIELD', analyzed_at: '2026-08-08T16:30:00-04:00' };
  assert.ok(codes([fieldNitrate]).includes('LAB_PARAMETER_FIELD_EXCEPTION_MISSING'));
  const documented = validateObservation({ revision: record, measurements: [{ ...fieldNitrate, field_exception_reason: 'Program-approved field kit protocol.' }], site, now: NOW });
  assert.equal(documented.blocking, false);
  assert.equal(documented.flags.find((flag) => flag.rule_code === 'LAB_PARAMETER_FIELD_EXCEPTION')?.severity, 'INFO');
  assert.equal(documented.scores.overall_quality_score, clean.scores.overall_quality_score, 'a documented exception is visible but not penalized');
  // Legacy 0.1.0 records predate analysis provenance and are not retroactively flagged.
  assert.equal(validateObservation({ revision: revision(), measurements: core(), site, now: NOW }).flags.some((flag) => flag.rule_code.startsWith('ANALYSIS_')), false);
});

test('instrument stays required on legacy measurements and optional on v0.2 measurements', () => {
  const legacy = validateObservation({ revision: revision(), measurements: core([measurement('ORP_MV', 120, 'mV', { instrument_name: null })]), site, now: NOW });
  assert.ok(legacy.flags.some((flag) => flag.rule_code === 'MEAS_INSTRUMENT_MISSING' && flag.severity === 'ERROR'));
  const v2 = revision({ schema_version: '0.2.0', weather_condition: 'Clear', water_color: 'Clear', flow_condition: 'Low', collection_stage: 'READY_FOR_REVIEW' });
  const field = { analysis_stage: 'FIELD', analyzed_at: '2026-08-08T16:30:00-04:00', field_exception_reason: null };
  const result = validateObservation({ revision: v2, measurements: [measurement('PH', 7.2, 'pH', { ...field, instrument_name: null })], site, now: NOW });
  assert.equal(result.flags.some((flag) => flag.rule_code === 'MEAS_INSTRUMENT_MISSING'), false);
});
