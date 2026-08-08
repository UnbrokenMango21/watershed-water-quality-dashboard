import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Radii, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { FieldLabel, type FieldRequirement } from '../ui/field';

type MeasurementFieldProps = {
  label: string;
  unit: string;
  value: string;
  onChangeText: (value: string) => void;
  requirement?: FieldRequirement;
  placeholder?: string;
  helper?: string;
  error?: string | null;
  derivedValue?: string;
  disabled?: boolean;
};

export function MeasurementField({
  label,
  unit,
  value,
  onChangeText,
  requirement,
  placeholder,
  helper,
  error,
  derivedValue,
  disabled = false,
}: MeasurementFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? theme.danger : focused ? theme.primary : theme.border;

  return (
    <View style={styles.group}>
      <FieldLabel label={label} requirement={requirement} />
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
          accessibilityLabel={`${label}, ${unit}`}
          editable={!disabled}
          keyboardType="decimal-pad"
          onBlur={() => setFocused(false)}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          placeholder={placeholder}
          placeholderTextColor={theme.textMuted}
          selectionColor={theme.primary}
          style={[styles.value, { color: theme.textPrimary }]}
          value={value}
        />
        <View style={[styles.unitPill, { backgroundColor: theme.surfaceSecondary }]}>
          <Text style={[styles.unit, { color: theme.textSecondary }]}>{unit}</Text>
        </View>
      </View>
      {derivedValue ? (
        <Text style={[styles.helper, { color: theme.textSecondary }]}>{derivedValue}</Text>
      ) : error ? (
        <Text accessibilityRole="alert" style={[styles.helper, { color: theme.danger }]}>
          {error}
        </Text>
      ) : helper ? (
        <Text style={[styles.helper, { color: theme.textSecondary }]}>{helper}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.xs,
  },
  shell: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: Radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
  },
  value: {
    ...Typography.numeric,
    flex: 1,
    minHeight: 56,
    paddingVertical: 8,
  },
  unitPill: {
    minWidth: 56,
    minHeight: 40,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  unit: {
    ...Typography.bodyStrong,
  },
  helper: {
    ...Typography.helper,
  },
});
