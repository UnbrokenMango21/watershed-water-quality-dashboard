import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Radii, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { FieldLabel } from '../ui/field';

export type TemperatureUnit = 'C' | 'F';

type TemperatureFieldProps = {
  value: string;
  unit: TemperatureUnit;
  onChangeText: (value: string) => void;
  onUnitChange: (unit: TemperatureUnit) => void;
  error?: string | null;
  disabled?: boolean;
};

export function TemperatureField({
  value,
  unit,
  onChangeText,
  onUnitChange,
  error,
  disabled = false,
}: TemperatureFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? theme.danger : focused ? theme.primary : theme.border;

  const converted = useMemo(() => {
    const numeric = Number(value);
    if (!value.trim() || !Number.isFinite(numeric)) return null;
    return unit === 'C'
      ? `${((numeric * 9) / 5 + 32).toFixed(2)} °F`
      : `${(((numeric - 32) * 5) / 9).toFixed(2)} °C`;
  }, [unit, value]);

  return (
    <View style={styles.group}>
      <FieldLabel label="Water temperature" requirement="required" />
      <View
        style={[
          styles.shell,
          {
            borderColor,
            backgroundColor: disabled ? theme.surfaceSecondary : theme.input,
            opacity: disabled ? 0.64 : 1,
          },
        ]}>
        <TextInput
          accessibilityLabel={`Water temperature in degrees ${unit === 'C' ? 'Celsius' : 'Fahrenheit'}`}
          editable={!disabled}
          keyboardType="decimal-pad"
          onBlur={() => setFocused(false)}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          placeholder="0.00"
          placeholderTextColor={theme.textMuted}
          selectionColor={theme.primary}
          style={[styles.value, { color: theme.textPrimary }]}
          value={value}
        />

        <View style={[styles.units, { backgroundColor: theme.surfaceSecondary }]}>
          {(['C', 'F'] as const).map((candidate) => {
            const selected = candidate === unit;
            return (
              <Pressable
                key={candidate}
                accessibilityRole="button"
                accessibilityLabel={`Use degrees ${candidate === 'C' ? 'Celsius' : 'Fahrenheit'}`}
                accessibilityState={{ selected, disabled }}
                disabled={disabled}
                onPress={() => onUnitChange(candidate)}
                style={({ pressed }) => [
                  styles.unitButton,
                  {
                    backgroundColor: selected
                      ? theme.surface
                      : pressed
                        ? theme.backgroundSelected
                        : 'transparent',
                  },
                ]}>
                <Text
                  style={[
                    styles.unitText,
                    { color: selected ? theme.primary : theme.textSecondary },
                  ]}>
                  °{candidate}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {error ? (
        <Text accessibilityRole="alert" style={[styles.helper, { color: theme.danger }]}>
          {error}
        </Text>
      ) : converted ? (
        <Text style={[styles.helper, { color: theme.textSecondary }]}>Also stored as {converted}</Text>
      ) : (
        <Text style={[styles.helper, { color: theme.textSecondary }]}>
          Choose the unit you are reading in; the counterpart is calculated automatically.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.xs,
  },
  shell: {
    minHeight: 60,
    borderWidth: 1,
    borderRadius: Radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
    gap: Spacing.sm,
  },
  value: {
    ...Typography.numeric,
    flex: 1,
    minHeight: 58,
    paddingVertical: 8,
  },
  units: {
    flexDirection: 'row',
    borderRadius: Radii.sm,
    padding: 3,
  },
  unitButton: {
    minWidth: 46,
    minHeight: 42,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  unitText: {
    ...Typography.bodyStrong,
  },
  helper: {
    ...Typography.helper,
  },
});
