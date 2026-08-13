import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readConfig = (name) => JSON.parse(readFileSync(new URL(`../../config/${name}`, import.meta.url)));

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
