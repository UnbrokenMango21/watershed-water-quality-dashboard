import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import { runValidationForSubmission } from '../../validation/orchestrator.mjs';
import { applyReviewDecision, ReviewConflictError } from '../../review/reviewSubmission.mjs';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('FIRESTORE_EMULATOR_HOST is not set. Refusing to run lifecycle tests against a non-emulator Firestore instance.');
}

const PROJECT_ID = 'central-pa-watershed-dev';
const app = initializeApp({ projectId: PROJECT_ID }, `review-lifecycle-${randomUUID()}`);
const db = getFirestore(app);
const NOW = new Date('2026-08-13T17:30:00-04:00');

const site = {
  site_id: 'SITE-LIFECYCLE-001',
  site_code: 'LC-001',
  site_name_display: 'Synthetic Lifecycle Site',
  latitude: 40.7934,
  longitude: -77.86,
  site_tolerance_m: 30,
  active: true,
  updated_at: Timestamp.fromDate(NOW),
};

function revision(submissionId, revisionId, revisionNo = 1, overrides = {}) {
  return {
    revision_id: revisionId,
    revision_no: revisionNo,
    submission_id: submissionId,
    event_id: overrides.event_id ?? randomUUID(),
    collector_user_id: 'collector-lifecycle-test',
    site_id: site.site_id,
    revision_status: 'SUBMITTED',
    created_at: Timestamp.fromDate(new Date('2026-08-13T16:00:00-04:00')),
    submitted_at: Timestamp.fromDate(new Date('2026-08-13T16:45:00-04:00')),
    collected_at: Timestamp.fromDate(new Date('2026-08-13T16:30:00-04:00')),
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
    mobile_app_version: 'review-lifecycle-test',
    ...overrides,
  };
}

