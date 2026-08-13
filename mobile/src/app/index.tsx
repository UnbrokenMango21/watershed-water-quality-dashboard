import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppIcon, type AppIconName } from '@/components/ui/app-icon';
import { PrimaryButton } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { InlineAlert, SubmissionStatusChip, SyncStatus } from '@/components/ui/status';
import { AppScreen } from '@/components/ui/surface';
import { minimumMeasurementCountFor, requiredMeasurementsFor } from '@/config/contracts';
import type { PartialObservationDraft } from '@/domain/types';
import { numericTextIsFinite } from '@/features/observations/measurement-presentation';
import { Radii, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCollectorData } from '@/providers/collector-data-provider';
import { useDrafts } from '@/providers/draft-provider';
import { trackProductEvent, trackScreenView } from '@/services/analytics';

type DraftStep = 'site' | 'visit' | 'method' | 'measurements' | 'review';

function nextStepForDraft(draft: PartialObservationDraft): DraftStep {
  if (!draft.siteId) return 'site';
  if (
    !draft.collectedAt ||
    !Number.isFinite(draft.latitude) ||
    !Number.isFinite(draft.longitude) ||
    !Number.isFinite(draft.gpsAccuracyM)
  ) {
    return 'visit';
  }
  if (
    !draft.testType ||
    !draft.dataCollectedBy?.trim() ||
    !draft.methodName?.trim() ||
    !draft.instrumentName?.trim() ||
    (draft.testType === 'Other' && !draft.testTypeOther?.trim())
  ) {
    return 'method';
  }
  const validCodes = new Set(
    draft.measurements
      .filter(({ valueText }) => numericTextIsFinite(valueText))
      .map(({ parameterCode }) => parameterCode),
  );
  const hasInvalidMeasurement = draft.measurements.some(
    ({ valueText }) => valueText.trim().length > 0 && !numericTextIsFinite(valueText),
  );
  const requiredMissing = requiredMeasurementsFor(draft.testType).some(
    (code) => !validCodes.has(code),
  );
  if (
    !draft.temperatureEnteredUnit ||
    !numericTextIsFinite(draft.temperatureEnteredValueText ?? '') ||
    hasInvalidMeasurement ||
    requiredMissing ||
    validCodes.size < minimumMeasurementCountFor(draft.testType)
  ) {
    return 'measurements';
  }
  return 'review';
}

const stepLabels: Record<DraftStep, string> = {
  site: 'Select Site',
  visit: 'Visit Details',
  method: 'Collection Method',
  measurements: 'Measurements',
  review: 'Review',
};

const recentFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { catalog, recent, refreshSites } = useCollectorData();
  const {
    createDraft,
    drafts,
    loading: draftsLoading,
    retrySync,
    transportFor,
    unreadableDraftCount,
  } = useDrafts();
  const [starting, setStarting] = useState(false);
  const canStart = catalog.sites.length > 0 && (catalog.source === 'server' || catalog.source === 'cached');
  const draftIds = new Set(drafts.map(({ submissionId }) => submissionId));
  const correctionRecords = recent.submissions.filter(
    ({ status, submissionId }) => status === 'NEEDS_CORRECTION' && !draftIds.has(submissionId),
  );
  const recentRecords = recent.submissions.filter(
    ({ status, submissionId }) => status !== 'NEEDS_CORRECTION' && !draftIds.has(submissionId),
  );

  useEffect(() => {
    void trackScreenView('home');
  }, []);

  function openDraft(draft: PartialObservationDraft) {
    void trackProductEvent('draft_resumed');
    const step = nextStepForDraft(draft);
    const params = { submissionId: draft.submissionId, revisionId: draft.revisionId };
    if (step === 'site') router.push({ pathname: '/observation/[submissionId]/[revisionId]/site', params });
    if (step === 'visit') router.push({ pathname: '/observation/[submissionId]/[revisionId]/visit', params });
    if (step === 'method') router.push({ pathname: '/observation/[submissionId]/[revisionId]/method', params });
    if (step === 'measurements') router.push({ pathname: '/observation/[submissionId]/[revisionId]/measurements', params });
    if (step === 'review') router.push({ pathname: '/observation/[submissionId]/[revisionId]/review', params });
  }

  async function startObservation() {
    setStarting(true);
    try {
      const draft = await createDraft();
      router.push({
        pathname: '/observation/[submissionId]/[revisionId]/site',
        params: { submissionId: draft.submissionId, revisionId: draft.revisionId },
      });
    } catch {
      Alert.alert('Could not create draft', 'The app could not save a new draft on this device. Try again.');
    } finally {
      setStarting(false);
    }
  }

  const catalogState: { label: string; color: string; icon: AppIconName } =
    catalog.source === 'loading'
      ? { label: 'Loading sites', color: theme.textSecondary, icon: 'sync' }
      : catalog.source === 'cached'
        ? {
            label: `Offline · ${catalog.sites.length} saved ${catalog.sites.length === 1 ? 'site' : 'sites'}`,
            color: theme.info,
            icon: 'cloud',
          }
        : catalog.source === 'server'
          ? {
              label: `${catalog.sites.length} ${catalog.sites.length === 1 ? 'site' : 'sites'} ready`,
              color: theme.success,
              icon: 'check',
            }
          : catalog.source === 'empty'
            ? { label: 'No active sites', color: theme.warning, icon: 'warning' }
            : { label: 'Site catalog unavailable', color: theme.danger, icon: 'warning' };

  return (
    <AppScreen
      contentStyle={styles.content}
      refreshControl={
        <RefreshControl
          colors={[theme.primary]}
          onRefresh={() => void refreshSites()}
          refreshing={catalog.refreshing}
          tintColor={theme.primary}
        />
      }>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.product, { color: theme.brand }]}>CENTRAL PA WATERSHED</Text>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.textPrimary }]}>Fieldwork</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Collector account"
          accessibilityHint="Opens account and sign-out controls"
          onPress={() => router.push('/account')}
          style={({ pressed }) => [
            styles.accountButton,
            { backgroundColor: pressed ? theme.secondaryPressed : theme.surface },
          ]}>
          <AppIcon name="person" color={theme.brand} size={23} />
        </Pressable>
      </View>

      <View style={styles.primaryWork}>
        <PrimaryButton
          disabled={!canStart}
          icon="plus"
          label="Start New Observation"
          loading={starting}
          loadingLabel="Creating Observation"
          onPress={() => void startObservation()}
          style={styles.startButton}
        />
        <View style={styles.catalogRow}>
          <View accessible accessibilityLabel={catalogState.label} style={styles.catalogStatus}>
            {catalog.refreshing ? (
              <ActivityIndicator color={catalogState.color} size="small" />
            ) : (
              <AppIcon name={catalogState.icon} color={catalogState.color} size={16} />
            )}
            <Text style={[styles.catalogText, { color: catalogState.color }]}>{catalogState.label}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh sites"
            disabled={catalog.refreshing}
            onPress={() => void refreshSites()}
            style={({ pressed }) => [
              styles.refreshAction,
              { backgroundColor: pressed ? theme.secondaryPressed : 'transparent' },
            ]}>
            <Text style={[styles.refreshText, { color: catalog.refreshing ? theme.disabledText : theme.primary }]}>Refresh</Text>
          </Pressable>
        </View>
        {catalog.error ? <InlineAlert tone="warning" title={catalog.error} /> : null}
        {!canStart && catalog.source !== 'loading' ? (
          <Text style={[styles.unavailable, { color: theme.textSecondary }]}>A saved or online site catalog is required.</Text>
        ) : null}
      </View>

      {unreadableDraftCount > 0 ? (
        <InlineAlert
          tone="danger"
          title="A saved draft could not be read"
          body="Other drafts remain available. Do not clear app data; contact support before collecting more at the affected site."
        />
      ) : null}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Continue Field Work</Text>
        <View style={[styles.workList, { borderTopColor: theme.border, borderBottomColor: theme.border }]}>
          {draftsLoading ? (
            <View accessibilityLiveRegion="polite" style={styles.loadingRow}>
              <ActivityIndicator color={theme.primary} />
              <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading saved work</Text>
            </View>
          ) : null}
          {correctionRecords.map((submission) => (
            <ListRow
              key={`correction-${submission.submissionId}`}
              meta={`Revision ${submission.currentRevisionNo} · ${recentFormatter.format(submission.latestCollectedAt)}`}
              onPress={() =>
                router.push({
                  pathname: '/submissions/[submissionId]',
                  params: { submissionId: submission.submissionId },
                })
              }
              subtitle="Correction Requested"
              title={catalog.sites.find(({ siteId }) => siteId === submission.siteId)?.displayName ?? 'Sampling Site'}
              trailing={<SubmissionStatusChip status={submission.status} />}
            />
          ))}
          {drafts.map((draft) => {
            const transport = transportFor(draft.submissionId);
            const step = nextStepForDraft(draft);
            return (
              <ListRow
                key={`${draft.submissionId}-${draft.revisionId}`}
                meta={`Updated ${recentFormatter.format(new Date(draft.updatedAt))} · Revision ${draft.revisionNo}`}
                onPress={() => openDraft(draft)}
                subtitle={`Continue: ${stepLabels[step]}`}
                title={draft.siteDisplayName ?? draft.siteCode ?? (draft.correction ? 'Correction Draft' : 'New Observation')}
                trailing={
                  <SyncStatus
                    onRetry={transport.status === 'failed' ? () => retrySync(draft.submissionId) : undefined}
                    status={transport.status}
                  />
                }
              />
            );
          })}
          {!draftsLoading && drafts.length === 0 && correctionRecords.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No field work in progress.</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeadingRow}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Recent</Text>
          {recent.source === 'cached' ? (
            <View accessible accessibilityLabel="Showing offline cache" style={styles.offlineLabel}>
              <AppIcon name="cloud" color={theme.info} size={14} />
              <Text style={[styles.offlineText, { color: theme.info }]}>Offline Cache</Text>
            </View>
          ) : null}
        </View>
        <View style={[styles.workList, { borderTopColor: theme.border, borderBottomColor: theme.border }]}>
          {recent.source === 'loading' ? (
            <View accessibilityLiveRegion="polite" style={styles.loadingRow}>
              <ActivityIndicator color={theme.primary} />
              <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading recent work</Text>
            </View>
          ) : null}
          {recentRecords.map((submission) => (
            <ListRow
              key={submission.submissionId}
              meta={`Revision ${submission.currentRevisionNo} · ${recentFormatter.format(submission.latestCollectedAt)}`}
              onPress={() =>
                router.push({
                  pathname: '/submissions/[submissionId]',
                  params: { submissionId: submission.submissionId },
                })
              }
              subtitle={submission.status === 'DRAFT' ? 'Saved Observation' : 'Observation'}
              title={catalog.sites.find(({ siteId }) => siteId === submission.siteId)?.displayName ?? 'Sampling Site'}
              trailing={<SubmissionStatusChip status={submission.status} />}
            />
          ))}
          {recent.source !== 'loading' && recentRecords.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No recent observations.</Text>
          ) : null}
        </View>
        {recent.error ? <InlineAlert tone="warning" title={recent.error} /> : null}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Spacing.lg,
    gap: Spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  headerCopy: {
    flex: 1,
    gap: Spacing.xxs,
  },
  product: {
    ...Typography.eyebrow,
  },
  title: {
    ...Typography.screenTitle,
  },
  accountButton: {
    width: 48,
    height: 48,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryWork: {
    gap: Spacing.sm,
  },
  startButton: {
    minHeight: 62,
  },
  catalogRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  catalogStatus: {
    flex: 1,
    minWidth: 180,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  catalogText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  refreshAction: {
    minHeight: 48,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshText: {
    ...Typography.label,
  },
  unavailable: {
    ...Typography.helper,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionHeadingRow: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.sectionTitle,
  },
  workList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  loadingRow: {
    minHeight: 72,
    paddingHorizontal: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    ...Typography.helper,
  },
  emptyText: {
    ...Typography.body,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xl,
  },
  offlineLabel: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
  },
  offlineText: {
    ...Typography.caption,
    fontWeight: '600',
  },
});
