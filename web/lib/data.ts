'use client';

/**
 * Read-only Firestore access for the reviewer UI, using the client SDK under the
 * reviewer's own credentials. Every call here is a read: firebase/firestore.rules
 * grants QC_REVIEWER/ADMIN read access to submissions and their subcollections
 * and denies them all client-side writes.
 *
 * Subcollections are fetched unordered and sorted in JS. A Firestore `orderBy`
 * silently drops documents that lack the ordered field, and the reviewer must
 * see everything that is actually stored.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
  type DocumentSnapshot,
  type Firestore,
  type QuerySnapshot,
} from 'firebase/firestore';

import { clientDb } from './firebase-client';
import { toDate } from './format';
import type {
  AttachmentDoc,
  AuditDoc,
  MeasurementDoc,
  QueueRow,
  RevisionDoc,
  SiteDoc,
  SubmissionDetail,
  SubmissionDoc,
  ValidationFlagDoc,
} from './types';

function docData<T>(snapshot: DocumentSnapshot): T | null {
  return snapshot.exists() ? ({ ...(snapshot.data() as object) } as T) : null;
}

function allData<T>(snapshot: QuerySnapshot | null): T[] {
  return (snapshot?.docs ?? []).map((d) => ({ ...(d.data() as object) }) as T);
}

async function fetchSite(db: Firestore, siteId: string | undefined): Promise<SiteDoc | null> {
  if (!siteId) return null;
  try {
    return docData<SiteDoc>(await getDoc(doc(db, 'siteCatalog', siteId)));
  } catch {
    // A missing or unreadable site must not blank out the whole queue.
    return null;
  }
}

async function fetchRevision(
  db: Firestore,
  submissionId: string,
  revisionId: string | undefined,
): Promise<RevisionDoc | null> {
  if (!revisionId) return null;
  return docData<RevisionDoc>(await getDoc(doc(db, 'submissions', submissionId, 'revisions', revisionId)));
}

/**
 * The review queue: every submission sitting in PENDING_REVIEW, oldest wait
 * first. `updated_at` is set the moment a submission enters PENDING_REVIEW, and
 * nothing in this queue has been reviewed yet, so it is the "waiting since"
 * timestamp.
 */
export async function fetchQueue(): Promise<QueueRow[]> {
  const db = clientDb();
  const snapshot = await getDocs(
    query(collection(db, 'submissions'), where('status', '==', 'PENDING_REVIEW'), orderBy('updated_at', 'asc')),
  );

  return Promise.all(
    snapshot.docs.map(async (submissionSnapshot) => {
      const raw = { ...(submissionSnapshot.data() as object) } as SubmissionDoc;
      const submission = { ...raw, submission_id: raw.submission_id ?? submissionSnapshot.id };
      const [site, currentRevision] = await Promise.all([
        fetchSite(db, submission.site_id),
        fetchRevision(db, submission.submission_id, submission.current_revision_id),
      ]);
      return { submission, site, currentRevision };
    }),
  );
}

/** Everything the detail page needs, in one parallel fan-out. */
export async function fetchSubmissionDetail(submissionId: string): Promise<SubmissionDetail | null> {
  const db = clientDb();

  const submission = docData<SubmissionDoc>(await getDoc(doc(db, 'submissions', submissionId)));
  if (!submission) return null;
  submission.submission_id = submission.submission_id ?? submissionId;

  const currentRevisionId = submission.current_revision_id;
  const revisionPath = ['submissions', submissionId, 'revisions', currentRevisionId ?? '__none__'] as const;

  const [site, currentRevision, revisionsSnapshot, auditSnapshot, measurements, flags, attachments] = await Promise.all(
    [
      fetchSite(db, submission.site_id),
      fetchRevision(db, submissionId, currentRevisionId),
      getDocs(collection(db, 'submissions', submissionId, 'revisions')),
      getDocs(collection(db, 'submissions', submissionId, 'audit')),
      currentRevisionId ? getDocs(collection(db, ...revisionPath, 'measurements')) : null,
      currentRevisionId ? getDocs(collection(db, ...revisionPath, 'validationFlags')) : null,
      currentRevisionId ? getDocs(collection(db, ...revisionPath, 'attachments')) : null,
    ],
  );

  return {
    submission,
    site,
    currentRevision,
    measurements: allData<MeasurementDoc>(measurements).sort((a, b) =>
      (a.display_name ?? a.parameter_code ?? '').localeCompare(b.display_name ?? b.parameter_code ?? ''),
    ),
    flags: allData<ValidationFlagDoc>(flags),
    attachments: allData<AttachmentDoc>(attachments),
    revisions: allData<RevisionDoc>(revisionsSnapshot).sort((a, b) => (a.revision_no ?? 0) - (b.revision_no ?? 0)),
    audit: allData<AuditDoc>(auditSnapshot).sort(
      (a, b) => (toDate(a.occurred_at)?.valueOf() ?? 0) - (toDate(b.occurred_at)?.valueOf() ?? 0),
    ),
  };
}
