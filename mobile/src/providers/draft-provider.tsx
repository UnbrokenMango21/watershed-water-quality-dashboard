import Constants from 'expo-constants';
import {
  AppState,
  type AppStateStatus,
} from 'react-native';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { firebaseSchema } from '@/config/contracts';
import { DraftContractError } from '@/domain/drafts';
import type {
  CompleteRevisionDraft,
  CorrectionRevisionDraft,
  PartialObservationDraft,
  SubmissionDetail,
  SubmissionDocumentState,
} from '@/domain/types';
import { useAuth } from '@/providers/auth-provider';
import { trackProductEvent } from '@/services/analytics';
import {
  createDraftIds,
  createMeasurementId,
  listenSubmissionDocumentState,
  queueCorrectionDraftWrites,
  queueDraftWrites,
  resubmitCorrection,
  submitDraft,
} from '@/services/firestore';
import {
  listPartialDrafts,
  removePartialDraft,
  savePartialDraft,
} from '@/services/draft-storage';

export type DraftTransportState = 'saved-locally' | 'syncing' | 'synced' | 'failed';

type TransportRecord = {
  status: DraftTransportState;
  error: string | null;
};

type DraftUpdater =
  | Partial<PartialObservationDraft>
  | ((current: PartialObservationDraft) => Partial<PartialObservationDraft>);

type SafeSiteSnapshot = { displayName: string; siteCode: string } | undefined;

type DraftContextValue = {
  drafts: PartialObservationDraft[];
  loading: boolean;
  unreadableDraftCount: number;
  createDraft: () => Promise<PartialObservationDraft>;
  createCorrectionDraft: (detail: SubmissionDetail, site?: SafeSiteSnapshot) => Promise<PartialObservationDraft>;
  restoreFirestoreDraft: (detail: SubmissionDetail, site?: SafeSiteSnapshot) => Promise<PartialObservationDraft>;
  getDraft: (submissionId: string, revisionId?: string) => PartialObservationDraft | null;
  updateDraft: (submissionId: string, updater: DraftUpdater) => PartialObservationDraft | null;
  flushDraft: (submissionId: string) => Promise<void>;
  discardDraft: (submissionId: string) => void;
  saveDraftToFirestore: (submissionId: string) => CompleteRevisionDraft;
  submitObservation: (submissionId: string) => CompleteRevisionDraft;
  retrySync: (submissionId: string) => CompleteRevisionDraft | null;
  transportFor: (submissionId: string) => TransportRecord;
};

const DraftContext = createContext<DraftContextValue | undefined>(undefined);

const defaultTransport: TransportRecord = { status: 'saved-locally', error: null };
const decimalNumberPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

function parseNumericText(value: string, field: string) {
  const normalized = value.trim();
  const parsed = Number(normalized);
  if (!decimalNumberPattern.test(normalized) || !Number.isFinite(parsed)) {
    throw new DraftContractError(field);
  }
  return parsed;
}

