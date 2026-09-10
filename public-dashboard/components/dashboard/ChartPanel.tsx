"use client";

import type { DashboardObservationSeriesPoint, DashboardParameter, DashboardSite } from "@/lib/data/DashboardDataSource";
import { CalciteIcon, parameterDefinitions, ranges, type RangeName } from "./dashboard-utils";
import { TrendChart } from "./TrendChart";

export function ChartPanel({ site, sourceConnected, activeParameter, activeRange, points, onParameter, onRange, onExport }: {
  site: DashboardSite | null;
  sourceConnected: boolean;
  activeParameter: DashboardParameter;
  activeRange: RangeName;
  points: DashboardObservationSeriesPoint[];
  onParameter: (parameter: DashboardParameter) => void;
  onRange: (range: RangeName) => void;
  onExport: () => void;
}) {
  const definition = parameterDefinitions.find((parameter) => parameter.key === activeParameter)!;

  if (!site) {
    return (
      <section className="trend-panel trend-panel-context-empty" aria-labelledby="trend-heading">
        <div className="trend-toolbar compact-context-toolbar">
          <div className="trend-title-block">
            <span className="eyebrow">Scientific time series</span>
            <div className="trend-title-line"><h2 id="trend-heading">Time series</h2></div>
          </div>
        </div>
        <div className="chart-context-empty" role="status">
          <CalciteIcon icon={sourceConnected ? "cursor-click" : "offline"} label="Time-series state" />
          <strong>{sourceConnected ? "Select a monitoring site" : "Monitoring data unavailable"}</strong>
          <span>{sourceConnected ? "Choose a site from the browser or map to view sampled observations." : "Approved monitoring sources have not been connected yet."}</span>
        </div>
      </section>
    );
  }

  return (
    <section className="trend-panel" aria-labelledby="trend-heading">
      <div className="trend-toolbar">
        <div className="trend-title-block">
          <span className="eyebrow">Scientific time series</span>
          <div className="trend-title-line"><h2 id="trend-heading">{definition.label}</h2><span className="trend-site-name">{site.name}</span></div>
        </div>
        <div className="chart-actions">
          <div className="range-controls" aria-label="Time range">
            {ranges.map((range) => (
              <button key={range} type="button" className={range === activeRange ? "range-button active" : "range-button"} aria-pressed={range === activeRange} onClick={() => onRange(range)}>{range}</button>
            ))}
          </div>
          {points.length > 0 && <button type="button" className="export-button" onClick={onExport}><CalciteIcon icon="download" label="Export CSV" /><span>CSV</span></button>}
        </div>
      </div>

      <label className="parameter-select-wrap">
        <span>Parameter</span>
        <select aria-label="Water quality parameter" value={activeParameter} onChange={(event) => onParameter(event.target.value as DashboardParameter)}>
          {parameterDefinitions.map((parameter) => <option key={parameter.key} value={parameter.key}>{parameter.label}</option>)}
        </select>
      </label>

      <div className="parameter-tabs" role="tablist" aria-label="Water quality parameter">
        {parameterDefinitions.map((parameter) => (
          <button key={parameter.key} role="tab" aria-selected={parameter.key === activeParameter} type="button" className={parameter.key === activeParameter ? "parameter-tab active" : "parameter-tab"} onClick={() => onParameter(parameter.key)}>
            <span className="parameter-tab-glyph" aria-hidden="true">{parameter.glyph}</span><span>{parameter.shortLabel}</span>
          </button>
        ))}
      </div>

      <TrendChart points={points} label={definition.label} decimals={definition.decimals} />
    </section>
  );
}
