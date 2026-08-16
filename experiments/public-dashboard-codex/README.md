# Central PA Watershed — Public Dashboard Concept

Independent public-dashboard design experiment for Watershed Watch.

## Safety boundary

This experiment is intentionally isolated from the production QC console and data pipeline. It does not import or modify `web/`, Firebase, ArcGIS publication logic, mobile applications, production data, or credentials. All displayed observations are deterministic synthetic sample data for interface evaluation only.

## Run

```bash
npm run quality
npm run dev
```

Open `http://127.0.0.1:4173`.

## Prototype states

The default route shows the full interactive sample network. Additional states can be inspected with query parameters:

- `?state=loading`
- `?state=error`
- `?state=no-site`
- `?state=empty`
- `?state=no-data`

## Interaction coverage

- 324 deterministic sample monitoring sites distributed across representative Central Pennsylvania stream corridors.
- Search, watershed/county filtering, date range and parameter controls.
- Map pan, mouse-wheel zoom, two-pointer pinch zoom, keyboard pan/zoom, fit network, reset, zoom-to-selected.
- View-dependent clustering/decluttering and synchronized site list/marker selection.
- Selected-site metadata, approved/quality-reviewed status, latest conditions and progressive disclosure of additional parameters.
- Accessible SVG time series with inspectable observations, missing-data breaks, 12-month/5-year/full ranges and dynamic Y domains.
- Responsive desktop/tablet/mobile layouts with a mobile site-browser sheet.
- Lightweight About the Data and Monitoring Program editorial routes.
