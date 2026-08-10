import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { MinTouchTarget, Radii, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { AppIcon, type AppIconName } from './app-icon';

type ButtonProps = {
  label: string;
  loadingLabel?: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: AppIconName;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({
  label,
  loadingLabel,
  onPress,
  disabled = false,
  loading = false,
  icon,
  accessibilityHint,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const foreground = isDisabled ? theme.disabledText : theme.onPrimary;
  const visibleLabel = loading ? (loadingLabel ?? label) : label;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={visibleLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: isDisabled
            ? theme.disabledSurface
            : pressed
              ? theme.primaryPressed
              : theme.primary,
        },
        style,
      ]}>
      {loading ? <ActivityIndicator color={foreground} /> : null}
      {!loading && icon ? <AppIcon name={icon} color={foreground} size={18} /> : null}
      <Text style={[styles.primaryLabel, { color: foreground }]}>{visibleLabel}</Text>
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  loadingLabel,
  onPress,
  disabled = false,
  loading = false,
  icon,
  accessibilityHint,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const visibleLabel = loading ? (loadingLabel ?? label) : label;
  const foreground = isDisabled ? theme.disabledText : theme.textPrimary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={visibleLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: isDisabled
            ? theme.disabledSurface
            : pressed
              ? theme.secondaryPressed
              : theme.surface,
          borderColor: isDisabled ? theme.disabledSurface : theme.controlBorder,
          borderWidth: 1,
        },
        style,
      ]}>
      {loading ? <ActivityIndicator color={theme.primary} /> : null}
      {!loading && icon ? <AppIcon name={icon} color={theme.primary} size={18} /> : null}
      <Text style={[styles.secondaryLabel, { color: foreground }]}>{visibleLabel}</Text>
    </Pressable>
  );
}

export function DestructiveButton({
  label,
  loadingLabel,
  onPress,
  disabled = false,
  loading = false,
  icon,
  accessibilityHint,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const visibleLabel = loading ? (loadingLabel ?? label) : label;
  const foreground = isDisabled ? theme.disabledText : theme.onPrimary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={visibleLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: isDisabled
            ? theme.disabledSurface
            : pressed
              ? theme.dangerPressed
              : theme.danger,
        },
        style,
      ]}>
      {loading ? <ActivityIndicator color={foreground} /> : null}
      {!loading && icon ? <AppIcon name={icon} color={foreground} size={18} /> : null}
      <Text style={[styles.primaryLabel, { color: foreground }]}>{visibleLabel}</Text>
    </Pressable>
  );
}

type IconButtonProps = {
  icon: AppIconName;
  accessibilityLabel: string;
  onPress?: () => void;
  disabled?: boolean;
};

export function IconButton({ icon, accessibilityLabel, onPress, disabled = false }: IconButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        {
          backgroundColor: pressed && !disabled ? theme.surfaceSecondary : theme.surface,
          borderColor: disabled ? theme.disabledSurface : theme.controlBorder,
        },
      ]}>
      <AppIcon name={icon} color={theme.textPrimary} size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  primaryLabel: {
    ...Typography.button,
  },
  secondaryLabel: {
    ...Typography.button,
  },
  iconButton: {
    width: MinTouchTarget,
    height: MinTouchTarget,
    borderRadius: Radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
