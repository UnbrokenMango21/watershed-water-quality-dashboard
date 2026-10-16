'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { sendEmailVerification, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { accountAction, clientDb } from '@/lib/firebase-client';
import { Notice } from '@/components/ui';

const labels: Record<string, string> = {
  PENDING: 'Pending supervisor approval', APPROVED: 'Reviewer access approved',
  REJECTED: 'Reviewer access request declined', SUSPENDED: 'Reviewer access suspended', REVOKED: 'Reviewer access revoked',
};

export default function AccountAccessPanel({ user, refresh }: { user: User; refresh: () => Promise<void> }) {
  const [name, setName] = useState(user.displayName ?? '');
  const [reason, setReason] = useState('');
  const [request, setRequest] = useState<{ status?: string; decision_reason?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => onSnapshot(doc(clientDb(), 'reviewerAccessRequests', user.uid), snapshot => {
    setRequest(snapshot.exists() ? snapshot.data() : null);
  }, () => setError('Your access status could not be loaded. Try again.')), [user.uid]);

  async function perform(action: () => Promise<void>) {
    setBusy(true); setError(''); setMessage('');
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message.replace(/^Firebase:\s*/, '') : 'The account change could not be completed.'); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    await perform(async () => {
      await accountAction('initializeMyAccount', { displayName: name });
      await accountAction('requestMyReviewerAccess', { reason });
      setMessage('Your request is with an administrator. Collector access remains separate from reviewer authorization.');
    });
  }
  const verified = user.emailVerified || Boolean(user.phoneNumber);
  return (
    <div className="state-card">
      <h1>{!verified ? 'Verify your account' : labels[request?.status ?? ''] ?? 'Collector account'}</h1>
      <p>Signed in as {user.email ?? user.phoneNumber ?? user.uid}.</p>
      <p className="muted">Your account works with the Watershed Watch collector apps. An administrator must approve supervisor access before you can open private QC records.</p>
      <p><a href="/my-observations">View my observations and review messages</a></p>
      {error && <Notice kind="error" role="alert">{error}</Notice>}
      {message && <p role="status">{message}</p>}
      {!verified ? <>
        <p>Open the verification email before completing your profile or requesting supervisor access.</p>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void perform(async () => {
          await sendEmailVerification(user); setMessage('Verification email sent. Open the link, then refresh your access.');
        })}>Send verification email</button>
      </> : !request ? <form onSubmit={submit} aria-busy={busy}>
        <label className="field"><span className="field-label">Display name</span><input autoComplete="name" required minLength={2} maxLength={80} value={name} onChange={event => setName(event.target.value)} /></label>
        <button type="button" className="btn" disabled={busy || name.trim().length < 2} onClick={() => void perform(async () => {
          await accountAction('initializeMyAccount', { displayName: name }); await user.reload(); setMessage('Your collector profile is saved.');
        })}>Save collector profile</button>
        <label className="field"><span className="field-label">Why do you need supervisor access?</span><textarea required minLength={5} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} /></label>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Sending request…' : 'Request supervisor access'}</button>
      </form> : <>
        <p>{request.status === 'PENDING' ? 'An administrator will verify your membership and decide this request. You do not yet have QC access.' : request.decision_reason ?? 'Contact the program administrator about this access decision.'}</p>
      </>}
      <p><button type="button" className="btn" disabled={busy} onClick={() => void perform(refresh)}>Refresh access</button></p>
    </div>
  );
}
