import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(here, '..');
const srcRoot = path.join(mobileRoot, 'src');
const analyticsPath = path.join(srcRoot, 'services', 'analytics.ts');

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(target));
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) files.push(target);
  }
  return files;
}

const sourceFiles = walk(srcRoot);
const directAnalyticsImports = sourceFiles.filter((file) =>
  fs.readFileSync(file, 'utf8').includes('@react-native-firebase/analytics'),
);

const normalizedAnalyticsPath = path.normalize(analyticsPath);
const unauthorizedImports = directAnalyticsImports.filter(
  (file) => path.normalize(file) !== normalizedAnalyticsPath,
);

const failures = [];
if (unauthorizedImports.length > 0) {
  failures.push(
    `Firebase Analytics must be wrapped by src/services/analytics.ts only. Direct imports found in: ${unauthorizedImports
      .map((file) => path.relative(mobileRoot, file))
      .join(', ')}`,
  );
}

const analyticsSource = fs.readFileSync(analyticsPath, 'utf8');
const forbiddenTelemetryTerms = [
  'latitude',
  'longitude',
  'gps_accuracy',
  'measurement_value',
  'field_notes',
  'reviewer_email',
  'reviewer_id',
  'collector_email',
  'collector_user_id',
  'auth_token',
  'access_token',
  'refresh_token',
  'site_id',
  'event_id',
  'submission_id',
];

for (const term of forbiddenTelemetryTerms) {
  if (analyticsSource.toLowerCase().includes(term)) {
    failures.push(`Forbidden telemetry term appears in analytics wrapper: ${term}`);
  }
}

if (/setUser(Id|Property|Properties)\s*\(/.test(analyticsSource)) {
  failures.push('Analytics user identity/properties are prohibited for the collector app.');
}

if (!analyticsSource.includes("'screen_viewed', { screen_name: screen }")) {
  failures.push('Screen telemetry must remain limited to the coarse screen_name field.');
}

if (failures.length > 0) {
  console.error('Phase 11 privacy audit failed:\n');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Phase 11 privacy audit passed.');
