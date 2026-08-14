'use client';

/**
 * /review — the PENDING_REVIEW queue, oldest wait first.
 */
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import AuthGate from '@/components/AuthGate';
import { fetchQueue } from '@/lib/data';
import { EMPTY, formatEastern, formatElapsed, formatNumber, formatText } from '@/lib/format';
import type { QueueRow } from '@/lib/types';

function siteLabel(row: QueueRow): string {
  const name = row.site?.site_name_display;
  const code = row.site?.site_code;
  if (name && code) return `${name} (${code})`;
  return name ?? code ?? row.submission.site_id ?? EMPTY;
}

function QueueTable() {
  const router = useRouter();
  const [rows, setRows] = useState<QueueRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);
  // Captured once per load so every row's age is measured against one clock.
  const [now, setNow] = useState<number | null>(null);

  const load = useCallback(async () => {
    setReloading(true);
    setError(null);
    try {
      const result = await fetchQueue();
      setRows(result);
      setNow(Date.now());
    } catch {
      setError('The review queue could not be loaded. Refresh the page or try again in a moment.');
    } finally {
      setReloading(false);
    }
  }, []);

  useEffect(() => {
    const decision = new URLSearchParams(window.location.search).get('reviewed');
    if (decision) {
      setReviewed(decision);
      window.history.replaceState(null, '', '/review');
    }
    void load();
  }, [load]);

  return (
    <>
      <div className="page-head">
        <h1>Review queue</h1>
        <p>
          Submissions awaiting quality-control review, oldest first.{' '}
          {rows ? `${rows.length} waiting.` : null}
        </p>
      </div>

      {error ? <div className="notice notice-error" role="alert">{error}</div> : null}
      {reviewed ? (
        <div className="notice notice-ok" role="status">
          Review recorded ({reviewed}). The refreshed queue now excludes that submission.
        </div>
      ) : null}

      <div className="card" aria-busy={reloading}>
        <div className="button-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Pending review</h2>
          <button type="button" onClick={() => void load()} disabled={reloading}>
            {reloading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {rows === null && !error ? <p className="muted" role="status">Loading queue…</p> : null}

        {rows !== null && rows.length === 0 ? (
          <p className="muted">Nothing is waiting for review right now.</p>
        ) : null}

        {rows !== null && rows.length > 0 ? (
          <div className="table-scroll">
            <table className="queue-table">
              <thead>
                <tr>
                  <th scope="col">Site</th>
                  <th scope="col">Collected</th>
                  <th scope="col">Collector</th>
                  <th scope="col">Rev</th>
                  <th scope="col">Test type</th>
                  <th scope="col">Errors</th>
                  <th scope="col">Warnings</th>
                  <th scope="col">Alerts / info</th>
                  <th scope="col">Quality</th>
                  <th scope="col">Status</th>
                  <th scope="col">Waiting</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const href = `/review/${encodeURIComponent(row.submission.submission_id)}`;
                  return (
                    <tr
                      key={row.submission.submission_id}
                      className="row-link"
                      tabIndex={0}
                      role="link"
                      onClick={() => router.push(href)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          router.push(href);
                        }
                      }}
                    >
                      <td data-label="Site">
                        <strong>{siteLabel(row)}</strong>
                        <div className="mono muted">{row.submission.submission_id}</div>
                      </td>
                      <td data-label="Collected">{formatEastern(row.currentRevision?.collected_at)}</td>
                      <td data-label="Collector">
                        <div>
                          <strong>{formatText(row.currentRevision?.data_collected_by)}</strong>
                          <div className="mono muted">{formatText(row.submission.collector_user_id)}</div>
                        </div>
                      </td>
                      <td data-label="Revision" className="count-pill">{row.submission.current_revision_no ?? EMPTY}</td>
                      <td data-label="Test type">{formatText(row.currentRevision?.test_type)}</td>
                      <td data-label="Errors" className="count-pill">{row.submission.error_flag_count ?? 0}</td>
                      <td data-label="Warnings" className="count-pill">{row.submission.warning_flag_count ?? 0}</td>
                      <td data-label="Alerts / info" className="count-pill">
                        {row.currentRevision?.validation?.environmental_alert_count ?? 0} /{' '}
                        {row.submission.info_flag_count ?? 0}
                      </td>
                      <td data-label="Quality" className="count-pill">
                        {formatNumber(
                          row.currentRevision?.validation?.overall_quality_score ??
                            row.submission.overall_quality_score,
                        )}
                      </td>
                      <td data-label="Status">
                        <span className="badge badge-alert">{row.submission.status}</span>
                      </td>
                      <td data-label="Waiting">{now === null ? EMPTY : formatElapsed(row.submission.updated_at, now)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </>
  );
}

export default function ReviewQueuePage() {
  return <AuthGate>{() => <QueueTable />}</AuthGate>;
}
