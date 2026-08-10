import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, TextInput, View } from 'react-native';

import { DraftGate } from '@/components/observation/draft-gate';
import { ProgressHeader } from '@/components/observation/progress-header';
import { PrimaryButton } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { ListRow } from '@/components/ui/list-row';
import { ScreenIntro } from '@/components/ui/screen-intro';
import { AppScreen } from '@/components/ui/surface';
import { testTypeChoices } from '@/config/contracts';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useObservationDraft } from '@/hooks/use-observation-draft';
import { trackScreenView } from '@/services/analytics';

type MethodErrors = {
  testType?: string;
  testTypeOther?: string;
  dataCollectedBy?: string;
  methodName?: string;
  instrumentName?: string;
};

export default function MethodStep() {
  const theme = useTheme();
  const router = useRouter();
  const { draft, loading, routeParams, submissionId, updateDraft } = useObservationDraft();
  const [errors, setErrors] = useState<MethodErrors>({});
  const otherRef = useRef<TextInput>(null);
  const collectorRef = useRef<TextInput>(null);
  const methodRef = useRef<TextInput>(null);
  const instrumentRef = useRef<TextInput>(null);

  useEffect(() => {
    void trackScreenView('method');
  }, []);

  if (!draft) return <DraftGate loading={loading} />;

  function validate() {
    const next: MethodErrors = {};
    if (!draft?.testType) next.testType = 'Choose a test type.';
    if (draft?.testType === 'Other' && !draft.testTypeOther?.trim()) {
      next.testTypeOther = 'Describe the test type.';
    }
    if (!draft?.dataCollectedBy?.trim()) next.dataCollectedBy = 'Enter the collector role or source.';
    if (!draft?.methodName?.trim()) next.methodName = 'Enter the method used.';
    if (!draft?.instrumentName?.trim()) next.instrumentName = 'Enter the instrument or lab source.';
    setErrors(next);

    const firstError = Object.keys(next)[0] as keyof MethodErrors | undefined;
    if (firstError) {
      void AccessibilityInfo.announceForAccessibility('Complete the required method and provenance fields.');
      if (firstError === 'testTypeOther') otherRef.current?.focus();
      if (firstError === 'dataCollectedBy') collectorRef.current?.focus();
      if (firstError === 'methodName') methodRef.current?.focus();
      if (firstError === 'instrumentName') instrumentRef.current?.focus();
      return;
    }

    router.push({
      pathname: '/observation/[submissionId]/[revisionId]/measurements',
      params: routeParams,
    });
  }

  return (
    <AppScreen edges={['right', 'bottom', 'left']} contentStyle={styles.content}>
      <ProgressHeader current="Method" />
      <ScreenIntro
        eyebrow="HOW IT WAS MEASURED"
        title="Method & provenance"
        body="Record enough context for each measurement to remain scientifically traceable."
      />

      <View style={styles.section}>
        <View style={styles.headingRow}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Test type</Text>
          <Text style={[styles.required, { color: theme.textSecondary }]}>Required</Text>
        </View>
        {testTypeChoices.map((choice) => (
          <ListRow
            key={choice}
            onPress={() => {
              updateDraft(submissionId, {
                testType: choice,
                testTypeOther: choice === 'Other' ? draft.testTypeOther : undefined,
              });
              setErrors((current) => ({ ...current, testType: undefined }));
            }}
            selected={draft.testType === choice}
            title={choice}
          />
        ))}
        {errors.testType ? (
          <Text
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            style={[styles.error, { color: theme.danger }]}>
            {errors.testType}
          </Text>
        ) : null}
        {draft.testType === 'Other' ? (
          <TextField
            error={errors.testTypeOther}
            inputRef={otherRef}
            label="Other test type"
            onChangeText={(value) => {
              updateDraft(submissionId, { testTypeOther: value });
              setErrors((current) => ({ ...current, testTypeOther: undefined }));
            }}
            placeholder="Describe the test type"
            requirement="required"
            value={draft.testTypeOther ?? ''}
          />
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Provenance</Text>
        <TextField
          error={errors.dataCollectedBy}
          helper="For example: student/researcher, watershed staff, or partner lab."
          inputRef={collectorRef}
          label="Data collected by"
          onChangeText={(value) => {
            updateDraft(submissionId, { dataCollectedBy: value });
            setErrors((current) => ({ ...current, dataCollectedBy: undefined }));
          }}
          placeholder="Collector role or source"
          requirement="required"
          returnKeyType="next"
          onSubmitEditing={() => methodRef.current?.focus()}
          value={draft.dataCollectedBy ?? ''}
        />
        <TextField
          error={errors.methodName}
          inputRef={methodRef}
          label="Measurement method"
          onChangeText={(value) => {
            updateDraft(submissionId, { methodName: value });
            setErrors((current) => ({ ...current, methodName: undefined }));
          }}
          placeholder="Method or protocol used"
          requirement="required"
          returnKeyType="next"
          onSubmitEditing={() => instrumentRef.current?.focus()}
          value={draft.methodName ?? ''}
        />
        <TextField
          error={errors.instrumentName}
          helper="Use the meter ID, kit name, sonde, or laboratory source."
          inputRef={instrumentRef}
          label="Instrument or lab source"
          onChangeText={(value) => {
            updateDraft(submissionId, { instrumentName: value });
            setErrors((current) => ({ ...current, instrumentName: undefined }));
          }}
          placeholder="Instrument, kit, or lab"
          requirement="required"
          returnKeyType="done"
          value={draft.instrumentName ?? ''}
        />
      </View>

      <PrimaryButton label="Next: Measurements" onPress={validate} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.xl,
  },
  section: {
    gap: Spacing.sm,
  },
  headingRow: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.sectionTitle,
  },
  required: {
    ...Typography.caption,
  },
  error: {
    ...Typography.helper,
  },
});
