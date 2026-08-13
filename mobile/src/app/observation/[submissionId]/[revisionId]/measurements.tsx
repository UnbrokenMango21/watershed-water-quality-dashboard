import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';

import { DraftGate } from '@/components/observation/draft-gate';
import { MeasurementField } from '@/components/observation/measurement-field';
import { ProgressHeader } from '@/components/observation/progress-header';
import { TemperatureField, type TemperatureUnit } from '@/components/observation/temperature-field';
import { PrimaryButton } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { InlineAlert, SyncStatus } from '@/components/ui/status';
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
  spokenUnitForParameter,
  unitLabelForParameter,
} from '@/features/observations/measurement-presentation';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useObservationDraft } from '@/hooks/use-observation-draft';
import { useDrafts } from '@/providers/draft-provider';
import { createMeasurementId } from '@/services/firestore';
import { trackScreenView } from '@/services/analytics';

type MeasurementErrors = Record<string, string | undefined> & {
  temperature?: string;
  minimum?: string;
};

const coreParameterCodes = collectionProtocol.requiredCoreParameters.filter(
  (code) => code !== 'WATER_TEMP_C',
);
const allParameterCodes = [...coreParameterCodes, ...collectionProtocol.optionalParameters].filter(
  (code, index, all) => all.indexOf(code) === index,
);

