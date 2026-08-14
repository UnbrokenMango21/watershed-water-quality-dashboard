'use client';

/**
 * The three reviewer decisions. This component never touches Firestore: it POSTs
 * to /api/submissions/{id}/review with the reviewer's ID token, and the server
 * calls the already-tested review/reviewSubmission.mjs domain module.
 *
 * `expectedRevisionId` is the revision that was actually loaded and read on
 * screen. The server rejects the decision with 409 if the submission has moved
 * on since, so a reviewer can never approve something they did not look at.
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { User } from 'firebase/auth';

import type { ReviewDecision, ReviewResult } from '@/lib/types';

const DECISIONS: { value: ReviewDecision; label: string; reasonRequired: boolean; hint: string }[] = [
  {
    value: 'APPROVE',
    label: 'Approve',
    reasonRequired: false,
    hint: 'Accept this revision. A comment is optional and is recorded in the audit trail.',
  },
  {
    value: 'NEEDS_CORRECTION',
    label: 'Request correction',
    reasonRequired: true,
    hint: 'Send back to the collector for a correction revision. A reason is required and is shown to them.',
  },
  {
    value: 'REJECT',
    label: 'Reject',
    reasonRequired: true,
    hint: 'Reject this submission outright. A reason is required and is recorded permanently.',
  },
];

type Outcome =
  | { kind: 'idle' }
  | { kind: 'error'; message: string }
  | { kind: 'conflict'; message: string }
  | { kind: 'done'; result: ReviewResult };

export default function ReviewActions({
  user,
  submissionId,
  expectedRevisionId,
  reviewable,
  currentStatus,
}: {
  user: User;
  submissionId: string;
  expectedRevisionId: string | null;
  reviewable: boolean;
  currentStatus: string;
}) {
  const router = useRouter();
  const [decision, setDecision] = useState<ReviewDecision>('APPROVE');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' });

  const spec = DECISIONS.find((entry) => entry.value === decision)!;
  const applied = outcome.kind === 'done';
  const reasonMissing = spec.reasonRequired && reason.trim().length === 0;
  const blocked = !reviewable || !expectedRevisionId;
  const disabled = submitting || applied || blocked;

  async function submit() {
    if (!expectedRevisionId) return;
    setSubmitting(true);
    setOutcome({ kind: 'idle' });
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/submissions/${encodeURIComponent(submissionId)}/review`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ decision, expectedRevisionId, reason: reason.trim() || null }),
      });

      const payload: unknown = await response.json().catch(() => null);
      const message =
        typeof payload === 'object' && payload !== null && typeof (payload as { error?: unknown }).error === 'string'
          ? (payload as { error: string }).error
          : `Request failed with HTTP ${response.status}.`;

      if (response.status === 409) {
        setOutcome({
          kind: 'conflict',
          message: `This submission changed while you were reviewing it — someone else may have already decided, or the collector filed a new revision. Refresh before deciding again. (${message})`,
        });
        return;
      }
      if (!response.ok) {
        setOutcome({ kind: 'error', message });
        return;
      }

      setOutcome({ kind: 'done', result: payload as ReviewResult });
      // The submission has left PENDING_REVIEW, so it drops out of the queue.
      router.push('/review');
      router.refresh();
    } catch (error) {
      setOutcome({
        kind: 'error',
        message: error instanceof Error ? error.message : 'The review decision could not be submitted.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <h2>Review decision</h2>

      {!reviewable ? (
        <div className="notice notice-conflict">
          This submission is in <strong>{currentStatus}</strong>, not PENDING_REVIEW, so no decision can be applied.
        </div>
      ) : null}

      {!expectedRevisionId ? (
        <div className="notice notice-error">
          This submission has no current revision id, so a revision-safe decision cannot be made.
        </div>
      ) : null}

      {outcome.kind === 'error' ? <div className="notice notice-error">{outcome.message}</div> : null}
      {outcome.kind === 'conflict' ? (
        <div className="notice notice-conflict">
          {outcome.message}{' '}
          <button type="button" className="link" onClick={() => window.location.reload()}>
            Refresh now
          </button>
        </div>
      ) : null}
      {outcome.kind === 'done' ? (
        <div className="notice notice-ok">
          Recorded {outcome.result.decision} — submission is now {outcome.result.status}
          {outcome.result.idempotent ? ' (already applied; no duplicate audit event written)' : ''}. Returning to the
          queue…
        </div>
      ) : null}

      <div className="decision-tabs" role="group" aria-label="Review decision">
        {DECISIONS.map((entry) => (
          <button
            key={entry.value}
            type="button"
            aria-pressed={decision === entry.value}
            disabled={disabled}
            onClick={() => {
              setDecision(entry.value);
              setOutcome({ kind: 'idle' });
            }}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <p className="muted" style={{ marginTop: 0 }}>
        {spec.hint}
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className="field">
          <span>{spec.reasonRequired ? 'Reason (required)' : 'Comment (optional)'}</span>
          <textarea
            value={reason}
            required={spec.reasonRequired}
            disabled={disabled}
            placeholder={
              spec.reasonRequired
                ? 'Explain what must be corrected, or why this submission is rejected.'
                : 'Optional note recorded with the approval.'
            }
            onChange={(event) => setReason(event.target.value)}
          />
        </label>

        <div className="button-row">
          <button
            type="submit"
            className={decision === 'REJECT' ? 'danger' : 'primary'}
            disabled={disabled || reasonMissing}
          >
            {submitting ? 'Submitting…' : `Submit ${spec.label.toLowerCase()}`}
          </button>
          {reasonMissing && !blocked ? <span className="muted">A reason is required for this decision.</span> : null}
        </div>
      </form>

      <p className="muted" style={{ marginBottom: 0, marginTop: 12, fontSize: 12 }}>
        Deciding against revision <code className="mono">{expectedRevisionId ?? '—'}</code>. Reviewers can never edit
        scientific data; the decision only changes workflow state and writes one audit event.
      </p>
    </div>
  );
}
