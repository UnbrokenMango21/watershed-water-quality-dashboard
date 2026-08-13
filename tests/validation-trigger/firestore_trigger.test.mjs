import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'central-pa-watershed-dev';
const app = initializeApp({ projectId: PROJECT_ID }, 'validation-trigger-test');
const db = getFirestore(app);
const submissionId = 'trigger-test-submission';
const revisionId = 'trigger-test-revision';
const siteId = 'trigger-test-site';

async function waitForStatus(expected, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const snapshot = await db.collection('submissions').doc(submissionId).get();
    if (snapshot.data()?.status === expected) return snapshot.data();
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  const snapshot = await db.collection('submissions').doc(submissionId).get();
  assert.fail(`Expected ${expected}; found ${snapshot.data()?.status}`);
}

before(async () => {
  await db.recursiveDelete(db.collection('submissions').doc(submissionId));
  await db.collection('siteCatalog').doc(siteId).set({
    site_id: siteId,
    latitude: 40.7934,
    longitude: -77.86,
    site_tolerance_m: 30,
    active: true,
  });
});

after(async () => {
  await db.recursiveDelete(db.collection('submissions').doc(submissionId));
  await db.collection('siteCatalog').doc(siteId).delete();
  await deleteApp(app);
});

test('submitted revision is claimed, validated and acknowledged by the server trigger', async () => {
  const submission = db.collection('submissions').doc(submissionId);
  const revision = submission.collection('revisions').doc(revisionId);
  const collectedAt = new Date('2026-08-08T20:30:00Z');

  await submission.set({
    submission_id: submissionId,
    event_id: 'trigger-test-event',
    collector_user_id: 'collector-trigger-test',
    site_id: siteId,
    status: 'DRAFT',
    current_revision_id: revisionId,
    current_revision_no: 1,
    latest_collected_at: collectedAt,
    created_at: collectedAt,
    updated_at: collectedAt,
    submitted_at: null,
    schema_version: '0.1.0',
    mobile_app_version: '1.0.0-test',
  });
  await revision.set({
    revision_id: revisionId,
    revision_no: 1,
    submission_id: submissionId,
    event_id: 'trigger-test-event',
    collector_user_id: 'collector-trigger-test',
    site_id: siteId,
    revision_status: 'SUBMITTED',
    created_at: collectedAt,
    submitted_at: collectedAt,
    collected_at: collectedAt,
    time_known: true,
    time_imputed: false,
    latitude: 40.7934,
    longitude: -77.86,
    gps_accuracy_m: 4,
    data_collected_by: 'Test Collector',
    test_type: 'In-situ / Field Instrument',
    method_name: 'Field meter',
    instrument_name: 'Test sonde',
    temp_entered_value: 20,
    temp_entered_unit: 'C',
    temp_c: 20,
    temp_f: 68,
    schema_version: '0.1.0',
    mobile_app_version: '1.0.0-test',
  });
  for (const [id, parameter_code, value, unit_code] of [
    ['m-ph', 'PH', 7.2, 'pH'],
    ['m-do', 'DO_MG_L', 9, 'mg/L'],
    ['m-cond', 'CONDUCTIVITY_US_CM', 350, 'uS/cm'],
  ]) {
    await revision.collection('measurements').doc(id).set({
      measurement_id: id,
      parameter_code,
      display_name: parameter_code,
      value,
      unit_code,
      method_name: 'Field meter',
      instrument_name: 'Test sonde',
      entered_at: collectedAt,
    });
  }

  await submission.update({ status: 'SUBMITTED', submitted_at: new Date(), updated_at: new Date() });
  const acknowledged = await waitForStatus('PENDING_REVIEW');
  assert.equal(acknowledged.error_flag_count, 0);
  assert.ok(acknowledged.validation_rules_version);
  const validation = (await revision.get()).data().validation;
  assert.equal(validation.blocking, false);
});
