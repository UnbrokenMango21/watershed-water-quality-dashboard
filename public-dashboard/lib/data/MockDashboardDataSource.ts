import type {
  DashboardDataSource,
  DashboardMeasurement,
  DashboardObservationSeriesPoint,
  DashboardParameter,
  DashboardSite,
  LatestSiteCondition,
} from "./DashboardDataSource";

const observationDates = [
  "2026-05-12T14:30:00Z",
  "2026-06-03T15:05:00Z",
  "2026-06-24T13:50:00Z",
  "2026-07-08T14:20:00Z",
  "2026-07-29T15:10:00Z",
  "2026-08-17T15:40:00Z",
];

export const demoSites: DashboardSite[] = [
  { id: "demo-spring", code: "DEMO-SC-01", name: "Demo Spring Creek Site", county: "Centre County", watershed: "Spring Creek", siteType: "Stream", longitude: -77.779, latitude: 40.913 },
  { id: "demo-penns", code: "DEMO-PC-02", name: "Demo Penns Creek Site", county: "Centre County", watershed: "Penns Creek", siteType: "Stream", longitude: -77.415, latitude: 40.838 },
  { id: "demo-bald-eagle", code: "DEMO-BE-03", name: "Demo Bald Eagle Creek Site", county: "Centre County", watershed: "Bald Eagle Creek", siteType: "Stream", longitude: -77.698, latitude: 40.989 },
  { id: "demo-little-juniata", code: "DEMO-LJ-04", name: "Demo Little Juniata Site", county: "Blair County", watershed: "Little Juniata River", siteType: "River", longitude: -78.008, latitude: 40.604 },
  { id: "demo-kish", code: "DEMO-KC-05", name: "Demo Kishacoquillas Creek Site", county: "Mifflin County", watershed: "Kishacoquillas Creek", siteType: "Stream", longitude: -77.578, latitude: 40.600 },
  { id: "demo-standing-stone", code: "DEMO-SS-06", name: "Demo Standing Stone Site", county: "Huntingdon County", watershed: "Standing Stone Creek", siteType: "Stream", longitude: -77.981, latitude: 40.497 },
  { id: "demo-black-moshannon", code: "DEMO-BM-07", name: "Demo Black Moshannon Site", county: "Centre County", watershed: "Black Moshannon Creek", siteType: "Stream", longitude: -78.057, latitude: 40.917 },
  { id: "demo-juniata", code: "DEMO-JR-08", name: "Demo Juniata River Site", county: "Huntingdon County", watershed: "Juniata River", siteType: "River", longitude: -78.012, latitude: 40.485 },
];

const m = (parameter: DashboardParameter, value: number, unit: string, observedAt = observationDates.at(-1)!): DashboardMeasurement => ({
  parameter,
  value,
  unit,
  observedAt,
});

const latestMeasurements: Record<string, DashboardMeasurement[]> = {
  "demo-spring": [
    m("waterTemperature", 17.8, "°C"), m("ph", 7.42, "pH"), m("dissolvedOxygen", 9.1, "mg/L"), m("specificConductivity", 286, "µS/cm"), m("nitrate", 0.64, "mg/L"),
  ],
  "demo-penns": [
    m("waterTemperature", 19.3, "°C"), m("ph", 7.71, "pH"), m("dissolvedOxygen", 8.5, "mg/L"), m("specificConductivity", 214, "µS/cm"), m("nitrate", 0.31, "mg/L"),
  ],
  "demo-bald-eagle": [
    m("waterTemperature", 20.6, "°C"), m("ph", 7.33, "pH"), m("dissolvedOxygen", 7.8, "mg/L"), m("specificConductivity", 331, "µS/cm"),
  ],
  "demo-little-juniata": [
    m("waterTemperature", 18.9, "°C"), m("ph", 7.56, "pH"), m("dissolvedOxygen", 8.8, "mg/L"), m("specificConductivity", 268, "µS/cm"), m("nitrate", 0.48, "mg/L"),
  ],
  "demo-kish": [
    m("waterTemperature", 21.2, "°C"), m("ph", 7.18, "pH"), m("nitrate", 0.82, "mg/L"),
  ],
  "demo-black-moshannon": [
    m("waterTemperature", 16.4, "°C"), m("ph", 6.91, "pH"),
  ],
  "demo-juniata": [
    m("waterTemperature", 22.1, "°C"), m("ph", 7.49, "pH"), m("dissolvedOxygen", 7.6, "mg/L"), m("specificConductivity", 302, "µS/cm"), m("nitrate", 0.57, "mg/L"),
  ],
};

