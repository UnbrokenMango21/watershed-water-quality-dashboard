import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import {
  FocusedMeasurementEntry,
  type MeasurementUnitOption,
} from '@/components/observation/focused-measurement-entry';
import { AppIcon } from '@/components/ui/app-icon';
import { MinTouchTarget, Spacing, Typography } from '@/constants/theme';
import { displayNumericText } from '@/features/observations/measurement-presentation';
import { useTheme } from '@/hooks/use-theme';

type MeasurementFieldProps = {
  label: string;
  value: string;
  units: readonly MeasurementUnitOption[];
  selectedUnit: string | null;
  onCommit: (value: string, unit: string) => void;
  required?: boolean;
  error?: string | null;
  derivedValue?: string | null;
  allowNegative?: boolean;
  derivePreview?: (value: string, unit: string) => string | null;
  convertValue?: (value: string, fromUnit: string, toUnit: string) => string;
  testID?: string;
};

export function MeasurementField({
  label,
  value,
  units,
  selectedUnit,
  onCommit,
  required = false,
  error,
  derivedValue,
  allowNegative = false,
  derivePreview,
  convertValue,
  testID,
}: MeasurementFieldProps) {
  const theme = useTheme();
  const { fontScale, width } = useWindowDimensions();
  const compact = width < 360 || fontScale > 1.25;
  const [editing, setEditing] = useState(false);
  const entered = value.trim().length > 0;
  const currentUnit = units.find(({ value: candidate }) => candidate === selectedUnit);
  const unitIsSelectable = units.length > 1;

  function openEditor() {
    setEditing(true);
  }

  return (
    <View style={styles.group}>
      <View
        style={[
          styles.row,
          compact && styles.rowCompact,
          {
            backgroundColor: theme.surface,
            borderBottomColor: error ? theme.danger : theme.border,
          },
        ]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}, ${entered ? displayNumericText(value) : 'not entered'}${currentUnit ? ` ${currentUnit.accessibilityLabel}` : ''}`}
          accessibilityHint="Opens focused measurement entry"
          onPress={openEditor}
          testID={testID}
          style={({ pressed }) => [
            styles.readingAction,
            compact && styles.readingActionCompact,
            { backgroundColor: pressed ? theme.secondaryPressed : 'transparent' },
          ]}>
          <Text style={[styles.label, { color: theme.textPrimary }]}>{label}</Text>
          <View style={[styles.valueBlock, compact && styles.valueBlockCompact]}>
            <Text
              style={[
                entered ? styles.value : styles.emptyValue,
                { color: entered ? theme.textPrimary : theme.primary },
              ]}>
              {entered ? displayNumericText(value) : 'Enter'}
            </Text>
            {derivedValue ? (
              <Text style={[styles.derived, { color: theme.textSecondary }]}>{derivedValue}</Text>
            ) : null}
          </View>
        </Pressable>

        {unitIsSelectable ? (
          <Pressable
            accessibilityLabel={`${label} unit${currentUnit ? `, ${currentUnit.accessibilityLabel}` : ', not selected'}`}
            accessibilityHint="Opens unit selection and measurement entry"
            accessibilityRole="button"
            onPress={openEditor}
            testID={testID ? `${testID}-unit` : undefined}
            style={({ pressed }) => [
              styles.unitAction,
              {
                backgroundColor: pressed ? theme.secondaryPressed : 'transparent',
                borderLeftColor: theme.border,
              },
            ]}>
            <Text style={[styles.unit, { color: theme.primary }]}>
              {currentUnit?.label ?? 'Unit'}
            </Text>
            <AppIcon name="chevronDown" color={theme.primary} size={14} />
          </Pressable>
        ) : (
          <View
            accessible
            accessibilityLabel={currentUnit?.accessibilityLabel}
            accessibilityRole="text"
            style={[styles.fixedUnit, { borderLeftColor: theme.border }]}>
            <Text style={[styles.unit, { color: theme.textSecondary }]}>{currentUnit?.label}</Text>
          </View>
        )}
      </View>

      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={[styles.error, { color: theme.danger }]}>
          {error}
        </Text>
      ) : null}

      <FocusedMeasurementEntry
        allowNegative={allowNegative}
        convertValue={convertValue}
        derivePreview={derivePreview}
        error={error}
        label={label}
        onCancel={() => setEditing(false)}
        onSave={(nextValue, nextUnit) => {
          onCommit(nextValue, nextUnit);
          setEditing(false);
        }}
        required={required}
        selectedUnit={selectedUnit}
        units={units}
        value={value}
        visible={editing}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    backgroundColor: 'transparent',
  },
  row: {
    minHeight: 76,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  rowCompact: {
    minHeight: 108,
  },
  readingAction: {
    flex: 1,
    minWidth: 0,
    minHeight: 76,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.sm,
    paddingVertical: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  readingActionCompact: {
    minHeight: 108,
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  label: {
    ...Typography.bodyStrong,
    flex: 1,
    minWidth: 0,
  },
  valueBlock: {
    minWidth: 76,
    alignItems: 'flex-end',
  },
  valueBlockCompact: {
    alignItems: 'flex-start',
  },
  value: {
    ...Typography.numeric,
    textAlign: 'right',
  },
  emptyValue: {
    ...Typography.label,
  },
  derived: {
    ...Typography.caption,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  unitAction: {
    minWidth: 76,
    minHeight: MinTouchTarget,
    borderLeftWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xxs,
  },
  fixedUnit: {
    minWidth: 76,
    minHeight: MinTouchTarget,
    borderLeftWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unit: {
    ...Typography.label,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  error: {
    ...Typography.helper,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
  },
});
