'use client';

/**
 * The three reviewer decisions. This component never touches Firestore: it POSTs
 * to /api/submissions/{id}/review with the reviewer's ID token, and the server
 * calls the already-tested review/reviewSubmission.mjs domain module.
 *
 * `expectedRevisionId` is the revision that was actually loaded and read on
 * screen. The server rejects the decision with 409 if the submission has moved
 * on since, so a reviewer can never approve something they did not look at.
 *
 * Visual contract: the three decisions read as three distinct commitments —
 * approve is positive but restrained, request-correction is the primary caution
 * path, reject is unmistakably destructive. Selection state is carried by a
 * radio mark and a border, never by colour alone.
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { User } from 'firebase/auth';

import { Badge, Glyph, Uuid } from '@/components/ui';
import type { ReviewDecision, ReviewResult } from '@/lib/types';

const DECISIONS: {
  value: ReviewDecision;
  label: string;
  reasonRequired: boolean;
  hint: string;
  buttonClass: string;
  verb: string;
}[] = [
  {
    value: 'APPROVE',
    label: 'Approve',
    reasonRequired: false,
    hint: 'Accept this revision as valid science. A comment is optional and is recorded in the audit trail.',
    buttonClass: 'approve',
    verb: 'Approve submission',
  },
  {
    value: 'NEEDS_CORRECTION',
    label: 'Request correction',
    reasonRequired: true,
    hint: 'Send back to the collector for a correction revision. Your reason is required and is shown to them.',
    buttonClass: 'caution',
    verb: 'Request correction',
  },
  {
    value: 'REJECT',
    label: 'Reject',
    reasonRequired: true,
    hint: 'Reject this submission outright. A reason is required and is recorded permanently.',
    buttonClass: 'danger',
    verb: 'Reject submission',
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
          message: 'This submission changed while you were reviewing it. It may already be reviewed, or the collector may have filed a new revision. Refresh before deciding again.',
        });
        return;
      }
      if (response.status === 401) {
        setOutcome({
          kind: 'error',
          message: 'Your sign-in has expired. Sign out, sign in again, and retry.',
        });
        return;
      }
      if (response.status === 403) {
        setOutcome({
          kind: 'error',
          message: 'This account is not currently authorized to review. Sign out and ask an administrator to verify access.',
        });
        return;
      }
      if (!response.ok) {
        setOutcome({ kind: 'error', message });
        return;
      }

      setOutcome({ kind: 'done', result: payload as ReviewResult });
      // The submission has left PENDING_REVIEW, so it drops out of the queue.
      router.push(`/review?reviewed=${encodeURIComponent((payload as ReviewResult).decision)}`);
      router.refresh();
    } catch {
      setOutcome({
        kind: 'error',
        message: 'The review decision could not be submitted. Check your connection and try again.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card" id="review-decision">
      <div className="card-head">
        <h2>Review decision</h2>
        <div className="card-head-note">
          {blocked ? <Badge tone="neutral">No decision available</Badge> : <Badge tone="brand">Awaiting your decision</Badge>}
        </div>
      </div>

      <div className="card-body">
        <p className="decision-context">
          Acting on revision <Uuid value={expectedRevisionId} label="Revision ID" chars={16} />. If the collector files a
          new revision before you submit, the decision is refused rather than applied to the wrong record.
        </p>

        {!reviewable ? (
          <div className="notice notice-conflict" role="status">
            <Glyph char="!" />
            <span>
              This submission is <strong>{currentStatus}</strong>, not pending review, so no decision can be applied.
            </span>
          </div>
        ) : null}

        {!expectedRevisionId ? (
          <div className="notice notice-error" role="alert">
            <Glyph char="✕" />
            <span>This submission has no current revision id, so a revision-safe decision cannot be made.</span>
          </div>
        ) : null}

        {outcome.kind === 'error' ? (
          <div className="notice notice-error" role="alert">
            <Glyph char="✕" />
            <span>{outcome.message}</span>
          </div>
        ) : null}

        {outcome.kind === 'conflict' ? (
          <div className="notice notice-conflict" role="alert">
            <Glyph char="!" />
            <span>
              {outcome.message}{' '}
              <button type="button" className="link" onClick={() => window.location.reload()}>
                Refresh now
              </button>
            </span>
          </div>
        ) : null}

        {outcome.kind === 'done' ? (
          <div className="notice notice-ok" role="status">
            <Glyph char="✓" />
            <span>
              Recorded <strong>{outcome.result.decision}</strong> — this submission is now {outcome.result.status}
              {outcome.result.idempotent ? ' (already applied; no duplicate audit event written)' : ''}. Returning to the
              queue…
            </span>
          </div>
        ) : null}

        <div className="decision-options" role="group" aria-label="Review decision">
          {DECISIONS.map((entry) => (
            <button
              key={entry.value}
              type="button"
              className="decision-option"
              data-decision={entry.value}
              aria-pressed={decision === entry.value}
              disabled={disabled}
              onClick={() => {
                setDecision(entry.value);
                setOutcome({ kind: 'idle' });
              }}
            >
              <span className="decision-option-label">
                <span className="decision-option-mark" aria-hidden="true">
                  ✓
                </span>
                {entry.label}
              </span>
              <span className="decision-option-hint">{entry.hint}</span>
            </button>
          ))}
        </div>

        <form
          aria-busy={submitting}
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label className="field">
            <span>{spec.reasonRequired ? `Reason for “${spec.label}” (required)` : 'Comment (optional)'}</span>
            <textarea
              value={reason}
              required={spec.reasonRequired}
              disabled={disabled}
              aria-describedby="decision-reason-help"
              placeholder={
                spec.reasonRequired
                  ? 'Explain what must be corrected, or why this submission is rejected.'
                  : 'Optional note recorded with the approval.'
              }
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <p id="decision-reason-help" className="small muted" style={{ marginTop: -6 }}>
            {spec.reasonRequired
              ? 'This text is stored in the audit trail and is visible to the collector.'
              : 'Any comment you leave is stored in the audit trail.'}
          </p>

          <div className="button-row" style={{ marginTop: 14 }}>
            <button
              type="submit"
              className={spec.buttonClass}
              disabled={disabled || reasonMissing}
            >
              {submitting ? 'Submitting…' : spec.verb}
            </button>
            {reasonMissing && !blocked ? (
              <span className="small muted" role="status">
                A reason is required before you can {spec.label.toLowerCase()}.
              </span>
            ) : null}
            {applied ? (
              <span className="small muted" role="status">
                Decision applied. Returning to the queue.
              </span>
            ) : null}
          </div>
        </form>

        <p className="decision-footnote">
          Reviewers cannot edit scientific data. A decision changes the workflow state and adds exactly one audit event.
        </p>
      </div>
    </section>
  );
}
