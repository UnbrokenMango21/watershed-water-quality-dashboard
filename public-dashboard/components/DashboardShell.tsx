"use client";

import { createElement, useEffect, useMemo, useRef, useState } from "react";

const parameterLabels = [
  "Water Temperature",
  "pH",
  "Dissolved Oxygen",
  "Specific Conductivity",
  "Nitrate",
] as const;

const ranges = ["7D", "30D", "90D", "1Y", "Full record"] as const;

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

export function DashboardShell() {
  const mapHost = useRef<HTMLDivElement>(null);
  const [activeRange, setActiveRange] = useState<(typeof ranges)[number]>("30D");
  const [activeParameter, setActiveParameter] = useState<(typeof parameterLabels)[number]>("Water Temperature");

  const productionDataConfigured = useMemo(
    () =>
      Boolean(process.env.NEXT_PUBLIC_ARCGIS_SITES_VIEW_URL) &&
      Boolean(process.env.NEXT_PUBLIC_ARCGIS_OBSERVATIONS_VIEW_URL) &&
      Boolean(process.env.NEXT_PUBLIC_ARCGIS_MEASUREMENTS_VIEW_URL) &&
      Boolean(process.env.NEXT_PUBLIC_ARCGIS_LATEST_CONDITIONS_VIEW_URL),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const host = mapHost.current;
    if (!host) return;

    async function initializeBrowserComponents() {
      await Promise.all([
        import("@arcgis/map-components/components/arcgis-home"),
        import("@arcgis/map-components/components/arcgis-layer-list"),
        import("@arcgis/map-components/components/arcgis-map"),
        import("@arcgis/map-components/components/arcgis-zoom"),
        import("@esri/calcite-components/components/calcite-button"),
        import("@esri/calcite-components/components/calcite-input-text"),
      ]);

      if (cancelled || !mapHost.current) return;

      const map = document.createElement("arcgis-map");
      map.setAttribute("basemap", "topo-vector");
      map.setAttribute("center", "-77.85,40.9");
      map.setAttribute("zoom", "7");
      map.className = "map-element";
      map.setAttribute("aria-label", "Central Pennsylvania watershed monitoring map");

      const zoom = document.createElement("arcgis-zoom");
      zoom.setAttribute("position", "top-left");
      const home = document.createElement("arcgis-home");
      home.setAttribute("position", "top-left");
      const layers = document.createElement("arcgis-layer-list");
      layers.setAttribute("position", "top-right");

      map.append(zoom, home, layers);
      mapHost.current.replaceChildren(map);
    }

    void initializeBrowserComponents();

    return () => {
      cancelled = true;
      host.replaceChildren();
    };
  }, []);

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
          <div className="kpi"><span>Active Sites</span><strong>—</strong></div>
          <div className="kpi"><span>Latest Update</span><strong>—</strong></div>
          <div className="kpi"><span>Streams Monitored</span><strong>—</strong></div>
        </div>

        <nav className="app-actions" aria-label="Dashboard actions">
          {calciteButton("Date range", "calendar")}
          {calciteButton("Layers", "layers")}
          {calciteButton("Export", "download")}
          {calciteButton("Help", "question")}
        </nav>
      </header>

      <section className="workspace">
        <aside className="site-browser" aria-label="Monitoring sites">
          <div className="panel-heading">
            <div>
              <h2>Monitoring Sites</h2>
              <span className="site-count">— sites</span>
            </div>
          </div>
          <div className="site-search">
            {createElement("calcite-input-text", {
              placeholder: "Search sites",
              scale: "m",
              clearable: true,
              disabled: !productionDataConfigured,
              label: "Search monitoring sites",
            })}
          </div>
          <div className="empty-panel compact">
            <strong>No production site data connected</strong>
            <span>Approved public ArcGIS views will populate this browser.</span>
          </div>
        </aside>

        <section className="center-column">
          <div className="map-frame">
            <div ref={mapHost} className="map-host" />
            {!productionDataConfigured && (
              <div className="map-status" role="status">
                <strong>Basemap ready</strong>
                <span>Monitoring and watershed layers are intentionally withheld until approved production sources are configured.</span>
              </div>
            )}
          </div>

          <section className="trend-panel" aria-labelledby="trend-heading">
            <div className="trend-toolbar">
              <div>
                <span className="eyebrow">Scientific time series</span>
                <h2 id="trend-heading">{activeParameter}</h2>
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
              {parameterLabels.map((parameter) => (
                <button
                  key={parameter}
                  role="tab"
                  aria-selected={parameter === activeParameter}
                  type="button"
                  className={parameter === activeParameter ? "parameter-tab active" : "parameter-tab"}
                  onClick={() => setActiveParameter(parameter)}
                >
                  {parameter}
                </button>
              ))}
            </div>
            <div className="chart-empty" role="status">
              <div className="chart-grid" aria-hidden="true" />
              <div className="chart-empty-copy">
                <strong>No approved observations available</strong>
                <span>The chart will render actual approved measurements only; no values are interpolated or invented.</span>
              </div>
            </div>
          </section>
        </section>

        <aside className="site-detail" aria-label="Selected site details">
          <div className="detail-heading">
            <div className="trust-dot" aria-hidden="true" />
            <div>
              <span className="eyebrow">Selected site</span>
              <h2>No site selected</h2>
              <p>Choose a monitoring site from the map or site browser.</p>
            </div>
          </div>

          <div className="trust-banner">
            <span>Approved observation</span>
            <strong>Quality reviewed</strong>
          </div>

          <section className="metrics" aria-label="Latest readings">
            <h3>Latest approved reading</h3>
            {parameterLabels.map((parameter) => (
              <div className="metric-row" key={parameter}>
                <div className="metric-icon" aria-hidden="true" />
                <div className="metric-name">{parameter}</div>
                <div className="metric-value">—</div>
                <div className="metric-delta" aria-label="No previous approved measurement">—</div>
              </div>
            ))}
          </section>

          <div className="detail-note">
            Trend arrows will represent numeric change from the previous approved measurement, never a health or safety classification.
          </div>
        </aside>
      </section>
    </main>
  );
}
