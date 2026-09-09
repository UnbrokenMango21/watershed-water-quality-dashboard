"use client";

import type { DashboardSite, LatestSiteCondition } from "@/lib/data/DashboardDataSource";
import { completenessFor, completenessLabel } from "./dashboard-utils";

export function SiteRow({
  site,
  condition,
  selected,
  hovered,
  onSelect,
  onHover,
}: {
  site: DashboardSite;
  condition: LatestSiteCondition | null | undefined;
  selected: boolean;
  hovered: boolean;
  onSelect: () => void;
  onHover: (hovered: boolean) => void;
}) {
  const completeness = completenessFor(condition);
  return (
    <button
      id={`site-row-${site.id}`}
      type="button"
      className={["site-row", selected ? "selected" : "", hovered ? "hovered" : ""].filter(Boolean).join(" ")}
      onClick={onSelect}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
      aria-current={selected ? "true" : undefined}
    >
      <span className="site-row-copy">
        <strong>{site.name}</strong>
        <span>{site.code} · {site.county}</span>
        <span>{site.watershed}</span>
      </span>
      <span className={`sample-state ${completeness}`}>
        <span className="sample-state-dot" aria-hidden="true" />
        {completenessLabel(completeness)}
      </span>
    </button>
  );
}