function measurement(code, value, unit, overrides = {}) {
  return {
    measurement_id: `m-${code}`,
    parameter_code: code,
    display_name: code,
    value,
    unit_code: unit,
    entered_value: value,
    entered_unit_code: unit,
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

async function seedAndSubmit({ submissionId = randomUUID(), revisionId = randomUUID(), ph = 7.2 } = {}) {
  await db.collection('siteCatalog').doc(site.site_id).set(site);
  const rev = revision(submissionId, revisionId, 1);
  const submissionRef = db.collection('submissions').doc(submissionId);
  const revisionRef = submissionRef.collection('revisions').doc(revisionId);

  await submissionRef.set({
    submission_id: submissionId,
    event_id: rev.event_id,
    collector_user_id: rev.collector_user_id,
    site_id: rev.site_id,
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
  await revisionRef.set(rev);
  for (const m of coreMeasurements(ph)) {
    await revisionRef.collection('measurements').doc(m.measurement_id).set(m);
  }

  return { submissionId, revisionId, submissionRef, revisionRef, eventId: rev.event_id };
}

after(async () => {
  await deleteApp(app);
});

test('scenario A: clean submission -> VALIDATING -> PENDING_REVIEW -> approve -> APPROVED', async () => {
  const seeded = await seedAndSubmit();

  const validated = await runValidationForSubmission({ db, Timestamp, submissionId: seeded.submissionId, now: NOW });
  assert.equal(validated.final_status, 'PENDING_REVIEW');

  const approved = await applyReviewDecision({
    db, Timestamp, submissionId: seeded.submissionId, expectedRevisionId: seeded.revisionId,
    decision: 'APPROVE', reviewerUid: 'reviewer-a', reviewerRole: 'QC_REVIEWER', now: NOW,
  });
  assert.equal(approved.status, 'APPROVED');

  const submissionSnap = await seeded.submissionRef.get();
  assert.equal(submissionSnap.data().status, 'APPROVED');
  assert.equal(submissionSnap.data().current_revision_no, 1);
});

test('scenario B: request correction, resubmit revision 2, approve — revision 1 science stays unchanged', async () => {
  const seeded = await seedAndSubmit({ ph: 7.2 });

  const firstValidation = await runValidationForSubmission({ db, Timestamp, submissionId: seeded.submissionId, now: NOW });
  assert.equal(firstValidation.final_status, 'PENDING_REVIEW');

  const correction = await applyReviewDecision({
    db, Timestamp, submissionId: seeded.submissionId, expectedRevisionId: seeded.revisionId,
    decision: 'NEEDS_CORRECTION', reviewerUid: 'reviewer-a', reviewerRole: 'QC_REVIEWER',
    reason: 'Please double check the pH reading against the field notebook.', now: NOW,
  });
  assert.equal(correction.status, 'NEEDS_CORRECTION');

  const revision1SnapBeforeCorrection = await seeded.revisionRef.get();
  const revision1Before = revision1SnapBeforeCorrection.data();

  const revisionId2 = randomUUID();
  const rev2 = revision(seeded.submissionId, revisionId2, 2, { event_id: seeded.eventId });
  const revision2Ref = seeded.submissionRef.collection('revisions').doc(revisionId2);
  await revision2Ref.set(rev2);
  for (const m of coreMeasurements(7.4)) {
    await revision2Ref.collection('measurements').doc(m.measurement_id).set(m);
  }
  await seeded.submissionRef.update({
    status: 'RESUBMITTED',
    current_revision_id: revisionId2,
    current_revision_no: 2,
    updated_at: Timestamp.fromDate(NOW),
    submitted_at: rev2.submitted_at,
  });

  const secondValidation = await runValidationForSubmission({ db, Timestamp, submissionId: seeded.submissionId, now: NOW });
  assert.equal(secondValidation.final_status, 'PENDING_REVIEW');
  assert.equal(secondValidation.revision_id, revisionId2);

  const approved = await applyReviewDecision({
    db, Timestamp, submissionId: seeded.submissionId, expectedRevisionId: revisionId2,
    decision: 'APPROVE', reviewerUid: 'reviewer-a', reviewerRole: 'QC_REVIEWER', now: NOW,
  });
  assert.equal(approved.status, 'APPROVED');

  const revision1SnapAfter = await seeded.revisionRef.get();
  assert.deepEqual(revision1SnapAfter.data(), revision1Before, 'revision 1 must remain byte-for-byte unchanged after correction and resubmission');

  const m1Snap = await seeded.revisionRef.collection('measurements').doc('m-PH').get();
  assert.equal(m1Snap.data().value, 7.2, 'revision 1 measurements must remain unchanged');

  const auditSnap = await seeded.submissionRef.collection('audit').get();
  const eventTypes = auditSnap.docs.map((d) => d.data().event_type).sort();
  assert.deepEqual(eventTypes, [
    'REVIEW_APPROVED', 'REVIEW_NEEDS_CORRECTION', 'VALIDATION_COMPLETED', 'VALIDATION_COMPLETED', 'VALIDATION_STARTED', 'VALIDATION_STARTED',
  ].sort());
});

test('scenario C: blocking validation error routes to NEEDS_CORRECTION and never reaches PENDING_REVIEW or reviewer approval', async () => {
  const seeded = await seedAndSubmit({ ph: 15 });

  const validated = await runValidationForSubmission({ db, Timestamp, submissionId: seeded.submissionId, now: NOW });
  assert.equal(validated.final_status, 'NEEDS_CORRECTION');
  assert.equal(validated.blocking, true);

  const submissionSnap = await seeded.submissionRef.get();
  assert.equal(submissionSnap.data().status, 'NEEDS_CORRECTION');
  assert.notEqual(submissionSnap.data().status, 'PENDING_REVIEW');

  await assert.rejects(
    () => applyReviewDecision({
      db, Timestamp, submissionId: seeded.submissionId, expectedRevisionId: seeded.revisionId,
      decision: 'APPROVE', reviewerUid: 'reviewer-a', reviewerRole: 'QC_REVIEWER', now: NOW,
    }),
    ReviewConflictError,
    'a blocked submission must never be approvable, even by direct review-action call',
  );
});

test('scenario D: reject -> REJECTED, then a later stale approval attempt fails', async () => {
  const seeded = await seedAndSubmit();
  await runValidationForSubmission({ db, Timestamp, submissionId: seeded.submissionId, now: NOW });

  const rejected = await applyReviewDecision({
    db, Timestamp, submissionId: seeded.submissionId, expectedRevisionId: seeded.revisionId,
    decision: 'REJECT', reviewerUid: 'reviewer-a', reviewerRole: 'QC_REVIEWER', reason: 'Site does not match approved catalog location.', now: NOW,
  });
  assert.equal(rejected.status, 'REJECTED');

  await assert.rejects(
    () => applyReviewDecision({
      db, Timestamp, submissionId: seeded.submissionId, expectedRevisionId: seeded.revisionId,
      decision: 'APPROVE', reviewerUid: 'reviewer-b', reviewerRole: 'ADMIN', now: NOW,
    }),
    ReviewConflictError,
  );

  const submissionSnap = await seeded.submissionRef.get();
  assert.equal(submissionSnap.data().status, 'REJECTED');
});
