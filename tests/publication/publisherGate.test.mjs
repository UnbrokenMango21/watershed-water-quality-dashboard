import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const inspect = `
  const functions = await import('./functions/index.mjs');
  const { declaredParams } = await import('firebase-functions/params');
  console.log(JSON.stringify({
    publisher: typeof functions.publishApprovedObservation,
    params: declaredParams.map((param) => param.toSpec().name),
  }));
`;

function discover(enabled, featureServiceUrl) {
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', inspect], {
    cwd: new URL('../..', import.meta.url),
    env: {
      ...process.env,
      ENABLE_ARCGIS_PUBLICATION_FUNCTION: enabled ? 'true' : 'false',
      ARCGIS_PUBLICATION_FEATURE_SERVICE_URL: featureServiceUrl,
    },
    encoding: 'utf8',
  });
  return JSON.parse(output);
}

test('validation-only deployments do not declare publisher secrets', () => {
  for (const [enabled, url] of [[false, ''], [false, 'https://example.test/FeatureServer'], [true, '']]) {
    const build = discover(enabled, url);
    assert.equal(build.publisher, 'undefined');
    assert.ok(build.params.includes('ENABLE_ARCGIS_PUBLICATION_FUNCTION'));
    assert.ok(!build.params.includes('ARCGIS_OAUTH_CLIENT_ID'));
    assert.ok(!build.params.includes('ARCGIS_OAUTH_CLIENT_SECRET'));
  }
});

test('publisher and its secrets are declared only with both activation settings', () => {
  const build = discover(true, 'https://example.test/FeatureServer');
  assert.equal(build.publisher, 'function');
  assert.ok(build.params.includes('ARCGIS_OAUTH_CLIENT_ID'));
  assert.ok(build.params.includes('ARCGIS_OAUTH_CLIENT_SECRET'));
});
