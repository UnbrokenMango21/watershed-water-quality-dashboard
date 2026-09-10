"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DashboardObservationSeriesPoint, DashboardParameter, DashboardSite, LatestSiteCondition } from "@/lib/data/DashboardDataSource";
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
  const [mobileView, setMobileView] = useState<MobileView>("map");
  const [dataSubview, setDataSubview] = useState<DataSubview>("readings");

  const demoMode = process.env.NEXT_PUBLIC_DASHBOARD_DATA_MODE === "demo";
  const productionDataConfigured = useMemo(() => Boolean(
    process.env.NEXT_PUBLIC_ARCGIS_SITES_VIEW_URL &&
    process.env.NEXT_PUBLIC_ARCGIS_OBSERVATIONS_VIEW_URL &&
    process.env.NEXT_PUBLIC_ARCGIS_MEASUREMENTS_VIEW_URL &&
    process.env.NEXT_PUBLIC_ARCGIS_LATEST_CONDITIONS_VIEW_URL
  ), []);
  const sourceConnected = demoMode || productionDataConfigured;

  useEffect(() => {
    let cancelled = false;
    if (!demoMode) {
      setLoadingSites(false);
      return;
    }
    setLoadingSites(true);
    void (async () => {
      const loadedSites = await mockDashboardDataSource.listSites();
      const entries = await Promise.all(loadedSites.map(async (site) => [site.id, await mockDashboardDataSource.getLatestSiteCondition(site.id)] as const));
      if (cancelled) return;
      setSites(loadedSites);
      setConditions(Object.fromEntries(entries));
      // Intentionally begin with no selection. This keeps no-selection distinct
      // from site-selected/no-measurement and prevents misleading active controls.
      setLoadingSites(false);
    })();
    return () => { cancelled = true; };
  }, [demoMode]);

  const filteredSites = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return sites;
    return sites.filter((site) => [site.name, site.code, site.county, site.watershed, site.siteType].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle)));
  }, [search, sites]);
  const selectedSite = useMemo(() => sites.find((site) => site.id === selectedSiteId) ?? null, [selectedSiteId, sites]);
  const hoveredSite = useMemo(() => sites.find((site) => site.id === hoveredSiteId) ?? null, [hoveredSiteId, sites]);
  const selectedCondition = selectedSiteId ? conditions[selectedSiteId] ?? null : null;

  useEffect(() => {
    if (!demoMode || !selectedSiteId) {
      setSeries([]);
      return;
    }
    let cancelled = false;
    void mockDashboardDataSource.getObservationSeries(selectedSiteId, activeParameter).then((points) => {
      if (!cancelled) setSeries(points);
    });
    return () => { cancelled = true; };
  }, [activeParameter, demoMode, selectedSiteId]);

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

  return (
    <main className="dashboard-shell" data-mobile-view={mobileView} data-source-connected={sourceConnected ? "true" : "false"}>
      <header className="app-bar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">≈</div>
          <div><h1>Central PA Watershed</h1><p>Water Quality Monitoring Dashboard</p></div>
        </div>
        {sourceConnected ? (
          <div className="kpi-strip" aria-label="Network summary">
            <div className="kpi"><span>Active Sites</span><strong>{demoMode ? demoNetworkSummary.activeSites : sites.length || "—"}</strong></div>
            <div className="kpi"><span>Latest Update</span><strong>{demoMode ? formatShortDate(demoNetworkSummary.latestUpdate) : "—"}</strong></div>
            <div className="kpi"><span>Streams Monitored</span><strong>{demoMode ? demoNetworkSummary.streamsMonitored : "—"}</strong></div>
          </div>
        ) : (
          <div className="source-status" role="status"><span className="source-status-dot" aria-hidden="true" /><span>Monitoring source unavailable</span></div>
        )}
      </header>

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
          productionDataConfigured={productionDataConfigured}
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
