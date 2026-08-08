# Step 6 — ArcGIS IDs, Relationships, Domains, Attachments, and Editor Tracking

**Status:** Active  
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

## GUID fields to add

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

### `DOM_SiteStatus`
- `ACTIVE` — Active
- `INACTIVE` — Inactive
- `RETIRED` — Retired

### `DOM_WorkflowStatus`
- `DRAFT`
- `SUBMITTED`
- `VALIDATING`
- `PENDING_REVIEW`
- `NEEDS_CORRECTION`
- `RESUBMITTED`
- `APPROVED`
- `REJECTED`
- `PUBLISHING`
- `PUBLISH_FAILED`
- `PUBLISHED`

### `DOM_ValidationOutcome`
- `PASS`
- `PASS_WITH_WARNINGS`
- `FAIL`

### `DOM_ReviewDecision`
- `APPROVE`
- `REQUEST_CORRECTION`
- `REJECT`

### `DOM_WeatherCondition`
- `CLEAR`
- `PARTLY_CLOUDY`
- `CLOUDY`
- `RAIN`
- `SNOW`
- `FOG`
- `OTHER`
- `UNKNOWN`

### `DOM_TemperatureUnit`
- `C` — Celsius
- `F` — Fahrenheit

### `DOM_Boolean01`
- `0` — No
- `1` — Yes

### `DOM_TestType`
- `IN_SITU_FIELD` — In-situ / Field Instrument
- `PENN_STATE_LAB` — Penn State Lab
- `EXTERNAL_LAB` — External Lab
- `FIELD_KIT_COLORIMETRIC` — Field Kit / Colorimetric
- `CONTINUOUS_SENSOR` — Continuous Sensor / Sonde
- `IN_SITU_PSU_LAB` — In-situ/Penn State Lab
- `OTHER` — Other

### `DOM_DataCollectedBy`
- `STUDENT_RESEARCHER` — Student/researcher
- `FACULTY_STAFF` — Faculty/staff
- `VOLUNTEER` — Volunteer/community monitor
- `PARTNER_ORG` — Partner organization
- `OTHER` — Other

### `DOM_FlagSeverity`
- `ERROR`
- `PLAUSIBILITY_WARNING`
- `ENVIRONMENTAL_ALERT`
- `INFO`

### `DOM_FlagCategory`
- `SCHEMA`
- `LOCATION`
- `MEASUREMENT`
- `METHOD`
- `TEMPORAL`
- `DUPLICATE`
- `PROVENANCE`
- `OTHER`

### `DOM_ActorType`
- `COLLECTOR`
- `SUPERVISOR`
- `SYSTEM`
- `ADMIN`

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

Enable attachments on `SamplingEvents`. This is where field photos and related collection evidence belong. ArcGIS will create its attachment table and attachment relationship class automatically.

## Editor tracking

Enable editor tracking on all five core datasets with UTC timestamps and ArcGIS-managed fields:

- `arcgis_created_by`
- `arcgis_created_at`
- `arcgis_edited_by`
- `arcgis_edited_at`

These do not replace scientific provenance fields such as `collected_at`, `submitted_at`, `reviewed_at`, or immutable `AuditEvents`; they record GIS-level editing activity.

## Important rules

- Do not load production data yet.
- Do not delete the existing external/string IDs.
- Do not expose private/internal fields in future public views.
- `GlobalID` is ArcGIS-maintained; GUID foreign keys are populated by our import/publishing logic.
- `APPROVED` is not equivalent to `PUBLISHED`.
- Supervisor corrections still return to the collector rather than directly modifying scientific values.

## Completion criteria

- All five core datasets have GlobalIDs.
- Required GUID foreign-key fields exist.
- Five relationship classes exist and use GlobalID/GUID keys.
- Domains exist and are assigned to the intended fields.
- `SamplingEvents` has attachments enabled.
- Editor tracking is enabled in UTC on the five core datasets.
- Project saves and reopens cleanly.
