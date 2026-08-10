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

import { BrandMark } from '@/components/brand-mark';
import { AppIcon } from '@/components/ui/app-icon';
import { PrimaryButton, SecondaryButton } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { InlineAlert, StatusChip, SubmissionStatusChip, SyncStatus } from '@/components/ui/status';
import { AppScreen, EmptyState } from '@/components/ui/surface';
import { minimumMeasurementCountFor, requiredMeasurementsFor } from '@/config/contracts';
import type { PartialObservationDraft } from '@/domain/types';
import { numericTextIsFinite } from '@/features/observations/measurement-presentation';
import { Radii, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';
import { useCollectorData } from '@/providers/collector-data-provider';
import { useDrafts } from '@/providers/draft-provider';
import { trackProductEvent, trackScreenView } from '@/services/analytics';

function greetingForCurrentTime() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function initialsForEmail(email: string | null | undefined) {
  const localPart = email?.split('@')[0]?.trim();
  if (!localPart) return 'FC';
  const chunks = localPart.split(/[._-]+/).filter(Boolean);
  if (chunks.length >= 2) return `${chunks[0][0]}${chunks[1][0]}`.toUpperCase();
  return localPart.slice(0, 2).toUpperCase();
}

function nextStepForDraft(draft: PartialObservationDraft) {
  if (!draft.siteId) return 'site' as const;
  if (
    !draft.collectedAt ||
    !Number.isFinite(draft.latitude) ||
    !Number.isFinite(draft.longitude) ||
    !Number.isFinite(draft.gpsAccuracyM)
  ) {
    return 'visit' as const;
  }
  if (
    !draft.testType ||
    !draft.dataCollectedBy?.trim() ||
    !draft.methodName?.trim() ||
    !draft.instrumentName?.trim() ||
    (draft.testType === 'Other' && !draft.testTypeOther?.trim())
  ) {
    return 'method' as const;
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
    return 'measurements' as const;
  }
  return 'review' as const;
}

const recentFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
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
  const greeting = greetingForCurrentTime();
  const initials = initialsForEmail(user?.email);
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

  const catalogCopy = catalog.source === 'loading'
    ? 'Loading sites'
    : catalog.source === 'cached'
      ? `Offline — using ${catalog.sites.length} saved ${catalog.sites.length === 1 ? 'site' : 'sites'}`
      : catalog.source === 'server'
        ? `${catalog.sites.length} active ${catalog.sites.length === 1 ? 'site' : 'sites'} available`
        : catalog.source === 'empty'
          ? 'No active sites available'
          : 'Site catalog unavailable';

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
        <View style={styles.headerIdentity}>
          <BrandMark size="small" />
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: theme.brand }]}>CENTRAL PA WATERSHED</Text>
            <Text style={[styles.greeting, { color: theme.textSecondary }]}>{greeting}</Text>
            <Text accessibilityRole="header" style={[styles.title, { color: theme.textPrimary }]}>Field Collection</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Collector account"
          accessibilityHint="Opens collector identity and sign-out controls"
          onPress={() => router.push('/account')}
          style={({ pressed }) => [
            styles.avatar,
            {
              backgroundColor: pressed ? theme.secondaryPressed : theme.surface,
              borderColor: theme.controlBorder,
            },
          ]}>
          <Text style={[styles.avatarText, { color: theme.brand }]}>{initials}</Text>
        </Pressable>
      </View>

      <View style={[styles.startSection, { borderColor: theme.border }]}>
        <View style={styles.startHeader}>
          <View style={[styles.startIcon, { backgroundColor: theme.primarySoft }]}>
            <AppIcon name="plus" color={theme.primary} size={22} />
          </View>
          <View style={styles.startCopy}>
            <Text style={[styles.startTitle, { color: theme.textPrimary }]}>New observation</Text>
            <Text style={[styles.startBody, { color: theme.textSecondary }]}>Site, visit, method, measurements, and review.</Text>
          </View>
        </View>
        <View style={styles.catalogState}>
          <StatusChip
            icon={catalog.source === 'server' ? 'check' : catalog.source === 'cached' ? 'cloud' : 'info'}
            label={catalogCopy}
            tone={catalog.source === 'error' || catalog.source === 'empty' ? 'warning' : catalog.source === 'server' ? 'success' : 'info'}
          />
          <SecondaryButton
            label={catalog.refreshing ? 'Refreshing' : 'Refresh sites'}
            loading={catalog.refreshing}
            onPress={() => void refreshSites()}
          />
        </View>
        {catalog.error ? <InlineAlert tone="warning" title={catalog.error} /> : null}
        <PrimaryButton
          disabled={!canStart}
          label="Start observation"
          loading={starting}
          loadingLabel="Creating draft"
          onPress={() => void startObservation()}
        />
        {!canStart ? (
          <Text style={[styles.helper, { color: theme.textSecondary }]}>A valid site catalog is required before collection can begin.</Text>
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
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Continue field work</Text>
        {draftsLoading ? (
          <View accessibilityLiveRegion="polite" style={styles.loadingRow}>
            <ActivityIndicator color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading saved field work</Text>
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
            subtitle="Reviewer or validation feedback requires a new revision"
            title="Correction requested"
            trailing={<SubmissionStatusChip status={submission.status} />}
          />
        ))}
        {drafts.map((draft) => {
          const transport = transportFor(draft.submissionId);
          return (
            <ListRow
              key={`${draft.submissionId}-${draft.revisionId}`}
              meta={`Revision ${draft.revisionNo} · updated ${recentFormatter.format(new Date(draft.updatedAt))}`}
              onPress={() => openDraft(draft)}
              subtitle={draft.siteCode ? `Site ${draft.siteCode}` : 'Site not selected'}
              title={draft.correction ? draft.siteDisplayName ?? 'Correction draft' : draft.siteDisplayName ?? 'New observation draft'}
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
          <EmptyState
            icon="clipboard"
            title="No field work in progress"
            body="Start an observation or open a requested correction when one appears."
          />
        ) : null}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeadingRow}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Recent submissions</Text>
          {recent.source === 'cached' ? <StatusChip icon="cloud" label="Offline cache" tone="info" /> : null}
        </View>
        {recent.source === 'loading' ? (
          <View accessibilityLiveRegion="polite" style={styles.loadingRow}>
            <ActivityIndicator color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading recent submissions</Text>
          </View>
        ) : null}
        {recent.error ? <InlineAlert tone="warning" title={recent.error} /> : null}
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
            subtitle={catalog.sites.find(({ siteId }) => siteId === submission.siteId)?.displayName ?? 'Sampling site'}
            title={submission.status === 'DRAFT' ? 'Saved observation draft' : 'Submitted observation'}
            trailing={<SubmissionStatusChip status={submission.status} />}
          />
        ))}
        {recent.source !== 'loading' && recentRecords.length === 0 ? (
          <EmptyState
            icon="clipboard"
            title="No recent submissions"
            body="Server-backed drafts and submitted observations will appear here with workflow status."
          />
        ) : null}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Spacing.xl,
    gap: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  headerIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  headerCopy: {
    flex: 1,
    gap: 1,
  },
  eyebrow: {
    ...Typography.eyebrow,
    marginBottom: Spacing.xxs,
  },
  greeting: {
    ...Typography.helper,
  },
  title: {
    ...Typography.screenTitle,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: Radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  startSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
  },
  startHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  startIcon: {
    width: 48,
    height: 48,
    borderRadius: Radii.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startCopy: {
    flex: 1,
    gap: Spacing.xxs,
  },
  startTitle: {
    ...Typography.sectionTitle,
  },
  startBody: {
    ...Typography.helper,
  },
  catalogState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  helper: {
    ...Typography.helper,
  },
  loadingRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    ...Typography.helper,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionHeadingRow: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.sectionTitle,
  },
});
