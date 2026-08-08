# Step 5 — ArcGIS Pro Geodatabase Prototype

**Status:** Complete — visually verified 2026-08-08  
**Target:** ArcGIS Pro 3.7.x

## Final project setup

- Project name: `MyProject`
- Project location: `C:\Mac\Home\Desktop\Watershed Project\Watershed Dashboard`
- Project folder: `C:\Mac\Home\Desktop\Watershed Project\Watershed Dashboard\MyProject`
- Project file: `MyProject.aprx`
- Working geodatabase: `CentralPA_Watershed.gdb`

The setup script resolves the active ArcGIS project home folder dynamically.

## Verified prototype datasets

- `SamplingSites` — Point feature class
- `SamplingEvents` — Point feature class
- `Measurements` — Table
- `ValidationFlags` — Table
- `AuditEvents` — Table

## Spatial reference verification

Both point feature classes were visually verified in ArcGIS Pro properties:

- Geographic Coordinate System: WGS 1984
- WKID: 4326
- Authority: EPSG

## Schema verification

`SamplingSites` fields were visually inspected and include the expected machine-safe/private/public fields such as `site_id`, `site_code`, `site_name_internal`, `site_name_public`, private landowner/access fields, watershed/site status, coordinates, dates, and schema version.

`SamplingEvents` fields were visually inspected and include the expected field-collection metadata, GPS fields, temperature-entry/derived fields, workflow fields, quality/anomaly score components, review fields, publication fields, and version fields.

## Phase-5 completion criteria

- [x] ArcGIS Pro project saved successfully.
- [x] `CentralPA_Watershed.gdb` exists and is visible in the project Catalog.
- [x] Five empty prototype datasets exist.
- [x] `SamplingSites` uses WGS 1984 / EPSG:4326.
- [x] `SamplingEvents` uses WGS 1984 / EPSG:4326.
- [x] Expected field schemas are present.
- [x] No production/historical observations have been loaded.
- [x] Private/internal fields remain backend-only by design.

## Environment note

ArcGIS Pro displayed a rendering-engine hardware warning under Parallels. This does not invalidate the geodatabase/schema work. On Apple Silicon under Parallels, DirectX 11 is the supported GPU path; DirectX 12 features are unavailable and OpenGL can fall back to CPU emulation. Configure ArcGIS Pro to use DirectX 11 if the drawing warning persists.

Phase 6 adds ArcGIS-native GlobalIDs, GUID foreign keys, relationship classes, coded-value domains, attachments, and UTC editor tracking.
