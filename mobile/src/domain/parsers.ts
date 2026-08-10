import { submissionStatuses, testTypeChoices, validationRules } from '@/config/contracts';
import type {
  Measurement,
  PartialObservationDraft,
  Revision,
  RevisionStatus,
  SiteCatalogEntry,
  Submission,
  SubmissionStatus,
  TemperatureUnit,
  ValidationFlag,
  ValidationSeverity,
} from '@/domain/types';

type UnknownRecord = Record<string, unknown>;

export class ContractDataError extends Error {
  constructor(field: string) {
    super(`Invalid contract data: ${field}`);
    this.name = 'ContractDataError';
  }
}

function record(value: unknown, field: string): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ContractDataError(field);
  return value as UnknownRecord;
}

function string(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new ContractDataError(field);
  return value;
}

function optionalString(value: unknown, field: string): string | null {
  if (value == null) return null;
  return string(value, field);
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new ContractDataError(field);
  return value;
}

function optionalText(value: unknown, field: string): string | undefined {
  return value == null ? undefined : text(value, field);
}

function finiteNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new ContractDataError(field);
  return value;
}

function integer(value: unknown, field: string): number {
  const result = finiteNumber(value, field);
  if (!Number.isInteger(result)) throw new ContractDataError(field);
  return result;
}

function nonNegativeInteger(value: unknown, field: string, fallback = 0): number {
  if (value == null) return fallback;
  const result = integer(value, field);
  if (result < 0) throw new ContractDataError(field);
  return result;
}

function boolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new ContractDataError(field);
  return value;
}

function date(value: unknown, field: string): Date {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (value && typeof value === 'object' && 'toDate' in value) {
    const parsed = (value as { toDate(): unknown }).toDate();
    if (parsed instanceof Date && Number.isFinite(parsed.getTime())) return parsed;
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed;
  }
  throw new ContractDataError(field);
}

function optionalDate(value: unknown, field: string): Date | null {
  return value == null ? null : date(value, field);
}

function member<T extends string>(value: unknown, values: readonly string[], field: string): T {
  const result = string(value, field);
  if (!values.includes(result)) throw new ContractDataError(field);
  return result as T;
}

function firestoreId(value: unknown, field: string): string {
  const result = string(value, field);
  if (result.includes('/') || result.length > 1_500) throw new ContractDataError(field);
  return result;
}

function optionalFiniteNumber(value: unknown, field: string): number | null {
  return value == null ? null : finiteNumber(value, field);
}

const REVISION_STATUSES = ['DRAFT', 'SUBMITTED'] as const;
const TEMPERATURE_UNITS = ['C', 'F'] as const;
const SUPPORTED_SUBMISSION_STATUSES: readonly SubmissionStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'VALIDATING',
  'PENDING_REVIEW',
  'NEEDS_CORRECTION',
  'RESUBMITTED',
  'APPROVED',
  'REJECTED',
  'PUBLISHING',
  'PUBLISH_FAILED',
  'PUBLISHED',
];
const VALIDATION_SEVERITIES = [
  ...Object.keys(validationRules.classes),
  'ENVIRONMENTAL_ALERT',
  'INFO',
];

export function parseSubmissionStatus(value: unknown): SubmissionStatus {
  const result = member<string>(value, submissionStatuses, 'submission.status');
  if (!SUPPORTED_SUBMISSION_STATUSES.includes(result as SubmissionStatus)) {
    throw new ContractDataError('submission.status');
  }
  return result as SubmissionStatus;
}

export function parseSiteCatalogEntry(documentId: string, value: unknown): SiteCatalogEntry {
  const data = record(value, 'siteCatalog');
  const siteId = firestoreId(data.site_id, 'siteCatalog.site_id');
  if (siteId !== documentId) throw new ContractDataError('siteCatalog.site_id');

  const latitude = finiteNumber(data.latitude, 'siteCatalog.latitude');
  const longitude = finiteNumber(data.longitude, 'siteCatalog.longitude');
  const toleranceM = finiteNumber(data.site_tolerance_m, 'siteCatalog.site_tolerance_m');
  if (latitude < -90 || latitude > 90) throw new ContractDataError('siteCatalog.latitude');
  if (longitude < -180 || longitude > 180) throw new ContractDataError('siteCatalog.longitude');
  if (toleranceM < 0) throw new ContractDataError('siteCatalog.site_tolerance_m');

  return {
    siteId,
    siteCode: string(data.site_code, 'siteCatalog.site_code'),
    displayName: string(data.site_name_display, 'siteCatalog.site_name_display'),
    latitude,
    longitude,
    toleranceM,
    active: boolean(data.active, 'siteCatalog.active'),
    updatedAt: date(data.updated_at, 'siteCatalog.updated_at'),
  };
}

