'use client';

/**
 * The three reviewer decisions.
 *
 * This component never touches Firestore: it POSTs to
 * /api/submissions/{id}/review with the reviewer's ID token, and the server
 * calls the already-tested review/reviewSubmission.mjs domain module.
 *
 * `expectedRevisionId` is the revision that was actually loaded and read on
 * screen. The server rejects the decision with 409 if the submission has moved
 * on since, so a reviewer can never approve something they did not look at.
 *
 * Visual contract: the three decisions read as three distinct commitments —
 * approve is positive but restrained, request-correction is the primary caution
 * path, reject is unmistakably destructive. Selection is carried by a radio
 * mark, an icon and a border, never by colour alone.
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { User } from 'firebase/auth';

import { Icon, type IconName } from '@/components/icons';
import { useQueue } from '@/components/QueueProvider';
import { Badge, Notice, Uuid } from '@/components/ui';
import type { ReviewDecision, ReviewResult } from '@/lib/types';

const DECISIONS: {
  value: ReviewDecision;
  label: string;
  icon: IconName;
  reasonRequired: boolean;
  hint: string;
  buttonClass: string;
  verb: string;
}[] = [
  {
    value: 'APPROVE',
    label: 'Approve',
    icon: 'checkCircle',
    reasonRequired: false,
    hint: 'Accept this revision as valid science. It leaves the queue and continues to publication.',
    buttonClass: 'btn-approve',
    verb: 'Approve submission',
  },
  {
    value: 'NEEDS_CORRECTION',
    label: 'Request correction',
    icon: 'history',
    reasonRequired: true,
    hint: 'Send back to the collector for a correction revision. Your reason is shown to them.',
    buttonClass: 'btn-caution',
    verb: 'Request correction',
  },
  {
    value: 'REJECT',
    label: 'Reject',
    icon: 'ban',
    reasonRequired: true,
    hint: 'Reject this submission outright. This is permanent and is recorded in the audit trail.',
    buttonClass: 'btn-danger',
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
  const { reload } = useQueue();
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
      void reload();
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
    <section className="panel panel-emphasis" id="review-decision">
      <div className="panel-head">
        <h2 className="panel-title">
          <Icon name="shield" size={15} />
          Review decision
        </h2>
        <div className="panel-note">
          {blocked ? <Badge tone="neutral">Unavailable</Badge> : <Badge tone="brand">Awaiting you</Badge>}
        </div>
      </div>

      <div className="panel-body">
        <div className="decision-target">
          <Icon name="layers" size={14} />
          <span>
            <strong style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Acting on revision</strong>{' '}
            <Uuid value={expectedRevisionId} label="Revision ID" chars={10} />
            <br />
            If the collector files a newer revision first, the decision is refused rather than applied to the wrong
            record.
          </span>
        </div>

        {!reviewable ? (
          <Notice kind="warning">
            This submission is <strong>{currentStatus}</strong>, not pending review, so no decision can be applied.
          </Notice>
        ) : null}

        {!expectedRevisionId ? (
          <Notice kind="error" role="alert">
            This submission has no current revision id, so a revision-safe decision cannot be made.
          </Notice>
        ) : null}

        {outcome.kind === 'error' ? (
          <Notice kind="error" role="alert">
            {outcome.message}
          </Notice>
        ) : null}

        {outcome.kind === 'conflict' ? (
          <Notice kind="warning" role="alert">
            {outcome.message}{' '}
            <button type="button" className="btn-link" onClick={() => window.location.reload()}>
              Refresh now
            </button>
          </Notice>
        ) : null}

        {outcome.kind === 'done' ? (
          <Notice kind="ok">
            Recorded <strong>{outcome.result.decision}</strong> — this submission is now {outcome.result.status}
            {outcome.result.idempotent ? ' (already applied; no duplicate audit event written)' : ''}. Returning to the
            queue…
          </Notice>
        ) : null}

        <div className="decision-choices" role="group" aria-label="Review decision">
          {DECISIONS.map((entry) => (
            <button
              key={entry.value}
              type="button"
              className="decision-choice"
              data-decision={entry.value}
              aria-pressed={decision === entry.value}
              disabled={disabled}
              onClick={() => {
                setDecision(entry.value);
                setOutcome({ kind: 'idle' });
              }}
            >
              <span className="decision-mark" aria-hidden="true">
                <Icon name="check" size={10} strokeWidth={3} />
              </span>
              <span className="decision-text">
                <strong>
                  <Icon name={entry.icon} size={15} strokeWidth={1.9} />
                  {entry.label}
                </strong>
                <span>{entry.hint}</span>
              </span>
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
            <span className="field-label">
              Reviewer comments
              {spec.reasonRequired ? <span className="req">Required</span> : <span className="opt">Optional</span>}
            </span>
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
          <p id="decision-reason-help" className="field-help">
            {spec.reasonRequired
              ? 'Stored in the audit trail and visible to the collector.'
              : 'Any comment you leave is stored in the audit trail.'}
          </p>

          <div style={{ marginTop: 14 }}>
            <button type="submit" className={`btn btn-lg ${spec.buttonClass}`} disabled={disabled || reasonMissing}>
              {submitting ? (
                'Submitting…'
              ) : (
                <>
                  <Icon name={spec.icon} size={16} strokeWidth={2} />
                  {spec.verb}
                </>
              )}
            </button>
            {reasonMissing && !blocked ? (
              <p className="field-help" role="status">
                A reason is required before you can {spec.label.toLowerCase()}.
              </p>
            ) : null}
            {applied ? (
              <p className="field-help" role="status">
                Decision applied. Returning to the queue.
              </p>
            ) : null}
          </div>
        </form>

        <p className="decision-foot">
          <Icon name="info" size={14} />
          <span>
            Reviewers cannot edit scientific data. A decision changes the workflow state and adds exactly one audit
            event.
          </span>
        </p>
      </div>
    </section>
  );
}
