import {
  minimumMeasurementCountFor,
  requiredMeasurementsFor,
  testTypeChoices,
} from '@/config/contracts';
import type { CompleteRevisionDraft, CorrectionRevisionDraft } from '@/domain/types';

export class DraftContractError extends Error {
  constructor(field: string) {
    super(`Draft is not ready: ${field}`);
    this.name = 'DraftContractError';
  }
}

function requiredText(value: string, field: string) {
  if (!value.trim()) throw new DraftContractError(field);
}

function firestoreId(value: string, field: string) {
  requiredText(value, field);
  if (value.includes('/') || value.length > 1_500) throw new DraftContractError(field);
}

function finite(value: number, field: string) {
  if (!Number.isFinite(value)) throw new DraftContractError(field);
}

function validDate(value: Date, field: string) {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new DraftContractError(field);
}

export function assertCompleteRevisionDraft(draft: CompleteRevisionDraft): void {
  firestoreId(draft.submissionId, 'submissionId');
  firestoreId(draft.eventId, 'eventId');
  firestoreId(draft.revisionId, 'revisionId');
  firestoreId(draft.collectorUid, 'collectorUid');
  firestoreId(draft.siteId, 'siteId');
  if (!Number.isInteger(draft.revisionNo) || draft.revisionNo < 1) {
    throw new DraftContractError('revisionNo');
  }
  validDate(draft.submissionCreatedAt, 'submissionCreatedAt');
  validDate(draft.revisionCreatedAt, 'revisionCreatedAt');
  validDate(draft.collectedAt, 'collectedAt');
  finite(draft.latitude, 'latitude');
  finite(draft.longitude, 'longitude');
  finite(draft.gpsAccuracyM, 'gpsAccuracyM');
  if (draft.latitude < -90 || draft.latitude > 90) throw new DraftContractError('latitude');
  if (draft.longitude < -180 || draft.longitude > 180) throw new DraftContractError('longitude');
  if (draft.gpsAccuracyM < 0) throw new DraftContractError('gpsAccuracyM');
  requiredText(draft.dataCollectedBy, 'dataCollectedBy');
  if (!testTypeChoices.includes(draft.testType)) throw new DraftContractError('testType');
  if (draft.testType === 'Other') requiredText(draft.testTypeOther ?? '', 'testTypeOther');
  requiredText(draft.methodName, 'methodName');
  requiredText(draft.instrumentName, 'instrumentName');
  finite(draft.temperatureEnteredValue, 'temperatureEnteredValue');
  finite(draft.temperatureC, 'temperatureC');
  finite(draft.temperatureF, 'temperatureF');
  requiredText(draft.schemaVersion, 'schemaVersion');
  requiredText(draft.mobileAppVersion, 'mobileAppVersion');

  const ids = new Set<string>();
  for (const measurement of draft.measurements) {
    firestoreId(measurement.measurementId, 'measurement.measurementId');
    if (ids.has(measurement.measurementId)) throw new DraftContractError('measurement.measurementId');
    ids.add(measurement.measurementId);
    requiredText(measurement.parameterCode, 'measurement.parameterCode');
    requiredText(measurement.displayName, 'measurement.displayName');
    finite(measurement.value, 'measurement.value');
    requiredText(measurement.unitCode, 'measurement.unitCode');
    requiredText(measurement.methodName, 'measurement.methodName');
    requiredText(measurement.instrumentName, 'measurement.instrumentName');
    validDate(measurement.enteredAt, 'measurement.enteredAt');
  }
}

export function submissionReadinessIssues(draft: CompleteRevisionDraft): string[] {
  const codes = new Set(draft.measurements.map(({ parameterCode }) => parameterCode));
  const issues = requiredMeasurementsFor(draft.testType)
    .filter((code) => !codes.has(code))
    .map((code) => `measurement:${code}`);
  if (draft.measurements.length < minimumMeasurementCountFor(draft.testType)) {
    issues.push('measurement:minimum-count');
  }
  return issues;
}

export function assertSubmissionReady(draft: CompleteRevisionDraft): void {
  const [issue] = submissionReadinessIssues(draft);
  if (issue) throw new DraftContractError(issue);
}

export function assertCorrectionRevisionDraft(draft: CorrectionRevisionDraft): void {
  assertCompleteRevisionDraft(draft);
  firestoreId(draft.previousRevisionId, 'previousRevisionId');
  if (draft.revisionId === draft.previousRevisionId) throw new DraftContractError('revisionId');
  if (draft.revisionNo !== draft.previousRevisionNo + 1) throw new DraftContractError('revisionNo');
}
