import type { DashboardDataSource, DashboardParameter, DashboardSite, LatestSiteCondition, DashboardObservationSeriesPoint } from "./DashboardDataSource";

export const parameterFields: Record<DashboardParameter, { code: string; field: string; unit: string; label: string }> = {
  waterTemperature: { code: "WATER_TEMP_C", field: "temp_c", unit: "degC", label: "°C" },
  ph: { code: "PH", field: "ph", unit: "pH", label: "pH" },
  dissolvedOxygen: { code: "DO_MG_L", field: "do_mg_l", unit: "mg/L", label: "mg/L" },
  dissolvedOxygenSaturation: { code: "DO_PERCENT", field: "do_percent", unit: "percent", label: "%" },
  specificConductivity: { code: "CONDUCTIVITY_US_CM", field: "conductivity_us_cm", unit: "uS/cm", label: "µS/cm" },
  totalDissolvedSolids: { code: "TDS_MG_L", field: "tds_mg_l", unit: "mg/L", label: "mg/L" },
  oxidationReductionPotential: { code: "ORP_MV", field: "orp_mv", unit: "mV", label: "mV" },
  chloride: { code: "CHLORIDE_MG_L", field: "chloride_mg_l", unit: "mg/L", label: "mg/L" },
  sulfate: { code: "SULFATE_MG_L", field: "sulfate_mg_l", unit: "mg/L", label: "mg/L" },
  nitrate: { code: "NITRATE_MG_L", field: "nitrate_mg_l", unit: "mg/L as N", label: "mg/L as N" },
  phosphate: { code: "PHOSPHATE_MG_L", field: "phosphate_mg_l", unit: "mg/L as P", label: "mg/L as P" },
  discharge: { code: "DISCHARGE_M3_S", field: "discharge_m3_s", unit: "m3/s", label: "m³/s" },
};

type Dataset = "sites" | "observations" | "measurements" | "latest";
export type ArcgisSources = Record<Dataset, string>;
type Attributes = Record<string, unknown>;
type Feature = { attributes: Attributes };
type Metadata = { fields: { name: string; type: string }[]; objectIdField: string; maxRecordCount?: number; capabilities: string };
type Reply = { error?: { code?: number }; features?: Feature[]; objectIds?: number[]; exceededTransferLimit?: boolean };
const wideFields = Object.values(parameterFields).map((p) => p.field);
const siteFields = ["site_id", "site_code", "site_name", "county", "watershed_name"];
const allowed: Record<Dataset, string[]> = {
  sites: [...siteFields, "site_status", "latitude", "longitude"],
  observations: [...siteFields, "observation_id", "collected_at", "approved_at", "published_at", "latitude", "longitude", "temp_f", ...wideFields, "quality_score", "quality_context"],
  measurements: ["observation_id", "site_id", "collected_at", "parameter_code", "display_name", "value", "unit_code", "qualifier", "source_type"],
  latest: [...siteFields, "observation_id", "collected_at", "sample_count", "temp_f", ...wideFields, "quality_score", "quality_context"],
};
const required: Record<Dataset, string[]> = {
  sites: ["site_id", "site_code", "site_name", "latitude", "longitude"],
  observations: ["observation_id", "site_id", "collected_at", "approved_at"],
  measurements: ["observation_id", "site_id", "collected_at", "parameter_code", "value", "unit_code"],
  latest: ["observation_id", "site_id", "collected_at", "temp_c"],
};

function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("A public record is missing its identifier or label.");
  return value;
}
function number(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("A public measurement or coordinate is invalid.");
  return value;
}
function iso(value: unknown): string {
  const date = new Date(number(value));
  if (!Number.isFinite(date.valueOf())) throw new Error("A public record has an invalid collection date.");
  return date.toISOString();
}
const sql = (value: string) => `'${text(value).replaceAll("'", "''")}'`;

/** Anonymous, allowlisted hosted views only. There is deliberately no Firestore or token path. */
export class ArcgisDashboardDataSource implements DashboardDataSource {
  private metadata = new Map<Dataset, Promise<Metadata>>();
  private sources: ArcgisSources;
  private request: typeof fetch;
  constructor(sources: ArcgisSources, request: typeof fetch = fetch) {
    this.sources = sources; this.request = request;
    for (const value of Object.values(sources)) {
      const url = new URL(value);
      if (url.protocol !== "https:" || !/^services\d*\.arcgis\.com$/.test(url.hostname) ||
          !/\/FeatureServer\/\d+$/.test(url.pathname) || url.search || url.hash || url.username || url.password) {
        throw new Error("Configure public ArcGIS Online hosted-view layer URLs without credentials.");
      }
    }
  }

