# Step 6 — ArcGIS IDs, Relationships, Domains, Attachments, and Editor Tracking

**Status:** Active — automated setup completed; final verification in progress  
**Target:** ArcGIS Pro 3.7.x  
**Working geodatabase:** `CentralPA_Watershed.gdb`

## Verified Phase-5 baseline

- `SamplingSites` — point feature class, WGS 1984 / EPSG:4326
- `SamplingEvents` — point feature class, WGS 1984 / EPSG:4326
- `Measurements` — table
- `ValidationFlags` — table
- `AuditEvents` — table

No production/historical data has been loaded.

## Phase-6 objectives

1. Add ArcGIS-maintained `GlobalID` fields to all five core datasets.
2. Add GUID foreign-key fields used by geodatabase relationship classes.
3. Create one-to-many relationship classes using `GlobalID` → `GUID` pairs.
4. Create and assign coded-value domains for controlled fields.
5. Enable attachments on `SamplingEvents` for field photos/documents.
6. Enable editor tracking in UTC on all core datasets.
7. Preserve external/string IDs (`site_id`, `event_id`, `measurement_id`, etc.) for cross-system traceability while using GlobalID/GUID for ArcGIS relationships.

## Current ArcGIS Pro evidence

The Phase-6 setup script completed successfully. The ArcGIS Pro Catalog visibly contains:

- `Sites_Events_Rel`
- `Events_Measurements_Rel`
- `Events_ValidationFlags_Rel`
- `Events_AuditEvents_Rel`
- `Measurements_ValidationFlags_Rel`
- `SamplingEvents__ATTACH`
- `SamplingEvents__ATTACHREL`

The ArcGIS Pro Python output reports:

- GlobalIDs on `SamplingSites`, `SamplingEvents`, `Measurements`, `ValidationFlags`, and `AuditEvents`
- GUID foreign keys on `SamplingEvents.site_guid`, `Measurements.event_guid`, `ValidationFlags.event_guid`, `ValidationFlags.measurement_guid`, and `AuditEvents.event_guid`
- Attachments enabled on `SamplingEvents`
- UTC editor tracking enabled on all five core datasets

A read-only verifier is available at `scripts/verify_arcgis_phase6.py` and should be used for the final gate.

## Relationship architecture

```text
SamplingSites.GlobalID
        |
        | 1:N
        v
SamplingEvents.site_guid

SamplingEvents.GlobalID
        |
        +---- 1:N ---> Measurements.event_guid
        +---- 1:N ---> ValidationFlags.event_guid
        +---- 1:N ---> AuditEvents.event_guid

Measurements.GlobalID
        |
        +---- 1:N ---> ValidationFlags.measurement_guid
```

The string UUID fields remain canonical cross-platform identifiers. The GlobalID/GUID fields are ArcGIS-native relationship keys.

## GUID fields

- `SamplingEvents.site_guid`
- `Measurements.event_guid`
- `ValidationFlags.event_guid`
- `ValidationFlags.measurement_guid`
- `AuditEvents.event_guid`

## Relationship classes

- `Sites_Events_Rel`
- `Events_Measurements_Rel`
- `Events_ValidationFlags_Rel`
- `Events_AuditEvents_Rel`
- `Measurements_ValidationFlags_Rel`

All are simple, one-to-many relationships.

## Coded-value domains

- `DOM_SiteStatus`
- `DOM_WorkflowStatus`
- `DOM_ValidationOutcome`
- `DOM_ReviewDecision`
- `DOM_WeatherCondition`
- `DOM_TemperatureUnit`
- `DOM_Boolean01`
- `DOM_TestType`
- `DOM_DataCollectedBy`
- `DOM_FlagSeverity`
- `DOM_FlagCategory`
- `DOM_ActorType`

## Domain assignments

### SamplingSites
- `site_status` → `DOM_SiteStatus`

### SamplingEvents
- `data_collected_by` → `DOM_DataCollectedBy`
- `test_type` → `DOM_TestType`
- `time_known` → `DOM_Boolean01`
- `time_imputed` → `DOM_Boolean01`
- `weather_condition` → `DOM_WeatherCondition`
- `temp_entered_unit` → `DOM_TemperatureUnit`
- `workflow_status` → `DOM_WorkflowStatus`
- `validation_outcome` → `DOM_ValidationOutcome`
- `review_decision` → `DOM_ReviewDecision`

### Measurements
- `required_by_protocol` → `DOM_Boolean01`

### ValidationFlags
- `severity` → `DOM_FlagSeverity`
- `category` → `DOM_FlagCategory`
- `resolved` → `DOM_Boolean01`

### AuditEvents
- `actor_type` → `DOM_ActorType`
- `previous_state` → `DOM_WorkflowStatus`
- `new_state` → `DOM_WorkflowStatus`

## Attachments

Attachments are enabled on `SamplingEvents`. ArcGIS created `SamplingEvents__ATTACH` and `SamplingEvents__ATTACHREL` automatically.

## Editor tracking

Editor tracking is enabled on all five core datasets with UTC timestamps and ArcGIS-managed fields:

- `arcgis_created_by`
- `arcgis_created_at`
- `arcgis_edited_by`
- `arcgis_edited_at`

These do not replace scientific provenance fields such as `collected_at`, `submitted_at`, `reviewed_at`, or immutable `AuditEvents`; they record GIS-level editing activity.

## Final verification

Run `scripts/verify_arcgis_phase6.py` from the ArcGIS Pro Python Window. It performs read-only checks for:

1. GlobalID fields and types
2. GUID foreign-key fields and types
3. All five relationship classes
4. All coded-value domains
5. All intended domain assignments
6. Attachment table and relationship
7. Editor tracking state and UTC configuration where exposed by ArcPy

Phase 6 closes only when the verifier reports `PHASE 6 VERIFIED: ALL CHECKS PASSED` and the project saves/reopens cleanly.

## Important rules

- Do not load production data yet.
- Do not delete the existing external/string IDs.
- Do not expose private/internal fields in future public views.
- `GlobalID` is ArcGIS-maintained; GUID foreign keys are populated by our import/publishing logic.
- `APPROVED` is not equivalent to `PUBLISHED`.
- Supervisor corrections still return to the collector rather than directly modifying scientific values.
