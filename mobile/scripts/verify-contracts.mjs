import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(here, '..');
const repoRoot = path.resolve(mobileRoot, '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

const protocol = readJson('config/collection_protocol.json');
const validation = readJson('config/validation_rules.json');
const workflow = readJson('config/workflow_states.json');
const firebase = readJson('config/firebase_schema.json');

const failures = [];
const unique = (values) => new Set(values).size === values.length;

const required = protocol.requiredCoreParameters ?? [];
const optional = protocol.optionalParameters ?? [];
const testTypes = protocol.testTypeChoices ?? [];
const collectedParameters = [...required, ...optional].filter((code) => code !== 'WATER_TEMP_C');

if (!unique([...required, ...optional])) {
  failures.push('Collection protocol parameter codes must be unique across required and optional lists.');
}

for (const code of collectedParameters) {
  const parameter = validation.parameters?.[code];
  if (!parameter || typeof parameter.unit !== 'string' || parameter.unit.trim() === '') {
    failures.push(`Mobile-collected parameter ${code} is missing a Phase 10 validation unit.`);
  }
}

for (const testType of testTypes) {
  const profile = validation.testTypeProfiles?.[testType];
  if (!profile) {
    failures.push(`Test type "${testType}" is missing a Phase 10 validation profile.`);
    continue;
  }
  for (const code of profile.requiredMeasurements ?? []) {
    if (!collectedParameters.includes(code)) {
      failures.push(`Test type "${testType}" requires ${code}, which the mobile protocol does not collect.`);
    }
  }
  if (!Number.isInteger(profile.minimumMeasurementCount) || profile.minimumMeasurementCount < 0) {
    failures.push(`Test type "${testType}" has an invalid minimumMeasurementCount.`);
  }
}

const workflowStates = new Set(workflow.states ?? []);
for (const state of [
  'DRAFT',
  'SUBMITTED',
  'VALIDATING',
  'PENDING_REVIEW',
  'NEEDS_CORRECTION',
  'RESUBMITTED',
  'APPROVED',
  'REJECTED',
  'PUBLISHING',
  'PUBLISH_FAILED',
  'PUBLISHED',
]) {
  if (!workflowStates.has(state)) failures.push(`Workflow state ${state} is missing from the canonical contract.`);
}

const clientTransitions = new Set(firebase.workflowTransitions?.clientAllowed ?? []);
if (!clientTransitions.has('DRAFT -> SUBMITTED')) {
  failures.push('Firebase contract no longer permits the collector DRAFT -> SUBMITTED transition.');
}
if (!clientTransitions.has('NEEDS_CORRECTION -> RESUBMITTED')) {
  failures.push('Firebase contract no longer permits the collector NEEDS_CORRECTION -> RESUBMITTED transition.');
}

if (firebase.privacy?.collectorCanWriteQualityScores !== false) {
  failures.push('Collector must never be permitted to write server quality scores.');
}
if (firebase.privacy?.collectorCanWriteReviewFields !== false) {
  failures.push('Collector must never be permitted to write review fields.');
}
if (firebase.privacy?.collectorCanWritePublicationFields !== false) {
  failures.push('Collector must never be permitted to write publication fields.');
}
if (firebase.collections?.siteCatalog?.purpose?.toLowerCase().includes('landowner') !== true) {
  failures.push('Site catalog contract must explicitly retain the mobile-safe/no-landowner privacy boundary.');
}

const temperature = firebase.temperatureBehavior;
if (temperature?.storeEnteredValueAndUnit !== true || temperature?.storeBothDerivedValues !== true) {
  failures.push('Firebase temperature contract must preserve entered value/unit and both derived values.');
}

if (failures.length > 0) {
  console.error('Phase 11 mobile contract guard failed:\n');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Phase 11 mobile contract guard passed.');
