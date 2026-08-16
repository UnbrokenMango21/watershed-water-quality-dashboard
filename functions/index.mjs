import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { defineSecret, defineString } from 'firebase-functions/params';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';

import { publishApprovedSubmission, shouldHandleApprovalEvent } from './publication/orchestrator.mjs';
import { validateSubmissionById } from './validation/orchestrator.mjs';

if (!getApps().length) initializeApp();
const db = getFirestore();
const ARCGIS_OAUTH_CLIENT_ID = defineSecret('ARCGIS_OAUTH_CLIENT_ID');
const ARCGIS_OAUTH_CLIENT_SECRET = defineSecret('ARCGIS_OAUTH_CLIENT_SECRET');
const ARCGIS_PUBLICATION_FEATURE_SERVICE_URL = defineString('ARCGIS_PUBLICATION_FEATURE_SERVICE_URL', { description: 'Approved-authoritative ArcGIS FeatureServer URL; never point this at the private QC staging service.' });
const ARCGIS_PORTAL_URL = defineString('ARCGIS_PORTAL_URL', { default: 'https://www.arcgis.com', description: 'ArcGIS Online/Enterprise portal base URL used for OAuth app authentication.' });

function shouldValidate(beforeStatus, afterStatus) { return (afterStatus === 'SUBMITTED' || afterStatus === 'RESUBMITTED') && beforeStatus !== afterStatus; }

export async function handleSubmissionStatusChange(event) {
  const before = event.data?.before?.data(); const after = event.data?.after?.data(); if (!after || !shouldValidate(before?.status, after.status)) return null;
  const submissionId = event.params.submissionId; logger.info('validation_trigger_received', { submission_id: submissionId, previous_status: before?.status ?? null, new_status: after.status });
  const result = await validateSubmissionById({ db, Timestamp, submissionId }); logger.info('validation_trigger_completed', { submission_id: submissionId, status: result.status, idempotent: result.idempotent }); return result;
}

export async function handleApprovedSubmission(event) {
  const before = event.data?.before?.data(); const after = event.data?.after?.data(); if (!shouldHandleApprovalEvent(before, after)) return null;
  const submissionId = event.params.submissionId; const approvedRevisionId = after.reviewed_revision_id ?? after.current_revision_id;
  logger.info('arcgis_publication_trigger_received', { submission_id: submissionId, revision_id: approvedRevisionId, previous_status: before?.status ?? null, new_status: after.status });
  const result = await publishApprovedSubmission({ db, Timestamp, submissionId, approvedRevisionId, arcgisConfig: { featureServiceUrl: ARCGIS_PUBLICATION_FEATURE_SERVICE_URL.value(), portalUrl: ARCGIS_PORTAL_URL.value(), clientId: ARCGIS_OAUTH_CLIENT_ID.value(), clientSecret: ARCGIS_OAUTH_CLIENT_SECRET.value() } });
  logger.info('arcgis_publication_trigger_completed', { submission_id: submissionId, revision_id: approvedRevisionId, status: result.status, idempotent: result.idempotent }); return result;
}

export const validateSubmittedObservation = onDocumentUpdated({ document: 'submissions/{submissionId}', region: 'us-east4', timeoutSeconds: 120, memory: '512MiB', maxInstances: 10 }, handleSubmissionStatusChange);
export const publishApprovedObservation = onDocumentUpdated({ document: 'submissions/{submissionId}', region: 'us-east4', timeoutSeconds: 180, memory: '512MiB', maxInstances: 5, retry: true, secrets: [ARCGIS_OAUTH_CLIENT_ID, ARCGIS_OAUTH_CLIENT_SECRET] }, handleApprovedSubmission);
