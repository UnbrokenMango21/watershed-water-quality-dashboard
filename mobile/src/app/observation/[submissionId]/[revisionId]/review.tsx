import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { DraftGate } from '@/components/observation/draft-gate';
import { ProgressHeader } from '@/components/observation/progress-header';
import { ReviewSection } from '@/components/observation/review-section';
import { PrimaryButton, SecondaryButton } from '@/components/ui/button';
import { ScreenIntro } from '@/components/ui/screen-intro';
import { InlineAlert, SubmissionStatusChip, SyncStatus } from '@/components/ui/status';
import { AppScreen } from '@/components/ui/surface';
import { firebaseSchema } from '@/config/contracts';
import { DraftContractError } from '@/domain/drafts';
import { displayUnitForParameter } from '@/features/observations/measurement-presentation';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useObservationDraft } from '@/hooks/use-observation-draft';
import { trackScreenView } from '@/services/analytics';

const collectedFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
});

function coordinateDecimals(accuracy: number | undefined) {
  if (accuracy == null) return 5;
  if (accuracy <= 1) return 6;
  if (accuracy <= 10) return 5;
  if (accuracy <= 100) return 4;
  return 3;
}

export default function ReviewStep() {
  const theme = useTheme();
  const router = useRouter();
  const {
    draft,
    loading,
    retrySync,
    routeParams,
    saveDraftToFirestore,
    submissionId,
    submitObservation,
    transportFor,
  } = useObservationDraft();
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void trackScreenView('review');
  }, []);

  if (!draft) return <DraftGate loading={loading} />;

  const currentDraft = draft;
  const transport = transportFor(submissionId);
  const collectedAt = new Date(draft.collectedAt ?? Number.NaN);
  const decimals = coordinateDecimals(draft.gpsAccuracyM);
  const temperature = Number(draft.temperatureEnteredValueText);
  const derivedTemperature = draft.temperatureEnteredUnit === 'F'
    ? `${(((temperature - 32) * 5) / 9).toFixed(firebaseSchema.temperatureBehavior.displayPrecision)} °C`
    : `${((temperature * 9) / 5 + 32).toFixed(firebaseSchema.temperatureBehavior.displayPrecision)} °F`;

  function goTo(step: 'site' | 'visit' | 'method' | 'measurements') {
    router.push({
      pathname: `/observation/[submissionId]/[revisionId]/${step}`,
      params: routeParams,
    });
  }

  function handleContractError(error: unknown) {
    if (!(error instanceof DraftContractError)) {
      Alert.alert(
        'Could not queue this observation',
        'The local draft is unchanged. Check the app state and try again.',
      );
      return;
    }
    const field = error instanceof DraftContractError ? error.message : '';
    const step = field.includes('site')
      ? 'site'
      : field.includes('collected') || field.includes('latitude') || field.includes('longitude') || field.includes('gps')
        ? 'visit'
        : field.includes('testType') || field.includes('method') || field.includes('instrument') || field.includes('dataCollected')
          ? 'method'
          : 'measurements';
    Alert.alert(
      'Observation is incomplete',
      field.includes('measurement')
        ? 'One or more measurement entries are missing or invalid. Review the values before continuing.'
        : 'A required field is missing or invalid. Return to the relevant workflow area and complete the entry.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Edit now', onPress: () => goTo(step) },
      ],
    );
  }

  function saveDraft() {
    try {
      saveDraftToFirestore(submissionId);
      setNotice('Draft saved on this device and queued for Firestore synchronization.');
    } catch (error) {
      handleContractError(error);
    }
  }

  function confirmSubmission() {
    Alert.alert(
      currentDraft.correction ? 'Resubmit this correction?' : 'Submit this observation?',
      'After submission, this scientific revision becomes read-only. Any later correction creates a new revision.',
      [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: currentDraft.correction ? 'Resubmit correction' : 'Submit observation',
          onPress: () => {
            try {
              submitObservation(submissionId);
              router.replace({
                pathname: '/submissions/[submissionId]',
                params: { submissionId },
              });
            } catch (error) {
              handleContractError(error);
            }
          },
        },
      ],
    );
  }

  return (
    <AppScreen edges={['right', 'bottom', 'left']} contentStyle={styles.content}>
      <ProgressHeader current="Review" />
      <ScreenIntro
        eyebrow={draft.correction ? 'CORRECTION REVISION' : 'FINAL CHECK'}
        title={draft.correction ? 'Review the correction' : 'Review the observation'}
        body="Confirm the recorded values, units, location, and provenance before submission."
      />

      <View style={styles.statusRow}>
        <SubmissionStatusChip status="DRAFT" />
        <SyncStatus
          onRetry={transport.status === 'failed' ? () => retrySync(submissionId) : undefined}
          status={transport.status}
        />
      </View>
      {transport.error ? <InlineAlert tone="danger" title={transport.error} /> : null}
      {notice ? <InlineAlert tone="success" title={notice} /> : null}

      <ReviewSection
        items={[
          { label: 'Site', value: draft.siteDisplayName ?? 'Saved sampling site' },
          { label: 'Site code', value: draft.siteCode ?? 'Available from site catalog' },
        ]}
        onEdit={() => goTo('site')}
        title="Site"
      />

      <ReviewSection
        items={[
          {
            label: 'Collected',
            value: Number.isFinite(collectedAt.getTime()) ? collectedFormatter.format(collectedAt) : 'Missing',
          },
          {
            label: 'Coordinates',
            value:
              draft.latitude != null && draft.longitude != null
                ? `${draft.latitude.toFixed(decimals)}, ${draft.longitude.toFixed(decimals)}`
                : 'Missing',
          },
          {
            label: 'Reported GPS accuracy',
            value: draft.gpsAccuracyM != null ? `±${Math.round(draft.gpsAccuracyM)} m` : 'Missing',
          },
        ]}
        onEdit={() => goTo('visit')}
        title="Visit"
      />

      <ReviewSection
        items={[
          { label: 'Test type', value: draft.testType === 'Other' ? draft.testTypeOther ?? 'Other' : draft.testType ?? 'Missing' },
          { label: 'Data collected by', value: draft.dataCollectedBy ?? 'Missing' },
          { label: 'Method', value: draft.methodName ?? 'Missing' },
          { label: 'Instrument / lab', value: draft.instrumentName ?? 'Missing' },
        ]}
        onEdit={() => goTo('method')}
        title="Method & provenance"
      />

      <ReviewSection
        items={[
          {
            label: 'Water temperature',
            value: `${draft.temperatureEnteredValueText || 'Missing'} °${draft.temperatureEnteredUnit ?? '—'}${Number.isFinite(temperature) && draft.temperatureEnteredUnit ? ` · ${derivedTemperature}` : ''}`,
          },
          ...draft.measurements
            .filter(({ valueText }) => valueText.trim())
            .map((measurement) => ({
              label: measurement.displayName,
              value: `${measurement.valueText} ${displayUnitForParameter(measurement.parameterCode)}`,
            })),
          { label: 'Field notes', value: draft.fieldNotes?.trim() || 'None' },
        ]}
        onEdit={() => goTo('measurements')}
        title="Measurements & notes"
      />

      <ReviewSection
        items={[
          { label: 'Revision', value: `${draft.revisionNo}${draft.correction ? ' · correction' : ''}` },
          { label: 'Workflow', value: 'Draft' },
          { label: 'Transport', value: transport.status.replace('-', ' ') },
        ]}
        title="Record state"
      />

      <InlineAlert
        tone="warning"
        title="Submission makes this revision read-only"
        body="The original science is preserved. A requested correction will create a new revision instead of overwriting this one."
      />

      <View style={styles.actions}>
        <PrimaryButton
          label={draft.correction ? 'Resubmit correction' : 'Submit observation'}
          onPress={confirmSubmission}
        />
        <SecondaryButton label="Save draft" onPress={saveDraft} />
        <SecondaryButton label="Return home" onPress={() => router.replace('/')} />
      </View>

      <Text style={[styles.privacy, { color: theme.textSecondary }]}>Attachments are not part of collector v1 and are intentionally not exposed.</Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.xl,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  actions: {
    gap: Spacing.sm,
  },
  privacy: {
    ...Typography.caption,
  },
});
