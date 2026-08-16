import { createHash } from 'node:crypto';

export class PublicationEligibilityError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PublicationEligibilityError';
  }
}

const WIDE_PARAMETER_FIELDS = new Map([
  ['PH', 'ph'], ['DO_MG_L', 'do_mg_l'], ['DO_PERCENT', 'do_percent'],
  ['CONDUCTIVITY_US_CM', 'conductivity_us_cm'], ['TDS_MG_L', 'tds_mg_l'], ['ORP_MV', 'orp_mv'],
  ['CHLORIDE_MG_L', 'chloride_mg_l'], ['SULFATE_MG_L', 'sulfate_mg_l'], ['NITRATE_MG_L', 'nitrate_mg_l'],
  ['PHOSPHATE_MG_L', 'phosphate_mg_l'], ['DISCHARGE_M3_S', 'discharge_m3_s'],
]);

export const WIDE_PARAMETER_CODES = Object.freeze([...WIDE_PARAMETER_FIELDS.keys()]);

function requiredString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') throw new PublicationEligibilityError(`${label} is required`);
  return value.trim();
}

function finiteNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new PublicationEligibilityError(`${label} must be a finite number`);
  return value;
}

export function toEpochMillis(value, label) {
  if (value == null) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.valueOf();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.valueOf())) return parsed.valueOf();
  throw new PublicationEligibilityError(`${label} is not a valid timestamp`);
}

function normalizedForHash(value) {
  if (Array.isArray(value)) return value.map(normalizedForHash);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, normalizedForHash(v)]));
  return value;
}

export function recordHash(value) {
  return createHash('sha256').update(JSON.stringify(normalizedForHash(value))).digest('hex');
}

export function assertPublicationEligibility(submission, approvedRevisionId) {
  if (!submission) throw new PublicationEligibilityError('Submission does not exist');
  const revisionId = requiredString(approvedRevisionId, 'approved revision id');
  if (submission.review_decision !== 'APPROVE') throw new PublicationEligibilityError('Only an APPROVE review decision is publication eligible');
  if (submission.current_revision_id !== revisionId) throw new PublicationEligibilityError('Approved revision is no longer the current revision');
  if (submission.reviewed_revision_id !== revisionId) throw new PublicationEligibilityError('reviewed_revision_id does not match the current approved revision');
  if (!new Set(['APPROVED', 'PUBLISHING', 'PUBLISH_FAILED', 'PUBLISHED']).has(submission.status)) throw new PublicationEligibilityError(`Submission status '${submission.status}' is not publication eligible`);
  return revisionId;
}

function pointGeometry(longitude, latitude) {
  const x = finiteNumber(longitude, 'longitude');
  const y = finiteNumber(latitude, 'latitude');
  if (y < -90 || y > 90 || x < -180 || x > 180 || (x === 0 && y === 0)) throw new PublicationEligibilityError('Coordinates are outside valid WGS84 bounds');
  return { x, y, spatialReference: { wkid: 4326 } };
}

function siteAttributes(site) {
  const siteId = requiredString(site.site_id, 'site.site_id');
  return {
    site_id: siteId,
    site_code: site.site_code ?? siteId,
    site_name: site.site_name_display ?? site.site_name_public ?? site.site_code ?? siteId,
    county: site.county ?? null,
    watershed_name: site.watershed_name ?? null,
    site_status: site.active === false ? 'INACTIVE' : 'ACTIVE',
    latitude: finiteNumber(site.latitude, 'site.latitude'),
    longitude: finiteNumber(site.longitude, 'site.longitude'),
    updated_at: toEpochMillis(site.updated_at, 'site.updated_at'),
    schema_version: site.schema_version ?? null,
  };
}

