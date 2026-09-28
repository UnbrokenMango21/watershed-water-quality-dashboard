"use client";

import { useState } from "react";
import type { DashboardSite, LatestSiteCondition } from "@/lib/data/DashboardDataSource";
import { CalciteIcon, completenessFor, completenessLabel, formatDateTime, parameterDefinitions } from "./dashboard-utils";
import { ParameterRow } from "./ParameterRow";

export function SiteDetail({ site, condition }: { site: DashboardSite | null; condition: LatestSiteCondition | null }) {
  const [showTrendInfo, setShowTrendInfo] = useState(false);

  if (!site) {
    return (
      <aside className="site-detail site-detail-empty" aria-label="Selected site details">
        <div className="detail-heading"><span className="eyebrow">Selected site</span><h2>No site selected</h2><p>Choose a site from the list or the map.</p></div>
        <div className="detail-context-empty" role="status"><CalciteIcon icon="pin" label="No monitoring site selected" /><strong>Readings appear here</strong><span>Select a site to see its most recent reviewed sample.</span></div>
      </aside>
    );
  }

  if (!condition) {
    return (
      <aside className="site-detail site-detail-empty" aria-label="Selected site details">
        <div className="detail-heading"><span className="eyebrow">Selected site</span><h2>{site.name}</h2><div className="detail-meta"><span>{[site.watershed, site.county].filter(Boolean).join(", ")}</span><span>Site {site.code}</span></div></div>
        <div className="detail-context-empty" role="status"><CalciteIcon icon="table" label="No measurements available" /><strong>No reviewed readings yet</strong><span>This site has no published observations.</span></div>
      </aside>
    );
  }

  const completeness = completenessFor(condition);
  const recordedCount = parameterDefinitions.filter((parameter) => condition.measurements.some((measurement) => measurement.parameter === parameter.key)).length;
  const missingCount = parameterDefinitions.length - recordedCount;
  const hasTrendInformation = parameterDefinitions.some((parameter) => Boolean(condition.previousMeasurements?.[parameter.key]));

  return (
    <aside className="site-detail" aria-label="Selected site details">
      <div className="detail-heading"><span className="eyebrow">Selected site</span><h2>{site.name}</h2><div className="detail-meta"><span>{[site.watershed, site.county].filter(Boolean).join(", ")}</span><span>Site {site.code}</span></div></div>

      <div className={`sample-summary ${completeness}`}>
        <div><span>Latest sample</span><strong>{formatDateTime(condition.observedAt)}</strong></div>
        <span className={`sample-state ${completeness}`}><span className="sample-state-dot" aria-hidden="true" />{completenessLabel(completeness)}</span>
      </div>

      <section className="metrics" aria-label="Latest readings">
        <div className="metrics-heading">
          <div><span className="eyebrow">Latest readings</span><h3>Water quality</h3></div>
          {hasTrendInformation && (
            <div className="detail-info-wrap">
              <button type="button" className="info-button" aria-label="Explain trend indicators" aria-expanded={showTrendInfo} data-tooltip="About trends" onClick={() => setShowTrendInfo((value) => !value)}><CalciteIcon icon="information" label="About trends" /></button>
              {showTrendInfo && <div className="info-popover" role="note">Arrows show the change from the previous sample. They do not rate water quality or safety.</div>}
            </div>
          )}
        </div>
        <div className="metric-list">
          {parameterDefinitions.map((parameter) => <ParameterRow key={parameter.key} label={parameter.label} glyph={parameter.glyph} decimals={parameter.decimals} current={condition.measurements.find((measurement) => measurement.parameter === parameter.key)} previous={condition.previousMeasurements?.[parameter.key]} />)}
        </div>
      </section>

      <div className="missing-summary" role="status">{recordedCount} of {parameterDefinitions.length} parameters recorded in this sample.</div>
    </aside>
  );
}
