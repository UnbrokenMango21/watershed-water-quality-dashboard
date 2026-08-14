#!/usr/bin/env node
// Creates representative QC lifecycle records in the development project only.
// Dry-run is credential-free; --apply requires Admin SDK credentials and the test
// users from scripts/provision_test_users.mjs. Every apply uses new UUIDs and never
// overwrites an existing submission or immutable revision.

import { randomUUID } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, GeoPoint, Timestamp } from 'firebase-admin/firestore';

import { applyReviewDecision } from '../web/lib/reviewSubmission.mjs';
import { runValidationForSubmission } from '../validation/orchestrator.mjs';

const DEV_PROJECT_ID = 'central-pa-watershed-dev';
const COLLECTOR_EMAIL = 'test.collector.01@central-pa-watershed-dev.local';
const REVIEWER_EMAIL = 'test.qc.reviewer@central-pa-watershed-dev.local';
const apply = process.argv.includes('--apply');

console.log(`Target project: ${DEV_PROJECT_ID}${apply ? ' (APPLY)' : ' (dry run)'}`);
console.log('Scenarios: clean PENDING_REVIEW, warning PENDING_REVIEW, blocking NEEDS_CORRECTION, correction revision 2 PENDING_REVIEW, rejection REJECTED.');

if (!apply) {
  console.log('Dry run only — no credentials were loaded and no changes were made. Re-run with --apply.');
  process.exit(0);
}

const app = initializeApp({ projectId: DEV_PROJECT_ID });
if (app.options.projectId !== DEV_PROJECT_ID) {
  throw new Error(`Refusing to run outside ${DEV_PROJECT_ID}.`);
}

const auth = getAuth(app);
const db = getFirestore(app);
const [collector, reviewer] = await Promise.all([
  auth.getUserByEmail(COLLECTOR_EMAIL),
  auth.getUserByEmail(REVIEWER_EMAIL),
]);

if (collector.customClaims?.role !== 'COLLECTOR' || reviewer.customClaims?.role !== 'QC_REVIEWER') {
  throw new Error('Expected dev test roles are missing. Run scripts/provision_test_users.mjs --apply first.');
}

const now = new Date();
const createdAt = new Date(now.valueOf() - 45 * 60_000);
const collectedAt = new Date(now.valueOf() - 30 * 60_000);
const submittedAt = new Date(now.valueOf() - 15 * 60_000);
const siteId = 'site-test-001';

await db.collection('siteCatalog').doc(siteId).set({
  site_id: siteId,
  site_code: 'TEST-001',
  site_name_display: 'Spring Creek at Houserville Road Bridge',
  county: 'Centre',
  watershed_name: 'Spring Creek',
  latitude: 40.7934,
  longitude: -77.86,
  location: new GeoPoint(40.7934, -77.86),
  site_tolerance_m: 30,
  active: true,
  updated_at: Timestamp.fromDate(now),
}, { merge: true });

function revision(submissionId, eventId, revisionId, revisionNo, ph) {
  return {
    revision_id: revisionId,
    revision_no: revisionNo,
    submission_id: submissionId,
    event_id: eventId,
    collector_user_id: collector.uid,
    site_id: siteId,
    revision_status: 'SUBMITTED',
    created_at: Timestamp.fromDate(createdAt),
    submitted_at: Timestamp.fromDate(submittedAt),
    collected_at: Timestamp.fromDate(collectedAt),
    time_known: true,
    time_imputed: false,
    latitude: 40.7934,
    longitude: -77.86,
    location: new GeoPoint(40.7934, -77.86),
    gps_accuracy_m: 4,
    site_distance_m: 0,
    weather_condition: 'Clear',
    data_collected_by: 'Test Collector 01',
    test_type: 'In-situ / Field Instrument',
    test_type_other: null,
    method_name: 'Calibrated multiparameter field meter',
    instrument_name: 'QC Smoke Sonde',
    instrument_other: null,
    temp_entered_value: 68,
    temp_entered_unit: 'F',
    temp_c: 20,
    temp_f: 68,
    field_notes_original: `Development QC smoke scenario; pH ${ph}.`,
    schema_version: '0.1.0',
    mobile_app_version: 'qc-smoke-seed-1',
  };
}

