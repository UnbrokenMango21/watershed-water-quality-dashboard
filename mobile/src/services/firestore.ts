import {
  GeoPoint,
  collection,
  doc,
  getDocsFromCache,
  getDocsFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  waitForPendingWrites,
  where,
  writeBatch,
  type DocumentData,
  type QuerySnapshot,
  type SnapshotMetadata,
  type Unsubscribe,
} from '@react-native-firebase/firestore';

import {
  assertCompleteRevisionDraft,
  assertCorrectionRevisionDraft,
  assertSubmissionReady,
} from '@/domain/drafts';
import {
  parseMeasurement,
  parseRevision,
  parseSiteCatalogEntry,
  parseSubmission,
  parseSubmissionStatus,
  parseValidationFlag,
} from '@/domain/parsers';
import type {
  CompleteRevisionDraft,
  CorrectionRevisionDraft,
  FirestoreSyncMetadata,
  Revision,
  RevisionDetail,
  SiteCatalogEntry,
  Submission,
  SubmissionDetail,
  SubmissionDocumentState,
} from '@/domain/types';
import { db } from '@/lib/firebase';

type Listener<T> = (value: T) => void;
type ErrorListener = (error: Error) => void;
const SNAPSHOT_OPTIONS = { includeMetadataChanges: true } as const;

export type CollectionSnapshot<T> = {
  data: T[];
  metadata: FirestoreSyncMetadata;
  invalidDocumentCount: number;
};

function syncMetadata(metadata: SnapshotMetadata): FirestoreSyncMetadata {
  return {
    fromCache: metadata.fromCache,
    hasPendingWrites: metadata.hasPendingWrites,
  };
}

function safeError(value: unknown): Error {
  if (value && typeof value === 'object' && 'code' in value && typeof value.code === 'string') {
    return new Error(`Firestore request failed (${value.code})`);
  }
  return new Error('Firestore request failed');
}

function parseSiteSnapshot(snapshot: QuerySnapshot<DocumentData, DocumentData>): CollectionSnapshot<SiteCatalogEntry> {
  const data: SiteCatalogEntry[] = [];
  let invalidDocumentCount = 0;
  for (const document of snapshot.docs) {
    try {
      const site = parseSiteCatalogEntry(document.id, document.data());
      if (site.active) data.push(site);
    } catch {
      invalidDocumentCount += 1;
    }
  }
  data.sort((left, right) => left.displayName.localeCompare(right.displayName));
  return { data, metadata: syncMetadata(snapshot.metadata), invalidDocumentCount };
}

export function listenSiteCatalog(
  listener: Listener<CollectionSnapshot<SiteCatalogEntry>>,
  onError: ErrorListener,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'siteCatalog'),
    SNAPSHOT_OPTIONS,
    (snapshot) => listener(parseSiteSnapshot(snapshot)),
    (error) => onError(safeError(error)),
  );
}

export async function loadCachedSiteCatalog(): Promise<CollectionSnapshot<SiteCatalogEntry>> {
  try {
    return parseSiteSnapshot(await getDocsFromCache(collection(db, 'siteCatalog')));
  } catch (error) {
    throw safeError(error);
  }
}

export async function refreshSiteCatalog(): Promise<CollectionSnapshot<SiteCatalogEntry>> {
  try {
    return parseSiteSnapshot(await getDocsFromServer(collection(db, 'siteCatalog')));
  } catch (error) {
    throw safeError(error);
  }
}

export function listenRecentSubmissions(
  uid: string,
  listener: Listener<CollectionSnapshot<Submission>>,
  onError: ErrorListener,
  maximum = 30,
): Unsubscribe {
  const submissionsQuery = query(
    collection(db, 'submissions'),
    where('collector_user_id', '==', uid),
    orderBy('updated_at', 'desc'),
    limit(Math.max(1, maximum)),
  );
  return onSnapshot(
    submissionsQuery,
    SNAPSHOT_OPTIONS,
    (snapshot) => {
      const data: Submission[] = [];
      let invalidDocumentCount = 0;
      for (const document of snapshot.docs) {
        try {
          const submission = parseSubmission(document.data(), uid);
          if (submission.submissionId !== document.id) throw new Error('submission id mismatch');
          data.push(submission);
        } catch {
          invalidDocumentCount += 1;
        }
      }
      listener({
        data,
        metadata: syncMetadata(snapshot.metadata),
        invalidDocumentCount,
      });
    },
    (error) => onError(safeError(error)),
  );
}

