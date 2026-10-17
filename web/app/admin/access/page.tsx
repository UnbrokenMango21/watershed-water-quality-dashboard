'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import AuthGate, { useSession } from '@/components/AuthGate';
import { Notice } from '@/components/ui';
import { accountAction, clientDb } from '@/lib/firebase-client';

interface AccessRequest {
  uid: string; request_id: string; display_name: string; verified_email: string | null;
  status: string; reason: string; decision_reason?: string; provisioning_state?: string;
}

function AccessWorkspace() {
  const session = useSession();
  const [requests, setRequests] = useState<AccessRequest[] | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (session.role !== 'ADMIN') return;
    return onSnapshot(collection(clientDb(), 'reviewerAccessRequests'), snapshot => {
      setRequests(snapshot.docs.map(document => ({ ...document.data(), uid: document.id }) as AccessRequest));
    }, () => setError('Access requests could not be loaded. Your administrator authorization may have changed.'));
  }, [session.role]);
  if (session.role !== 'ADMIN') return <main className="record-inner"><h1>Administrator access required</h1><p>Only an active administrator can decide membership requests.</p><a href="/review">Return to review</a></main>;
  async function decide(request: AccessRequest, status: string) {
    setBusy(true); setError(''); setMessage('');
    try {
      await accountAction('decideReviewerMembership', { uid: request.uid, requestId: request.request_id, status, reason });
      setMessage(`Access decision saved for ${request.display_name}.`); setSelected(''); setReason('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The access decision could not be saved.'); }
    finally { setBusy(false); }
  }
  return <main className="record-inner" style={{ maxWidth: 1000, margin: '0 auto', overflow: 'auto' }}>
    <p><a href="/review">← Review workspace</a></p>
    <h1>Supervisor access requests</h1>
    <p className="muted">Confirm project membership before granting private scientific review access. Approval grants reviewer permissions. Administrator privileges require a separate trusted operation.</p>
    {error && <Notice kind="error" role="alert">{error}</Notice>}
    {message && <p role="status">{message}</p>}
    {requests === null && !error && <p role="status">Loading access requests…</p>}
    {requests?.length === 0 && <p>No supervisor requests have been submitted.</p>}
    {requests?.map(request => <section className="panel" key={request.uid} style={{ marginBottom: 16 }}>
      <div className="panel-body">
        <h2>{request.display_name}</h2>
        <p>{request.verified_email ?? 'Verified phone account'} · {request.status.toLowerCase().replaceAll('_', ' ')}</p>
        <p>{request.reason}</p>
        <details><summary>Account provenance</summary><p>UID: <code>{request.uid}</code></p><p>Request: <code>{request.request_id}</code></p></details>
        {request.decision_reason && <p>Previous decision: {request.decision_reason}</p>}
        {selected !== request.uid ? <button type="button" className="btn" onClick={() => { setSelected(request.uid); setReason(''); }}>Review access</button> : <div aria-busy={busy}>
          <label className="field"><span className="field-label">Decision reason</span><textarea minLength={5} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} /></label>
          <div className="filter-row">
            {request.status !== 'REJECTED' && <button type="button" className="btn btn-primary" disabled={busy || reason.trim().length < 5} onClick={() => void decide(request, 'APPROVED')}>Approve reviewer access</button>}
            {request.status === 'PENDING' && <button type="button" className="btn" disabled={busy || reason.trim().length < 5} onClick={() => void decide(request, 'REJECTED')}>Decline request</button>}
            {request.status === 'APPROVED' && <button type="button" className="btn" disabled={busy || reason.trim().length < 5} onClick={() => void decide(request, 'SUSPENDED')}>Suspend review access</button>}
            {['APPROVED', 'SUSPENDED'].includes(request.status) && <button type="button" className="btn" disabled={busy || reason.trim().length < 5} onClick={() => void decide(request, 'REVOKED')}>Revoke review access</button>}
            <button type="button" className="btn" disabled={busy} onClick={() => setSelected('')}>Cancel</button>
          </div>
        </div>}
      </div>
    </section>)}
  </main>;
}

export default function AccessPage() { return <AuthGate><AccessWorkspace /></AuthGate>; }
