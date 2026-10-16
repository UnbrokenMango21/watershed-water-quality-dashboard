# Central PA Watershed Public Dashboard

This package is the isolated public-facing dashboard. It does not replace or modify the existing `web/` QC reviewer console.

## Product direction

- ArcGIS Maps SDK for JavaScript 5.1
- ArcGIS Map Components
- Calcite Design System 5.1
- Next.js 15.5 / React 19 for Firebase App Hosting compatibility
- Large central map, compact left monitoring-site browser, selected-site detail rail, and scientific time-series surface
- Light topographic cartography with translucent watershed polygons and selected-site emphasis

## Reference geography

The map uses public USGS National Map Watershed Boundary Dataset layers, filtered to Pennsylvania. HUC8 outlines provide regional context and HUC12 outlines provide local context. Selecting a site queries its actual displayed coordinates against HUC10 and HUC12 polygons, displays the names/codes and source-check timestamps, and highlights the containing HUC12 polygon. Reference geography remains independent of monitoring observations.

The default public reference layer is:

`https://hydro.nationalmap.gov/arcgis/rest/services/wbd/MapServer/6`

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

Copy `.env.example` to `.env.local` for local development and provide verified public ArcGIS resources when they exist:

- `NEXT_PUBLIC_ARCGIS_WEBMAP_ID`
- `NEXT_PUBLIC_ARCGIS_WATERSHEDS_VIEW_URL` (optional override; public USGS/Esri HUC12 service is the default)
- `NEXT_PUBLIC_ARCGIS_SITES_VIEW_URL`
- `NEXT_PUBLIC_ARCGIS_OBSERVATIONS_VIEW_URL`
- `NEXT_PUBLIC_ARCGIS_MEASUREMENTS_VIEW_URL`
- `NEXT_PUBLIC_ARCGIS_LATEST_CONDITIONS_VIEW_URL`

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
