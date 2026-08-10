import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ReviewSection } from '@/components/observation/review-section';
import { ScreenIntro } from '@/components/ui/screen-intro';
import { InlineAlert, SubmissionStatusChip } from '@/components/ui/status';
import { AppScreen, EmptyState } from '@/components/ui/surface';
import type { RevisionDetail, ValidationFlag } from '@/domain/types';
import { displayUnitForParameter } from '@/features/observations/measurement-presentation';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';
import { trackScreenView } from '@/services/analytics';
import { listenRevisionDetail } from '@/services/firestore';

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
});

function scalar(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? '';
}

function flagTone(flag: ValidationFlag) {
  if (flag.severity === 'ERROR') return 'danger' as const;
  if (flag.severity === 'INFO') return 'info' as const;
  return 'warning' as const;
}

export default function RevisionDetailScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    submissionId?: string | string[];
    revisionId?: string | string[];
  }>();
  const submissionId = scalar(params.submissionId);
  const revisionId = scalar(params.revisionId);
  const [detail, setDetail] = useState<RevisionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void trackScreenView('revision_detail');
  }, []);

  useEffect(() => {
    if (!user || !submissionId || !revisionId) return undefined;
    return listenRevisionDetail(
      user.uid,
      submissionId,
      revisionId,
      (next) => {
        setDetail(next);
        setLoading(false);
        setError(null);
      },
      () => {
        setLoading(false);
        setError('Could not load this revision.');
      },
    );
  }, [revisionId, submissionId, user]);

  if (loading) {
    return (
      <AppScreen edges={['right', 'bottom', 'left']} contentStyle={styles.centered}>
        <ActivityIndicator color={theme.primary} />
        <Text accessibilityLiveRegion="polite" style={[styles.body, { color: theme.textSecondary }]}>Loading revision</Text>
      </AppScreen>
    );
  }

  if (error || !detail) {
    return (
      <AppScreen edges={['right', 'bottom', 'left']} contentStyle={styles.content}>
        <EmptyState
          icon="warning"
          title={error ?? 'Revision unavailable'}
          body="This revision may not exist or may not be readable by this collector account."
        />
      </AppScreen>
    );
  }

  const { revision } = detail;

  return (
    <AppScreen edges={['right', 'bottom', 'left']} contentStyle={styles.content}>
      <Stack.Screen options={{ title: `Revision ${revision.revisionNo}` }} />
      <ScreenIntro
        eyebrow="IMMUTABLE HISTORY"
        title={`Revision ${revision.revisionNo}`}
        body="This view presents the recorded scientific revision and its server-provided validation results."
      />
      <SubmissionStatusChip status={revision.status} />
      {detail.metadata.revision.fromCache ? (
        <InlineAlert tone="info" title="Showing saved offline revision data" />
      ) : null}

      {detail.validationFlags.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Validation results</Text>
          {[...detail.validationFlags]
            .sort((left, right) => (left.severity === 'ERROR' ? -1 : right.severity === 'ERROR' ? 1 : 0))
            .map((flag) => (
              <InlineAlert
                key={flag.flagId}
                tone={flagTone(flag)}
                title={flag.message}
                body={`${flag.severity.replaceAll('_', ' ')} · ${flag.ruleCode}`}
              />
            ))}
        </View>
      ) : null}

      <ReviewSection
        items={[
          { label: 'Revision status', value: revision.status === 'SUBMITTED' ? 'Submitted · read-only' : 'Draft' },
          { label: 'Collected', value: dateTimeFormatter.format(revision.collectedAt) },
          { label: 'Coordinates', value: `${revision.latitude.toFixed(5)}, ${revision.longitude.toFixed(5)}` },
          { label: 'Reported accuracy', value: `±${Math.round(revision.gpsAccuracyM)} m` },
        ]}
        title="Visit"
      />
      <ReviewSection
        items={[
          { label: 'Test type', value: revision.testType === 'Other' ? revision.testTypeOther ?? 'Other' : revision.testType },
          { label: 'Data collected by', value: revision.dataCollectedBy },
          { label: 'Method', value: revision.methodName },
          { label: 'Instrument / lab', value: revision.instrumentName },
        ]}
        title="Method & provenance"
      />
      <ReviewSection
        items={[
          {
            label: 'Water temperature',
            value: `${revision.temperatureEnteredValue} °${revision.temperatureEnteredUnit} · ${revision.temperatureEnteredUnit === 'C' ? `${revision.temperatureF.toFixed(2)} °F` : `${revision.temperatureC.toFixed(2)} °C`}`,
          },
          ...detail.measurements.map((measurement) => ({
            label: measurement.displayName,
            value: `${measurement.value} ${displayUnitForParameter(measurement.parameterCode)}`,
          })),
          { label: 'Field notes', value: revision.fieldNotes?.trim() || 'None' },
        ]}
        title="Measurements & notes"
      />
      <InlineAlert
        tone="info"
        title={revision.status === 'SUBMITTED' ? 'This revision is read-only' : 'This is a draft revision'}
        body="Submitted science is never silently overwritten; corrections appear as a newer revision."
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.xl,
  },
  centered: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  body: {
    ...Typography.body,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.sectionTitle,
  },
});
