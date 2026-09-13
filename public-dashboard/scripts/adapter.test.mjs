import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ArcgisDashboardDataSource, parameterFields } from '../lib/data/ArcgisDashboardDataSource.ts';

const schema = JSON.parse(readFileSync(new URL('../../config/arcgis_publication_schema.json', import.meta.url)));
const kinds = ['sites', 'observations', 'measurements', 'latest'];
const urls = Object.fromEntries(kinds.map((kind, i) => [kind, `https://services9.arcgis.com/test/arcgis/rest/services/Public_${kind}/FeatureServer/${i}`]));
const time = Date.parse('2026-09-01T14:30:00Z');
const record = { observation_id: 'opaque-public-record', site_id: "site's-1", collected_at: time };
function fixture(mutator = () => {}) {
  const rows = {
    sites: [{ OBJECTID: 1, site_id: record.site_id, site_code: 'PUBLIC-1', site_name: 'Sampling Site PUBLIC-1', longitude: -77, latitude: 41 }],
    observations: [{ OBJECTID: 1, ...record, approved_at: time + 86400000 }],
    measurements: [{ OBJECTID: 1, ...record, parameter_code: 'WATER_TEMP_C', value: 0, unit_code: 'degC' }],
    latest: [{ OBJECTID: 1, ...record, temp_c: 0, ph: null }],
  };
  const calls = [];
  const fetcher = async (input, options) => {
    assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'error');
    const url = new URL(input), kind = kinds.find((k) => url.pathname.includes(`Public_${k}/`));
    assert.ok(kind); calls.push(url);
    const dataset = schema.layers[kinds.indexOf(kind)];
    let body;
    if (url.pathname.endsWith('/FeatureServer')) body = { isView: true, capabilities: 'Query' };
    else if (!url.pathname.endsWith('/query')) body = { objectIdField: 'OBJECTID', maxRecordCount: 1, capabilities: 'Query', fields: [{ name: 'OBJECTID', type: 'esriFieldTypeOID' }, ...dataset.fields.filter((f) => f.public)] };
    else if (url.searchParams.has('returnIdsOnly')) body = { objectIds: rows[kind].map((r) => r.OBJECTID) };
    else body = { features: rows[kind].filter((r) => url.searchParams.get('objectIds').split(',').map(Number).includes(r.OBJECTID)).map((attributes) => ({ attributes })) };
    mutator(body, kind, url, rows);
    return new Response(JSON.stringify(body));
  };
  return { source: new ArcgisDashboardDataSource(urls, fetcher), rows, calls };
}

test('public adapter joins opaque IDs, preserves zero/units and uses collection time, not approval time', async () => {
  const { source, calls } = fixture();
  assert.equal((await source.listSites())[0].id, record.site_id);
  const latest = (await source.listLatestSiteConditions())[0];
  assert.equal(latest.observedAt, new Date(time).toISOString());
  assert.equal(latest.measurements.length, 1); assert.equal(latest.measurements[0].value, 0);
  const series = await source.getObservationSeries(record.site_id, 'waterTemperature');
  assert.deepEqual(series, [{ observationId: record.observation_id, observedAt: new Date(time).toISOString(), parameter: 'waterTemperature', value: 0, unit: '°C' }]);
  assert.ok(calls.some((u) => u.searchParams.get('where')?.includes("site_id='site''s-1'")));
  assert.ok(calls.every((u) => !u.searchParams.get('outFields')?.includes('*')));
});

test('ID pagination loads every row even when each service page holds only one record', async () => {
  const { source, rows, calls } = fixture();
  rows.sites.push({ ...rows.sites[0], OBJECTID: 2, site_id: 'site-2', site_code: 'PUBLIC-2' });
  assert.equal((await source.listSites()).length, 2);
  assert.equal(calls.filter((u) => u.searchParams.has('objectIds')).length, 2);
});

test('privacy/schema failures, private sources and partial pages fail closed', async () => {
  for (const mutate of [
    (body) => { if (body.fields) body.fields.push({ name: 'collector_user_id', type: 'esriFieldTypeString' }); },
    (body) => { if ('isView' in body) body.isView = false; },
    (body) => { if (body.capabilities) body.capabilities = 'Query,Update'; },
    (body) => { if (body.features) body.exceededTransferLimit = true; },
    (body) => { if (body.objectIds) body.exceededTransferLimit = true; },
  ]) await assert.rejects(fixture(mutate).source.listSites());
  assert.throws(() => new ArcgisDashboardDataSource({ ...urls, sites: urls.sites + '?token=credential' }));
});

test('orphan/wrong-site/duplicate measurements and unexpected units cannot silently enter a series', async () => {
  for (const change of [
    (r) => { r.measurements[0].observation_id = 'orphan'; },
    (r) => { r.measurements[0].site_id = 'other-site'; },
    (r) => { r.measurements[0].unit_code = 'degF'; },
    (r) => { r.measurements.push({ ...r.measurements[0], OBJECTID: 2 }); },
    (r) => { r.measurements[0].value = null; },
    (r) => { r.measurements[0].qualifier = '<'; },
    (r) => { r.measurements[0].collected_at += 1; },
  ]) { const f = fixture(); change(f.rows); await assert.rejects(f.source.getObservationSeries(record.site_id, 'waterTemperature')); }
});

test('empty approved views stay empty, invalid dates fail, errors do not become demo records', async () => {
  const f = fixture(); f.rows.sites.length = 0; assert.deepEqual(await f.source.listSites(), []);
  await assert.rejects(f.source.getObservationSeries(record.site_id, 'waterTemperature', 'invalid'));
  await assert.rejects(fixture((body) => { body.error = { code: 403 }; }).source.listSites());
  assert.equal(parameterFields.nitrate.unit, 'mg/L as N');
  assert.equal(parameterFields.phosphate.unit, 'mg/L as P');
});


test('retry recovers transient failure, and configured units match the native production contract', async () => {
  let failures = 0;
  const f = fixture((body, kind, url) => {
    if (url.searchParams.has('objectIds') && failures++ === 0) throw new Error('temporary network outage');
  });
  assert.equal((await f.source.listSites()).length, 1);
  assert.equal(failures, 2);
  const catalog = JSON.parse(readFileSync(new URL('../../config/production_measurement_catalog.json', import.meta.url)));
  for (const p of Object.values(parameterFields)) {
    assert.equal(p.unit, catalog.measurements.find((m) => m.parameterCode === p.code).canonicalUnit);
  }
  const series = await f.source.getObservationSeries(record.site_id, 'waterTemperature', new Date(time + 1).toISOString());
  assert.deepEqual(series, []);
});
