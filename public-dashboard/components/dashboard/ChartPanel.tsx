"use client";
import type { DashboardObservationSeriesPoint, DashboardParameter, DashboardSite } from "@/lib/data/DashboardDataSource";
import { CalciteIcon, parameterDefinitions, ranges, type RangeName } from "./dashboard-utils";
import { TrendChart } from "./TrendChart";

export function ChartPanel({ site, activeParameter, activeRange, points, onParameter, onRange, onExport }: {
  site: DashboardSite | null; activeParameter: DashboardParameter; activeRange: RangeName; points: DashboardObservationSeriesPoint[];
  onParameter: (parameter: DashboardParameter) => void; onRange: (range: RangeName) => void; onExport: () => void;
}) {
  const d = parameterDefinitions.find((parameter) => parameter.key === activeParameter)!;
  return <section className="trend-panel" aria-labelledby="trend-heading">
    <div className="trend-toolbar">
      <div className="trend-title-block"><span className="eyebrow">Scientific time series</span><div className="trend-title-line"><h2 id="trend-heading">{d.label}</h2>{site && <span className="trend-site-name">{site.name}</span>}</div></div>
      <div className="chart-actions"><div className="range-controls" aria-label="Time range">{ranges.map((range) => <button key={range} type="button" className={range === activeRange ? "range-button active" : "range-button"} aria-pressed={range === activeRange} onClick={() => onRange(range)}>{range}</button>)}</div>{site && points.length > 0 && <button type="button" className="export-button" onClick={onExport}><CalciteIcon icon="download" label="Export CSV" /><span>CSV</span></button>}</div>
    </div>
    <div className="parameter-tabs" role="tablist" aria-label="Water quality parameter">{parameterDefinitions.map((p) => <button key={p.key} role="tab" aria-selected={p.key === activeParameter} type="button" className={p.key === activeParameter ? "parameter-tab active" : "parameter-tab"} onClick={() => onParameter(p.key)}><span className="parameter-tab-glyph" aria-hidden="true">{p.glyph}</span><span>{p.shortLabel}</span></button>)}</div>
    {site ? <TrendChart points={points} label={d.label} decimals={d.decimals} /> : <div className="chart-empty" role="status"><div className="chart-grid" aria-hidden="true" /><div className="chart-empty-copy"><strong>Select a monitoring site</strong><span>Sampled observations will appear here.</span></div></div>}
  </section>;
}
