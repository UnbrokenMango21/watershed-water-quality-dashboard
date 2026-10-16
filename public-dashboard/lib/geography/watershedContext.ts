/** Public reference geography only. Never use these lookups as project measurements. */
function publicReferenceUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash
      && (url.hostname === "hydro.nationalmap.gov" || /^services\d*\.arcgis\.com$/.test(url.hostname))
      && /\/(FeatureServer|MapServer)\/\d+$/.test(url.pathname) ? value : "";
  } catch { return ""; }
}
export const HUC8_LAYER_URL = "https://hydro.nationalmap.gov/arcgis/rest/services/wbd/MapServer/4";
export const HUC12_LAYER_URL = publicReferenceUrl(process.env.NEXT_PUBLIC_ARCGIS_WATERSHEDS_VIEW_URL
  || "https://hydro.nationalmap.gov/arcgis/rest/services/wbd/MapServer/6");
const HUC10_LAYER_URL = "https://hydro.nationalmap.gov/arcgis/rest/services/wbd/MapServer/5";
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
      const context = { level, sourceUrl: sourceUrl || "https://www.usgs.gov/national-hydrography/watershed-boundary-dataset", checkedAt: new Date(now()).toISOString() };
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

export const lookupWatershed = createWatershedLookup();
