import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const readConfig = (name) => JSON.parse(readFileSync(new URL(`../../config/${name}`, import.meta.url)));
const golden = JSON.parse(readFileSync(new URL('../mobile-contract-fixtures/mobile_golden.json', import.meta.url)));

function deterministicMeasurementId(revisionId, parameterCode) {
  const bytes = createHash('sha256').update(`${revisionId}|${parameterCode}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

test('parameter catalog contains every Phase 10 runtime measurement code', () => {
  const protocol = readConfig('collection_protocol.json');
  const validation = readConfig('validation_rules.json');
  const catalog = readConfig('parameter_catalog.json');
  const catalogCodes = new Set(catalog.parameters.map(({ code }) => code));
  const runtimeCodes = new Set([
    ...protocol.requiredCoreParameters.filter((code) => code !== 'WATER_TEMP_C'),
    ...protocol.optionalParameters,
    ...Object.keys(validation.parameters),
  ]);

  assert.deepEqual(
    [...runtimeCodes].filter((code) => !catalogCodes.has(code)),
    [],
    'parameter_catalog.json must use the canonical Phase 10 runtime codes',
  );
});

test('workflow states allow every validation persistence outcome', () => {
  const workflow = readConfig('workflow_states.json');
  const persistence = readConfig('validation_persistence_contract.json');
  const transitions = new Set(workflow.transitions.map(({ from, to }) => `${from} -> ${to}`));

  for (const outcome of Object.values(persistence.validationOutcomeTransitions)) {
    assert.ok(
      transitions.has(`VALIDATING -> ${outcome}`),
      `workflow_states.json must include VALIDATING -> ${outcome}`,
    );
  }
});

test('production measurement catalog classifies every approved UI measurement exactly once', () => {
  const production = readConfig('production_measurement_catalog.json');
  const protocol = readConfig('collection_protocol.json');
  const keys = production.measurements.map(({ uiKey }) => uiKey);
  const expectedKeys = [
    'temperature', 'ph', 'dissolvedOxygen', 'dissolvedOxygenSaturation', 'conductivity', 'tds',
    'orp', 'chloride', 'sulfate', 'nitrate', 'phosphate', 'flow', 'turbidity', 'salinity',
    'totalSuspendedSolids', 'alkalinity', 'hardness', 'ammoniaNitrogen', 'nitriteNitrogen',
    'totalPhosphorus', 'chlorophyllA', 'eColi',
  ];

  assert.deepEqual(keys, expectedKeys);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(production.measurements.every(({ support }) => ['FULLY_SUPPORTED', 'FEATURE_GATED'].includes(support)));

  const supportedCodes = new Set(
    production.measurements
      .filter(({ support, serializationTarget }) => support === 'FULLY_SUPPORTED' && serializationTarget === 'measurement')
      .map(({ parameterCode }) => parameterCode),
  );
  assert.deepEqual(
    supportedCodes,
    new Set([...protocol.requiredCoreParameters, ...protocol.optionalParameters].filter((code) => code !== 'WATER_TEMP_C')),
  );
  assert.ok(production.measurements.filter(({ support }) => support === 'FEATURE_GATED').every(({ parameterCode }) => parameterCode == null));
});

test('mobile golden fixtures use exact test types and deterministic retry-stable measurement IDs', () => {
  assert.deepEqual(golden.testTypes, readConfig('collection_protocol.json').testTypeChoices);

  for (const fixture of golden.serializationCases) {
    assert.ok(golden.testTypes.includes(fixture.input.testType));
    for (const measurement of fixture.input.measurements) {
      const expectedId = deterministicMeasurementId(fixture.input.revisionId, measurement.parameterCode);
      const serialized = fixture.expected?.measurements?.find(({ parameter_code }) => parameter_code === measurement.parameterCode);
      const identityId = fixture.expectedIdentity?.measurement_id;
      assert.equal(serialized?.measurement_id ?? identityId, expectedId);
      assert.equal(Number.isFinite(measurement.canonicalValue), true);
    }
  }
});
