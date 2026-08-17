"use client";
import { useState } from "react";
import type { DashboardSite, LatestSiteCondition } from "@/lib/data/DashboardDataSource";
import { CalciteIcon, completenessFor, completenessLabel, formatDateTime, parameterDefinitions } from "./dashboard-utils";
import { ParameterRow } from "./ParameterRow";

export function SiteDetail({ site, condition }: { site: DashboardSite | null; condition: LatestSiteCondition | null }) {
  const [showTrendInfo, setShowTrendInfo] = useState(false);
  const completeness = completenessFor(condition);
  const missingCount = parameterDefinitions.filter((p) => !condition?.measurements.some((m) => m.parameter === p.key)).length;
  return (
    <aside className="site-detail" aria-label="Selected site details">
      <div className="detail-heading">
        <span className="eyebrow">Selected site</span><h2>{site?.name ?? "No site selected"}</h2>
        {site ? <div className="detail-meta"><span>{site.code}</span><span>{site.county}</span><span>Stream · {site.watershed}</span></div> : <p>Choose a monitoring site from the map or site browser.</p>}
      </div>
      <div className={`sample-summary ${completeness}`}>
        <div><span>Latest sample</span><strong>{condition ? formatDateTime(condition.approvedAt) : "Not available"}</strong></div>
        <span className={`sample-state ${completeness}`}><span className="sample-state-dot" aria-hidden="true" />{completenessLabel(completeness)}</span>
      </div>
      <section className="metrics" aria-label="Latest readings">
        <div className="metrics-heading">
          <div><span className="eyebrow">Latest readings</span><h3>Core water-quality parameters</h3></div>
          <div className="detail-info-wrap">
            <button type="button" className="info-button" aria-label="Explain trend indicators" aria-expanded={showTrendInfo} data-tooltip="About trends" onClick={() => setShowTrendInfo((value) => !value)}><CalciteIcon icon="information" label="About trends" /></button>
            {showTrendInfo && <div className="info-popover" role="note">Trend arrows show numeric change from the previous sampled measurement only. They do not classify water quality, safety, or ecological health.</div>}
          </div>
        </div>
        <div className="metric-list">
          {parameterDefinitions.map((p) => <ParameterRow key={p.key} label={p.label} glyph={p.glyph} decimals={p.decimals} current={condition?.measurements.find((m) => m.parameter === p.key)} previous={condition?.previousMeasurements?.[p.key]} />)}
        </div>
      </section>
      {site && <div className="missing-summary" role="status">{condition ? missingCount === 0 ? "All five core parameters were recorded in the latest sample." : `${missingCount} of 5 core parameters ${missingCount === 1 ? "was" : "were"} not recorded in the latest sample.` : "No reviewed sample is available for this site."}</div>}
    </aside>
  );
}