export function listenSubmissionDocumentState(
  uid: string,
  submissionId: string,
  listener: Listener<SubmissionDocumentState>,
  onError: ErrorListener,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'submissions', submissionId),
    SNAPSHOT_OPTIONS,
    (snapshot) => {
      const metadata = syncMetadata(snapshot.metadata);
      if (!snapshot.exists()) {
        listener({ exists: false, status: null, metadata });
        return;
      }
      try {
        const data = snapshot.data();
        if (data.collector_user_id !== uid) throw new Error('submission owner mismatch');
        listener({ exists: true, status: parseSubmissionStatus(data.status), metadata });
      } catch (error) {
        onError(safeError(error));
      }
    },
    (error) => onError(safeError(error)),
  );
}

export function listenRevisionHistory(
  uid: string,
  submissionId: string,
  listener: Listener<CollectionSnapshot<Revision>>,
  onError: ErrorListener,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'submissions', submissionId, 'revisions'), orderBy('revision_no', 'desc')),
    SNAPSHOT_OPTIONS,
    (snapshot) => {
      const data: Revision[] = [];
      let invalidDocumentCount = 0;
      for (const document of snapshot.docs) {
        try {
          const revision = parseRevision(document.data(), uid);
          if (revision.revisionId !== document.id || revision.submissionId !== submissionId) {
            throw new Error('revision identity mismatch');
          }
          data.push(revision);
        } catch {
          invalidDocumentCount += 1;
        }
      }
      listener({ data, metadata: syncMetadata(snapshot.metadata), invalidDocumentCount });
    },
    (error) => onError(safeError(error)),
  );
}

export function listenSubmissionDetail(
  uid: string,
  submissionId: string,
  listener: Listener<SubmissionDetail | null>,
  onError: ErrorListener,
): Unsubscribe {
  let nestedUnsubscribes: Unsubscribe[] = [];
  let generation = 0;

  const stopNested = () => {
    nestedUnsubscribes.forEach((unsubscribe) => unsubscribe());
    nestedUnsubscribes = [];
  };

  const submissionUnsubscribe = onSnapshot(
    doc(db, 'submissions', submissionId),
    SNAPSHOT_OPTIONS,
    (submissionSnapshot) => {
      stopNested();
      generation += 1;
      const activeGeneration = generation;
      if (!submissionSnapshot.exists()) {
        listener(null);
        return;
      }

      let submission: Submission;
      try {
        submission = parseSubmission(submissionSnapshot.data(), uid);
        if (submission.submissionId !== submissionId) throw new Error('submission id mismatch');
      } catch (error) {
        onError(safeError(error));
        return;
      }

      const revisionRef = doc(db, 'submissions', submissionId, 'revisions', submission.currentRevisionId);
      const state: {
        revisionReady: boolean;
        historyReady: boolean;
        measurementsReady: boolean;
        flagsReady: boolean;
        revision: SubmissionDetail['revision'];
        revisionHistory: SubmissionDetail['revisionHistory'];
        measurements: SubmissionDetail['measurements'];
        validationFlags: SubmissionDetail['validationFlags'];
        revisionMetadata: FirestoreSyncMetadata | null;
        historyMetadata: FirestoreSyncMetadata | null;
        measurementMetadata: FirestoreSyncMetadata | null;
        flagMetadata: FirestoreSyncMetadata | null;
      } = {
        revisionReady: false,
        historyReady: false,
        measurementsReady: false,
        flagsReady: false,
        revision: null,
        revisionHistory: [],
        measurements: [],
        validationFlags: [],
        revisionMetadata: null,
        historyMetadata: null,
        measurementMetadata: null,
        flagMetadata: null,
      };

      const emitIfReady = () => {
        if (
          activeGeneration !== generation ||
          !state.revisionReady ||
          !state.historyReady ||
          !state.measurementsReady ||
          !state.flagsReady
        ) {
          return;
        }
        listener({
          submission,
          revision: state.revision,
          revisionHistory: state.revisionHistory,
          measurements: state.measurements,
          validationFlags: state.validationFlags,
          metadata: {
            submission: syncMetadata(submissionSnapshot.metadata),
            revision: state.revisionMetadata,
            revisionHistory: state.historyMetadata,
            measurements: state.measurementMetadata,
            validationFlags: state.flagMetadata,
          },
        });
      };

      nestedUnsubscribes = [
        onSnapshot(
          revisionRef,
          SNAPSHOT_OPTIONS,
          (snapshot) => {
            try {
              state.revision = snapshot.exists() ? parseRevision(snapshot.data(), uid) : null;
              state.revisionMetadata = syncMetadata(snapshot.metadata);
              state.revisionReady = true;
              emitIfReady();
            } catch (error) {
              onError(safeError(error));
            }
          },
          (error) => onError(safeError(error)),
        ),
        onSnapshot(
          query(
            collection(db, 'submissions', submissionId, 'revisions'),
            orderBy('revision_no', 'desc'),
          ),
          SNAPSHOT_OPTIONS,
          (snapshot) => {
            try {
              state.revisionHistory = snapshot.docs.map((item) => {
                const revision = parseRevision(item.data(), uid);
                if (revision.revisionId !== item.id || revision.submissionId !== submissionId) {
                  throw new Error('revision identity mismatch');
                }
                return revision;
              });
              state.historyMetadata = syncMetadata(snapshot.metadata);
              state.historyReady = true;
              emitIfReady();
            } catch (error) {
              onError(safeError(error));
            }
          },
          (error) => onError(safeError(error)),
        ),
        onSnapshot(
          collection(revisionRef, 'measurements'),
          SNAPSHOT_OPTIONS,
          (snapshot) => {
            try {
              state.measurements = snapshot.docs.map((item) => parseMeasurement(item.id, item.data()));
              state.measurements.sort((left, right) => left.parameterCode.localeCompare(right.parameterCode));
              state.measurementMetadata = syncMetadata(snapshot.metadata);
              state.measurementsReady = true;
              emitIfReady();
            } catch (error) {
              onError(safeError(error));
            }
          },
          (error) => onError(safeError(error)),
        ),
        onSnapshot(
          collection(revisionRef, 'validationFlags'),
          SNAPSHOT_OPTIONS,
          (snapshot) => {
            try {
              state.validationFlags = snapshot.docs.map((item) =>
                parseValidationFlag(item.id, item.data()),
              );
              state.validationFlags.sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
              state.flagMetadata = syncMetadata(snapshot.metadata);
              state.flagsReady = true;
              emitIfReady();
            } catch (error) {
              onError(safeError(error));
            }
          },
          (error) => onError(safeError(error)),
        ),
      ];
    },
    (error) => onError(safeError(error)),
  );

  return () => {
    generation += 1;
    stopNested();
    submissionUnsubscribe();
  };
}

