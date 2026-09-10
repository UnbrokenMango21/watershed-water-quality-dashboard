import type {
  DashboardDataSource,
  DashboardMeasurement,
  DashboardObservationSeriesPoint,
  DashboardParameter,
  DashboardSite,
  LatestSiteCondition,
} from "./DashboardDataSource";

export interface ArcgisDashboardConfig {
  sitesViewUrl: string;
  observationsViewUrl: string;
  measurementsViewUrl: string;
  latestConditionsViewUrl: string;
}

type ArcgisField = { name: string; type?: string };
type ArcgisMetadata = {
  name?: string;
  capabilities?: string;
  hasAttachments?: boolean;
  objectIdField?: string;
  fields?: ArcgisField[];
  error?: { message?: string; details?: string[] };
};
type ArcgisFeature = { attributes?: Record<string, unknown>; geometry?: { x?: number; y?: number } };
type ArcgisQueryResponse = {
  features?: ArcgisFeature[];
  exceededTransferLimit?: boolean;
  error?: { message?: string; details?: string[] };
};

type ParameterContract = {
  code: string;
  canonicalUnit: string;
  displayUnit: string;
  latestField: string;
};

export const parameterContracts: Record<DashboardParameter, ParameterContract> = {
  waterTemperature: { code: "WATER_TEMP_C", canonicalUnit: "degC", displayUnit: "°C", latestField: "temp_c" },
  ph: { code: "PH", canonicalUnit: "pH", displayUnit: "pH", latestField: "ph" },
  dissolvedOxygen: { code: "DO_MG_L", canonicalUnit: "mg/L", displayUnit: "mg/L", latestField: "do_mg_l" },
  dissolvedOxygenSaturation: { code: "DO_PERCENT", canonicalUnit: "percent", displayUnit: "%", latestField: "do_percent" },
  specificConductivity: { code: "CONDUCTIVITY_US_CM", canonicalUnit: "uS/cm", displayUnit: "µS/cm", latestField: "conductivity_us_cm" },
  totalDissolvedSolids: { code: "TDS_MG_L", canonicalUnit: "mg/L", displayUnit: "mg/L", latestField: "tds_mg_l" },
  oxidationReductionPotential: { code: "ORP_MV", canonicalUnit: "mV", displayUnit: "mV", latestField: "orp_mv" },
  chloride: { code: "CHLORIDE_MG_L", canonicalUnit: "mg/L", displayUnit: "mg/L", latestField: "chloride_mg_l" },
  sulfate: { code: "SULFATE_MG_L", canonicalUnit: "mg/L", displayUnit: "mg/L", latestField: "sulfate_mg_l" },
  nitrate: { code: "NITRATE_MG_L", canonicalUnit: "mg/L as N", displayUnit: "mg/L as N", latestField: "nitrate_mg_l" },
  phosphate: { code: "PHOSPHATE_MG_L", canonicalUnit: "mg/L as P", displayUnit: "mg/L as P", latestField: "phosphate_mg_l" },
  discharge: { code: "DISCHARGE_M3_S", canonicalUnit: "m3/s", displayUnit: "m³/s", latestField: "discharge_m3_s" },
};

const protectedFieldNames = new Set([
  "collector_user_id",
  "source_submission_id",
  "source_revision_id",
  "event_id",
  "reviewer_user_id",
  "review_comment",
  "field_notes_original",
  "gps_accuracy_m",
  "site_distance_m",
  "entered_value",
  "entered_unit_code",
  "record_hash",
  "publication_key",
  "measurement_id",
  "revision_no",
  "schema_version",
  "mobile_app_version",
  "validation_rules_version",
  "quality_algorithm_version",
]);

const requiredFields = {
  sites: ["site_id", "site_code", "site_name", "latitude", "longitude"],
  observations: ["public_observation_id", "site_id", "collected_at"],
  measurements: ["public_observation_id", "site_id", "collected_at", "parameter_code", "value", "unit_code"],
  latest: ["site_id", "collected_at"],
} as const;

function datasetUrl(input: string): string {
  const clean = input.trim().replace(/\/+$/, "");
  if (!clean) throw new Error("An ArcGIS public-view URL is missing.");
  if (/\/FeatureServer\/\d+$/i.test(clean)) return clean;
  if (/\/FeatureServer$/i.test(clean)) return `${clean}/0`;
  throw new Error(`ArcGIS public-view URL must point to a FeatureServer: ${clean}`);
}

function errorMessage(payload: { error?: { message?: string; details?: string[] } }, fallback: string): string {
  if (!payload.error) return fallback;
  return [payload.error.message, ...(payload.error.details ?? [])].filter(Boolean).join(" — ") || fallback;
}

