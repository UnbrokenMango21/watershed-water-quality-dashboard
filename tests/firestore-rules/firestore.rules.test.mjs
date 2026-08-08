import fs from 'node:fs';
import path from 'node:path';
import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';

const PROJECT_ID = 'central-pa-watershed-dev';
const RULES_PATH = path.resolve(process.cwd(), 'firebase/firestore.rules');

let env;

const submissionId = '11111111-1111-4111-8111-111111111111';
const eventId = '22222222-2222-4222-8222-222222222222';
const revisionId = '33333333-3333-4333-8333-333333333333';
const siteId = 'SITE-TEST-001';

function nowString() {
  return '2026-08-08T16:00:00-04:00';
}

function draftSubmission(overrides = {}) {
  return {
    submission_id: submissionId,
    event_id: eventId,
    collector_user_id: 'collector-a',
    site_id: siteId,
    status: 'DRAFT',
    current_revision_id: revisionId,
    current_revision_no: 1,
    latest_collected_at: nowString(),
    created_at: nowString(),
    updated_at: nowString(),
    submitted_at: null,
    schema_version: '0.1.0',
    mobile_app_version: '0.1.0-test',
    ...overrides
  };
}

function draftRevision(overrides = {}) {
  return {
    revision_id: revisionId,
    revision_no: 1,
    submission_id: submissionId,
    event_id: eventId,
    collector_user_id: 'collector-a',
    site_id: siteId,
    revision_status: 'DRAFT',
    created_at: nowString(),
    submitted_at: null,
    collected_at: nowString(),
    time_known: true,
    time_imputed: false,
    latitude: 40.7934,
    longitude: -77.86,
    gps_accuracy_m: 4.2,
    site_distance_m: 3.1,
    weather_condition: 'Clear',
    data_collected_by: 'Student/researcher',
    test_type: 'In-situ/Penn State Lab',
    test_type_other: null,
    method_name: 'Field meter',
    instrument_name: 'Test instrument',
    instrument_other: null,
    temp_entered_value: 68,
    temp_entered_unit: 'F',
    temp_c: 20,
    temp_f: 68,
    field_notes_original: null,
    schema_version: '0.1.0',
    mobile_app_version: '0.1.0-test',
    ...overrides
  };
}

function measurement(id = 'm-1', overrides = {}) {
  return {
    measurement_id: id,
    parameter_code: 'PH',
    display_name: 'pH',
    value: 7.2,
    unit_code: 'pH',
    method_name: 'Field meter',
    instrument_name: 'Test instrument',
    qualifier: null,
    notes: null,
    entered_at: nowString(),
    ...overrides
  };
}

async function seed(pathString, data) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), pathString), data);
  });
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(RULES_PATH, 'utf8')
    }
  });
});

beforeEach(async () => {
  await env.clearFirestore();
});

after(async () => {
  await env.cleanup();
});

test('anonymous users cannot read siteCatalog', async () => {
  await seed(`siteCatalog/${siteId}`, { site_id: siteId, active: true });
  const db = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, `siteCatalog/${siteId}`)));
});

test('authenticated collectors can read mobile-safe siteCatalog', async () => {
  await seed(`siteCatalog/${siteId}`, { site_id: siteId, active: true });
  const db = env.authenticatedContext('collector-a').firestore();
  await assertSucceeds(getDoc(doc(db, `siteCatalog/${siteId}`)));
});

test('collector can create only their own DRAFT submission', async () => {
  const db = env.authenticatedContext('collector-a').firestore();
  await assertSucceeds(setDoc(doc(db, `submissions/${submissionId}`), draftSubmission()));
});

test('collector cannot create a submission owned by another uid', async () => {
  const db = env.authenticatedContext('collector-b').firestore();
  await assertFails(setDoc(doc(db, `submissions/${submissionId}`), draftSubmission()));
});

