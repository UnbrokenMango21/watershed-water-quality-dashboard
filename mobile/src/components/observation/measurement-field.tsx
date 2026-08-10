import type { Ref } from 'react';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

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
  allowNegative?: boolean;
  inputAccessoryViewID?: string;
  testID?: string;
  inputRef?: Ref<TextInput>;
  onInputFocus?: () => void;
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
  allowNegative = false,
  inputAccessoryViewID,
  testID,
  inputRef,
  onInputFocus,
}: MeasurementFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? theme.danger : focused ? theme.focus : theme.controlBorder;
  const isNegative = value.trimStart().startsWith('-');

  return (
    <View style={styles.group}>
      <FieldLabel label={label} requirement={requirement} />
      <View
        style={[
          styles.shell,
          {
            borderColor,
            borderWidth: error || focused ? 2 : 1,
            backgroundColor: disabled ? theme.surfaceSecondary : theme.input,
          },
        ]}>
        <TextInput
          ref={inputRef}
          accessibilityLabel={`${label}, ${unit}`}
          editable={!disabled}
          inputAccessoryViewID={inputAccessoryViewID}
          keyboardType={
            allowNegative
              ? Platform.OS === 'ios'
                ? 'numbers-and-punctuation'
                : 'numeric'
              : 'decimal-pad'
          }
          onBlur={() => setFocused(false)}
          onChangeText={onChangeText}
          onFocus={() => {
            setFocused(true);
            onInputFocus?.();
          }}
          placeholder={placeholder}
          placeholderTextColor={theme.textMuted}
          selectTextOnFocus
          selectionColor={theme.primary}
          style={[styles.value, { color: disabled ? theme.disabledText : theme.textPrimary }]}
          testID={testID}
          value={value}
        />
        {allowNegative ? (
          <Pressable
            accessibilityLabel={isNegative ? 'Make value positive' : 'Make value negative'}
            accessibilityRole="button"
            disabled={disabled}
            onPress={() => onChangeText(isNegative ? value.replace(/^\s*-/, '') : `-${value}`)}
            testID={testID ? `${testID}-sign` : undefined}
            style={({ pressed }) => [
              styles.signButton,
              {
                backgroundColor: isNegative
                  ? theme.primarySoft
                  : pressed
                    ? theme.secondaryPressed
                    : theme.surfaceSecondary,
              },
            ]}>
            <Text style={[styles.sign, { color: isNegative ? theme.primary : theme.textPrimary }]}>±</Text>
          </Pressable>
        ) : null}
        <View style={[styles.unitPill, { backgroundColor: theme.surfaceSecondary }]}>
          <Text style={[styles.unit, { color: theme.textSecondary }]}>{unit}</Text>
        </View>
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={[styles.helper, { color: theme.danger }]}>
          {error}
        </Text>
      ) : derivedValue ? (
        <Text style={[styles.helper, { color: theme.textSecondary }]}>{derivedValue}</Text>
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
  signButton: {
    width: 44,
    minHeight: 44,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.xs,
  },
  sign: {
    ...Typography.bodyStrong,
    fontSize: 22,
  },
  unit: {
    ...Typography.bodyStrong,
  },
  helper: {
    ...Typography.helper,
  },
});
