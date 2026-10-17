# Central PA Watershed Public Dashboard

This package hosts the public Watershed Watch website and approved-only dashboard. It does not replace or modify the existing `web/` QC reviewer console.

## Public routes

- `/` is the editorial landing page, with a real embedded preview of the dashboard and a clear explanation of field collection, QC and publication.
- `/dashboard` contains the existing interactive ArcGIS monitoring workspace. It remains the single public-data implementation; the landing page embeds it using a same-origin, lazy-loaded iframe.
- Local preview: `npm run dev -- -p 3007`, then open `http://localhost:3007/`.

Website copy does not claim monitoring totals or site observations without an authorized published source. The dashboard remains fail-closed when no approved public data exists.

## Product direction

- ArcGIS Maps SDK for JavaScript 5.1
- ArcGIS Map Components
- Calcite Design System 5.1
- Next.js 15.5 / React 19 for Firebase App Hosting compatibility
- Large central map, compact left monitoring-site browser, selected-site detail rail, and scientific time-series surface
- Light topographic cartography with translucent watershed polygons and selected-site emphasis

## Reference geography

The map displays Esri Living Atlas copies of USGS Watershed Boundary Dataset polygons, filtered to Pennsylvania. HUC8 outlines provide regional context and HUC12 outlines provide local context. Selected-site identification uses the authoritative USGS service through the server route, separately from browser map outlines. Selecting a site queries its actual displayed coordinates against HUC10 and HUC12 polygons, displays the names/codes and source-check timestamps, and highlights the containing HUC12 polygon. Reference geography remains independent of monitoring observations.

Default browser outline URLs are `REGIONAL_OUTLINE_LAYER_URL` and `LOCAL_OUTLINE_LAYER_URL` in `lib/geography/watershedContext.ts`. The server identifies selected sites with fixed USGS WBD `MapServer/5` (HUC10) and `MapServer/6` (HUC12) point queries. Separating these consumers avoids unreliable USGS browser CORS behavior.

The renderer keeps restrained watershed outlines and emphasizes only the selected site's containing polygon. Monitoring points remain visually above the watershed layer. Geographic lookup failures, missing coverage and multiple intersecting boundaries are explicit states; no watershed is guessed. Successful results are cached in memory for 15 minutes with a 100-entry bound and exact coordinate keys.

If the project later publishes a reviewed public watershed view of its own, set `NEXT_PUBLIC_ARCGIS_WATERSHEDS_VIEW_URL` to replace the default reference service without changing dashboard code.

Overrides must be anonymous HTTPS ArcGIS hosted-layer URLs without credentials or query strings. Invalid/unavailable sources show an error; they do not silently fall back. [Source selection, live checks and remaining geographic work](../docs/GIS_PROVENANCE_2026-10-15.md) are recorded separately. EPA How's My Waterway is linked as external assessment context, separate from this project's measurements.

## Data safety boundary

Production never silently falls back to sample observations. Without verified public ArcGIS monitoring resources, production must render a professional unconfigured/empty state rather than invented sites or measurements.

The `public-dashboard-dev` backend is configured with `NEXT_PUBLIC_DASHBOARD_DATA_MODE=production` and the four verified public-safe ArcGIS views. Those views are currently empty by design because no provenance-cleared approved observation is available. Demo monitoring data remains an explicit local-only mode and is never a production fallback. The HUC12 watershed layer is real public reference geography, not synthetic monitoring data.

The production adapter will bind only to verified public-safe ArcGIS surfaces for:

- Sites
- Approved observations
- Measurements
- Latest site conditions
- Optional Web Map/cartography item

The browser must never read private Firestore workflow documents or the private ArcGIS QC staging service.

## Environment

Production monitoring URLs are explicitly pinned in `lib/data/productionResources.ts` and consumed by `DashboardShell`. Changing the historical four `NEXT_PUBLIC_ARCGIS_*_VIEW_URL` monitoring variables in App Hosting does not change these destinations. To change monitoring sources, review that module together with the exact public schema allowlist and anonymous-source verification.

`NEXT_PUBLIC_ARCGIS_WATERSHEDS_VIEW_URL` remains an optional browser HUC12-outline override. It does not change the fixed USGS selected-site lookup. No OAuth token or private service URL belongs in any public variable.

For synthetic development monitoring data only:

- `NEXT_PUBLIC_DASHBOARD_DATA_MODE=demo`

No credentials or publisher secrets belong in this package.

## Development

```bash
npm install
npm run dev
```

Before deployment:

```bash
npm run typecheck
npm run build
```
