"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DashboardDataSource, DashboardObservationSeriesPoint, DashboardParameter, DashboardSite, LatestSiteCondition } from "@/lib/data/DashboardDataSource";
import { ArcgisDashboardDataSource } from "@/lib/data/ArcgisDashboardDataSource";
import { demoNetworkSummary, mockDashboardDataSource } from "@/lib/data/MockDashboardDataSource";
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
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>("map");
  const [dataSubview, setDataSubview] = useState<DataSubview>("readings");

  const demoMode = process.env.NEXT_PUBLIC_DASHBOARD_DATA_MODE === "demo";
  const productionConfig = useMemo(() => {
    const sitesViewUrl = process.env.NEXT_PUBLIC_ARCGIS_SITES_VIEW_URL;
    const observationsViewUrl = process.env.NEXT_PUBLIC_ARCGIS_OBSERVATIONS_VIEW_URL;
    const measurementsViewUrl = process.env.NEXT_PUBLIC_ARCGIS_MEASUREMENTS_VIEW_URL;
    const latestConditionsViewUrl = process.env.NEXT_PUBLIC_ARCGIS_LATEST_CONDITIONS_VIEW_URL;
    return sitesViewUrl && observationsViewUrl && measurementsViewUrl && latestConditionsViewUrl
      ? { sitesViewUrl, observationsViewUrl, measurementsViewUrl, latestConditionsViewUrl }
      : null;
  }, []);
  const productionDataConfigured = Boolean(productionConfig);
  const dataSource = useMemo<DashboardDataSource | null>(() => {
    if (demoMode) return mockDashboardDataSource;
    return productionConfig ? new ArcgisDashboardDataSource(productionConfig) : null;
  }, [demoMode, productionConfig]);
  const sourceConnected = Boolean(dataSource) && !sourceError;

  useEffect(() => {
    let cancelled = false;
    setSourceError(null);
    setSites([]);
    setConditions({});
    setSeries([]);
    setSelectedSiteId(null);
    if (!dataSource) {
      setLoadingSites(false);
      return;
    }
    setLoadingSites(true);
    void (async () => {
      try {
        const loadedSites = await dataSource.listSites();
        const entries = await Promise.all(loadedSites.map(async (site) => [site.id, await dataSource.getLatestSiteCondition(site.id)] as const));
        if (cancelled) return;
        setSites(loadedSites);
        setConditions(Object.fromEntries(entries));
      } catch (error) {
        if (cancelled) return;
        setSourceError(error instanceof Error ? error.message : "Approved monitoring data could not be loaded.");
      } finally {
        if (!cancelled) setLoadingSites(false);
      }
    })();
    return () => { cancelled = true; };
  }, [dataSource]);

  const filteredSites = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return sites;
    return sites.filter((site) => [site.name, site.code, site.county, site.watershed, site.siteType].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle)));
  }, [search, sites]);
  const selectedSite = useMemo(() => sites.find((site) => site.id === selectedSiteId) ?? null, [selectedSiteId, sites]);
  const hoveredSite = useMemo(() => sites.find((site) => site.id === hoveredSiteId) ?? null, [hoveredSiteId, sites]);
  const selectedCondition = selectedSiteId ? conditions[selectedSiteId] ?? null : null;

  useEffect(() => {
    if (!dataSource || !selectedSiteId) {
      setSeries([]);
      return;
    }
    let cancelled = false;
    setSourceError(null);
    void dataSource.getObservationSeries(selectedSiteId, activeParameter).then((points) => {
      if (!cancelled) setSeries(points);
    }).catch((error) => {
      if (!cancelled) {
        setSeries([]);
        setSourceError(error instanceof Error ? error.message : "Historical monitoring data could not be loaded.");
      }
    });
    return () => { cancelled = true; };
  }, [activeParameter, dataSource, selectedSiteId]);

  const visibleSeries = useMemo(() => {
    const start = rangeStart(activeRange, series.map((point) => point.observedAt));
    return series.filter((point) => Date.parse(point.observedAt) >= start);
  }, [activeRange, series]);

  const liveSummary = useMemo(() => {
    const available = Object.values(conditions).filter((condition): condition is LatestSiteCondition => Boolean(condition));
    const latest = available.map((condition) => condition.observedAt).filter(Boolean).sort((a, b) => Date.parse(b) - Date.parse(a))[0];
    return {
      activeSites: available.length,
      latestUpdate: latest,
      streamsMonitored: new Set(sites.map((site) => site.watershed).filter(Boolean)).size,
    };
  }, [conditions, sites]);

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
  const handleSelectFromMap = useCallback((siteId: string) => selectSite(siteId), [selectSite]);
  const handleHover = useCallback((siteId: string | null) => setHoveredSiteId(siteId), []);
  const handleExport = useCallback(() => {
    if (!selectedSite || visibleSeries.length === 0) return;
    const definition = parameterDefinitions.find((parameter) => parameter.key === activeParameter)!;
    exportSeriesCsv(selectedSite, definition.label, `${selectedSite.code}-${activeParameter}-${activeRange.replaceAll(" ", "-").toLowerCase()}`, visibleSeries);
  }, [activeParameter, activeRange, selectedSite, visibleSeries]);

  return (
    <main className="dashboard-shell" data-mobile-view={mobileView} data-source-connected={sourceConnected ? "true" : "false"}>
      <header className="app-bar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">≈</div>
          <div><h1>PA Watershed Watch</h1><p>Watershed Dashboard</p></div>
        </div>
        {dataSource ? (
          <div className="kpi-strip" aria-label="Network summary">
            <div className="kpi"><span>Active Sites</span><strong>{demoMode ? demoNetworkSummary.activeSites : loadingSites ? "—" : liveSummary.activeSites}</strong></div>
            <div className="kpi"><span>Latest Sample</span><strong>{demoMode ? formatShortDate(demoNetworkSummary.latestUpdate) : liveSummary.latestUpdate ? formatShortDate(liveSummary.latestUpdate) : "—"}</strong></div>
            <div className="kpi"><span>Streams Monitored</span><strong>{demoMode ? demoNetworkSummary.streamsMonitored : loadingSites ? "—" : liveSummary.streamsMonitored}</strong></div>
          </div>
        ) : (
          <div className="source-status" role="status"><span className="source-status-dot" aria-hidden="true" /><span>Monitoring source unavailable</span></div>
        )}
      </header>

      {demoMode && <div className="demo-banner" role="status"><strong>DEMO MODE</strong><span>· Synthetic test sites and measurements — not production observations</span></div>}
      {sourceError && <div className="source-error-banner" role="alert"><strong>Monitoring data unavailable.</strong><span>{sourceError}</span></div>}

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

        <SiteBrowser sites={sites} filteredSites={filteredSites} conditions={conditions} selectedSiteId={selectedSiteId} hoveredSiteId={hoveredSiteId} search={search} loading={loadingSites} productionDataConfigured={sourceConnected} onSearch={setSearch} onSelect={handleSelectFromList} onHover={handleHover} />

        <section className="center-column">
          <MapSurface sites={sites} conditions={conditions} selectedSite={selectedSite} hoveredSite={hoveredSite} onSelectSite={handleSelectFromMap} onHoverSite={handleHover} demoMode={demoMode} hasOperationalLayers={true} />
          <ChartPanel site={selectedSite} sourceConnected={sourceConnected} activeParameter={activeParameter} activeRange={activeRange} points={visibleSeries} onParameter={setActiveParameter} onRange={setActiveRange} onExport={handleExport} />
        </section>

        <SiteDetail site={selectedSite} condition={selectedCondition} />
      </section>
    </main>
  );
}
