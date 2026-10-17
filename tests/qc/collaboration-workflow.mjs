// Real-browser review collaboration workflow. Run only against local emulators and the
// emulator-configured QC server (see docs/QC_CONSOLE_RUNBOOK.md); every record is a synthetic fixture.
// Covers: reviewer sees v0.2 visual observations and lab analysis provenance, reviewer question,
// trusted correction request in the shared thread, collector reply, collector denied the private
// record, and a coordinate proposal approved into the private site catalog with an audit trail.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { runValidationForSubmission } from '../../validation/orchestrator.mjs';

if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw new Error('Local Auth and Firestore emulators are required.');
const base = process.env.QC_QA_URL ?? 'http://127.0.0.1:3100';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('This workflow only permits a local QC server.');
const modules = process.env.QA_NODE_MODULES ?? '/tmp/pww-supervisor-qa/node_modules';
const { chromium } = await import(pathToFileURL(`${modules}/playwright/index.mjs`));
const { default: AxeBuilder } = await import(pathToFileURL(`${modules}/@axe-core/playwright/dist/index.mjs`));

const suffix = randomUUID().slice(0, 8), project = 'central-pa-watershed-dev';
const app = initializeApp({ projectId: project }, `qc-collaboration-qa-${suffix}`);
const auth = getAuth(app), db = getFirestore(app);
const password = `Emulator-${randomUUID()}!`;
const out = `artifacts/supervisor-qa/collaboration-${suffix}`;
await mkdir(out, { recursive: true });
const siteId = `SITE-QA-${suffix}`, siteName = `Emulator QA Creek ${suffix}`;
const submissionId = randomUUID(), revisionId = randomUUID(), eventId = randomUUID();
const collectedAt = new Date('2026-10-14T14:30:00-04:00');
const submittedAt = new Date('2026-10-15T09:00:00-04:00');
const ts = (date) => Timestamp.fromDate(date);
const results = [];
let pages = [];
async function check(name, operation) {
  try { await operation(); } catch (error) {
    // Keep failure evidence before fixtures are cleaned up.
    for (const [label, page] of pages) {
      await page.screenshot({ path: `${out}/FAILED-${label}.png`, fullPage: true }).catch(() => {});
      const alerts = await page.getByRole('alert').allInnerTexts().catch(() => []);
      const options = await page.locator('select option').allInnerTexts().catch(() => []);
      console.log(`FAIL context ${label}: url=${page.url()} alerts=${JSON.stringify(alerts)} options=${JSON.stringify(options.slice(0, 12))}`);
    }
    results.push({ name, status: 'FAIL', error: String(error?.message ?? error).slice(0, 500) });
    throw error;
  }
  results.push({ name, status: 'PASS' }); console.log(`PASS ${name}`);
}
async function login(page, email) {
  await page.goto(`${base}/review`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}
async function noSeriousA11y(page) {
  const report = await new AxeBuilder({ page }).analyze();
  assert.deepEqual(report.violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => `${v.id}: ${v.nodes[0]?.target}`), []);
}
async function noHorizontalOverflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
}
function measurement(code, display, value, unit, enteredValue, enteredUnit, extra) {
  const id = randomUUID();
  return { id, data: {
    measurement_id: id, parameter_code: code, display_name: display, value, unit_code: unit,
    entered_value: enteredValue, entered_unit_code: enteredUnit, method_name: 'Calibrated field meter',
    instrument_name: 'Synthetic sonde', qualifier: null, notes: null, entered_at: ts(collectedAt),
    analysis_stage: 'FIELD', analyzed_at: ts(collectedAt), field_exception_reason: null, ...extra,
  } };
}

