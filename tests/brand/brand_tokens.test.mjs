import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { targets } from '../../scripts/brand-tokens.mjs';

const root = new URL('../../', import.meta.url);
const readJson = (path) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const tokens = readJson('config/brand_tokens.json');

function luminance(hex) {
  const channel = (i) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test('generated platform token copies match config/brand_tokens.json', () => {
  for (const [path, expected] of targets()) {
    assert.equal(readFileSync(new URL(path, root), 'utf8'), expected, `${path} is stale; run node scripts/brand-tokens.mjs --write`);
  }
});

test('brand palette keeps the four product colors from the Brand Package', () => {
  assert.equal(tokens.palette.hemlock, '#0D5C4B');
  assert.equal(tokens.palette.deepWater, '#167A8B');
  assert.equal(tokens.palette.goldenrod, '#A76100');
  assert.equal(tokens.palette.fern, '#2E7D52');
});

for (const mode of ['light', 'dark']) {
  test(`declared ${mode} contrast pairs meet their WCAG minimum`, () => {
    for (const [fg, bg, minimum] of tokens.contrastPairs) {
      const ratio = contrast(tokens.semantic[fg][mode], tokens.semantic[bg][mode]);
      assert.ok(ratio >= minimum, `${mode} ${fg} on ${bg} is ${ratio.toFixed(2)}:1, needs ${minimum}:1`);
    }
  });

  test(`${mode} workflow pill text meets 4.5:1 on its own tint`, () => {
    for (const [tone, modes] of Object.entries(tokens.status)) {
      if (tone.startsWith('$')) continue;
      const { bg, text } = modes[mode];
      const ground = bg === 'transparent' ? tokens.semantic.surface[mode] : bg;
      const ratio = contrast(text, ground);
      assert.ok(ratio >= 4.5, `${mode} ${tone} pill text is ${ratio.toFixed(2)}:1`);
    }
  });
}

test('every canonical workflow state has a presentation tone and nothing more', () => {
  const { states } = readJson('config/workflow_states.json');
  const mapped = Object.keys(tokens.workflowTone).filter((key) => !key.startsWith('$'));
  assert.deepEqual([...mapped].sort(), [...states].sort());
  for (const state of mapped) assert.ok(tokens.status[tokens.workflowTone[state]], `${state} maps to an unknown tone`);
});