export function listenRevisionDetail(
  uid: string,
  submissionId: string,
  revisionId: string,
  listener: Listener<RevisionDetail | null>,
  onError: ErrorListener,
): Unsubscribe {
  const revisionRef = doc(db, 'submissions', submissionId, 'revisions', revisionId);
  const state: {
    revision: Revision | null;
    measurements: RevisionDetail['measurements'];
    validationFlags: RevisionDetail['validationFlags'];
    revisionMetadata: FirestoreSyncMetadata | null;
    measurementMetadata: FirestoreSyncMetadata | null;
    flagMetadata: FirestoreSyncMetadata | null;
    revisionReady: boolean;
    measurementsReady: boolean;
    flagsReady: boolean;
  } = {
    revision: null,
    measurements: [],
    validationFlags: [],
    revisionMetadata: null,
    measurementMetadata: null,
    flagMetadata: null,
    revisionReady: false,
    measurementsReady: false,
    flagsReady: false,
  };

  const emit = () => {
    if (!state.revisionReady || !state.measurementsReady || !state.flagsReady) return;
    if (!state.revision) {
      listener(null);
      return;
    }
    listener({
      revision: state.revision,
      measurements: state.measurements,
      validationFlags: state.validationFlags,
      metadata: {
        revision: state.revisionMetadata!,
        measurements: state.measurementMetadata!,
        validationFlags: state.flagMetadata!,
      },
    });
  };

  const stops = [
    onSnapshot(
      revisionRef,
      SNAPSHOT_OPTIONS,
      (snapshot) => {
        try {
          state.revision = snapshot.exists() ? parseRevision(snapshot.data(), uid) : null;
          if (state.revision && (state.revision.revisionId !== revisionId || state.revision.submissionId !== submissionId)) {
            throw new Error('revision identity mismatch');
          }
          state.revisionMetadata = syncMetadata(snapshot.metadata);
          state.revisionReady = true;
          emit();
        } catch (error) {
          onError(safeError(error));
        }
      },
      (error) => onError(safeError(error)),
    ),
    onSnapshot(
      collection(revisionRef, 'measurements'),
      SNAPSHOT_OPTIONS,
      (snapshot) => {
        try {
          state.measurements = snapshot.docs.map((item) => parseMeasurement(item.id, item.data()));
          state.measurements.sort((left, right) => left.parameterCode.localeCompare(right.parameterCode));
          state.measurementMetadata = syncMetadata(snapshot.metadata);
          state.measurementsReady = true;
          emit();
        } catch (error) {
          onError(safeError(error));
        }
      },
      (error) => onError(safeError(error)),
    ),
    onSnapshot(
      collection(revisionRef, 'validationFlags'),
      SNAPSHOT_OPTIONS,
      (snapshot) => {
        try {
          state.validationFlags = snapshot.docs.map((item) => parseValidationFlag(item.id, item.data()));
          state.flagMetadata = syncMetadata(snapshot.metadata);
          state.flagsReady = true;
          emit();
        } catch (error) {
          onError(safeError(error));
        }
      },
      (error) => onError(safeError(error)),
    ),
  ];
  return () => stops.forEach((stop) => stop());
}

