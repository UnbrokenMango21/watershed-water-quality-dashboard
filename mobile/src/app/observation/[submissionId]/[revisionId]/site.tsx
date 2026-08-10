import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { DraftGate } from '@/components/observation/draft-gate';
import { ProgressHeader } from '@/components/observation/progress-header';
import { PrimaryButton, SecondaryButton } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { ScreenIntro } from '@/components/ui/screen-intro';
import { InlineAlert } from '@/components/ui/status';
import { AppScreen, EmptyState } from '@/components/ui/surface';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useObservationDraft } from '@/hooks/use-observation-draft';
import { useCollectorData } from '@/providers/collector-data-provider';
import { trackScreenView } from '@/services/analytics';

export default function SiteStep() {
  const theme = useTheme();
  const router = useRouter();
  const { catalog, refreshSites } = useCollectorData();
  const { draft, loading, routeParams, submissionId, updateDraft } = useObservationDraft();

  useEffect(() => {
    void trackScreenView('site');
  }, []);

  if (!draft) return <DraftGate loading={loading} />;

  const selectedAvailable = draft.siteId
    ? catalog.sites.some(({ siteId }) => siteId === draft.siteId)
    : false;
  const canContinue = Boolean(draft.siteId && selectedAvailable);

  return (
    <AppScreen edges={['right', 'bottom', 'left']} contentStyle={styles.content}>
      <ProgressHeader current="Site" />
      <ScreenIntro
        eyebrow="FIELD OBSERVATION"
        title="Choose the sampling site"
        body="Only active, mobile-safe site names and codes are shown."
      />

      <View style={styles.stateRow}>
        <View style={styles.stateCopy}>
          {catalog.source === 'loading' ? (
            <>
              <ActivityIndicator color={theme.primary} />
              <Text accessibilityLiveRegion="polite" style={[styles.stateText, { color: theme.textSecondary }]}>Loading sites</Text>
            </>
          ) : (
            <Text style={[styles.stateText, { color: theme.textSecondary }]}>
              {catalog.source === 'cached'
                ? `Offline — using ${catalog.sites.length} saved ${catalog.sites.length === 1 ? 'site' : 'sites'}`
                : catalog.source === 'server'
                  ? `${catalog.sites.length} active ${catalog.sites.length === 1 ? 'site' : 'sites'} available`
                  : catalog.source === 'empty'
                    ? 'No active sites available'
                    : 'Site catalog unavailable'}
            </Text>
          )}
        </View>
        <SecondaryButton
          label={catalog.refreshing ? 'Refreshing' : 'Refresh sites'}
          loading={catalog.refreshing}
          onPress={() => void refreshSites()}
          style={styles.refreshButton}
        />
      </View>

      {catalog.error ? <InlineAlert tone="warning" title={catalog.error} /> : null}
      {catalog.invalidDocumentCount > 0 && !catalog.error ? (
        <InlineAlert
          tone="warning"
          title="Some site records could not be used"
          body="Invalid records were hidden; refresh or contact the data administrator if a site is missing."
        />
      ) : null}
      {draft.siteId && !selectedAvailable && catalog.source !== 'loading' ? (
        <InlineAlert
          tone="warning"
          title="Previously selected site is unavailable"
          body="Choose an active site before continuing."
        />
      ) : null}

      {catalog.sites.length > 0 ? (
        <View style={styles.list}>
          {catalog.sites.map((site) => (
            <ListRow
              key={site.siteId}
              accessibilityHint="Selects this site for the observation"
              meta={`Site code ${site.siteCode}`}
              onPress={() =>
                updateDraft(submissionId, {
                  siteId: site.siteId,
                  siteDisplayName: site.displayName,
                  siteCode: site.siteCode,
                })
              }
              selected={draft.siteId === site.siteId}
              testID={`site-${site.siteId}`}
              title={site.displayName}
            />
          ))}
        </View>
      ) : catalog.source === 'empty' ? (
        <EmptyState
          icon="location"
          title="No sites available"
          body="The signed-in catalog contains no active mobile-safe sites. Refresh or contact the data administrator."
        />
      ) : catalog.source === 'error' ? (
        <EmptyState
          icon="warning"
          title="Could not load sites"
          body="A site is required. Reconnect and use Refresh sites to try again."
        />
      ) : null}

      <View style={styles.actions}>
        {!canContinue ? (
          <Text style={[styles.requirement, { color: theme.textSecondary }]}>Choose an available site to continue.</Text>
        ) : null}
        <PrimaryButton
          disabled={!canContinue}
          label="Next: Visit details"
          onPress={() =>
            router.push({
              pathname: '/observation/[submissionId]/[revisionId]/visit',
              params: routeParams,
            })
          }
        />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.xl,
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  stateCopy: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  stateText: {
    ...Typography.helper,
  },
  refreshButton: {
    alignSelf: 'flex-start',
  },
  list: {
    gap: Spacing.xxs,
  },
  actions: {
    gap: Spacing.xs,
  },
  requirement: {
    ...Typography.helper,
  },
});
