import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import { validateObservation } from '../../validation/engine.mjs';
import { buildValidationPersistencePlan } from '../../validation/persistence.mjs';
import { commitValidationPlanToFirestore } from '../../validation/firestore_adapter.mjs';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('FIRESTORE_EMULATOR_HOST is not set. Refusing to run this integration test against a non-emulator Firestore instance.');
}

const PROJECT_ID = 'central-pa-watershed-dev';
const app = initializeApp({ projectId: PROJECT_ID }, `phase10-${randomUUID()}`);
const db = getFirestore(app);
const NOW = new Date('2026-08-08T17:00:00-04:00');

function revision(submissionId, revisionId, overrides = {}) {
  return {
    revision_id: revisionId,
    revision_no: 1,
    submission_id: submissionId,
    event_id: randomUUID(),
    collector_user_id: 'collector-test',
    site_id: 'SITE-001',
    revision_status: 'SUBMITTED',
    created_at: Timestamp.fromDate(new Date('2026-08-08T16:00:00-04:00')),
    submitted_at: Timestamp.fromDate(new Date('2026-08-08T16:45:00-04:00')),
    collected_at: Timestamp.fromDate(new Date('2026-08-08T16:30:00-04:00')),
    time_known: true,
    time_imputed: false,
    latitude: 40.7934,
    longitude: -77.86,
    gps_accuracy_m: 4,
    weather_condition: 'Clear',
    data_collected_by: 'Student/researcher',
    test_type: 'In-situ / Field Instrument',
    test_type_other: null,
    method_name: 'Calibrated multiparameter field meter',
    instrument_name: 'Test Sonde',
    instrument_other: null,
    temp_entered_value: 68,
    temp_entered_unit: 'F',
    temp_c: 20,
    temp_f: 68,
    schema_version: '0.1.1',
    mobile_app_version: 'phase10-test',
    ...overrides,
  };
}

function measurement(code, value, unit = 'unit', overrides = {}) {
  return {
    measurement_id: `m-${code}`,
    parameter_code: code,
    display_name: code,
    value,
    unit_code: unit,
    method_name: 'Field meter',
    instrument_name: 'Test Sonde',
    qualifier: null,
    notes: null,
    entered_at: Timestamp.fromDate(NOW),
    ...overrides,
  };
}

function cleanMeasurements() {
  return [
    measurement('PH', 7.2, 'pH'),
    measurement('DO_MG_L', 9, 'mg/L'),
    measurement('CONDUCTIVITY_US_CM', 350, 'uS/cm'),
  ];
}

const site = {
  site_id: 'SITE-001',
  latitude: 40.7934,
  longitude: -77.86,
  site_tolerance_m: 30,
};

async function seedCase({ submissionId, revisionDoc, measurements }) {
  const submissionRef = db.collection('submissions').doc(submissionId);
  const revisionRef = submissionRef.collection('revisions').doc(revisionDoc.revision_id);

  await submissionRef.set({
    submission_id: submissionId,
    event_id: revisionDoc.event_id,
    collector_user_id: revisionDoc.collector_user_id,
    site_id: revisionDoc.site_id,
    status: 'VALIDATING',
    current_revision_id: revisionDoc.revision_id,
    current_revision_no: revisionDoc.revision_no,
    updated_at: Timestamp.fromDate(NOW),
  });
  await revisionRef.set(revisionDoc);

  for (const m of measurements) {
    await revisionRef.collection('measurements').doc(m.measurement_id).set(m);
  }

  return { submissionRef, revisionRef };
}

after(async () => {
  await deleteApp(app);
});

