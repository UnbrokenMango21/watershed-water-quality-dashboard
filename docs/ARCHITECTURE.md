# Platform Architecture

## End-to-end flow

1. Field collector records measurements in a minimal mobile application.
2. The application stores the raw submission in Firebase staging.
3. Automated validation checks schema, required fields, location, ranges, duplicates, plausibility, and completeness.
4. Validation produces flags and a quality score without silently discarding unusual observations.
5. ArcGIS Workflow Manager creates or manages the human QC review step.
6. A supervisor approves, rejects, or requests correction with recorded comments.
7. Approved submissions enter the publishing service.
8. The publishing service transforms the submission to the ArcGIS schema, writes the observation, verifies success, and stores the ArcGIS record identifier.
9. ArcGIS contains the authoritative approved sampling sites and time-stamped observations.
10. Dashboards and analytics read approved ArcGIS data.
11. Correction requests return to staging for revision and resubmission.

## State machine

DRAFT → SUBMITTED → VALIDATING → PENDING_REVIEW

From PENDING_REVIEW:
- APPROVED → PUBLISHING → PUBLISHED
- NEEDS_CORRECTION → RESUBMITTED → VALIDATING
- REJECTED

Publishing failures use PUBLISH_FAILED and must be retried safely without duplicating observations.

## System responsibilities

### Mobile application
Field entry, offline drafts, site selection, GPS capture, timestamps, notes, attachments, and submission.

### Firebase
Unapproved submissions, staging workflow state, audit events, and synchronization with the mobile application.

### Validation engine
Schema checks, spatial checks, measurement checks, duplicate detection, quality flags, completeness scoring, and confidence scoring.

### ArcGIS Workflow Manager
Human review assignment, supervisor decision, review comments, and controlled approval state.

### Publishing service
Transformation, ArcGIS writes, retries, idempotency, verification, and storage of authoritative ArcGIS identifiers.

### ArcGIS
Authoritative sampling sites and approved observations. A site has many time-stamped observations.

### Dashboard
Map, latest measurements, historical trends, comparisons, quality indicators, exports, and research/decision-support views based only on approved data.

### GitHub
Source code, schemas, configuration templates, documentation, validation rules, issues, pull requests, changelog, and releases. GitHub is not a live environmental measurement database.

## Non-negotiable provenance rules

- Never silently overwrite the original field submission.
- Every meaningful workflow transition records actor, timestamp, prior state, new state, and context.
- Reviewer changes preserve original and reviewed values plus reason.
- Store schema version, validation-rule version, and application version with submissions.
- A record becomes authoritative only after supervisor approval and confirmed ArcGIS publication.
- Abnormal environmental values may be important observations and must not be rejected merely because they are unusual.
