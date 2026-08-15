'use client';

/**
 * The persistent review queue.
 *
 * It sits beside the record for the whole session, so a reviewer can work
 * straight down the queue without losing their place. Search, sort and filter
 * operate entirely on the rows already fetched — the Firestore query and its
 * oldest-waiting-first ordering are untouched, and "Longest wait" is the
 * default so the default view is exactly the server's order.
 */
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Icon } from '@/components/icons';
import { useQueue } from '@/components/QueueProvider';
import { FlagSummary, QualityInline, StatusBadge, splitCounts } from '@/components/ui';
import {
  EMPTY,
  formatEasternDate,
  formatEasternTime,
  formatElapsed,
  formatText,
  qualityPercent,
} from '@/lib/format';
import { toDate } from '@/lib/format';
import type { QueueRow } from '@/lib/types';

type SortKey = 'wait' | 'collected' | 'site' | 'quality';
type FilterKey = 'attention' | 'alerts' | 'clean';

const SORT_LABELS: Record<SortKey, string> = {
  wait: 'Longest wait',
  collected: 'Most recently collected',
  site: 'Site name (A–Z)',
  quality: 'Lowest quality first',
};

function siteName(row: QueueRow): string {
  return row.site?.site_name_display ?? row.site?.site_code ?? row.submission.site_id ?? 'Unnamed site';
}

function siteContext(row: QueueRow): string {
  return [row.site?.county ? `${row.site.county} County` : null, row.site?.watershed_name ?? null]
    .filter((part): part is string => Boolean(part && String(part).trim().length > 0))
    .join(' · ');
}

function rowCounts(row: QueueRow) {
  const validation = row.currentRevision?.validation ?? null;
  return splitCounts(
    validation?.warning_flag_count ?? row.submission.warning_flag_count,
    validation?.environmental_alert_count,
    validation?.error_flag_count ?? row.submission.error_flag_count,
    validation?.info_flag_count ?? row.submission.info_flag_count,
  );
}

