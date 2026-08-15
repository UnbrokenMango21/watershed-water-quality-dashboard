'use client';

/**
 * /review/[submissionId] — loads one submission and hands it to the record view.
 *
 * This page is deliberately thin: the workspace chrome and the queue live in
 * the layout, and everything the reviewer reads is composed in RecordView.
 */
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useSession } from '@/components/AuthGate';
import { Icon } from '@/components/icons';
import RecordView from '@/components/RecordView';
import { Notice } from '@/components/ui';
import { fetchSubmissionDetail } from '@/lib/data';
import type { SubmissionDetail } from '@/lib/types';

export default function SubmissionDetailPage() {
  const session = useSession();
  const params = useParams<{ submissionId: string }>();
  const submissionId = typeof params?.submissionId === 'string' ? decodeURIComponent(params.submissionId) : '';

  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!submissionId) {
      setState('missing');
      return;
    }
    setState('loading');
    try {
      const result = await fetchSubmissionDetail(submissionId);
      if (!result) {
        setState('missing');
        return;
      }
      setDetail(result);
      setState('ready');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load this submission.');
      setState('error');
    }
  }, [submissionId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state === 'loading') {
    return (
      <div className="loading-pane" role="status" aria-live="polite">
        Loading submission…
      </div>
    );
  }

  if (state === 'missing') {
    return (
      <div className="record-inner">
        <Link href="/review" className="record-back">
          <Icon name="back" size={15} />
          Review queue
        </Link>
        <div className="picker">
          <div className="state-card">
            <h1>Submission not found</h1>
            <p className="muted">
              No submission with id <code className="mono">{submissionId}</code> is readable with your account.
            </p>
            <p style={{ marginTop: 14 }}>
              <Link href="/review">Back to the review queue</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'error' || !detail) {
    return (
      <div className="record-inner">
        <Link href="/review" className="record-back">
          <Icon name="back" size={15} />
          Review queue
        </Link>
        <Notice kind="error" role="alert">
          {error ?? 'Could not load this submission.'}
        </Notice>
        <p>
          <button type="button" className="btn" onClick={() => void load()}>
            <Icon name="refresh" size={15} />
            Try again
          </button>
        </p>
      </div>
    );
  }

  return <RecordView detail={detail} user={session.user} />;
}
