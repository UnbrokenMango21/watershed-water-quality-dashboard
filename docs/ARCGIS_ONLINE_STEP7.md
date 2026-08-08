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
- Hosted item ID: `b7775c1bdada4aa8b0787714eca3eb15`
- Initial sharing: owner only/private

## Time standard

Use **Eastern Time (`America/New_York`) as the product-standard working/display time zone** for collection, validation, review, audit presentation, Workflow Manager, authoritative publication presentation, and dashboard display. Daylight-saving rules must remain enabled so summer uses EDT and winter uses EST automatically.

### Important ArcGIS Online storage behavior

ArcGIS Online hosted feature layers **store Date values internally in UTC by design**. This is not a project configuration failure and should not be treated as one. During publishing, local Eastern source times are interpreted using the configured Eastern time zone and converted to UTC for hosted storage.

Therefore the correct hosted design is:

- **Hosted storage:** UTC (ArcGIS Online implementation requirement)
- **Preferred client/product time:** Eastern Time / `America/New_York`
- **Daylight saving:** enabled

Do not attempt to force ArcGIS Online hosted `dateFieldsTimeReference` away from UTC. Instead, configure the hosted service's `preferredTimeReference` to **Eastern Standard Time** with `respectsDaylightSaving = true`. Supported clients can then work with and display values in Eastern Time while ArcGIS safely stores the underlying instant in UTC.

For the ArcGIS Pro publishing UI, select **`(UTC-05:00) Eastern Time (US & Canada)`** and enable **Adjust For Daylight Saving**. Do not use a fixed EST offset year-round.

Historical records with a date but no recorded time keep `time_known = false`. Any technical placeholder required by downstream systems must remain marked as imputed and must not be presented as an observed field time.

### ArcGIS Pro timezone automation

If analyzer warning `24195` appears for individual source layers/tables, run `scripts/fix_arcgis_phase7_timezones.py` in the ArcGIS Pro Python window. The script applies the Eastern source time reference to every date-bearing watershed layer/table and leaves time filtering disabled.

### Hosted preferred-time automation

After publication, run `scripts/configure_arcgis_online_eastern_preferred_time.py`. It sets the hosted feature service's `preferredTimeReference` to:

```json
{
  "timeZone": "Eastern Standard Time",
  "respectsDaylightSaving": true
}
```

The hosted service may still report `dateFieldsTimeReference = UTC`; that is expected and correct.

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

Before publication, set the ArcGIS Pro map coordinate system to **WGS 1984 / EPSG:4326**.

## Publication configuration

From ArcGIS Pro:

1. Confirm Penn State ArcGIS Online is the active portal and the correct account is signed in.
2. Confirm all five datasets are in the current map.
3. Set the map coordinate system to **WGS 1984 / EPSG:4326**.
4. Set the source/publishing time zone to **`(UTC-05:00) Eastern Time (US & Canada)`** with daylight-saving adjustment enabled.
5. Share the full map contents as a Web Layer.
6. Name: `Central_PA_Watershed_QC_Staging`.
7. Layer type: **Feature**.
8. Data: **Copy all data**.
9. Portal folder: `Central_PA_Watershed_Staging`.
10. Sharing: **owner only/private** during Phase 7.
11. Configure operations:
   - Enable editing.
   - Allow **Add**.
   - Allow **Update → Attributes only**.
   - Do **not** allow Delete.
   - Do **not** enable Sync.
   - Do **not** enable Export Data.
   - Do **not** enable public data collection.
   - Preserve editor tracking information where available.
   - Keep attachments/related data included.
12. Analyze before publishing. Resolve all errors before publish; review warnings individually.
13. Publish.
14. Run the hosted preferred-time automation so supported clients use Eastern Time.

## Static service IDs

- `SamplingSites` → `10`
- `SamplingEvents` → `20`
- `Measurements` → `30`
- `ValidationFlags` → `40`
- `AuditEvents` → `50`

## Why these editing settings

The staging service needs to accept new review records and allow workflow/status/reviewer attributes to change, but supervisors should not modify field geometry and nobody should delete scientific submissions as part of normal review.

## Verification in ArcGIS Online

Verify the hosted feature layer contains:

### Spatial layers
- `SamplingSites`
- `SamplingEvents`

### Tables
- `Measurements`
- `ValidationFlags`
- `AuditEvents`

### Relationships
Verify all five intended relationships survive publication.

### Attachments
Verify `SamplingEvents` supports attachments.

### Fields/domains
Spot-check coded domains on test type, collector category, workflow status, validation outcome, review decision, and validation severity.

### IDs
Verify GlobalID fields and GUID foreign keys are present.

### Time
- `dateFieldsTimeReference = UTC` is valid and expected for ArcGIS Online hosted Date storage.
- `preferredTimeReference` must be Eastern Time with daylight-saving enabled.

### Privacy
The staging item must remain owner-only/private.

## Important rules

- Do not import historical/production data in Phase 7.
- Do not create a public view yet.
- Do not remove landowner/internal fields from the staging source; exclude/hide them from future public-safe views instead.
- Do not treat the QC staging layer as the authoritative approved dataset.
- Do not overwrite the local file geodatabase as part of online editing.
- Product-facing timestamps use Eastern Time even though ArcGIS Online stores hosted Date values internally in UTC.

## Acceptance criteria

- Private hosted feature layer publishes successfully.
- Two spatial layers + three related tables are present.
- Relationships work after publishing.
- SamplingEvents attachments work.
- Domains/coded values survived publishing.
- GlobalID/GUID fields survived publishing.
- Hosted Date storage is accepted as UTC.
- Hosted `preferredTimeReference` is Eastern Time with daylight-saving enabled.
- Item is private.
- No real/historical observations are loaded.
- Map Viewer opens the service without schema errors.
