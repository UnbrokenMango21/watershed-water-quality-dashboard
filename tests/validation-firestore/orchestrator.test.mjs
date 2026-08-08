import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import { runValidationForSubmission } from '../../validation/orchestrator.mjs';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('FIRESTORE_EMULATOR_HOST is not set. Refusing to run orchestrator tests against a non-emulator Firestore instance.');
}

const PROJECT_ID = 'central-pa-watershed-dev';
const app = initializeApp({ projectId: PROJECT_ID }, `phase10-orchestrator-${randomUUID()}`);
const db = getFirestore(app);
const NOW = new Date('2026-08-08T17:30:00-04:00');

const site = {
  site_id: 'SITE-ORCH-001',
  site_code: 'ORCH-001',
  site_name_display: 'Synthetic Orchestrator Site',
  latitude: 40.7934,
  longitude: -77.86,
  site_tolerance_m: 30,
  active: true,
  updated_at: Timestamp.fromDate(NOW),
};

function revision(submissionId, revisionId, overrides = {}) {
  return {
    revision_id: revisionId,
    revision_no: 1,
    submission_id: submissionId,
    event_id: randomUUID(),
    collector_user_id: 'collector-orchestrator-test',
    site_id: site.site_id,
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
    instrument_name: 'Synthetic Sonde',
    instrument_other: null,
    temp_entered_value: 68,
    temp_entered_unit: 'F',
    temp_c: 20,
    temp_f: 68,
    schema_version: '0.1.1',
    mobile_app_version: 'phase10-orchestrator-test',
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
    instrument_name: 'Synthetic Sonde',
    qualifier: null,
    notes: null,
    entered_at: Timestamp.fromDate(NOW),
    ...overrides,
  };
}

function coreMeasurements(ph = 7.2) {
  return [
    measurement('PH', ph, 'pH'),
    measurement('DO_MG_L', 9, 'mg/L'),
    measurement('CONDUCTIVITY_US_CM', 350, 'uS/cm'),
  ];
}

async function seedSubmission({ status = 'SUBMITTED', ph = 7.2, submissionId = randomUUID(), revisionId = randomUUID() } = {}) {
  await db.collection('siteCatalog').doc(site.site_id).set(site);

  const rev = revision(submissionId, revisionId);
  const submissionRef = db.collection('submissions').doc(submissionId);
  const revisionRef = submissionRef.collection('revisions').doc(revisionId);

  await submissionRef.set({
    submission_id: submissionId,
    event_id: rev.event_id,
    collector_user_id: rev.collector_user_id,
    site_id: rev.site_id,
    status,
    current_revision_id: revisionId,
    current_revision_no: 1,
    latest_collected_at: rev.collected_at,
    created_at: rev.created_at,
    updated_at: rev.submitted_at,
    submitted_at: rev.submitted_at,
    schema_version: rev.schema_version,
    mobile_app_version: rev.mobile_app_version,
  });
  await revisionRef.set(rev);

  for (const m of coreMeasurements(ph)) {
    await revisionRef.collection('measurements').doc(m.measurement_id).set(m);
  }

  return { submissionId, revisionId, submissionRef, revisionRef };
}

async function seedApprovedPhHistory(count = 8) {
  for (let i = 0; i < count; i += 1) {
    const submissionId = randomUUID();
    const revisionId = randomUUID();
    const rev = revision(submissionId, revisionId, {
      collected_at: Timestamp.fromDate(new Date(`2026-0${(i % 7) + 1}-01T12:00:00-05:00`)),
    });
    const submissionRef = db.collection('submissions').doc(submissionId);
    const revisionRef = submissionRef.collection('revisions').doc(revisionId);

    await submissionRef.set({
      submission_id: submissionId,
      event_id: rev.event_id,
      collector_user_id: rev.collector_user_id,
      site_id: rev.site_id,
      status: 'PUBLISHED',
      review_decision: 'APPROVE',
      current_revision_id: revisionId,
      current_revision_no: 1,
      latest_collected_at: rev.collected_at,
      created_at: rev.created_at,
      updated_at: rev.submitted_at,
      submitted_at: rev.submitted_at,
    });
    await revisionRef.set(rev);
    const ph = 7.0 + ((i % 5) - 2) * 0.05;
    await revisionRef.collection('measurements').doc('m-PH').set(measurement('PH', ph, 'pH'));
  }
}