function completeDraft(uid: string, draft: PartialObservationDraft): CompleteRevisionDraft {
  const temperatureText = draft.temperatureEnteredValueText ?? '';
  const temperatureEnteredValue = parseNumericText(temperatureText, 'temperatureEnteredValue');
  const temperatureEnteredUnit = draft.temperatureEnteredUnit;
  if (!temperatureEnteredUnit) throw new DraftContractError('temperatureEnteredUnit');
  const temperatureC = temperatureEnteredUnit === 'F'
    ? ((temperatureEnteredValue - 32) * 5) / 9
    : temperatureEnteredValue;
  const temperatureF = temperatureEnteredUnit === 'C'
    ? (temperatureEnteredValue * 9) / 5 + 32
    : temperatureEnteredValue;
  const enteredAt = new Date(draft.updatedAt);

  const result: CompleteRevisionDraft = {
    submissionId: draft.submissionId,
    eventId: draft.eventId,
    revisionId: draft.revisionId,
    revisionNo: draft.revisionNo,
    collectorUid: uid,
    siteId: draft.siteId ?? '',
    submissionCreatedAt: new Date(draft.createdAt),
    revisionCreatedAt: new Date(draft.createdAt),
    collectedAt: new Date(draft.collectedAt ?? Number.NaN),
    timeKnown: true,
    timeImputed: false,
    latitude: draft.latitude ?? Number.NaN,
    longitude: draft.longitude ?? Number.NaN,
    gpsAccuracyM: draft.gpsAccuracyM ?? Number.NaN,
    dataCollectedBy: draft.dataCollectedBy ?? '',
    testType: draft.testType ?? '',
    testTypeOther: draft.testTypeOther,
    methodName: draft.methodName ?? '',
    instrumentName: draft.instrumentName ?? '',
    instrumentOther: draft.instrumentOther,
    temperatureEnteredValue,
    temperatureEnteredUnit,
    temperatureC,
    temperatureF,
    weatherCondition: draft.weatherCondition,
    fieldNotes: draft.fieldNotes,
    schemaVersion: firebaseSchema.version,
    mobileAppVersion: Constants.expoConfig?.version ?? '0.1.0',
    measurements: draft.measurements
      .filter(({ valueText }) => valueText.trim().length > 0)
      .map((measurement) => ({
        measurementId: measurement.measurementId,
        parameterCode: measurement.parameterCode,
        displayName: measurement.displayName,
        value: parseNumericText(measurement.valueText, `measurement:${measurement.parameterCode}`),
        unitCode: measurement.unitCode,
        methodName: draft.methodName ?? '',
        instrumentName: draft.instrumentName ?? '',
        qualifier: measurement.qualifier,
        notes: measurement.notes,
        enteredAt,
      })),
  };

  if (draft.correction) {
    return {
      ...result,
      previousRevisionId: draft.correction.previousRevisionId,
      previousRevisionNo: draft.correction.previousRevisionNo,
    } as CorrectionRevisionDraft;
  }
  return result;
}

function transportFromDocument(state: SubmissionDocumentState): DraftTransportState {
  if (!state.exists) return 'saved-locally';
  if (state.metadata.hasPendingWrites) {
    return state.metadata.fromCache ? 'saved-locally' : 'syncing';
  }
  return state.metadata.fromCache ? 'saved-locally' : 'synced';
}

