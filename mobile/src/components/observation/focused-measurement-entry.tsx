import { useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  NumericKeyboardAccessory,
  numericKeyboardAccessoryId,
} from '@/components/observation/numeric-keyboard-accessory';
import { MaxContentWidth, MinTouchTarget, Spacing, Typography } from '@/constants/theme';
import { numericTextIsFinite } from '@/features/observations/measurement-presentation';
import { useTheme } from '@/hooks/use-theme';

export type MeasurementUnitOption = {
  value: string;
  label: string;
  accessibilityLabel: string;
};

type FocusedMeasurementEntryProps = {
  visible: boolean;
  label: string;
  required: boolean;
  value: string;
  units: readonly MeasurementUnitOption[];
  selectedUnit: string | null;
  allowNegative?: boolean;
  error?: string | null;
  derivePreview?: (value: string, unit: string) => string | null;
  convertValue?: (value: string, fromUnit: string, toUnit: string) => string;
  onCancel: () => void;
  onSave: (value: string, unit: string) => void;
};

export function FocusedMeasurementEntry({
  visible,
  label,
  required,
  value,
  units,
  selectedUnit,
  allowNegative = false,
  error,
  derivePreview,
  convertValue,
  onCancel,
  onSave,
}: FocusedMeasurementEntryProps) {
  const theme = useTheme();
  const inputRef = useRef<TextInput>(null);
  const { fontScale, width } = useWindowDimensions();
  const compact = width < 390 || fontScale > 1.25;
  const [pendingValue, setPendingValue] = useState(value);
  const [pendingUnit, setPendingUnit] = useState(selectedUnit);
  const [localError, setLocalError] = useState<string | null>(null);

  const preview = pendingUnit ? derivePreview?.(pendingValue, pendingUnit) : null;
  const currentUnit = units.find(({ value: candidate }) => candidate === pendingUnit);

  function validationIssue() {
    if (!pendingUnit) return 'Choose the unit used by the instrument.';
    if (!pendingValue.trim()) return required ? `Enter a ${label.toLowerCase()} reading.` : null;
    if (!numericTextIsFinite(pendingValue)) return 'Enter a valid number.';
    return null;
  }

  function save() {
    const issue = validationIssue();
    if (issue) {
      setLocalError(issue);
      return;
    }
    onSave(pendingValue.trim(), pendingUnit!);
  }

  function selectUnit(nextUnit: string) {
    setPendingValue((current) =>
      pendingUnit && convertValue && numericTextIsFinite(current)
        ? convertValue(current, pendingUnit, nextUnit)
        : current,
    );
    setPendingUnit(nextUnit);
    setLocalError(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onCancel}
      onShow={() => {
        setPendingValue(value);
        setPendingUnit(selectedUnit);
        setLocalError(null);
        if (selectedUnit) requestAnimationFrame(() => inputRef.current?.focus());
      }}
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      visible={visible}>
      <SafeAreaView
        accessibilityViewIsModal
        edges={['top', 'right', 'bottom', 'left']}
        style={[styles.safeArea, { backgroundColor: theme.surface }]}>
        <View style={styles.keyboardAvoider}>
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={({ pressed }) => [
                styles.headerAction,
                { backgroundColor: pressed ? theme.secondaryPressed : 'transparent' },
              ]}>
              <Text style={[styles.headerActionText, { color: theme.primary }]}>Cancel</Text>
            </Pressable>
            <View accessibilityElementsHidden style={styles.headerSpacer} />
            <Pressable
              accessibilityRole="button"
              onPress={save}
              style={({ pressed }) => [
                styles.headerAction,
                { backgroundColor: pressed ? theme.secondaryPressed : 'transparent' },
              ]}>
              <Text style={[styles.headerActionText, { color: theme.primary, fontWeight: '700' }]}>Done</Text>
            </Pressable>
          </View>

          <View style={[styles.content, compact && styles.contentCompact]}>
            <View style={styles.heading}>
              <Text style={[styles.context, { color: theme.textSecondary }]}>
                {required ? 'REQUIRED MEASUREMENT' : 'OPTIONAL MEASUREMENT'}
              </Text>
              <Text accessibilityRole="header" style={[styles.title, { color: theme.textPrimary }]}>
                {label}
              </Text>
            </View>

            {units.length > 1 ? (
              <View
                accessibilityLabel={`${label} unit`}
                accessibilityRole="radiogroup"
                style={[styles.unitSelector, { borderBottomColor: theme.border }]}>
                {units.map((unit) => {
                  const selected = unit.value === pendingUnit;
                  return (
                    <Pressable
                      key={unit.value}
                      accessibilityLabel={unit.accessibilityLabel}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => selectUnit(unit.value)}
                      style={({ pressed }) => [
                        styles.unitChoice,
                        {
                          backgroundColor: selected
                            ? theme.primarySoft
                            : pressed
                              ? theme.secondaryPressed
                              : 'transparent',
                          borderBottomColor: selected ? theme.primary : 'transparent',
                        },
                      ]}>
                      <Text
                        style={[
                          styles.unitChoiceText,
                          { color: selected ? theme.primary : theme.textSecondary },
                        ]}>
                        {unit.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <View style={styles.readingStage}>
              <View
                style={[
                  styles.inputLine,
                  {
                    borderBottomColor: localError || error ? theme.danger : theme.focus,
                    backgroundColor: theme.surface,
                  },
                ]}>
                <TextInput
                  ref={inputRef}
                  accessibilityLabel={`${label} value${currentUnit ? ` in ${currentUnit.accessibilityLabel}` : ''}`}
                  accessibilityHint={localError ?? error ?? preview ?? undefined}
                  accessibilityState={{ disabled: !pendingUnit }}
                  editable={pendingUnit != null}
                  inputAccessoryViewID={numericKeyboardAccessoryId}
                  keyboardType={
                    Platform.OS === 'ios'
                      ? allowNegative
                        ? 'numbers-and-punctuation'
                        : 'decimal-pad'
                      : 'numeric'
                  }
                  onChangeText={(next) => {
                    setPendingValue(next);
                    setLocalError(null);
                  }}
                  placeholder={pendingUnit ? 'Enter' : 'Choose unit'}
                  placeholderTextColor={theme.textMuted}
                  selectTextOnFocus
                  selectionColor={theme.primary}
                  style={[
                    styles.input,
                    compact && styles.inputCompact,
                    { color: pendingUnit ? theme.textPrimary : theme.disabledText },
                  ]}
                  testID="focused-measurement-input"
                  value={pendingValue}
                />
                {currentUnit ? (
                  <Text style={[styles.inputUnit, { color: theme.textSecondary }]}>
                    {currentUnit.label}
                  </Text>
                ) : null}
              </View>

              {localError || error ? (
                <Text
                  accessibilityLiveRegion="polite"
                  accessibilityRole="alert"
                  style={[styles.feedback, { color: theme.danger }]}>
                  {localError ?? error}
                </Text>
              ) : preview ? (
                <Text accessibilityLiveRegion="polite" style={[styles.preview, { color: theme.textSecondary }]}>
                  {preview}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
        <NumericKeyboardAccessory onDone={save} />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardAvoider: {
    flex: 1,
  },
  header: {
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerAction: {
    minWidth: 72,
    minHeight: MinTouchTarget,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionText: {
    ...Typography.body,
  },
  headerSpacer: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxl,
    gap: Spacing.xxl,
  },
  contentCompact: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xl,
    gap: Spacing.xl,
  },
  heading: {
    gap: Spacing.xs,
  },
  context: {
    ...Typography.eyebrow,
  },
  title: {
    ...Typography.screenTitle,
  },
  unitSelector: {
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  unitChoice: {
    minHeight: 52,
    flex: 1,
    borderBottomWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  unitChoiceText: {
    ...Typography.bodyStrong,
  },
  readingStage: {
    gap: Spacing.sm,
  },
  inputLine: {
    minHeight: 96,
    borderBottomWidth: 2,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 94,
    paddingVertical: Spacing.xs,
    fontSize: 64,
    lineHeight: 72,
    fontWeight: '500',
    letterSpacing: -1.6,
    fontVariant: ['tabular-nums'],
  },
  inputCompact: {
    fontSize: 52,
    lineHeight: 60,
  },
  inputUnit: {
    ...Typography.sectionTitle,
    paddingBottom: 17,
  },
  feedback: {
    ...Typography.helper,
  },
  preview: {
    ...Typography.body,
    fontVariant: ['tabular-nums'],
  },
});
