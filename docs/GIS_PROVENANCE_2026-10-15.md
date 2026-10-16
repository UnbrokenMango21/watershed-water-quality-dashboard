# Public GIS provenance and integration — 2026-10-15

Status: **IMPLEMENTED — AWAITING VERIFICATION** for the geographic UI. Automated checks and live anonymous source queries passed; browser/viewport evidence is still required. This change does not publish measurements, alter sites, or modify private ArcGIS staging.

## Source selection

| Purpose | Selected source | Verified contract / provenance |
| --- | --- | --- |
| Regional outlines | [USGS WBD HUC8, layer 4](https://hydro.nationalmap.gov/arcgis/rest/services/wbd/MapServer/4) | Public polygon service; `huc8`, `name`, `states`. |
| Selected-site watershed | [USGS WBD HUC10, layer 5](https://hydro.nationalmap.gov/arcgis/rest/services/wbd/MapServer/5) | Anonymous point-intersection query; `huc10`, `name`. |
| Local outlines and selected-site subwatershed | [USGS WBD HUC12, layer 6](https://hydro.nationalmap.gov/arcgis/rest/services/wbd/MapServer/6) | Anonymous point-intersection query; `huc12`, `name`, WGS84 polygon returned for highlight. |
| Streams | Existing public Esri Hydro Reference Overlay | Retained existing cartography; a tiled geographic reference, not measured project discharge or water quality. |
| Regulatory assessment context | [EPA How's My Waterway](https://mywaterway.epa.gov/community/State%20College,%20PA,%20USA/overview) | External link explicitly labeled separately from project measurements. No assessment records are imported or presented as project observations. |

[USGS documents WBD](https://www.usgs.gov/national-hydrography/watershed-boundary-dataset) as a hierarchical hydrologic unit dataset. A hydrologic unit may cover only part of the drainage area at an outlet; the UI calls this reference context and makes no watershed-health or upstream-source inference. The [USGS service metadata](https://hydro.nationalmap.gov/arcgis/rest/services/wbd/MapServer) advertised an October 2026 data refresh when checked. This is source metadata, not a claim that every feature was edited that month.

The previous Esri HUC8/HUC12 hosted view item descriptions declare mature support as of April 2026 and retirement in December 2027. Their data-last-edit metadata was April 2025. The recommended replacement hosted services retain compatible fields, but the HUC12 replacement's point queries timed out in repeated 15–25-second checks on this run, even though its metadata and HUC-code query worked. The direct USGS source returned the same generic location's HUC12 point/polygon query in 0.72 seconds and supplies HUC8/HUC10/HUC12 from one service. The implementation therefore explicitly selects USGS as its primary source; it does not silently fail over between datasets.

## Implementation and safety

- `public-dashboard/lib/geography/watershedContext.ts` queries exact site longitude/latitude with `inSR=4326`, `esriSpatialRelIntersects`, explicit HUC/name fields, and anonymous requests with credentials omitted and redirects rejected.
- HUC12 geometry is requested in WGS84 and validated before highlighting. No nearest-name heuristic, HUC truncation, inferred measurement, or authoritative-site write occurs.
- Zero polygons means no containing polygon. Multiple polygons or truncated results mean an ambiguous boundary requiring review. Network, schema and geometry failures show an unavailable state and a retry action. No HUC is fabricated.
- Shared in-flight requests and successful/empty results use a bounded, memory-only 15-minute cache keyed by source and exact coordinates. Errors are not cached, so retry makes a new request. Source URLs, checked timestamps and available edit timestamps are visible; unknown edit dates remain absent.
- The map retains quiet terrain, regional/local outline scale transitions, streams, neutral monitoring markers, selected-site emphasis and ArcGIS attribution. Reference-layer errors are visible. Context requests have timeouts, and late results cannot replace a different selected site's highlight.
- The optional HUC12 override accepts only HTTPS National Map / ArcGIS hosted-layer URLs without embedded credentials/query strings. An invalid override fails closed rather than selecting a hidden fallback.
- Optional water depth uses parameter code `WATER_DEPTH_M`, canonical metres and the existing approved generic measurement table. No new public wide columns or visual-observation fields were allowed. Missing depth remains absent; discharge remains a separate parameter.

## Verified evidence

| Check | Result |
| --- | --- |
| Anonymous current-source metadata | PASS: USGS HUC10/HUC12 exact field names and polygon schema inspected. |
| Generic State College reference point, longitude −77.86 / latitude 40.7934 | PASS: HUC10 `0205020401`, Spring Creek; HUC12 `020502040102`, Slab Cabin Run, polygon present. This is a geographic test point, not a monitoring observation or an approved project site. |
| `npm test --prefix public-dashboard` | PASS: 10/10 after adding query/cache/expiry, failure/retry, empty/ambiguous/schema/geometry, depth absence/zero/unit and public-field boundary cases. |
| Public dashboard typecheck/build | PASS for the first geography/depth implementation; final source-URL guard and copy change require a fresh build recorded before delivery. |
| Browser/mobile/tablet/desktop | Awaiting independent screen and interaction verification. |

## Remaining integration work

No production observations or sites were supplied/imported. The monitoring adapter still reads only its configured public-safe hosted views and preserves exact-field fail-closed checks. Geographic context does not confer approval or publication eligibility.

Stream identifiers and names are not yet canonical fields in `DashboardSite`; a tiled stream overlay alone cannot provide a reliable stream filter or nearest-stream attribution. Source-backed stream relationships and HUC-based network filtering remain separate work. [USGS states NHD was retired in 2023](https://www.usgs.gov/national-hydrography/access-national-hydrography-products); evaluate available 3DHP/NHDPlus coverage and identifiers before adding authoritative stream attribution.

EPA [ATTAINS public-data documentation](https://www.epa.gov/waterdata/get-data-access-public-attains-data) distinguishes regulatory assessments from monitoring results and describes geospatial services plus assessment-cycle refreshes. Its current API documentation also warns of API-key requirements. The public [ATTAINS geospatial service](https://gispub.epa.gov/arcgis/rest/services/OW/ATTAINS_Assessment/MapServer) metadata was anonymously verified in this run. A future assessment adapter should preserve assessment organization/cycle/source metadata, cache separately, expose unavailable states and keep any required key server-side. No assessment integration or API-key setup is claimed here.
