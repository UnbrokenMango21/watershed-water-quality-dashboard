"use client";

import type { DashboardSite, LatestSiteCondition } from "@/lib/data/DashboardDataSource";
import { CalciteIcon } from "./dashboard-utils";
import { SiteRow } from "./SiteRow";

export function SiteBrowser(props: {
  sites: DashboardSite[];
  filteredSites: DashboardSite[];
  conditions: Record<string, LatestSiteCondition | null>;
  selectedSiteId: string | null;
  hoveredSiteId: string | null;
  search: string;
  loading: boolean;
  productionDataConfigured: boolean;
  onSearch: (value: string) => void;
  onSelect: (siteId: string) => void;
  onHover: (siteId: string | null) => void;
}) {
  const { sites, filteredSites, conditions, selectedSiteId, hoveredSiteId, search, loading, productionDataConfigured, onSearch, onSelect, onHover } = props;
  return (
    <aside className="site-browser" aria-label="Monitoring sites">
      <div className="panel-heading"><div><h2>Monitoring Sites</h2><span className="site-count">{loading ? "Loading…" : sites.length ? `${filteredSites.length} of ${sites.length} sites` : "No sites"}</span></div></div>
      <label className="site-search">
        <span className="search-icon" aria-hidden="true"><CalciteIcon icon="search" /></span>
        <input className="site-search-input" type="search" placeholder="Search sites, county, or stream" value={search} onChange={(event) => onSearch(event.target.value)} disabled={loading || sites.length === 0} aria-label="Search monitoring sites" />
        {search && <button type="button" className="search-clear" aria-label="Clear site search" onClick={() => onSearch("")}><CalciteIcon icon="x" label="Clear search" /></button>}
      </label>
      <div className="site-list" aria-label="Monitoring site list">
        {loading ? (
          <div className="loading-state" role="status"><span className="loading-spinner" aria-hidden="true" /><span>Loading monitoring sites…</span></div>
        ) : sites.length === 0 ? (
          <div className="empty-panel compact" role="status"><strong>No monitoring sites available</strong><span>{productionDataConfigured ? "The connected source returned no public sites." : "Approved public ArcGIS views have not been connected yet."}</span></div>
        ) : filteredSites.length === 0 ? (
          <div className="empty-panel compact" role="status"><strong>No matching sites</strong><span>Try a different name, county, stream, or site ID.</span><button type="button" className="text-action" onClick={() => onSearch("")}>Clear search</button></div>
        ) : filteredSites.map((site) => (
          <SiteRow
            key={site.id}
            site={site}
            condition={conditions[site.id]}
            selected={site.id === selectedSiteId}
            hovered={site.id === hoveredSiteId}
            onSelect={() => onSelect(site.id)}
            onHover={(hovered) => onHover(hovered ? site.id : null)}
          />
        ))}
      </div>
    </aside>
  );
}
