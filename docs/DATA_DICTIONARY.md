# Watershed Monitoring Platform — Data Dictionary

**Version:** 0.1.1  
**Status:** Draft — Step 4 is still in progress  
**Purpose:** Canonical data model for the current spreadsheet, future mobile collection, Firebase staging, automated validation, Workflow Manager review, ArcGIS publication, and dashboard views.

## 1. Naming rule: storage names vs display labels

Human-facing spreadsheet/dashboard labels may contain spaces, parentheses, symbols, and units. Backend field names remain machine-safe for Firebase, APIs, ArcGIS field names, scripts, and version control.

Examples:

| Display label | Backend / canonical name |
|---|---|
| `DO (%)` | `do_percent` / parameter code `DO_PERCENT` |
| `DO (ppm)` | `do_ppm` / parameter code `DO_PPM` |
| `Conductivity (µS/cm)` | `conductivity_us_cm` / `CONDUCTIVITY_US_CM` |
| `Q (m³/s)` | `discharge_m3_s` / `DISCHARGE_M3_S` |

**Rule:** use the display label in spreadsheets, forms, dashboards, ArcGIS aliases, and exports; use the backend name in databases and code.

## 2. Core data-model principles

1. Sampling sites and sampling events are separate. A site is a persistent place; an event is one visit/collection at a point in time.
2. Measurements are numeric, never numeric strings.
3. One sampling event may contain many measurements.
4. Firebase is staging; ArcGIS is authoritative.
5. Original submitted data is immutable and remains auditable.
6. Supervisors **do not directly edit scientific measurement values**. They approve, reject, or request correction. Corrections are made by the collector/researcher and resubmitted through validation.
7. All important workflow transitions create immutable audit events.
8. Validation flags and quality scores are separate concepts.
9. Only approved and successfully published records become authoritative.
10. Public dashboard views must exclude private/internal identity and access information, especially landowner information.
11. All timestamps are stored in UTC; UIs may display local time.
12. Measurement requiredness is protocol-driven and is not finalized yet.

## 3. Canonical entities

| Entity | Purpose | Firebase | ArcGIS | Public dashboard |
|---|---|---:|---:|---:|
| `SamplingSite` | Persistent monitoring location | Reference/cache | Authoritative point feature | Public-safe fields only |
| `SamplingEvent` | One field collection / submission | Staging document | Authoritative event record | Public-safe fields only |
| `Measurement` | Numeric parameter value | Nested/child records | Related table | Yes |
| `ValidationFlag` | Machine-generated QC finding | Child records | Protected/internal table | No by default |
| `AuditEvent` | Immutable state/change history | Child records | Protected/internal table/archive | No |
| `ParameterDefinition` | Parameter labels, units, precision | Config | Reference/config | Read-only labels as needed |

## 4. SamplingSite

**ArcGIS type:** Point feature class  
**Primary key:** `site_id` UUID  
**Relationship:** `SamplingSite.site_id` 1:N `SamplingEvent.site_id`

| Field | Type | Required | Public? | Notes |
|---|---|---:|---:|---|
| `site_id` | UUID/string(36) | Yes | Yes | Stable system ID; never reused |
| `site_code` | string(32) | Yes | Yes | Human-safe code, e.g. `WB-001` |
| `site_name_public` | string(160) | Yes before publication | Yes | Public-safe dashboard label |
| `site_name_internal` | string(200) | No | **No** | Internal identifier; may include private/local naming context |
| `landowner_name` | string(200) | No | **Never** | Backend identification only |
| `landowner_notes` | string(1000) | No | **Never** | Backend access/context only |
| `access_notes_internal` | string(1000) | No | **Never** | Gate/access/contact/safety details |
| `watershed_name` | string(120) | No | Yes | Watershed/basin name |
| `site_status` | string(20) | Yes | Yes | `ACTIVE`, `INACTIVE`, `RETIRED` |
| `latitude` | double | Yes | Yes | Decimal degrees |
| `longitude` | double | Yes | Yes | Decimal degrees |
| `site_description_public` | string(2000) | No | Yes | Public-safe site context |
| `created_at` | datetime UTC | Yes | No | System timestamp |
| `updated_at` | datetime UTC | Yes | No | System timestamp |
| `schema_version` | string(20) | Yes | No | SemVer |

