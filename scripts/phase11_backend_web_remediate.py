#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def p(path: str) -> Path:
    return ROOT / path


def read(path: str) -> str:
    return p(path).read_text()


def write(path: str, text: str) -> None:
    p(path).write_text(text)


def replace(path: str, old: str, new: str, expected: int = 1) -> None:
    text = read(path)
    count = text.count(old)
    if count != expected:
        raise RuntimeError(f"{path}: expected {expected} occurrences, found {count}: {old[:100]!r}")
    write(path, text.replace(old, new))


def regex_replace(path: str, pattern: str, new: str, expected: int = 1) -> None:
    text = read(path)
    result, count = re.subn(pattern, new, text, count=expected, flags=re.S)
    if count != expected:
        raise RuntimeError(f"{path}: expected {expected} regex replacements, found {count}: {pattern[:100]!r}")
    write(path, result)


def dump_json(path: str, data: dict) -> None:
    write(path, json.dumps(data, indent=2, ensure_ascii=False) + "\n")


# ---------------------------------------------------------------------------
# Phase 11 collection policy: Water Temperature is the only required science
# measurement for the first production push. Other supported measurements are
# optional but still receive full numeric/range/provenance validation if entered.
# ---------------------------------------------------------------------------
protocol_path = "config/collection_protocol.json"
protocol = json.loads(read(protocol_path))
protocol["requiredCoreParameters"] = ["WATER_TEMP_C"]
existing_optional = protocol.get("optionalParameters", [])
protocol["optionalParameters"] = list(dict.fromkeys([
    "PH", "DO_MG_L", "CONDUCTIVITY_US_CM", *existing_optional,
]))
protocol["mediaCapture"] = {
    "enabledForFirstProductionRelease": False,
    "deferredFeature": True,
    "policy": "Photo capture/import and audio recording/upload are disabled for the Phase 11 first production release. Field notes remain supported.",
}
dump_json(protocol_path, protocol)

validation_path = "config/validation_rules.json"
validation = json.loads(read(validation_path))
for profile in validation.get("testTypeProfiles", {}).values():
    profile["requiredMeasurements"] = []
    profile["minimumMeasurementCount"] = 0
validation["firstProductionRequiredMeasurementPolicy"] = {
    "requiredMeasurement": "WATER_TEMP_C",
    "storageLocation": "revision temperature provenance fields",
    "otherSupportedMeasurementsRequired": False,
}
dump_json(validation_path, validation)

schema_path = "config/firebase_schema.json"
schema = json.loads(read(schema_path))
schema["releaseFeaturePolicy"] = {
    "phase": "Phase 11 first production release",
    "photoCaptureEnabled": False,
    "audioRecordingEnabled": False,
    "attachmentWritesEnabled": False,
    "note": "Attachment schema is retained for forward compatibility, but mobile capture/upload and client attachment writes are disabled until a later explicitly reviewed phase.",
}
try:
    attachments_schema = schema["collections"]["submissions"]["subcollections"]["revisions"]["subcollections"]["attachments"]
    attachments_schema["productionCaptureEnabled"] = False
    attachments_schema["policy"] = "Deferred after Phase 11. Client attachment metadata writes are denied in the first production release."
except KeyError:
    pass
dump_json(schema_path, schema)

# ---------------------------------------------------------------------------
# Validation engine: remove hidden per-test-type minimums and verify entered
# provenance against canonical values using the same stable unit IDs as mobile.
# ---------------------------------------------------------------------------
engine = "validation/engine.mjs"
replace(
    engine,
    "    || { requiredMeasurements: [], minimumMeasurementCount: 1 };",
    "    || { requiredMeasurements: [], minimumMeasurementCount: 0 };",
)

