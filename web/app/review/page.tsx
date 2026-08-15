'use client';

/**
 * /review — the record pane before anything is selected.
 *
 * The queue itself lives in the layout, so this page's only job is to orient
 * the reviewer: confirm a decision that has just been recorded, summarise what
 * is waiting, and point at the rail.
 */
import { useEffect, useState } from 'react';

import { Icon } from '@/components/icons';
import { useQueue } from '@/components/QueueProvider';
import { Notice, splitCounts } from '@/components/ui';
import { EMPTY, formatElapsed, humanizeCode } from '@/lib/format';
import type { QueueRow } from '@/lib/types';

function counts(row: QueueRow) {
  const validation = row.currentRevision?.validation ?? null;
  return splitCounts(
    validation?.warning_flag_count ?? row.submission.warning_flag_count,
    validation?.environmental_alert_count,
    validation?.error_flag_count ?? row.submission.error_flag_count,
    validation?.info_flag_count ?? row.submission.info_flag_count,
  );
}

export default function ReviewIndexPage() {
  const { rows, now } = useQueue();
  const [reviewed, setReviewed] = useState<string | null>(null);

  useEffect(() => {
    const decision = new URLSearchParams(window.location.search).get('reviewed');
    if (decision) {
      setReviewed(decision);
      window.history.replaceState(null, '', '/review');
    }
  }, []);

  const waiting = rows?.length ?? 0;
  const needsAttention =
    rows?.filter((row) => {
      const c = counts(row);
      return c.errors > 0 || c.warnings > 0;
    }).length ?? 0;
  const oldest = rows && rows.length > 0 && now !== null ? formatElapsed(rows[0].submission.updated_at, now) : EMPTY;

  return (
    <div className="record-inner">
      {reviewed ? (
        <Notice kind="ok">
          Decision recorded — <strong>{humanizeCode(reviewed)}</strong>. That submission has left the queue.
        </Notice>
      ) : null}

      <div className="picker">
        <div className="panel picker-card">
          <div className="panel-body">
            <div className="empty-mark" style={{ margin: '0 auto 14px' }}>
              <Icon name="inbox" size={22} />
            </div>
            <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 600, margin: '0 0 6px' }}>
              {waiting === 0 ? 'Nothing is waiting for review' : 'Select a submission to review'}
            </h1>
            <p className="muted" style={{ maxWidth: '44ch', margin: '0 auto' }}>
              {waiting === 0
                ? 'Submissions appear in the queue as soon as validation finishes and they enter pending review.'
                : 'Pick a record from the queue on the left. The full scientific record, validation findings and decision controls open here.'}
            </p>
          </div>

          {waiting > 0 ? (
            <div className="picker-stats">
              <div>
                <span className="metric-label">Awaiting review</span>
                <span className="metric-value">{waiting}</span>
              </div>
              <div>
                <span className="metric-label">Need attention</span>
                <span className="metric-value">{needsAttention}</span>
              </div>
              <div>
                <span className="metric-label">Longest wait</span>
                <span className="metric-value">{oldest}</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