### Site privacy rule

The dashboard and any public hosted feature-layer view must **not expose** `site_name_internal`, `landowner_name`, `landowner_notes`, or `access_notes_internal`. If a current spreadsheet `SiteName` contains a landowner/person name, it is imported into an internal field and a separate `site_name_public` must be assigned before public release.

## 5. SamplingEvent

**Firebase:** `submissions/{submission_id}`  
**ArcGIS:** authoritative event feature/table  
**Primary key:** `event_id` UUID

### 5.1 Identity, collection context, and review

| Field | Type | Required | Public? | Notes |
|---|---|---:|---:|---|
| `event_id` | UUID/string(36) | Yes | No | Canonical event ID |
| `submission_id` | UUID/string(36) | Yes | No | Firebase staging ID retained after publication |
| `site_id` | UUID/string(36) | Yes | Yes | FK → `SamplingSite` |
| `test_type` | string(80) | Yes | Yes | Current records: `In-situ/Penn State Lab`; future values allowed through controlled domain |
| `data_collected_by` | string(80) | Yes | Yes | Current records: `Student/researcher`; classification, not personal identity |
| `collector_user_id` | string(128) | Yes for future app | **No** | Authenticated person/account ID |
| `collected_at` | datetime UTC | Yes | Yes | Actual sampling date/time |
| `submitted_at` | datetime UTC | Yes after submit | No | Server timestamp |
| `review_status` | string(30) | Yes | Optional | Human review status; see domain below |
| `review_comment` | string(4000) | No | **No by default** | Supervisor feedback/internal QC note |
| `reviewer_user_id` | string(128) | No | **No** | Protected reviewer identity |
| `reviewed_at` | datetime UTC | No | No | Review timestamp |
| `published_at` | datetime UTC | No | No | Set only after ArcGIS publication is verified |

### 5.2 Location and conditions

| Field | Type | Required | Public? | Notes |
|---|---|---:|---:|---|
| `latitude` | double | Yes | Yes | Actual collection latitude |
| `longitude` | double | Yes | Yes | Actual collection longitude |
| `gps_accuracy_m` | double | TBD for current historical data | No | Future mobile GPS accuracy |
| `site_distance_m` | double | No | No | Calculated distance from registered site |
| `weather_condition` | string(50) | No | Yes | Current spreadsheet field |
| `field_notes_original` | string(4000) | No | No by default | Immutable collector notes |
| `photo_count` | integer | Yes for app | No | Derived from attachments |

### 5.3 Workflow and quality

| Field | Type | Required | Public? | Notes |
|---|---|---:|---:|---|
| `workflow_status` | string(30) | Yes | No | Full staging/publication state machine |
| `validation_outcome` | string(24) | After validation | No | `PASS`, `PASS_WITH_WARNINGS`, `FAIL` |
| `completeness_score` | double | No | TBD | 0–100 |
| `location_quality_score` | double | No | TBD | 0–100 |
| `measurement_quality_score` | double | No | TBD | 0–100 |
| `temporal_quality_score` | double | No | TBD | 0–100 |
| `overall_quality_score` | double | No | TBD | 0–100; dashboard exposure not yet decided |
| `error_flag_count` | integer | Yes after validation | No | ERROR findings |
| `warning_flag_count` | integer | Yes after validation | No | WARNING findings |
| `info_flag_count` | integer | Yes after validation | No | INFO findings |

### 5.4 Version/provenance