export function DraftProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const uid = user?.uid ?? '';
  const [drafts, setDrafts] = useState<PartialObservationDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadableDraftCount, setUnreadableDraftCount] = useState(0);
  const [transport, setTransport] = useState<Record<string, TransportRecord>>({});
  const draftsRef = useRef<PartialObservationDraft[]>([]);
  const fileQueueRef = useRef<Promise<void>>(Promise.resolve());
  const documentStatesRef = useRef<Record<string, SubmissionDocumentState>>({});

  const replaceDrafts = useCallback((next: PartialObservationDraft[]) => {
    draftsRef.current = next;
    setDrafts(next);
  }, []);

  const enqueueFileSave = useCallback(
    (draft: PartialObservationDraft) => {
      const operation = fileQueueRef.current
        .catch(() => undefined)
        .then(() => savePartialDraft(uid, draft));
      fileQueueRef.current = operation;
      void operation.catch(() => {
        setTransport((current) => ({
          ...current,
          [draft.submissionId]: {
            status: 'failed',
            error: 'Could not save this draft on the device.',
          },
        }));
      });
      return operation;
    },
    [uid],
  );

  useEffect(() => {
    let active = true;
    void listPartialDrafts(uid)
      .then(({ drafts: savedDrafts, unreadableCount }) => {
        if (!active) return;
        draftsRef.current = savedDrafts;
        setDrafts(savedDrafts);
        setUnreadableDraftCount(unreadableCount);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [uid]);

  useEffect(() => {
    const handleAppState = (state: AppStateStatus) => {
      if (state === 'active') return;
      for (const draft of draftsRef.current) void enqueueFileSave(draft);
    };
    const subscription = AppState.addEventListener('change', handleAppState);
    return () => subscription.remove();
  }, [enqueueFileSave]);

  const draftIds = drafts
    .filter(({ syncIntent }) => syncIntent != null)
    .map(({ submissionId }) => submissionId)
    .sort()
    .join('|');
  useEffect(() => {
    if (!uid || !draftIds) return undefined;
    const stops = draftsRef.current.filter(({ syncIntent }) => syncIntent != null).map((draft) =>
      listenSubmissionDocumentState(
        uid,
        draft.submissionId,
        (state) => {
          documentStatesRef.current[draft.submissionId] = state;
          setTransport((current) => ({
            ...current,
            [draft.submissionId]: {
              status: transportFromDocument(state),
              error: null,
            },
          }));

          const serverAccepted =
            state.exists &&
            !state.metadata.fromCache &&
            !state.metadata.hasPendingWrites &&
            state.status != null &&
            state.status !== 'DRAFT' &&
            !(state.status === 'NEEDS_CORRECTION' && draft.correction);
          if (serverAccepted) {
            removePartialDraft(uid, draft.submissionId);
            replaceDrafts(
              draftsRef.current.filter(({ submissionId }) => submissionId !== draft.submissionId),
            );
          }
        },
        () => {
          setTransport((current) => ({
            ...current,
            [draft.submissionId]: {
              status: 'failed',
              error: 'Firestore rejected or could not synchronize this draft.',
            },
          }));
        },
      ),
    );
    return () => stops.forEach((stop) => stop());
  }, [draftIds, replaceDrafts, uid]);

  const createDraft = useCallback(async () => {
    const ids = createDraftIds();
    const now = new Date().toISOString();
    const draft: PartialObservationDraft = {
      storageVersion: 1,
      ...ids,
      revisionNo: 1,
      createdAt: now,
      updatedAt: now,
      collectedAt: now,
      measurements: [],
    };
    replaceDrafts([draft, ...draftsRef.current]);
    await enqueueFileSave(draft);
    void trackProductEvent('draft_created');
    return draft;
  }, [enqueueFileSave, replaceDrafts]);

  const createCorrectionDraft = useCallback(
    async (detail: SubmissionDetail, site?: SafeSiteSnapshot) => {
      const prior = detail.revision;
      if (!prior || detail.submission.status !== 'NEEDS_CORRECTION') {
        throw new Error('A correction revision is not available.');
      }
      const revisionId = createDraftIds().revisionId;
      const now = new Date().toISOString();
      const draft: PartialObservationDraft = {
        storageVersion: 1,
        submissionId: detail.submission.submissionId,
        eventId: detail.submission.eventId,
        revisionId,
        revisionNo: prior.revisionNo + 1,
        createdAt: now,
        updatedAt: now,
        siteId: prior.siteId,
        siteDisplayName: site?.displayName,
        siteCode: site?.siteCode,
        collectedAt: prior.collectedAt.toISOString(),
        latitude: prior.latitude,
        longitude: prior.longitude,
        gpsAccuracyM: prior.gpsAccuracyM,
        dataCollectedBy: prior.dataCollectedBy,
        testType: prior.testType,
        testTypeOther: prior.testTypeOther ?? undefined,
        methodName: prior.methodName,
        instrumentName: prior.instrumentName,
        instrumentOther: prior.instrumentOther ?? undefined,
        temperatureEnteredValueText: String(prior.temperatureEnteredValue),
        temperatureEnteredValue: prior.temperatureEnteredValue,
        temperatureEnteredUnit: prior.temperatureEnteredUnit,
        temperatureC: prior.temperatureC,
        temperatureF: prior.temperatureF,
        weatherCondition: prior.weatherCondition ?? undefined,
        fieldNotes: prior.fieldNotes ?? undefined,
        measurements: detail.measurements.map((measurement) => ({
          measurementId: createMeasurementId(detail.submission.submissionId, revisionId),
          parameterCode: measurement.parameterCode,
          displayName: measurement.displayName,
          valueText: String(measurement.value),
          unitCode: measurement.unitCode,
          qualifier: measurement.qualifier ?? undefined,
          notes: measurement.notes ?? undefined,
        })),
        correction: {
          previousRevisionId: prior.revisionId,
          previousRevisionNo: prior.revisionNo,
        },
      };
      replaceDrafts([draft, ...draftsRef.current.filter((item) => item.submissionId !== draft.submissionId)]);
      await enqueueFileSave(draft);
      void trackProductEvent('correction_opened');
      return draft;
    },
    [enqueueFileSave, replaceDrafts],
  );

  const restoreFirestoreDraft = useCallback(
    async (detail: SubmissionDetail, site?: SafeSiteSnapshot) => {
      const revision = detail.revision;
      if (!revision || detail.submission.status !== 'DRAFT' || revision.status !== 'DRAFT') {
        throw new Error('This Firestore revision is not an editable draft.');
      }
      const draft: PartialObservationDraft = {
        storageVersion: 1,
        submissionId: detail.submission.submissionId,
        eventId: detail.submission.eventId,
        revisionId: revision.revisionId,
        revisionNo: revision.revisionNo,
        createdAt: revision.createdAt.toISOString(),
        updatedAt: new Date().toISOString(),
        siteId: revision.siteId,
        siteDisplayName: site?.displayName,
        siteCode: site?.siteCode,
        collectedAt: revision.collectedAt.toISOString(),
        latitude: revision.latitude,
        longitude: revision.longitude,
        gpsAccuracyM: revision.gpsAccuracyM,
        dataCollectedBy: revision.dataCollectedBy,
        testType: revision.testType,
        testTypeOther: revision.testTypeOther ?? undefined,
        methodName: revision.methodName,
        instrumentName: revision.instrumentName,
        instrumentOther: revision.instrumentOther ?? undefined,
        temperatureEnteredValueText: String(revision.temperatureEnteredValue),
        temperatureEnteredValue: revision.temperatureEnteredValue,
        temperatureEnteredUnit: revision.temperatureEnteredUnit,
        temperatureC: revision.temperatureC,
        temperatureF: revision.temperatureF,
        weatherCondition: revision.weatherCondition ?? undefined,
        fieldNotes: revision.fieldNotes ?? undefined,
        syncIntent: 'DRAFT',
        measurements: detail.measurements.map((measurement) => ({
          measurementId: measurement.measurementId,
          parameterCode: measurement.parameterCode,
          displayName: measurement.displayName,
          valueText: String(measurement.value),
          unitCode: measurement.unitCode,
          qualifier: measurement.qualifier ?? undefined,
          notes: measurement.notes ?? undefined,
        })),
      };
      replaceDrafts([draft, ...draftsRef.current.filter((item) => item.submissionId !== draft.submissionId)]);
      await enqueueFileSave(draft);
      void trackProductEvent('draft_resumed');
      return draft;
    },
    [enqueueFileSave, replaceDrafts],
  );

  const getDraft = useCallback(
    (submissionId: string, revisionId?: string) =>
      draftsRef.current.find(
        (draft) =>
          draft.submissionId === submissionId &&
          (revisionId == null || draft.revisionId === revisionId),
      ) ?? null,
    [],
  );

  const updateDraft = useCallback(
    (submissionId: string, updater: DraftUpdater) => {
      const current = draftsRef.current.find((draft) => draft.submissionId === submissionId);
      if (!current) return null;
      const patch = typeof updater === 'function' ? updater(current) : updater;
      const next: PartialObservationDraft = {
        ...current,
        ...patch,
        storageVersion: 1,
        submissionId: current.submissionId,
        eventId: current.eventId,
        revisionId: current.revisionId,
        revisionNo: current.revisionNo,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
      };
      replaceDrafts(
        draftsRef.current.map((draft) =>
          draft.submissionId === submissionId ? next : draft,
        ),
      );
      void enqueueFileSave(next);
      return next;
    },
    [enqueueFileSave, replaceDrafts],
  );

  const flushDraft = useCallback(
    async (submissionId: string) => {
      const draft = getDraft(submissionId);
      if (draft) await enqueueFileSave(draft);
    },
    [enqueueFileSave, getDraft],
  );

  const discardDraft = useCallback(
    (submissionId: string) => {
      removePartialDraft(uid, submissionId);
      replaceDrafts(draftsRef.current.filter((draft) => draft.submissionId !== submissionId));
      setTransport((current) => {
        const next = { ...current };
        delete next[submissionId];
        return next;
      });
    },
    [replaceDrafts, uid],
  );

  const beginWrite = useCallback(
    (draft: PartialObservationDraft, intent: NonNullable<PartialObservationDraft['syncIntent']>) => {
      const withIntent = updateDraft(draft.submissionId, { syncIntent: intent }) ?? draft;
      setTransport((current) => ({
        ...current,
        [draft.submissionId]: defaultTransport,
      }));
      return { partial: withIntent, complete: completeDraft(uid, withIntent) };
    },
    [uid, updateDraft],
  );

  const observeAcknowledgement = useCallback(
    (submissionId: string, acknowledgement: Promise<void>) => {
      void acknowledgement
        .then(() => {
          setTransport((current) => ({
            ...current,
            [submissionId]: { status: 'synced', error: null },
          }));
          void trackProductEvent('submission_synced');
        })
        .catch(() => {
          setTransport((current) => ({
            ...current,
            [submissionId]: {
              status: 'failed',
              error: 'Firestore rejected or could not synchronize this draft.',
            },
          }));
          void trackProductEvent('submission_failed');
        });
    },
    [],
  );

  const saveDraftToFirestore = useCallback(
    (submissionId: string) => {
      const draft = getDraft(submissionId);
      if (!draft) throw new Error('Draft not found.');
      const { complete } = beginWrite(draft, 'DRAFT');
      const acknowledgement = draft.correction
        ? queueCorrectionDraftWrites(complete as CorrectionRevisionDraft)
        : queueDraftWrites(complete);
      observeAcknowledgement(submissionId, acknowledgement);
      return complete;
    },
    [beginWrite, getDraft, observeAcknowledgement],
  );

  const submitObservation = useCallback(
    (submissionId: string) => {
      const draft = getDraft(submissionId);
      if (!draft) throw new Error('Draft not found.');
      const intent = draft.correction ? 'RESUBMITTED' : 'SUBMITTED';
      const { complete } = beginWrite(draft, intent);
      void trackProductEvent('submission_attempted');
      const acknowledgement = draft.correction
        ? resubmitCorrection(complete as CorrectionRevisionDraft)
        : submitDraft(complete);
      observeAcknowledgement(submissionId, acknowledgement);
      if (draft.correction) void trackProductEvent('correction_resubmitted');
      return complete;
    },
    [beginWrite, getDraft, observeAcknowledgement],
  );

  const retrySync = useCallback(
    (submissionId: string) => {
      const draft = getDraft(submissionId);
      if (!draft?.syncIntent) return null;
      const complete = completeDraft(uid, draft);
      const state = documentStatesRef.current[submissionId];
      let acknowledgement: Promise<void>;

      if (draft.syncIntent === 'DRAFT') {
        acknowledgement = draft.correction
          ? queueCorrectionDraftWrites(complete as CorrectionRevisionDraft)
          : queueDraftWrites(complete);
      } else if (draft.syncIntent === 'RESUBMITTED') {
        if (state?.status && state.status !== 'NEEDS_CORRECTION') return complete;
        acknowledgement = resubmitCorrection(complete as CorrectionRevisionDraft);
      } else {
        if (state?.status && state.status !== 'DRAFT') return complete;
        acknowledgement = submitDraft(complete);
      }

      setTransport((current) => ({ ...current, [submissionId]: defaultTransport }));
      observeAcknowledgement(submissionId, acknowledgement);
      return complete;
    },
    [getDraft, observeAcknowledgement, uid],
  );

  const transportFor = useCallback(
    (submissionId: string) => transport[submissionId] ?? defaultTransport,
    [transport],
  );

  const value = useMemo<DraftContextValue>(
    () => ({
      drafts,
      loading,
      unreadableDraftCount,
      createDraft,
      createCorrectionDraft,
      restoreFirestoreDraft,
      getDraft,
      updateDraft,
      flushDraft,
      discardDraft,
      saveDraftToFirestore,
      submitObservation,
      retrySync,
      transportFor,
    }),
    [
      drafts,
      loading,
      unreadableDraftCount,
      createDraft,
      createCorrectionDraft,
      restoreFirestoreDraft,
      getDraft,
      updateDraft,
      flushDraft,
      discardDraft,
      saveDraftToFirestore,
      submitObservation,
      retrySync,
      transportFor,
    ],
  );

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useDrafts() {
  const context = useContext(DraftContext);
  if (!context) throw new Error('useDrafts must be used within DraftProvider');
  return context;
}
