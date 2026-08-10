import type { Ref } from 'react';
import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Radii, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type TemperatureUnit = 'C' | 'F';

type TemperatureFieldProps = {
  value: string;
  unit: TemperatureUnit | null;
  onChangeText: (value: string) => void;
  onUnitChange: (unit: TemperatureUnit) => void;
  error?: string | null;
  disabled?: boolean;
  inputAccessoryViewID?: string;
  inputRef?: Ref<TextInput>;
  onInputFocus?: () => void;
};

export function TemperatureField({
  value,
  unit,
  onChangeText,
  onUnitChange,
  error,
  disabled = false,
  inputAccessoryViewID,
  inputRef,
  onInputFocus,
}: TemperatureFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const inputDisabled = disabled || !unit;
  const borderColor = error ? theme.danger : focused ? theme.focus : theme.controlBorder;

  const converted = useMemo(() => {
    const numeric = Number(value);
    if (!unit || !value.trim() || !Number.isFinite(numeric)) return null;
    return unit === 'C'
      ? `${((numeric * 9) / 5 + 32).toFixed(2)} °F`
      : `${(((numeric - 32) * 5) / 9).toFixed(2)} °C`;
  }, [unit, value]);

  return (
    <View style={styles.group}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: theme.textPrimary }]}>Entered unit</Text>
        <Text style={[styles.requirement, { color: theme.textSecondary }]}>Required</Text>
      </View>

      <View
        accessibilityLabel="Entered temperature unit"
        accessibilityRole="radiogroup"
        style={styles.units}>
        {(['C', 'F'] as const).map((candidate) => {
          const selected = candidate === unit;
          const unitName = candidate === 'C' ? 'Celsius' : 'Fahrenheit';
          return (
            <Pressable
              key={candidate}
              accessibilityRole="radio"
              accessibilityLabel={`Degrees ${unitName}`}
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => onUnitChange(candidate)}
              style={({ pressed }) => [
                styles.unitButton,
                {
                  backgroundColor: disabled
                    ? theme.disabledSurface
                    : selected
                      ? theme.primary
                      : pressed
                        ? theme.secondaryPressed
                        : theme.surface,
                  borderColor: selected ? theme.primary : theme.controlBorder,
                },
              ]}>
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[
                  styles.radioDot,
                  {
                    backgroundColor: selected ? theme.onPrimary : 'transparent',
                    borderColor: selected ? theme.onPrimary : theme.controlBorder,
                  },
                ]}
              />
              <Text
                style={[
                  styles.unitText,
                  {
                    color: disabled
                      ? theme.disabledText
                      : selected
                        ? theme.onPrimary
                        : theme.textPrimary,
                  },
                ]}>
                °{candidate}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: theme.textPrimary }]}>Water temperature</Text>
        <Text style={[styles.requirement, { color: theme.textSecondary }]}>Required</Text>
      </View>
      <View
        style={[
          styles.shell,
          {
            borderColor: inputDisabled ? theme.disabledSurface : borderColor,
            borderWidth: !inputDisabled && (error || focused) ? 2 : 1,
            backgroundColor: inputDisabled ? theme.disabledSurface : theme.input,
          },
        ]}>
        <TextInput
          ref={inputRef}
          accessibilityLabel={
            unit
              ? `Water temperature in degrees ${unit === 'C' ? 'Celsius' : 'Fahrenheit'}`
              : 'Water temperature, choose an entered unit first'
          }
          accessibilityHint={error ?? (converted ? `Derived counterpart ${converted}` : undefined)}
          accessibilityState={{ disabled: inputDisabled }}
          editable={!inputDisabled}
          inputAccessoryViewID={inputAccessoryViewID}
          keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
          onBlur={() => setFocused(false)}
          onChangeText={onChangeText}
          onFocus={() => {
            setFocused(true);
            onInputFocus?.();
          }}
          placeholder={unit ? '—' : 'Choose °C or °F first'}
          placeholderTextColor={inputDisabled ? theme.disabledText : theme.textMuted}
          returnKeyType="done"
          selectTextOnFocus
          selectionColor={theme.primary}
          style={[
            styles.value,
            { color: inputDisabled ? theme.disabledText : theme.textPrimary },
          ]}
          value={value}
        />
        {unit ? <Text style={[styles.inputUnit, { color: theme.textSecondary }]}>°{unit}</Text> : null}
      </View>

      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={[styles.helper, { color: theme.danger }]}>
          {error}
        </Text>
      ) : converted ? (
        <Text accessibilityLiveRegion="polite" style={[styles.helper, { color: theme.textSecondary }]}>
          Entered in °{unit} · {converted} derived
        </Text>
      ) : (
        <Text style={[styles.helper, { color: theme.textSecondary }]}>
          Choose the unit shown on the instrument before entering the reading.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.xs,
  },
  labelRow: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  label: {
    ...Typography.label,
  },
  requirement: {
    ...Typography.caption,
  },
  units: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  unitButton: {
    minHeight: 52,
    flex: 1,
    borderRadius: Radii.input,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
  },
  unitText: {
    ...Typography.bodyStrong,
  },
  shell: {
    minHeight: 64,
    borderRadius: Radii.input,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  value: {
    ...Typography.numeric,
    flex: 1,
    minHeight: 62,
    paddingVertical: 8,
  },
  inputUnit: {
    ...Typography.bodyStrong,
  },
  helper: {
    ...Typography.helper,
  },
});
