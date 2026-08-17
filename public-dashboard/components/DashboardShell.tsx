"use client";

import { createElement, useEffect, useMemo, useRef, useState } from "react";
import type {
  DashboardObservationSeriesPoint,
  DashboardParameter,
  DashboardSite,
  LatestSiteCondition,
} from "@/lib/data/DashboardDataSource";
import {
  demoNetworkSummary,
  mockDashboardDataSource,
} from "@/lib/data/MockDashboardDataSource";

const parameterDefinitions: Array<{
  key: DashboardParameter;
  label: string;
  shortLabel: string;
  icon: string;
  decimals: number;
}> = [
  { key: "waterTemperature", label: "Water Temperature", shortLabel: "Temperature", icon: "TEMP", decimals: 1 },
  { key: "ph", label: "pH", shortLabel: "pH", icon: "pH", decimals: 2 },
  { key: "dissolvedOxygen", label: "Dissolved Oxygen", shortLabel: "Dissolved Oxygen", icon: "O₂", decimals: 1 },
  { key: "specificConductivity", label: "Specific Conductivity", shortLabel: "Conductivity", icon: "EC", decimals: 0 },
  { key: "nitrate", label: "Nitrate", shortLabel: "Nitrate", icon: "NO₃", decimals: 2 },
];

const ranges = ["7D", "30D", "90D", "1Y", "Full record"] as const;
type RangeName = (typeof ranges)[number];

type ArcgisMapElement = HTMLElement & {
  map?: { add: (layer: unknown) => void };
  goTo: (target: unknown, options?: unknown) => Promise<unknown>;
  hitTest: (target: unknown, options?: unknown) => Promise<{ results: Array<Record<string, unknown>> }>;
};

function calciteButton(label: string, iconStart?: string) {
  return createElement(
    "calcite-button",
    {
      appearance: "transparent",
      kind: "neutral",
      scale: "s",
      iconStart,
      type: "button",
    },
    label,
  );
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatShortDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(iso));
}

function rangeStart(range: RangeName, points: DashboardObservationSeriesPoint[]) {
  if (range === "Full record" || points.length === 0) return Number.NEGATIVE_INFINITY;
  const latest = Math.max(...points.map((point) => Date.parse(point.observedAt)));
  const days = range === "7D" ? 7 : range === "30D" ? 30 : range === "90D" ? 90 : 365;
  return latest - days * 24 * 60 * 60 * 1000;
}