provenance_impl = r'''
const ENTERED_UNIT_CONVERSIONS = {
  PH: { 'ph-standard': (v) => v },
  DO_MG_L: { 'mg-o2-l': (v) => v, 'umol-o2-l': (v) => v * 0.0319988 },
  DO_PERCENT: { percent: (v) => v },
  CONDUCTIVITY_US_CM: { 'us-cm': (v) => v, 'ms-cm': (v) => v * 1000, 's-m': (v) => v * 10000 },
  TDS_MG_L: { 'mg-l': (v) => v, 'g-l': (v) => v * 1000 },
  ORP_MV: { mv: (v) => v, v: (v) => v * 1000 },
  CHLORIDE_MG_L: { 'mg-l': (v) => v, 'ug-l': (v) => v * 0.001 },
  SULFATE_MG_L: { 'mg-l': (v) => v, 'ug-l': (v) => v * 0.001 },
  NITRATE_MG_L: {
    'mg-n-l': (v) => v,
    'ug-n-l': (v) => v * 0.001,
    'mg-no3-l': (v) => v * (14 / 62),
    'ug-no3-l': (v) => v * (0.014 / 62),
  },
  PHOSPHATE_MG_L: {
    'mg-p-l': (v) => v,
    'ug-p-l': (v) => v * 0.001,
    'mg-po4-l': (v) => v * 0.326315789,
    'ug-po4-l': (v) => v * 0.000326315789,
  },
  DISCHARGE_M3_S: {
    'm3-s': (v) => v,
    'l-s': (v) => v * 0.001,
    'ft3-s': (v) => v * 0.028316846592,
    'gal-min': (v) => v * 0.0000630901964,
  },
};

function nearlyEqual(a, b) {
  const tolerance = 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= tolerance;
}

function validateMeasurementProvenance(measurement, flags) {
  const code = measurement?.parameter_code;
  if (!isFiniteNumber(measurement?.entered_value)) {
    flags.push(createFlag(
      'ENTERED_VALUE_INVALID',
      'ERROR',
      'DATA_CONSISTENCY',
      'Collector-entered measurement provenance is missing or non-numeric.',
      code || null,
      { affectsQualityComponent: 'validation' },
    ));
    return;
  }

  const converter = ENTERED_UNIT_CONVERSIONS[code]?.[measurement?.entered_unit_code];
  if (!converter) {
    flags.push(createFlag(
      'ENTERED_UNIT_CODE_INVALID',
      'ERROR',
      'DATA_CONSISTENCY',
      `Stable entered unit id '${measurement?.entered_unit_code ?? ''}' is not valid for '${code ?? 'unknown'}'.`,
      code || null,
      { affectsQualityComponent: 'validation' },
    ));
    return;
  }

  if (!isFiniteNumber(measurement?.value)) return;
  const expected = converter(measurement.entered_value);
  if (!Number.isFinite(expected) || !nearlyEqual(expected, measurement.value)) {
    flags.push(createFlag(
      'ENTERED_CANONICAL_MISMATCH',
      'ERROR',
      'DATA_CONSISTENCY',
      'Canonical measurement value does not agree with the collector-entered value and stable unit id.',
      code || null,
      { affectsQualityComponent: 'validation' },
    ));
  }
}

'''
replace(engine, "function validateMeasurements(measurements, rules, flags) {\n", provenance_impl + "function validateMeasurements(measurements, rules, flags) {\n")
replace(engine, "  for (const m of measurements || []) {\n    const code = m.parameter_code;", "  for (const m of measurements || []) {\n    validateMeasurementProvenance(m, flags);\n    const code = m.parameter_code;")