function optional<T extends object>(value: T, entries: [string, unknown][]): T & Record<string, unknown> {
  const result = value as Record<string, unknown>;
  for (const [key, entry] of entries) {
    if (entry !== undefined && entry !== '') result[key] = entry;
  }
  return result as T & Record<string, unknown>;
}

function revisionPayload(draft: CompleteRevisionDraft) {
  return optional(
    {
      revision_id: draft.revisionId,
      revision_no: draft.revisionNo,
      submission_id: draft.submissionId,
      event_id: draft.eventId,
      collector_user_id: draft.collectorUid,
      site_id: draft.siteId,
      revision_status: 'DRAFT' as const,
      created_at: draft.revisionCreatedAt,
      submitted_at: null as Date | null,
      collected_at: draft.collectedAt,
      time_known: draft.timeKnown,
      time_imputed: draft.timeImputed,
      latitude: draft.latitude,
      longitude: draft.longitude,
      location: new GeoPoint(draft.latitude, draft.longitude),
      gps_accuracy_m: draft.gpsAccuracyM,
      data_collected_by: draft.dataCollectedBy,
      test_type: draft.testType,
      method_name: draft.methodName,
      instrument_name: draft.instrumentName,
      temp_entered_value: draft.temperatureEnteredValue,
      temp_entered_unit: draft.temperatureEnteredUnit,
      temp_c: draft.temperatureC,
      temp_f: draft.temperatureF,
      schema_version: draft.schemaVersion,
      mobile_app_version: draft.mobileAppVersion,
    },
    [
      ['site_distance_m', draft.siteDistanceM],
      ['weather_condition', draft.weatherCondition?.trim()],
      ['test_type_other', draft.testTypeOther?.trim()],
      ['instrument_other', draft.instrumentOther?.trim()],
      ['field_notes_original', draft.fieldNotes?.trim()],
    ],
  );
}

function measurementPayload(measurement: CompleteRevisionDraft['measurements'][number]) {
  return optional(
    {
      measurement_id: measurement.measurementId,
      parameter_code: measurement.parameterCode,
      display_name: measurement.displayName,
      value: measurement.value,
      unit_code: measurement.unitCode,
      method_name: measurement.methodName,
      instrument_name: measurement.instrumentName,
      entered_at: measurement.enteredAt,
    },
    [
      ['qualifier', measurement.qualifier?.trim()],
      ['notes', measurement.notes?.trim()],
    ],
  );
}

function acknowledge(writes: Promise<unknown>[]): Promise<void> {
  return Promise.all(writes).then(() => undefined);
}

function queueRevisionAndMeasurementWrites(draft: CompleteRevisionDraft): Promise<unknown>[] {
  const revisionRef = doc(db, 'submissions', draft.submissionId, 'revisions', draft.revisionId);
  const writes: Promise<unknown>[] = [setDoc(revisionRef, revisionPayload(draft))];

  for (const measurement of draft.measurements) {
    writes.push(
      setDoc(
        doc(collection(revisionRef, 'measurements'), measurement.measurementId),
        measurementPayload(measurement),
      ),
    );
  }

  if (draft.removedMeasurementIds?.length) {
    const batch = writeBatch(db);
    for (const measurementId of draft.removedMeasurementIds) {
      batch.delete(doc(collection(revisionRef, 'measurements'), measurementId));
    }
    writes.push(batch.commit());
  }
  return writes;
}

