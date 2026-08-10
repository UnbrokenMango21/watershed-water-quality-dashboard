import type { Ref } from 'react';
import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Radii, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { FieldLabel } from '../ui/field';

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
      <FieldLabel label="Entered temperature unit" requirement="required" />
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
                      ? theme.primarySoft
                      : pressed
                        ? theme.secondaryPressed
                        : theme.surface,
                  borderColor: selected ? theme.focus : theme.controlBorder,
                  borderWidth: selected ? 2 : 1,
                },
              ]}>
              <Text
                style={[
                  styles.unitText,
                  { color: disabled ? theme.disabledText : selected ? theme.primary : theme.textPrimary },
                ]}>
                °{candidate} · {unitName}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FieldLabel label="Water temperature" requirement="required" />
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
          editable={!inputDisabled}
          inputAccessoryViewID={inputAccessoryViewID}
          keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
          onBlur={() => setFocused(false)}
          onChangeText={onChangeText}
          onFocus={() => {
            setFocused(true);
            onInputFocus?.();
          }}
          placeholder={unit ? '0.00' : 'Choose °C or °F first'}
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
        {unit ? (
          <Text style={[styles.inputUnit, { color: theme.textSecondary }]}>°{unit}</Text>
        ) : null}
      </View>

      {error ? (
        <Text accessibilityRole="alert" style={[styles.helper, { color: theme.danger }]}>
          {error}
        </Text>
      ) : converted ? (
        <Text style={[styles.helper, { color: theme.textSecondary }]}>Also stored as {converted}</Text>
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
  units: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  unitButton: {
    minHeight: 52,
    flex: 1,
    borderRadius: Radii.input,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  unitText: {
    ...Typography.label,
    textAlign: 'center',
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
