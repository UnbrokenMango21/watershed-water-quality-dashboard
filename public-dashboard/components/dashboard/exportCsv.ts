import type { DashboardObservationSeriesPoint, DashboardSite } from "@/lib/data/DashboardDataSource";

export function exportSeriesCsv(site: DashboardSite, parameterLabel: string, fileStem: string, points: DashboardObservationSeriesPoint[]) {
  const rows = [["site_id", "site_name", "parameter", "observed_at", "value", "unit"], ...points.map((point) => [site.code, site.name, parameterLabel, point.observedAt, String(point.value), point.unit])];
  const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${fileStem}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
