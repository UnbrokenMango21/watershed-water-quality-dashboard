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
  watershedFilter: string;
  watershedOptions: string[];
  hasUnassignedWatershed: boolean;
  loading: boolean;
  productionDataConfigured: boolean;
  onSearch: (value: string) => void;
  onWatershedFilter: (value: string) => void;
  onSelect: (siteId: string) => void;
  onHover: (siteId: string | null) => void;
}) {
  const { sites, filteredSites, conditions, selectedSiteId, hoveredSiteId, search, watershedFilter, watershedOptions, hasUnassignedWatershed, loading, productionDataConfigured, onSearch, onWatershedFilter, onSelect, onHover } = props;
  const filtersActive = Boolean(search || watershedFilter);
  const sourceUnavailable = !loading && sites.length === 0 && !productionDataConfigured;

  return (
    <aside className="site-browser" aria-label="Monitoring sites">
      <div className="panel-heading">
        <div>
          <h2>Monitoring sites</h2>
          <span className="site-count">{loading ? "Loading…" : sourceUnavailable ? "Data source not connected" : sites.length ? `${filteredSites.length} of ${sites.length} sites` : "No sites available"}</span>
        </div>
      </div>

      <label className={loading || sites.length === 0 ? "site-search disabled" : "site-search"}>
        <span className="search-icon" aria-hidden="true"><CalciteIcon icon="search" /></span>
        <input
          className="site-search-input"
          type="search"
          placeholder="Search sites, county, or watershed"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          disabled={loading || sites.length === 0}
          aria-label="Search monitoring sites"
        />
        {search && <button type="button" className="search-clear" aria-label="Clear site search" onClick={() => onSearch("")}><CalciteIcon icon="x" label="Clear search" /></button>}
      </label>

      {/* Watershed names come from each approved public site record; stream filtering needs an
          authoritative stream attribute that the public views do not carry yet. */}
      {(watershedOptions.length > 1 || (watershedOptions.length > 0 && hasUnassignedWatershed)) && (
        <label className="site-filter">
          <span className="site-filter-label">Watershed</span>
          <select
            className="site-filter-select"
            value={watershedFilter}
            onChange={(event) => onWatershedFilter(event.target.value)}
            disabled={loading || sites.length === 0}
          >
            <option value="">All watersheds</option>
            {watershedOptions.map((name) => <option key={name} value={name}>{name}</option>)}
            {hasUnassignedWatershed && <option value="__none__">Watershed not recorded</option>}
          </select>
        </label>
      )}

      <div className="site-list" aria-label="Monitoring site list">
        {loading ? (
          <div className="loading-state" role="status"><span className="loading-spinner" aria-hidden="true" /><span>Loading monitoring sites…</span></div>
        ) : sourceUnavailable ? (
          <div className="empty-panel compact source-empty" role="status"><CalciteIcon icon="offline" label="Monitoring source unavailable" /><strong>Monitoring data unavailable</strong><span>Approved monitoring sources have not been connected yet.</span></div>
        ) : sites.length === 0 ? (
          <div className="empty-panel compact" role="status"><strong>No monitoring sites available</strong><span>The connected public source returned no monitoring sites.</span></div>
        ) : filteredSites.length === 0 ? (
          <div className="empty-panel compact" role="status"><strong>No matching sites</strong><span>Try a different name, county, watershed, or site ID.</span>{filtersActive && <button type="button" className="text-action" onClick={() => { onSearch(""); onWatershedFilter(""); }}>Clear filters</button>}</div>
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
