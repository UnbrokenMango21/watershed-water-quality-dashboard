import test from 'node:test';
import assert from 'node:assert/strict';
import { filterQueueRows, hasVerifiedCollectorProfile, mergeQueueRows, queueCalendarDay, queueCollectorName,
  queueFilterChoices, queueStream, queueWatershed, sortQueueRows, UNKNOWN_FILTER } from '../../web/lib/queueFilters.mjs';

const row = (id, options = {}) => ({ submission: { submission_id: id, site_id: options.siteId ?? 'site-one',
  collector_user_id: options.collectorUid ?? 'collector-one', status: options.status ?? 'PENDING_REVIEW',
  submitted_at: options.submitted ?? null, updated_at: options.updated ?? null },
  site: { site_name_display: options.siteName ?? 'Field site', watershed_name: options.watershed ?? null,
    ...(options.stream ? { stream_name: options.stream } : {}) },
  currentRevision: { data_collected_by: options.recordedName ?? 'Original Collector', collected_at: options.collected ?? null,
    collection_stage: options.lab ?? null, validation: options.validation ?? null }, collectorProfile: options.profile ?? null });
const filters = (values = {}) => ({ query: '', watershed: '', stream: '', labStage: '', dateBasis: 'collected', dateFrom: '', dateTo: '', attention: [], ...values });

test('queue dates sort in either direction with unknown dates retained last and stable ties', () => {
  const rows = [row('undated'), row('later', { submitted: '2026-10-15T18:00:00Z' }), row('earlier', { submitted: '2026-10-13T18:00:00Z' })];
  assert.deepEqual(sortQueueRows(rows, 'submitted-desc').map(r => r.submission.submission_id), ['later', 'earlier', 'undated']);
  assert.deepEqual(sortQueueRows(rows, 'submitted-asc').map(r => r.submission.submission_id), ['earlier', 'later', 'undated']);
  assert.deepEqual(rows.map(r => r.submission.submission_id), ['undated', 'later', 'earlier']);
  const collected = [row('b', { collected: '2026-10-14T18:00:00Z' }), row('a', { collected: '2026-10-14T18:00:00Z' }), row('unknown')];
  assert.deepEqual(sortQueueRows(collected, 'collected-asc').map(r => r.submission.submission_id), ['a', 'b', 'unknown']);
});

test('date filters use inclusive Eastern calendar days and never convert missing dates to epoch zero', () => {
  const rows = [row('eastern-evening', { collected: '2026-10-16T02:00:00Z' }), row('next-day', { collected: '2026-10-16T05:00:00Z' }), row('unknown')];
  assert.equal(queueCalendarDay('2026-10-16T02:00:00Z'), '2026-10-15');
  assert.equal(queueCalendarDay(null), null);
  assert.deepEqual(filterQueueRows(rows, filters({ dateFrom: '2026-10-15', dateTo: '2026-10-15' })).map(r => r.submission.submission_id), ['eastern-evening']);
  assert.equal(filterQueueRows(rows, filters()).length, 3);
  assert.equal(filterQueueRows(rows, filters({ dateBasis: 'submitted', dateFrom: '2026-10-15' })).length, 0);
});

test('verified current names never replace immutable attribution or infer verification from a name', () => {
  const verified = row('verified', { recordedName: 'Historic Name', profile: { uid: 'collector-one', display_name: 'Current Name', identity_verified: true } });
  assert.equal(queueCollectorName(verified), 'Current Name');
  assert.equal(verified.currentRevision.data_collected_by, 'Historic Name');
  assert.equal(hasVerifiedCollectorProfile(verified), true);
  assert.equal(queueCollectorName(row('mismatch', { profile: { uid: 'another-uid', display_name: 'Someone Else', identity_verified: true } })), 'Original Collector');
  assert.equal(hasVerifiedCollectorProfile(row('unverified', { profile: { uid: 'collector-one', display_name: 'Unverified Name', identity_verified: false } })), false);
  assert.equal(filterQueueRows([verified], filters({ query: 'historic name' })).length, 1);
  assert.equal(filterQueueRows([verified], filters({ query: 'current name' })).length, 1);
});

test('watershed/stream/lab filters use exact controlled values with explicit unknown states', () => {
  const rows = [row('known', { watershed: 'Spring Creek', stream: 'Logan Branch', lab: 'LAB_PENDING' }), row('unknown')];
  assert.deepEqual(filterQueueRows(rows, filters({ watershed: 'Spring Creek', stream: 'Logan Branch', labStage: 'LAB_PENDING' })).map(r => r.submission.submission_id), ['known']);
  assert.deepEqual(filterQueueRows(rows, filters({ stream: UNKNOWN_FILTER })).map(r => r.submission.submission_id), ['unknown']);
  assert.equal(queueStream(row('not-inferred', { watershed: 'Spring Creek' })), null);
  assert.deepEqual(queueFilterChoices(rows, queueWatershed), ['Spring Creek']);
});

test('attention filters distinguish scientific alerts from errors and warnings', () => {
  const rows = [row('alert-only', { validation: { warning_flag_count: 2, environmental_alert_count: 2 } }),
    row('warning', { validation: { warning_flag_count: 2, environmental_alert_count: 1 } }), row('clean')];
  assert.deepEqual(filterQueueRows(rows, filters({ attention: ['attention'] })).map(r => r.submission.submission_id), ['warning']);
  assert.deepEqual(filterQueueRows(rows, filters({ attention: ['alerts'] })).map(r => r.submission.submission_id), ['alert-only', 'warning']);
  assert.deepEqual(filterQueueRows(rows, filters({ attention: ['clean'] })).map(r => r.submission.submission_id), ['clean']);
});

test('cursor pages merge overlapping stable submission IDs without duplicates or stale row replacement', () => {
  const original = row('same', { status: 'PENDING_REVIEW' });
  const updated = row('same', { status: 'APPROVED' });
  const merged = mergeQueueRows([original], [updated, row('another')]);
  assert.equal(merged.length, 2);
  assert.equal(merged.find(r => r.submission.submission_id === 'same').submission.status, 'APPROVED');
  assert.equal(original.submission.status, 'PENDING_REVIEW');
});