async function fetchJson<T extends { error?: { message?: string; details?: string[] } }>(url: URL, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`ArcGIS returned HTTP ${response.status}.`);
      const payload = await response.json() as T;
      if (payload.error) throw new Error(errorMessage(payload, "ArcGIS returned an error."));
      return payload;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 200 * 2 ** (attempt - 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("ArcGIS request failed.");
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`ArcGIS field ${field} is missing.`);
  return value.trim();
}

function asFiniteNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`ArcGIS field ${field} is not a finite number.`);
  return value;
}

function asIso(value: unknown, field: string): string {
  const date = typeof value === "number" ? new Date(value) : new Date(String(value ?? ""));
  if (Number.isNaN(date.valueOf())) throw new Error(`ArcGIS field ${field} is not a valid date.`);
  return date.toISOString();
}

async function queryAll(
  base: string,
  options: { where?: string; outFields: string[]; returnGeometry?: boolean; orderByFields?: string },
): Promise<ArcgisFeature[]> {
  const pageSize = 1000;
  const all: ArcgisFeature[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const url = new URL(`${base}/query`);
    url.searchParams.set("f", "json");
    url.searchParams.set("where", options.where ?? "1=1");
    url.searchParams.set("outFields", options.outFields.join(","));
    url.searchParams.set("returnGeometry", options.returnGeometry ? "true" : "false");
    url.searchParams.set("resultOffset", String(offset));
    url.searchParams.set("resultRecordCount", String(pageSize));
    if (options.orderByFields) url.searchParams.set("orderByFields", options.orderByFields);
    const payload = await fetchJson<ArcgisQueryResponse>(url);
    const features = payload.features ?? [];
    all.push(...features);
    if (features.length === 0 || (!payload.exceededTransferLimit && features.length < pageSize)) break;
  }
  return all;
}

