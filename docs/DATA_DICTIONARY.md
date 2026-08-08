# Watershed Monitoring Platform — Data Dictionary

**Version:** 0.1.0  
**Status:** Draft for architecture review  
**Purpose:** Canonical data model that will drive ArcGIS Pro, Firebase staging, validation, Workflow Manager integration, and the dashboard.

## 1. Data-model principles

1. **Sampling sites and sampling events are separate.** A site is a persistent place. A sampling event is one field visit/collection at a point in time.
2. **Measurements are stored as numeric values, never numeric strings.**
3. **One sampling event can contain many measurements.** Measurements use a normalized child table so new parameters can be added without redesigning the entire database.
4. **Firebase is staging. ArcGIS is authoritative.** Unapproved submissions remain in Firebase; only approved and successfully published records become authoritative in ArcGIS.
5. **Original field data is immutable.** Corrections create reviewed/current values and audit events; the originally submitted value is never silently replaced.
6. **All timestamps are stored in UTC.** User interfaces may display local time.
7. **Geometry uses WGS 84 latitude/longitude for interchange.** ArcGIS may project for analysis, but the source sampling location is preserved.
8. **Required measurement parameters are protocol-driven.** Structural fields are always required; specific water-quality parameters can be required or optional by sampling protocol.
9. **Quality scoring and validation are different concepts.** Hard errors, warnings, informational flags, and quality scores are stored independently.
10. **Public views exclude internal identity/review fields.** Collector and reviewer identifiers are kept in protected/internal data only.

## 2. Canonical entities

| Entity | Purpose | Firebase | ArcGIS | Public |
|---|---|---:|---:|---:|
| `SamplingSite` | Persistent monitoring location | Read/reference copy | Authoritative point feature class | Yes |
| `SamplingEvent` | One field collection visit/submission | Staging document | Authoritative point feature class | Yes, filtered fields |
| `Measurement` | One parameter value collected during an event | Nested under submission | Related table | Yes |
| `ValidationFlag` | Machine-generated QC finding | Subcollection/array | Related table or protected service | No by default |
| `AuditEvent` | Immutable history of important state/change events | Subcollection | Protected related table/archive | No |
| `ParameterDefinition` | Parameter metadata, units, precision, requiredness defaults | App/config cache | Optional reference table | No direct public editing |

## 3. `SamplingSite`

**ArcGIS type:** Point feature class  
**Primary ID:** `siteId` (UUID string)  
**Relationship:** `SamplingSite.siteId` 1:N `SamplingEvent.siteId`

| Field | Type | Required | Units / Domain | Source | Notes |
|---|---|---:|---|---|---|
| `siteId` | UUID/string(36) | Yes | Unique | System | Stable ID; never reused |
| `siteCode` | string(32) | Yes | Unique human-readable code | Admin | Example: `WB-001` |
| `siteName` | string(160) | Yes | — | Admin | Human-readable location name |
| `watershedName` | string(120) | Yes | Controlled where possible | Admin/GIS | Watershed or basin name |
| `siteStatus` | string(20) | Yes | `ACTIVE`, `INACTIVE`, `RETIRED` | Admin | Controls collection availability |
| `latitude` | double | Yes | decimal degrees | Geometry | Convenience/export field |
| `longitude` | double | Yes | decimal degrees | Geometry | Convenience/export field |
| `accessNotes` | string(1000) | No | — | Admin | Safe access / location notes |
| `siteDescription` | string(2000) | No | — | Admin | General site metadata |
| `createdAt` | datetime UTC | Yes | ISO-8601 | System | Creation timestamp |
| `updatedAt` | datetime UTC | Yes | ISO-8601 | System | Last metadata update |
| `schemaVersion` | string(20) | Yes | SemVer | System | Schema used for record |

## 4. `SamplingEvent`

**ArcGIS type:** Point feature class  
**Firebase type:** `submissions/{submissionId}` document  
**Primary ID:** `eventId` (UUID string)  
**Relationship:** N:1 to `SamplingSite`; 1:N to `Measurement`, `ValidationFlag`, and `AuditEvent`.

