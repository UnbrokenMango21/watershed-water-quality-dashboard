import collectionProtocolJson from '../../../config/collection_protocol.json';
import firebaseSchemaJson from '../../../config/firebase_schema.json';
import validationRulesJson from '../../../config/validation_rules.json';
import workflowStatesJson from '../../../config/workflow_states.json';

type CollectionProtocolContract = {
  protocolVersion: string;
  requiredCoreParameters: string[];
  optionalParameters: string[];
  testTypeChoices: string[];
  otherRequiresText: boolean;
  gps: {
    preferredAccuracyM: number;
    acceptableAccuracyM: number;
    warningAccuracyM: number;
  };
};

type FirebaseSchemaContract = {
  version: string;
  temperatureBehavior: {
    displayPrecision: number;
  };
};

type ValidationRulesContract = {
  validationRulesVersion: string;
  classes: Record<string, { blocksReview: boolean; reducesQuality: boolean }>;
  testTypeProfiles: Record<
    string,
    { requiredMeasurements: string[]; minimumMeasurementCount: number }
  >;
  parameters: Record<string, { unit: string }>;
};

type WorkflowStatesContract = {
  states: string[];
};

export const collectionProtocol: CollectionProtocolContract = collectionProtocolJson;
export const firebaseSchema: FirebaseSchemaContract = firebaseSchemaJson;
export const validationRules: ValidationRulesContract = validationRulesJson;
export const workflowStates: WorkflowStatesContract = workflowStatesJson;

export const testTypeChoices = Object.freeze([...collectionProtocol.testTypeChoices]);
export const submissionStatuses = Object.freeze([...workflowStates.states]);
export const measurementParameterCodes = Object.freeze(
  [...collectionProtocol.requiredCoreParameters, ...collectionProtocol.optionalParameters].filter(
    (code, index, all) => code !== 'WATER_TEMP_C' && all.indexOf(code) === index,
  ),
);

export function requiredMeasurementsFor(testType: string): readonly string[] {
  return validationRules.testTypeProfiles[testType]?.requiredMeasurements ?? [];
}

export function minimumMeasurementCountFor(testType: string): number {
  return validationRules.testTypeProfiles[testType]?.minimumMeasurementCount ?? 0;
}

export function unitForParameter(parameterCode: string): string | null {
  return validationRules.parameters[parameterCode]?.unit ?? null;
}
