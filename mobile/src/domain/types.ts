export type TemperatureUnit = 'C' | 'F';
export type RevisionStatus = 'DRAFT' | 'SUBMITTED';

export type SubmissionStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'VALIDATING'
  | 'PENDING_REVIEW'
  | 'NEEDS_CORRECTION'
  | 'RESUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'PUBLISHING'
  | 'PUBLISH_FAILED'
  | 'PUBLISHED';

export type ValidationSeverity =
  | 'ERROR'
  | 'PLAUSIBILITY_WARNING'
  | 'ENVIRONMENTAL_ALERT'
  | 'INFO';

export type FirestoreSyncMetadata = {
  fromCache: boolean;
  hasPendingWrites: boolean;
};

export type SiteCatalogEntry = {
  siteId: string;
  siteCode: string;
  displayName: string;
  latitude: number;
  longitude: number;
  toleranceM: number;
  active: boolean;
  updatedAt: Date;
};

export type Submission = {
  submissionId: string;
  eventId: string;
  collectorUid: string;
  siteId: string;
  status: SubmissionStatus;
  currentRevisionId: string;
  currentRevisionNo: number;
  latestCollectedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  submittedAt: Date | null;
  schemaVersion: string;
  mobileAppVersion: string;
  reviewComment: string | null;
  errorFlagCount: number;
  warningFlagCount: number;
  infoFlagCount: number;
};

export type Revision = {
  revisionId: string;
  revisionNo: number;
  submissionId: string;
  eventId: string;
  collectorUid: string;
  siteId: string;
  status: RevisionStatus;
  createdAt: Date;
  submittedAt: Date | null;
  collectedAt: Date;
  timeKnown: boolean;
  timeImputed: boolean;
  latitude: number;
  longitude: number;
  gpsAccuracyM: number;
  siteDistanceM: number | null;
  weatherCondition: string | null;
  dataCollectedBy: string;
  testType: string;
  testTypeOther: string | null;
  methodName: string;
  instrumentName: string;
  instrumentOther: string | null;
  temperatureEnteredValue: number;
  temperatureEnteredUnit: TemperatureUnit;
  temperatureC: number;
  temperatureF: number;
  fieldNotes: string | null;
  schemaVersion: string;
  mobileAppVersion: string;
};

export type Measurement = {
  measurementId: string;
  parameterCode: string;
  displayName: string;
  value: number;
  unitCode: string;
  methodName: string;
  instrumentName: string;
  qualifier: string | null;
  notes: string | null;
  enteredAt: Date;
};

export type ValidationFlag = {
  flagId: string;
  severity: ValidationSeverity;
  category: string;
  parameterCode: string | null;
  message: string;
  ruleCode: string;
  createdAt: Date;
  resolved: boolean;
};

export type DraftMeasurement = {
  measurementId: string;
  parameterCode: string;
  displayName: string;
  value: number;
  unitCode: string;
  methodName: string;
  instrumentName: string;
  qualifier?: string;
  notes?: string;
  enteredAt: Date;
};

export type CompleteRevisionDraft = {
  submissionId: string;
  eventId: string;
  revisionId: string;
  revisionNo: number;
  collectorUid: string;
  siteId: string;
  submissionCreatedAt: Date;
  revisionCreatedAt: Date;
  collectedAt: Date;
  timeKnown: boolean;
  timeImputed: boolean;
  latitude: number;
  longitude: number;
  gpsAccuracyM: number;
  siteDistanceM?: number;
  weatherCondition?: string;
  dataCollectedBy: string;
  testType: string;
  testTypeOther?: string;
  methodName: string;
  instrumentName: string;
  instrumentOther?: string;
  temperatureEnteredValue: number;
  temperatureEnteredUnit: TemperatureUnit;
  temperatureC: number;
  temperatureF: number;
  fieldNotes?: string;
  schemaVersion: string;
  mobileAppVersion: string;
  measurements: DraftMeasurement[];
  removedMeasurementIds?: string[];
};

export type CorrectionRevisionDraft = CompleteRevisionDraft & {
  previousRevisionId: string;
  previousRevisionNo: number;
};

export type PartialObservationDraft = {
  storageVersion: 1;
  submissionId: string;
  eventId: string;
  revisionId: string;
  revisionNo: number;
  createdAt: string;
  updatedAt: string;
  siteId?: string;
  siteDisplayName?: string;
  siteCode?: string;
  collectedAt?: string;
  latitude?: number;
  longitude?: number;
  gpsAccuracyM?: number;
  dataCollectedBy?: string;
  testType?: string;
  testTypeOther?: string;
  methodName?: string;
  instrumentName?: string;
  instrumentOther?: string;
  temperatureEnteredValueText?: string;
  temperatureEnteredValue?: number;
  temperatureEnteredUnit?: TemperatureUnit;
  temperatureC?: number;
  temperatureF?: number;
  weatherCondition?: string;
  fieldNotes?: string;
  syncIntent?: 'DRAFT' | 'SUBMITTED' | 'RESUBMITTED';
  measurements: {
    measurementId: string;
    parameterCode: string;
    displayName: string;
    valueText: string;
    unitCode: string;
    qualifier?: string;
    notes?: string;
  }[];
  correction?: {
    previousRevisionId: string;
    previousRevisionNo: number;
  };
};

export type SubmissionDetail = {
  submission: Submission;
  revision: Revision | null;
  revisionHistory: Revision[];
  measurements: Measurement[];
  validationFlags: ValidationFlag[];
  metadata: {
    submission: FirestoreSyncMetadata;
    revision: FirestoreSyncMetadata | null;
    revisionHistory: FirestoreSyncMetadata | null;
    measurements: FirestoreSyncMetadata | null;
    validationFlags: FirestoreSyncMetadata | null;
  };
};

export type SubmissionDocumentState = {
  exists: boolean;
  status: SubmissionStatus | null;
  metadata: FirestoreSyncMetadata;
};

export type RevisionDetail = {
  revision: Revision;
  measurements: Measurement[];
  validationFlags: ValidationFlag[];
  metadata: {
    revision: FirestoreSyncMetadata;
    measurements: FirestoreSyncMetadata;
    validationFlags: FirestoreSyncMetadata;
  };
};
