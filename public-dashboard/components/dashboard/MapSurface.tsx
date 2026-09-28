"use client";

import { useEffect, useState } from "react";
import type { DashboardParameter, DashboardSite, LatestSiteCondition } from "@/lib/data/DashboardDataSource";
import { CalciteIcon, formatDateTime, parameterDefinitions, type MapTool } from "./dashboard-utils";
import { initialMapLayerState, useDashboardMap, type MapBackground, type MapLayerState } from "./useDashboardMap";

const toolLabels: Record<Exclude<MapTool, null>, string> = {
  layers: "Layers",
  legend: "Map key",
  basemap: "Background",
};
const toolIcons: Record<Exclude<MapTool, null>, string> = { layers: "layers", legend: "legend", basemap: "basemap" };
const tools = Object.keys(toolLabels) as Exclude<MapTool, null>[];

const backgrounds: Array<{ key: MapBackground; label: string; note: string }> = [
  { key: "terrain", label: "Terrain", note: "Quiet shaded relief" },
  { key: "topographic", label: "Topographic", note: "Roads, towns and contours" },
  { key: "imagery", label: "Imagery", note: "Aerial and satellite photos" },
];

export function MapSurface({
  sites,
  conditions,
  selectedSite,
  hoveredSite,
  activeParameter,
  onSelectSite,
  onHoverSite,
}: {
  sites: DashboardSite[];
  conditions: Record<string, LatestSiteCondition | null>;
  selectedSite: DashboardSite | null;
  hoveredSite: DashboardSite | null;
  activeParameter: DashboardParameter;
  onSelectSite: (siteId: string) => void;
  onHoverSite: (siteId: string | null) => void;
}) {
  const [activeMapTool, setActiveMapTool] = useState<MapTool>(null);
  const [layerState, setLayerState] = useState<MapLayerState>(initialMapLayerState);
  const { mapHost, hoverPoint } = useDashboardMap({ sites, conditions, selectedSite, hoveredSite, layerState, onSelectSite, onHoverSite });
  const setLayer = (patch: Partial<MapLayerState>) => setLayerState((current) => ({ ...current, ...patch }));

  useEffect(() => {
    if (!activeMapTool) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setActiveMapTool(null); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [activeMapTool]);

  const tooltipSite = hoverPoint ? sites.find((site) => site.id === hoverPoint.siteId) ?? null : null;

  return (
    <div className="map-frame">
      <div ref={mapHost} className="map-host" />

      {hoverPoint && tooltipSite && (
        <SiteTooltip x={hoverPoint.x} y={hoverPoint.y} flip={hoverPoint.x > (mapHost.current?.clientWidth ?? 0) - 300} site={tooltipSite} condition={conditions[tooltipSite.id] ?? null} parameter={activeParameter} />
      )}

      <div className="map-tool-rail" aria-label="Map tools">
        {tools.map((tool) => (
          <button
            key={tool}
            type="button"
            className={activeMapTool === tool ? "map-tool-button active" : "map-tool-button"}
            aria-label={toolLabels[tool]}
            aria-pressed={activeMapTool === tool}
            data-tooltip={toolLabels[tool]}
            data-map-tool={tool}
            onClick={() => setActiveMapTool((current) => current === tool ? null : tool)}
          >
            <CalciteIcon icon={toolIcons[tool]} label={toolLabels[tool]} />
          </button>
        ))}
      </div>

      {activeMapTool && (
        <section className="map-tool-panel" aria-label={toolLabels[activeMapTool]} data-map-panel={activeMapTool}>
          <header>
            <strong>{toolLabels[activeMapTool]}</strong>
            <button type="button" aria-label={`Close ${toolLabels[activeMapTool]}`} onClick={() => setActiveMapTool(null)}>
              <CalciteIcon icon="x" label="Close" />
            </button>
          </header>
          <div className="map-tool-panel-body">
            {activeMapTool === "layers" && <LayersPanel state={layerState} onChange={setLayer} />}
            {activeMapTool === "legend" && <MapKey />}
            {activeMapTool === "basemap" && (
              <div className="map-choice-list" role="radiogroup" aria-label="Map background">
                {backgrounds.map((option) => (
                  <label key={option.key} className={layerState.background === option.key ? "map-choice selected" : "map-choice"}>
                    <input type="radio" name="map-background" checked={layerState.background === option.key} onChange={() => setLayer({ background: option.key })} />
                    <span className={`map-choice-swatch swatch-${option.key}`} aria-hidden="true" />
                    <span><strong>{option.label}</strong><small>{option.note}</small></span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function LayersPanel({ state, onChange }: { state: MapLayerState; onChange: (patch: Partial<MapLayerState>) => void }) {
  const rows: Array<{ key: "sites" | "streams" | "watersheds" | "places"; label: string; note: string }> = [
    { key: "sites", label: "Monitoring sites", note: "Where reviewed samples are collected" },
    { key: "streams", label: "Streams and rivers", note: "Mapped surface water" },
    { key: "watersheds", label: "Watershed boundaries", note: "Appear as you zoom in: larger watersheds first, then local ones" },
    { key: "places", label: "Place names", note: "Towns, roads and landmarks" },
  ];
  return (
    <div className="map-layer-list">
      {rows.map((row) => (
        <div key={row.key} className="map-layer-row">
          <label className="map-layer-toggle">
            <input type="checkbox" checked={state[row.key]} onChange={(event) => onChange({ [row.key]: event.target.checked })} />
            <span className={`map-layer-swatch layer-${row.key}`} aria-hidden="true" />
            <span><strong>{row.label}</strong><small>{row.note}</small></span>
          </label>
          {row.key === "streams" && (
            <label className="map-layer-opacity">
              <span>Strength</span>
              <input
                type="range"
                min={0.2}
                max={1}
                step={0.05}
                value={state.streamsOpacity}
                disabled={!state.streams}
                aria-label="Streams and rivers strength"
                onChange={(event) => onChange({ streamsOpacity: Number(event.target.value) })}
              />
            </label>
          )}
          {row.key === "places" && state.background === "topographic" && (
            <p className="map-layer-hint">The topographic background already includes place names.</p>
          )}
        </div>
      ))}
    </div>
  );
}

function MapKey() {
  return (
    <ul className="map-key">
      <li><span className="key-site" aria-hidden="true" />Monitoring site with a reviewed sample</li>
      <li><span className="key-site empty" aria-hidden="true" />Monitoring site, no reviewed sample yet</li>
      <li><span className="key-selected" aria-hidden="true" />Selected site</li>
      <li><span className="key-watershed-selected" aria-hidden="true" />Watershed of the selected site</li>
      <li><span className="key-watershed" aria-hidden="true" />Watershed boundary (USGS)</li>
      <li><span className="key-stream" aria-hidden="true" />Streams and rivers</li>
      <li className="map-key-note">Only reviewed, public-safe observations appear on this map.</li>
    </ul>
  );
}

function SiteTooltip({ x, y, flip, site, condition, parameter }: {
  x: number;
  y: number;
  flip: boolean;
  site: DashboardSite;
  condition: LatestSiteCondition | null;
  parameter: DashboardParameter;
}) {
  const definition = parameterDefinitions.find((item) => item.key === parameter);
  const reading = condition?.measurements.find((measurement) => measurement.parameter === parameter);
  return (
    <div className={flip ? "map-site-tooltip flip" : "map-site-tooltip"} role="status" style={{ left: x, top: y }}>
      <strong>{site.name}</strong>
      {site.watershed && <span>{site.watershed}</span>}
      {condition ? (
        <>
          <span>Latest sample {formatDateTime(condition.observedAt)}</span>
          {definition && (
            <span className="map-site-tooltip-reading">
              {definition.label}: {reading ? `${reading.value.toFixed(definition.decimals)}${reading.unit === "pH" ? "" : ` ${reading.unit}`}` : "Not recorded"}
            </span>
          )}
        </>
      ) : (
        <span>No reviewed sample yet</span>
      )}
    </div>
  );
}
