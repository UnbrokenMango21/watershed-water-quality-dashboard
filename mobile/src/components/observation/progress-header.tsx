import { StyleSheet, Text, View } from 'react-native';

import { Radii, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export const ObservationSteps = ['Site', 'Location', 'Measurements', 'Review'] as const;

export type ObservationStep = (typeof ObservationSteps)[number];

type ProgressHeaderProps = {
  current: ObservationStep;
};

export function ProgressHeader({ current }: ProgressHeaderProps) {
  const theme = useTheme();
  const currentIndex = ObservationSteps.indexOf(current);

  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: ObservationSteps.length, now: currentIndex + 1 }}>
      <View style={styles.steps}>
        {ObservationSteps.map((step, index) => {
          const active = index <= currentIndex;
          const currentStep = index === currentIndex;
          return (
            <View key={step} style={styles.step}>
              <View style={styles.trackRow}>
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: active ? theme.primary : theme.border,
                      borderColor: currentStep ? theme.primarySoft : 'transparent',
                    },
                  ]}
                />
                {index < ObservationSteps.length - 1 ? (
                  <View
                    style={[
                      styles.line,
                      { backgroundColor: index < currentIndex ? theme.primary : theme.border },
                    ]}
                  />
                ) : null}
              </View>
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  { color: currentStep ? theme.textPrimary : theme.textMuted },
                  currentStep && styles.currentLabel,
                ]}>
                {step}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  steps: {
    flexDirection: 'row',
  },
  step: {
    flex: 1,
    gap: Spacing.xs,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: Radii.pill,
    borderWidth: 3,
  },
  line: {
    flex: 1,
    height: 2,
    marginHorizontal: Spacing.xxs,
  },
  label: {
    ...Typography.caption,
    fontSize: 11,
  },
  currentLabel: {
    fontWeight: '700',
  },
});
