export type DashboardParameter =
  | "waterTemperature"
  | "ph"
  | "dissolvedOxygen"
  | "dissolvedOxygenSaturation"
  | "specificConductivity"
  | "totalDissolvedSolids"
  | "oxidationReductionPotential"
  | "chloride"
  | "sulfate"
  | "nitrate"
  | "phosphate"
  | "discharge";

export interface DashboardSite {
  id: string;
  code: string;
  name: string;
  county?: string;
  watershed?: string;
  siteType?: string;
  longitude: number;
  latitude: number;
}

export interface DashboardMeasurement {
  parameter: DashboardParameter;
  value: number;
  unit: string;
  observedAt: string;
}

export interface LatestSiteCondition {
  siteId: string;
  /** Scientific collection/sample time. This is what the public UI labels as the sample time. */
  observedAt: string;
  /** Optional approval time; never substitute this for observedAt. */
  approvedAt?: string;
  reviewed: true;
  measurements: DashboardMeasurement[];
  previousMeasurements?: Partial<Record<DashboardParameter, DashboardMeasurement>>;
}

export interface DashboardObservationSeriesPoint extends DashboardMeasurement {
  /** Opaque public identifier; never a private Firestore submission/revision/workflow ID. */
  observationId: string;
}

export interface DashboardDataSource {
  listSites(): Promise<DashboardSite[]>;
  getLatestSiteCondition(siteId: string): Promise<LatestSiteCondition | null>;
  getObservationSeries(
    siteId: string,
    parameter: DashboardParameter,
    startIso?: string,
    endIso?: string,
  ): Promise<DashboardObservationSeriesPoint[]>;
}

/**
 * Production adapters must return approved, public-safe ArcGIS data only.
 * This interface intentionally contains no reviewer identities, workflow IDs,
 * private notes, confidence scores, or other internal publication metadata.
 */
