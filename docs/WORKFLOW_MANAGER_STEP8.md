# Step 8 — ArcGIS Workflow Manager Review Design

**Status:** Active  
**Platform:** ArcGIS Workflow Manager in ArcGIS Online  
**Workflow item:** to be created  
**QC staging source:** `Central_PA_Watershed_QC_Staging`  
**SamplingEvents layer ID:** `20`

## Purpose

Workflow Manager is the human-review orchestration layer between automated validation and authoritative publication.

It does not replace Firebase as the raw/mobile submission source and it does not become the authoritative scientific datastore.

```text
Mobile app
  -> Firebase raw submission
  -> validation engine
  -> ArcGIS QC staging
  -> Workflow Manager review
       -> Approve
       -> Needs Correction
       -> Reject
  -> approved publication service (Phase 13)
```

## Unit of work

**One Workflow Manager job = one `SamplingEvent` submission under review.**

The canonical cross-platform link is `event_id`, not ObjectID. `event_id` is stable across Firebase, ArcGIS staging, validation, audit logs, and future API integrations.

## Workflow Manager external-property link

Create a feature-layer extended property reference from the job template to:

- ArcGIS Online item: `Central_PA_Watershed_QC_Staging`
- layer: `SamplingEvents` / service layer ID `20`
- relationship: `1-1`
- link ID field: `event_id`
- suggested reference name: `SamplingEventReview`

Workflow Manager supports associating external feature-layer records with jobs using a Link ID field. `event_id` is preferred because it is unique and cross-platform.

## Roles

### Collector / researcher
- enters and corrects scientific observations through the mobile submission system
- receives correction requests
- resubmits corrected data
- cannot approve own scientific record through the QC workflow

### Validation service
- runs deterministic validation
- creates validation flags
- computes quality and anomaly scores
- determines whether a record is eligible to enter human review

### Supervisor / QC reviewer
- reviews the record, validation evidence, attachments, provenance, and scores
- chooses Approve / Needs Correction / Reject
- must not directly alter scientific measurement values

### Publishing service
- receives approved event IDs later in Phase 13
- publishes approved data to the authoritative ArcGIS dataset

## Review fields

The reviewer should see, at minimum:

### Identity and collection
- `event_id`
- `site_id`
- `data_collected_by`
- `test_type`
- `test_type_other`
- `method_name`
- `instrument_name`
- `collected_at`
- `submitted_at`

### Location
- latitude / longitude
- `gps_accuracy_m`
- `site_distance_m`
- job location on the map

### Environmental context
- weather
- temperature entry unit and values
- field notes
- attachments

### QA / validation
- `validation_outcome`
- completeness score
- location quality score
- method quality score
- validation quality score
- temporal quality score
- historical quality score
- overall quality score
- anomaly score
- error/warning/info flag counts

### Review
- workflow status
- review decision
- reviewer comment
- reviewed timestamp

## Scientific-editing rule

A supervisor does **not** fix scientific values in Workflow Manager or the QC staging layer.

If a value needs correction:

```text
Reviewer identifies problem
  -> Needs Correction
  -> required reviewer comment
  -> collector/researcher corrects source submission
  -> Firebase preserves prior submitted version
  -> validation runs again
  -> QC staging is refreshed
  -> same review process resumes
```

This preserves provenance and prevents untraceable scientific edits by reviewers.

## Workflow diagram v0.1

```text
START
  |
  v
Initialize Review Job
  |
  v
Link SamplingEvent
  |
  v
Set / confirm Job Location
  |
  v
Review Submission
  |
  v
QC Decision
  |-------------------|--------------------|
  v                   v                    v
APPROVE         NEEDS CORRECTION         REJECT
  |                   |                    |
  v                   v                    v
Record Approval   Require Comment       Require Reason
  |                   |                    |
  v                   v                    v
Ready for          Wait for Collector   Record Rejection
Publication        Correction                 |
  |                   |                    v
  |                   v                 Close Job
  |              Resubmitted
  |                   |
  |                   v
  |              Revalidate
  |                   |
  |                   +------> Review Submission
  |
  v
Publication Handoff (Phase 13)
  |
  v
Close Job
```

## Recommended step types

### 1. Initialize Review Job
Use automatic job-property updates where useful to establish job name/status/description.

Suggested job name pattern:

`Water Quality Review — <site code> — <collection date>`

Automatic creation from Firebase is deferred until Phase 12.

### 2. Link SamplingEvent
Use the job template's feature-layer extended property and set its Link ID to `event_id`.

The automated bridge in Phase 12 will create the job and provide the `event_id`; during Phase 8 testing this can be populated manually for a synthetic record.

### 3. Define Location
Prefer a `Define Location` step driven from the SamplingEvent geometry or an equivalent data-reference expression. The job location should represent the submitted sampling-event point, allowing reviewers to see work geographically and making later job monitoring easier.

