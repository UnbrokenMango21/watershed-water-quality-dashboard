# ArcGIS Legacy Inventory Runbook

## Purpose

Identify and profile the unresolved legacy ArcGIS dataset/dashboard — including the historical approximately 117-site dataset — without modifying, republishing, deleting, sharing, or overwriting any ArcGIS content.

This is an evidence-gathering step only. It must precede any legacy migration decision.

## Preconditions

- Open the existing Central PA Watershed ArcGIS Pro environment.
- Sign in to the Penn State/ArcGIS Online organization that can access the historical watershed content.
- Do not change sharing, ownership, schemas, fields, relationships, or records before the inventory report is captured.

The known private QC staging service `b7775c1bdada4aa8b0787714eca3eb15` is explicitly recognized by the inventory and heavily de-prioritized so it is not mistaken for the legacy public dataset.

## Run

From ArcGIS Pro's Python environment:

```bash
python scripts/inventory_arcgis_legacy.py
```

The script is read-only. It:

1. inventories content owned by the signed-in user;
2. adds accessible organization search results for watershed/water-quality terms;
3. profiles Feature Service layer/table schemas and record counts;
4. captures geometry type, extent, capabilities, attachment state, fields, domains, ownership, sharing state, timestamps, tags, and service URLs;
5. recursively extracts referenced ArcGIS item IDs and FeatureServer/MapServer URLs from web maps/apps/items when available;
6. strongly ranks any dataset with exactly 117 records, while excluding the known QC staging item from legacy-candidate ranking;
7. writes a timestamped local JSON evidence report under `artifacts/arcgis_inventory/`.

`artifacts/arcgis_inventory/` is intentionally git-ignored because the authenticated report can contain private item metadata. A sanitized migration evidence summary can be committed later after privacy review.

## Interpretation

A 117-record count is only a discovery clue. Do not assume those records are 117 official sampling sites until the report establishes the entity semantics.

For every strong candidate, determine:

- whether rows are sites, sampling events, measurements, or mixed records;
- stable site identifier quality and duplicate rate;
- geometry validity and coordinate reference system;
- coordinate duplication and spatial outliers;
- timestamp range, timezone behavior, missing/imputed dates, and temporal granularity;
- parameter fields, units, aliases, and any silent historical conversions;
- landowner/private-access notes or other fields that cannot enter a public view;
- whether a Web Map, Dashboard, or Experience references the service;
- whether the item is authoritative, derived, abandoned, or a presentation copy.

## Migration gate

Before modifying any legacy ArcGIS item:

1. export/snapshot the candidate service and its item metadata;
2. preserve the original item ID and URL in the migration evidence;
3. reconcile legacy site identifiers against the canonical Firestore `siteCatalog` and approved-publication `SamplingSites` IDs;
4. map legacy parameters to the canonical parameter catalog without discarding original values/units;
5. stage normalization into a separate geodatabase or new hosted service;
6. document any records that cannot be safely classified;
7. explicitly decide whether legacy measurements are historically approved/publication-eligible before they enter the approved-authoritative ArcGIS service.

Never delete, overwrite, or silently repurpose the legacy item as part of discovery.