# Validation contract tests now include entered provenance by default and explicitly
# prove first-release optional measurements plus conversion/tamper behavior.
validation_test = "tests/validation/validation_engine.test.mjs"
replace(
    validation_test,
    "function measurement(code, value, unit = 'unit', overrides = {}) {\n  return {",
    "const enteredUnitByCode = {\n  PH: 'ph-standard', DO_MG_L: 'mg-o2-l', DO_PERCENT: 'percent', CONDUCTIVITY_US_CM: 'us-cm',\n  TDS_MG_L: 'mg-l', ORP_MV: 'mv', CHLORIDE_MG_L: 'mg-l', SULFATE_MG_L: 'mg-l',\n  NITRATE_MG_L: 'mg-n-l', PHOSPHATE_MG_L: 'mg-p-l', DISCHARGE_M3_S: 'm3-s',\n};\n\nfunction measurement(code, value, unit = 'unit', overrides = {}) {\n  return {",
)
replace(
    validation_test,
    "    value,\n    unit_code: unit,\n    method_name:",
    "    value,\n    unit_code: unit,\n    entered_value: value,\n    entered_unit_code: enteredUnitByCode[code] ?? 'mg-l',\n    method_name:",
)
regex_replace(
    validation_test,
    r"test\('missing required core measurement blocks review', \(\) => \{.*?\n\}\);",
    """test('non-temperature measurements are optional in the first production release', () => {\n  const result = validateObservation({ revision: revision(), measurements: [], site, now: NOW });\n  assert.equal(result.blocking, false);\n  assert.equal(result.counts.error, 0);\n  assert.ok(!result.flags.some((f) => f.rule_code === 'REQ_MEASUREMENT_MISSING'));\n});""",
)
regex_replace(
    validation_test,
    r"test\('lab-only test type requires a measurement but not the in-situ core', \(\) => \{.*?\n\}\);",
    """test('lab-only test type also permits temperature-only first-release science', () => {\n  const result = validateObservation({\n    revision: revision({ test_type: 'Penn State Lab' }),\n    measurements: [],\n    site,\n    now: NOW,\n  });\n  assert.equal(result.blocking, false);\n  assert.equal(result.counts.error, 0);\n});""",
)
insert_before = "test('chloride above contextual reference is environmental alert, not bad-data warning', () => {"
provenance_tests = """test('entered stable unit provenance converts to the canonical value', () => {\n  const conductivity = measurement('CONDUCTIVITY_US_CM', 350, 'uS/cm', {\n    entered_value: 0.35,\n    entered_unit_code: 'ms-cm',\n  });\n  const result = validateObservation({ revision: revision(), measurements: [conductivity], site, now: NOW });\n  assert.equal(result.blocking, false);\n  assert.ok(!result.flags.some((f) => f.rule_code === 'ENTERED_CANONICAL_MISMATCH'));\n});\n\ntest('display aliases and entered/canonical mismatches are blocking provenance errors', () => {\n  const badAlias = validateObservation({\n    revision: revision(),\n    measurements: [measurement('CONDUCTIVITY_US_CM', 350, 'uS/cm', { entered_value: 0.35, entered_unit_code: 'mS/cm' })],\n    site,\n    now: NOW,\n  });\n  assert.equal(badAlias.blocking, true);\n  assert.ok(badAlias.flags.some((f) => f.rule_code === 'ENTERED_UNIT_CODE_INVALID'));\n\n  const mismatch = validateObservation({\n    revision: revision(),\n    measurements: [measurement('CONDUCTIVITY_US_CM', 35, 'uS/cm', { entered_value: 0.35, entered_unit_code: 'ms-cm' })],\n    site,\n    now: NOW,\n  });\n  assert.equal(mismatch.blocking, true);\n  assert.ok(mismatch.flags.some((f) => f.rule_code === 'ENTERED_CANONICAL_MISMATCH'));\n});\n\n"""
replace(validation_test, insert_before, provenance_tests + insert_before)

# ---------------------------------------------------------------------------
# Firestore: trust both final workflow timestamps, enforce stable entered unit ids,
# and hard-disable attachment metadata writes for the first production release.
# ---------------------------------------------------------------------------
rules = "firebase/firestore.rules"
replace(rules, "        && request.resource.data.updated_at is timestamp\n        && request.resource.data.submitted_at == request.time", "        && request.resource.data.updated_at == request.time\n        && request.resource.data.submitted_at == request.time")