function TrendChart({ points, label }: { points: DashboardObservationSeriesPoint[]; label: string }) {
  if (points.length === 0) {
    return (
      <div className="chart-empty" role="status">
        <div className="chart-grid" aria-hidden="true" />
        <div className="chart-empty-copy">
          <strong>No measurements in this range</strong>
          <span>Try a longer date range or select a parameter that was recorded for this sample.</span>
        </div>
      </div>
    );
  }

  const values = points.map((point) => point.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const spread = Math.max(rawMax - rawMin, Math.abs(rawMax) * 0.05, 0.1);
  const min = rawMin - spread * 0.18;
  const max = rawMax + spread * 0.18;
  const plot = { left: 64, right: 780, top: 20, bottom: 210 };
  const width = plot.right - plot.left;
  const height = plot.bottom - plot.top;
  const xFor = (index: number) => plot.left + (points.length === 1 ? width / 2 : (index / (points.length - 1)) * width);
  const yFor = (value: number) => plot.top + ((max - value) / (max - min)) * height;
  const polyline = points.map((point, index) => `${xFor(index)},${yFor(point.value)}`).join(" ");
  const gridValues = [max, max - (max - min) / 3, max - (2 * (max - min)) / 3, min];
  const unit = points[0]?.unit ?? "";

  return (
    <div className="chart-wrap">
      <svg
        className="trend-chart"
        viewBox="0 0 820 250"
        role="img"
        aria-label={`${label} synthetic observation series with ${points.length} observations, from ${formatShortDate(points[0].observedAt)} to ${formatShortDate(points.at(-1)!.observedAt)}.`}
      >
        {gridValues.map((gridValue) => {
          const y = yFor(gridValue);
          return (
            <g key={gridValue}>
              <line x1={plot.left} x2={plot.right} y1={y} y2={y} className="chart-grid-line" />
              <text x={plot.left - 10} y={y + 4} textAnchor="end" className="chart-axis-label">
                {gridValue.toFixed(Math.abs(gridValue) < 10 ? 1 : 0)}
              </text>
            </g>
          );
        })}
        <line x1={plot.left} x2={plot.right} y1={plot.bottom} y2={plot.bottom} className="chart-axis-line" />
        {points.length > 1 && <polyline points={polyline} className="chart-series-line" />}
        {points.map((point, index) => (
          <g key={point.observationId}>
            <circle cx={xFor(index)} cy={yFor(point.value)} r="4.5" className="chart-point">
              <title>{`${formatDateTime(point.observedAt)} — ${point.value} ${point.unit}`}</title>
            </circle>
            {(index === 0 || index === points.length - 1 || (points.length > 3 && index === Math.floor((points.length - 1) / 2))) && (
              <text x={xFor(index)} y="235" textAnchor="middle" className="chart-axis-label">{formatShortDate(point.observedAt)}</text>
            )}
          </g>
        ))}
        <text x="15" y="118" transform="rotate(-90 15 118)" textAnchor="middle" className="chart-unit-label">{unit}</text>
      </svg>
      <div className="chart-caption">Synthetic field-sampling observations are connected only to show consecutive sampling events; no values are interpolated between dates.</div>
    </div>
  );
}

export function DashboardShell() {
  const mapHost = useRef<HTMLDivElement>(null);
  const mapElementRef = useRef<ArcgisMapElement | null>(null);
  const selectionUpdaterRef = useRef<((site: DashboardSite | null) => void) | null>(null);
  const [activeRange, setActiveRange] = useState<RangeName>("90D");
  const [activeParameter, setActiveParameter] = useState<DashboardParameter>("waterTemperature");
  const [sites, setSites] = useState<DashboardSite[]>([]);
  const [conditions, setConditions] = useState<Record<string, LatestSiteCondition | null>>({});
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [series, setSeries] = useState<DashboardObservationSeriesPoint[]>([]);
  const [search, setSearch] = useState("");

  const demoMode = process.env.NEXT_PUBLIC_DASHBOARD_DATA_MODE === "demo";
  const productionDataConfigured = useMemo(
    () =>
      Boolean(process.env.NEXT_PUBLIC_ARCGIS_SITES_VIEW_URL) &&
      Boolean(process.env.NEXT_PUBLIC_ARCGIS_OBSERVATIONS_VIEW_URL) &&
      Boolean(process.env.NEXT_PUBLIC_ARCGIS_MEASUREMENTS_VIEW_URL) &&
      Boolean(process.env.NEXT_PUBLIC_ARCGIS_LATEST_CONDITIONS_VIEW_URL),
    [],
  );
  const dataConfigured = demoMode || productionDataConfigured;

  useEffect(() => {
    if (!demoMode) return;
    let cancelled = false;
    void (async () => {
      const loadedSites = await mockDashboardDataSource.listSites();
      const conditionEntries = await Promise.all(
        loadedSites.map(async (site) => [site.id, await mockDashboardDataSource.getLatestSiteCondition(site.id)] as const),
      );
      if (cancelled) return;
      setSites(loadedSites);
      setConditions(Object.fromEntries(conditionEntries));
      setSelectedSiteId((current) => current ?? loadedSites[0]?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [demoMode]);

  const filteredSites = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return sites;
    return sites.filter((site) =>
      [site.name, site.code, site.county, site.watershed, site.siteType]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [search, sites]);

  const selectedSite = useMemo(() => sites.find((site) => site.id === selectedSiteId) ?? null, [selectedSiteId, sites]);
  const selectedCondition = selectedSiteId ? conditions[selectedSiteId] ?? null : null;
  const activeDefinition = parameterDefinitions.find((parameter) => parameter.key === activeParameter)!;

  useEffect(() => {
    if (!demoMode || !selectedSiteId) {
      setSeries([]);
      return;
    }
    let cancelled = false;
    void mockDashboardDataSource.getObservationSeries(selectedSiteId, activeParameter).then((points) => {
      if (!cancelled) setSeries(points);
    });
    return () => {
      cancelled = true;
    };
  }, [activeParameter, demoMode, selectedSiteId]);

  const visibleSeries = useMemo(() => {
    const start = rangeStart(activeRange, series);
    return series.filter((point) => Date.parse(point.observedAt) >= start);
  }, [activeRange, series]);

  useEffect(() => {
    let cancelled = false;
    const host = mapHost.current;
    if (!host) return;

    async function initializeBrowserComponents() {
      const [graphicsModule, layerModule, pointModule, symbolModule] = await Promise.all([
        import("@arcgis/core/Graphic.js"),
        import("@arcgis/core/layers/GraphicsLayer.js"),
        import("@arcgis/core/geometry/Point.js"),
        import("@arcgis/core/symbols/SimpleMarkerSymbol.js"),
        import("@arcgis/map-components/components/arcgis-home"),
        import("@arcgis/map-components/components/arcgis-layer-list"),
        import("@arcgis/map-components/components/arcgis-map"),
        import("@arcgis/map-components/components/arcgis-zoom"),
        import("@esri/calcite-components/components/calcite-button"),
      ]);

      if (cancelled || !mapHost.current) return;

      const Graphic = graphicsModule.default;
      const GraphicsLayer = layerModule.default;
      const Point = pointModule.default;
      const SimpleMarkerSymbol = symbolModule.default;
      const map = document.createElement("arcgis-map") as unknown as ArcgisMapElement;
      map.setAttribute("basemap", "topo-vector");
      map.setAttribute("center", "-77.85,40.9");
      map.setAttribute("zoom", "7");
      map.className = "map-element";
      map.setAttribute("aria-label", "Central Pennsylvania watershed monitoring map");

      const zoom = document.createElement("arcgis-zoom");
      zoom.setAttribute("position", "top-left");
      const home = document.createElement("arcgis-home");
      home.setAttribute("position", "top-left");
      map.append(zoom, home);

      const onReady = () => {
        if (!demoMode || sites.length === 0 || !map.map) return;
        const siteLayer = new GraphicsLayer({ title: "Synthetic demo monitoring sites" });
        const selectionLayer = new GraphicsLayer({ title: "Selected demo site", listMode: "hide" });
        const markerSymbol = new SimpleMarkerSymbol({
          style: "circle",
          color: [11, 102, 195, 0.92],
          size: 10,
          outline: { color: [255, 255, 255, 1], width: 1.5 },
        });

        for (const site of sites) {
          siteLayer.add(new Graphic({
            geometry: new Point({ longitude: site.longitude, latitude: site.latitude }),
            attributes: { siteId: site.id, name: site.name, code: site.code },
            symbol: markerSymbol,
            popupTemplate: {
              title: "{name}",
              content: "{code}<br/>Synthetic demonstration site",
            },
          }));
        }
        map.map.add(siteLayer);
        map.map.add(selectionLayer);

        const layers = document.createElement("arcgis-layer-list");
        layers.setAttribute("position", "top-right");
        map.append(layers);

        selectionUpdaterRef.current = (site) => {
          selectionLayer.removeAll();
          if (!site) return;
          selectionLayer.add(new Graphic({
            geometry: new Point({ longitude: site.longitude, latitude: site.latitude }),
            symbol: new SimpleMarkerSymbol({
              style: "circle",
              color: [255, 255, 255, 0.12],
              size: 20,
              outline: { color: [8, 78, 148, 1], width: 3 },
            }),
          }));
        };

        void map.goTo(siteLayer.graphics.toArray(), { duration: 0 }).catch(() => undefined);
      };

      map.addEventListener("arcgisViewReadyChange", onReady, { once: true });
      map.addEventListener("arcgisViewClick", async (event) => {
        if (!demoMode) return;
        try {
          const response = await map.hitTest((event as CustomEvent).detail);
          const hit = response.results.find((result) => {
            const graphic = result.graphic as { attributes?: Record<string, unknown> } | undefined;
            return result.type === "graphic" && typeof graphic?.attributes?.siteId === "string";
          });
          const graphic = hit?.graphic as { attributes?: Record<string, unknown> } | undefined;
          const siteId = graphic?.attributes?.siteId;
          if (typeof siteId === "string") setSelectedSiteId(siteId);
        } catch {
          // A basemap click with no graphic is intentionally a no-op.
        }
      });

      mapHost.current.replaceChildren(map);
      mapElementRef.current = map;
    }

    void initializeBrowserComponents();

    return () => {
      cancelled = true;
      selectionUpdaterRef.current = null;
      mapElementRef.current = null;
      host.replaceChildren();
    };
  }, [demoMode, sites]);

  useEffect(() => {
    selectionUpdaterRef.current?.(selectedSite);
    if (!selectedSite || !mapElementRef.current) return;
    void mapElementRef.current
      .goTo({ center: [selectedSite.longitude, selectedSite.latitude], zoom: 11 }, { duration: 500 })
      .catch(() => undefined);
    document.getElementById(`site-row-${selectedSite.id}`)?.scrollIntoView({ block: "nearest" });
  }, [selectedSite]);

  const latestUpdate = demoMode ? demoNetworkSummary.latestUpdate : null;

  return (
    <main className="dashboard-shell">
      <header className="app-bar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">≈</div>
          <div>
            <h1>Central PA Watershed</h1>
            <p>Water Quality Monitoring Dashboard</p>
          </div>
        </div>

        <div className="kpi-strip" aria-label="Network summary">
          <div className="kpi"><span>Active Sites</span><strong>{demoMode ? demoNetworkSummary.activeSites : "—"}</strong></div>
          <div className="kpi"><span>Latest Update</span><strong>{latestUpdate ? formatShortDate(latestUpdate) : "—"}</strong></div>
          <div className="kpi"><span>Streams Monitored</span><strong>{demoMode ? demoNetworkSummary.streamsMonitored : "—"}</strong></div>
        </div>

        <nav className="app-actions" aria-label="Dashboard actions">
          {calciteButton("Date range", "calendar")}
          {calciteButton("Layers", "layers")}
          {calciteButton("Export", "download")}
          {calciteButton("Help", "question")}
        </nav>
      </header>

      {demoMode && (
        <div className="demo-banner" role="status">
          <strong>DEMO MODE</strong>
          <span>Synthetic test sites and measurements — not field observations and not production data.</span>
        </div>
      )}

      <section className="workspace">
        <aside className="site-browser" aria-label="Monitoring sites">
          <div className="panel-heading">
            <div>
              <h2>Monitoring Sites</h2>
              <span className="site-count">{dataConfigured ? `${filteredSites.length} of ${sites.length} sites` : "— sites"}</span>
            </div>
          </div>
          <div className="site-search">
            <input
              className="site-search-input"
              type="search"
              placeholder="Search sites"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              disabled={!dataConfigured}
              aria-label="Search monitoring sites"
            />
          </div>
          {demoMode ? (
            <div className="site-list" role="list" aria-label="Synthetic monitoring sites">
              {filteredSites.map((site) => {
                const condition = conditions[site.id];
                const primaryCount = condition?.measurements.filter((measurement) => parameterDefinitions.some((parameter) => parameter.key === measurement.parameter)).length ?? 0;
                const completeness = !condition ? "missing" : primaryCount >= parameterDefinitions.length ? "complete" : "partial";
                return (
                  <button
                    id={`site-row-${site.id}`}
                    key={site.id}
                    type="button"
                    role="listitem"
                    className={site.id === selectedSiteId ? "site-row selected" : "site-row"}
                    onClick={() => setSelectedSiteId(site.id)}
                  >
                    <span className={`sample-dot ${completeness}`} aria-hidden="true" />
                    <span className="site-row-copy">
                      <strong>{site.name}</strong>
                      <span>{site.code} · {site.county}</span>
                      <span>{site.watershed}</span>
                    </span>
                    <span className={`sample-state ${completeness}`}>
                      {completeness === "complete" ? "Complete" : completeness === "partial" ? "Partial" : "No sample"}
                    </span>
                  </button>
                );
              })}
              {filteredSites.length === 0 && (
                <div className="empty-panel compact"><strong>No matching demo sites</strong><span>Clear or change the search text.</span></div>
              )}
            </div>
          ) : (
            <div className="empty-panel compact">
              <strong>No production site data connected</strong>
              <span>Approved public ArcGIS views will populate this browser.</span>
            </div>
          )}
        </aside>

        <section className="center-column">
          <div className="map-frame">
            <div ref={mapHost} className="map-host" />
            {demoMode ? (
              <div className="map-status demo-map-status" role="status">
                <strong>Synthetic demonstration geography</strong>
                <span>Click a blue marker or choose a site from the monitoring-site browser.</span>
              </div>
            ) : !productionDataConfigured ? (
              <div className="map-status" role="status">
                <strong>Basemap ready</strong>
                <span>Monitoring and watershed layers are intentionally withheld until approved production sources are configured.</span>
              </div>
            ) : null}
          </div>

          <section className="trend-panel" aria-labelledby="trend-heading">
            <div className="trend-toolbar">
              <div>
                <span className="eyebrow">Scientific time series</span>
                <h2 id="trend-heading">{activeDefinition.label}</h2>
                {selectedSite && <span className="trend-site-name">{selectedSite.name}</span>}
              </div>
              <div className="range-controls" aria-label="Time range">
                {ranges.map((range) => (
                  <button
                    key={range}
                    type="button"
                    className={range === activeRange ? "range-button active" : "range-button"}
                    onClick={() => setActiveRange(range)}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>
            <div className="parameter-tabs" role="tablist" aria-label="Water quality parameter">
              {parameterDefinitions.map((parameter) => (
                <button
                  key={parameter.key}
                  role="tab"
                  aria-selected={parameter.key === activeParameter}
                  type="button"
                  className={parameter.key === activeParameter ? "parameter-tab active" : "parameter-tab"}
                  onClick={() => setActiveParameter(parameter.key)}
                >
                  {parameter.shortLabel}
                </button>
              ))}
            </div>
            {selectedSite ? (
              <TrendChart points={visibleSeries} label={activeDefinition.label} />
            ) : (
              <div className="chart-empty" role="status">
                <div className="chart-grid" aria-hidden="true" />
                <div className="chart-empty-copy"><strong>Select a monitoring site</strong><span>Its sampled observations will appear here.</span></div>
              </div>
            )}
          </section>
        </section>

        <aside className="site-detail" aria-label="Selected site details">
          <div className="detail-heading">
            <div className={selectedCondition ? "trust-dot" : "trust-dot inactive"} aria-hidden="true" />
            <div>
              <span className="eyebrow">Selected site</span>
              <h2>{selectedSite?.name ?? "No site selected"}</h2>
              {selectedSite ? (
                <p>{selectedSite.code} · {selectedSite.county}<br />{selectedSite.watershed}</p>
              ) : (
                <p>Choose a monitoring site from the map or site browser.</p>
              )}
            </div>
          </div>

          {demoMode && selectedCondition ? (
            <div className="trust-banner demo-trust-banner">
              <span>Synthetic approved sample</span>
              <strong>Demo review complete</strong>
            </div>
          ) : selectedCondition ? (
            <div className="trust-banner"><span>Approved observation</span><strong>Quality reviewed</strong></div>
          ) : (
            <div className="trust-banner neutral-trust-banner"><span>Latest sample</span><strong>Not available</strong></div>
          )}

          <section className="metrics" aria-label="Latest readings">
            <h3>Latest {demoMode ? "synthetic" : "approved"} reading {selectedCondition ? `· ${formatShortDate(selectedCondition.approvedAt)}` : ""}</h3>
            {parameterDefinitions.map((parameter) => {
              const current = selectedCondition?.measurements.find((measurement) => measurement.parameter === parameter.key);
              const previous = selectedCondition?.previousMeasurements?.[parameter.key];
              const delta = current && previous ? current.value - previous.value : null;
              const deltaText = delta === null ? "—" : `${delta > 0 ? "↑" : delta < 0 ? "↓" : "→"} ${Math.abs(delta).toFixed(parameter.decimals)}`;
              const deltaLabel = delta === null
                ? "No previous measurement available"
                : `${delta > 0 ? "Increased" : delta < 0 ? "Decreased" : "Unchanged"} by ${Math.abs(delta).toFixed(parameter.decimals)} ${current?.unit ?? ""} from the previous synthetic measurement`;
              return (
                <div className={current ? "metric-row" : "metric-row missing"} key={parameter.key}>
                  <div className="metric-icon" aria-hidden="true">{parameter.icon}</div>
                  <div className="metric-name">{parameter.label}</div>
                  <div className="metric-value">
                    {current ? <>{current.value.toFixed(parameter.decimals)} <span>{current.unit === "pH" ? "" : current.unit}</span></> : <span className="not-recorded">Not recorded</span>}
                  </div>
                  <div className="metric-delta" aria-label={deltaLabel}>{deltaText}</div>
                </div>
              );
            })}
          </section>

          <div className="detail-note">
            {demoMode && <strong>Demo behavior: </strong>}
            Trend arrows represent numeric change from the previous measurement only. They do not classify water quality, safety, or ecological health.
          </div>
        </aside>
      </section>
    </main>
  );
}