after(async () => {
  await deleteApp(app);
});

test('orchestrator runs clean SUBMITTED observation end-to-end to PENDING_REVIEW', async () => {
  const seeded = await seedSubmission();

  const output = await runValidationForSubmission({
    db,
    Timestamp,
    submissionId: seeded.submissionId,
    now: NOW,
  });

  assert.equal(output.source_status, 'SUBMITTED');
  assert.equal(output.final_status, 'PENDING_REVIEW');
  assert.equal(output.blocking, false);
  assert.ok(output.result.scores.overall_quality_score >= 90);

  const submissionSnap = await seeded.submissionRef.get();
  const revisionSnap = await seeded.revisionRef.get();
  const auditSnap = await seeded.submissionRef.collection('audit').get();

  assert.equal(submissionSnap.data().status, 'PENDING_REVIEW');
  assert.ok(submissionSnap.data().overall_quality_score >= 90);
  assert.equal(revisionSnap.data().validation.blocking, false);

  const eventTypes = auditSnap.docs.map((d) => d.data().event_type);
  assert.ok(eventTypes.includes('VALIDATION_STARTED'));
  assert.ok(eventTypes.includes('VALIDATION_COMPLETED'));
});

test('orchestrator routes impossible science to NEEDS_CORRECTION', async () => {
  const seeded = await seedSubmission({ ph: 15 });

  const output = await runValidationForSubmission({
    db,
    Timestamp,
    submissionId: seeded.submissionId,
    now: NOW,
  });

  assert.equal(output.final_status, 'NEEDS_CORRECTION');
  assert.equal(output.blocking, true);

  const submissionSnap = await seeded.submissionRef.get();
  const flagsSnap = await seeded.revisionRef.collection('validationFlags').get();

  assert.equal(submissionSnap.data().status, 'NEEDS_CORRECTION');
  assert.equal(submissionSnap.data().overall_quality_score, null);
  assert.ok(flagsSnap.docs.some((d) => d.data().severity === 'ERROR'));
});

test('orchestrator loads approved site history and surfaces a nonblocking anomaly', async () => {
  await seedApprovedPhHistory(8);
  const seeded = await seedSubmission({ ph: 9.5 });

  const output = await runValidationForSubmission({
    db,
    Timestamp,
    submissionId: seeded.submissionId,
    now: NOW,
  });

  assert.equal(output.final_status, 'PENDING_REVIEW');
  assert.equal(output.blocking, false);
  assert.ok(output.result.scores.anomaly_score >= 75);
  assert.ok(output.result.flags.some((f) => f.rule_code === 'HISTORICAL_ANOMALY'));

  const flagsSnap = await seeded.revisionRef.collection('validationFlags').get();
  assert.ok(flagsSnap.docs.some((d) => d.data().rule_code === 'HISTORICAL_ANOMALY'));
});

test('unexpected validation-system failure releases claim back to source status for retry', async () => {
  const seeded = await seedSubmission();

  await assert.rejects(
    () => runValidationForSubmission({
      db,
      Timestamp,
      submissionId: seeded.submissionId,
      now: NOW,
      validate: () => {
        throw new Error('synthetic engine outage');
      },
    }),
    /synthetic engine outage/,
  );

  const submissionSnap = await seeded.submissionRef.get();
  const auditSnap = await seeded.submissionRef.collection('audit').get();
  const eventTypes = auditSnap.docs.map((d) => d.data().event_type);

  assert.equal(submissionSnap.data().status, 'SUBMITTED');
  assert.ok(eventTypes.includes('VALIDATION_STARTED'));
  assert.ok(eventTypes.includes('VALIDATION_SYSTEM_FAILURE'));
});
