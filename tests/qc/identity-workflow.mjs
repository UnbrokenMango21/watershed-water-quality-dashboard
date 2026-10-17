// Run only against local emulators and the emulator-configured QC server.
// QA browser dependencies are installed outside Git; see the verification ledger.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw new Error('Local Auth and Firestore emulators are required.');
const base = process.env.QC_QA_URL ?? 'http://127.0.0.1:3100';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('This workflow only permits a local QC server.');
const modules = process.env.QA_NODE_MODULES ?? '/tmp/pww-supervisor-qa/node_modules';
const { chromium } = await import(pathToFileURL(`${modules}/playwright/index.mjs`));
const { default: AxeBuilder } = await import(pathToFileURL(`${modules}/@axe-core/playwright/dist/index.mjs`));
const suffix = randomUUID().slice(0, 8), project = 'central-pa-watershed-dev';
const app = initializeApp({ projectId: project }, `qc-identity-qa-${suffix}`);
const auth = getAuth(app), db = getFirestore(app);
const password = `Emulator-${randomUUID()}!`;
const adminEmail = `qa-admin-${suffix}@emulator.invalid`, collectorEmail = `qa-collector-${suffix}@emulator.invalid`;
const out = `artifacts/supervisor-qa/${suffix}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const collectorContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const collector = await collectorContext.newPage(), admin = await adminContext.newPage();
const results = [];
async function check(name, operation) { await operation(); results.push({ name, status: 'PASS' }); console.log(`PASS ${name}`); }
async function login(page, email) {
  await page.goto(`${base}/review`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}
const fixtures = [];
let collectorUid;
try {
  const adminUser = await auth.createUser({ email: adminEmail, password, emailVerified: true, displayName: 'Emulator QA Administrator' });
  fixtures.push(adminUser.uid);
  await auth.setCustomUserClaims(adminUser.uid, { role: 'ADMIN' });
  await db.collection('users').doc(adminUser.uid).set({ role: 'ADMIN', active: true, display_name: 'Emulator QA Administrator' });
  await check('sign-in desktop, tablet and phone accessibility/layout', async () => {
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 820, height: 1180 }, { width: 390, height: 844 }]) {
      await collector.setViewportSize(viewport); await collector.goto(`${base}/review`);
      await collector.getByRole('heading', { name: 'Reviewer sign-in' }).waitFor();
      const overflowing = await collector.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      assert.equal(overflowing, false);
      const a11y = await new AxeBuilder({ page: collector }).analyze();
      assert.deepEqual(a11y.violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => v.id), []);
      await collector.screenshot({ path: `${out}/sign-in-${viewport.width}.png`, fullPage: true });
    }
    await collector.setViewportSize({ width: 1440, height: 1000 });
  });
  await check('failed login remains outside private review workspace', async () => {
    await collector.getByLabel('Email', { exact: true }).fill(collectorEmail);
    await collector.getByLabel('Password', { exact: true }).fill(`wrong-${randomUUID()}`);
    await collector.getByRole('button', { name: 'Sign in', exact: true }).click();
    await collector.getByRole('alert').filter({ hasText: 'Incorrect email or password.' }).waitFor();
    assert.equal(await collector.getByRole('navigation', { name: 'Review queue' }).count(), 0);
  });
  await check('registration requires verified ownership before requesting review access', async () => {
    await collector.getByRole('button', { name: 'Create a collector account' }).click();
    await collector.getByLabel('Email', { exact: true }).fill(collectorEmail);
    await collector.getByLabel('Password', { exact: true }).fill(password);
    await collector.getByRole('button', { name: 'Create account', exact: true }).click();
    await collector.getByRole('heading', { name: 'Verify your account' }).waitFor();
    collectorUid = (await auth.getUserByEmail(collectorEmail)).uid; fixtures.push(collectorUid);
    assert.equal((await auth.getUser(collectorUid)).emailVerified, false);
    assert.equal(await collector.getByRole('button', { name: 'Request supervisor access' }).count(), 0);
    const codes = await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${project}/oobCodes`).then(response => response.json());
    const verification = codes.oobCodes.find(code => code.email === collectorEmail && code.requestType === 'VERIFY_EMAIL');
    assert.ok(verification);
    const verified = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:update?key=emulator-only-key', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ oobCode: verification.oobCode }) });
    assert.equal(verified.ok, true);
    await collector.getByRole('button', { name: 'Refresh access' }).click();
    await collector.getByRole('heading', { name: 'Collector account', exact: true }).waitFor();
  });
  await check('verified collector requests access and sees genuine pending state', async () => {
    await collector.getByLabel('Display name', { exact: true }).fill('Emulator QA Collector');
    await collector.getByLabel('Why do you need supervisor access?').fill('I supervise the isolated emulator monitoring team.');
    await collector.getByRole('button', { name: 'Request supervisor access', exact: true }).click();
    await collector.getByRole('heading', { name: 'Pending supervisor approval' }).waitFor();
    assert.equal((await db.collection('reviewerAccessRequests').doc(collectorUid).get()).get('status'), 'PENDING');
    assert.equal((await auth.getUser(collectorUid)).customClaims?.role ?? 'COLLECTOR', 'COLLECTOR');
    for (const width of [1440, 820, 390]) {
      await collector.setViewportSize({ width, height: 1000 });
      assert.equal(await collector.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await collector.screenshot({ path: `${out}/pending-${width}.png`, fullPage: true });
    }
    await collector.setViewportSize({ width: 1440, height: 1000 });
  });
  await check('administrator approves request and refreshed collector gains QC access', async () => {
    await login(admin, adminEmail);
    await admin.getByRole('heading', { name: 'Review queue', exact: true }).waitFor();
    await admin.getByRole('link', { name: 'Access requests', exact: true }).click();
    const card = admin.locator('section').filter({ has: admin.getByRole('heading', { name: 'Emulator QA Collector', exact: true }) });
    await card.getByRole('button', { name: 'Review access', exact: true }).click();
    await card.getByLabel('Decision reason', { exact: true }).fill('Verified isolated test membership; emulator fixtures only.');
    await card.getByRole('button', { name: 'Approve reviewer access', exact: true }).click();
    await admin.getByRole('status').filter({ hasText: 'Access decision saved' }).waitFor();
    assert.equal((await auth.getUser(collectorUid)).customClaims.role, 'QC_REVIEWER');
    await admin.screenshot({ path: `${out}/admin-access.png`, fullPage: true });
    // No manual refresh: the pending screen fetches a fresh ID token once the decision settles.
    await collector.getByRole('heading', { name: 'Review queue', exact: true }).waitFor({ timeout: 20_000 });
    await collector.screenshot({ path: `${out}/approved-queue.png`, fullPage: true });
  });
  await check('administrator revocation closes the previously authorized session', async () => {
    const card = admin.locator('section').filter({ has: admin.getByRole('heading', { name: 'Emulator QA Collector', exact: true }) });
    await card.getByRole('button', { name: 'Review access', exact: true }).click();
    await card.getByLabel('Decision reason', { exact: true }).fill('Isolated test assignment ended; revoke review only.');
    await card.getByRole('button', { name: 'Revoke review access', exact: true }).click();
    await admin.getByRole('status').filter({ hasText: 'Access decision saved' }).waitFor();
    await collector.reload();
    await collector.getByRole('heading', { name: 'Reviewer access revoked' }).waitFor();
    assert.equal(await collector.getByRole('navigation', { name: 'Review queue' }).count(), 0);
  });
  await check('a revoked applicant can ask again and sees a decline with its reason', async () => {
    await collector.getByLabel('Why do you need supervisor access?').fill('Reassigned to the isolated emulator review roster.');
    await collector.getByRole('button', { name: 'Request supervisor access again', exact: true }).click();
    await collector.getByRole('heading', { name: 'Pending supervisor approval' }).waitFor();
    const card = admin.locator('section').filter({ has: admin.getByRole('heading', { name: 'Emulator QA Collector', exact: true }) });
    await card.getByText('pending', { exact: false }).first().waitFor();
    await card.getByRole('button', { name: 'Review access', exact: true }).click();
    await card.getByLabel('Decision reason', { exact: true }).fill('The emulator review roster is already complete.');
    await card.getByRole('button', { name: 'Decline request', exact: true }).click();
    await admin.getByRole('status').filter({ hasText: 'Access decision saved' }).waitFor();
    await collector.getByRole('heading', { name: 'Reviewer access request declined' }).waitFor();
    await collector.getByText('The emulator review roster is already complete.', { exact: false }).waitFor();
    await collector.getByRole('button', { name: 'Request supervisor access again', exact: true }).waitFor();
    assert.equal((await auth.getUser(collectorUid)).customClaims.role, 'COLLECTOR');
    const events = (await db.collection('reviewerAccessRequests').doc(collectorUid).collection('audit').get()).docs.map(doc => doc.data());
    assert.equal(events.filter(event => event.event === 'REQUEST_RESUBMITTED').length, 1);
    await collector.screenshot({ path: `${out}/declined-${suffix}.png`, fullPage: true });
  });
} finally {
  await writeFile(`${out}/identity-results.json`, JSON.stringify({ base, environment: 'local emulators only', results }, null, 2));
  await browser.close();
  for (const uid of fixtures) {
    await db.recursiveDelete(db.collection('reviewerAccessRequests').doc(uid));
    await db.collection('users').doc(uid).delete(); await db.collection('reviewerDisplayProfiles').doc(uid).delete();
    await auth.deleteUser(uid);
  }
  await deleteApp(app);
}
console.log(`Evidence: ${out}`);
