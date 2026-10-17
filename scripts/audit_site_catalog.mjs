#!/usr/bin/env node
// READ-ONLY audit of `siteCatalog` for the legacy beta/test-site cleanup.
//
// This tool never writes. It lists every catalog document, flags synthetic/test fixtures, counts the
// submissions, revisions, audit events and publication jobs that reference each site, classifies each
// entry, and prints the exact mutation plan a release operator would apply after review.
//
// Why deactivate rather than delete: validation (validation/orchestrator.mjs) and publication
// (publication/orchestrator.mjs) both load `siteCatalog/{site_id}` for a submission and throw when the
// document is missing. Historical submissions therefore need their site document to keep existing.
// `active: false` removes a site from the mobile picker (apps query `active == true`) and blocks new
// submissions there (firestore.rules requires an active site on create) while preserving history.
//
// Usage:
//   node scripts/audit_site_catalog.mjs                     # live dev project (needs ADC; read-only)
//   node scripts/audit_site_catalog.mjs --json out.json     # also write the full report as JSON
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/audit_site_catalog.mjs   # emulator
//   node scripts/audit_site_catalog.mjs --auth              # also summarize Auth accounts (no secrets)

import { writeFileSync } from 'node:fs';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'central-pa-watershed-dev';
const args = process.argv.slice(2);
const jsonPath = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const includeAuth = args.includes('--auth');

const app = initializeApp({ projectId: PROJECT_ID }, 'site-catalog-audit');
if (app.options.projectId !== PROJECT_ID) throw new Error(`Refusing to run outside ${PROJECT_ID}.`);
const db = getFirestore(app);
const target = process.env.FIRESTORE_EMULATOR_HOST ? `emulator ${process.env.FIRESTORE_EMULATOR_HOST}` : `live ${PROJECT_ID}`;

const IN_FLIGHT = new Set(['DRAFT', 'SUBMITTED', 'VALIDATING', 'PENDING_REVIEW', 'NEEDS_CORRECTION', 'RESUBMITTED', 'APPROVED', 'PUBLISHING', 'PUBLISH_FAILED']);

/** Strong signals are unambiguous fixture markers; weak signals alone never justify a change. */
export function syntheticSignals(id, site) {
  const strong = [];
  const weak = [];
  if (/^TEST(?:[-_]|$)/i.test(site.site_code ?? '')) strong.push(`site_code ${site.site_code}`);
  if (/^site-test-/i.test(id)) strong.push(`document id ${id}`);
  for (const flag of ['synthetic', 'is_test', 'fixture']) if (site[flag] === true) strong.push(`${flag}=true`);
  if (/\b(test|synthetic|fixture|demo|sample site)\b/i.test(site.site_name_display ?? '')) weak.push('name mentions test/demo');
  if (site.publication_approved === true && strong.length) weak.push('publication_approved=true on a fixture');
  return { strong, weak };
}

export function classify({ active, signals, references }) {
  if (active !== true) return 'ALREADY_INACTIVE';
  if (signals.strong.length && !references.published) return 'SAFE_TO_DEACTIVATE';
  if (signals.strong.length || signals.weak.length) return 'AMBIGUOUS';
  return 'KEEP';
}

async function referencesFor(siteId) {
  const submissions = await db.collection('submissions').where('site_id', '==', siteId).get();
  const result = { submissions: submissions.size, revisions: 0, audit: 0, publicationJobs: 0, inFlight: 0, published: 0, statuses: {} };
  for (const doc of submissions.docs) {
    const status = doc.get('status') ?? 'UNKNOWN';
    result.statuses[status] = (result.statuses[status] ?? 0) + 1;
    if (IN_FLIGHT.has(status)) result.inFlight += 1;
    if (status === 'PUBLISHED') result.published += 1;
    const [revisions, audit, publication] = await Promise.all([
      doc.ref.collection('revisions').count().get(),
      doc.ref.collection('audit').count().get(),
      doc.ref.collection('publication').count().get(),
    ]);
    result.revisions += revisions.data().count;
    result.audit += audit.data().count;
    result.publicationJobs += publication.data().count;
  }
  return result;
}

const catalog = await db.collection('siteCatalog').get();
const report = [];
for (const doc of catalog.docs) {
  const site = doc.data();
  const signals = syntheticSignals(doc.id, site);
  const references = await referencesFor(doc.id);
  const classification = classify({ active: site.active, signals, references });
  report.push({
    site_id: doc.id,
    site_code: site.site_code ?? null,
    name: site.site_name_display ?? null,
    county: site.county ?? site.county_display ?? null,
    watershed: site.watershed_name ?? site.watershed_display ?? null,
    active: site.active ?? null,
    publication_approved: site.publication_approved ?? null,
    signals,
    references,
    history_requires_document: references.submissions > 0,
    classification,
  });
}
report.sort((a, b) => a.site_id.localeCompare(b.site_id));

const plan = report
  .filter((row) => row.classification === 'SAFE_TO_DEACTIVATE')
  .map((row) => ({
    op: 'update',
    path: `siteCatalog/${row.site_id}`,
    precondition: { exists: true, active: true },
    set: { active: false, updated_at: 'serverTimestamp()' },
    never: ['delete', 'change coordinates', 'touch submissions/revisions/audit'],
  }));

console.log(`siteCatalog audit · ${target} · read-only · ${new Date().toISOString()}`);
console.log(`${report.length} catalog document(s); ${report.filter((r) => r.active === true).length} currently selectable\n`);
for (const row of report) {
  const refs = row.references;
  console.log([
    row.classification.padEnd(19),
    row.site_id.padEnd(22),
    (row.site_code ?? '—').padEnd(10),
    `active=${row.active}`,
    `subs=${refs.submissions} revs=${refs.revisions} audit=${refs.audit} pubJobs=${refs.publicationJobs} inFlight=${refs.inFlight} published=${refs.published}`,
    `| ${row.name ?? '(no name)'} · ${row.county ?? '—'} · ${row.watershed ?? '—'}`,
    row.signals.strong.length || row.signals.weak.length ? `| signals: ${[...row.signals.strong, ...row.signals.weak.map((w) => `weak: ${w}`)].join('; ')}` : '',
  ].join(' '));
}

const counts = report.reduce((acc, row) => ({ ...acc, [row.classification]: (acc[row.classification] ?? 0) + 1 }), {});
console.log('\nSummary:', JSON.stringify(counts));
console.log('\nProposed mutation plan (NOT executed):');
console.log(JSON.stringify(plan, null, 2));
if (report.some((row) => row.history_requires_document)) {
  console.log('\nSites referenced by submissions must keep their document: validation and publication load it by id.');
}

let authSummary = null;
if (includeAuth) {
  const auth = getAuth(app);
  const users = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  const mask = (email) => (email ? email.replace(/^(.).*(@.*)$/, '$1***$2') : '(no email)');
  authSummary = users.map((user) => ({
    email: mask(user.email),
    providers: user.providerData.map((p) => p.providerId),
    role: user.customClaims?.role ?? '(none)',
    disabled: user.disabled,
    has_display_name: Boolean(user.displayName),
    created: user.metadata.creationTime,
    last_sign_in: user.metadata.lastSignInTime,
  }));
  console.log(`\nAuth accounts (${users.length}), emails masked, no credentials:`);
  for (const row of authSummary) console.log(JSON.stringify(row));
}

if (jsonPath) {
  writeFileSync(jsonPath, `${JSON.stringify({ target, generated_at: new Date().toISOString(), report, plan, auth: authSummary }, null, 2)}\n`);
  console.log(`\nWrote ${jsonPath}`);
}
