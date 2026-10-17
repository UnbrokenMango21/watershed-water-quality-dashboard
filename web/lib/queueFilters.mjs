// Pure private-workspace sorting/filtering. Missing science and identity remain unknown.
export const UNKNOWN_FILTER = '__UNKNOWN__';
export const QUEUE_STATUSES = ['DRAFT', 'SUBMITTED', 'VALIDATING', 'PENDING_REVIEW', 'NEEDS_CORRECTION', 'RESUBMITTED', 'APPROVED', 'REJECTED', 'PUBLISHING', 'PUBLISH_FAILED', 'PUBLISHED'];
export const LAB_STAGES = ['DRAFT', 'FIELD_COLLECTED', 'LAB_PENDING', 'LAB_COMPLETED', 'READY_FOR_REVIEW'];
export const SORT_LABELS = {
  wait: 'Longest wait', 'submitted-desc': 'Newest submission', 'submitted-asc': 'Oldest submission',
  'collected-desc': 'Newest collection', 'collected-asc': 'Oldest collection',
  site: 'Site name (A–Z)', collector: 'Collector name (A–Z)', quality: 'Lowest quality first',
};
export function queueSiteName(row) { return row.site?.site_name_display || row.site?.site_code || row.submission.site_id || 'Unnamed site'; }
export function queueWatershed(row) { return cleanText(row.site?.watershed_name); }
export function queueStream(row) { return cleanText(row.site?.stream_name); }
function cleanText(value) { return typeof value === 'string' && value.trim() ? value.trim() : null; }
export function queueCollectorName(row) {
  const profile = row.collectorProfile;
  return profile?.identity_verified === true && profile.uid === row.submission.collector_user_id && cleanText(profile.display_name)
    ? profile.display_name.trim() : cleanText(row.currentRevision?.data_collected_by) ?? 'Collector name unavailable';
}
export function hasVerifiedCollectorProfile(row) {
  return row.collectorProfile?.identity_verified === true && row.collectorProfile.uid === row.submission.collector_user_id && Boolean(cleanText(row.collectorProfile.display_name));
}
function dateNumber(value) {
  if (value == null) return null;
  const date = typeof value?.toDate === 'function' ? value.toDate() : value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.valueOf();
}
export function queueCollectedAt(row) { return row.currentRevision?.collected_at ?? row.submission.latest_collected_at ?? null; }
export function queueSubmittedAt(row) { return row.submission.submitted_at ?? null; }
export function queueCounts(row) {
  const v = row.currentRevision?.validation;
  const count = value => Number.isFinite(value) && value > 0 ? value : 0;
  const aggregateWarnings = count(v?.warning_flag_count ?? row.submission.warning_flag_count);
  const alerts = count(v?.environmental_alert_count);
  return { errors: count(v?.error_flag_count ?? row.submission.error_flag_count), alerts,
    warnings: Math.max(0, aggregateWarnings - alerts) };
}
function quality(row) {
  const value = row.currentRevision?.validation?.overall_quality_score ?? row.submission.overall_quality_score;
  return typeof value === 'number' && Number.isFinite(value) ? (value > 0 && value <= 1 ? value * 100 : value) : null;
}
const easternDay = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
export function queueCalendarDay(value) {
  const timestamp = dateNumber(value);
  if (timestamp == null) return null;
  const parts = easternDay.formatToParts(new Date(timestamp));
  const part = name => parts.find(entry => entry.type === name)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
function matchesControlled(value, filter) { return !filter || (filter === UNKNOWN_FILTER ? value == null : value === filter); }
export function filterQueueRows(rows, filters) {
  const query = filters.query?.trim().toLowerCase() ?? '';
  return rows.filter(row => {
    if (query && ![queueSiteName(row), row.site?.site_code, row.site?.county, queueWatershed(row), queueStream(row),
      queueCollectorName(row), row.currentRevision?.data_collected_by, row.currentRevision?.test_type,
      row.submission.submission_id, row.submission.collector_user_id, row.submission.site_id, row.submission.status,
    ].filter(Boolean).join(' ').toLowerCase().includes(query)) return false;
    if (!matchesControlled(queueWatershed(row), filters.watershed) || !matchesControlled(queueStream(row), filters.stream)
      || !matchesControlled(cleanText(row.currentRevision?.collection_stage), filters.labStage)) return false;
    if (filters.dateFrom || filters.dateTo) {
      const day = queueCalendarDay(filters.dateBasis === 'submitted' ? queueSubmittedAt(row) : queueCollectedAt(row));
      if (!day || (filters.dateFrom && day < filters.dateFrom) || (filters.dateTo && day > filters.dateTo)) return false;
    }
    if (filters.attention?.length) {
      const counts = queueCounts(row);
      if (!filters.attention.some(filter => filter === 'attention' ? counts.errors > 0 || counts.warnings > 0
        : filter === 'alerts' ? counts.alerts > 0 : counts.errors + counts.warnings + counts.alerts === 0)) return false;
    }
    return true;
  });
}
function compareDate(a, b, select, descending) {
  const left = dateNumber(select(a)), right = dateNumber(select(b));
  // Undated records are visible at the end in either direction, never silently converted to zero.
  if (left == null || right == null) return left == null ? (right == null ? 0 : 1) : -1;
  return descending ? right - left : left - right;
}
export function sortQueueRows(rows, sort = 'wait') {
  return [...rows].sort((a, b) => {
    let comparison;
    switch (sort) {
      case 'collected-desc': comparison = compareDate(a, b, queueCollectedAt, true); break;
      case 'collected-asc': comparison = compareDate(a, b, queueCollectedAt, false); break;
      case 'submitted-desc': comparison = compareDate(a, b, queueSubmittedAt, true); break;
      case 'submitted-asc': comparison = compareDate(a, b, queueSubmittedAt, false); break;
      case 'site': comparison = queueSiteName(a).localeCompare(queueSiteName(b)); break;
      case 'collector': comparison = queueCollectorName(a).localeCompare(queueCollectorName(b)); break;
      case 'quality': {
        const left = quality(a), right = quality(b);
        comparison = left == null ? (right == null ? 0 : 1) : right == null ? -1 : left - right;
        break;
      }
      default: comparison = compareDate(a, b, row => row.submission.updated_at, false);
    }
    return comparison || a.submission.submission_id.localeCompare(b.submission.submission_id);
  });
}
export function mergeQueueRows(existing, incoming) {
  const rows = new Map(existing.map(row => [row.submission.submission_id, row]));
  for (const row of incoming) rows.set(row.submission.submission_id, row);
  return [...rows.values()];
}
export function queueFilterChoices(rows, select) {
  return [...new Set(rows.map(select).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
