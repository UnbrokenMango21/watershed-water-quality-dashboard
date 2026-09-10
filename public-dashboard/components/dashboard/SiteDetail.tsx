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
        <div className="detail-heading">
          <span className="eyebrow">Selected site</span>
          <h2>No site selected</h2>
          <p>Choose a monitoring site from the browser or map to view measurements.</p>
        </div>
        <div className="detail-context-empty" role="status">
          <CalciteIcon icon="pin" label="No monitoring site selected" />
          <strong>Select a site to inspect readings</strong>
          <span>Observation status and parameter values appear only after a monitoring site is selected.</span>
        </div>
      </aside>
    );
  }

  if (!condition) {
    return (
      <aside className="site-detail site-detail-empty" aria-label="Selected site details">
        <div className="detail-heading">
          <span className="eyebrow">Selected site</span>
          <h2>{site.name}</h2>
          <div className="detail-meta"><span>{site.code}</span><span>{site.county}</span><span>Stream · {site.watershed}</span></div>
        </div>
        <div className="detail-context-empty" role="status">
          <CalciteIcon icon="table" label="No measurements available" />
          <strong>No approved measurements available for this site</strong>
          <span>The site is available, but no reviewed public observation is available to display.</span>
        </div>
      </aside>
    );
  }

  const completeness = completenessFor(condition);
  const missingCount = parameterDefinitions.filter((parameter) => !condition.measurements.some((measurement) => measurement.parameter === parameter.key)).length;
  const hasTrendInformation = parameterDefinitions.some((parameter) => Boolean(condition.previousMeasurements?.[parameter.key]));

  return (
    <aside className="site-detail" aria-label="Selected site details">
      <div className="detail-heading">
        <span className="eyebrow">Selected site</span>
        <h2>{site.name}</h2>
        <div className="detail-meta"><span>{site.code}</span><span>{site.county}</span><span>Stream · {site.watershed}</span></div>
      </div>

      <div className={`sample-summary ${completeness}`}>
        <div><span>Latest sample</span><strong>{formatDateTime(condition.approvedAt)}</strong></div>
        <span className={`sample-state ${completeness}`}><span className="sample-state-dot" aria-hidden="true" />{completenessLabel(completeness)}</span>
      </div>

      <section className="metrics" aria-label="Latest readings">
        <div className="metrics-heading">
          <div><span className="eyebrow">Latest readings</span><h3>Core water-quality parameters</h3></div>
          {hasTrendInformation && (
            <div className="detail-info-wrap">
              <button type="button" className="info-button" aria-label="Explain trend indicators" aria-expanded={showTrendInfo} data-tooltip="About trends" onClick={() => setShowTrendInfo((value) => !value)}><CalciteIcon icon="information" label="About trends" /></button>
              {showTrendInfo && <div className="info-popover" role="note">Trend arrows show numeric change from the previous sampled measurement only. They do not classify water quality, safety, or ecological health.</div>}
            </div>
          )}
        </div>
        <div className="metric-list">
          {parameterDefinitions.map((parameter) => <ParameterRow key={parameter.key} label={parameter.label} glyph={parameter.glyph} decimals={parameter.decimals} current={condition.measurements.find((measurement) => measurement.parameter === parameter.key)} previous={condition.previousMeasurements?.[parameter.key]} />)}
        </div>
      </section>

      <div className="missing-summary" role="status">{missingCount === 0 ? "All five core parameters were recorded in the latest sample." : `${missingCount} of 5 core parameters ${missingCount === 1 ? "was" : "were"} not recorded in the latest sample.`}</div>
    </aside>
  );
}
