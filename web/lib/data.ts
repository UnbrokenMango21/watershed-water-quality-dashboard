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
  documentId,
  limit,
  startAfter,
  type QueryConstraint,
  query,
  where,
  type DocumentSnapshot,
  type Firestore,
  type QuerySnapshot,
} from 'firebase/firestore';

import { clientDb } from './firebase-client';
import { toDate } from './format';
import type { QueuePage, QueueQueryOptions, ReviewerDisplayProfile } from './queue-types';
import type {
  AttachmentDoc,
  AuditDoc,
  MeasurementDoc,
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
 * Bounded queue/history pages. Document-ID ordering preserves legacy records that lack dates;
 * date sorting/filtering applies to loaded rows and the screen states that scope explicitly.
 * Exact site/collector/status filters are applied by Firestore before pagination.
 */
export async function fetchQueue(options: QueueQueryOptions = {}): Promise<QueuePage> {
  const db = clientDb();
  const pageSize = Number.isInteger(options.pageSize) ? Math.max(1, Math.min(100, options.pageSize!)) : 100;
  const constraints: QueryConstraint[] = [];
  const status = options.mode !== 'history' ? 'PENDING_REVIEW' : options.status;
  if (status) constraints.push(where('status', '==', status));
  if (options.siteId?.trim()) constraints.push(where('site_id', '==', options.siteId.trim()));
  if (options.collectorUid?.trim()) constraints.push(where('collector_user_id', '==', options.collectorUid.trim()));
  // The default pending queue pages in wait order (status + updated_at index), so the longest-waiting
  // submissions are always on the first page. Filtered and history views page by document ID, which
  // also keeps legacy records that lack dates.
  if (options.mode !== 'history' && !options.siteId?.trim() && !options.collectorUid?.trim()) {
    constraints.push(orderBy('updated_at', 'asc'));
  }
  constraints.push(orderBy(documentId(), 'asc'));
  if (options.cursor) constraints.push(startAfter(options.cursor));
  constraints.push(limit(pageSize + 1));
  const snapshot = await getDocs(query(collection(db, 'submissions'), ...constraints));
  const selected = snapshot.docs.slice(0, pageSize);
  const sites = new Map<string, Promise<SiteDoc | null>>();
  const profiles = new Map<string, Promise<ReviewerDisplayProfile | null>>();
  async function collectorProfile(uid: string): Promise<ReviewerDisplayProfile | null> {
    if (!uid) return null;
    try {
      const profile = docData<ReviewerDisplayProfile>(await getDoc(doc(db, 'reviewerDisplayProfiles', uid)));
      return profile?.identity_verified === true && profile.uid === uid && typeof profile.display_name === 'string' && profile.display_name.trim()
        ? profile : null;
    } catch {
      // A missing/denied projection remains unavailable; never infer identity verification from a name.
      return null;
    }
  }
  const rows = await Promise.all(selected.map(async submissionSnapshot => {
    const raw = { ...(submissionSnapshot.data() as object) } as SubmissionDoc;
    const submission = { ...raw, submission_id: raw.submission_id ?? submissionSnapshot.id };
    if (!sites.has(submission.site_id)) sites.set(submission.site_id, fetchSite(db, submission.site_id));
    if (!profiles.has(submission.collector_user_id)) profiles.set(submission.collector_user_id, collectorProfile(submission.collector_user_id));
    const [site, currentRevision, profile] = await Promise.all([
      sites.get(submission.site_id)!,
      fetchRevision(db, submission.submission_id, submission.current_revision_id),
      profiles.get(submission.collector_user_id)!,
    ]);
    return { submission, site, currentRevision, collectorProfile: profile };
  }));
  return { rows, hasMore: snapshot.docs.length > pageSize, cursor: selected.at(-1) ?? null };
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