### 4. Review Submission
Use a Manual Step for the actual human review. Manual steps are suited to approval/review work that requires a person to inspect data before finishing the step.

Enable step commenting if useful, but the formal decision comment should be captured in the decision path below.

The review step should expose linked SamplingEvent properties and provide access to a private QC web map / review surface for related Measurements, ValidationFlags, and attachments.

### 5. QC Decision
The decision must result in one of exactly three business outcomes:

- `APPROVED`
- `NEEDS_CORRECTION`
- `REJECTED`

Do not overload warning/error categories as decisions. Validation evidence informs the human decision but remains distinct from review status.

### 6A. Approval path
- human explicitly approves
- record reviewer identity/comment/timestamp
- set job/workflow status to approved/ready for publication
- later Phase 13 invokes authoritative publication

Approval must be blocked when unresolved validation `ERROR` findings exist.

### 6B. Correction path
- reviewer selects Needs Correction
- reviewer comment is mandatory
- status becomes `NEEDS_CORRECTION`
- job waits while source correction occurs outside Workflow Manager
- collector corrects/resubmits through the mobile/Firebase pipeline
- validation runs again
- refreshed data returns to review

A future Phase 12 webhook/API bridge can release or advance the waiting job when the corrected submission reaches review-ready state.

### 6C. Rejection path
- reviewer selects Reject
- reason/comment is mandatory
- status becomes `REJECTED`
- no authoritative publication occurs
- record/audit history remains preserved
- workflow job may close after rejection is recorded

## Workflow state mapping

| Workflow Manager business state | SamplingEvents `workflow_status` |
|---|---|
| Incoming validated submission | `PENDING_REVIEW` |
| Reviewer requests correction | `NEEDS_CORRECTION` |
| Collector resubmits | `RESUBMITTED` |
| Reviewer approves | `APPROVED` |
| Reviewer rejects | `REJECTED` |
| Publication starts later | `PUBLISHING` |
| Publication succeeds later | `PUBLISHED` |
| Publication fails later | `PUBLISH_FAILED` |

Workflow Manager job status and SamplingEvents workflow status should be related but not treated as the exact same storage field. The integration layer synchronizes them explicitly.

## Validation gating

### Hard block
Any unresolved `ERROR` prevents approval.

### Human-review evidence
These do not automatically reject the record:
- `PLAUSIBILITY_WARNING`
- `ENVIRONMENTAL_ALERT`
- high anomaly score
- unusually low/high quality component if still structurally valid

A scientifically unusual reading may be correct and valuable.

## Review map / review surface

Create a private web map later in Phase 8 named:

`Central_PA_Watershed_QC_Review_Map`

It should contain the private QC staging service and be shared only with the reviewer/admin group.

Preferred behavior:
- SamplingEvents as primary clickable layer
- SamplingSites as context
- related Measurements available from the selected event
- related ValidationFlags available
- SamplingEvents attachments visible
- reviewer-relevant pop-up fields ordered clearly
- private identity/access fields not shown unless specifically necessary for the reviewer role

The workflow can use a web-page/web-app step or native Workflow Manager data references to open this review context. We will favor native Workflow Manager capabilities first and only build a custom review application if native review becomes cumbersome.

## Workflow Manager item naming

Recommended item name:

`Central_PA_Watershed_QC_Workflow`

Recommended job template:

`Water Quality Submission Review`

Recommended diagram:

`Water Quality QC Review v0.1`

## Permissions / sharing

The workflow item and QC review map remain restricted to authorized project users/groups.

Do not share the QC staging service, Workflow Manager item, or review map publicly.

Workflow Manager creates its own managed workflow feature services/views when a workflow item is created. Those managed items should not be manually modified outside Workflow Manager.

## Deferred automation

Phase 8 configures the workflow and proves the human process.

Phase 12 will connect Firebase/validation to Workflow Manager so that a review-ready submission can automatically:

1. mirror/update the SamplingEvent in QC staging
2. create or locate a Workflow Manager job
3. link it using `event_id`
4. assign it to the reviewer group
5. advance/wake correction-loop jobs on resubmission

Phase 13 connects approved jobs to authoritative ArcGIS publication.

## Phase 8 acceptance criteria

- Workflow Manager item created
- reviewer/admin access established
- job template created
- SamplingEvents added as 1:1 external feature-layer property using `event_id`
- workflow diagram created with Approve / Needs Correction / Reject branches
- correction and rejection require reviewer comments
- review job can expose the linked SamplingEvent and useful QA context
- supervisor has no normal path for editing scientific measurement values
- job location can represent the SamplingEvent point
- workflow remains private
- synthetic/manual workflow test succeeds without loading historical production data
- workflow item ID, job template, diagram name/version, data references, and relevant step IDs are documented in GitHub
