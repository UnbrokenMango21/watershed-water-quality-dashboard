import test from 'node:test';
import assert from 'node:assert/strict';
import { assertPublicationEligibility, buildPublicationBundle, PublicationEligibilityError } from '../../publication/transform.mjs';

const submission = { submission_id: 'submission-1', event_id: 'event-1', collector_user_id: 'collector-private', site_id: 'site-1', status: 'APPROVED', current_revision_id: 'revision-2', current_revision_no: 2, review_decision: 'APPROVE', reviewed_revision_id: 'revision-2', reviewed_at: new Date('2026-08-16T16:00:00Z'), overall_quality_score: 92.3333, warning_flag_count: 4, validation_rules_version: '0.1.0', quality_algorithm_version: '0.1.0', schema_version: '0.1.0', mobile_app_version: '0.1.0' };
const revision = { revision_id: 'revision-2', revision_no: 2, submission_id: 'submission-1', event_id: 'event-1', collector_user_id: 'collector-private', site_id: 'site-1', revision_status: 'SUBMITTED', collected_at: new Date('2026-08-16T14:30:00Z'), latitude: 40.7934, longitude: -77.86, gps_accuracy_m: 4.2, site_distance_m: 3.1, data_collected_by: 'Student/researcher', test_type: 'In-situ / Field Instrument', method_name: 'Field meter', instrument_name: 'Multiparameter sonde', weather_condition: 'CLEAR', temp_entered_value: 20, temp_entered_unit: 'C', temp_c: 20, temp_f: 68, schema_version: '0.1.0', mobile_app_version: '0.1.0' };
const site = { site_id: 'site-1', site_code: 'WB-001', site_name_display: 'Spring Creek at Example Reach', county: 'Centre', watershed_name: 'Spring Creek', latitude: 40.793, longitude: -77.861, active: true, updated_at: new Date('2026-08-16T12:00:00Z') };
const measurements = [
  { measurement_id: 'm-ph', parameter_code: 'PH', display_name: 'pH', value: 7.2, unit_code: 'pH', entered_value: 7.2, entered_unit_code: 'ph-standard', method_name: 'Field meter', instrument_name: 'Sonde' },
  { measurement_id: 'm-do', parameter_code: 'DO_MG_L', display_name: 'DO (mg/L)', value: 9.1, unit_code: 'mg/L', entered_value: 9.1, entered_unit_code: 'mg-o2-l', method_name: 'Field meter', instrument_name: 'Sonde' },
  { measurement_id: 'm-cond', parameter_code: 'CONDUCTIVITY_US_CM', display_name: 'Conductivity (µS/cm)', value: 350, unit_code: 'uS/cm', entered_value: 350, entered_unit_code: 'us-cm', method_name: 'Field meter', instrument_name: 'Sonde' },
];

test('approved current immutable revision maps to typed GIS features and normalized measurements', () => {
  const bundle = buildPublicationBundle({ submission, revision, site, measurements, publishedAt: new Date('2026-08-16T17:00:00Z') });
  assert.equal(bundle.revisionId, 'revision-2'); assert.deepEqual(bundle.observationFeature.geometry.spatialReference, { wkid: 4326 }); assert.equal(bundle.observationFeature.geometry.x, -77.86); assert.equal(bundle.observationFeature.geometry.y, 40.7934);
  assert.equal(bundle.observationFeature.attributes.ph, 7.2); assert.equal(bundle.observationFeature.attributes.do_mg_l, 9.1); assert.equal(bundle.observationFeature.attributes.conductivity_us_cm, 350); assert.equal(bundle.observationFeature.attributes.quality_score, 92.3333); assert.equal(bundle.observationFeature.attributes.quality_context, 'APPROVED_WITH_VALIDATION_CONTEXT');
  assert.equal(bundle.measurements.length, 4); const temp = bundle.measurements.find((i) => i.attributes.parameter_code === 'WATER_TEMP_C'); assert.equal(temp.attributes.value, 20); assert.equal(temp.attributes.unit_code, 'degC'); assert.equal(temp.attributes.entered_value, 20); assert.equal(temp.attributes.entered_unit_code, 'C');
});

test('publication preserves canonical units and does not silently convert measurement values', () => {
  const base = buildPublicationBundle({ submission, revision, site, measurements }); const nitrate = { measurement_id: 'm-n', parameter_code: 'NITRATE_MG_L', display_name: 'Nitrate', value: 1.25, unit_code: 'mg/L as N', entered_value: 5.53, entered_unit_code: 'mg-no3-l' };
  const changed = buildPublicationBundle({ submission, revision, site, measurements: [...measurements, nitrate] }); const published = changed.measurements.find((i) => i.attributes.measurement_id === 'm-n').attributes;
  assert.equal(published.value, 1.25); assert.equal(published.unit_code, 'mg/L as N'); assert.equal(published.entered_value, 5.53); assert.equal(published.entered_unit_code, 'mg-no3-l'); assert.notEqual(base.observationFeature.attributes.record_hash, changed.observationFeature.attributes.record_hash);
});

test('unapproved and rejected submissions are never publication eligible', () => { for (const status of ['DRAFT','SUBMITTED','VALIDATING','PENDING_REVIEW','NEEDS_CORRECTION','REJECTED']) assert.throws(() => assertPublicationEligibility({ ...submission, status }, 'revision-2'), PublicationEligibilityError, status); assert.throws(() => assertPublicationEligibility({ ...submission, review_decision: 'REJECT' }, 'revision-2'), PublicationEligibilityError); });
test('an old reviewed revision cannot publish after a newer current revision exists', () => assert.throws(() => assertPublicationEligibility({ ...submission, current_revision_id: 'revision-3' }, 'revision-2'), /no longer the current revision/));
test('timestamp is preserved as the exact UTC instant in ArcGIS epoch milliseconds', () => assert.equal(buildPublicationBundle({ submission, revision, site, measurements }).observationFeature.attributes.collected_at, Date.parse('2026-08-16T14:30:00Z')));
