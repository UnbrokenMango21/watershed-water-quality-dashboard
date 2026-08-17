# Central PA Watershed Public Dashboard

This package is the isolated public-facing dashboard. It does not replace or modify the existing `web/` QC reviewer console.

## Product direction

- ArcGIS Maps SDK for JavaScript 5.1
- ArcGIS Map Components
- Calcite Design System 5.1
- Next.js 16 / React 19, aligned with the existing Firebase App Hosting web stack
- Large central map, compact left monitoring-site browser, selected-site detail rail, and scientific time-series surface
- Light topographic cartography with room for translucent watershed polygons, streams, and selected-site emphasis

## Data safety boundary

Production never falls back to sample observations. Until verified public ArcGIS resources are configured, the application renders a professional unconfigured/empty state rather than invented sites or measurements.

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
- `NEXT_PUBLIC_ARCGIS_SITES_VIEW_URL`
- `NEXT_PUBLIC_ARCGIS_OBSERVATIONS_VIEW_URL`
- `NEXT_PUBLIC_ARCGIS_MEASUREMENTS_VIEW_URL`
- `NEXT_PUBLIC_ARCGIS_LATEST_CONDITIONS_VIEW_URL`

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