entered_unit_rules = r'''
    function validEnteredUnit(parameterCode, enteredUnitCode) {
      return (parameterCode == "PH" && enteredUnitCode == "ph-standard")
        || (parameterCode == "DO_MG_L" && enteredUnitCode in ["mg-o2-l", "umol-o2-l"])
        || (parameterCode == "DO_PERCENT" && enteredUnitCode == "percent")
        || (parameterCode == "CONDUCTIVITY_US_CM" && enteredUnitCode in ["us-cm", "ms-cm", "s-m"])
        || (parameterCode == "TDS_MG_L" && enteredUnitCode in ["mg-l", "g-l"])
        || (parameterCode == "ORP_MV" && enteredUnitCode in ["mv", "v"])
        || (parameterCode in ["CHLORIDE_MG_L", "SULFATE_MG_L"] && enteredUnitCode in ["mg-l", "ug-l"])
        || (parameterCode == "NITRATE_MG_L" && enteredUnitCode in ["mg-n-l", "ug-n-l", "mg-no3-l", "ug-no3-l"])
        || (parameterCode == "PHOSPHATE_MG_L" && enteredUnitCode in ["mg-p-l", "ug-p-l", "mg-po4-l", "ug-po4-l"])
        || (parameterCode == "DISCHARGE_M3_S" && enteredUnitCode in ["m3-s", "l-s", "ft3-s", "gal-min"]);
    }

'''
replace(rules, "    function validMeasurement(measurementId) {\n", entered_unit_rules + "    function validMeasurement(measurementId) {\n")
replace(rules, "        && nonEmptyString(request.resource.data.entered_unit_code)\n", "        && validEnteredUnit(request.resource.data.parameter_code, request.resource.data.entered_unit_code)\n")
regex_replace(
    rules,
    r"        match /attachments/\{attachmentId\} \{\n          allow read: if canReadSubmission\(submissionId\);\n\n          allow create, update:.*?\n        \}",
    """        match /attachments/{attachmentId} {\n          allow read: if canReadSubmission(submissionId);\n          // First production release: media capture/upload is intentionally disabled.\n          allow create, update, delete: if false;\n        }""",
)

# Storage keeps legacy read capability but no client may create/update/delete media.
storage_rules = r'''rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    function signedIn() {
      return request.auth != null;
    }

    function privilegedReader() {
      return signedIn()
        && "role" in request.auth.token
        && request.auth.token.role in ["ADMIN", "QC_REVIEWER"];
    }

    function submission(submissionId) {
      return firestore.get(/databases/(default)/documents/submissions/$(submissionId));
    }

    match /users/{userId}/submissions/{submissionId}/revisions/{revisionId}/{fileName} {
      // Read remains available for any historical/dev object already present.
      allow read: if signedIn()
        && (request.auth.uid == userId || privilegedReader())
        && submission(submissionId).data.collector_user_id == userId;

      // Phase 11 first production release deliberately ships without media capture/upload.
      allow create, update, delete: if false;
    }

    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
'''
write("firebase/storage.rules", storage_rules)

