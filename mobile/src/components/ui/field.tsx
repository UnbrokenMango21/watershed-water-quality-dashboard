import type { ReactNode, Ref } from 'react';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  View,
} from 'react-native';

import { MinTouchTarget, Radii, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { AppIcon } from './app-icon';

export type FieldRequirement = 'required' | 'optional';

type FieldLabelProps = {
  label: string;
  requirement?: FieldRequirement;
};

export function FieldLabel({ label, requirement }: FieldLabelProps) {
  const theme = useTheme();

  return (
    <View style={styles.labelRow}>
      <Text style={[styles.label, { color: theme.textPrimary }]}>{label}</Text>
      {requirement ? (
        <Text style={[styles.requirement, { color: theme.textSecondary }]}>
          {requirement === 'required' ? 'Required' : 'Optional'}
        </Text>
      ) : null}
    </View>
  );
}

type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  requirement?: FieldRequirement;
  helper?: string;
  error?: string | null;
  inputRef?: Ref<TextInput>;
  inputStyle?: StyleProp<TextStyle>;
  trailing?: ReactNode;
};

export function TextField({
  label,
  requirement,
  helper,
  error,
  inputRef,
  inputStyle,
  trailing,
  editable = true,
  onFocus,
  onBlur,
  ...inputProps
}: TextFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? theme.danger : focused ? theme.focus : theme.controlBorder;

  return (
    <View style={styles.fieldGroup}>
      <FieldLabel label={label} requirement={requirement} />
      <View
        style={[
          styles.inputShell,
          {
            borderColor,
            borderWidth: error || focused ? 2 : 1,
            backgroundColor: editable ? theme.input : theme.surfaceSecondary,
          },
        ]}>
        <TextInput
          ref={inputRef}
          {...inputProps}
          accessibilityLabel={inputProps.accessibilityLabel ?? label}
          accessibilityHint={error ?? helper ?? inputProps.accessibilityHint}
          editable={editable}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          placeholderTextColor={theme.textMuted}
          selectionColor={theme.primary}
          style={[styles.input, { color: theme.textPrimary }, inputStyle]}
        />
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={[styles.helper, { color: theme.danger }]}>
          {error}
        </Text>
      ) : helper ? (
        <Text style={[styles.helper, { color: theme.textSecondary }]}>{helper}</Text>
      ) : null}
    </View>
  );
}

type SelectFieldProps = {
  label: string;
  value?: string | null;
  placeholder: string;
  requirement?: FieldRequirement;
  helper?: string;
  error?: string | null;
  disabled?: boolean;
  onPress?: () => void;
};

export function SelectField({
  label,
  value,
  placeholder,
  requirement,
  helper,
  error,
  disabled = false,
  onPress,
}: SelectFieldProps) {
  const theme = useTheme();

  return (
    <View style={styles.fieldGroup}>
      <FieldLabel label={label} requirement={requirement} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${value ?? placeholder}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.select,
          {
            borderColor: error ? theme.danger : disabled ? theme.disabledSurface : theme.controlBorder,
            borderWidth: error ? 2 : 1,
            backgroundColor: disabled
              ? theme.disabledSurface
              : pressed
                ? theme.secondaryPressed
                : theme.input,
          },
        ]}>
        <Text
          style={[
            styles.selectText,
            { color: disabled ? theme.disabledText : value ? theme.textPrimary : theme.textMuted },
          ]}>
          {value ?? placeholder}
        </Text>
        <AppIcon name="chevronRight" color={theme.textMuted} size={18} />
      </Pressable>
      {error ? (
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
  fieldGroup: {
    gap: Spacing.xs,
  },
  labelRow: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  label: {
    ...Typography.label,
    flexShrink: 1,
  },
  requirement: {
    ...Typography.caption,
  },
  inputShell: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: Radii.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    minHeight: 50,
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: 11,
    fontSize: 17,
    lineHeight: 24,
  },
  trailing: {
    minHeight: MinTouchTarget,
    justifyContent: 'center',
    paddingRight: Spacing.md,
  },
  helper: {
    ...Typography.helper,
  },
  select: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  selectText: {
    flex: 1,
    fontSize: 17,
    lineHeight: 24,
    paddingVertical: Spacing.sm,
  },
});
