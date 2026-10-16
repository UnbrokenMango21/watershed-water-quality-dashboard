/** Public reference geography only. Never use these lookups as project measurements. */
function publicReferenceUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash
      && (url.hostname === "hydro.nationalmap.gov" || /^services\d*\.arcgis\.com$/.test(url.hostname))
      && /\/(FeatureServer|MapServer)\/\d+$/.test(url.pathname) ? value : "";
  } catch { return ""; }
}
// Map outlines: Esri Living Atlas copies of the USGS Watershed Boundary Dataset. They allow browser
// (CORS) access, which hydro.nationalmap.gov does not reliably provide for map layers.
export const REGIONAL_OUTLINE_LAYER_URL = "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/Watershed_Boundary_Dataset_HUC_8s/FeatureServer/0";
export const LOCAL_OUTLINE_LAYER_URL = publicReferenceUrl(process.env.NEXT_PUBLIC_ARCGIS_WATERSHEDS_VIEW_URL
  || "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/Watershed_Boundary_Dataset_HUC_12s/FeatureServer/0");
// Selected-site identification: the authoritative USGS service, queried server-side only
// (app/api/watershed), so browser CORS behaviour can never break it.
const HUC10_LAYER_URL = "https://hydro.nationalmap.gov/arcgis/rest/services/wbd/MapServer/5";
const HUC12_LAYER_URL = "https://hydro.nationalmap.gov/arcgis/rest/services/wbd/MapServer/6";
const USGS_WBD_URL = "https://www.usgs.gov/national-hydrography/watershed-boundary-dataset";
export type WatershedLevel = 10 | 12;
export type WatershedPolygon = { rings: number[][][]; spatialReference: { wkid: number } };
export type WatershedLookup = {
  status: "found" | "unmapped" | "ambiguous" | "error";
  level: WatershedLevel;
  sourceUrl: string;
  checkedAt: string;
  dataLastEditedAt?: string;
  huc?: string;
  name?: string;
  polygon?: WatershedPolygon;
};

const CACHE_MS = 15 * 60 * 1000;
const MAX_CACHE_ENTRIES = 100;
type Fetcher = typeof fetch;
type Entry = { expires: number; result: Promise<WatershedLookup> };

/** One session cache per transport; exact coordinates avoid crossing narrow boundaries by rounding. */
export function createWatershedLookup(fetcher: Fetcher = fetch, now: () => number = Date.now) {
  const cache = new Map<string, Entry>();

  return function lookup(level: WatershedLevel, longitude: number, latitude: number): Promise<WatershedLookup> {
    const sourceUrl = level === 10 ? HUC10_LAYER_URL : HUC12_LAYER_URL;
    const key = `${sourceUrl}:${longitude}:${latitude}`;
    const cached = cache.get(key);
    if (cached && cached.expires > now()) return cached.result;
    cache.delete(key);
    if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!);

    async function load(): Promise<WatershedLookup> {
      const context = { level, sourceUrl: sourceUrl || USGS_WBD_URL, checkedAt: new Date(now()).toISOString() };
      try {
        const base = new URL(sourceUrl);
        if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash
          || !/\/(FeatureServer|MapServer)\/\d+$/.test(base.pathname)
          || !Number.isFinite(longitude) || Math.abs(longitude) > 180
          || !Number.isFinite(latitude) || Math.abs(latitude) > 90) return { ...context, status: "error" };

        async function request(url: URL) {
          const response = await fetcher(url.toString(), {
            credentials: "omit", redirect: "error", signal: AbortSignal.timeout(15000),
          });
          if (!response.ok) throw new Error("Reference service unavailable");
          const body = await response.json();
          if (body.error) throw new Error("Reference service rejected query");
          return body;
        }

        const metadataUrl = new URL(base); metadataUrl.searchParams.set("f", "json");
        const metadata = await request(metadataUrl);
        const code = `huc${level}`;
        if (!Array.isArray(metadata.fields)
          || ![code, "name"].every(name => metadata.fields.some((field: { name?: string }) => field.name === name))) {
          return { ...context, status: "error" };
        }
        const edited = metadata.editingInfo?.dataLastEditDate;
        const provenance = typeof edited === "number" && Number.isFinite(edited)
          ? { dataLastEditedAt: new Date(edited).toISOString() } : {};
        const query = new URL(`${sourceUrl}/query`);
        Object.entries({
          f: "json", geometry: `${longitude},${latitude}`, geometryType: "esriGeometryPoint", inSR: "4326",
          spatialRel: "esriSpatialRelIntersects", outFields: `${code},name`, returnGeometry: String(level === 12),
          outSR: "4326", resultRecordCount: "2",
        }).forEach(([key, value]) => query.searchParams.set(key, value));
        const body = await request(query);
        if (!Array.isArray(body.features)) return { ...context, ...provenance, status: "error" };
        if (body.exceededTransferLimit || body.features.length > 1) return { ...context, ...provenance, status: "ambiguous" };
        if (body.features.length === 0) return { ...context, ...provenance, status: "unmapped" };
        const feature = body.features[0];
        const huc = feature.attributes?.[code], name = feature.attributes?.name;
        if (typeof huc !== "string" || !new RegExp(`^\\d{${level}}$`).test(huc)
          || typeof name !== "string" || !name.trim() || name.length > 120) return { ...context, status: "error" };
        const rings = feature.geometry?.rings;
        const validPolygon = level === 12 && Array.isArray(rings) && rings.length > 0
          && (feature.geometry.spatialReference ?? body.spatialReference)?.wkid === 4326
          && rings.every((ring: unknown) => Array.isArray(ring) && ring.length >= 4
            && ring.every((point: unknown) => Array.isArray(point) && point.length >= 2
              && typeof point[0] === "number" && Number.isFinite(point[0]) && Math.abs(point[0]) <= 180
              && typeof point[1] === "number" && Number.isFinite(point[1]) && Math.abs(point[1]) <= 90));
        if (level === 12 && !validPolygon) return { ...context, status: "error" };
        return { ...context, ...provenance, status: "found", huc, name: name.trim(),
          ...(validPolygon ? { polygon: { rings, spatialReference: { wkid: 4326 } } } : {}) };
      } catch {
        return { ...context, status: "error" };
      }
    }

    const result = load().then(value => {
      if (value.status === "error") cache.delete(key); // An explicit retry must issue a real request.
      return value;
    });
    cache.set(key, { expires: now() + CACHE_MS, result });
    return result;
  };
}