# Firestore rules tests: stable unit IDs, forged updated_at, media metadata denied.
fr_test = "tests/firestore-rules/firestore.rules.test.mjs"
replace(fr_test, "    entered_unit_code: 'pH',", "    entered_unit_code: 'ph-standard',")
replace(fr_test, "    entered_unit_code: 'mS/cm',", "    entered_unit_code: 'ms-cm',")
insert_after_forged_submit = """test('collector cannot forge submission submitted_at with a phone-supplied timestamp', async () => {\n  await seed(`submissions/${submissionId}`, draftSubmission());\n  await seed(`submissions/${submissionId}/revisions/${revisionId}`, draftRevision({ revision_status: 'SUBMITTED', submitted_at: nowString() }));\n  const db = env.authenticatedContext('collector-a').firestore();\n  await assertFails(updateDoc(doc(db, `submissions/${submissionId}`), {\n    status: 'SUBMITTED',\n    submitted_at: nowString(),\n    updated_at: serverTimestamp()\n  }));\n  await assertFails(updateDoc(doc(db, `submissions/${submissionId}`), {\n    status: 'SUBMITTED',\n    submitted_at: Timestamp.fromDate(new Date('2099-01-01T00:00:00Z')),\n    updated_at: serverTimestamp()\n  }));\n});\n"""
replace(
    fr_test,
    insert_after_forged_submit,
    insert_after_forged_submit + """\ntest('collector cannot forge final submission updated_at with a phone-supplied timestamp', async () => {\n  await seed(`submissions/${submissionId}`, draftSubmission());\n  await seed(`submissions/${submissionId}/revisions/${revisionId}`, draftRevision({ revision_status: 'SUBMITTED', submitted_at: nowString() }));\n  const db = env.authenticatedContext('collector-a').firestore();\n  await assertFails(updateDoc(doc(db, `submissions/${submissionId}`), {\n    status: 'SUBMITTED',\n    submitted_at: serverTimestamp(),\n    updated_at: Timestamp.fromDate(new Date('2099-01-01T00:00:00Z'))\n  }));\n});\n""",
)
replace(
    fr_test,
    "  await assertFails(setDoc(doc(db, path), measurement('m-1', { entered_unit_code: '' })));",
    "  await assertFails(setDoc(doc(db, path), measurement('m-1', { entered_unit_code: '' })));\n  await assertFails(setDoc(doc(db, path), measurement('m-1', { entered_unit_code: 'mS/cm' })));\n  await assertFails(setDoc(doc(db, path), measurement('m-1', { entered_unit_code: 'arbitrary-unit' })));",
)
regex_replace(
    fr_test,
    r"test\('attachment metadata requires exact owner-scoped storage path, MIME and size', async \(\) => \{.*?\n\}\);",
    """test('collector attachment metadata writes are disabled for the first production release', async () => {\n  await seed(`submissions/${submissionId}`, draftSubmission());\n  await seed(`submissions/${submissionId}/revisions/${revisionId}`, draftRevision());\n  const db = env.authenticatedContext('collector-a').firestore();\n  await assertFails(setDoc(\n    doc(db, `submissions/${submissionId}/revisions/${revisionId}/attachments/a-1`),\n    attachment(),\n  ));\n});""",
)

# Storage test suite now proves release media writes are denied while legacy reads stay scoped.
storage_test = r'''import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { before, after } from 'node:test';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';

const PROJECT_ID = 'central-pa-watershed-dev';
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const FIRESTORE_RULES = path.resolve(TEST_DIR, '../../firebase/firestore.rules');
const STORAGE_RULES = path.resolve(TEST_DIR, '../../firebase/storage.rules');
const SUBMISSION_ID = '11111111-1111-4111-8111-111111111111';
const REVISION_ID = '33333333-3333-4333-8333-333333333333';
const ATTACHMENT_ID = '55555555-5555-4555-8555-555555555501';
const OBJECT_PATH = `users/collector-a/submissions/${SUBMISSION_ID}/revisions/${REVISION_ID}/${ATTACHMENT_ID}.jpg`;

let env;

const upload = (context, path = OBJECT_PATH) => uploadBytes(ref(context.storage(), path), new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), {
  contentType: 'image/jpeg',
  customMetadata: { ownerUid: 'collector-a', submissionId: SUBMISSION_ID, revisionId: REVISION_ID, attachmentId: ATTACHMENT_ID },
});

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: fs.readFileSync(FIRESTORE_RULES, 'utf8') },
    storage: { rules: fs.readFileSync(STORAGE_RULES, 'utf8') },
  });
  await env.clearFirestore();
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), `submissions/${SUBMISSION_ID}`), {
      submission_id: SUBMISSION_ID,
      collector_user_id: 'collector-a',
    });
    await upload(context);
  });
});

after(async () => env.cleanup());

test('collector cannot upload media in the first production release', async () => {
  const owner = env.authenticatedContext('collector-a');
  await assertFails(upload(owner, `users/collector-a/submissions/${SUBMISSION_ID}/revisions/${REVISION_ID}/new-photo.jpg`));
});

test('QC reviewer cannot upload media', async () => {
  const reviewer = env.authenticatedContext('reviewer-1', { role: 'QC_REVIEWER' });
  await assertFails(upload(reviewer, `users/collector-a/submissions/${SUBMISSION_ID}/revisions/${REVISION_ID}/reviewer-photo.jpg`));
});

test('existing owner media remains readable but not mutable', async () => {
  const owner = env.authenticatedContext('collector-a');
  await assertSucceeds(getBytes(ref(owner.storage(), OBJECT_PATH)));
  await assertFails(deleteObject(ref(owner.storage(), OBJECT_PATH)));
});

test('existing media remains readable to QC reviewers but private from other collectors', async () => {
  const reviewer = env.authenticatedContext('reviewer-1', { role: 'QC_REVIEWER' });
  const other = env.authenticatedContext('collector-b');
  await assertSucceeds(getBytes(ref(reviewer.storage(), OBJECT_PATH)));
  await assertFails(getBytes(ref(other.storage(), OBJECT_PATH)));
});
'''
write("tests/firestore-rules/storage.rules.test.mjs", storage_test)