function haystack(row: QueueRow): string {
  return [
    siteName(row),
    row.site?.site_code,
    row.site?.county,
    row.site?.watershed_name,
    row.currentRevision?.data_collected_by,
    row.currentRevision?.test_type,
    row.currentRevision?.method_name,
    row.currentRevision?.instrument_name,
    row.submission.submission_id,
    row.submission.collector_user_id,
    row.submission.status,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export default function QueueRail({ selectedId }: { selectedId: string | null }) {
  const router = useRouter();
  const { rows, error, loading, now, reload } = useQueue();

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('wait');
  const [filters, setFilters] = useState<Set<FilterKey>>(new Set());
  const [dense, setDense] = useState(false);

  const toggleFilter = (key: FilterKey) => {
    setFilters((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const visible = useMemo(() => {
    if (!rows) return null;
    const needle = query.trim().toLowerCase();

    const matched = rows.filter((row) => {
      if (needle && !haystack(row).includes(needle)) return false;
      if (filters.size === 0) return true;
      const counts = rowCounts(row);
      const total = counts.errors + counts.warnings + counts.alerts;
      if (filters.has('attention') && (counts.errors > 0 || counts.warnings > 0)) return true;
      if (filters.has('alerts') && counts.alerts > 0) return true;
      if (filters.has('clean') && total === 0) return true;
      return false;
    });

    const sorted = [...matched];
    if (sort === 'collected') {
      sorted.sort(
        (a, b) =>
          (toDate(b.currentRevision?.collected_at)?.valueOf() ?? 0) -
          (toDate(a.currentRevision?.collected_at)?.valueOf() ?? 0),
      );
    } else if (sort === 'site') {
      sorted.sort((a, b) => siteName(a).localeCompare(siteName(b)));
    } else if (sort === 'quality') {
      sorted.sort(
        (a, b) =>
          (qualityPercent(
            a.currentRevision?.validation?.overall_quality_score ?? a.submission.overall_quality_score,
          ) ?? 101) -
          (qualityPercent(
            b.currentRevision?.validation?.overall_quality_score ?? b.submission.overall_quality_score,
          ) ?? 101),
      );
    }
    // 'wait' keeps the server's oldest-updated-first order untouched.
    return sorted;
  }, [rows, query, sort, filters]);

  const total = rows?.length ?? 0;
  const shown = visible?.length ?? 0;
  const filtered = query.trim().length > 0 || filters.size > 0;

  return (
    <div className="rail" data-density={dense ? 'compact' : 'comfortable'}>
      <div className="rail-head">
        <div className="rail-title-row">
          <h1>Review queue</h1>
          {rows ? <span className="count-chip">{total}</span> : null}
          <div className="rail-title-actions">
            <button
              type="button"
              className="icon-btn"
              aria-pressed={dense}
              onClick={() => setDense((value) => !value)}
              aria-label={dense ? 'Switch to comfortable density' : 'Switch to compact density'}
              title={dense ? 'Comfortable density' : 'Compact density'}
            >
              <Icon name="sliders" size={16} />
            </button>
          </div>
        </div>

        <label className="search">
          <span className="sr-only">Search the review queue</span>
          <Icon name="search" size={15} />
          <input
            type="search"
            value={query}
            placeholder="Search sites, collectors, or IDs…"
            onChange={(event) => setQuery(event.target.value)}
          />
          {query ? (
            <button type="button" className="search-clear" onClick={() => setQuery('')} aria-label="Clear search">
              <Icon name="xCircle" size={14} />
            </button>
          ) : null}
        </label>

        <div className="rail-controls">
          <span className="select-inline">
            <Icon name="sort" size={14} />
            <label htmlFor="queue-sort" className="sr-only">
              Sort the review queue
            </label>
            <select id="queue-sort" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                <option key={key} value={key}>
                  {SORT_LABELS[key]}
                </option>
              ))}
            </select>
          </span>
        </div>

        <div className="filter-row">
          <button
            type="button"
            className="chip-toggle"
            aria-pressed={filters.has('attention')}
            onClick={() => toggleFilter('attention')}
          >
            <Icon name="alert" size={12} strokeWidth={2} />
            Needs attention
          </button>
          <button
            type="button"
            className="chip-toggle"
            aria-pressed={filters.has('alerts')}
            onClick={() => toggleFilter('alerts')}
          >
            <Icon name="droplet" size={12} strokeWidth={2} />
            Environmental
          </button>
          <button
            type="button"
            className="chip-toggle"
            aria-pressed={filters.has('clean')}
            onClick={() => toggleFilter('clean')}
          >
            <Icon name="checkCircle" size={12} strokeWidth={2} />
            Clean
          </button>
        </div>
      </div>

      <div className="rail-list">
        {error ? (
          <div className="notice notice-error" role="alert">
            <Icon name="xCircle" size={16} />
            <span>{error}</span>
          </div>
        ) : null}

        {rows === null && !error ? (
          <p className="empty-inline" role="status">
            Loading queue…
          </p>
        ) : null}

        {visible !== null && visible.length === 0 ? (
          <div className="empty">
            <div>
              <div className="empty-mark" style={{ margin: '0 auto 12px' }}>
                <Icon name="inbox" size={20} />
              </div>
              <strong>{filtered ? 'No matching submissions' : 'Queue is empty'}</strong>
              <p>
                {filtered
                  ? 'Adjust the search or clear the filters to see the rest of the queue.'
                  : 'Submissions appear here as soon as validation finishes and they enter pending review.'}
              </p>
            </div>
          </div>
        ) : null}

        {visible?.map((row) => {
          const id = row.submission.submission_id;
          const counts = rowCounts(row);
          const context = siteContext(row);
          const href = `/review/${encodeURIComponent(id)}`;
          return (
            <button
              key={id}
              type="button"
              className="queue-card"
              aria-current={id === selectedId}
              onClick={() => router.push(href)}
            >
              <span className="queue-card-top">
                <span className="queue-site">{siteName(row)}</span>
                <StatusBadge status={row.submission.status} />
              </span>

              {context ? (
                <span className="queue-sub">
                  <Icon name="mapPin" size={12} />
                  <span>{context}</span>
                </span>
              ) : null}

              <span className="queue-rows">
                <span className="queue-row">
                  <Icon name="calendar" size={13} />
                  <span>
                    {formatEasternDate(row.currentRevision?.collected_at)} ·{' '}
                    {formatEasternTime(row.currentRevision?.collected_at)}
                  </span>
                  <span className="queue-row-end">
                    {now === null ? EMPTY : `${formatElapsed(row.submission.updated_at, now)} waiting`}
                  </span>
                </span>
                <span className="queue-row">
                  <Icon name="user" size={13} />
                  <span>{formatText(row.currentRevision?.data_collected_by)}</span>
                </span>
                <span className="queue-row">
                  <Icon name="flask" size={13} />
                  <span>{formatText(row.currentRevision?.test_type)}</span>
                  <span className="queue-row-end">
                    Rev {row.submission.current_revision_no ?? EMPTY}
                  </span>
                </span>
              </span>

              <span className="queue-tags">
                <FlagSummary counts={counts} compact hideInfo />
                <QualityInline
                  value={
                    row.currentRevision?.validation?.overall_quality_score ??
                    row.submission.overall_quality_score
                  }
                />
                <span className="queue-code">{formatText(row.site?.site_code)}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="rail-foot">
        <span>
          {rows === null
            ? 'Loading…'
            : filtered
              ? `Showing ${shown} of ${total}`
              : `${total} awaiting review`}
        </span>
        <span className="rail-foot-actions">
          <button
            type="button"
            className="icon-btn"
            onClick={() => void reload()}
            disabled={loading}
            aria-label="Refresh the review queue"
            title="Refresh the review queue"
          >
            <Icon name="refresh" size={15} />
          </button>
        </span>
      </div>
    </div>
  );
}
