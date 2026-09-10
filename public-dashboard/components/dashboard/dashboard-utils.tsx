import { createElement } from "react";
import type { DashboardParameter, LatestSiteCondition } from "@/lib/data/DashboardDataSource";

export const parameterDefinitions: Array<{
  key: DashboardParameter;
  label: string;
  shortLabel: string;
  glyph: string;
  decimals: number;
}> = [
  { key: "waterTemperature", label: "Water Temperature", shortLabel: "Temperature", glyph: "°C", decimals: 1 },
  { key: "ph", label: "pH", shortLabel: "pH", glyph: "pH", decimals: 2 },
  { key: "dissolvedOxygen", label: "Dissolved Oxygen", shortLabel: "Dissolved Oxygen", glyph: "O₂", decimals: 1 },
  { key: "specificConductivity", label: "Specific Conductivity", shortLabel: "Conductivity", glyph: "µS", decimals: 0 },
  { key: "nitrate", label: "Nitrate", shortLabel: "Nitrate", glyph: "NO₃", decimals: 2 },
];

export const ranges = ["7D", "30D", "90D", "1Y", "Full record"] as const;
export type RangeName = (typeof ranges)[number];
export type MapTool = "layers" | "legend" | "basemap" | "measure" | null;
export type MobileView = "sites" | "map" | "data";

export function CalciteIcon({ icon, label, scale = "s" }: { icon: string; label?: string; scale?: "s" | "m" | "l" }) {
  return createElement("calcite-icon", {
    icon,
    scale,
    ...(label ? { "text-label": label } : { "aria-hidden": "true" }),
  });
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatShortDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(iso));
}

export function rangeStart(range: RangeName, timestamps: string[]) {
  if (range === "Full record" || timestamps.length === 0) return Number.NEGATIVE_INFINITY;
  const latest = Math.max(...timestamps.map((iso) => Date.parse(iso)));
  const days = range === "7D" ? 7 : range === "30D" ? 30 : range === "90D" ? 90 : 365;
  return latest - days * 24 * 60 * 60 * 1000;
}

export function completenessFor(condition: LatestSiteCondition | null | undefined) {
  if (!condition) return "missing" as const;
  const primaryCount = condition.measurements.filter((measurement) =>
    parameterDefinitions.some((parameter) => parameter.key === measurement.parameter),
  ).length;
  return primaryCount >= parameterDefinitions.length ? "complete" as const : "partial" as const;
}

export function completenessLabel(completeness: "complete" | "partial" | "missing") {
  return completeness === "complete" ? "Complete" : completeness === "partial" ? "Partial" : "No sample";
}
