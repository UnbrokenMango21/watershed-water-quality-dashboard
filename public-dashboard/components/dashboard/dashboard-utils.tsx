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
  { key: "nitrate", label: "Nitrate (as N)", shortLabel: "Nitrate", glyph: "N", decimals: 2 },
  { key: "dissolvedOxygenSaturation", label: "Dissolved Oxygen Saturation", shortLabel: "DO saturation", glyph: "%", decimals: 1 },
  { key: "totalDissolvedSolids", label: "Total Dissolved Solids", shortLabel: "TDS", glyph: "TDS", decimals: 1 },
  { key: "oxidationReductionPotential", label: "Oxidation-Reduction Potential", shortLabel: "ORP", glyph: "mV", decimals: 0 },
  { key: "chloride", label: "Chloride", shortLabel: "Chloride", glyph: "Cl", decimals: 2 },
  { key: "sulfate", label: "Sulfate", shortLabel: "Sulfate", glyph: "SO₄", decimals: 2 },
  { key: "phosphate", label: "Phosphate (as P)", shortLabel: "Phosphate", glyph: "P", decimals: 2 },
  { key: "discharge", label: "Discharge / Flow", shortLabel: "Discharge", glyph: "Q", decimals: 3 },
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
    timeZone: "America/New_York",
    timeZoneName: "short",
  }).format(new Date(iso));
}

export function formatShortDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }).format(new Date(iso));
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
  return completeness === "complete" ? "Reviewed" : completeness === "partial" ? "Reviewed" : "No sample";
}
