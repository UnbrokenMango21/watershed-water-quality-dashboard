'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { collection, onSnapshot, type Timestamp } from 'firebase/firestore';
import { useSession } from '@/components/AuthGate';
import { accountAction, clientDb } from '@/lib/firebase-client';
import { formatEastern } from '@/lib/format';
import { Notice } from '@/components/ui';
import { Icon, type IconName } from '@/components/icons';

interface Message {
  message_id: string; revision_id: string; sender_uid: string; sender_display_name: string;
  sender_role: string; kind: string; text: string; created_at?: Timestamp;
}
// Each kind has its own icon and words; status is never conveyed by color alone.
const icons: Record<string, IconName> = {
  COLLECTOR_COMMENT: 'user', REVIEWER_QUESTION: 'help', CORRECTION_REQUEST: 'alert', REVIEW_DECISION: 'checkCircle', ADMINISTRATIVE_NOTE: 'shield',
};
const roleLabels: Record<string, string> = { COLLECTOR: 'Collector', QC_REVIEWER: 'QC reviewer', ADMIN: 'Administrator' };
const labels: Record<string, string> = {
  COLLECTOR_COMMENT: 'Collector comment', REVIEWER_QUESTION: 'Reviewer question',
  CORRECTION_REQUEST: 'Request for correction', REVIEW_DECISION: 'Review decision', ADMINISTRATIVE_NOTE: 'Administrative note · review team only',
};
export default function DiscussionPanel({ submissionId, revisionId, collectorUid }: { submissionId: string; revisionId: string; collectorUid: string }) {
  const { user, role } = useSession();
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [notes, setNotes] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [kind, setKind] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<{ messageId: string; text: string; kind: string } | null>(null);
  const owner = user.uid === collectorUid;
  const reviewer = ['ADMIN', 'QC_REVIEWER'].includes(role);
  const effectiveKind = kind || (owner ? 'COLLECTOR_COMMENT' : 'REVIEWER_QUESTION');
  useEffect(() => {
    setMessages(null); setNotes([]); setError(''); pending.current = null; setText(''); setKind('');
    const stop = onSnapshot(collection(clientDb(), 'submissions', submissionId, 'messages'), snapshot => {
      setMessages(snapshot.docs.map(document => document.data() as Message));
    }, () => setError('The discussion could not be loaded. Check your connection and account access.'));
    const stopNotes = reviewer ? onSnapshot(collection(clientDb(), 'submissions', submissionId, 'internalNotes'), snapshot => {
      setNotes(snapshot.docs.map(document => document.data() as Message));
    }, () => setError('Private review notes could not be loaded.')) : () => {};
    return () => { stop(); stopNotes(); };
  }, [submissionId, reviewer]);
  async function send(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    const previous = pending.current;
    const attempt = previous && previous.text === text && previous.kind === effectiveKind ? previous : { messageId: crypto.randomUUID(), text, kind: effectiveKind };
    pending.current = attempt;
    try {
      await accountAction('sendSubmissionMessage', { submissionId, revisionId, ...attempt });
      pending.current = null; setText('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The message could not be sent. Your text is preserved for retry.'); }
    finally { setBusy(false); }
  }
  const sorted = [...(messages ?? []), ...notes].sort((a, b) => (a.created_at?.toMillis() ?? 0) - (b.created_at?.toMillis() ?? 0));
  return <section className="panel" aria-label="Submission discussion">
    <div className="panel-body">
      <h2>Discussion and corrections</h2>
      <p className="muted">Messages retain the revision and sender context. Scientific corrections create a new revision.</p>
      {error && <Notice kind="error" role="alert">{error}</Notice>}
      {messages === null && !error && <p role="status">Loading discussion…</p>}
      {messages?.length === 0 && notes.length === 0 && <p>No messages yet.</p>}
      <div aria-live="polite">{sorted.map(message => <article key={`${message.kind}-${message.message_id}`} style={{ borderBottom: '1px solid var(--border)', padding: '12px 0' }}>
        <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name={icons[message.kind] ?? 'notes'} size={15} />{labels[message.kind] ?? 'Message'}</strong>
        <p className="muted">{message.sender_display_name} · {roleLabels[message.sender_role] ?? 'Program participant'} · {formatEastern(message.created_at)}</p>
        <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{message.text}</p>
        <details><summary>Revision context</summary><p><code>{message.revision_id}</code></p></details>
      </article>)}</div>
      <form onSubmit={send} aria-busy={busy}>
        {reviewer && <label className="field"><span className="field-label">Message type</span><select value={effectiveKind} onChange={event => setKind(event.target.value)}>
          {owner && <option value="COLLECTOR_COMMENT">Collector comment</option>}
          <option value="REVIEWER_QUESTION">Reviewer question</option>
          {role === 'ADMIN' && <option value="ADMINISTRATIVE_NOTE">Administrative note · review team only</option>}
        </select></label>}
        <label className="field"><span className="field-label">Message</span><textarea required maxLength={4000} value={text} onChange={event => setText(event.target.value)} /></label>
        <button className="btn btn-primary" type="submit" disabled={busy || !text.trim()}>{busy ? 'Sending…' : 'Send message'}</button>
      </form>
    </div>
  </section>;
}
