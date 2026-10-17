'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/icons';
import { useQueue } from '@/components/QueueProvider';
import { Notice } from '@/components/ui';
import { formatElapsed, humanizeCode } from '@/lib/format';
import { queueCounts, sortQueueRows } from '@/lib/queueFilters.mjs';

export default function ReviewIndexPage() {
  const { rows, now, scope, loading, error, hasMore } = useQueue();
  const [reviewed, setReviewed] = useState<string | null>(null);
  useEffect(() => {
    const decision = new URLSearchParams(window.location.search).get('reviewed');
    if (decision) { setReviewed(decision); window.history.replaceState(null, '', '/review'); }
  }, []);
  const pending = (rows ?? []).filter(row => row.submission.status === 'PENDING_REVIEW');
  const needsAttention = (rows ?? []).filter(row => { const c = queueCounts(row); return c.errors > 0 || c.warnings > 0; }).length;
  const oldestRow = sortQueueRows(pending, 'wait')[0];
  const oldest = oldestRow && now !== null ? formatElapsed(oldestRow.submission.updated_at, now) : 'None recorded';
  const history = scope.mode === 'history';
  const count = rows?.length ?? 0;
  const heading = loading && rows === null ? 'Loading submissions…' : error && rows === null ? 'Submissions are unavailable'
    : count === 0 ? history ? 'No matching submission history' : 'Nothing is waiting for review'
    : history ? 'Explore sampling history' : 'Select a submission to review';
  return <div className="record-inner">
    {reviewed ? <Notice kind="ok">Decision recorded: <strong>{humanizeCode(reviewed)}</strong>. {history ? 'The recorded decision remains available in history.' : 'The submission has left the pending review queue.'}</Notice> : null}
    <div className="picker"><div className="panel picker-card"><div className="panel-body">
      <div className="empty-mark" style={{ margin: '0 auto 14px' }}><Icon name={history ? 'calendar' : 'inbox'} size={22} /></div>
      <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 600, margin: '0 0 6px' }}>{heading}</h1>
      <p className="muted" style={{ maxWidth: '48ch', margin: '0 auto' }}>{error && rows === null ? 'Use Refresh to try loading your authorized workspace again.' : loading && rows === null ? 'Checking the private archive.'
        : history ? 'Choose a record to inspect its measurements, laboratory stage, immutable revisions and review discussion. Use Site history or Collector history to follow one sampling history.'
        : count === 0 ? 'Submitted observations appear after automated validation. All history includes synchronized drafts and earlier decisions.'
        : 'Choose a submission to inspect its observations and validation results. Approval controls act only on its current submitted revision.'}</p>
      {scope.siteId || scope.collectorUid ? <p className="field-help">History is scoped to {scope.siteId ? `site ${scope.siteId}` : ''}{scope.siteId && scope.collectorUid ? ' and ' : ''}{scope.collectorUid ? `collector ${scope.collectorUid}` : ''}.</p> : null}
    </div>
      {rows && count > 0 ? <div className="picker-stats"><div><span className="metric-label">{history ? 'History records loaded' : 'Pending records loaded'}</span><span className="metric-value">{count}{hasMore ? '+' : ''}</span></div><div><span className="metric-label">Recorded warnings / errors</span><span className="metric-value">{needsAttention}</span></div><div><span className="metric-label">Longest pending wait loaded</span><span className="metric-value">{oldest}</span></div></div> : null}
    </div></div>
  </div>;
}