function buildWideMeasurements(measurements) {
  const wide = Object.fromEntries([...WIDE_PARAMETER_FIELDS.values()].map((field) => [field, null]));
  const seen = new Set();
  for (const measurement of measurements) {
    const code = requiredString(measurement.parameter_code, 'measurement.parameter_code');
    const field = WIDE_PARAMETER_FIELDS.get(code);
    if (!field) continue;
    if (seen.has(code)) throw new PublicationEligibilityError(`Duplicate canonical measurement for parameter '${code}'`);
    seen.add(code);
    wide[field] = finiteNumber(measurement.value, `measurement ${code} value`);
  }
  return wide;
}

function qualityContext(submission) {
  return Number(submission.warning_flag_count ?? 0) > 0 ? 'APPROVED_WITH_VALIDATION_CONTEXT' : 'APPROVED';
}

function immutableAttributesHash(attributes) {
  const copy = { ...attributes };
  delete copy.published_at;
  delete copy.record_hash;
  return recordHash(copy);
}

export function buildPublicationBundle({ submission, revision, measurements, site, publishedAt = Date.now() }) {
  const revisionId = assertPublicationEligibility(submission, revision?.revision_id);
  if (revision.revision_status !== 'SUBMITTED') throw new PublicationEligibilityError('Approved revision must be immutable/revision_status=SUBMITTED');
  if (revision.submission_id !== submission.submission_id) throw new PublicationEligibilityError('Revision submission_id does not match its parent submission');
  if (revision.event_id !== submission.event_id) throw new PublicationEligibilityError('Revision event_id does not match its parent submission');
  if (revision.site_id !== submission.site_id || site.site_id !== submission.site_id) throw new PublicationEligibilityError('Submission, revision and site catalog site_id values must match');

  const siteAttrs = siteAttributes(site);
  const siteFeature = { attributes: { ...siteAttrs }, geometry: pointGeometry(siteAttrs.longitude, siteAttrs.latitude) };
  siteFeature.attributes.record_hash = recordHash({ attributes: siteFeature.attributes, geometry: siteFeature.geometry });

  const collectedAt = toEpochMillis(revision.collected_at, 'revision.collected_at');
  const measurementList = [...measurements];
  const observationAttributes = {
    publication_key: `approved:${revisionId}`,
    event_id: requiredString(submission.event_id, 'submission.event_id'),
    source_submission_id: requiredString(submission.submission_id, 'submission.submission_id'),
    source_revision_id: revisionId,
    revision_no: Number(revision.revision_no),
    collector_user_id: submission.collector_user_id ?? revision.collector_user_id ?? null,
    site_id: siteAttrs.site_id, site_code: siteAttrs.site_code, site_name: siteAttrs.site_name, county: siteAttrs.county, watershed_name: siteAttrs.watershed_name,
    collected_at: collectedAt,
    approved_at: toEpochMillis(submission.reviewed_at, 'submission.reviewed_at'),
    published_at: toEpochMillis(publishedAt, 'publishedAt'),
    data_collected_by: revision.data_collected_by ?? null, test_type: revision.test_type ?? null,
    method_name: revision.method_name ?? null, instrument_name: revision.instrument_name ?? null, weather_condition: revision.weather_condition ?? null,
    latitude: finiteNumber(revision.latitude, 'revision.latitude'), longitude: finiteNumber(revision.longitude, 'revision.longitude'),
    gps_accuracy_m: revision.gps_accuracy_m ?? null, site_distance_m: revision.site_distance_m ?? null,
    temp_c: finiteNumber(revision.temp_c, 'revision.temp_c'), temp_f: finiteNumber(revision.temp_f, 'revision.temp_f'),
    ...buildWideMeasurements(measurementList),
    quality_score: typeof submission.overall_quality_score === 'number' ? submission.overall_quality_score : null,
    quality_context: qualityContext(submission),
    validation_rules_version: submission.validation_rules_version ?? null,
    quality_algorithm_version: submission.quality_algorithm_version ?? null,
    schema_version: revision.schema_version ?? submission.schema_version ?? null,
    mobile_app_version: revision.mobile_app_version ?? submission.mobile_app_version ?? null,
  };
  observationAttributes.record_hash = immutableAttributesHash(observationAttributes);
  const observationFeature = { attributes: observationAttributes, geometry: pointGeometry(observationAttributes.longitude, observationAttributes.latitude) };

  const normalizedMeasurements = measurementList.map((measurement) => {
    const measurementId = requiredString(measurement.measurement_id, 'measurement.measurement_id');
    const attributes = {
      publication_key: `${revisionId}:${measurementId}`, measurement_id: measurementId, event_id: observationAttributes.event_id,
      source_revision_id: revisionId, site_id: siteAttrs.site_id, collected_at: collectedAt,
      parameter_code: requiredString(measurement.parameter_code, 'measurement.parameter_code'), display_name: measurement.display_name ?? measurement.parameter_code,
      value: finiteNumber(measurement.value, `measurement ${measurementId} value`), unit_code: requiredString(measurement.unit_code, `measurement ${measurementId} unit_code`),
      entered_value: typeof measurement.entered_value === 'number' ? measurement.entered_value : null, entered_unit_code: measurement.entered_unit_code ?? null,
      method_name: measurement.method_name ?? revision.method_name ?? null, instrument_name: measurement.instrument_name ?? revision.instrument_name ?? null,
      qualifier: measurement.qualifier ?? null, source_type: 'FIRESTORE_MEASUREMENT',
    };
    attributes.record_hash = recordHash(attributes);
    return { attributes };
  });

  const temperatureAttributes = {
    publication_key: `${revisionId}:WATER_TEMP_C`, measurement_id: `temp:${revisionId}`, event_id: observationAttributes.event_id,
    source_revision_id: revisionId, site_id: siteAttrs.site_id, collected_at: collectedAt, parameter_code: 'WATER_TEMP_C', display_name: 'Water Temperature (°C)',
    value: observationAttributes.temp_c, unit_code: 'degC', entered_value: finiteNumber(revision.temp_entered_value, 'revision.temp_entered_value'),
    entered_unit_code: requiredString(revision.temp_entered_unit, 'revision.temp_entered_unit'), method_name: revision.method_name ?? null,
    instrument_name: revision.instrument_name ?? null, qualifier: null, source_type: 'REVISION_TEMPERATURE',
  };
  temperatureAttributes.record_hash = recordHash(temperatureAttributes);
  normalizedMeasurements.push({ attributes: temperatureAttributes });
  normalizedMeasurements.sort((a, b) => a.attributes.publication_key.localeCompare(b.attributes.publication_key));
  return { revisionId, siteFeature, observationFeature, measurements: normalizedMeasurements };
}

