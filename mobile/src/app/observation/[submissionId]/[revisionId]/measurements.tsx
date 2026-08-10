import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, TextInput, View } from 'react-native';

import { DraftGate } from '@/components/observation/draft-gate';
import { MeasurementField } from '@/components/observation/measurement-field';
import {
  NumericKeyboardAccessory,
  numericKeyboardAccessoryId,
} from '@/components/observation/numeric-keyboard-accessory';
import { ProgressHeader } from '@/components/observation/progress-header';
import { TemperatureField, type TemperatureUnit } from '@/components/observation/temperature-field';
import { PrimaryButton } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { ScreenIntro } from '@/components/ui/screen-intro';
import { InlineAlert } from '@/components/ui/status';
import { AppScreen } from '@/components/ui/surface';
import {
  collectionProtocol,
  minimumMeasurementCountFor,
  requiredMeasurementsFor,
} from '@/config/contracts';
import type { PartialObservationDraft } from '@/domain/types';
import {
  displayUnitForParameter,
  labelForParameter,
  numericTextIsFinite,
  unitLabelForParameter,
} from '@/features/observations/measurement-presentation';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useObservationDraft } from '@/hooks/use-observation-draft';
import { createMeasurementId } from '@/services/firestore';
import { trackScreenView } from '@/services/analytics';

type MeasurementErrors = Record<string, string | undefined> & {
  temperature?: string;
  minimum?: string;
};

const coreParameterCodes = collectionProtocol.requiredCoreParameters.filter(
  (code) => code !== 'WATER_TEMP_C',
);