export default function MeasurementsStep() {
  const theme = useTheme();
  const router = useRouter();
  const { draft, loading, routeParams, submissionId, revisionId, updateDraft } = useObservationDraft();
  const { flushDraft, retrySync, transportFor } = useDrafts();
  const [errors, setErrors] = useState<MeasurementErrors>({});

  useEffect(() => {
    void trackScreenView('measurements');
  }, []);

  if (!draft) return <DraftGate loading={loading} />;

  const requiredCodes = new Set(requiredMeasurementsFor(draft.testType ?? ''));
  const requiredParameterCodes = allParameterCodes.filter((code) => requiredCodes.has(code));
  const optionalParameterCodes = allParameterCodes.filter((code) => !requiredCodes.has(code));
  const transport = transportFor(submissionId);

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

  function updateTemperature(valueText: string, unit: TemperatureUnit) {
    const numeric = Number(valueText);
    const valid = numericTextIsFinite(valueText);
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
    if (!draft?.temperatureEnteredUnit) next.temperature = 'Choose °C or °F.';
    else if (!numericTextIsFinite(draft.temperatureEnteredValueText ?? '')) {
      next.temperature = 'Enter a numeric water temperature.';
    }

    let finiteMeasurementCount = 0;
    let requiredMeasurementMissing = false;
    for (const parameterCode of allParameterCodes) {
      const value = entryFor(parameterCode)?.valueText ?? '';
      if (numericTextIsFinite(value)) finiteMeasurementCount += 1;
      else if (value.trim()) next[parameterCode] = 'Enter a valid number.';
      else if (requiredCodes.has(parameterCode)) {
        next[parameterCode] = 'Enter this measurement.';
        requiredMeasurementMissing = true;
      }
    }

    const minimum = minimumMeasurementCountFor(draft?.testType ?? '');
    if (!requiredMeasurementMissing && finiteMeasurementCount < minimum) {
      next.minimum = `Enter at least ${minimum} measurement${minimum === 1 ? '' : 's'} for this test type.`;
    }
    setErrors(next);

    if (Object.values(next).some(Boolean)) {
      void AccessibilityInfo.announceForAccessibility('Correct the measurement entries before review.');
      return;
    }

    router.push({
      pathname: '/observation/[submissionId]/[revisionId]/review',
      params: routeParams,
    });
  }

  function renderMeasurement(parameterCode: string, required: boolean) {
    const unit = displayUnitForParameter(parameterCode);
    return (
      <MeasurementField
        key={parameterCode}
        allowNegative={parameterCode === 'ORP_MV'}
        error={errors[parameterCode]}
        label={labelForParameter(parameterCode)}
        onCommit={(value) => updateMeasurement(parameterCode, value)}
        required={required}
        selectedUnit={unit}
        testID={`measurement-${parameterCode}`}
        units={[
          {
            value: unit,
            label: unit,
            accessibilityLabel: spokenUnitForParameter(parameterCode),
          },
        ]}
        value={entryFor(parameterCode)?.valueText ?? ''}
      />
    );
  }

  const completedRequired =
    (draft.temperatureEnteredUnit && numericTextIsFinite(draft.temperatureEnteredValueText ?? '') ? 1 : 0) +
    requiredParameterCodes.filter((code) => numericTextIsFinite(entryFor(code)?.valueText ?? '')).length;
  const requiredTotal = requiredParameterCodes.length + 1;
  const optionalEntered = optionalParameterCodes.filter((code) =>
    numericTextIsFinite(entryFor(code)?.valueText ?? ''),
  ).length;
  const minimum = minimumMeasurementCountFor(draft.testType ?? '');
  const needsAdditionalChoice = minimum > requiredParameterCodes.length;

  return (
    <AppScreen edges={['right', 'bottom', 'left']} contentStyle={styles.content}>
      <ProgressHeader current="Measurements" />

      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.textPrimary }]}>
            Measurements
          </Text>
          <SyncStatus
            onRetry={
              transport.status === 'failed'
                ? () => {
                    if (draft.syncIntent) retrySync(submissionId);
                    else void flushDraft(submissionId);
                  }
                : undefined
            }
            status={transport.status}
          />
        </View>
        <Text style={[styles.completion, { color: theme.textSecondary }]}>
          {completedRequired} of {requiredTotal} required readings complete
        </Text>
      </View>

      {!draft.testType ? (
        <InlineAlert
          tone="danger"
          title="Test type is missing"
          body="Return to Collection Method before entering readings."
        />
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Required Measurements</Text>
          <Text style={[styles.sectionCount, { color: theme.textSecondary }]}>
            {completedRequired}/{requiredTotal}
          </Text>
        </View>
        <View style={[styles.instrumentList, { borderTopColor: theme.border, borderBottomColor: theme.border }]}>
          <TemperatureField
            error={errors.temperature}
            onCommit={updateTemperature}
            unit={draft.temperatureEnteredUnit ?? null}
            value={draft.temperatureEnteredValueText ?? ''}
          />
          {requiredParameterCodes.map((code) => renderMeasurement(code, true))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Optional Measurements</Text>
          <Text style={[styles.sectionCount, { color: theme.textSecondary }]}>
            {optionalEntered > 0 ? `${optionalEntered} entered` : 'Add as available'}
          </Text>
        </View>
        {needsAdditionalChoice ? (
          <Text style={[styles.actionableNote, { color: theme.textSecondary }]}>
            Add at least {minimum} measurement{minimum === 1 ? '' : 's'} for this test type.
          </Text>
        ) : null}
        <View style={[styles.instrumentList, { borderTopColor: theme.border, borderBottomColor: theme.border }]}>
          {optionalParameterCodes.map((code) => renderMeasurement(code, false))}
        </View>
      </View>

      {errors.minimum ? <InlineAlert tone="danger" title={errors.minimum} /> : null}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Notes</Text>
        <TextField
          helper="Do not include landowner names, contact details, or private access instructions."
          inputStyle={styles.notesInput}
          label="Field Notes"
          multiline
          onChangeText={(value) => updateDraft(submissionId, { fieldNotes: value })}
          placeholder="Conditions relevant to this observation"
          requirement="optional"
          textAlignVertical="top"
          value={draft.fieldNotes ?? ''}
        />
      </View>

      <PrimaryButton disabled={!draft.testType} label="Review Observation" onPress={validate} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.xxl,
  },
  header: {
    gap: Spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  title: {
    ...Typography.screenTitle,
  },
  completion: {
    ...Typography.helper,
    fontVariant: ['tabular-nums'],
  },
  section: {
    gap: Spacing.sm,
  },
  sectionHeading: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.sectionTitle,
  },
  sectionCount: {
    ...Typography.caption,
    fontVariant: ['tabular-nums'],
  },
  actionableNote: {
    ...Typography.helper,
  },
  instrumentList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  notesInput: {
    minHeight: 104,
    paddingTop: Spacing.sm,
  },
});