  private async json<T extends Reply>(url: string, params: Record<string, string>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      let response: Response;
      try {
        response = await this.request(`${url}?${new URLSearchParams({ f: "json", ...params })}`, {
          credentials: "omit", redirect: "error", signal: AbortSignal.timeout(15000),
        });
      } catch {
        if (attempt < 2) continue;
        throw new Error("ArcGIS could not be reached. Check your connection and retry.");
      }
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
        continue;
      }
      if (!response.ok) throw new Error("The public ArcGIS source is unavailable.");
      const data = await response.json() as T;
      if (data.error) {
        if ((data.error.code === 429 || (data.error.code ?? 0) >= 500) && attempt < 2) continue;
        throw new Error("ArcGIS rejected the public-data query. The source may need verification.");
      }
      return data;
    }
    throw new Error("The public ArcGIS source is unavailable.");
  }

  private async inspect(dataset: Dataset): Promise<Metadata> {
    if (!this.metadata.has(dataset)) {
      const promise = (async () => {
        const url = this.sources[dataset];
        const [layer, service] = await Promise.all([
          this.json<Metadata & Reply>(url, {}),
          this.json<Reply & { isView?: boolean; capabilities?: string }>(url.replace(/\/\d+$/, ""), {}),
        ]);
        if (service.isView !== true || layer.capabilities !== "Query" || service.capabilities !== "Query") {
          throw new Error("The monitoring source must be a read-only public hosted view.");
        }
        if (!Array.isArray(layer.fields) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(layer.objectIdField)) throw new Error("Invalid ArcGIS view schema.");
        const names = layer.fields.map((f) => f.name);
        if (required[dataset].some((name) => !names.includes(name)) ||
            layer.fields.some((f) => (f.type === "esriFieldTypeOID" ? f.name !== layer.objectIdField : f.type !== "esriFieldTypeGeometry" && !allowed[dataset].includes(f.name)))) {
          throw new Error("The public view schema does not match the verified privacy contract.");
        }
        return layer;
      })();
      this.metadata.set(dataset, promise);
      promise.catch(() => this.metadata.delete(dataset));
    }
    return this.metadata.get(dataset)!;
  }

  private async query(dataset: Dataset, where = "1=1"): Promise<Attributes[]> {
    const meta = await this.inspect(dataset);
    const url = `${this.sources[dataset]}/query`;
    const ids = await this.json<Reply>(url, { where, returnIdsOnly: "true" });
    if (!Array.isArray(ids.objectIds) || ids.exceededTransferLimit || ids.objectIds.length >= 1000000 || ids.objectIds.some((id) => !Number.isSafeInteger(id))) {
      throw new Error("ArcGIS returned an incomplete record index; no partial results were displayed.");
    }
    const objectIds = [...new Set(ids.objectIds)].sort((a, b) => a - b);
    const size = Math.max(1, Math.min(meta.maxRecordCount ?? 500, 500));
    const fields = allowed[dataset].filter((name) => meta.fields.some((f) => f.name === name));
    const rows: Attributes[] = [];
    for (let offset = 0; offset < objectIds.length; offset += size) {
      const batch = objectIds.slice(offset, offset + size);
      const page = await this.json<Reply>(url, { objectIds: batch.join(","), outFields: [meta.objectIdField, ...fields].join(","), returnGeometry: "false" });
      if (page.exceededTransferLimit || !Array.isArray(page.features) || page.features.length !== batch.length ||
          new Set(page.features.map((f) => f.attributes[meta.objectIdField])).size !== batch.length ||
          page.features.some((f) => !batch.includes(f.attributes[meta.objectIdField] as number))) {
        throw new Error("The public record set changed or was truncated. Retry to load a complete result.");
      }
      rows.push(...page.features.map((f) => f.attributes));
    }
    return rows;
  }

  async listSites(): Promise<DashboardSite[]> {
    const rows = await this.query("sites");
    const sites = rows.map((a) => {
      const longitude = number(a.longitude), latitude = number(a.latitude);
      if (Math.abs(longitude) > 180 || Math.abs(latitude) > 90 || (longitude === 0 && latitude === 0)) throw new Error("A public site has invalid WGS84 coordinates.");
      return { id: text(a.site_id), code: text(a.site_code), name: text(a.site_name), longitude, latitude,
        county: typeof a.county === "string" ? a.county : undefined, watershed: typeof a.watershed_name === "string" ? a.watershed_name : undefined };
    });
    if (new Set(sites.map((s) => s.id)).size !== sites.length) throw new Error("Duplicate public site IDs require source review.");
    return sites.sort((a, b) => a.code.localeCompare(b.code));
  }

  private condition(a: Attributes): LatestSiteCondition {
    text(a.observation_id);
    const observedAt = iso(a.collected_at);
    return { siteId: text(a.site_id), observedAt, reviewed: true,
      measurements: (Object.entries(parameterFields) as [DashboardParameter, typeof parameterFields[DashboardParameter]][])
        .filter(([, p]) => a[p.field] != null)
        .map(([parameter, p]) => ({ parameter, observedAt, value: number(a[p.field]), unit: p.label })) };
  }

  async listLatestSiteConditions(): Promise<LatestSiteCondition[]> {
    const rows = (await this.query("latest")).map((a) => this.condition(a));
    if (new Set(rows.map((r) => r.siteId)).size !== rows.length) throw new Error("Duplicate latest conditions require source review.");
    return rows;
  }

  async getLatestSiteCondition(siteId: string): Promise<LatestSiteCondition | null> {
    const rows = await this.query("latest", `site_id=${sql(siteId)}`);
    if (rows.length > 1) throw new Error("Duplicate latest conditions require source review.");
    return rows.length ? this.condition(rows[0]) : null;
  }

  async getObservationSeries(siteId: string, parameter: DashboardParameter, startIso?: string, endIso?: string): Promise<DashboardObservationSeriesPoint[]> {
    const p = parameterFields[parameter];
    if (!p) throw new Error("Unsupported measurement parameter.");
    const start = startIso === undefined ? -Infinity : Date.parse(startIso), end = endIso === undefined ? Infinity : Date.parse(endIso);
    if (Number.isNaN(start) || Number.isNaN(end) || start > end) throw new Error("Invalid date range.");
    const dates = (field: string) => `${Number.isFinite(start) ? ` AND ${field}>=TIMESTAMP '${new Date(start).toISOString().slice(0, 23).replace("T", " ")}'` : ""}${Number.isFinite(end) ? ` AND ${field}<=TIMESTAMP '${new Date(end).toISOString().slice(0, 23).replace("T", " ")}'` : ""}`;
    const [observations, measurements] = await Promise.all([
      this.query("observations", `site_id=${sql(siteId)}${dates("collected_at")}`),
      this.query("measurements", `site_id=${sql(siteId)} AND parameter_code=${sql(p.code)}${dates("collected_at")}`),
    ]);
    const approved = new Map<string, string>();
    for (const a of observations) {
      if (a.site_id !== siteId) throw new Error("ArcGIS returned an observation from another site.");
      const id = text(a.observation_id);
      if (approved.has(id)) throw new Error("Duplicate public observations require source review.");
      iso(a.approved_at);
      approved.set(id, iso(a.collected_at));
    }
    const seen = new Set<string>();
    return measurements.map((a) => {
      const observationId = text(a.observation_id), observedAt = iso(a.collected_at);
      if (a.site_id !== siteId || a.parameter_code !== p.code || approved.get(observationId) !== observedAt || seen.has(observationId)) {
        throw new Error("The public measurement does not have a unique matching approved observation.");
      }
      if (a.qualifier != null && a.qualifier !== "") throw new Error("This measurement has a qualifier that needs scientific interpretation before plotting.");
      if (a.unit_code !== p.unit) throw new Error("A measurement has an unexpected unit; no silent conversion was applied.");
      seen.add(observationId);
      return { observationId, observedAt, parameter, value: number(a.value), unit: p.label };
    }).filter((point) => Date.parse(point.observedAt) >= start && Date.parse(point.observedAt) <= end)
      .sort((a, b) => a.observedAt.localeCompare(b.observedAt) || a.observationId.localeCompare(b.observationId));
  }
}
