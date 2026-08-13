import fs from 'node:fs';
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
const attachmentPath = (attachmentId, extension = 'jpg') =>
  `users/collector-a/submissions/${SUBMISSION_ID}/revisions/${REVISION_ID}/${attachmentId}.${extension}`;

let env;

const metadata = (attachmentId, overrides = {}) => ({
  ownerUid: 'collector-a',
  submissionId: SUBMISSION_ID,
  revisionId: REVISION_ID,
  attachmentId,
  ...overrides,
});

async function seed(revisionStatus = 'DRAFT') {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, `submissions/${SUBMISSION_ID}`), {
      submission_id: SUBMISSION_ID,
      collector_user_id: 'collector-a',
    });
    await setDoc(doc(db, `submissions/${SUBMISSION_ID}/revisions/${REVISION_ID}`), {
      revision_id: REVISION_ID,
      collector_user_id: 'collector-a',
      revision_status: revisionStatus,
    });
  });
}

function upload(context, attachmentId, options = {}) {
  const objectPath = options.objectPath ?? attachmentPath(attachmentId, options.extension);
  const bytes = options.bytes ?? new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  return uploadBytes(ref(context.storage(), objectPath), bytes, {
    contentType: options.contentType ?? 'image/jpeg',
    customMetadata: options.metadata ?? metadata(attachmentId),
  });
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: fs.readFileSync(FIRESTORE_RULES, 'utf8') },
    storage: { rules: fs.readFileSync(STORAGE_RULES, 'utf8') },
  });
  await env.clearFirestore();
  await env.clearStorage();
  await seed();
});

after(async () => env.cleanup());

test('owner can upload and read a valid immutable draft attachment', async () => {
  const attachmentId = '55555555-5555-4555-8555-555555555501';
  const owner = env.authenticatedContext('collector-a');
  await assertSucceeds(upload(owner, attachmentId));
  await assertSucceeds(getBytes(ref(owner.storage(), attachmentPath(attachmentId))));
});

test('another collector cannot upload or read the owner attachment', async () => {
  const attachmentId = '55555555-5555-4555-8555-555555555502';
  const forgedId = '55555555-5555-4555-8555-555555555522';
  const other = env.authenticatedContext('collector-b');
  await assertFails(upload(other, forgedId));
  const owner = env.authenticatedContext('collector-a');
  await assertSucceeds(upload(owner, attachmentId));
  await assertFails(getBytes(ref(other.storage(), attachmentPath(attachmentId))));
});

test('reviewer can read but cannot upload collector media', async () => {
  const attachmentId = '55555555-5555-4555-8555-555555555503';
  const owner = env.authenticatedContext('collector-a');
  await assertSucceeds(upload(owner, attachmentId));
  const reviewer = env.authenticatedContext('reviewer-1', { role: 'QC_REVIEWER' });
  await assertSucceeds(getBytes(ref(reviewer.storage(), attachmentPath(attachmentId))));
  const forgedId = '55555555-5555-4555-8555-555555555533';
  await assertFails(upload(reviewer, forgedId, { contentType: 'image/png', extension: 'png' }));
});

test('upload rejects forged metadata, path identity, MIME and empty content', async () => {
  const owner = env.authenticatedContext('collector-a');
  const forgedMetadataId = '55555555-5555-4555-8555-555555555504';
  await assertFails(upload(owner, forgedMetadataId, { metadata: metadata(forgedMetadataId, { ownerUid: 'collector-b' }) }));
  const forgedPathId = '55555555-5555-4555-8555-555555555544';
  await assertFails(upload(owner, forgedPathId, { objectPath: attachmentPath('99999999-9999-4999-8999-999999999999') }));
  await assertFails(upload(owner, '55555555-5555-4555-8555-555555555545', { contentType: 'text/plain' }));
  await assertFails(upload(owner, '55555555-5555-4555-8555-555555555546', { bytes: new Uint8Array() }));
});

test('attachment cannot be overwritten and submitted revision media cannot be changed', async () => {
  const attachmentId = '55555555-5555-4555-8555-555555555505';
  const owner = env.authenticatedContext('collector-a');
  await assertSucceeds(upload(owner, attachmentId));
  await assertFails(upload(owner, attachmentId));
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), `submissions/${SUBMISSION_ID}/revisions/${REVISION_ID}`), {
      revision_id: REVISION_ID,
      collector_user_id: 'collector-a',
      revision_status: 'SUBMITTED',
    });
  });
  await assertFails(deleteObject(ref(owner.storage(), attachmentPath(attachmentId))));
});

test('owner may delete an orphan before revision submission', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), `submissions/${SUBMISSION_ID}/revisions/${REVISION_ID}`), {
      revision_id: REVISION_ID,
      collector_user_id: 'collector-a',
      revision_status: 'DRAFT',
    });
  });
  const attachmentId = '55555555-5555-4555-8555-555555555506';
  const owner = env.authenticatedContext('collector-a');
  await assertSucceeds(upload(owner, attachmentId));
  await assertSucceeds(deleteObject(ref(owner.storage(), attachmentPath(attachmentId))));
});