### 4.1 Identity and timing

| Field | Type | Required | Units / Domain | Source | Notes |
|---|---|---:|---|---|---|
| `eventId` | UUID/string(36) | Yes | Unique | System | Canonical event identifier |
| `submissionId` | UUID/string(36) | Yes | Unique | Mobile/backend | Staging submission identifier; retained after publication |
| `siteId` | UUID/string(36) | Yes | FK → SamplingSite | User selection/system | Required monitoring site |
| `collectorUserId` | string(128) | Yes | Internal | Authentication | Never exposed in public view |
| `collectedAt` | datetime UTC | Yes | ISO-8601 | Device/user | Actual sampling time |
| `submittedAt` | datetime UTC | Yes after submit | ISO-8601 | Backend | Server timestamp |
| `reviewedAt` | datetime UTC | No | ISO-8601 | Workflow | Set after human review |
| `publishedAt` | datetime UTC | No | ISO-8601 | Publishing service | Set only after verified ArcGIS publication |

### 4.2 Location and field context

| Field | Type | Required | Units / Domain | Source | Notes |
|---|---|---:|---|---|---|
| `latitude` | double | Yes | decimal degrees | Device GPS | Actual collection location, not just site centroid |
| `longitude` | double | Yes | decimal degrees | Device GPS | Actual collection location |
| `gpsAccuracyM` | double | Yes | meters | Device GPS | Horizontal accuracy reported by device |
| `siteDistanceM` | double | No | meters | Validation engine | Distance from expected site point |
| `weatherCondition` | string(30) | No | Weather domain | Collector | Optional field condition |
| `airTemperatureC` | double | No | °C | Collector/instrument | Canonical storage in Celsius; Fahrenheit is display-only |
| `streamflowCondition` | string(30) | No | Flow-condition domain | Collector | Qualitative condition |
| `streamflowValueCfs` | double | No | ft³/s | Collector/instrument | Only when quantitative flow is actually measured |
| `fieldNotesOriginal` | string(4000) | No | — | Collector | Original notes; immutable after submission |
| `fieldNotesReviewed` | string(4000) | No | — | Reviewer | Optional reviewed/corrected interpretation |
| `photoCount` | integer | Yes | >= 0 | System | Derived from attachments |

### 4.3 Workflow, validation, and quality

| Field | Type | Required | Units / Domain | Source | Notes |
|---|---|---:|---|---|---|
| `workflowStatus` | string(30) | Yes | Workflow-status domain | Backend/workflow | Current staging state |
| `validationOutcome` | string(24) | No until validation | `PASS`, `PASS_WITH_WARNINGS`, `FAIL` | Validation engine | Not the same as supervisor approval |
| `completenessScore` | double | No | 0–100 | Validation engine | Required-field/protocol completeness |
| `locationQualityScore` | double | No | 0–100 | Validation engine | GPS/site-location quality |
| `measurementQualityScore` | double | No | 0–100 | Validation engine | Measurement-specific QA score |
| `temporalQualityScore` | double | No | 0–100 | Validation engine | Timestamp/recency/sequence quality |
| `overallQualityScore` | double | No | 0–100 | Validation engine | Composite score; algorithm versioned |
| `errorFlagCount` | integer | Yes | >= 0 | Validation engine | Count of ERROR flags |
| `warningFlagCount` | integer | Yes | >= 0 | Validation engine | Count of WARNING flags |
| `infoFlagCount` | integer | Yes | >= 0 | Validation engine | Count of INFO flags |
| `reviewDecision` | string(30) | No | Review-decision domain | Supervisor | Approval gate outcome |
| `reviewerUserId` | string(128) | No | Internal | Workflow | Protected field |
| `reviewerComments` | string(4000) | No | — | Supervisor | Required for rejection/correction request |

### 4.4 Publication and version provenance

