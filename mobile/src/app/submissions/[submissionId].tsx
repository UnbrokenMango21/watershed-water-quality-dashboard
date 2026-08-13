import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ReviewSection } from '@/components/observation/review-section';
import { PrimaryButton, SecondaryButton } from '@/components/ui/button';
import { ScreenIntro } from '@/components/ui/screen-intro';
import { InlineAlert, SubmissionStatusChip, SyncStatus } from '@/components/ui/status';
import { AppScreen, EmptyState } from '@/components/ui/surface';
import type { SubmissionDetail, ValidationFlag } from '@/domain/types';
import { displayUnitForParameter } from '@/features/observations/measurement-presentation';
import { Radii, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';
import { useCollectorData } from '@/providers/collector-data-provider';
import { useDrafts } from '@/providers/draft-provider';
import { trackScreenView } from '@/services/analytics';
import { listenSubmissionDetail } from '@/services/firestore';

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

const severityOrder: Record<ValidationFlag['severity'], number> = {
  ERROR: 0,
  PLAUSIBILITY_WARNING: 1,
  ENVIRONMENTAL_ALERT: 2,
  INFO: 3,
};

export default function SubmissionDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { catalog } = useCollectorData();
  const {
    createCorrectionDraft,
    getDraft,
    restoreFirestoreDraft,
    retrySync,
    transportFor,
  } = useDrafts();
  const params = useLocalSearchParams<{ submissionId?: string | string[] }>();
  const submissionId = scalar(params.submissionId);
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    void trackScreenView('submission_detail');
  }, []);

  useEffect(() => {
    if (!user || !submissionId) return undefined;
    const stop = listenSubmissionDetail(
      user.uid,
      submissionId,
      (next) => {
        setDetail(next);
        setLoading(false);
        setError(null);
      },
      () => {
        setLoading(false);
        setError('Could not load this submission.');
      },
    );
    return stop;
  }, [retryKey, submissionId, user]);

  if (loading) {
    return (
      <AppScreen edges={['right', 'bottom', 'left']} contentStyle={styles.centered}>
        <ActivityIndicator color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading submission</Text>
      </AppScreen>
    );
  }

  if (error || !detail) {
    return (
      <AppScreen edges={['right', 'bottom', 'left']} contentStyle={styles.content}>
        <Stack.Screen options={{ title: 'Submission' }} />
        <EmptyState
          icon="warning"
          title={error ?? 'Submission unavailable'}
          body="The record may still be queued locally or unavailable to this collector account."
        />
        <SecondaryButton label="Retry loading" onPress={() => setRetryKey((value) => value + 1)} />
        <PrimaryButton label="Return home" onPress={() => router.replace('/')} />
      </AppScreen>
    );
  }

  const { submission, revision } = detail;
  const currentDetail = detail;
  const site = catalog.sites.find(({ siteId }) => siteId === submission.siteId);
  const localDraft = getDraft(submissionId);
  const localTransport = localDraft ? transportFor(submissionId) : null;
  const hasPendingWrites = [
    detail.metadata.submission,
    detail.metadata.revision,
    detail.metadata.revisionHistory,
    detail.metadata.measurements,
    detail.metadata.validationFlags,
  ].some((metadata) => metadata?.hasPendingWrites);
  const transportStatus = localTransport?.status ?? (hasPendingWrites ? 'syncing' : 'synced');
  const sortedFlags = [...detail.validationFlags].sort(
    (left, right) => severityOrder[left.severity] - severityOrder[right.severity],
  );

  async function openCorrection() {
    try {
      const draft = localDraft?.correction
        ? localDraft
        : await createCorrectionDraft(
            currentDetail,
            site ? { displayName: site.displayName, siteCode: site.siteCode } : undefined,
          );
      router.push({
        pathname: '/observation/[submissionId]/[revisionId]/site',
        params: { submissionId: draft.submissionId, revisionId: draft.revisionId },
      });
    } catch {
      Alert.alert('Could not create correction', 'This record is not currently eligible for a collector correction.');
    }
  }

  async function restoreDraft() {
    try {
      const draft = localDraft ?? await restoreFirestoreDraft(
        currentDetail,
        site ? { displayName: site.displayName, siteCode: site.siteCode } : undefined,
      );
      router.push({
        pathname: '/observation/[submissionId]/[revisionId]/review',
        params: { submissionId: draft.submissionId, revisionId: draft.revisionId },
      });
    } catch {
      Alert.alert('Could not restore draft', 'This revision is not editable or could not be saved on this device.');
    }
  }

  return (
    <AppScreen edges={['right', 'bottom', 'left']} contentStyle={styles.content}>
      <Stack.Screen options={{ title: `Submission · Revision ${submission.currentRevisionNo}` }} />
      <ScreenIntro
        eyebrow="COLLECTOR RECORD"
        title={site?.displayName ?? 'Sampling observation'}
        body={site ? `Site ${site.siteCode}` : 'Mobile-safe site details are unavailable in the current catalog.'}
      />

      <View style={styles.statusRow}>
        <SubmissionStatusChip status={submission.status} />
        <SyncStatus
          onRetry={localTransport?.status === 'failed' ? () => retrySync(submissionId) : undefined}
          status={transportStatus}
        />
      </View>
      {localTransport?.error ? <InlineAlert tone="danger" title={localTransport.error} /> : null}
      {detail.metadata.submission.fromCache ? (
        <InlineAlert
          tone="info"
          title="Showing saved offline data"
          body="Workflow status will refresh when Firestore reconnects."
        />
      ) : null}

      {submission.reviewComment ? (
        <InlineAlert
          tone={submission.status === 'NEEDS_CORRECTION' ? 'danger' : 'info'}
          title="Reviewer comment"
          body={submission.reviewComment}
        />
      ) : null}

      {submission.status === 'VALIDATING' && submission.overallQualityScore == null ? (
        <InlineAlert
          tone="info"
          title="Automated validation is in progress"
          body="Confidence scoring and validation flags will appear when server validation completes."
        />
      ) : null}

      {submission.overallQualityScore != null ? (
        <View style={styles.section}>
          <ReviewSection
            items={[
              { label: 'Overall data confidence', value: `${submission.overallQualityScore.toFixed(0)} / 100` },
              { label: 'Blocking errors', value: String(submission.errorFlagCount) },
              { label: 'Warnings', value: String(submission.warningFlagCount) },
              { label: 'Information flags', value: String(submission.infoFlagCount) },
              ...(submission.validationRulesVersion
                ? [{ label: 'Validation rules', value: submission.validationRulesVersion }]
                : []),
            ]}
            title="Data confidence"
          />
          <InlineAlert
            tone="info"
            title="Confidence is not water health"
            body="This server-generated score describes confidence in the submitted data. It does not grade stream health or suppress scientifically possible environmental anomalies."
          />
        </View>
      ) : null}

      {sortedFlags.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Validation results</Text>
          {sortedFlags.map((flag) => (
            <InlineAlert
              key={flag.flagId}
              tone={flagTone(flag)}
              title={flag.message}
              body={`${flag.severity.replaceAll('_', ' ')} · ${flag.ruleCode}`}
            />
          ))}
        </View>
      ) : null}

      {revision ? (
        <>
          <ReviewSection
            items={[
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
            title="Collection Method"
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
        </>
      ) : (
        <InlineAlert tone="warning" title="Current revision is not available yet" />
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Revision history</Text>
        <View style={styles.timeline}>
          {detail.revisionHistory.map((item, index) => (
            <Pressable
              key={item.revisionId}
              accessibilityRole="button"
              accessibilityLabel={`Revision ${item.revisionNo}, ${item.status === 'SUBMITTED' ? 'read-only scientific revision' : 'editable draft revision'}, ${dateTimeFormatter.format(item.createdAt)}`}
              accessibilityHint="Opens this revision"
              onPress={() =>
                router.push({
                  pathname: '/submissions/[submissionId]/revisions/[revisionId]',
                  params: { submissionId, revisionId: item.revisionId },
                })
              }
              style={({ pressed }) => [
                styles.timelineRow,
                { backgroundColor: pressed ? theme.secondaryPressed : 'transparent' },
              ]}>
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.timelineRail}>
                <View
                  style={[
                    styles.timelineNode,
                    {
                      backgroundColor: item.status === 'SUBMITTED' ? theme.primary : theme.surface,
                      borderColor: item.status === 'SUBMITTED' ? theme.primary : theme.controlBorder,
                    },
                  ]}
                />
                {index < detail.revisionHistory.length - 1 || submission.status === 'NEEDS_CORRECTION' ? (
                  <View style={[styles.timelineLine, { backgroundColor: theme.border }]} />
                ) : null}
              </View>
              <View style={styles.timelineCopy}>
                <View style={styles.timelineHeading}>
                  <Text style={[styles.timelineTitle, { color: theme.textPrimary }]}>Revision {item.revisionNo}</Text>
                  <SubmissionStatusChip status={item.status} />
                </View>
                <Text style={[styles.timelineBody, { color: theme.textSecondary }]}>
                  {item.status === 'SUBMITTED' ? 'Read-only scientific revision' : 'Editable draft revision'}
                </Text>
                <Text style={[styles.timelineMeta, { color: theme.textMuted }]}>{dateTimeFormatter.format(item.createdAt)}</Text>
              </View>
            </Pressable>
          ))}

          {submission.status === 'NEEDS_CORRECTION' ? (
            <View accessibilityLabel="Next correction revision" style={styles.timelineRow}>
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.timelineRail}>
                <View
                  style={[
                    styles.timelineNode,
                    styles.timelineNodeHollow,
                    { borderColor: theme.danger, backgroundColor: 'transparent' },
                  ]}
                />
              </View>
              <View style={styles.timelineCopy}>
                <Text style={[styles.timelineTitle, { color: localDraft?.correction ? theme.primary : theme.textSecondary }]}>
                  Revision {localDraft?.correction ? localDraft.revisionNo : submission.currentRevisionNo + 1}
                </Text>
                <Text style={[styles.timelineBody, { color: theme.textSecondary }]}>
                  {localDraft?.correction ? 'Correction draft on this device' : 'Correction revision not started'}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      </View>

      {submission.status === 'NEEDS_CORRECTION' ? (
        <PrimaryButton
          label={localDraft?.correction ? 'Resume correction revision' : 'Create correction revision'}
          onPress={() => void openCorrection()}
        />
      ) : submission.status === 'DRAFT' ? (
        <PrimaryButton
          label={localDraft ? 'Resume observation draft' : 'Restore draft to this device'}
          onPress={() => void restoreDraft()}
        />
      ) : null}

      <Text style={[styles.readOnly, { color: theme.textSecondary }]}>Submitted revisions are read-only. Attachments are intentionally not exposed in collector v1.</Text>
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
  loadingText: {
    ...Typography.body,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.sectionTitle,
  },
  timeline: {
    gap: 0,
  },
  timelineRow: {
    minHeight: 76,
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  timelineRail: {
    width: 18,
    alignItems: 'center',
    paddingTop: 8,
  },
  timelineNode: {
    width: 12,
    height: 12,
    borderRadius: Radii.pill,
    borderWidth: 2,
  },
  timelineNodeHollow: {
    borderWidth: 2,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 48,
  },
  timelineCopy: {
    flex: 1,
    paddingBottom: Spacing.md,
    gap: Spacing.xxs,
  },
  timelineHeading: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  timelineTitle: {
    ...Typography.bodyStrong,
  },
  timelineBody: {
    ...Typography.helper,
  },
  timelineMeta: {
    ...Typography.caption,
    fontVariant: ['tabular-nums'],
  },
  readOnly: {
    ...Typography.caption,
  },
});