test('collector cannot inject server-owned fields into submission creation', async () => {
  const db = env.authenticatedContext('collector-a').firestore();
  await assertFails(setDoc(doc(db, `submissions/${submissionId}`), draftSubmission({ overall_quality_score: 99 })));
});

test('collector cannot read another collector submission', async () => {
  await seed(`submissions/${submissionId}`, draftSubmission());
  const db = env.authenticatedContext('collector-b').firestore();
  await assertFails(getDoc(doc(db, `submissions/${submissionId}`)));
});

test('QC reviewer can read collector submission', async () => {
  await seed(`submissions/${submissionId}`, draftSubmission());
  const db = env.authenticatedContext('reviewer-1', { role: 'QC_REVIEWER' }).firestore();
  await assertSucceeds(getDoc(doc(db, `submissions/${submissionId}`)));
});

test('collector can transition own submission DRAFT to SUBMITTED', async () => {
  await seed(`submissions/${submissionId}`, draftSubmission());
  const db = env.authenticatedContext('collector-a').firestore();
  await assertSucceeds(updateDoc(doc(db, `submissions/${submissionId}`), {
    status: 'SUBMITTED',
    submitted_at: nowString(),
    updated_at: nowString()
  }));
});

test('collector cannot transition DRAFT directly to APPROVED', async () => {
  await seed(`submissions/${submissionId}`, draftSubmission());
  const db = env.authenticatedContext('collector-a').firestore();
  await assertFails(updateDoc(doc(db, `submissions/${submissionId}`), {
    status: 'APPROVED',
    updated_at: nowString()
  }));
});

test('collector cannot mutate stable event_id', async () => {
  await seed(`submissions/${submissionId}`, draftSubmission());
  const db = env.authenticatedContext('collector-a').firestore();
  await assertFails(updateDoc(doc(db, `submissions/${submissionId}`), {
    event_id: 'different-event'
  }));
});

test('submission deletion is denied', async () => {
  await seed(`submissions/${submissionId}`, draftSubmission());
  const db = env.authenticatedContext('collector-a').firestore();
  await assertFails(deleteDoc(doc(db, `submissions/${submissionId}`)));
});

test('collector can create a valid revision under own DRAFT submission', async () => {
  await seed(`submissions/${submissionId}`, draftSubmission());
  const db = env.authenticatedContext('collector-a').firestore();
  await assertSucceeds(setDoc(doc(db, `submissions/${submissionId}/revisions/${revisionId}`), draftRevision()));
});

test('collector revision cannot contain server-owned validation map', async () => {
  await seed(`submissions/${submissionId}`, draftSubmission());
  const db = env.authenticatedContext('collector-a').firestore();
  await assertFails(setDoc(doc(db, `submissions/${submissionId}/revisions/${revisionId}`), draftRevision({
    validation: { overall_quality_score: 100 }
  })));
});

test('collector revision must match parent site_id', async () => {
  await seed(`submissions/${submissionId}`, draftSubmission());
  const db = env.authenticatedContext('collector-a').firestore();
  await assertFails(setDoc(doc(db, `submissions/${submissionId}/revisions/${revisionId}`), draftRevision({ site_id: 'OTHER-SITE' })));
});

test('collector can submit a DRAFT revision', async () => {
  await seed(`submissions/${submissionId}`, draftSubmission());
  await seed(`submissions/${submissionId}/revisions/${revisionId}`, draftRevision());
  const db = env.authenticatedContext('collector-a').firestore();
  await assertSucceeds(updateDoc(doc(db, `submissions/${submissionId}/revisions/${revisionId}`), {
    revision_status: 'SUBMITTED',
    submitted_at: nowString()
  }));
});

test('submitted revision becomes immutable to collector', async () => {
  await seed(`submissions/${submissionId}`, draftSubmission({ status: 'SUBMITTED' }));
  await seed(`submissions/${submissionId}/revisions/${revisionId}`, draftRevision({ revision_status: 'SUBMITTED' }));
  const db = env.authenticatedContext('collector-a').firestore();
  await assertFails(updateDoc(doc(db, `submissions/${submissionId}/revisions/${revisionId}`), {
    temp_c: 25
  }));
});

