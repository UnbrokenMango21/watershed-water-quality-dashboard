import test from 'node:test';
import assert from 'node:assert/strict';
import { ArcgisDashboardDataSource } from '../lib/data/ArcgisDashboardDataSource.ts';

const urls = {
  sitesViewUrl: 'https://example.test/sites/FeatureServer/0',
  observationsViewUrl: 'https://example.test/observations/FeatureServer/0',
  measurementsViewUrl: 'https://example.test/measurements/FeatureServer/0',
  latestConditionsViewUrl: 'https://example.test/latest/FeatureServer/0',
};
const time = Date.parse('2026-08-16T14:30:00Z');
const publicObservationId = 'obs_' + 'a'.repeat(64);

const fields = {
  sites: ['OBJECTID','site_id','site_code','site_name','county','watershed_name','site_status','latitude','longitude'],
  observations: ['OBJECTID','public_observation_id','site_id','collected_at','approved_at','published_at'],
  measurements: ['OBJECTID','public_observation_id','site_id','collected_at','parameter_code','display_name','value','unit_code','method_name','instrument_name','source_type'],
  latest: ['OBJECTID','site_id','site_code','site_name','county','watershed_name','collected_at','sample_count','temp_c','ph','do_mg_l','do_percent','conductivity_us_cm','tds_mg_l','orp_mv','chloride_mg_l','sulfate_mg_l','nitrate_mg_l','phosphate_mg_l','discharge_m3_s','quality_score','quality_context'],
};

function response(payload, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

function fixture({ measurementUnit = 'pH', joinSiteId = 'site-1', extraSiteField = null, transientMetadataFailure = false } = {}) {
  let metadataAttempts = 0;
  const fetchImpl = async (input) => {
    const url = new URL(String(input));
    const path = url.pathname;
    const isQuery = path.endsWith('/query');
    const kind = path.includes('/sites/') ? 'sites' : path.includes('/observations/') ? 'observations' : path.includes('/measurements/') ? 'measurements' : path.includes('/latest/') ? 'latest' : null;
    if (!kind) throw new Error(`Unexpected URL ${url}`);

    if (!isQuery) {
      if (transientMetadataFailure && metadataAttempts++ === 0) throw new Error('temporary network outage');
      const names = [...fields[kind], ...(kind === 'sites' && extraSiteField ? [extraSiteField] : [])];
      return response({ capabilities: 'Query', hasAttachments: false, fields: names.map((name) => ({ name, type: name === 'OBJECTID' ? 'esriFieldTypeOID' : 'esriFieldTypeString' })) });
    }

    if (kind === 'sites') return response({ features: [{ attributes: { site_id:'site-1', site_code:'S1', site_name:'Spring Creek', county:'Centre', watershed_name:'Spring Creek', site_status:'ACTIVE', latitude:40.7, longitude:-77.8 }, geometry:{ x:-77.8, y:40.7 } }] });
    if (kind === 'latest') return response({ features: [{ attributes: { site_id:'site-1', collected_at:time, temp_c:20.2, ph:7.3 } }] });
    if (kind === 'measurements') return response({ features: [{ attributes: { public_observation_id:publicObservationId, site_id:'site-1', collected_at:time, parameter_code:'PH', value:7.3, unit_code:measurementUnit } }] });
    return response({ features: [{ attributes: { public_observation_id:publicObservationId, site_id:joinSiteId, collected_at:time } }] });
  };
  return { fetchImpl, attempts: () => metadataAttempts };
}

async function withFetch(fetchImpl, action) {
  const original = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try { return await action(); } finally { globalThis.fetch = original; }
}

test('production adapter loads sites, latest sample time and joined time series', { concurrency:false }, async () => {
  const fake = fixture();
  await withFetch(fake.fetchImpl, async () => {
    const source = new ArcgisDashboardDataSource(urls);
    const sites = await source.listSites();
    assert.equal(sites.length, 1);
    assert.equal(sites[0].id, 'site-1');
    const latest = await source.getLatestSiteCondition('site-1');
    assert.equal(latest.observedAt, '2026-08-16T14:30:00.000Z');
    assert.equal(latest.measurements.find((m) => m.parameter === 'waterTemperature').unit, '°C');
    const series = await source.getObservationSeries('site-1', 'ph');
    assert.deepEqual(series, [{ observationId:publicObservationId, parameter:'ph', value:7.3, unit:'pH', observedAt:'2026-08-16T14:30:00.000Z' }]);
  });
});

test('production adapter rejects measurement units outside the canonical contract', { concurrency:false }, async () => {
  const fake = fixture({ measurementUnit:'unitless' });
  await withFetch(fake.fetchImpl, async () => {
    const source = new ArcgisDashboardDataSource(urls);
    await assert.rejects(() => source.getObservationSeries('site-1', 'ph'), /Unexpected unit/);
  });
});

test('production adapter rejects broken public observation joins', { concurrency:false }, async () => {
  const fake = fixture({ joinSiteId:'different-site' });
  await withFetch(fake.fetchImpl, async () => {
    const source = new ArcgisDashboardDataSource(urls);
    await assert.rejects(() => source.getObservationSeries('site-1', 'ph'), /site join mismatch/);
  });
});

test('production adapter refuses a public view that exposes a protected field', { concurrency:false }, async () => {
  const fake = fixture({ extraSiteField:'collector_user_id' });
  await withFetch(fake.fetchImpl, async () => {
    const source = new ArcgisDashboardDataSource(urls);
    await assert.rejects(() => source.listSites(), /protected field collector_user_id/);
  });
});

test('ArcGIS reads retry a transient failure instead of silently falling back to demo data', { concurrency:false }, async () => {
  const fake = fixture({ transientMetadataFailure:true });
  await withFetch(fake.fetchImpl, async () => {
    const source = new ArcgisDashboardDataSource(urls);
    assert.equal((await source.listSites()).length, 1);
    assert.ok(fake.attempts() >= 2);
  });
});
