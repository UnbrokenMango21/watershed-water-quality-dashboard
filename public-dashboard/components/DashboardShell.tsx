"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DashboardObservationSeriesPoint, DashboardParameter, DashboardSite, LatestSiteCondition } from "@/lib/data/DashboardDataSource";
import { ArcgisDashboardDataSource } from "@/lib/data/ArcgisDashboardDataSource";
import { mockDashboardDataSource } from "@/lib/data/MockDashboardDataSource";
import { ChartPanel } from "./dashboard/ChartPanel";
import { exportSeriesCsv } from "./dashboard/exportCsv";
import { MapSurface } from "./dashboard/MapSurface";
import { SiteBrowser } from "./dashboard/SiteBrowser";
import { SiteDetail } from "./dashboard/SiteDetail";
import { formatShortDate, parameterDefinitions, rangeStart, type MobileView, type RangeName } from "./dashboard/dashboard-utils";

type DataSubview = "readings" | "series";

export function DashboardShell() {
  const [activeRange, setActiveRange] = useState<RangeName>("90D");
  const [activeParameter, setActiveParameter] = useState<DashboardParameter>("waterTemperature");
  const [sites, setSites] = useState<DashboardSite[]>([]);
  const [conditions, setConditions] = useState<Record<string, LatestSiteCondition | null>>({});
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [hoveredSiteId, setHoveredSiteId] = useState<string | null>(null);
  const [series, setSeries] = useState<DashboardObservationSeriesPoint[]>([]);
  const [search, setSearch] = useState("");
  const [loadingSites, setLoadingSites] = useState(true);
  const [mobileView, setMobileView] = useState<MobileView>("map");
  const [dataSubview, setDataSubview] = useState<DataSubview>("readings");

  const demoMode = process.env.NEXT_PUBLIC_DASHBOARD_DATA_MODE === "demo";
  const productionDataConfigured = useMemo(() => Boolean(
    process.env.NEXT_PUBLIC_ARCGIS_SITES_VIEW_URL &&
    process.env.NEXT_PUBLIC_ARCGIS_OBSERVATIONS_VIEW_URL &&
    process.env.NEXT_PUBLIC_ARCGIS_MEASUREMENTS_VIEW_URL &&
    process.env.NEXT_PUBLIC_ARCGIS_LATEST_CONDITIONS_VIEW_URL
  ), []);
  const [dataError, setDataError] = useState<string | null>(null);
  const [seriesError, setSeriesError] = useState<string | null>(null);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [retry, setRetry] = useState(0);
  const source = useMemo(() => {
    if (demoMode) return mockDashboardDataSource;
    if (!productionDataConfigured) return null;
    try {
      return new ArcgisDashboardDataSource({
        sites: process.env.NEXT_PUBLIC_ARCGIS_SITES_VIEW_URL!,
        observations: process.env.NEXT_PUBLIC_ARCGIS_OBSERVATIONS_VIEW_URL!,
        measurements: process.env.NEXT_PUBLIC_ARCGIS_MEASUREMENTS_VIEW_URL!,
        latest: process.env.NEXT_PUBLIC_ARCGIS_LATEST_CONDITIONS_VIEW_URL!,
      });
    } catch { return null; }
  }, [demoMode, productionDataConfigured]);
  const sourceConnected = Boolean(source) && !dataError && !loadingSites;

  useEffect(() => {
    let cancelled = false;
    setDataError(null);
    if (!source) {
      setLoadingSites(false);
      if (productionDataConfigured) setDataError("The public source configuration is invalid.");
      return;
    }
    setLoadingSites(true);
    void Promise.all([source.listSites(), source.listLatestSiteConditions()]).then(([loadedSites, latest]) => {
      if (cancelled) return;
      if (latest.some((condition) => !loadedSites.some((site) => site.id === condition.siteId))) throw new Error("A latest observation references an unavailable public site.");
      setSites(loadedSites);
      setConditions(Object.fromEntries(latest.map((condition) => [condition.siteId, condition])));
    }).catch((error: unknown) => {
      if (cancelled) return;
      setSites([]); setConditions({}); setSelectedSiteId(null);
      setDataError(error instanceof Error ? error.message : "Monitoring data could not be loaded.");
    }).finally(() => { if (!cancelled) setLoadingSites(false); });
    return () => { cancelled = true; };
  }, [source, productionDataConfigured, retry]);

  const filteredSites = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return sites;
    return sites.filter((site) => [site.name, site.code, site.county, site.watershed, site.siteType].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle)));
  }, [search, sites]);
  const selectedSite = useMemo(() => sites.find((site) => site.id === selectedSiteId) ?? null, [selectedSiteId, sites]);
  const hoveredSite = useMemo(() => sites.find((site) => site.id === hoveredSiteId) ?? null, [hoveredSiteId, sites]);
  const selectedCondition = selectedSiteId ? conditions[selectedSiteId] ?? null : null;

  useEffect(() => {
    setSeries([]); setSeriesError(null);
    if (!source || !selectedSiteId) { setLoadingSeries(false); return; }
    let cancelled = false;
    setLoadingSeries(true);
    void source.getObservationSeries(selectedSiteId, activeParameter).then((points) => {
      if (!cancelled) setSeries(points);
    }).catch((error: unknown) => {
      if (!cancelled) setSeriesError(error instanceof Error ? error.message : "Historical observations could not be loaded.");
    }).finally(() => { if (!cancelled) setLoadingSeries(false); });
    return () => { cancelled = true; };
  }, [activeParameter, source, selectedSiteId, retry]);

  const visibleSeries = useMemo(() => {
    const start = rangeStart(activeRange, series.map((point) => point.observedAt));
    return series.filter((point) => Date.parse(point.observedAt) >= start);
  }, [activeRange, series]);

  const selectSite = useCallback((siteId: string) => {
    setSelectedSiteId(siteId);
    document.getElementById(`site-row-${siteId}`)?.scrollIntoView({ block: "nearest" });
  }, []);

  const handleSelectFromList = useCallback((siteId: string) => {
    selectSite(siteId);
    if (window.matchMedia("(max-width: 960px)").matches) {
      setMobileView("data");
      setDataSubview("readings");
    }
  }, [selectSite]);

  const handleSelectFromMap = useCallback((siteId: string) => {
    selectSite(siteId);
  }, [selectSite]);

  const handleHover = useCallback((siteId: string | null) => setHoveredSiteId(siteId), []);
  const handleExport = useCallback(() => {
    if (!selectedSite || visibleSeries.length === 0) return;
    const definition = parameterDefinitions.find((parameter) => parameter.key === activeParameter)!;
    exportSeriesCsv(selectedSite, definition.label, `${selectedSite.code}-${activeParameter}-${activeRange.replaceAll(" ", "-").toLowerCase()}`, visibleSeries);
  }, [activeParameter, activeRange, selectedSite, visibleSeries]);

  const latestSample = Object.values(conditions).flatMap((condition) => condition ? [condition.observedAt] : []).sort().at(-1);
  const watershedCount = new Set(sites.map((site) => site.watershed).filter(Boolean)).size;

  return (
    <main className="dashboard-shell" data-mobile-view={mobileView} data-source-connected={sourceConnected ? "true" : "false"}>
      <header className="app-bar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">≈</div>
          <div><h1>PA Watershed Watch</h1><p>Watershed Dashboard</p></div>
        </div>
        {sourceConnected ? (
          <div className="kpi-strip" aria-label="Network summary">
            <div className="kpi"><span>Monitoring Sites</span><strong>{sites.length}</strong></div>
            <div className="kpi"><span>Latest Sample</span><strong>{latestSample ? formatShortDate(latestSample) : "—"}</strong></div>
            <div className="kpi"><span>Watersheds</span><strong>{watershedCount}</strong></div>
          </div>
        ) : (
          <div className="source-status" role="status"><span className="source-status-dot" aria-hidden="true" /><span>Monitoring source unavailable</span></div>
        )}
      </header>

      {dataError && <div className="source-error" role="alert"><span>{dataError}</span><button type="button" onClick={() => setRetry((value) => value + 1)}>Retry monitoring data</button></div>}
      {demoMode && <div className="demo-banner" role="status"><strong>DEMO MODE</strong><span>· Synthetic test sites and measurements — not production observations</span></div>}

      <nav className="mobile-view-tabs" aria-label="Dashboard view">
        {(["sites", "map", "data"] as MobileView[]).map((view) => (
          <button key={view} type="button" className={mobileView === view ? "mobile-view-button active" : "mobile-view-button"} aria-pressed={mobileView === view} onClick={() => setMobileView(view)}>
            {view === "sites" ? "Sites" : view === "map" ? "Map" : "Data"}
          </button>
        ))}
      </nav>

      <section className="workspace" data-mobile-view={mobileView} data-data-subview={dataSubview}>
        <nav className="data-subview-tabs" aria-label="Data view section">
          <button type="button" className={dataSubview === "readings" ? "active" : ""} aria-pressed={dataSubview === "readings"} onClick={() => setDataSubview("readings")}>Readings</button>
          <button type="button" className={dataSubview === "series" ? "active" : ""} aria-pressed={dataSubview === "series"} onClick={() => setDataSubview("series")}>Time series</button>
        </nav>

        <SiteBrowser
          sites={sites}
          filteredSites={filteredSites}
          conditions={conditions}
          selectedSiteId={selectedSiteId}
          hoveredSiteId={hoveredSiteId}
          search={search}
          loading={loadingSites}
          productionDataConfigured={Boolean(source) && !dataError}
          onSearch={setSearch}
          onSelect={handleSelectFromList}
          onHover={handleHover}
        />

        <section className="center-column">
          <MapSurface
            sites={sites}
            conditions={conditions}
            selectedSite={selectedSite}
            hoveredSite={hoveredSite}
            onSelectSite={handleSelectFromMap}
            onHoverSite={handleHover}
            demoMode={demoMode}
            hasOperationalLayers={true}
          />
          <ChartPanel
            site={selectedSite}
            loading={loadingSeries}
            error={seriesError}
            onRetry={() => setRetry((value) => value + 1)}
            sourceConnected={sourceConnected}
            activeParameter={activeParameter}
            activeRange={activeRange}
            points={visibleSeries}
            onParameter={setActiveParameter}
            onRange={setActiveRange}
            onExport={handleExport}
          />
        </section>

        <SiteDetail site={selectedSite} condition={selectedCondition} />
      </section>
    </main>
  );
}
