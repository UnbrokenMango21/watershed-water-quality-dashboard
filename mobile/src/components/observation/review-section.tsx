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
    <View style={[styles.section, { borderBottomColor: theme.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>{title}</Text>
        {onEdit ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${title}`}
            hitSlop={8}
            onPress={onEdit}
            style={({ pressed }) => [styles.edit, { opacity: pressed ? 0.6 : 1 }]}>
            <AppIcon name="edit" color={theme.primary} size={16} />
            <Text style={[styles.editText, { color: theme.primary }]}>Edit</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.items}>
        {items.map((item) => (
          <View key={`${item.label}-${item.value}`} style={styles.itemRow}>
            <Text style={[styles.itemLabel, { color: theme.textMuted }]}>{item.label}</Text>
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
    paddingVertical: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.md,
  },
  header: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  title: {
    ...Typography.sectionTitle,
  },
  edit: {
    minHeight: 32,
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
    gap: Spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.lg,
  },
  itemLabel: {
    ...Typography.helper,
    flex: 1,
  },
  itemValue: {
    ...Typography.bodyStrong,
    flex: 1.35,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
});
