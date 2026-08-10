import NativeDateTimePicker from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Radii, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { AppIcon } from '../ui/app-icon';

type DateTimeFieldsProps = {
  value: Date;
  onChange: (value: Date) => void;
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
});

function mergePickerValue(current: Date, selected: Date, mode: 'date' | 'time') {
  const merged = new Date(current);
  if (mode === 'date') {
    merged.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
  } else {
    merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
  }
  return merged;
}

export function DateTimeFields({ value, onChange }: DateTimeFieldsProps) {
  const theme = useTheme();
  const [androidMode, setAndroidMode] = useState<'date' | 'time' | null>(null);

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.group}>
        <View style={[styles.nativeRow, { borderBottomColor: theme.border }]}>
          <Text style={[styles.label, { color: theme.textPrimary }]}>Collection date</Text>
          <NativeDateTimePicker
            accentColor={theme.primary}
            display="compact"
            mode="date"
            onValueChange={(_, date) => onChange(mergePickerValue(value, date, 'date'))}
            testID="collection-date-picker"
            value={value}
          />
        </View>
        <View style={[styles.nativeRow, { borderBottomColor: theme.border }]}>
          <Text style={[styles.label, { color: theme.textPrimary }]}>Collection time</Text>
          <NativeDateTimePicker
            accentColor={theme.primary}
            display="compact"
            mode="time"
            onValueChange={(_, date) => onChange(mergePickerValue(value, date, 'time'))}
            testID="collection-time-picker"
            value={value}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.group}>
      <AndroidDateTimeRow
        label="Collection date"
        onPress={() => setAndroidMode('date')}
        value={dateFormatter.format(value)}
      />
      <AndroidDateTimeRow
        label="Collection time"
        onPress={() => setAndroidMode('time')}
        value={timeFormatter.format(value)}
      />
      {androidMode ? (
        <NativeDateTimePicker
          accentColor={theme.primary}
          mode={androidMode}
          negativeButton={{ label: 'Cancel' }}
          onDismiss={() => setAndroidMode(null)}
          onValueChange={(_, date) => {
            onChange(mergePickerValue(value, date, androidMode));
            setAndroidMode(null);
          }}
          positiveButton={{ label: 'Set' }}
          presentation="dialog"
          value={value}
        />
      ) : null}
    </View>
  );
}

function AndroidDateTimeRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.androidRow,
        {
          backgroundColor: pressed ? theme.secondaryPressed : theme.surface,
          borderColor: theme.controlBorder,
        },
      ]}>
      <View style={styles.androidCopy}>
        <Text style={[styles.label, { color: theme.textPrimary }]}>{label}</Text>
        <Text style={[styles.value, { color: theme.textSecondary }]}>{value}</Text>
      </View>
      <AppIcon name="chevronRight" color={theme.textMuted} size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.xs,
  },
  nativeRow: {
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  label: {
    ...Typography.label,
    flexShrink: 1,
  },
  androidRow: {
    minHeight: 64,
    borderWidth: 1,
    borderRadius: Radii.input,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  androidCopy: {
    flex: 1,
    gap: Spacing.xxs,
  },
  value: {
    ...Typography.body,
  },
});
