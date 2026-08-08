# Phase 8 — Workflow Manager Design Lock

**Status:** Design complete; implementation blocked only by Penn State `Create workflow item` privilege.  
**Workflow item target:** `Central_PA_Watershed_QC_Workflow`  
**Diagram:** `Water Quality QC Review v0.1`  
**Job template:** `Water Quality Submission Review`

## Design objective

Workflow Manager orchestrates human QC review of already-validated sampling submissions. It does not replace Firebase as the raw submission source of truth and it does not give supervisors permission to rewrite scientific measurements.

One Workflow Manager job represents exactly one `SamplingEvent` review.

## External data reference

Use the private hosted feature layer `Central_PA_Watershed_QC_Staging` as a feature-layer extended property reference.

- ArcGIS Online item ID: `b7775c1bdada4aa8b0787714eca3eb15`
- Layer: `SamplingEvents`
- Service layer ID: `20`
- Link ID field: `event_id`
- Relationship: `1-1`
- Reference name: `SamplingEventReview`

`event_id` is the cross-platform key because it is stable across Firebase, validation, ArcGIS staging, Workflow Manager and later publication. Do not use `OBJECTID` as the integration key.

## Workflow diagram

```text
START
  |
  v
Initialize Review
  |
  v
Assign QC Reviewer
  |
  v
Review Submission
  |
  v
QC Decision
  |-------------------|-------------------|
  v                   v                   v
APPROVE        NEEDS_CORRECTION         REJECT
  |                   |                   |
  v                   v                   v
Record Approval   Required Comment    Required Reason
  |                   |                   |
  v                   v                   v
Ready for         Wait for Collector  Record Rejection
Publication       Correction              |
  |                   |                   v
  v                   v                 END
END / await        Firebase correction
Phase 13               |
                       v
                  Revalidation
                       |
                       v
                 Return to Review
                       |
                       +----> Review Submission
```

## Step implementation mapping

Use Workflow Manager step templates as follows once permissions are granted:

| Step | Workflow Manager template | Purpose |
|---|---|---|
| Start | Start/End | Diagram entry |
| Initialize Review | Manual Step | Confirm linked submission is ready for review |
| Assign QC Reviewer | Advanced Assignment | Assign to the QC reviewer group/user |
| Review Submission | Manual Step | Human review of map, measurements, validation and attachments |
| QC Decision | Question | Explicit `APPROVE`, `NEEDS_CORRECTION`, `REJECT` branch |
| Required Correction Comment | Add Comment | Capture correction instructions |
| Wait for Collector Correction | Manual Step initially | Placeholder until Phase 12 automates callback/dependency |
| Return Resubmission to Review | Manual Step initially | Confirm corrected/revalidated submission is ready |
| Required Rejection Reason | Add Comment | Capture rejection rationale |
| Ready for Publication | Manual Step initially | Handoff point for Phase 13 |
| End | Start/End | Terminal state |

The June 2026 Workflow Manager release adds webhook dependency capabilities that may replace the temporary correction-wait manual step during Phase 12.

## Reviewer surface

The reviewer must be able to inspect, without being able to rewrite raw science:

- Sampling site and event map location
- event/submission/site IDs
- collection date/time
- GPS accuracy and site distance
- weather
- test type, method and instrument/lab
- temperature values
- related `Measurements`
- related `ValidationFlags`
- SamplingEvents attachments
- completeness score
- location score
- method/instrument score
- validation score
- temporal/provenance score
- historical consistency score
- overall quality score
- anomaly score
- error/warning/info flag counts
- current workflow/review state

## Approval gates

### APPROVE

Approval is allowed only when:

- reviewer explicitly chooses Approve;
- `error_flag_count == 0`;
- submission has completed automated validation;
- reviewer is authorized for QC review.

Warnings, anomaly score and environmental alerts are evidence for the reviewer, not automatic rejection rules.

### NEEDS_CORRECTION

- Reviewer comment is mandatory.
- Workflow status becomes `NEEDS_CORRECTION`.
- Collector/researcher corrects the original submission through the mobile/Firebase path.
- Corrected data is revalidated before it can return to human review.
- The supervisor does not directly change pH, DO, nitrate, GPS or other scientific values.

### REJECT

- Reviewer reason/comment is mandatory.
- Workflow status becomes `REJECTED`.
- Rejected path is terminal unless an administrator deliberately opens a new review job.

## Roles

### Collector / researcher

Owns collection and correction of field/lab data. Cannot approve.

### Validation service

Produces structural errors, plausibility warnings, environmental alerts, quality score components and anomaly score.

### QC reviewer / supervisor

Owns human review and disposition. Can add review comments and change workflow/review metadata only.

### Publishing service

Deferred to Phase 13. Reads only approved jobs/records and publishes authoritative ArcGIS data.

## Group model

Once Workflow Manager creation is available, create or reuse restricted groups conceptually equivalent to:

- `Central PA Watershed Workflow Admins`
- `Central PA Watershed QC Reviewers`

Collectors do not need Workflow Manager design/admin access for the MVP because corrections occur in the mobile application.

## Job template defaults

- Name: `Water Quality Submission Review`
- Category: `Water Quality QC`
- Initial status: `PENDING_REVIEW`
- Default assignment: QC reviewer group
- Workflow diagram: `Water Quality QC Review v0.1`
- One job per SamplingEvent

The template should initially be kept private/restricted. Automated-only creation can be enabled later when Phase 12 creates jobs programmatically.

## Extended property configuration

After creating the job template:

1. Add feature-layer extended properties.
2. Select `Central_PA_Watershed_QC_Staging`.
3. Select `SamplingEvents` layer ID 20.
4. Choose `event_id` as Link ID Field.
5. Reference name: `SamplingEventReview`.
6. Relationship: 1-1.
7. Expose only review-relevant fields.
8. Save the relationship carefully: Workflow Manager does not allow changing the relationship/table name after it is saved without recreating it.

## Phase 12 integration contract

The validation/backend service will eventually create or update a Workflow Manager job with at least:

```json
{
  "eventId": "<event UUID>",
  "workflowStatus": "PENDING_REVIEW",
  "qualityScore": 0,
  "anomalyScore": 0,
  "errorFlagCount": 0,
  "warningFlagCount": 0
}
```

A correction request must eventually produce a backend event containing job ID, event ID, reviewer comment and decision. That event is routed back to the collector's Firebase submission record.

## Phase 13 integration contract

Only records with both:

- staging `workflow_status = APPROVED`; and
- human Workflow Manager decision = APPROVE

are eligible for authoritative publication.

## Acceptance test when permissions arrive

Use synthetic data only.

1. Create a temporary SamplingEvent with related measurement/flag records.
2. Create a review job linked through `event_id`.
3. Confirm the reviewer can inspect the linked event.
4. Test APPROVE.
5. Test NEEDS_CORRECTION and required comment.
6. Simulate corrected/revalidated return to review.
7. Test REJECT and required reason.
8. Confirm scientific measurements cannot be directly edited through the review path.
9. Delete/retire synthetic test records before production acceptance testing.

## Current blocker

Penn State ArcGIS Online currently permits Workflow Manager access but does not grant the account the `Create workflow item` privilege. Support has been contacted. No architectural redesign is required when access is granted.
