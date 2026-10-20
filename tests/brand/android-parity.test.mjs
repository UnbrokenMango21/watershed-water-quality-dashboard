import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const tokens = JSON.parse(readFileSync('config/brand_tokens.json', 'utf8'));
const kotlin = readFileSync('Phone App/Android App/app/src/main/java/org/watershed/pawatershedwatch/BrandTokens.kt', 'utf8');
const theme = readFileSync('Phone App/Android App/app/src/main/java/org/watershed/pawatershedwatch/Theme.kt', 'utf8');
const color = (value) => value === 'transparent' ? 'Color.Transparent' : 'Color(0xFF' + value.slice(1).toUpperCase() + ')';
const expectColor = (key, value) => assert.ok(kotlin.includes('val ' + key + ' = ' + color(value)), 'Android token drift: ' + key);

test('Android Compose light and dark tokens stay aligned with the canonical brand contract', () => {
  for (const [name, value] of Object.entries(tokens.palette))
    expectColor('palette' + name[0].toUpperCase() + name.slice(1), value);
  for (const [name, value] of Object.entries(tokens.semantic)) {
    expectColor(name, value.light);
    expectColor(name + 'Dark', value.dark);
  }
  for (const [tone, modes] of Object.entries(tokens.status)) {
    if (tone.startsWith('$')) continue;
    for (const part of ['bg', 'border', 'mark', 'text']) {
      const key = 'status' + tone[0].toUpperCase() + tone.slice(1) + part[0].toUpperCase() + part.slice(1);
      expectColor(key, modes.light[part]);
      expectColor(key + 'Dark', modes.dark[part]);
    }
  }
  for (const [state, tone] of Object.entries(tokens.workflowTone)) {
    if (state.startsWith('$')) continue;
    assert.ok(kotlin.includes('"' + state.toLowerCase() + '" to "' + tone + '"'), 'Missing Android workflow presentation tone: ' + state);
  }
});

test('Android Material themes derive their semantic colors from BrandTokens', () => {
  for (const semantic of ['primary', 'onPrimary', 'canvas', 'ink', 'surface', 'water', 'goldText', 'alert']) {
    assert.ok(theme.includes('BrandTokens.' + semantic), 'Light Material theme missing: ' + semantic);
    assert.ok(theme.includes('BrandTokens.' + semantic + 'Dark'), 'Dark Material theme missing: ' + semantic);
  }
  assert.ok(!/Color\(0xFF[0-9A-Fa-f]{6}\)/.test(theme), 'Hardcoded Material palette drift');
});