# ---------------------------------------------------------------------------
# Review transaction: only a truly identical retry is idempotent.
# ---------------------------------------------------------------------------
review_core = "review/reviewSubmission.mjs"
replace(
    review_core,
    "  const occurredAt = Timestamp.fromDate(asDate(now));\n  const submissionRef = db.collection('submissions').doc(submissionId);",
    "  const reasonValue = reason != null && nonBlank(reason) ? reason.trim() : null;\n  const occurredAt = Timestamp.fromDate(asDate(now));\n  const submissionRef = db.collection('submissions').doc(submissionId);",
)
replace(
    review_core,
    """      const alreadyApplied = submission.current_revision_id === expectedRevisionId\n        && submission.status === spec.nextStatus\n        && submission.review_decision === decision;""",
    """      const audit = auditSnap.data();\n      const alreadyApplied = submission.current_revision_id === expectedRevisionId\n        && submission.status === spec.nextStatus\n        && submission.review_decision === decision\n        && audit?.event_type === spec.auditEventType\n        && audit?.actor_id === reviewerUid\n        && (audit?.reason ?? null) === reasonValue;""",
)
replace(review_core, "    const reasonValue = reason != null && nonBlank(reason) ? reason.trim() : null;\n\n    tx.update", "    tx.update")

review_test = "tests/review/review_action.test.mjs"
insert_before_concurrent = "test('concurrent conflicting decisions on the same revision: exactly one wins, the other is rejected', async () => {"
retry_tests = """test('changed comment or reviewer is not treated as an idempotent retry', async () => {\n  const seeded = await seedPendingReview();\n  await applyReviewDecision({\n    db, Timestamp, submissionId: seeded.submissionId, expectedRevisionId: seeded.revisionId,\n    decision: 'APPROVE', reviewerUid: 'reviewer-1', reviewerRole: 'QC_REVIEWER', reason: 'Verified.', now: NOW,\n  });\n\n  await assert.rejects(\n    () => applyReviewDecision({\n      db, Timestamp, submissionId: seeded.submissionId, expectedRevisionId: seeded.revisionId,\n      decision: 'APPROVE', reviewerUid: 'reviewer-1', reviewerRole: 'QC_REVIEWER', reason: 'Different comment.', now: NOW,\n    }),\n    ReviewConflictError,\n  );\n  await assert.rejects(\n    () => applyReviewDecision({\n      db, Timestamp, submissionId: seeded.submissionId, expectedRevisionId: seeded.revisionId,\n      decision: 'APPROVE', reviewerUid: 'reviewer-2', reviewerRole: 'ADMIN', reason: 'Verified.', now: NOW,\n    }),\n    ReviewConflictError,\n  );\n\n  const auditSnap = await seeded.submissionRef.collection('audit').get();\n  assert.equal(auditSnap.size, 1);\n  assert.equal(auditSnap.docs[0].data().actor_id, 'reviewer-1');\n  assert.equal(auditSnap.docs[0].data().reason, 'Verified.');\n});\n\n"""
replace(review_test, insert_before_concurrent, retry_tests + insert_before_concurrent)