export function buildLatestFeature({ siteFeature, latestObservationFeature, sampleCount }) {
  const source = latestObservationFeature.attributes;
  const attrs = {
    site_id: siteFeature.attributes.site_id, site_code: siteFeature.attributes.site_code, site_name: siteFeature.attributes.site_name,
    county: siteFeature.attributes.county, watershed_name: siteFeature.attributes.watershed_name,
    source_revision_id: source.source_revision_id, collected_at: source.collected_at, sample_count: Number(sampleCount),
    temp_c: source.temp_c ?? null, temp_f: source.temp_f ?? null, ph: source.ph ?? null, do_mg_l: source.do_mg_l ?? null,
    do_percent: source.do_percent ?? null, conductivity_us_cm: source.conductivity_us_cm ?? null, tds_mg_l: source.tds_mg_l ?? null,
    orp_mv: source.orp_mv ?? null, chloride_mg_l: source.chloride_mg_l ?? null, sulfate_mg_l: source.sulfate_mg_l ?? null,
    nitrate_mg_l: source.nitrate_mg_l ?? null, phosphate_mg_l: source.phosphate_mg_l ?? null, discharge_m3_s: source.discharge_m3_s ?? null,
    quality_score: source.quality_score ?? null, quality_context: source.quality_context ?? null,
  };
  attrs.record_hash = recordHash(attrs);
  return { attributes: attrs, geometry: siteFeature.geometry };
}