| Field | Type | Required | Units / Domain | Source | Notes |
|---|---|---:|---|---|---|
| `arcgisGlobalId` | GUID/string(38) | No until published | ArcGIS GUID | Publishing service | Returned/verified ArcGIS record identifier |
| `arcgisObjectId` | integer | No until published | ArcGIS OID | Publishing service | Convenience only; GlobalID is the durable reference |
| `schemaVersion` | string(20) | Yes | SemVer | App/backend | Example `0.1.0` |
| `validationRulesVersion` | string(20) | Yes after validation | SemVer | Validation engine | Exact rule set used |
| `qualityAlgorithmVersion` | string(20) | Yes after scoring | SemVer | Validation engine | Exact scoring algorithm used |
| `mobileAppVersion` | string(30) | Yes | SemVer/build | Mobile app | Submission client version |
| `publishAttemptCount` | integer | Yes | >= 0 | Publishing service | Supports retry/audit |
| `lastPublishErrorCode` | string(120) | No | — | Publishing service | Protected diagnostic field |

## 5. `Measurement`

**ArcGIS type:** Related table  
**Firebase representation:** Nested `measurements` map/array inside the staging submission.  
**Primary ID:** `measurementId` (UUID string)  
**Relationship:** N:1 to `SamplingEvent.eventId`.

This normalized structure avoids storing measurements as text and avoids adding a new database column every time a new water-quality parameter is introduced.

| Field | Type | Required | Units / Domain | Source | Notes |
|---|---|---:|---|---|---|
| `measurementId` | UUID/string(36) | Yes | Unique | System | Stable measurement record ID |
| `eventId` | UUID/string(36) | Yes | FK → SamplingEvent | System | Parent event |
| `parameterCode` | string(40) | Yes | Parameter catalog | App | Example `PH`, `DO_MG_L` |
| `valueOriginal` | double | Yes | Canonical parameter unit | Collector/instrument | Immutable submitted value |
| `valueReviewed` | double | No | Same unit | Reviewer | Only populated if a justified correction is made |
| `valueCurrent` | double | Yes after review/publish | Same unit | System | Effective value used downstream; original unless reviewed |
| `unitCode` | string(24) | Yes | Parameter catalog | App/system | Explicit even when canonical |
| `measurementMethod` | string(80) | No | Controlled/free text TBD | Collector/protocol | Meter, strip, lab method, etc. |
| `instrumentId` | string(80) | No | Internal catalog | Collector/protocol | Optional instrument traceability |
| `detectionLimit` | double | No | Same unit | Protocol/instrument | If applicable |
| `isBelowDetectionLimit` | boolean | Yes | true/false | Collector/validation | Never encode `<0.1` in a numeric field |
| `requiredByProtocol` | boolean | Yes | true/false | Protocol config | Captures requirement at collection time |
| `measurementNotes` | string(1000) | No | — | Collector/reviewer | Parameter-specific notes |
| `schemaVersion` | string(20) | Yes | SemVer | System | Record schema version |

### 5.1 Initial parameter catalog

Validation limits are intentionally **not hard-coded here yet**. Instrument limits and scientific thresholds will be defined in versioned validation rules after the data model is approved.

| Code | Parameter | Canonical unit | Storage type | Typical UI precision | MVP status |
|---|---|---|---|---:|---|
| `PH` | pH | pH units | double | 2 decimals | Core |
| `DO_MG_L` | Dissolved oxygen | mg/L | double | 2 | Core |
| `DO_PERCENT` | Dissolved oxygen saturation | % | double | 1 | Core |
| `WATER_TEMP_C` | Water temperature | °C | double | 2 | Core |
| `CONDUCTIVITY_US_CM` | Conductivity / specific conductance | µS/cm | double | 1 | Core |
| `TDS_MG_L` | Total dissolved solids | mg/L | double | 1 | Core |
| `NITRATE_MG_L` | Nitrate | mg/L | double | 2 | Configurable |
| `PHOSPHATE_MG_L` | Phosphate | mg/L | double | 2 | Configurable |
| `CHLORIDE_MG_L` | Chloride | mg/L | double | 2 | Configurable |
| `SULFATE_MG_L` | Sulfate | mg/L | double | 2 | Configurable |
| `SALINITY_PPT` | Salinity | ppt | double | 2 | Configurable |