export function parseSubmission(value: unknown, expectedUid?: string): Submission {
  const data = record(value, 'submission');
  const collectorUid = firestoreId(data.collector_user_id, 'submission.collector_user_id');
  if (expectedUid && collectorUid !== expectedUid) throw new ContractDataError('submission.collector_user_id');

  return {
    submissionId: firestoreId(data.submission_id, 'submission.submission_id'),
    eventId: firestoreId(data.event_id, 'submission.event_id'),
    collectorUid,
    siteId: firestoreId(data.site_id, 'submission.site_id'),
    status: parseSubmissionStatus(data.status),
    currentRevisionId: firestoreId(data.current_revision_id, 'submission.current_revision_id'),
    currentRevisionNo: integer(data.current_revision_no, 'submission.current_revision_no'),
    latestCollectedAt: date(data.latest_collected_at, 'submission.latest_collected_at'),
    createdAt: date(data.created_at, 'submission.created_at'),
    updatedAt: date(data.updated_at, 'submission.updated_at'),
    submittedAt: optionalDate(data.submitted_at, 'submission.submitted_at'),
    schemaVersion: string(data.schema_version, 'submission.schema_version'),
    mobileAppVersion: string(data.mobile_app_version, 'submission.mobile_app_version'),
    validationRulesVersion: optionalString(data.validation_rules_version, 'submission.validation_rules_version'),
    qualityAlgorithmVersion: optionalString(data.quality_algorithm_version, 'submission.quality_algorithm_version'),
    overallQualityScore: optionalFiniteNumber(data.overall_quality_score, 'submission.overall_quality_score'),
    anomalyScore: optionalFiniteNumber(data.anomaly_score, 'submission.anomaly_score'),
    reviewComment: optionalString(data.review_comment, 'submission.review_comment'),
    errorFlagCount: nonNegativeInteger(data.error_flag_count, 'submission.error_flag_count'),
    warningFlagCount: nonNegativeInteger(data.warning_flag_count, 'submission.warning_flag_count'),
    infoFlagCount: nonNegativeInteger(data.info_flag_count, 'submission.info_flag_count'),
  };
}

