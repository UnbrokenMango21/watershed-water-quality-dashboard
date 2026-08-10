import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Radii, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { SecondaryButton } from '../ui/button';
import { AppIcon } from '../ui/app-icon';

export type GpsState =
  | 'idle'
  | 'requesting'
  | 'captured'
  | 'weak'
  | 'denied'
  | 'blocked'
  | 'unavailable';

type GpsStatusCardProps = {
  state: GpsState;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  onAction?: () => void;
};

export function GpsStatusCard({
  state,
  latitude,
  longitude,
  accuracyMeters,
  onAction,
}: GpsStatusCardProps) {
  const theme = useTheme();

  const meta = {
    idle: {
      title: 'Ready to capture location',
      body: 'Use the device GPS at the sampling point.',
      color: theme.info,
      background: theme.infoSoft,
      action: 'Capture GPS',
    },
    requesting: {
      title: 'Acquiring location',
      body: 'Keep the device still with a clear view of the sky.',
      color: theme.info,
      background: theme.infoSoft,
      action: undefined,
    },
    captured: {
      title: 'Location acquired',
      body: 'Reported coordinates and device accuracy are recorded together.',
      color: theme.success,
      background: theme.successSoft,
      action: 'Refresh location',
    },
    weak: {
      title: 'Location acquired · weak accuracy',
      body: 'Wait briefly and refresh if conditions allow.',
      color: theme.warning,
      background: theme.warningSoft,
      action: 'Try for better accuracy',
    },
    denied: {
      title: 'Location permission needed',
      body: 'Allow location access to record sampling coordinates.',
      color: theme.danger,
      background: theme.dangerSoft,
      action: 'Try again',
    },
    blocked: {
      title: 'Location permission is off',
      body: 'Open system settings and allow location access for this app.',
      color: theme.danger,
      background: theme.dangerSoft,
      action: 'Open Settings',
    },
    unavailable: {
      title: 'Location unavailable',
      body: 'Move to an open area or retry when GPS becomes available.',
      color: theme.warning,
      background: theme.warningSoft,
      action: 'Retry',
    },
  }[state];

  const hasCoordinates =
    typeof latitude === 'number' && typeof longitude === 'number' && typeof accuracyMeters === 'number';
  const coordinateDecimals =
    typeof accuracyMeters !== 'number'
      ? 5
      : accuracyMeters <= 1
        ? 6
        : accuracyMeters <= 10
          ? 5
          : accuracyMeters <= 100
            ? 4
            : 3;

  return (
    <View accessibilityLiveRegion="polite" style={[styles.card, { backgroundColor: meta.background }]}>
      <View style={styles.topRow}>
        <View style={[styles.icon, { backgroundColor: theme.surface }]}>
          {state === 'requesting' ? (
            <ActivityIndicator color={meta.color} />
          ) : (
            <AppIcon name="gps" color={meta.color} size={22} />
          )}
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>{meta.title}</Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>{meta.body}</Text>
        </View>
      </View>

      {hasCoordinates ? (
        <View style={[styles.coordinates, { borderTopColor: theme.border }]}>
          <Text style={[styles.coordinateText, { color: theme.textPrimary }]}>
            {latitude.toFixed(coordinateDecimals)}, {longitude.toFixed(coordinateDecimals)}
          </Text>
          <Text style={[styles.accuracy, { color: meta.color }]}>Accuracy ±{Math.round(accuracyMeters)} m</Text>
        </View>
      ) : null}

      {meta.action && onAction ? (
        <SecondaryButton label={meta.action} onPress={onAction} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.input,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: Radii.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: Spacing.xxs,
    paddingTop: 1,
  },
  title: {
    ...Typography.label,
  },
  body: {
    ...Typography.helper,
  },
  coordinates: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  coordinateText: {
    ...Typography.bodyStrong,
    fontVariant: ['tabular-nums'],
  },
  accuracy: {
    ...Typography.caption,
    fontWeight: '700',
  },
});