export default function MeasurementsStep() {
  const theme = useTheme();
  const router = useRouter();
  const { draft, loading, routeParams, submissionId, revisionId, updateDraft } = useObservationDraft();
  const [errors, setErrors] = useState<MeasurementErrors>({});
  const [activeInput, setActiveInput] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, TextInput | null>>({});

  useEffect(() => {
    void trackScreenView('measurements');
  }, []);

  if (!draft) return <DraftGate loading={loading} />;

  const requiredCodes = new Set(requiredMeasurementsFor(draft.testType ?? ''));
  const inputOrder = ['temperature', ...coreParameterCodes, ...collectionProtocol.optionalParameters];
  const activeIndex = activeInput ? inputOrder.indexOf(activeInput) : -1;
  const nextInput = activeIndex >= 0 ? inputOrder[activeIndex + 1] : undefined;

  function entryFor(parameterCode: string) {
    return draft?.measurements.find((measurement) => measurement.parameterCode === parameterCode);
  }

  function updateMeasurement(parameterCode: string, valueText: string) {
    updateDraft(submissionId, (current) => {
      const existing = current.measurements.find(
        (measurement) => measurement.parameterCode === parameterCode,
      );
      const entry: PartialObservationDraft['measurements'][number] = {
        measurementId:
          existing?.measurementId ?? createMeasurementId(submissionId, revisionId),
        parameterCode,
        displayName: labelForParameter(parameterCode),
        valueText,
        unitCode: unitLabelForParameter(parameterCode),
        qualifier: existing?.qualifier,
        notes: existing?.notes,
      };
      return {
        measurements: existing
          ? current.measurements.map((measurement) =>
              measurement.parameterCode === parameterCode ? entry : measurement,
            )
          : [...current.measurements, entry],
      };
    });
    setErrors((current) => ({ ...current, [parameterCode]: undefined, minimum: undefined }));
  }

  function updateTemperature(valueText: string, unit = draft?.temperatureEnteredUnit) {
    const numeric = Number(valueText);
    const valid = valueText.trim().length > 0 && Number.isFinite(numeric) && unit != null;
    updateDraft(submissionId, {
      temperatureEnteredValueText: valueText,
      temperatureEnteredValue: valid ? numeric : undefined,
      temperatureEnteredUnit: unit,
      temperatureC: valid ? (unit === 'F' ? ((numeric - 32) * 5) / 9 : numeric) : undefined,
      temperatureF: valid ? (unit === 'C' ? (numeric * 9) / 5 + 32 : numeric) : undefined,
    });
    setErrors((current) => ({ ...current, temperature: undefined }));
  }

  function validate() {
    const next: MeasurementErrors = {};
    if (!draft?.temperatureEnteredUnit) next.temperature = 'Choose °C or °F before entering temperature.';
    else if (!numericTextIsFinite(draft.temperatureEnteredValueText ?? '')) {
      next.temperature = 'Enter a numeric water temperature.';
    }

    let finiteMeasurementCount = 0;
    for (const parameterCode of [...coreParameterCodes, ...collectionProtocol.optionalParameters]) {
      const value = entryFor(parameterCode)?.valueText ?? '';
      if (numericTextIsFinite(value)) finiteMeasurementCount += 1;
      else if (value.trim()) next[parameterCode] = 'Enter a number or clear this field.';
      else if (requiredCodes.has(parameterCode)) next[parameterCode] = 'Enter this required measurement.';
    }

    const minimum = minimumMeasurementCountFor(draft?.testType ?? '');
    if (finiteMeasurementCount < minimum) {
      next.minimum = `Enter at least ${minimum} measurement${minimum === 1 ? '' : 's'} for this test type.`;
    }
    setErrors(next);

    const firstError = inputOrder.find((code) =>
      code === 'temperature' ? next.temperature : next[code],
    );
    if (firstError || next.minimum) {
      void AccessibilityInfo.announceForAccessibility('Correct the measurement entries before review.');
      if (firstError) inputRefs.current[firstError]?.focus();
      return;
    }

    router.push({
      pathname: '/observation/[submissionId]/[revisionId]/review',
      params: routeParams,
    });
  }

  function renderMeasurement(parameterCode: string, required: boolean) {
    return (
      <MeasurementField
        key={parameterCode}
        allowNegative={parameterCode === 'ORP_MV'}
        error={errors[parameterCode]}
        inputAccessoryViewID={numericKeyboardAccessoryId}
        inputRef={(input) => {
          inputRefs.current[parameterCode] = input;
        }}
        label={labelForParameter(parameterCode)}
        onChangeText={(value) => updateMeasurement(parameterCode, value)}
        onInputFocus={() => setActiveInput(parameterCode)}
        placeholder="—"
        requirement={required ? 'required' : 'optional'}
        testID={`measurement-${parameterCode}`}
        unit={displayUnitForParameter(parameterCode)}
        value={entryFor(parameterCode)?.valueText ?? ''}
      />
    );
  }

  return (
    <>
      <AppScreen edges={['right', 'bottom', 'left']} contentStyle={styles.content}>
        <ProgressHeader current="Measurements" />
        <ScreenIntro
          eyebrow="FIELD READINGS"
          title="Enter measurements"
          body="Keep instrument units visible. Scientific plausibility remains a Phase 10 server decision."
        />

        {!draft.testType ? (
          <InlineAlert
            tone="danger"
            title="Test type is missing"
            body="Return to Method & provenance before reviewing measurements."
          />
        ) : null}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Water temperature</Text>
          <TemperatureField
            error={errors.temperature}
            inputAccessoryViewID={numericKeyboardAccessoryId}
            inputRef={(input) => {
              inputRefs.current.temperature = input;
            }}
            onChangeText={(value) => updateTemperature(value)}
            onInputFocus={() => setActiveInput('temperature')}
            onUnitChange={(unit: TemperatureUnit) => updateTemperature(draft.temperatureEnteredValueText ?? '', unit)}
            unit={draft.temperatureEnteredUnit ?? null}
            value={draft.temperatureEnteredValueText ?? ''}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Core measurements</Text>
            <Text style={[styles.sectionBody, { color: theme.textSecondary }]}>Requiredness follows the selected test type.</Text>
          </View>
          <View style={[styles.instrumentList, { borderTopColor: theme.border }]}>
            {coreParameterCodes.map((code) => renderMeasurement(code, requiredCodes.has(code)))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Additional measurements</Text>
            <Text style={[styles.sectionBody, { color: theme.textSecondary }]}>Optional · leave a field empty when it was not measured.</Text>
          </View>
          <View style={[styles.instrumentList, { borderTopColor: theme.border }]}>
            {collectionProtocol.optionalParameters.map((code) => renderMeasurement(code, requiredCodes.has(code)))}
          </View>
        </View>

        {errors.minimum ? <InlineAlert tone="danger" title={errors.minimum} /> : null}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Field notes</Text>
          <TextField
            helper="Optional. Do not enter landowner names, contact details, or private access instructions."
            inputStyle={styles.notesInput}
            label="Observation notes"
            multiline
            onChangeText={(value) => updateDraft(submissionId, { fieldNotes: value })}
            placeholder="Conditions or context relevant to this observation"
            requirement="optional"
            textAlignVertical="top"
            value={draft.fieldNotes ?? ''}
          />
        </View>

        <PrimaryButton disabled={!draft.testType} label="Next: Review" onPress={validate} />
      </AppScreen>
      <NumericKeyboardAccessory
        onNext={nextInput ? () => inputRefs.current[nextInput]?.focus() : undefined}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.xl,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionHeader: {
    gap: Spacing.xxs,
  },
  instrumentList: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    ...Typography.sectionTitle,
  },
  sectionBody: {
    ...Typography.helper,
  },
  notesInput: {
    minHeight: 120,
    paddingTop: Spacing.sm,
  },
});
