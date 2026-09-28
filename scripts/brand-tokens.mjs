#!/usr/bin/env node
// Generates platform copies of config/brand_tokens.json.
//   node scripts/brand-tokens.mjs --write   regenerate every target
//   node scripts/brand-tokens.mjs --check   exit 1 if any target is stale
// Each web app is its own App Hosting root, so each receives its own copy rather than importing
// across roots. The iOS tokens live in a marked block inside DesignSystem.swift so the Xcode project
// file does not change.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tokens = JSON.parse(readFileSync(join(root, 'config/brand_tokens.json'), 'utf8'));
const HEADER = 'GENERATED from config/brand_tokens.json by scripts/brand-tokens.mjs. Do not edit by hand.';

const kebab = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
const cssValue = (value) => (value === 'transparent' ? 'transparent' : value.toUpperCase());

function cssMode(mode) {
  const lines = [];
  for (const [name, entry] of Object.entries(tokens.semantic)) lines.push(`  --pww-${kebab(name)}: ${cssValue(entry[mode])};`);
  for (const [tone, modes] of Object.entries(tokens.status)) {
    if (tone.startsWith('$')) continue;
    for (const part of ['bg', 'border', 'mark', 'text']) lines.push(`  --pww-status-${tone}-${part}: ${cssValue(modes[mode][part])};`);
  }
  return lines.join('\n');
}

export function renderCss() {
  const constant = [];
  for (const [name, hex] of Object.entries(tokens.palette)) constant.push(`  --pww-color-${kebab(name)}: ${hex.toUpperCase()};`);
  for (const [name, px] of Object.entries(tokens.radius)) constant.push(`  --pww-radius-${name}: ${px}px;`);
  for (const [name, px] of Object.entries(tokens.space)) constant.push(`  --pww-space-${name}: ${px}px;`);
  for (const [name, px] of Object.entries(tokens.type.webScale)) constant.push(`  --pww-fs-${name}: ${px}px;`);
  constant.push(`  --pww-line-height: ${tokens.type.bodyLineHeight};`);
  constant.push(`  --pww-font-sans: var(--pww-font-sans-face, ${tokens.type.webSans});`);
  constant.push(`  --pww-font-mono: var(--pww-font-mono-face, ${tokens.type.webMono});`);
  const dark = cssMode('dark');
  return `/* ${HEADER}
   Light is the default. Dark applies with <html data-theme="dark">, or with data-theme="system"
   when the viewer prefers dark. Surfaces without data-theme stay light. */
:root {
${constant.join('\n')}
${cssMode('light')}
}

:root[data-theme="dark"] {
  color-scheme: dark;
${dark}
}

@media (prefers-color-scheme: dark) {
  :root[data-theme="system"] {
    color-scheme: dark;
${dark.replace(/^ {2}/gm, '    ')}
  }
}
`;
}

export function renderTs() {
  const pick = (mode) =>
    Object.fromEntries(Object.entries(tokens.semantic).map(([name, entry]) => [name, entry[mode]]));
  const status = Object.fromEntries(
    Object.entries(tokens.status).filter(([tone]) => !tone.startsWith('$')).map(([tone, modes]) => [tone, modes.light]),
  );
  return `// ${HEADER}
// Light-mode values for code that cannot read CSS custom properties (ArcGIS symbols, SVG charts).
export const brandPalette = ${JSON.stringify(tokens.palette, null, 2)} as const;

export const brandLight = ${JSON.stringify(pick('light'), null, 2)} as const;

export const brandStatusLight = ${JSON.stringify(status, null, 2)} as const;

export type WorkflowTone = ${Object.keys(tokens.status).filter((tone) => !tone.startsWith('$')).map((tone) => `'${tone}'`).join(' | ')};

/** Presentation tone for each canonical workflow state. Color only; never meaning. */
export const workflowTone: Record<string, WorkflowTone> = ${JSON.stringify(
    Object.fromEntries(Object.entries(tokens.workflowTone).filter(([state]) => !state.startsWith('$'))),
    null,
    2,
  )};
`;
}

const swiftHex = (value) => `0x${value.slice(1).toUpperCase()}`;
const swiftColor = (light, dark) =>
  light === 'transparent' ? 'Color.clear' : `Color(light: ${swiftHex(light)}, dark: ${swiftHex(dark)})`;

export function renderSwiftBlock() {
  const lines = [
    `// BEGIN GENERATED BRAND TOKENS: ${HEADER}`,
    'enum BrandTokens {',
  ];
  for (const [name, entry] of Object.entries(tokens.semantic)) {
    lines.push(`    /// ${entry.role}`);
    lines.push(`    static let ${name} = ${swiftColor(entry.light, entry.dark)}`);
  }
  lines.push('');
  for (const [tone, modes] of Object.entries(tokens.status)) {
    if (tone.startsWith('$')) continue;
    for (const part of ['bg', 'border', 'mark', 'text']) {
      const suffix = { bg: 'Background', border: 'Border', mark: 'Mark', text: 'Text' }[part];
      lines.push(`    static let status${tone[0].toUpperCase()}${tone.slice(1)}${suffix} = ${swiftColor(modes.light[part], modes.dark[part])}`);
    }
  }
  lines.push('');
  for (const [name, px] of Object.entries(tokens.radius)) lines.push(`    static let radius${name.toUpperCase()}: CGFloat = ${px}`);
  lines.push('');
  lines.push('    /// Presentation tone for each canonical workflow state, keyed by `WorkflowState.rawValue`.');
  lines.push('    static let workflowTone: [String: StatusTone] = [');
  for (const [state, tone] of Object.entries(tokens.workflowTone)) {
    if (state.startsWith('$')) continue;
    const camel = state.toLowerCase().replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    lines.push(`        "${camel}": .${tone},`);
  }
  lines.push('    ]');
  lines.push('}');
  lines.push('');
  const tones = Object.keys(tokens.status).filter((tone) => !tone.startsWith('$'));
  lines.push(`enum StatusTone: String, CaseIterable { case ${tones.join(', ')} }`);
  lines.push('// END GENERATED BRAND TOKENS');
  return lines.join('\n');
}

const SWIFT_PATH = 'Phone App/iPhone App/PAWatershedWatch/PAWatershedWatch/DesignSystem.swift';
const BLOCK = /\/\/ BEGIN GENERATED BRAND TOKENS[\s\S]*?\/\/ END GENERATED BRAND TOKENS/;

function swiftTarget() {
  const current = readFileSync(join(root, SWIFT_PATH), 'utf8');
  const block = renderSwiftBlock();
  if (!BLOCK.test(current)) throw new Error(`${SWIFT_PATH} is missing the generated brand token markers`);
  return current.replace(BLOCK, block);
}

export const targets = () => [
  ['web/app/brand-tokens.css', renderCss()],
  ['public-dashboard/styles/brand-tokens.css', renderCss()],
  ['public-dashboard/lib/brandTokens.ts', renderTs()],
  ['web/lib/brandTokens.ts', renderTs()],
  [SWIFT_PATH, swiftTarget()],
];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2];
  if (mode !== '--write' && mode !== '--check') {
    console.error('usage: node scripts/brand-tokens.mjs --write | --check');
    process.exit(2);
  }
  let stale = 0;
  for (const [path, content] of targets()) {
    const full = join(root, path);
    let existing = null;
    try { existing = readFileSync(full, 'utf8'); } catch {}
    if (existing === content) continue;
    if (mode === '--write') { writeFileSync(full, content); console.log(`wrote ${path}`); }
    else { console.error(`stale: ${path}`); stale += 1; }
  }
  if (stale) process.exit(1);
}