| Field | Type | Required | Public? | Notes |
|---|---|---:|---:|---|
| `arcgis_global_id` | GUID | After publication | No | Durable ArcGIS publication reference |
| `arcgis_object_id` | integer | After publication | No | Convenience reference only |
| `schema_version` | string(20) | Yes | No | Data schema version |
| `validation_rules_version` | string(20) | After validation | No | Exact validation rules used |
| `quality_algorithm_version` | string(20) | After scoring | No | Exact scoring algorithm used |
| `mobile_app_version` | string(30) | Future app | No | Client version/build |
| `publish_attempt_count` | integer | Yes | No | Retry/audit support |
| `last_publish_error_code` | string(120) | No | No | Protected diagnostic field |

## 6. Measurement

**ArcGIS type:** related table  
**Firebase:** nested/child records within submission  
**Primary key:** `measurement_id` UUID  
**Relationship:** N:1 to `SamplingEvent.event_id`

| Field | Type | Required | Notes |
|---|---|---:|---|
| `measurement_id` | UUID/string(36) | Yes | Stable record ID |
| `event_id` | UUID/string(36) | Yes | Parent sampling event |
| `parameter_code` | string(40) | Yes | Stable machine code |
| `value_original` | double | Yes | Immutable submitted/imported numeric value |
| `value_current` | double | Yes after accepted correction | Effective value used downstream |
| `unit_code` | string(24) | Yes | Explicit unit |
| `source_column` | string(80) | No | Original spreadsheet/app label for provenance |
| `measurement_method` | string(120) | No | Instrument/lab method if available in future |
| `instrument_id` | string(80) | No | Future traceability |
| `required_by_protocol` | boolean | Yes once protocols are defined | Requiredness at time of collection |
| `measurement_notes` | string(1000) | No | Parameter-specific notes |
| `schema_version` | string(20) | Yes | Measurement schema version |

**Correction policy:** supervisors cannot populate or change scientific `value_current` directly. If a value is wrong, the supervisor requests correction. The collector/researcher submits the corrected value; the original remains preserved in audit history.

## 7. Current spreadsheet / historical import schema

The following columns are required to be supported for the current dataset. Human-facing labels should use units in parentheses.

| Spreadsheet label | Backend mapping | Data type | Initial/default value or notes |
|---|---|---|---|
| `SiteID` | `site_id` / import site key | string | Existing identifier mapped to stable site UUID |
| `SiteName` | `site_name_internal` or `site_name_public` after privacy review | string | **Must be screened for landowner/private names before public display** |
| `Test Type` | `test_type` | string | Current records: `In-situ/Penn State Lab` |
| `Data Collected By` | `data_collected_by` | string | Current records: `Student/researcher` |
| `Review Status` | `review_status` | string | Review/QC state |
| `Review Comment` | `review_comment` | string | Internal by default |
| `Latitude` | `latitude` | double | decimal degrees |
| `Longitude` | `longitude` | double | decimal degrees |
| `Date` | `collected_at` | datetime | Convert to canonical UTC timestamp where time is known |
| `Weather Condition` | `weather_condition` | string | controlled later |
| `Temp (F)` | source/derived temperature Fahrenheit | double | Preserve current source column; may be derived from canonical °C later |
| `Temp (C)` | `WATER_TEMP_C` | double | °C |
| `pH` | `PH` | double | pH |
| `DO (%)` | `DO_PERCENT` | double | % |
| `DO (ppm)` | `DO_PPM` | double | ppm |
| `Conductivity (µS/cm)` | `CONDUCTIVITY_US_CM` | double | µS/cm |
| `TDS (ppm)` | `TDS_PPM` | double | ppm |
| `ORP (mV)` | `ORP_MV` | double | mV |
| `Chloride (mg/L)` | `CHLORIDE_MG_L` | double | mg/L |
| `Sulphate (mg/L)` | `SULFATE_MG_L` | double | mg/L; display spelling follows current dataset |
| `Nitrate (mg/L)` | `NITRATE_MG_L` | double | mg/L |
| `Phosphate (mg/L)` | `PHOSPHATE_MG_L` | double | mg/L |
| `Q (m³/s)` | `DISCHARGE_M3_S` | double | cubic meters per second |

### Temperature preservation rule

