export class ArcGISError extends Error {
  constructor(message, { code = null, retryable = false, details = null } = {}) {
    super(message); this.name = 'ArcGISError'; this.code = code; this.retryable = retryable; this.details = details;
  }
}
export class ArcGISConflictError extends ArcGISError {
  constructor(message, details = null) { super(message, { code: 'ARCGIS_IMMUTABILITY_CONFLICT', retryable: false, details }); this.name = 'ArcGISConflictError'; }
}
const trimSlash = (value) => String(value).replace(/\/+$/, '');
const sqlString = (value) => `'${String(value).replaceAll("'", "''")}'`;
const isRetryableCode = (code) => Number(code) === 429 || Number(code) === 498 || Number(code) === 499 || Number(code) >= 500;
function objectIdOf(attributes) {
  for (const key of ['OBJECTID', 'ObjectID', 'objectid', 'FID']) if (attributes?.[key] != null) return attributes[key];
  throw new ArcGISConflictError('ArcGIS query result did not expose an ObjectID field');
}

export class ArcGISRestClient {
  constructor({ featureServiceUrl, clientId, clientSecret, portalUrl = 'https://www.arcgis.com', fetchImpl = globalThis.fetch, layerIds = { sites: 0, observations: 1, measurements: 2, latest: 3 } }) {
    if (!featureServiceUrl) throw new Error('featureServiceUrl is required');
    if (!clientId || !clientSecret) throw new Error('ArcGIS OAuth client credentials are required');
    if (typeof fetchImpl !== 'function') throw new Error('fetch implementation is required');
    this.featureServiceUrl = trimSlash(featureServiceUrl); this.portalUrl = trimSlash(portalUrl); this.clientId = clientId; this.clientSecret = clientSecret;
    this.fetchImpl = fetchImpl; this.layerIds = layerIds; this.token = null; this.tokenExpiresAt = 0;
  }
  layerUrl(id) { return `${this.featureServiceUrl}/${id}`; }
  async getToken({ force = false } = {}) {
    if (!force && this.token && Date.now() < this.tokenExpiresAt - 60_000) return this.token;
    const body = new URLSearchParams({ f: 'json', client_id: this.clientId, client_secret: this.clientSecret, grant_type: 'client_credentials', expiration: '60' });
    let response;
    try { response = await this.fetchImpl(`${this.portalUrl}/sharing/rest/oauth2/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body }); }
    catch (error) { throw new ArcGISError(`ArcGIS OAuth network failure: ${error.message}`, { code: 'ARCGIS_OAUTH_NETWORK', retryable: true }); }
    const payload = await response.json();
    if (!response.ok || payload.error || !payload.access_token) {
      const code = payload.error?.code ?? response.status;
      throw new ArcGISError(payload.error?.message ?? 'ArcGIS OAuth token request failed', { code, retryable: isRetryableCode(code), details: payload.error?.details ?? null });
    }
    this.token = payload.access_token; this.tokenExpiresAt = Date.now() + Number(payload.expires_in ?? 3600) * 1000; return this.token;
  }
  async post(url, params, { retryToken = true } = {}) {
    const body = new URLSearchParams({ f: 'json', token: await this.getToken(), ...params });
    let response;
    try { response = await this.fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body }); }
    catch (error) { throw new ArcGISError(`ArcGIS request network failure: ${error.message}`, { code: 'ARCGIS_NETWORK', retryable: true }); }
    const payload = await response.json(); const code = payload.error?.code ?? (!response.ok ? response.status : null);
    if ((code === 498 || code === 499) && retryToken) { await this.getToken({ force: true }); return this.post(url, params, { retryToken: false }); }
    if (!response.ok || payload.error) throw new ArcGISError(payload.error?.message ?? `ArcGIS request failed with HTTP ${response.status}`, { code, retryable: isRetryableCode(code ?? response.status), details: payload.error?.details ?? null });
    return payload;
  }
  async query(layerId, { where, outFields = '*', returnGeometry = false, orderByFields = null, resultRecordCount = null }) {
    const params = { where, outFields, returnGeometry: String(returnGeometry) };
    if (orderByFields) params.orderByFields = orderByFields; if (resultRecordCount != null) params.resultRecordCount = String(resultRecordCount);
    return (await this.post(`${this.layerUrl(layerId)}/query`, params)).features ?? [];
  }
  async count(layerId, where) {
    const payload = await this.post(`${this.layerUrl(layerId)}/query`, { where, returnCountOnly: 'true', returnGeometry: 'false' });
    if (!Number.isInteger(payload.count)) throw new ArcGISError('ArcGIS count query did not return an integer count', { code: 'ARCGIS_BAD_RESPONSE' });
    return payload.count;
  }
  async addFeatures(layerId, features) {
    if (!features.length) return [];
    const payload = await this.post(`${this.layerUrl(layerId)}/addFeatures`, { features: JSON.stringify(features), rollbackOnFailure: 'true' });
    const results = payload.addResults ?? [];
    if (results.length !== features.length || results.some((r) => r.success !== true)) {
      const error = results.find((r) => r.error)?.error;
      throw new ArcGISError(error?.description ?? 'ArcGIS addFeatures returned a failed edit', { code: error?.code ?? 'ARCGIS_EDIT_FAILED', retryable: isRetryableCode(error?.code), details: results });
    }
    return results;
  }
  async updateFeature(layerId, feature) {
    const result = (await this.post(`${this.layerUrl(layerId)}/updateFeatures`, { features: JSON.stringify([feature]), rollbackOnFailure: 'true' })).updateResults?.[0];
    if (!result?.success) throw new ArcGISError(result?.error?.description ?? 'ArcGIS updateFeatures returned a failed edit', { code: result?.error?.code ?? 'ARCGIS_EDIT_FAILED', retryable: isRetryableCode(result?.error?.code), details: result?.error ?? null });
    return result;
  }
  async findExactlyOneOrNone(layerId, keyField, keyValue, { returnGeometry = false } = {}) {
    const features = await this.query(layerId, { where: `${keyField} = ${sqlString(keyValue)}`, returnGeometry });
    if (features.length > 1) throw new ArcGISConflictError(`Duplicate ArcGIS records found for ${keyField}=${keyValue}`);
    return features[0] ?? null;
  }
  async ensureSite(siteFeature) {
    const id = this.layerIds.sites; const siteId = siteFeature.attributes.site_id; const existing = await this.findExactlyOneOrNone(id, 'site_id', siteId, { returnGeometry: true });
    if (!existing) { const [r] = await this.addFeatures(id, [siteFeature]); return { created: true, objectId: r.objectId, globalId: r.globalId ?? null }; }
    if (existing.attributes.record_hash === siteFeature.attributes.record_hash) return { created: false, objectId: objectIdOf(existing.attributes), globalId: existing.attributes.GlobalID ?? null };
    const r = await this.updateFeature(id, { ...siteFeature, attributes: { ...siteFeature.attributes, OBJECTID: objectIdOf(existing.attributes) } });
    return { created: false, updated: true, objectId: r.objectId, globalId: r.globalId ?? null };
  }
  async ensureObservation(feature) {
    const id = this.layerIds.observations; const revisionId = feature.attributes.source_revision_id; const existing = await this.findExactlyOneOrNone(id, 'source_revision_id', revisionId, { returnGeometry: true });
    if (!existing) { const [r] = await this.addFeatures(id, [feature]); return { created: true, objectId: r.objectId, globalId: r.globalId ?? null }; }
    if (existing.attributes.record_hash !== feature.attributes.record_hash) throw new ArcGISConflictError(`Approved observation ${revisionId} already exists with a different immutable record hash`, { existingHash: existing.attributes.record_hash, incomingHash: feature.attributes.record_hash });
    return { created: false, objectId: objectIdOf(existing.attributes), globalId: existing.attributes.GlobalID ?? null };
  }
  async ensureMeasurements(revisionId, features) {
    const id = this.layerIds.measurements; const existing = await this.query(id, { where: `source_revision_id = ${sqlString(revisionId)}`, outFields: '*', returnGeometry: false });
    const expected = new Map(features.map((f) => [f.attributes.publication_key, f])); const found = new Map();
    for (const f of existing) { const key = f.attributes.publication_key; if (found.has(key)) throw new ArcGISConflictError(`Duplicate ArcGIS measurement publication_key '${key}'`); found.set(key, f); }
    for (const [key, f] of found) { const e = expected.get(key); if (!e) throw new ArcGISConflictError(`ArcGIS contains an unexpected measurement '${key}' for immutable revision ${revisionId}`); if (f.attributes.record_hash !== e.attributes.record_hash) throw new ArcGISConflictError(`Measurement '${key}' already exists with a different immutable record hash`); }
    const missing = features.filter((f) => !found.has(f.attributes.publication_key)); await this.addFeatures(id, missing); return { created: missing.length, existing: existing.length };
  }
  async refreshLatestForSite(siteFeature, buildLatestFeature) {
    const siteId = siteFeature.attributes.site_id; const obsId = this.layerIds.observations;
    const latestObservation = (await this.query(obsId, { where: `site_id = ${sqlString(siteId)}`, outFields: '*', returnGeometry: false, orderByFields: 'collected_at DESC, OBJECTID DESC', resultRecordCount: 1 }))[0];
    if (!latestObservation) throw new ArcGISConflictError(`No approved ArcGIS observation exists for site ${siteId}`);
    const sampleCount = await this.count(obsId, `site_id = ${sqlString(siteId)}`); const latest = buildLatestFeature({ siteFeature, latestObservationFeature: latestObservation, sampleCount });
    const id = this.layerIds.latest; const existing = await this.findExactlyOneOrNone(id, 'site_id', siteId, { returnGeometry: true });
    if (!existing) { const [r] = await this.addFeatures(id, [latest]); return { created: true, objectId: r.objectId, sampleCount }; }
    if (existing.attributes.record_hash === latest.attributes.record_hash) return { created: false, objectId: objectIdOf(existing.attributes), sampleCount };
    const r = await this.updateFeature(id, { ...latest, attributes: { ...latest.attributes, OBJECTID: objectIdOf(existing.attributes) } });
    return { created: false, updated: true, objectId: r.objectId, sampleCount };
  }
}
