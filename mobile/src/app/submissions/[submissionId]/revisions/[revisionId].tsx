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
          body="Return to the submission and try again when the record is available."
        />
      </AppScreen>
    );
  }

  const revision = detail.revision;
  const flags = [...detail.validationFlags].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  const transportFromCache =
    detail.metadata.revision.fromCache ||
    detail.metadata.measurements.fromCache ||
    detail.metadata.validationFlags.fromCache;

  return (
    <AppScreen edges={['right', 'bottom', 'left']} contentStyle={styles.content}>
      <Stack.Screen options={{ title: `Revision ${revision.revisionNo}` }} />
      <ScreenIntro
        eyebrow="IMMUTABLE RECORD"
        title={`Revision ${revision.revisionNo}`}
        body="This submitted science is read-only. Corrections create a new revision instead of replacing this record."
      />

      <View style={styles.statusRow}>
        <SubmissionStatusChip status={revision.status} />
        {transportFromCache ? <InlineAlert tone="info" title="Showing cached record" /> : null}
      </View>

      <ReviewSection title="Visit">
        <Text style={[styles.body, { color: theme.textPrimary }]}>{dateTimeFormatter.format(revision.collectedAt)}</Text>
        <Text style={[styles.body, { color: theme.textSecondary }]}>Site ID {revision.siteId}</Text>
      </ReviewSection>

      <ReviewSection title="Method & provenance">
        <Text style={[styles.body, { color: theme.textPrimary }]}>{revision.testType}</Text>
        <Text style={[styles.body, { color: theme.textSecondary }]}>{revision.methodName}</Text>
        <Text style={[styles.body, { color: theme.textSecondary }]}>{revision.instrumentName}</Text>
      </ReviewSection>

      <ReviewSection title="Measurements">
        {detail.measurements.map((measurement) => (
          <View key={measurement.measurementId} style={styles.measurementRow}>
            <Text style={[styles.measurementLabel, { color: theme.textPrimary }]}>{measurement.displayName}</Text>
            <Text style={[styles.measurementValue, { color: theme.textPrimary }]}>
              {measurement.value} {displayUnitForParameter(measurement.parameterCode, measurement.unitCode)}
            </Text>
          </View>
        ))}
      </ReviewSection>

      {revision.fieldNotes ? (
        <ReviewSection title="Field notes">
          <Text style={[styles.body, { color: theme.textPrimary }]}>{revision.fieldNotes}</Text>
        </ReviewSection>
      ) : null}

      {flags.length > 0 ? (
        <ReviewSection title="Validation messages">
          {flags.map((flag) => (
            <InlineAlert
              key={flag.flagId}
              tone={flagTone(flag)}
              title={flag.message}
              body={flag.ruleCode ? `Rule ${flag.ruleCode}` : undefined}
            />
          ))}
        </ReviewSection>
      ) : null}
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
  statusRow: {
    gap: Spacing.sm,
  },
  measurementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: Spacing.md,
  },
  measurementLabel: {
    ...Typography.body,
    flex: 1,
  },
  measurementValue: {
    ...Typography.bodyStrong,
    fontVariant: ['tabular-nums'],
  },
});