function measurements(ph) {
  const base = {
    method_name: 'Field meter',
    instrument_name: 'QC Smoke Sonde',
    qualifier: null,
    notes: null,
    entered_at: Timestamp.fromDate(now),
  };
  return [
    { ...base, measurement_id: 'm-PH', parameter_code: 'PH', display_name: 'pH', value: ph, unit_code: 'pH', entered_value: ph, entered_unit_code: 'ph-standard' },
    { ...base, measurement_id: 'm-DO', parameter_code: 'DO_MG_L', display_name: 'Dissolved oxygen', value: 9, unit_code: 'mg/L', entered_value: 9, entered_unit_code: 'mg-o2-l' },
    { ...base, measurement_id: 'm-CONDUCTIVITY', parameter_code: 'CONDUCTIVITY_US_CM', display_name: 'Conductivity', value: 350, unit_code: 'uS/cm', entered_value: 0.35, entered_unit_code: 'ms-cm' },
  ];
}

async function seedSubmitted(scenario, ph) {
  const submissionId = randomUUID();
  const revisionId = randomUUID();
  const eventId = randomUUID();
  const rev = revision(submissionId, eventId, revisionId, 1, ph);
  const submissionRef = db.collection('submissions').doc(submissionId);
  const revisionRef = submissionRef.collection('revisions').doc(revisionId);

  await submissionRef.create({
    submission_id: submissionId,
    event_id: eventId,
    collector_user_id: collector.uid,
    site_id: siteId,
    status: 'SUBMITTED',
    current_revision_id: revisionId,
    current_revision_no: 1,
    latest_collected_at: rev.collected_at,
    created_at: rev.created_at,
    updated_at: rev.submitted_at,
    submitted_at: rev.submitted_at,
    schema_version: rev.schema_version,
    mobile_app_version: rev.mobile_app_version,
  });
  await revisionRef.create(rev);
  for (const measurement of measurements(ph)) {
    await revisionRef.collection('measurements').doc(measurement.measurement_id).create(measurement);
  }
  await runValidationForSubmission({ db, Timestamp, submissionId, now });
  return { scenario, submissionId, revisionId, eventId, submissionRef, revisionRef };
}

const clean = await seedSubmitted('CLEAN', 7.2);
const warning = await seedSubmitted('WARNING', 5);
const blocking = await seedSubmitted('BLOCKING', 15);
const correction = await seedSubmitted('CORRECTION', 7.2);
await applyReviewDecision({
  db,
  Timestamp,
  submissionId: correction.submissionId,
  expectedRevisionId: correction.revisionId,
  decision: 'NEEDS_CORRECTION',
  reviewerUid: reviewer.uid,
  reviewerRole: 'QC_REVIEWER',
  reason: 'Development smoke fixture: verify immutable correction revision lifecycle.',
  now,
});

const correctionRevisionId = randomUUID();
const correctionRevision = revision(correction.submissionId, correction.eventId, correctionRevisionId, 2, 7.4);
const correctionRevisionRef = correction.submissionRef.collection('revisions').doc(correctionRevisionId);
await correctionRevisionRef.create(correctionRevision);
for (const measurement of measurements(7.4)) {
  await correctionRevisionRef.collection('measurements').doc(measurement.measurement_id).create(measurement);
}
await correction.submissionRef.update({
  status: 'RESUBMITTED',
  current_revision_id: correctionRevisionId,
  current_revision_no: 2,
  latest_collected_at: correctionRevision.collected_at,
  submitted_at: correctionRevision.submitted_at,
  updated_at: Timestamp.fromDate(now),
});
await runValidationForSubmission({ db, Timestamp, submissionId: correction.submissionId, now });

const rejection = await seedSubmitted('REJECTION', 7.2);
await applyReviewDecision({
  db,
  Timestamp,
  submissionId: rejection.submissionId,
  expectedRevisionId: rejection.revisionId,
  decision: 'REJECT',
  reviewerUid: reviewer.uid,
  reviewerRole: 'QC_REVIEWER',
  reason: 'Development smoke fixture: representative rejected submission.',
  now,
});

for (const record of [clean, warning, blocking, correction, rejection]) {
  const snapshot = await record.submissionRef.get();
  console.log(`${record.scenario}: ${record.submissionId} -> ${snapshot.data().status}`);
}