test('collector can create valid measurement while revision is DRAFT', async () => {
  await seed(`submissions/${submissionId}`, draftSubmission());
  await seed(`submissions/${submissionId}/revisions/${revisionId}`, draftRevision());
  const db = env.authenticatedContext('collector-a').firestore();
  await assertSucceeds(setDoc(
    doc(db, `submissions/${submissionId}/revisions/${revisionId}/measurements/m-1`),
    measurement()
  ));
});

test('collector cannot inject unknown fields into a measurement', async () => {
  await seed(`submissions/${submissionId}`, draftSubmission());
  await seed(`submissions/${submissionId}/revisions/${revisionId}`, draftRevision());
  const db = env.authenticatedContext('collector-a').firestore();
  await assertFails(setDoc(
    doc(db, `submissions/${submissionId}/revisions/${revisionId}/measurements/m-1`),
    measurement('m-1', { overall_quality_score: 100 })
  ));
});

test('collector cannot edit measurements after revision submission', async () => {
  await seed(`submissions/${submissionId}`, draftSubmission({ status: 'SUBMITTED' }));
  await seed(`submissions/${submissionId}/revisions/${revisionId}`, draftRevision({ revision_status: 'SUBMITTED' }));
  await seed(`submissions/${submissionId}/revisions/${revisionId}/measurements/m-1`, measurement());
  const db = env.authenticatedContext('collector-a').firestore();
  await assertFails(updateDoc(
    doc(db, `submissions/${submissionId}/revisions/${revisionId}/measurements/m-1`),
    { value: 8.8 }
  ));
});

test('collector cannot write validationFlags', async () => {
  await seed(`submissions/${submissionId}`, draftSubmission());
  await seed(`submissions/${submissionId}/revisions/${revisionId}`, draftRevision());
  const db = env.authenticatedContext('collector-a').firestore();
  await assertFails(setDoc(
    doc(db, `submissions/${submissionId}/revisions/${revisionId}/validationFlags/f-1`),
    { flag_id: 'f-1', severity: 'ERROR', message: 'synthetic' }
  ));
});

test('collector cannot write audit records', async () => {
  await seed(`submissions/${submissionId}`, draftSubmission());
  const db = env.authenticatedContext('collector-a').firestore();
  await assertFails(setDoc(
    doc(db, `submissions/${submissionId}/audit/a-1`),
    { audit_id: 'a-1', event_type: 'FAKE' }
  ));
});

test('QC reviewer has read-only access and cannot update science workflow envelope', async () => {
  await seed(`submissions/${submissionId}`, draftSubmission({ status: 'PENDING_REVIEW' }));
  const db = env.authenticatedContext('reviewer-1', { role: 'QC_REVIEWER' }).firestore();
  await assertFails(updateDoc(doc(db, `submissions/${submissionId}`), {
    status: 'APPROVED'
  }));
});

test('collector can create a correction revision only when parent is NEEDS_CORRECTION', async () => {
  await seed(`submissions/${submissionId}`, draftSubmission({ status: 'NEEDS_CORRECTION' }));
  const correctionRevisionId = '44444444-4444-4444-8444-444444444444';
  const db = env.authenticatedContext('collector-a').firestore();
  await assertSucceeds(setDoc(
    doc(db, `submissions/${submissionId}/revisions/${correctionRevisionId}`),
    draftRevision({ revision_id: correctionRevisionId, revision_no: 2 })
  ));
});

test('default-deny blocks unknown top-level collection writes', async () => {
  const db = env.authenticatedContext('collector-a').firestore();
  await assertFails(setDoc(doc(db, 'unknownCollection/x'), { anything: true }));
});

test('test suite sanity check', () => {
  assert.ok(true);
});
