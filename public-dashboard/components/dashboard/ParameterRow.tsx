import type { DashboardMeasurement } from "@/lib/data/DashboardDataSource";

export function ParameterRow({
  label,
  glyph,
  decimals,
  current,
  previous,
}: {
  label: string;
  glyph: string;
  decimals: number;
  current?: DashboardMeasurement;
  previous?: DashboardMeasurement;
}) {
  const delta = current && previous ? current.value - previous.value : null;
  const deltaText = delta === null ? "" : `${delta > 0 ? "↑" : delta < 0 ? "↓" : "→"} ${Math.abs(delta).toFixed(decimals)}`;
  const deltaLabel = delta === null
    ? "No previous measurement available"
    : `${delta > 0 ? "Increased" : delta < 0 ? "Decreased" : "Unchanged"} by ${Math.abs(delta).toFixed(decimals)} ${current?.unit ?? ""} from the previous measurement`;

  return (
    <div className={current ? "metric-row" : "metric-row missing"}>
      <div className="metric-glyph" aria-hidden="true">{glyph}</div>
      <div className="metric-name">{label}</div>
      <div className="metric-value">
        {current ? <>{current.value.toFixed(decimals)} <span>{current.unit === "pH" ? "" : current.unit}</span></> : <span className="metric-missing-value">—</span>}
      </div>
      <div className="metric-delta" aria-label={deltaLabel}>{deltaText}</div>
    </div>
  );
}