export function parseRevision(value: unknown, expectedUid?: string): Revision {
  const data = record(value, 'revision');
  const collectorUid = firestoreId(data.collector_user_id, 'revision.collector_user_id');
  if (expectedUid && collectorUid !== expectedUid) throw new ContractDataError('revision.collector_user_id');

  return {
    revisionId: firestoreId(data.revision_id, 'revision.revision_id'),
    revisionNo: integer(data.revision_no, 'revision.revision_no'),
    submissionId: firestoreId(data.submission_id, 'revision.submission_id'),
    eventId: firestoreId(data.event_id, 'revision.event_id'),
    collectorUid,
    siteId: firestoreId(data.site_id, 'revision.site_id'),
    status: member<RevisionStatus>(data.revision_status, REVISION_STATUSES, 'revision.revision_status'),
    createdAt: date(data.created_at, 'revision.created_at'),
    submittedAt: optionalDate(data.submitted_at, 'revision.submitted_at'),
    collectedAt: date(data.collected_at, 'revision.collected_at'),
    timeKnown: data.time_known == null ? true : boolean(data.time_known, 'revision.time_known'),
    timeImputed: data.time_imputed == null ? false : boolean(data.time_imputed, 'revision.time_imputed'),
    latitude: finiteNumber(data.latitude, 'revision.latitude'),
    longitude: finiteNumber(data.longitude, 'revision.longitude'),
    gpsAccuracyM: finiteNumber(data.gps_accuracy_m, 'revision.gps_accuracy_m'),
    siteDistanceM: optionalFiniteNumber(data.site_distance_m, 'revision.site_distance_m'),
    weatherCondition: optionalString(data.weather_condition, 'revision.weather_condition'),
    dataCollectedBy: string(data.data_collected_by, 'revision.data_collected_by'),
    testType: member(
      data.test_type,
      [...testTypeChoices, ...Object.keys(validationRules.testTypeProfiles)],
      'revision.test_type',
    ),
    testTypeOther: optionalString(data.test_type_other, 'revision.test_type_other'),
    methodName: string(data.method_name, 'revision.method_name'),
    instrumentName: string(data.instrument_name, 'revision.instrument_name'),
    instrumentOther: optionalString(data.instrument_other, 'revision.instrument_other'),
    temperatureEnteredValue: finiteNumber(data.temp_entered_value, 'revision.temp_entered_value'),
    temperatureEnteredUnit: member<TemperatureUnit>(
      data.temp_entered_unit,
      TEMPERATURE_UNITS,
      'revision.temp_entered_unit',
    ),
    temperatureC: finiteNumber(data.temp_c, 'revision.temp_c'),
    temperatureF: finiteNumber(data.temp_f, 'revision.temp_f'),
    fieldNotes: optionalString(data.field_notes_original, 'revision.field_notes_original'),
    schemaVersion: string(data.schema_version, 'revision.schema_version'),
    mobileAppVersion: string(data.mobile_app_version, 'revision.mobile_app_version'),
  };
}

export function parseMeasurement(documentId: string, value: unknown): Measurement {
  const data = record(value, 'measurement');
  const measurementId = firestoreId(data.measurement_id, 'measurement.measurement_id');
  if (measurementId !== documentId) throw new ContractDataError('measurement.measurement_id');

  return {
    measurementId,
    parameterCode: string(data.parameter_code, 'measurement.parameter_code'),
    displayName: string(data.display_name, 'measurement.display_name'),
    value: finiteNumber(data.value, 'measurement.value'),
    unitCode: string(data.unit_code, 'measurement.unit_code'),
    methodName: string(data.method_name, 'measurement.method_name'),
    instrumentName: string(data.instrument_name, 'measurement.instrument_name'),
    qualifier: optionalString(data.qualifier, 'measurement.qualifier'),
    notes: optionalString(data.notes, 'measurement.notes'),
    enteredAt: date(data.entered_at, 'measurement.entered_at'),
  };
}

export function parseValidationFlag(documentId: string, value: unknown): ValidationFlag {
  const data = record(value, 'validationFlag');
  const flagId = firestoreId(data.flag_id, 'validationFlag.flag_id');
  if (flagId !== documentId) throw new ContractDataError('validationFlag.flag_id');

  return {
    flagId,
    severity: member<ValidationSeverity>(
      data.severity,
      VALIDATION_SEVERITIES,
      'validationFlag.severity',
    ),
    category: string(data.category, 'validationFlag.category'),
    parameterCode: optionalString(data.parameter_code, 'validationFlag.parameter_code'),
    message: string(data.message, 'validationFlag.message'),
    ruleCode: string(data.rule_code, 'validationFlag.rule_code'),
    createdAt: date(data.created_at, 'validationFlag.created_at'),
    resolved: boolean(data.resolved, 'validationFlag.resolved'),
  };
}

