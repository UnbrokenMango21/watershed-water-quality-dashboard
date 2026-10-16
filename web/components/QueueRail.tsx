'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/icons';
import { useQueue } from '@/components/QueueProvider';
import { FlagSummary, QualityInline, StatusBadge, splitCounts } from '@/components/ui';
import { formatEasternDate, formatEasternTime, formatElapsed, formatText, humanizeCode } from '@/lib/format';
import { filterQueueRows, hasVerifiedCollectorProfile, LAB_STAGES, QUEUE_STATUSES, queueCollectedAt,
  queueCollectorName, queueFilterChoices, queueSiteName, queueStream, queueWatershed, SORT_LABELS,
  sortQueueRows, UNKNOWN_FILTER } from '@/lib/queueFilters.mjs';
import type { QueueAttention, QueueFilters, QueueSort } from '@/lib/queue-types';
import type { QueueRow, SubmissionStatus } from '@/lib/types';
import './queue-workspace.css';

const initialFilters: QueueFilters = { query: '', watershed: '', stream: '', labStage: '', dateBasis: 'collected', dateFrom: '', dateTo: '', attention: [] };
function rowCounts(row: QueueRow) {
  const v = row.currentRevision?.validation;
  return splitCounts(v?.warning_flag_count ?? row.submission.warning_flag_count, v?.environmental_alert_count,
    v?.error_flag_count ?? row.submission.error_flag_count, v?.info_flag_count ?? row.submission.info_flag_count);
}
export default function QueueRail({ selectedId }: { selectedId: string | null }) {
  const router = useRouter();
  const { rows, error, loading, loadingMore, hasMore, now, scope, setScope, reload, loadMore } = useQueue();
  const [sort, setSort] = useState<QueueSort>('wait');
  const [filters, setFilters] = useState<QueueFilters>(initialFilters);
  const [dense, setDense] = useState(false);
  const [siteDraft, setSiteDraft] = useState(scope.siteId);
  const [collectorDraft, setCollectorDraft] = useState(scope.collectorUid);
  useEffect(() => { setSiteDraft(scope.siteId); setCollectorDraft(scope.collectorUid); }, [scope.siteId, scope.collectorUid]);
  const update = <K extends keyof QueueFilters>(key: K, value: QueueFilters[K]) => setFilters(current => ({ ...current, [key]: value }));
  const visible = useMemo(() => rows ? sortQueueRows(filterQueueRows(rows, filters), sort) : null, [rows, filters, sort]);
  const watersheds = useMemo(() => queueFilterChoices(rows ?? [], queueWatershed), [rows]);
  const streams = useMemo(() => queueFilterChoices(rows ?? [], queueStream), [rows]);
  const siteChoices = useMemo(() => [...new Map((rows ?? []).map(row => [row.submission.site_id, queueSiteName(row)])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [rows]);
  const collectorChoices = useMemo(() => [...new Map((rows ?? []).map(row => [row.submission.collector_user_id, queueCollectorName(row)])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [rows]);
  const advancedActive = Boolean(scope.siteId || scope.collectorUid || scope.status || filters.watershed || filters.stream || filters.labStage || filters.dateFrom || filters.dateTo);
  const filtered = advancedActive || Boolean(filters.query.trim()) || filters.attention.length > 0;
  const datesInvalid = Boolean(filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo);
  const toggleAttention = (key: QueueAttention) => update('attention', filters.attention.includes(key) ? filters.attention.filter(value => value !== key) : [...filters.attention, key]);
  const history = (siteId: string, collectorUid: string) => { setFilters(initialFilters); setSort('collected-asc'); setScope({ mode: 'history', status: '', siteId, collectorUid }); router.push('/review'); };
  const clearFilters = () => { setFilters(initialFilters); setSiteDraft(''); setCollectorDraft(''); setScope({ ...scope, siteId: '', collectorUid: '', status: '' }); };

  return (
    <nav className="rail" aria-label={scope.mode === 'history' ? 'Submission history' : 'Review queue'} data-density={dense ? 'compact' : 'comfortable'}>
      <div className="rail-head">
        <div className="rail-title-row">
          <h1>{scope.mode === 'history' ? 'Submission history' : 'Review queue'}</h1>
          {rows ? <span className="count-chip" title="Loaded records">{rows.length}{hasMore ? '+' : ''}</span> : null}
          <div className="rail-title-actions">
            <button type="button" className="icon-btn" aria-pressed={dense} onClick={() => setDense(value => !value)} aria-label={dense ? 'Switch to comfortable density' : 'Switch to compact density'}>
              <Icon name="sliders" size={16} />
            </button>
          </div>
        </div>
        <div className="queue-mode" role="group" aria-label="Workspace records">
          <button type="button" aria-pressed={scope.mode === 'review'} onClick={() => { setScope({ ...scope, mode: 'review', status: '' }); setSort('wait'); }}>Pending review</button>
          <button type="button" aria-pressed={scope.mode === 'history'} onClick={() => { setScope({ ...scope, mode: 'history', status: '' }); setSort('submitted-desc'); }}>All history</button>
        </div>
        <label className="search">
          <span className="sr-only">Search loaded submissions</span><Icon name="search" size={15} />
          <input type="search" value={filters.query} placeholder="Search loaded sites, collectors or IDs…" onChange={event => update('query', event.target.value)} />
          {filters.query ? <button type="button" className="search-clear" onClick={() => update('query', '')} aria-label="Clear search"><Icon name="xCircle" size={14} /></button> : null}
        </label>
        <div className="rail-controls">
          <span className="select-inline"><Icon name="sort" size={14} /><label htmlFor="queue-sort" className="sr-only">Sort loaded submissions</label>
            <select id="queue-sort" value={sort} onChange={event => setSort(event.target.value as QueueSort)}>
              {(Object.keys(SORT_LABELS) as QueueSort[]).map(key => <option key={key} value={key}>{SORT_LABELS[key]}</option>)}
            </select>
          </span>
        </div>
        <details className="queue-filter-details">
          <summary>Site, collector, dates &amp; more{advancedActive ? ' · Filters active' : ''}</summary>
          <div className="queue-advanced">
            <form onSubmit={event => { event.preventDefault(); setScope({ ...scope, siteId: siteDraft.trim(), collectorUid: collectorDraft.trim() }); }}>
              <label>Monitoring site<input list="queue-sites" value={siteDraft} onChange={event => setSiteDraft(event.target.value)} placeholder="Choose or enter exact site ID" /></label>
              <datalist id="queue-sites">{siteChoices.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</datalist>
              <label>Collector<input list="queue-collectors" value={collectorDraft} onChange={event => setCollectorDraft(event.target.value)} placeholder="Choose or enter exact collector UID" /></label>
              <datalist id="queue-collectors">{collectorChoices.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</datalist>
              <button type="submit" className="btn" disabled={loading}>Apply site / collector</button>
            </form>
            <label>Submission status<select value={scope.mode === 'review' ? 'PENDING_REVIEW' : scope.status} onChange={event => setScope({ ...scope, mode: 'history', status: event.target.value as SubmissionStatus | '' })}>
              <option value="">All statuses</option>{QUEUE_STATUSES.map(status => <option key={status} value={status}>{humanizeCode(status)}</option>)}
            </select></label>
            <label>Watershed<select value={filters.watershed} onChange={event => update('watershed', event.target.value)}>
              <option value="">All loaded watersheds</option><option value={UNKNOWN_FILTER}>Watershed unknown</option>{watersheds.map(name => <option key={name} value={name}>{name}</option>)}
            </select></label>
            <label>Stream<select value={filters.stream} onChange={event => update('stream', event.target.value)}>
              <option value="">All loaded streams</option><option value={UNKNOWN_FILTER}>Stream unknown</option>{streams.map(name => <option key={name} value={name}>{name}</option>)}
            </select></label>
            {streams.length === 0 ? <p className="field-help">Stream names are not available in the loaded site catalog.</p> : null}
            <label>Field / laboratory stage<select value={filters.labStage} onChange={event => update('labStage', event.target.value)}>
              <option value="">All collection stages</option><option value={UNKNOWN_FILTER}>Stage not recorded</option>{LAB_STAGES.map(stage => <option key={stage} value={stage}>{humanizeCode(stage)}</option>)}
            </select></label>
            <label>Date range applies to<select value={filters.dateBasis} onChange={event => update('dateBasis', event.target.value as 'collected' | 'submitted')}><option value="collected">Sample collection date (Eastern)</option><option value="submitted">Submission date (Eastern)</option></select></label>
            <div className="queue-date-pair"><label>From<input type="date" value={filters.dateFrom} onChange={event => update('dateFrom', event.target.value)} /></label><label>Through<input type="date" value={filters.dateTo} onChange={event => update('dateTo', event.target.value)} /></label></div>
            {datesInvalid ? <p className="queue-filter-error" role="alert">The start date must be on or before the end date.</p> : null}
            <p className="field-help">Dates, watershed, stream and lab filters cover loaded records. Load more to extend the search. Undated records appear when the date range is clear.</p>
            <button type="button" className="btn" onClick={clearFilters}>Clear filters</button>
          </div>
        </details>
        <div className="filter-row">
          <button type="button" className="chip-toggle" aria-pressed={filters.attention.includes('attention')} onClick={() => toggleAttention('attention')}><Icon name="alert" size={12} />Needs attention</button>
          <button type="button" className="chip-toggle" aria-pressed={filters.attention.includes('alerts')} onClick={() => toggleAttention('alerts')}><Icon name="droplet" size={12} />Environmental</button>
          <button type="button" className="chip-toggle" aria-pressed={filters.attention.includes('clean')} onClick={() => toggleAttention('clean')}><Icon name="checkCircle" size={12} />No flags</button>
        </div>
      </div>
      <div className="rail-list" aria-busy={loading || loadingMore}>
        {error ? <div className="notice notice-error" role="alert"><Icon name="xCircle" size={16} /><span>{error}</span></div> : null}
        {rows === null && !error ? <p className="empty-inline" role="status">Loading submissions…</p> : null}
        {visible !== null && visible.length === 0 ? <div className="empty"><div><div className="empty-mark" style={{ margin: '0 auto 12px' }}><Icon name="inbox" size={20} /></div><strong>{filtered ? 'No matching loaded submissions' : scope.mode === 'history' ? 'No submissions in this history' : 'Queue is empty'}</strong><p>{filtered ? hasMore ? 'Clear filters or load more records to extend the search.' : 'Adjust the search or clear filters.' : scope.mode === 'history' ? 'Saved records appear after they synchronize with the archive.' : 'Submitted observations appear here after validation.'}</p></div></div> : null}
        {visible?.map(row => {
          const id = row.submission.submission_id;
          const context = [row.site?.county ? `${row.site.county} County` : null, queueWatershed(row), queueStream(row)].filter(Boolean).join(', ');
          const verified = hasVerifiedCollectorProfile(row);
          const recordedName = row.currentRevision?.data_collected_by;
          const collectorName = queueCollectorName(row);
          return <div className="queue-card-entry" key={id}>
            <button type="button" className="queue-card" aria-current={id === selectedId} onClick={() => router.push(`/review/${encodeURIComponent(id)}`)}>
              <span className="queue-card-top"><span className="queue-site">{queueSiteName(row)}</span><StatusBadge status={row.submission.status} /></span>
              {context ? <span className="queue-sub"><Icon name="mapPin" size={12} /><span>{context}</span></span> : null}
              <span className="queue-rows">
                <span className="queue-row"><Icon name="calendar" size={13} /><span>{formatEasternDate(queueCollectedAt(row))}, {formatEasternTime(queueCollectedAt(row))}</span><span className="queue-row-end">{scope.mode === 'review' && now !== null ? `${formatElapsed(row.submission.updated_at, now)} waiting` : ''}</span></span>
                <span className="queue-row"><Icon name="user" size={13} /><span>{collectorName}</span></span>
                <span className="queue-identity-note">{verified ? 'Verified account profile' : 'Name recorded on this revision'}{verified && recordedName && recordedName !== collectorName ? ` · Recorded as ${recordedName}` : ''}</span>
                <span className="queue-row"><Icon name="flask" size={13} /><span>{row.currentRevision?.collection_stage ? humanizeCode(row.currentRevision.collection_stage) : formatText(row.currentRevision?.test_type)}</span><span className="queue-row-end">{row.submission.current_revision_no == null ? '' : `Rev ${row.submission.current_revision_no}`}</span></span>
              </span>
              <span className="queue-tags"><FlagSummary counts={rowCounts(row)} compact hideInfo /><QualityInline value={row.currentRevision?.validation?.overall_quality_score ?? row.submission.overall_quality_score} /><span className="queue-code">{formatText(row.site?.site_code)}</span></span>
            </button>
            <div className="queue-history-actions"><button type="button" onClick={() => history(row.submission.site_id, '')}>Site history</button><button type="button" onClick={() => history('', row.submission.collector_user_id)}>Collector history</button></div>
          </div>;
        })}
        {hasMore ? <div className="queue-load-more"><button type="button" className="btn" disabled={loading || loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'Loading more…' : 'Load 100 more records'}</button></div> : null}
      </div>
      <div className="rail-foot"><span aria-live="polite">{rows === null ? 'Loading…' : `${visible?.length ?? 0} shown / ${rows.length} loaded${hasMore ? ' · More available' : ''}`}</span><span className="rail-foot-actions"><button type="button" className="icon-btn" onClick={() => void reload()} disabled={loading || loadingMore} aria-label="Refresh submissions"><Icon name="refresh" size={15} /></button></span></div>
    </nav>
  );
}
