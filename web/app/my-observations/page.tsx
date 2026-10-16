'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import AuthGate, { useSession } from '@/components/AuthGate';
import DiscussionPanel from '@/components/DiscussionPanel';
import { clientDb } from '@/lib/firebase-client';
import { formatEastern } from '@/lib/format';
import type { SubmissionDoc } from '@/lib/types';
import { Notice, StatusBadge } from '@/components/ui';

function MyObservations() {
  const { user } = useSession();
  const [records, setRecords] = useState<SubmissionDoc[] | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState('');
  useEffect(() => onSnapshot(query(collection(clientDb(), 'submissions'), where('collector_user_id', '==', user.uid)), snapshot => {
    setRecords(snapshot.docs.map(document => ({ ...document.data(), submission_id: document.id }) as SubmissionDoc)
      .sort((a, b) => (b.latest_collected_at?.toMillis() ?? 0) - (a.latest_collected_at?.toMillis() ?? 0)));
  }, () => setError('Your observations could not be loaded. Check your connection and sign in again if needed.')), [user.uid]);
  const selected = records?.find(record => record.submission_id === selectedId);
  return <main className="record-inner" style={{ maxWidth: 1000, margin: '0 auto', overflow: 'auto' }}>
    <h1>My observations</h1>
    <p className="muted">Follow the same sampling records and review conversations as your collector app. Enter scientific corrections in a new revision in the collector app.</p>
    <p><a href="/review">Supervisor workspace and access requests</a> · <a href="/site-locations">Propose a site location</a></p>
    {error && <Notice kind="error" role="alert">{error}</Notice>}
    {records === null && !error && <p role="status">Loading observations…</p>}
    {records?.length === 0 && <p>No synchronized sampling records yet. Local offline drafts remain on the device until synchronization succeeds.</p>}
    <label className="field"><span className="field-label">Sampling record</span><select value={selectedId} onChange={event => setSelectedId(event.target.value)}>
      <option value="">Choose an observation</option>
      {records?.map(record => <option key={record.submission_id} value={record.submission_id}>{record.site_id} · {formatEastern(record.latest_collected_at)} · {record.status.toLowerCase().replaceAll('_', ' ')}</option>)}
    </select></label>
    {selected && <>
      <StatusBadge status={selected.status} />
      <p>Site ID: <code>{selected.site_id}</code> · Revision {selected.current_revision_no}</p>
      {selected.review_comment && <Notice kind="info">{selected.review_comment}</Notice>}
      <DiscussionPanel key={selected.submission_id} submissionId={selected.submission_id} revisionId={selected.current_revision_id} collectorUid={user.uid} />
    </>}
  </main>;
}
export default function MyObservationsPage() { return <AuthGate allowCollector><MyObservations /></AuthGate>; }