Current data may contain both `Temp (F)` and `Temp (C)`. The import process will preserve both source values for traceability. Canonical analytics should use Celsius. Fahrenheit can be retained as source provenance and/or generated as a display/export value. We will validate that paired F/C values are consistent rather than silently choosing one.

## 8. Initial parameter catalog

| Code | Display label | Canonical unit | Type | Notes |
|---|---|---|---|---|
| `PH` | `pH` | pH | double | No parenthetical unit needed |
| `WATER_TEMP_C` | `Temp (C)` | °C | double | Canonical analytics temperature |
| `WATER_TEMP_F` | `Temp (F)` | °F | double | Source/display support for existing data |
| `DO_PERCENT` | `DO (%)` | % | double | Dissolved oxygen saturation |
| `DO_PPM` | `DO (ppm)` | ppm | double | Existing dataset label/value |
| `CONDUCTIVITY_US_CM` | `Conductivity (µS/cm)` | µS/cm | double | Conductivity/specific conductance |
| `TDS_PPM` | `TDS (ppm)` | ppm | double | Total dissolved solids |
| `ORP_MV` | `ORP (mV)` | mV | double | Oxidation-reduction potential |
| `CHLORIDE_MG_L` | `Chloride (mg/L)` | mg/L | double |  |
| `SULFATE_MG_L` | `Sulphate (mg/L)` | mg/L | double | Internal code uses standard `SULFATE` spelling |
| `NITRATE_MG_L` | `Nitrate (mg/L)` | mg/L | double |  |
| `PHOSPHATE_MG_L` | `Phosphate (mg/L)` | mg/L | double |  |
| `DISCHARGE_M3_S` | `Q (m³/s)` | m³/s | double | Quantitative discharge/streamflow |

Validation thresholds and mandatory/optional parameter rules are intentionally **not finalized yet**.

## 9. Review status domain

Initial review-facing states:

- `PENDING_REVIEW`
- `NEEDS_CORRECTION`
- `APPROVED`
- `REJECTED`

The complete technical workflow also includes `DRAFT`, `SUBMITTED`, `VALIDATING`, `RESUBMITTED`, `PUBLISHING`, `PUBLISH_FAILED`, and `PUBLISHED`.

## 10. Public/private publication boundary

A public ArcGIS hosted feature-layer view / dashboard data source will contain only public-safe fields. At minimum, the following are **excluded** from normal viewer access:

- `landowner_name`
- `landowner_notes`
- `site_name_internal`
- `access_notes_internal`
- `collector_user_id`
- `reviewer_user_id`
- `review_comment` unless we explicitly decide to publish sanitized QC notes later
- Firebase submission identifiers
- authentication/account identifiers
- internal audit events
- diagnostic publication errors

The dashboard uses `site_name_public` and never directly uses an unscreened private/internal site-name field.

## 11. AuditEvent

Audit history is append-only. Important events include `CREATED`, `SUBMITTED`, `VALIDATED`, `RETURNED`, `RESUBMITTED`, `APPROVED`, `REJECTED`, `PUBLISH_STARTED`, `PUBLISH_FAILED`, and `PUBLISHED`.

Required audit attributes include:

- audit event ID
- submission/event ID
- event type
- actor type and protected actor ID where applicable
- UTC timestamp
- previous/new workflow state
- affected field/measurement when relevant
- old/new snapshot when relevant
- reason/comment
- schema/rule version

## 12. Open Step-4 decisions

Step 4 remains open. We still need to decide:

1. Mandatory vs optional measurement parameters for each sampling protocol.
2. Test-type controlled vocabulary beyond `In-situ/Penn State Lab`.
3. Whether instrument/method information is required for future submissions.
4. Error vs warning thresholds and instrument limits.
5. Required GPS accuracy for mobile collection.
6. Public dashboard treatment of quality scores (0–100 vs simplified status).
7. Exact handling of historical rows that contain private names in `SiteName`.
8. Date/time assumptions for historical rows where only a date is available.
9. Final public site naming convention.

Do not start Step 5 until these Step-4 decisions and the current-data import mapping are reviewed.