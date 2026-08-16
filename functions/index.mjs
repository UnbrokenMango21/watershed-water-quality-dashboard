import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { defineSecret, defineString } from 'firebase-functions/params';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { publishApprovedSubmission, shouldHandleApprovalEvent } from '../publication/orchestrator.mjs';
import { runValidationForSubmission } from '../validation/orchestrator.mjs';

initializeApp();

const CLAIMABLE = new Set(['SUBMITTED', 'RESUBMITTED']);
const ARCGIS_OAUTH_CLIENT_ID = defineSecret('ARCGIS_OAUTH_CLIENT_ID');
const ARCGIS_OAUTH_CLIENT_SECRET = defineSecret('ARCGIS_OAUTH_CLIENT_SECRET');
const ARCGIS_PUBLICATION_FEATURE_SERVICE_URL = defineString('ARCGIS_PUBLICATION_FEATURE_SERVICE_URL', {
  description: 'Approved-authoritative ArcGIS FeatureServer URL; never point this at the private QC staging service.',
});
const ARCGIS_PORTAL_URL = defineString('ARCGIS_PORTAL_URL', {
  default: 'https://www.arcgis.com',
  description: 'ArcGIS Online/Enterprise portal base URL used for OAuth app authentication.',
});

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

export async function handleApprovedSubmission({ before, after, submissionId, db = getFirestore(), arcgisConfig }) {
  if (!after || !submissionId) return { skipped: 'missing-event-data' };
  if (!shouldHandleApprovalEvent(before, after)) return { skipped: 'not-newly-approved' };

  const approvedRevisionId = after.reviewed_revision_id ?? after.current_revision_id;
  return publishApprovedSubmission({
    db,
    Timestamp,
    submissionId,
    approvedRevisionId,
    arcgisConfig,
  });
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

export const publishApprovedObservation = onDocumentUpdated(
  {
    document: 'submissions/{submissionId}',
    region: 'us-east4',
    timeoutSeconds: 180,
    memory: '512MiB',
    maxInstances: 5,
    retry: true,
    secrets: [ARCGIS_OAUTH_CLIENT_ID, ARCGIS_OAUTH_CLIENT_SECRET],
  },
  async (event) => {
    const submissionId = event.params.submissionId;
    const result = await handleApprovedSubmission({
      before: event.data?.before.data(),
      after: event.data?.after.data(),
      submissionId,
      arcgisConfig: {
        featureServiceUrl: ARCGIS_PUBLICATION_FEATURE_SERVICE_URL.value(),
        portalUrl: ARCGIS_PORTAL_URL.value(),
        clientId: ARCGIS_OAUTH_CLIENT_ID.value(),
        clientSecret: ARCGIS_OAUTH_CLIENT_SECRET.value(),
      },
    });
    logger.info('Approved ArcGIS publication trigger completed', {
      submissionId,
      revisionId: event.data?.after.data()?.reviewed_revision_id ?? event.data?.after.data()?.current_revision_id ?? null,
      status: result?.status ?? null,
      skipped: result?.skipped ?? null,
      idempotent: result?.idempotent ?? null,
    });
    return result;
  },
);
