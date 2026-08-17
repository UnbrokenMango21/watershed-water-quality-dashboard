"use client";

import { createElement, useState } from "react";
import type { DashboardSite, LatestSiteCondition } from "@/lib/data/DashboardDataSource";
import { CalciteIcon, type MapTool } from "./dashboard-utils";
import { useDashboardMap } from "./useDashboardMap";

const toolLabels: Record<Exclude<MapTool, null>, string> = {
  layers: "Layers",
  legend: "Legend",
  basemap: "Basemap",
  measure: "Measure distance",
};

export function MapSurface({
  sites,
  conditions,
  selectedSite,
  hoveredSite,
  onSelectSite,
  onHoverSite,
  demoMode,
}: {
  sites: DashboardSite[];
  conditions: Record<string, LatestSiteCondition | null>;
  selectedSite: DashboardSite | null;
  hoveredSite: DashboardSite | null;
  onSelectSite: (siteId: string) => void;
  onHoverSite: (siteId: string | null) => void;
  demoMode: boolean;
}) {
  const [activeMapTool, setActiveMapTool] = useState<MapTool>(null);
  const mapHost = useDashboardMap({ sites, conditions, selectedSite, hoveredSite, onSelectSite, onHoverSite, demoMode });

  return (
    <div className="map-frame">
      <div ref={mapHost} className="map-host" />

      <div className="map-tool-rail" aria-label="Map tools">
        {(["layers", "legend", "basemap", "measure"] as Exclude<MapTool, null>[]).map((tool) => (
          <button
            key={tool}
            type="button"
            className={activeMapTool === tool ? "map-tool-button active" : "map-tool-button"}
            aria-label={toolLabels[tool]}
            aria-pressed={activeMapTool === tool}
            data-tooltip={toolLabels[tool]}
            onClick={() => setActiveMapTool((current) => current === tool ? null : tool)}
          >
            <CalciteIcon
              icon={tool === "layers" ? "layers" : tool === "legend" ? "legend" : tool === "basemap" ? "basemap" : "measure-line"}
              label={toolLabels[tool]}
            />
          </button>
        ))}
      </div>

      {activeMapTool && (
        <section className="map-tool-panel" aria-label={`${toolLabels[activeMapTool]} map tool`}>
          <header>
            <strong>{toolLabels[activeMapTool]}</strong>
            <button type="button" aria-label={`Close ${toolLabels[activeMapTool]}`} onClick={() => setActiveMapTool(null)}>
              <CalciteIcon icon="x" label="Close" />
            </button>
          </header>
          <div className="map-tool-panel-body">
            {activeMapTool === "layers" && createElement("arcgis-layer-list", { "reference-element": "watershed-map" })}
            {activeMapTool === "legend" && createElement("arcgis-legend", { "reference-element": "watershed-map" })}
            {activeMapTool === "basemap" && createElement("arcgis-basemap-gallery", { "reference-element": "watershed-map" })}
            {activeMapTool === "measure" && createElement("arcgis-distance-measurement-2d", { "reference-element": "watershed-map", unit: "metric" })}
          </div>
        </section>
      )}
    </div>
  );
}
