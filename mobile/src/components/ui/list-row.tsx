import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MinTouchTarget, Radii, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { AppIcon } from './app-icon';

type ListRowProps = {
  title: string;
  subtitle?: string;
  meta?: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  trailing?: ReactNode;
  accessibilityHint?: string;
  testID?: string;
};

export function ListRow({
  title,
  subtitle,
  meta,
  selected = false,
  disabled = false,
  onPress,
  trailing,
  accessibilityHint,
  testID,
}: ListRowProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle, meta].filter(Boolean).join(', ')}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: disabled
            ? theme.disabledSurface
            : selected
              ? theme.primarySoft
              : pressed
                ? theme.secondaryPressed
                : 'transparent',
          borderColor: selected ? theme.focus : theme.border,
        },
      ]}>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: disabled ? theme.disabledText : theme.textPrimary }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: disabled ? theme.disabledText : theme.textSecondary }]}>
            {subtitle}
          </Text>
        ) : null}
        {meta ? (
          <Text style={[styles.meta, { color: disabled ? theme.disabledText : theme.textMuted }]}>
            {meta}
          </Text>
        ) : null}
      </View>
      {trailing ?? (
        <AppIcon
          name={selected ? 'check' : 'chevronRight'}
          color={selected ? theme.primary : theme.textMuted}
          size={selected ? 20 : 18}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: Radii.input,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  copy: {
    minHeight: MinTouchTarget,
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.xxs,
  },
  title: {
    ...Typography.bodyStrong,
  },
  subtitle: {
    ...Typography.helper,
  },
  meta: {
    ...Typography.caption,
  },
});
