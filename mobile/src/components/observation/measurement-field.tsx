import type { Ref } from 'react';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { MinTouchTarget, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { FieldRequirement } from '../ui/field';

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
  const isNegative = value.trimStart().startsWith('-');
  const isRequired = requirement === 'required';
  const statusColor = error ? theme.danger : focused ? theme.focus : isRequired ? theme.primary : theme.border;

  return (
    <View style={styles.group}>
      <View
        style={[
          styles.row,
          {
            backgroundColor: disabled ? theme.surfaceSecondary : theme.surface,
            borderBottomColor: theme.border,
          },
        ]}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.requirementSpine,
            isRequired
              ? error
                ? { borderColor: theme.danger, borderWidth: 1, backgroundColor: 'transparent' }
                : { backgroundColor: statusColor }
              : { borderColor: theme.border, borderWidth: 1, borderStyle: 'dashed', backgroundColor: 'transparent' },
          ]}
        />

        <View style={styles.labelBlock}>
          <Text style={[styles.label, { color: disabled ? theme.disabledText : theme.textPrimary }]}>
            {label}
          </Text>
          <Text
            style={[
              styles.requirement,
              { color: error ? theme.danger : disabled ? theme.disabledText : theme.textSecondary },
            ]}>
            {error ?? (isRequired ? 'Required' : 'Optional')}
          </Text>
        </View>

        <TextInput
          ref={inputRef}
          accessibilityLabel={`${label}, ${unit}`}
          accessibilityHint={error ?? helper ?? `${isRequired ? 'Required' : 'Optional'} measurement`}
          accessibilityState={{ disabled }}
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
          style={[
            styles.value,
            {
              color: disabled ? theme.disabledText : theme.textPrimary,
              borderBottomColor: focused ? theme.focus : 'transparent',
            },
          ]}
          testID={testID}
          value={value}
        />

        {allowNegative ? (
          <Pressable
            accessibilityLabel={isNegative ? 'Make value positive' : 'Make value negative'}
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={() => onChangeText(isNegative ? value.replace(/^\s*-/, '') : `-${value}`)}
            testID={testID ? `${testID}-sign` : undefined}
            style={({ pressed }) => [
              styles.signButton,
              {
                backgroundColor: disabled
                  ? theme.disabledSurface
                  : isNegative
                    ? theme.primarySoft
                    : pressed
                      ? theme.secondaryPressed
                      : 'transparent',
                borderColor: isNegative ? theme.primary : theme.border,
              },
            ]}>
            <Text
              style={[
                styles.sign,
                { color: disabled ? theme.disabledText : isNegative ? theme.primary : theme.textSecondary },
              ]}>
              ±
            </Text>
          </Pressable>
        ) : null}

        <Text style={[styles.unit, { color: theme.textSecondary }]}>{unit}</Text>
      </View>

      {!error && derivedValue ? (
        <Text style={[styles.helper, { color: theme.textSecondary }]}>{derivedValue}</Text>
      ) : !error && helper ? (
        <Text style={[styles.helper, { color: theme.textSecondary }]}>{helper}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.xxs,
  },
  row: {
    minHeight: 68,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingRight: Spacing.xs,
  },
  requirementSpine: {
    width: 3,
    alignSelf: 'stretch',
    minHeight: 44,
  },
  labelBlock: {
    flex: 1,
    minWidth: 104,
    gap: 2,
  },
  label: {
    ...Typography.bodyStrong,
  },
  requirement: {
    ...Typography.caption,
  },
  value: {
    ...Typography.numeric,
    minWidth: 72,
    maxWidth: 118,
    minHeight: 52,
    paddingHorizontal: Spacing.xxs,
    paddingVertical: Spacing.xs,
    textAlign: 'right',
    borderBottomWidth: 2,
  },
  signButton: {
    width: MinTouchTarget,
    minHeight: MinTouchTarget,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sign: {
    ...Typography.bodyStrong,
    fontSize: 22,
  },
  unit: {
    ...Typography.label,
    minWidth: 58,
    textAlign: 'right',
  },
  helper: {
    ...Typography.helper,
    paddingLeft: 15,
  },
});