test('clean validation atomically persists score, flags, audit and PENDING_REVIEW', async () => {
  const submissionId = randomUUID();
  const revisionId = randomUUID();
  const rev = revision(submissionId, revisionId);
  const measurements = cleanMeasurements();
  const { submissionRef, revisionRef } = await seedCase({ submissionId, revisionDoc: rev, measurements });

  // A stale flag from a prior run must not survive successful revalidation.
  await revisionRef.collection('validationFlags').doc('STALE_FLAG').set({
    flag_id: 'STALE_FLAG',
    severity: 'PLAUSIBILITY_WARNING',
    category: 'TEST',
    parameter_code: null,
    message: 'stale',
    rule_code: 'STALE',
    created_at: Timestamp.fromDate(NOW),
    resolved: false,
  });

  const result = validateObservation({ revision: rev, measurements, site, now: NOW });
  const submission = { submission_id: submissionId, status: 'VALIDATING' };
  const plan = buildValidationPersistencePlan({ submission, revision: rev, result, now: NOW });

  const committed = await commitValidationPlanToFirestore({ db, Timestamp, plan });
  assert.equal(committed.next_status, 'PENDING_REVIEW');
  assert.equal(committed.replaced_flag_count, 1);

  const submissionSnap = await submissionRef.get();
  const revisionSnap = await revisionRef.get();
  const flagsSnap = await revisionRef.collection('validationFlags').get();
  const auditSnap = await submissionRef.collection('audit').doc(plan.audit_event.audit_id).get();

  assert.equal(submissionSnap.data().status, 'PENDING_REVIEW');
  assert.ok(submissionSnap.data().overall_quality_score >= 90);
  assert.equal(submissionSnap.data().error_flag_count, 0);
  assert.equal(typeof submissionSnap.data().updated_at.toDate, 'function');

  assert.equal(revisionSnap.data().validation.blocking, false);
  assert.ok(revisionSnap.data().validation.overall_quality_score >= 90);
  assert.equal(typeof revisionSnap.data().validation.validated_at.toDate, 'function');

  assert.equal(flagsSnap.docs.some((d) => d.id === 'STALE_FLAG'), false);
  assert.equal(auditSnap.exists, true);
  assert.equal(auditSnap.data().event_type, 'VALIDATION_COMPLETED');
  assert.equal(auditSnap.data().new_state, 'PENDING_REVIEW');
  assert.equal(typeof auditSnap.data().occurred_at.toDate, 'function');
});

test('blocking validation persists ERROR flags and routes to NEEDS_CORRECTION', async () => {
  const submissionId = randomUUID();
  const revisionId = randomUUID();
  const rev = revision(submissionId, revisionId);
  const measurements = [
    measurement('PH', 15, 'pH'),
    measurement('DO_MG_L', 9, 'mg/L'),
    measurement('CONDUCTIVITY_US_CM', 350, 'uS/cm'),
  ];
  const { submissionRef, revisionRef } = await seedCase({ submissionId, revisionDoc: rev, measurements });

  const result = validateObservation({ revision: rev, measurements, site, now: NOW });
  const plan = buildValidationPersistencePlan({
    submission: { submission_id: submissionId, status: 'VALIDATING' },
    revision: rev,
    result,
    now: NOW,
  });

  await commitValidationPlanToFirestore({ db, Timestamp, plan });

  const submissionSnap = await submissionRef.get();
  const flagsSnap = await revisionRef.collection('validationFlags').get();
  const auditSnap = await submissionRef.collection('audit').doc(plan.audit_event.audit_id).get();

  assert.equal(submissionSnap.data().status, 'NEEDS_CORRECTION');
  assert.equal(submissionSnap.data().overall_quality_score, null);
  assert.ok(submissionSnap.data().error_flag_count >= 1);
  assert.ok(flagsSnap.docs.some((d) => d.data().severity === 'ERROR'));
  assert.equal(auditSnap.data().event_type, 'VALIDATION_BLOCKED');
  assert.equal(auditSnap.data().new_state, 'NEEDS_CORRECTION');
});

test('adapter aborts if submission status changed after validation began', async () => {
  const submissionId = randomUUID();
  const revisionId = randomUUID();
  const rev = revision(submissionId, revisionId);
  const measurements = cleanMeasurements();
  const { submissionRef } = await seedCase({ submissionId, revisionDoc: rev, measurements });

  const result = validateObservation({ revision: rev, measurements, site, now: NOW });
  const plan = buildValidationPersistencePlan({
    submission: { submission_id: submissionId, status: 'VALIDATING' },
    revision: rev,
    result,
    now: NOW,
  });

  await submissionRef.update({ status: 'PENDING_REVIEW' });

  await assert.rejects(
    () => commitValidationPlanToFirestore({ db, Timestamp, plan }),
    /status changed during validation/,
  );
});
