# Central PA Watershed Public Dashboard

This package is the isolated public-facing dashboard. It does not replace or modify the existing `web/` QC reviewer console.

## Product direction

- ArcGIS Maps SDK for JavaScript 5.1
- ArcGIS Map Components
- Calcite Design System 5.1
- Next.js 15.2 / React 19 for Firebase App Hosting compatibility
- Large central map, compact left monitoring-site browser, selected-site detail rail, and scientific time-series surface
- Light topographic cartography with translucent watershed polygons and selected-site emphasis

## Reference geography

The map includes a real public HUC12 watershed reference layer from the USGS/Esri Watershed Boundary Dataset, filtered to Pennsylvania. It is independent of monitoring-observation connectivity, so watershed geography remains available even when production monitoring sources are not yet configured.

The default public reference layer is:

`https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/Watershed_Boundary_Dataset_HUC_12s/FeatureServer/0`

The renderer is intentionally restrained: low-opacity blue-green watershed fill, thin blue/slate outlines, and a stronger blue fill/outline for the HUC12 polygon containing the selected monitoring site. Monitoring points remain visually above the watershed layer.

If the project later publishes a reviewed public watershed view of its own, set `NEXT_PUBLIC_ARCGIS_WATERSHEDS_VIEW_URL` to replace the default reference service without changing dashboard code.

## Data safety boundary

Production never silently falls back to sample observations. Without verified public ArcGIS monitoring resources, production must render a professional unconfigured/empty state rather than invented sites or measurements.

The `public-dashboard-dev` backend is temporarily and explicitly configured with `NEXT_PUBLIC_DASHBOARD_DATA_MODE=demo` in `apphosting.yaml` so the interactive product can be exercised before real monitoring data is approved. Every demo monitoring surface is visibly labeled as synthetic. The HUC12 watershed layer is real public reference geography, not synthetic monitoring data. Removing/changing the demo setting returns the monitoring application to the production-safe data boundary while retaining the watershed reference geography.

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
