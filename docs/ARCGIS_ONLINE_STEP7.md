# Step 7 — Publish Private ArcGIS Online QC Staging

**Status:** Active  
**Target:** ArcGIS Online + ArcGIS Pro 3.7.x  
**Source:** `CentralPA_Watershed.gdb`

## Purpose

Publish the hardened local ArcGIS data model as a **private QC/review staging service** for later Workflow Manager integration.

This is not the final public or authoritative watershed service.

### Data ownership boundary

- **Firebase:** source of truth for raw/mobile submissions.
- **ArcGIS Online QC staging:** private GIS mirror used for map-based review and Workflow Manager.
- **ArcGIS authoritative service:** later destination for approved/published records only.
- **Public dashboard views:** later public-safe views that never expose landowner/private identity fields.

## ArcGIS Online naming

- Portal folder: `Central_PA_Watershed_Staging`
- Hosted feature layer: `Central_PA_Watershed_QC_Staging`
- Initial sharing: owner only/private

## Publish as one related service

The ArcGIS Pro map must include these five source datasets together before publication:

- `SamplingSites`
- `SamplingEvents`
- `Measurements`
- `ValidationFlags`
- `AuditEvents`

The geodatabase relationship classes are:

- `Sites_Events_Rel`
- `Events_Measurements_Rel`
- `Events_ValidationFlags_Rel`
- `Events_AuditEvents_Rel`
- `Measurements_ValidationFlags_Rel`

`SamplingEvents` also has attachments enabled.

## Map coordinate system

Before publication, set the ArcGIS Pro map coordinate system to **WGS 1984 / EPSG:4326** so the hosted staging geometry remains aligned with the local canonical geometry and mobile latitude/longitude model.

## Publication configuration

From ArcGIS Pro:

1. Confirm Penn State ArcGIS Online is the active portal and the correct account is signed in.
2. Confirm all five datasets are in the current map (two feature layers + three standalone tables).
3. Set the map coordinate system to **WGS 1984 / EPSG:4326**.
4. Share the full map contents as a Web Layer.
5. Name: `Central_PA_Watershed_QC_Staging`.
6. Layer type: **Feature**.
7. Data: **Copy all data**.
8. Portal folder: `Central_PA_Watershed_Staging`.
9. Sharing: **do not share** with Everyone or the organization during Phase 7.
10. Configure operations:
   - Enable editing.
   - Allow **Add**.
   - Allow **Update → Attributes only**.
   - Do **not** allow Delete.
   - Do **not** enable Sync in Phase 7.
   - Do **not** enable Export Data in Phase 7 because staging contains private/internal fields.
   - Do **not** enable public data collection.
   - Preserve editor tracking information where the publishing pane exposes the option.
   - Keep attachments/related data included.
11. Analyze before publishing. Resolve all errors before publish; review warnings individually.
12. Publish.

## Why these editing settings

The staging service needs to accept new review records and allow workflow/status/reviewer attributes to change, but supervisors should not modify field geometry and nobody should delete scientific submissions as part of normal review. Deletion and geometry correction remain controlled administrative/backend operations rather than routine reviewer privileges.

## Verification in ArcGIS Online

After publication, verify the hosted feature layer contains:

### Spatial layers
- `SamplingSites`
- `SamplingEvents`

### Tables
- `Measurements`
- `ValidationFlags`
- `AuditEvents`

### Relationship behavior
Verify related-record navigation is available for the intended parent/child relationships.

### Attachments
Verify `SamplingEvents` supports attachments.

### Fields/domains
Spot-check:
- `SamplingEvents.test_type` → test type coded values
- `SamplingEvents.data_collected_by` → collector-category coded values
- `SamplingEvents.workflow_status` → workflow coded values
- `SamplingEvents.validation_outcome` → validation coded values
- `SamplingEvents.review_decision` → review decision coded values
- `ValidationFlags.severity` → flag severity coded values

### IDs
Verify GlobalID fields and GUID foreign keys are present.

### Privacy
The staging item must remain private. Backend/private fields may exist in this service because it is not a public view.

## Important rules

- Do not import historical/production data in Phase 7.
- Do not create a public view yet.
- Do not remove landowner/internal fields from the staging source; instead exclude/hide them from future public-safe views.
- Do not treat the QC staging layer as the authoritative approved dataset.
- Do not overwrite the local file geodatabase as part of online editing; the online hosted copy is a separate environment.

## Acceptance criteria

- Private hosted feature layer publishes successfully.
- Two spatial layers + three related tables are present.
- Relationships work after publishing.
- SamplingEvents attachments work.
- Domains/coded values survived publishing.
- GlobalID/GUID fields survived publishing.
- Item is private.
- No real/historical observations are loaded.
- Map Viewer opens the service without schema errors.