export function queueDraftWrites(draft: CompleteRevisionDraft): Promise<void> {
  assertCompleteRevisionDraft(draft);
  const writes: Promise<unknown>[] = [
    setDoc(doc(db, 'submissions', draft.submissionId), {
      submission_id: draft.submissionId,
      event_id: draft.eventId,
      collector_user_id: draft.collectorUid,
      site_id: draft.siteId,
      status: 'DRAFT',
      current_revision_id: draft.revisionId,
      current_revision_no: draft.revisionNo,
      latest_collected_at: draft.collectedAt,
      created_at: draft.submissionCreatedAt,
      updated_at: new Date(),
      submitted_at: null,
      schema_version: draft.schemaVersion,
      mobile_app_version: draft.mobileAppVersion,
    }),
  ];
  writes.push(...queueRevisionAndMeasurementWrites(draft));
  return acknowledge(writes);
}

export function queueCorrectionDraftWrites(draft: CorrectionRevisionDraft): Promise<void> {
  assertCorrectionRevisionDraft(draft);
  const writes: Promise<unknown>[] = [
    updateDoc(doc(db, 'submissions', draft.submissionId), {
      site_id: draft.siteId,
      status: 'NEEDS_CORRECTION',
      current_revision_id: draft.revisionId,
      current_revision_no: draft.revisionNo,
      latest_collected_at: draft.collectedAt,
      updated_at: new Date(),
      mobile_app_version: draft.mobileAppVersion,
    }),
  ];
  writes.push(...queueRevisionAndMeasurementWrites(draft));
  return acknowledge(writes);
}

function queueFinalization(
  draft: CompleteRevisionDraft,
  submissionStatus: 'SUBMITTED' | 'RESUBMITTED',
): Promise<void> {
  const submittedAt = new Date();
  const revisionRef = doc(db, 'submissions', draft.submissionId, 'revisions', draft.revisionId);
  const batch = writeBatch(db);
  batch.update(revisionRef, { revision_status: 'SUBMITTED', submitted_at: submittedAt });
  batch.update(doc(db, 'submissions', draft.submissionId), {
    status: submissionStatus,
    current_revision_id: draft.revisionId,
    current_revision_no: draft.revisionNo,
    latest_collected_at: draft.collectedAt,
    updated_at: submittedAt,
    submitted_at: submittedAt,
    mobile_app_version: draft.mobileAppVersion,
  });
  return batch.commit();
}

export function queueSubmitTransition(draft: CompleteRevisionDraft): Promise<void> {
  assertCompleteRevisionDraft(draft);
  assertSubmissionReady(draft);
  return queueFinalization(draft, 'SUBMITTED');
}

export function queueResubmitTransition(draft: CorrectionRevisionDraft): Promise<void> {
  assertCorrectionRevisionDraft(draft);
  assertSubmissionReady(draft);
  return queueFinalization(draft, 'RESUBMITTED');
}

// Initial attempt only. Retry with queueSubmitTransition so a submitted revision is never rewritten as DRAFT.
export function submitDraft(draft: CompleteRevisionDraft): Promise<void> {
  const draftAcknowledgement = queueDraftWrites(draft);
  const transitionAcknowledgement = queueSubmitTransition(draft);
  return acknowledge([draftAcknowledgement, transitionAcknowledgement]);
}

// Initial attempt only. Retry with queueResubmitTransition so prior submitted science stays immutable.
export function resubmitCorrection(draft: CorrectionRevisionDraft): Promise<void> {
  const draftAcknowledgement = queueCorrectionDraftWrites(draft);
  const transitionAcknowledgement = queueResubmitTransition(draft);
  return acknowledge([draftAcknowledgement, transitionAcknowledgement]);
}

export function createDraftIds(): {
  submissionId: string;
  eventId: string;
  revisionId: string;
} {
  return {
    submissionId: doc(collection(db, 'submissions')).id,
    eventId: doc(collection(db, 'submissions')).id,
    revisionId: doc(collection(db, 'submissions')).id,
  };
}

export function createMeasurementId(submissionId: string, revisionId: string): string {
  return doc(collection(db, 'submissions', submissionId, 'revisions', revisionId, 'measurements')).id;
}

export async function awaitFirestoreSync(): Promise<void> {
  try {
    await waitForPendingWrites(db);
  } catch (error) {
    throw safeError(error);
  }
}
