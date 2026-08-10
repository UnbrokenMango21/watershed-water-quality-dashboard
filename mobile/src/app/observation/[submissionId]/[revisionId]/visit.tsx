import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, StyleSheet, Text, View } from 'react-native';

import { DateTimeFields } from '@/components/observation/date-time-fields';
import { DraftGate } from '@/components/observation/draft-gate';
import { GpsStatusCard, type GpsState } from '@/components/observation/gps-status-card';
import { ProgressHeader } from '@/components/observation/progress-header';
import { PrimaryButton } from '@/components/ui/button';
import { ScreenIntro } from '@/components/ui/screen-intro';
import { InlineAlert } from '@/components/ui/status';
import { AppScreen } from '@/components/ui/surface';
import { collectionProtocol } from '@/config/contracts';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useObservationDraft } from '@/hooks/use-observation-draft';
import { trackScreenView } from '@/services/analytics';

export default function VisitStep() {
  const theme = useTheme();
  const router = useRouter();
  const { draft, loading, routeParams, submissionId, updateDraft } = useObservationDraft();
  const attemptedInitialCapture = useRef(false);
  const [gpsState, setGpsState] = useState<GpsState>(() =>
    draft?.latitude != null ? 'captured' : 'idle',
  );
  const [gpsError, setGpsError] = useState<string | null>(null);

  const captureLocation = useCallback(async () => {
    setGpsState('requesting');
    setGpsError(null);
    try {
      if (!(await Location.hasServicesEnabledAsync())) {
        setGpsState('unavailable');
        setGpsError('Location services are off. Turn them on, then retry.');
        return;
      }

      let permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED && permission.canAskAgain) {
        permission = await Location.requestForegroundPermissionsAsync();
      }
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setGpsState(permission.canAskAgain ? 'denied' : 'blocked');
        return;
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const accuracy = position.coords.accuracy;
      if (accuracy == null || !Number.isFinite(accuracy)) {
        setGpsState('unavailable');
        setGpsError('The device did not report GPS accuracy. Retry at the sampling point.');
        return;
      }

      updateDraft(submissionId, {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        gpsAccuracyM: accuracy,
      });
      setGpsState(
        accuracy <= collectionProtocol.gps.acceptableAccuracyM ? 'captured' : 'weak',
      );
    } catch {
      setGpsState('unavailable');
      setGpsError('Could not acquire a location. Move to an open area and retry.');
    }
  }, [submissionId, updateDraft]);

  useEffect(() => {
    void trackScreenView('visit');
  }, []);

  useEffect(() => {
    if (!draft || attemptedInitialCapture.current || draft.latitude != null) return;
    attemptedInitialCapture.current = true;
    void captureLocation();
  }, [captureLocation, draft]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' || gpsState !== 'blocked') return;
      void Location.getForegroundPermissionsAsync()
        .then((permission) => {
          if (permission.status === Location.PermissionStatus.GRANTED) void captureLocation();
        })
        .catch(() => undefined);
    });
    return () => subscription.remove();
  }, [captureLocation, gpsState]);

  if (!draft) return <DraftGate loading={loading} />;

  const collectedAt = new Date(draft.collectedAt ?? Number.NaN);
  const validDate = Number.isFinite(collectedAt.getTime());
  const hasLocation =
    Number.isFinite(draft.latitude) &&
    Number.isFinite(draft.longitude) &&
    Number.isFinite(draft.gpsAccuracyM);
  const canContinue = validDate && hasLocation;
  const displayedGpsState =
    gpsState === 'idle' && hasLocation
      ? (draft.gpsAccuracyM ?? Number.POSITIVE_INFINITY) <= collectionProtocol.gps.acceptableAccuracyM
        ? 'captured'
        : 'weak'
      : gpsState;

  return (
    <AppScreen edges={['right', 'bottom', 'left']} contentStyle={styles.content}>
      <ProgressHeader current="Visit" />
      <ScreenIntro
        eyebrow="WHEN & WHERE"
        title="Record the visit"
        body="Confirm local collection time and capture the device-reported GPS position."
      />

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Collection time</Text>
        <DateTimeFields
          onChange={(date) => updateDraft(submissionId, { collectedAt: date.toISOString() })}
          value={validDate ? collectedAt : new Date()}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Sampling location</Text>
        <GpsStatusCard
          accuracyMeters={draft.gpsAccuracyM}
          latitude={draft.latitude}
          longitude={draft.longitude}
          onAction={
            displayedGpsState === 'blocked' ? () => void Linking.openSettings() : () => void captureLocation()
          }
          state={displayedGpsState}
        />
        {gpsError ? <InlineAlert tone="warning" title={gpsError} /> : null}
        {hasLocation && (draft.gpsAccuracyM ?? 0) > collectionProtocol.gps.warningAccuracyM ? (
          <InlineAlert
            tone="warning"
            title="Reported accuracy is above the configured warning band"
            body="You may continue, or retry for a better fix if field conditions allow. Phase 10 remains authoritative."
          />
        ) : null}
      </View>

      <View style={styles.actions}>
        {!canContinue ? (
          <Text style={[styles.requirement, { color: theme.textSecondary }]}>A collection time and GPS fix with reported accuracy are required.</Text>
        ) : null}
        <PrimaryButton
          disabled={!canContinue}
          label="Next: Method & provenance"
          onPress={() =>
            router.push({
              pathname: '/observation/[submissionId]/[revisionId]/method',
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
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.sectionTitle,
  },
  actions: {
    gap: Spacing.xs,
  },
  requirement: {
    ...Typography.helper,
  },
});
