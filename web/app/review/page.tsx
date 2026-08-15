'use client';

/**
 * /review — the PENDING_REVIEW queue, oldest wait first.
 *
 * Scanning model: a reviewer reads a row left-to-right as a sentence —
 * *which site*, *when it was collected*, *who collected it*, *what test*,
 * *what validation found*, *what state it is in*, *how long it has waited*.
 * The submission UUID is provenance, not identity, so it is present but quiet.
 */
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import AuthGate from '@/components/AuthGate';
import { Badge, FlagSummary, QualityMeter, StatusBadge, Uuid } from '@/components/ui';
import { fetchQueue } from '@/lib/data';
import {
  EMPTY,
  formatEasternDate,
  formatEasternTime,
  formatElapsed,
  formatText,
} from '@/lib/format';
import type { QueueRow } from '@/lib/types';

function siteName(row: QueueRow): string {
  return row.site?.site_name_display ?? row.site?.site_code ?? row.submission.site_id ?? 'Unnamed site';
}

/** Site code · county · watershed, with only the parts that actually exist. */
function siteContext(row: QueueRow): string {
  const parts = [
    row.site?.site_code,
    row.site?.county ? `${row.site.county} County` : null,
    row.site?.watershed_name ?? null,
  ].filter((part): part is string => Boolean(part && String(part).trim().length > 0));
  return parts.join(' · ');
}

/**
 * Display-only split of the stored counts.
 *
 * The validation engine stores `warning_flag_count` as plausibility warnings
 * *plus* environmental alerts (validation/engine.mjs counts them together), and
 * stores the alert subtotal separately. Showing both raw numbers side by side
 * would count the alerts twice, so the plausibility subtotal is derived here.
 * Nothing is written back — this only affects what the badge row reads.
 */
function splitFlagCounts(row: QueueRow) {
  const errors = row.submission.error_flag_count ?? 0;
  const info = row.submission.info_flag_count ?? 0;
  const alerts = row.currentRevision?.validation?.environmental_alert_count ?? 0;
  const combinedWarnings =
    row.currentRevision?.validation?.warning_flag_count ?? row.submission.warning_flag_count ?? 0;
  return { errors, warnings: Math.max(0, combinedWarnings - alerts), alerts, info };
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

  const waiting = rows?.length ?? 0;
  const blocking = rows?.filter((row) => (row.submission.error_flag_count ?? 0) > 0).length ?? 0;

  return (
    <>
      <div className="page-head">
        <p className="eyebrow">Quality control</p>
        <h1>Review queue</h1>
        <p>
          Submissions awaiting quality-control review, longest wait first.
          {rows
            ? ` ${waiting} waiting${blocking > 0 ? ` · ${blocking} with validation errors` : ''}.`
            : null}
        </p>
      </div>

      {error ? (
        <div className="notice notice-error" role="alert">
          <span className="glyph" aria-hidden="true">
            ✕
          </span>
          <span>{error}</span>
        </div>
      ) : null}

      {reviewed ? (
        <div className="notice notice-ok" role="status">
          <span className="glyph" aria-hidden="true">
            ✓
          </span>
          <span>
            Review recorded (<strong>{reviewed}</strong>). That submission has left the queue.
          </span>
        </div>
      ) : null}

      <section className="card" aria-busy={reloading}>
        <div className="card-head">
          <h2>Pending review</h2>
          <div className="button-row">
            {rows ? (
              <span className="card-head-note">
                {waiting === 0 ? 'Queue empty' : `${waiting} submission${waiting === 1 ? '' : 's'}`}
              </span>
            ) : null}
            <button type="button" onClick={() => void load()} disabled={reloading}>
              {reloading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="card-body">
          {rows === null && !error ? (
            <p className="inline-empty" role="status">
              Loading queue…
            </p>
          ) : null}

          {rows !== null && rows.length === 0 ? (
            <div className="empty-state">
              <strong>Nothing is waiting for review.</strong>
              Submissions appear here as soon as validation finishes and they enter pending review.
            </div>
          ) : null}

          {rows !== null && rows.length > 0 ? (
            <div className="table-scroll">
              <table className="queue-table stack-table">
                <colgroup>
                  <col className="col-site" />
                  <col className="col-collected" />
                  <col className="col-collector" />
                  <col className="col-test" />
                  <col className="col-flags" />
                  <col className="col-status" />
                  <col className="col-waiting" />
                </colgroup>
                <caption className="sr-only">
                  Submissions pending quality-control review, ordered by longest wait first. Select a row to open the
                  full record.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Site</th>
                    <th scope="col">Collected</th>
                    <th scope="col">Collector</th>
                    <th scope="col">Test type</th>
                    <th scope="col">Quality &amp; flags</th>
                    <th scope="col">Status</th>
                    <th scope="col">Waiting</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const href = `/review/${encodeURIComponent(row.submission.submission_id)}`;
                    const context = siteContext(row);
                    const revisionNo = row.submission.current_revision_no;
                    return (
                      <tr
                        key={row.submission.submission_id}
                        className="row-link"
                        tabIndex={0}
                        role="link"
                        aria-label={`Open review record for ${siteName(row)}`}
                        onClick={() => router.push(href)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            router.push(href);
                          }
                        }}
                      >
                        <td data-label="Site">
                          <span className="queue-site-name">{siteName(row)}</span>
                          {context ? <span className="queue-site-meta">{context}</span> : null}
                          <Uuid value={row.submission.submission_id} label="Submission ID" block />
                        </td>

                        <td data-label="Collected" className="datestack">
                          <span className="cell-primary">
                            {formatEasternDate(row.currentRevision?.collected_at)}
                          </span>
                          <span className="cell-secondary">
                            {formatEasternTime(row.currentRevision?.collected_at)}
                          </span>
                        </td>

                        <td data-label="Collector">
                          <span className="queue-person">
                            {formatText(row.currentRevision?.data_collected_by)}
                          </span>
                          <Uuid value={row.submission.collector_user_id} label="Collector user ID" block />
                        </td>

                        <td data-label="Test type">
                          <span className="cell-primary">{formatText(row.currentRevision?.test_type)}</span>
                          <span className="cell-secondary">
                            {revisionNo == null ? EMPTY : `Revision ${revisionNo}`}
                          </span>
                        </td>

                        <td data-label="Quality & flags">
                          <FlagSummary {...splitFlagCounts(row)} />
                          <span className="queue-quality">
                            Quality{' '}
                            <QualityMeter
                              small
                              showLabel={false}
                              value={
                                row.currentRevision?.validation?.overall_quality_score ??
                                row.submission.overall_quality_score
                              }
                            />
                          </span>
                        </td>

                        <td data-label="Status">
                          <StatusBadge status={row.submission.status} />
                        </td>

                        <td data-label="Waiting" className="datestack">
                          <span className="cell-wait">
                            {now === null ? EMPTY : formatElapsed(row.submission.updated_at, now)}
                          </span>
                          <span className="cell-secondary">
                            since {formatEasternDate(row.submission.updated_at)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </section>

      {rows !== null && rows.length > 0 ? (
        <p className="small muted">
          <Badge tone="neutral">Reading the flags</Badge>{' '}
          Errors block approval. Warnings are unusual-but-possible values. Environmental alerts describe a real condition
          in the water, not a problem with the data.
        </p>
      ) : null}
    </>
  );
}

export default function ReviewQueuePage() {
  return <AuthGate>{() => <QueueTable />}</AuthGate>;
}