const fixtures = { users: [], submissions: [submissionId], proposals: [] };
const browser = await chromium.launch({ headless: true });
const reviewerContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const collectorContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const reviewer = await reviewerContext.newPage(), collector = await collectorContext.newPage();
pages = [['reviewer', reviewer], ['collector', collector]];
try {
  const people = {};
  for (const [key, role, name] of [['reviewer', 'QC_REVIEWER', 'Emulator QA Reviewer'], ['collector', 'COLLECTOR', 'Emulator QA Field Collector']]) {
    const email = `qa-${key}-${suffix}@emulator.invalid`;
    const user = await auth.createUser({ email, password, emailVerified: true, displayName: name });
    fixtures.users.push(user.uid);
    if (role !== 'COLLECTOR') await auth.setCustomUserClaims(user.uid, { role });
    await db.collection('users').doc(user.uid).set({ role, active: true, display_name: name });
    await db.collection('reviewerDisplayProfiles').doc(user.uid).set({ uid: user.uid, display_name: name, identity_verified: true, updated_at: ts(new Date()) });
    people[key] = { uid: user.uid, email, name };
  }
  await db.collection('siteCatalog').doc(siteId).set({
    site_id: siteId, site_code: `QA-${suffix}`, site_name_display: siteName, latitude: 40.7934, longitude: -77.86,
    site_tolerance_m: 30, active: true, coordinate_version: 1, publication_approved: false, updated_at: ts(new Date('2026-10-01T12:00:00Z')),
  });
  const submissionRef = db.collection('submissions').doc(submissionId), revisionRef = submissionRef.collection('revisions').doc(revisionId);
  await submissionRef.set({
    submission_id: submissionId, event_id: eventId, collector_user_id: people.collector.uid, site_id: siteId, status: 'SUBMITTED',
    current_revision_id: revisionId, current_revision_no: 1, latest_collected_at: ts(collectedAt), created_at: ts(collectedAt),
    updated_at: ts(submittedAt), submitted_at: ts(submittedAt), schema_version: '0.2.0', mobile_app_version: 'browser-qa',
  });
  await revisionRef.set({
    revision_id: revisionId, revision_no: 1, submission_id: submissionId, event_id: eventId, collector_user_id: people.collector.uid,
    site_id: siteId, revision_status: 'SUBMITTED', created_at: ts(collectedAt), submitted_at: ts(submittedAt), collected_at: ts(collectedAt),
    time_known: true, time_imputed: false, latitude: 40.79345, longitude: -77.86005, gps_accuracy_m: 4, site_distance_m: 6,
    weather_condition: 'Light Rain', water_color: 'Light Brown', flow_condition: 'Moderate', collection_stage: 'LAB_COMPLETED',
    data_collected_by: people.collector.name, test_type: 'In-situ / Field Instrument', test_type_other: null,
    method_name: 'Calibrated field meter', instrument_name: 'Synthetic sonde', instrument_other: null,
    temp_entered_value: 14.2, temp_entered_unit: 'C', temp_c: 14.2, temp_f: 57.56, field_notes_original: 'Synthetic browser QA record.',
    schema_version: '0.2.0', mobile_app_version: 'browser-qa',
  });
  for (const m of [
    measurement('PH', 'pH', 7.4, 'pH', 7.4, 'ph-standard'),
    measurement('NITRATE_MG_L', 'Nitrate', 1.2, 'mg/L as N', 1.2, 'mg-n-l', { method_name: 'Ion chromatography', instrument_name: null, analysis_stage: 'LAB', analyzed_at: ts(new Date('2026-10-15T08:15:00-04:00')) }),
    measurement('CHLORIDE_MG_L', 'Chloride', 31, 'mg/L', 31, 'mg-l', { method_name: 'Chloride test strip', instrument_name: null, field_exception_reason: 'Program-approved field strip protocol for this site.' }),
    measurement('WATER_DEPTH_M', 'Water Depth', 0.3, 'm', 30, 'cm'),
  ]) await revisionRef.collection('measurements').doc(m.id).set(m.data);
  const validated = await runValidationForSubmission({ db, Timestamp, submissionId, now: submittedAt });
  assert.equal(validated.final_status, 'PENDING_REVIEW', JSON.stringify(validated));

  await check('reviewer sees visual observations and laboratory analysis provenance at every viewport', async () => {
    await login(reviewer, people.reviewer.email);
    await reviewer.getByRole('heading', { name: 'Review queue', exact: true }).waitFor();
    await reviewer.getByRole('navigation', { name: 'Review queue' }).getByText(siteName).filter({ visible: true }).first().waitFor();
    await reviewer.goto(`${base}/review/${submissionId}`);
    await reviewer.getByRole('heading', { name: siteName }).waitFor();
    for (const text of ['Light Rain', 'Light Brown', 'Moderate', 'Laboratory analysis', 'Field analysis', 'Program-approved field strip protocol for this site.']) {
      await reviewer.getByText(text, { exact: false }).first().waitFor();
    }
    await noSeriousA11y(reviewer);
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 820, height: 1180 }, { width: 390, height: 844 }]) {
      await reviewer.setViewportSize(viewport);
      await noHorizontalOverflow(reviewer);
      await reviewer.screenshot({ path: `${out}/record-${viewport.width}.png`, fullPage: true });
    }
    await reviewer.setViewportSize({ width: 1440, height: 1000 });
  });

  const thread = (page) => page.getByRole('region', { name: 'Submission discussion' });
  // Message-kind labels also appear as <option>s in the reviewer's message-type picker.
  const posted = (page, text) => thread(page).getByRole('article').getByText(text, { exact: true }).first();
  await check('reviewer question joins the canonical thread with sender and revision context', async () => {
    await thread(reviewer).getByLabel('Message', { exact: true }).fill('Was the chloride strip read within the protocol time window?');
    await thread(reviewer).getByRole('button', { name: 'Send message' }).click();
    await thread(reviewer).getByText('Was the chloride strip read within the protocol time window?').waitFor();
    await posted(reviewer, 'Reviewer question').waitFor();
    const stored = (await db.collection('submissions').doc(submissionId).collection('messages').get()).docs.map((d) => d.data());
    assert.equal(stored.length, 1);
    assert.equal(stored[0].sender_uid, people.reviewer.uid); assert.equal(stored[0].revision_id, revisionId); assert.equal(stored[0].sender_role, 'QC_REVIEWER');
  });

  await check('a correction request uses the trusted review transaction and appears in the shared thread', async () => {
    await reviewer.getByRole('group', { name: 'Review decision' }).getByRole('button', { name: /Request correction/ }).click();
    await reviewer.getByLabel(/Reviewer comments/).fill('Please confirm the chloride strip timing and resubmit as a corrected revision.');
    await reviewer.locator('button[type="submit"]', { hasText: 'Request correction' }).click();
    // The console returns to the queue once the record leaves pending review.
    await reviewer.getByText('Decision recorded:', { exact: false }).waitFor({ timeout: 20_000 });
    await reviewer.goto(`${base}/review/${submissionId}`);
    await posted(reviewer, 'Request for correction').waitFor({ timeout: 20_000 });
    const submission = (await db.collection('submissions').doc(submissionId).get()).data();
    assert.equal(submission.status, 'NEEDS_CORRECTION'); assert.equal(submission.reviewed_revision_id, revisionId);
    const revision = (await db.collection('submissions').doc(submissionId).collection('revisions').doc(revisionId).get()).data();
    assert.equal(revision.revision_status, 'SUBMITTED', 'the reviewed scientific revision stays immutable');
    await reviewer.screenshot({ path: `${out}/correction-requested.png`, fullPage: true });
  });

  await check('collector sees the same thread from the web and replies; the reviewer sees it live', async () => {
    await login(collector, people.collector.email);
    await collector.getByRole('heading', { name: 'Collector account', exact: true }).waitFor();
    await collector.goto(`${base}/my-observations`);
    // A <select> nested in its <label> takes the selected option into its accessible name.
    const records = collector.getByRole('combobox', { name: /^Sampling record/ });
    await records.locator('option', { hasText: siteName }).waitFor({ state: 'attached' });
    await records.selectOption(await records.locator('option', { hasText: siteName }).getAttribute('value'));
    for (const label of ['Reviewer question', 'Request for correction']) await posted(collector, label).waitFor();
    await thread(collector).getByText('Please confirm the chloride strip timing', { exact: false }).first().waitFor();
    assert.equal(await thread(collector).getByLabel('Message type').count(), 0, 'collectors cannot choose reviewer message types');
    await thread(collector).getByLabel('Message', { exact: true }).fill('The strip was read at 60 seconds per the protocol. I will resubmit from the app.');
    await thread(collector).getByRole('button', { name: 'Send message' }).click();
    await thread(reviewer).getByText('The strip was read at 60 seconds per the protocol.', { exact: false }).waitFor({ timeout: 20_000 });
    await posted(reviewer, 'Collector comment').waitFor();
    await noSeriousA11y(collector);
    await collector.screenshot({ path: `${out}/collector-thread.png`, fullPage: true });
  });

  await check('a collector who opens the private record URL gets no reviewer access', async () => {
    await collector.goto(`${base}/review/${submissionId}`);
    await collector.getByRole('heading', { name: 'Collector account', exact: true }).waitFor();
    assert.equal(await collector.getByText('Laboratory analysis').count(), 0);
    assert.equal(await collector.getByRole('group', { name: 'Review decision' }).count(), 0);
  });

  let proposalId;
  await check('collector proposes a coordinate correction without changing the approved catalog', async () => {
    await collector.goto(`${base}/site-locations`);
    await collector.getByRole('combobox', { name: /^Approved site/ }).selectOption({ label: siteName });
    await collector.getByText('Current approved coordinates:').waitFor();
    await collector.getByLabel('Proposed latitude', { exact: true }).fill('40.79361');
    await collector.getByLabel('Proposed longitude', { exact: true }).fill('-77.86032');
    await collector.getByLabel('GPS accuracy in meters (optional)', { exact: true }).fill('3.5');
    await collector.getByLabel('Reason for proposal', { exact: true }).fill('The access point moved upstream after the footbridge was rebuilt.');
    await collector.getByRole('button', { name: 'Submit coordinate proposal' }).click();
    await collector.getByRole('status').filter({ hasText: 'Coordinate proposal saved' }).waitFor();
    const proposals = await db.collection('siteCoordinateProposals').where('site_id', '==', siteId).get();
    assert.equal(proposals.size, 1); proposalId = proposals.docs[0].id; fixtures.proposals.push(proposalId);
    assert.equal(proposals.docs[0].get('status'), 'PENDING');
    assert.equal((await db.collection('siteCatalog').doc(siteId).get()).get('latitude'), 40.7934);
    await collector.getByText('PENDING', { exact: false }).first().waitFor();
    await noSeriousA11y(collector);
    await collector.screenshot({ path: `${out}/proposal-collector.png`, fullPage: true });
  });

  await check('a reviewer approves the proposal into the private catalog with an audit record', async () => {
    await reviewer.goto(`${base}/site-locations`);
    const card = reviewer.locator('section').filter({ hasText: 'The access point moved upstream' });
    await card.getByLabel('Coordinate decision reason', { exact: true }).fill('Verified against the field photo and GPS accuracy.');
    await card.getByRole('button', { name: 'Approve coordinates' }).click();
    await reviewer.getByRole('status').filter({ hasText: 'Coordinate decision saved' }).waitFor();
    const site = (await db.collection('siteCatalog').doc(siteId).get()).data();
    assert.equal(site.latitude, 40.79361); assert.equal(site.longitude, -77.86032); assert.equal(site.coordinate_version, 2);
    const proposal = (await db.collection('siteCoordinateProposals').doc(proposalId).get()).data();
    assert.equal(proposal.status, 'APPROVED'); assert.deepEqual(proposal.original_coordinates, { latitude: 40.7934, longitude: -77.86 });
    assert.ok((await db.collection('siteCoordinateProposals').doc(proposalId).collection('audit').doc('decision').get()).exists);
    await collector.getByText('APPROVED', { exact: false }).first().waitFor({ timeout: 20_000 });
    await reviewer.screenshot({ path: `${out}/proposal-reviewer.png`, fullPage: true });
  });
} finally {
  await writeFile(`${out}/collaboration-results.json`, JSON.stringify({ base, environment: 'local emulators only', results }, null, 2));
  await browser.close();
  for (const id of fixtures.submissions) await db.recursiveDelete(db.collection('submissions').doc(id));
  for (const id of fixtures.proposals) await db.recursiveDelete(db.collection('siteCoordinateProposals').doc(id));
  await db.collection('siteCatalog').doc(siteId).delete();
  for (const uid of fixtures.users) {
    await db.collection('users').doc(uid).delete(); await db.collection('reviewerDisplayProfiles').doc(uid).delete();
    await auth.deleteUser(uid);
  }
  await deleteApp(app);
}
console.log(`Evidence: ${out}`);
