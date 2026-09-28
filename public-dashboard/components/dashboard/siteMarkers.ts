import type { DashboardSite } from "@/lib/data/DashboardDataSource";

export type SiteMarkerAttributes = {
  ObjectID: number;
  siteId: string;
  name: string;
  code: string;
  status: string;
};

/**
 * One marker per site the active data source returned. In production that is the public-safe
 * Central_PA_Watershed_Public_Sites view (validated by ArcgisDashboardDataSource), in demo mode the
 * labelled synthetic fixtures. This function never adds, filters or decides which sites are public;
 * an empty source yields no markers.
 */
export function siteMarkerAttributes(sites: DashboardSite[], statusFor: (siteId: string) => string): SiteMarkerAttributes[] {
  return sites.map((site, index) => ({
    ObjectID: index + 1,
    siteId: site.id,
    name: site.name,
    code: site.code,
    status: statusFor(site.id),
  }));
}