export function parsePartialObservationDraft(value: unknown): PartialObservationDraft {
  const data = record(value, 'localDraft');
  if (data.storageVersion !== 1) throw new ContractDataError('localDraft.storageVersion');
  const measurements = data.measurements;
  if (!Array.isArray(measurements)) throw new ContractDataError('localDraft.measurements');

  const optionalId = (value: unknown, field: string) =>
    value == null || value === '' ? undefined : firestoreId(value, field);
  const optionalNumber = (value: unknown, field: string) =>
    value == null ? undefined : finiteNumber(value, field);
  const optionalIsoDate = (value: unknown, field: string) =>
    value == null || value === '' ? undefined : date(value, field).toISOString();
  const optionalUnit = (value: unknown) =>
    value == null ? undefined : member<TemperatureUnit>(value, TEMPERATURE_UNITS, 'localDraft.temperatureEnteredUnit');

  const result: PartialObservationDraft = {
    storageVersion: 1,
    submissionId: firestoreId(data.submissionId, 'localDraft.submissionId'),
    eventId: firestoreId(data.eventId, 'localDraft.eventId'),
    revisionId: firestoreId(data.revisionId, 'localDraft.revisionId'),
    revisionNo: integer(data.revisionNo, 'localDraft.revisionNo'),
    createdAt: date(data.createdAt, 'localDraft.createdAt').toISOString(),
    updatedAt: date(data.updatedAt, 'localDraft.updatedAt').toISOString(),
    siteId: optionalId(data.siteId, 'localDraft.siteId'),
    siteDisplayName: optionalText(data.siteDisplayName, 'localDraft.siteDisplayName'),
    siteCode: optionalText(data.siteCode, 'localDraft.siteCode'),
    collectedAt: optionalIsoDate(data.collectedAt, 'localDraft.collectedAt'),
    latitude: optionalNumber(data.latitude, 'localDraft.latitude'),
    longitude: optionalNumber(data.longitude, 'localDraft.longitude'),
    gpsAccuracyM: optionalNumber(data.gpsAccuracyM, 'localDraft.gpsAccuracyM'),
    dataCollectedBy: optionalText(data.dataCollectedBy, 'localDraft.dataCollectedBy'),
    testType: optionalText(data.testType, 'localDraft.testType'),
    testTypeOther: optionalText(data.testTypeOther, 'localDraft.testTypeOther'),
    methodName: optionalText(data.methodName, 'localDraft.methodName'),
    instrumentName: optionalText(data.instrumentName, 'localDraft.instrumentName'),
    instrumentOther: optionalText(data.instrumentOther, 'localDraft.instrumentOther'),
    temperatureEnteredValueText: optionalText(
      data.temperatureEnteredValueText,
      'localDraft.temperatureEnteredValueText',
    ),
    temperatureEnteredValue: optionalNumber(
      data.temperatureEnteredValue,
      'localDraft.temperatureEnteredValue',
    ),
    temperatureEnteredUnit: optionalUnit(data.temperatureEnteredUnit),
    temperatureC: optionalNumber(data.temperatureC, 'localDraft.temperatureC'),
    temperatureF: optionalNumber(data.temperatureF, 'localDraft.temperatureF'),
    weatherCondition: optionalText(data.weatherCondition, 'localDraft.weatherCondition'),
    fieldNotes: optionalText(data.fieldNotes, 'localDraft.fieldNotes'),
    syncIntent:
      data.syncIntent == null
        ? undefined
        : member(data.syncIntent, ['DRAFT', 'SUBMITTED', 'RESUBMITTED'], 'localDraft.syncIntent'),
    measurements: measurements.map((item, index) => {
      const measurement = record(item, `localDraft.measurements.${index}`);
      return {
        measurementId: firestoreId(
          measurement.measurementId,
          `localDraft.measurements.${index}.measurementId`,
        ),
        parameterCode: string(
          measurement.parameterCode,
          `localDraft.measurements.${index}.parameterCode`,
        ),
        displayName: string(
          measurement.displayName,
          `localDraft.measurements.${index}.displayName`,
        ),
        valueText: text(measurement.valueText, `localDraft.measurements.${index}.valueText`),
        unitCode: string(measurement.unitCode, `localDraft.measurements.${index}.unitCode`),
        qualifier: optionalText(
          measurement.qualifier,
          `localDraft.measurements.${index}.qualifier`,
        ),
        notes: optionalText(measurement.notes, `localDraft.measurements.${index}.notes`),
      };
    }),
  };

  if (data.correction != null) {
    const correction = record(data.correction, 'localDraft.correction');
    result.correction = {
      previousRevisionId: firestoreId(
        correction.previousRevisionId,
        'localDraft.correction.previousRevisionId',
      ),
      previousRevisionNo: integer(
        correction.previousRevisionNo,
        'localDraft.correction.previousRevisionNo',
      ),
    };
  }

  return result;
}