# ---------------------------------------------------------------------------
# Web trust boundary: revoked tokens + active profile/role mirror; human unit labels.
# ---------------------------------------------------------------------------
api_route = "web/app/api/submissions/[submissionId]/review/route.ts"
replace(api_route, "decodedToken = await adminAuth().verifyIdToken(bearer[1]);", "decodedToken = await adminAuth().verifyIdToken(bearer[1], true);")
replace(
    api_route,
    """  const reviewerRole = typeof decodedToken.role === 'string' ? decodedToken.role : 'COLLECTOR';\n  if (!REVIEWER_ROLES.has(reviewerRole)) {\n    return jsonError('Your account is not authorized to review submissions.', 403);\n  }\n\n  let body:""",
    """  const reviewerRole = typeof decodedToken.role === 'string' ? decodedToken.role : 'COLLECTOR';\n  if (!REVIEWER_ROLES.has(reviewerRole)) {\n    return jsonError('Your account is not authorized to review submissions.', 403);\n  }\n\n  const db = adminDb();\n  try {\n    const profileSnap = await db.collection('users').doc(decodedToken.uid).get();\n    const profile = profileSnap.data();\n    if (!profileSnap.exists || profile?.active !== true || profile?.role !== reviewerRole) {\n      return jsonError('Your reviewer account is inactive or no longer authorized.', 403);\n    }\n  } catch (error) {\n    console.error('[review] reviewer profile check failed', { reviewerUid: decodedToken.uid, error });\n    return jsonError('Reviewer authorization could not be verified. Please try again.', 500);\n  }\n\n  let body:""",
)
replace(api_route, "      db: adminDb(),", "      db,")

format_path = "web/lib/format.ts"
unit_formatter = r'''
const ENTERED_UNIT_LABELS: Record<string, string> = {
  'ph-standard': 'pH',
  percent: '%',
  'mg-o2-l': 'mg/L as O₂',
  'umol-o2-l': 'µmol/L as O₂',
  'us-cm': 'µS/cm',
  'ms-cm': 'mS/cm',
  's-m': 'S/m',
  'mg-l': 'mg/L',
  'ug-l': 'µg/L',
  'g-l': 'g/L',
  mv: 'mV',
  v: 'V',
  'mg-n-l': 'mg/L as N',
  'ug-n-l': 'µg/L as N',
  'mg-no3-l': 'mg/L as NO₃',
  'ug-no3-l': 'µg/L as NO₃',
  'mg-p-l': 'mg/L as P',
  'ug-p-l': 'µg/L as P',
  'mg-po4-l': 'mg/L as PO₄',
  'ug-po4-l': 'µg/L as PO₄',
  'm3-s': 'm³/s',
  'l-s': 'L/s',
  'ft3-s': 'ft³/s',
  'gal-min': 'US gal/min',
};

export function formatEnteredUnit(value: Nullable<string>): string {
  if (value == null || String(value).trim().length === 0) return EMPTY;
  return ENTERED_UNIT_LABELS[String(value)] ?? String(value);
}

'''
replace(format_path, "export function formatText(value: Nullable<string>): string {\n", unit_formatter + "export function formatText(value: Nullable<string>): string {\n")

detail_page = "web/app/review/[submissionId]/page.tsx"
replace(detail_page, "  formatEastern,\n  formatNumber,", "  formatEastern,\n  formatEnteredUnit,\n  formatNumber,")
replace(detail_page, "        {formatText(measurement.entered_unit_code)}", "        {formatEnteredUnit(measurement.entered_unit_code)}")

# ---------------------------------------------------------------------------
# CI: QC branch and reviewer web are first-class gates.
# ---------------------------------------------------------------------------
ci = ".github/workflows/mobile-ci.yml"
replace(ci, "      - codex/mobile-production-integration-v1\n", "      - codex/mobile-production-integration-v1\n      - codex/qc-trusted-web-v1\n")
replace(ci, "      - 'validation/**'\n      - 'package*.json'", "      - 'validation/**'\n      - 'review/**'\n      - 'web/**'\n      - 'package*.json'", expected=2)
web_job = r'''
  web:
    name: QC reviewer web
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: web
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22.x'
          cache: npm
          cache-dependency-path: web/package-lock.json
      - run: npm ci
      - run: npm run typecheck
      - run: npm run build

'''
replace(ci, "  legacy-expo:\n", web_job + "  legacy-expo:\n")

print('Phase 11 backend/web remediation applied successfully.')