## 6. `ValidationFlag`

**Purpose:** Stores each machine-generated finding independently of the overall score.

| Field | Type | Required | Domain / Notes |
|---|---|---:|---|
| `flagId` | UUID/string(36) | Yes | Unique |
| `eventId` | UUID/string(36) | Yes | Parent event |
| `measurementId` | UUID/string(36) | No | Set when flag is parameter-specific |
| `ruleId` | string(80) | Yes | Stable rule identifier |
| `ruleVersion` | string(20) | Yes | Rule version |
| `severity` | string(12) | Yes | `ERROR`, `WARNING`, `INFO` |
| `category` | string(40) | Yes | `SCHEMA`, `LOCATION`, `MEASUREMENT`, `TEMPORAL`, `DUPLICATE`, `OTHER` |
| `message` | string(1000) | Yes | Human-readable explanation |
| `observedValue` | string(200) | No | Text snapshot for audit only; canonical measurement remains numeric |
| `createdAt` | datetime UTC | Yes | Server timestamp |
| `resolved` | boolean | Yes | Whether reviewer/collector addressed the flag |
| `resolutionNote` | string(1000) | No | Required when manually resolved/overridden |

## 7. `AuditEvent`

**Purpose:** Append-only history. Audit rows are never edited or deleted during normal operation.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `auditEventId` | UUID/string(36) | Yes | Unique event ID |
| `submissionId` | UUID/string(36) | Yes | Submission being tracked |
| `eventId` | UUID/string(36) | No | Populated after event ID exists |
| `eventType` | string(50) | Yes | Examples: `CREATED`, `SUBMITTED`, `VALIDATED`, `RETURNED`, `RESUBMITTED`, `APPROVED`, `REJECTED`, `PUBLISH_STARTED`, `PUBLISH_FAILED`, `PUBLISHED`, `VALUE_CORRECTED` |
| `actorType` | string(20) | Yes | `COLLECTOR`, `SUPERVISOR`, `SYSTEM`, `ADMIN` |
| `actorUserId` | string(128) | No | Null for system-generated events |
| `occurredAt` | datetime UTC | Yes | Server timestamp |
| `previousState` | string(30) | No | Workflow state before event |
| `newState` | string(30) | No | Workflow state after event |
| `fieldPath` | string(200) | No | For value-level changes |
| `oldValue` | string(1000) | No | Audit snapshot only |
| `newValue` | string(1000) | No | Audit snapshot only |
| `reason` | string(2000) | No | Required for manual correction/rejection/override |
| `schemaVersion` | string(20) | Yes | Audit schema version |

## 8. Controlled domains

### 8.1 Workflow status

`DRAFT` → `SUBMITTED` → `VALIDATING` → `PENDING_REVIEW`

From `PENDING_REVIEW`:
- `NEEDS_CORRECTION` → `RESUBMITTED` → `VALIDATING`
- `REJECTED`
- `APPROVED` → `PUBLISHING` → `PUBLISHED`
- `PUBLISHING` → `PUBLISH_FAILED` → retry → `PUBLISHING`

### 8.2 Review decision

- `APPROVE`
- `REQUEST_CORRECTION`
- `REJECT`

### 8.3 Site status

- `ACTIVE`
- `INACTIVE`
- `RETIRED`

### 8.4 Weather condition

Initial domain: `CLEAR`, `PARTLY_CLOUDY`, `CLOUDY`, `RAIN`, `SNOW`, `FOG`, `OTHER`, `UNKNOWN`.

### 8.5 Streamflow condition

Initial domain: `DRY`, `VERY_LOW`, `LOW`, `NORMAL`, `HIGH`, `FLOOD`, `UNKNOWN`.

## 9. Required vs optional data