function attributes(feature: ArcgisFeature): Record<string, unknown> {
  if (!feature.attributes) throw new Error("ArcGIS returned a feature without attributes.");
  return feature.attributes;
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

export class ArcgisDashboardDataSource implements DashboardDataSource {
  private readonly urls: Record<keyof typeof requiredFields, string>;
  private validationPromise?: Promise<void>;
  private latestPromise?: Promise<Map<string, LatestSiteCondition>>;

  constructor(config: ArcgisDashboardConfig) {
    this.urls = {
      sites: datasetUrl(config.sitesViewUrl),
      observations: datasetUrl(config.observationsViewUrl),
      measurements: datasetUrl(config.measurementsViewUrl),
      latest: datasetUrl(config.latestConditionsViewUrl),
    };
  }

  private async validateDataset(kind: keyof typeof requiredFields): Promise<void> {
    const url = new URL(this.urls[kind]);
    url.searchParams.set("f", "json");
    const metadata = await fetchJson<ArcgisMetadata>(url);
    const capabilities = new Set(String(metadata.capabilities ?? "").split(",").map((value) => value.trim()).filter(Boolean));
    if (!capabilities.has("Query") || ["Create", "Update", "Delete", "Editing"].some((value) => capabilities.has(value))) {
      throw new Error(`ArcGIS ${kind} public view is not read-only.`);
    }
    if (metadata.hasAttachments === true) throw new Error(`ArcGIS ${kind} public view unexpectedly exposes attachments.`);
    const names = new Set((metadata.fields ?? []).map((field) => field.name));
    for (const required of requiredFields[kind]) {
      if (!names.has(required)) throw new Error(`ArcGIS ${kind} public view is missing ${required}.`);
    }
    for (const field of protectedFieldNames) {
      if (names.has(field)) throw new Error(`ArcGIS ${kind} public view exposes protected field ${field}.`);
    }
  }

  private ensureValidated(): Promise<void> {
    this.validationPromise ??= Promise.all((Object.keys(this.urls) as Array<keyof typeof requiredFields>).map((kind) => this.validateDataset(kind))).then(() => undefined);
    return this.validationPromise;
  }

  async listSites(): Promise<DashboardSite[]> {
    await this.ensureValidated();
    const rows = await queryAll(this.urls.sites, {
      outFields: ["site_id", "site_code", "site_name", "county", "watershed_name", "site_status", "latitude", "longitude"],
      returnGeometry: true,
      orderByFields: "site_name ASC",
    });
    return rows.map((feature) => {
      const row = attributes(feature);
      const longitude = typeof row.longitude === "number" ? row.longitude : feature.geometry?.x;
      const latitude = typeof row.latitude === "number" ? row.latitude : feature.geometry?.y;
      return {
        id: asString(row.site_id, "site_id"),
        code: asString(row.site_code, "site_code"),
        name: asString(row.site_name, "site_name"),
        county: typeof row.county === "string" ? row.county : undefined,
        watershed: typeof row.watershed_name === "string" ? row.watershed_name : undefined,
        longitude: asFiniteNumber(longitude, "longitude"),
        latitude: asFiniteNumber(latitude, "latitude"),
      };
    });
  }

  private async loadLatestConditions(): Promise<Map<string, LatestSiteCondition>> {
    await this.ensureValidated();
    const rows = await queryAll(this.urls.latest, {
      outFields: ["site_id", "collected_at", ...Object.values(parameterContracts).map((contract) => contract.latestField)],
      returnGeometry: false,
    });
    const result = new Map<string, LatestSiteCondition>();
    for (const feature of rows) {
      const row = attributes(feature);
      const siteId = asString(row.site_id, "site_id");
      const observedAt = asIso(row.collected_at, "collected_at");
      const measurements: DashboardMeasurement[] = [];
      for (const [parameter, contract] of Object.entries(parameterContracts) as Array<[DashboardParameter, ParameterContract]>) {
        const raw = row[contract.latestField];
        if (raw == null) continue;
        measurements.push({ parameter, value: asFiniteNumber(raw, contract.latestField), unit: contract.displayUnit, observedAt });
      }
      result.set(siteId, { siteId, observedAt, reviewed: true, measurements });
    }
    return result;
  }

  async getLatestSiteCondition(siteId: string): Promise<LatestSiteCondition | null> {
    this.latestPromise ??= this.loadLatestConditions();
    const condition = (await this.latestPromise).get(siteId);
    return condition ? structuredClone(condition) : null;
  }

  private async verifyObservationJoins(siteId: string, rows: Record<string, unknown>[]): Promise<void> {
    const ids = [...new Set(rows.map((row) => asString(row.public_observation_id, "public_observation_id")))];
    if (ids.length === 0) return;
    const found = new Map<string, { siteId: string; collectedAt: string }>();
    for (const group of chunks(ids, 100)) {
      const where = `public_observation_id IN (${group.map(sqlString).join(",")})`;
      const observations = await queryAll(this.urls.observations, {
        where,
        outFields: ["public_observation_id", "site_id", "collected_at"],
        returnGeometry: false,
      });
      for (const feature of observations) {
        const row = attributes(feature);
        found.set(asString(row.public_observation_id, "public_observation_id"), {
          siteId: asString(row.site_id, "site_id"),
          collectedAt: asIso(row.collected_at, "collected_at"),
        });
      }
    }
    for (const row of rows) {
      const id = asString(row.public_observation_id, "public_observation_id");
      const observation = found.get(id);
      if (!observation) throw new Error(`Measurement references an unknown public observation ${id}.`);
      if (observation.siteId !== siteId) throw new Error(`Measurement/public-observation site join mismatch for ${id}.`);
      if (observation.collectedAt !== asIso(row.collected_at, "collected_at")) throw new Error(`Measurement/public-observation collection-time mismatch for ${id}.`);
    }
  }

  async getObservationSeries(
    siteId: string,
    parameter: DashboardParameter,
    startIso?: string,
    endIso?: string,
  ): Promise<DashboardObservationSeriesPoint[]> {
    await this.ensureValidated();
    const contract = parameterContracts[parameter];
    const features = await queryAll(this.urls.measurements, {
      where: `site_id=${sqlString(siteId)} AND parameter_code=${sqlString(contract.code)}`,
      outFields: ["public_observation_id", "site_id", "collected_at", "parameter_code", "value", "unit_code", "qualifier"],
      returnGeometry: false,
      orderByFields: "collected_at ASC",
    });
    const rows = features.map(attributes);
    await this.verifyObservationJoins(siteId, rows);
    const start = startIso ? Date.parse(startIso) : Number.NEGATIVE_INFINITY;
    const end = endIso ? Date.parse(endIso) : Number.POSITIVE_INFINITY;
    if ((startIso && Number.isNaN(start)) || (endIso && Number.isNaN(end))) throw new Error("Invalid dashboard date range.");

    return rows.map((row) => {
      if (row.qualifier != null && String(row.qualifier).trim() !== "") {
        throw new Error("This measurement has a qualifier that needs scientific interpretation before plotting.");
      }
      if (row.unit_code !== contract.canonicalUnit) {
        throw new Error(`Unexpected unit for ${contract.code}: ${String(row.unit_code)}.`);
      }
      const observedAt = asIso(row.collected_at, "collected_at");
      return {
        observationId: asString(row.public_observation_id, "public_observation_id"),
        parameter,
        value: asFiniteNumber(row.value, "value"),
        unit: contract.displayUnit,
        observedAt,
      };
    }).filter((point) => {
      const time = Date.parse(point.observedAt);
      return time >= start && time <= end;
    });
  }
}
