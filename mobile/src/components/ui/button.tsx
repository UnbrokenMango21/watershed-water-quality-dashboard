import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { MinTouchTarget, Radii, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { AppIcon, type AppIconName } from './app-icon';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: AppIconName;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  icon,
  accessibilityHint,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: isDisabled
            ? theme.border
            : pressed
              ? theme.primaryPressed
              : theme.primary,
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <>
          {icon ? <AppIcon name={icon} color="#FFFFFF" size={18} /> : null}
          <Text style={styles.primaryLabel}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  icon,
  accessibilityHint,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: pressed && !isDisabled ? theme.surfaceSecondary : theme.surface,
          borderColor: theme.border,
          borderWidth: 1,
          opacity: isDisabled ? 0.55 : 1,
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={theme.primary} />
      ) : (
        <>
          {icon ? <AppIcon name={icon} color={theme.primary} size={18} /> : null}
          <Text style={[styles.secondaryLabel, { color: theme.textPrimary }]}>{label}</Text>
        </>
      )}
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
          borderColor: theme.border,
          opacity: disabled ? 0.5 : 1,
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
    color: '#FFFFFF',
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
