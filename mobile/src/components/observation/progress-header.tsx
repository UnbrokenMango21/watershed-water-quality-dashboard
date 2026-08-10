import { StyleSheet, Text, View } from 'react-native';

import { Radii, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export const ObservationSteps = ['Site', 'Visit', 'Method', 'Measurements', 'Review'] as const;

export type ObservationStep = (typeof ObservationSteps)[number];

type ProgressHeaderProps = {
  current: ObservationStep;
};

export function ProgressHeader({ current }: ProgressHeaderProps) {
  const theme = useTheme();
  const currentIndex = ObservationSteps.indexOf(current);
  const position = currentIndex + 1;

  return (
    <View
      accessibilityLabel={`Step ${position} of ${ObservationSteps.length}, ${current}`}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: ObservationSteps.length, now: position }}
      style={styles.container}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>
        Step {position} of {ObservationSteps.length} ·{' '}
        <Text style={{ color: theme.textPrimary, fontWeight: '700' }}>{current}</Text>
      </Text>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.track}>
        {ObservationSteps.map((step, index) => (
          <View
            key={step}
            style={[
              styles.segment,
              { backgroundColor: index <= currentIndex ? theme.primary : theme.border },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
  },
  label: {
    ...Typography.caption,
  },
  track: {
    flexDirection: 'row',
    gap: Spacing.xxs,
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: Radii.pill,
  },
});
