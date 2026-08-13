import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { runValidationForSubmission } from '../validation/orchestrator.mjs';

initializeApp();

const CLAIMABLE = new Set(['SUBMITTED', 'RESUBMITTED']);

export async function handleSubmissionStatusChange({ before, after, submissionId, db = getFirestore() }) {
  if (!after || !submissionId) return { skipped: 'missing-event-data' };
  if (!CLAIMABLE.has(after.status) || before?.status === after.status) return { skipped: 'not-newly-submitted' };

  try {
    return await runValidationForSubmission({ db, Timestamp, submissionId });
  } catch (error) {
    if (String(error?.message).includes('is not claimable')) {
      return { skipped: 'already-claimed' };
    }
    throw error;
  }
}

export const validateSubmittedObservation = onDocumentUpdated(
  {
    document: 'submissions/{submissionId}',
    region: 'us-east4',
    timeoutSeconds: 120,
    memory: '512MiB',
    maxInstances: 10,
  },
  async (event) => {
    const submissionId = event.params.submissionId;
    const result = await handleSubmissionStatusChange({
      before: event.data?.before.data(),
      after: event.data?.after.data(),
      submissionId,
    });
    logger.info('Observation validation trigger completed', {
      submissionId,
      finalStatus: result?.final_status ?? null,
      skipped: result?.skipped ?? null,
    });
    return result;
  },
);