/** Accepts only a well-formed lookup for the requested level; anything else is reported as an error. */
export function parseWatershedLookup(value: unknown, level: WatershedLevel): WatershedLookup | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (!["found", "unmapped", "ambiguous", "error"].includes(String(v.status)) || v.level !== level
    || typeof v.sourceUrl !== "string" || !/^https:\/\//.test(v.sourceUrl) || typeof v.checkedAt !== "string") return null;
  const result: WatershedLookup = { status: v.status as WatershedLookup["status"], level, sourceUrl: v.sourceUrl, checkedAt: v.checkedAt };
  if (typeof v.dataLastEditedAt === "string") result.dataLastEditedAt = v.dataLastEditedAt;
  if (result.status !== "found") return result;
  if (typeof v.huc !== "string" || !new RegExp(`^\\d{${level}}$`).test(v.huc) || typeof v.name !== "string" || !v.name.trim()) return null;
  result.huc = v.huc; result.name = v.name;
  const polygon = v.polygon as WatershedPolygon | undefined;
  if (polygon !== undefined) {
    const valid = level === 12 && polygon?.spatialReference?.wkid === 4326 && Array.isArray(polygon.rings) && polygon.rings.length > 0
      && polygon.rings.every(ring => Array.isArray(ring) && ring.length >= 4 && ring.every(point => Array.isArray(point)
        && Number.isFinite(point[0]) && Math.abs(point[0]) <= 180 && Number.isFinite(point[1]) && Math.abs(point[1]) <= 90));
    if (!valid) return null;
    result.polygon = polygon;
  }
  return result;
}

/** Browser lookups go through the dashboard's own route; errors are not cached so Retry re-queries. */
export function createRemoteWatershedLookup(fetcher: Fetcher = fetch, now: () => number = Date.now, endpoint = "/api/watershed") {
  const cache = new Map<string, Entry>();
  return function lookup(level: WatershedLevel, longitude: number, latitude: number): Promise<WatershedLookup> {
    const key = `${level}:${longitude}:${latitude}`;
    const cached = cache.get(key);
    if (cached && cached.expires > now()) return cached.result;
    cache.delete(key);
    if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
    const failure = (): WatershedLookup => ({ status: "error", level, sourceUrl: level === 10 ? HUC10_LAYER_URL : HUC12_LAYER_URL, checkedAt: new Date(now()).toISOString() });
    const result = (async () => {
      try {
        const query = new URLSearchParams({ level: String(level), x: String(longitude), y: String(latitude) });
        const response = await fetcher(`${endpoint}?${query}`, { credentials: "omit", signal: AbortSignal.timeout(20000) });
        return (response.ok && parseWatershedLookup(await response.json(), level)) || failure();
      } catch { return failure(); }
    })().then(value => {
      if (value.status === "error") cache.delete(key);
      return value;
    });
    cache.set(key, { expires: now() + CACHE_MS, result });
    return result;
  };
}

export const lookupWatershed = createRemoteWatershedLookup();
