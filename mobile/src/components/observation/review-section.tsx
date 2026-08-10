import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radii, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { AppIcon } from '../ui/app-icon';

type ReviewItem = {
  label: string;
  value: string;
};

type ReviewSectionProps = {
  title: string;
  items: ReviewItem[];
  onEdit?: () => void;
};

export function ReviewSection({ title, items, onEdit }: ReviewSectionProps) {
  const theme = useTheme();

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>{title}</Text>
        {onEdit ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${title}`}
            onPress={onEdit}
            style={({ pressed }) => [
              styles.edit,
              { backgroundColor: pressed ? theme.secondaryPressed : 'transparent' },
            ]}>
            <AppIcon name="edit" color={theme.primary} size={16} />
            <Text style={[styles.editText, { color: theme.primary }]}>Edit</Text>
          </Pressable>
        ) : null}
      </View>

      <View
        style={[
          styles.items,
          {
            backgroundColor: theme.surface,
            borderTopColor: theme.border,
            borderBottomColor: theme.border,
          },
        ]}>
        {items.map((item, index) => (
          <View
            key={`${item.label}-${item.value}`}
            style={[
              styles.itemRow,
              index < items.length - 1
                ? { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }
                : null,
            ]}>
            <Text style={[styles.itemLabel, { color: theme.textSecondary }]}>{item.label}</Text>
            <Text selectable style={[styles.itemValue, { color: theme.textPrimary }]}>
              {item.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.sm,
  },
  header: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  title: {
    ...Typography.sectionTitle,
  },
  edit: {
    minHeight: 48,
    borderRadius: Radii.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
    paddingHorizontal: Spacing.xs,
  },
  editText: {
    ...Typography.label,
  },
  items: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  itemLabel: {
    ...Typography.helper,
    flexShrink: 1,
    maxWidth: '42%',
  },
  itemValue: {
    ...Typography.bodyStrong,
    flex: 1,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
});