const offsets: Record<DashboardParameter, number[]> = {
  waterTemperature: [-5.1, -3.8, -1.9, 0.7, 1.8, 0],
  ph: [-0.18, -0.09, 0.04, -0.06, 0.11, 0],
  dissolvedOxygen: [1.1, 0.7, 0.3, -0.4, -0.2, 0],
  dissolvedOxygenSaturation: [-7, -3, 2, 5, 1, 0],
  specificConductivity: [-24, -11, 8, 19, 12, 0],
  totalDissolvedSolids: [-12, -7, 3, 8, 4, 0],
  oxidationReductionPotential: [-14, -8, 5, 11, 6, 0],
  chloride: [-0.08, -0.03, 0.02, 0.04, 0.01, 0],
  sulfate: [-0.06, -0.02, 0.01, 0.03, 0.02, 0],
  nitrate: [-0.12, -0.08, -0.02, 0.05, 0.03, 0],
  phosphate: [-0.02, -0.01, 0.01, 0.02, 0.01, 0],
  discharge: [0.4, 0.1, -0.2, 0.8, 0.3, 0],
};

const roundFor = (parameter: DashboardParameter, value: number) => {
  if (parameter === "specificConductivity") return Math.round(value);
  if (parameter === "ph" || parameter === "nitrate") return Math.round(value * 100) / 100;
  return Math.round(value * 10) / 10;
};

const seriesBySite = new Map<string, DashboardObservationSeriesPoint[]>();
const conditionsBySite = new Map<string, LatestSiteCondition>();

for (const site of demoSites) {
  const current = latestMeasurements[site.id];
  if (!current) continue;

  const allPoints: DashboardObservationSeriesPoint[] = [];
  const previousMeasurements: Partial<Record<DashboardParameter, DashboardMeasurement>> = {};

  for (const measurement of current) {
    const parameterOffsets = offsets[measurement.parameter];
    const points = observationDates.map((observedAt, index) => ({
      observationId: `${site.id}-${measurement.parameter}-${index + 1}`,
      parameter: measurement.parameter,
      value: roundFor(measurement.parameter, measurement.value + parameterOffsets[index]),
      unit: measurement.unit,
      observedAt,
    }));
    allPoints.push(...points);
    previousMeasurements[measurement.parameter] = points.at(-2);
  }

  seriesBySite.set(site.id, allPoints);
  conditionsBySite.set(site.id, {
    siteId: site.id,
    approvedAt: observationDates.at(-1)!,
    reviewed: true,
    measurements: current,
    previousMeasurements,
  });
}

export const demoNetworkSummary = {
  activeSites: demoSites.filter((site) => conditionsBySite.has(site.id)).length,
  totalSites: demoSites.length,
  streamsMonitored: new Set(demoSites.map((site) => site.watershed)).size,
  latestUpdate: observationDates.at(-1)!,
};

export class MockDashboardDataSource implements DashboardDataSource {
  async listSites(): Promise<DashboardSite[]> {
    return demoSites.map((site) => ({ ...site }));
  }

  async getLatestSiteCondition(siteId: string): Promise<LatestSiteCondition | null> {
    const condition = conditionsBySite.get(siteId);
    return condition ? structuredClone(condition) : null;
  }

  async getObservationSeries(
    siteId: string,
    parameter: DashboardParameter,
    startIso?: string,
    endIso?: string,
  ): Promise<DashboardObservationSeriesPoint[]> {
    const start = startIso ? Date.parse(startIso) : Number.NEGATIVE_INFINITY;
    const end = endIso ? Date.parse(endIso) : Number.POSITIVE_INFINITY;
    return (seriesBySite.get(siteId) ?? [])
      .filter((point) => point.parameter === parameter)
      .filter((point) => {
        const time = Date.parse(point.observedAt);
        return time >= start && time <= end;
      })
      .map((point) => ({ ...point }));
  }
}

export const mockDashboardDataSource = new MockDashboardDataSource();