### Always required for a submitted event

- `submissionId`
- `eventId`
- `siteId`
- authenticated `collectorUserId`
- `collectedAt`
- location (`latitude`, `longitude`, `gpsAccuracyM`)
- `mobileAppVersion`
- `schemaVersion`
- all measurement parameters marked `requiredByProtocol = true`

### Optional unless a protocol says otherwise

- weather condition
- air temperature
- streamflow condition/value
- notes
- photos
- instrument/method metadata
- non-core measurements

The application must not hard-code parameter requiredness in UI components. The requirement comes from the active sampling protocol/configuration.

## 10. Correction policy

- The app preserves `valueOriginal` exactly as submitted.
- A collector correction before approval creates an audit event and updates the staging current value while retaining the original snapshot/history.
- A supervisor must never silently alter a submitted value.
- If a supervisor is permitted to correct a transcription error, the system stores `valueReviewed`, the reason, reviewer ID, and timestamp.
- `valueCurrent` is the value used for approved publication.
- Scientific anomalies are warnings unless a rule demonstrates that the value is structurally/impossibly invalid.

## 11. Privacy and publication views

Public ArcGIS views/dashboard layers should exclude at minimum:

- `collectorUserId`
- `reviewerUserId`
- internal review comments when sensitive
- authentication identifiers
- diagnostic publish errors
- device identifiers
- internal audit details

Public outputs should expose the approved scientific observation, site metadata, measurement time, relevant QA/QC indicators, and non-sensitive provenance only.

## 12. ArcGIS Pro implementation target

Phase 5 should create the following initial geodatabase objects:

1. `SamplingSites` — point feature class
2. `SamplingEvents` — point feature class
3. `Measurements` — table
4. `ValidationFlags` — table
5. `AuditEvents` — table

Relationships:

- `SamplingSites.siteId` 1:N `SamplingEvents.siteId`
- `SamplingEvents.eventId` 1:N `Measurements.eventId`
- `SamplingEvents.eventId` 1:N `ValidationFlags.eventId`
- `SamplingEvents.eventId` 1:N `AuditEvents.eventId`

Attachments should be enabled on `SamplingEvents`.

## 13. Firebase staging representation

A submission document should be conceptually shaped as:

```json
{
  "submissionId": "uuid",
  "eventId": "uuid",
  "siteId": "uuid",
  "collectorUserId": "auth-uid",
  "collectedAt": "timestamp",
  "submittedAt": "timestamp",
  "location": {
    "latitude": 0.0,
    "longitude": 0.0,
    "accuracyM": 0.0
  },
  "conditions": {
    "weatherCondition": "CLOUDY",
    "airTemperatureC": 0.0,
    "streamflowCondition": "NORMAL"
  },
  "measurements": {
    "PH": {
      "valueOriginal": 7.25,
      "valueCurrent": 7.25,
      "unitCode": "PH",
      "requiredByProtocol": true
    }
  },
  "workflow": {
    "status": "SUBMITTED"
  },
  "quality": {
    "validationOutcome": null,
    "overallQualityScore": null
  },
  "versions": {
    "schemaVersion": "0.1.0",
    "validationRulesVersion": null,
    "qualityAlgorithmVersion": null,
    "mobileAppVersion": "0.1.0"
  }
}
```

Audit events and validation flags should use subcollections or dedicated collections rather than continually expanding one document.

## 14. Open decisions before Phase 5 is finalized

These decisions require project/scientific confirmation rather than guessing:

1. Which measurement parameters are mandatory for the default sampling protocol?
2. Exact instrument/method metadata required for each parameter.
3. Scientific validation thresholds versus instrument hard limits.
4. GPS accuracy threshold for warning/error behavior.
5. Whether quantitative streamflow is part of MVP or only qualitative condition.
6. Whether supervisor value correction is allowed at all, or whether all corrections must return to the collector.
7. Public visibility policy for quality scores and validation warnings.

Until these are confirmed, the schema supports them without hard-coding scientifically unsupported rules.
