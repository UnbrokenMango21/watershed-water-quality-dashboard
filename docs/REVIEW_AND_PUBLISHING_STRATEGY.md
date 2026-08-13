# PA Watershed Watch — Review and Publishing Strategy

_Last updated: 2026-08-13_

## Decision

ArcGIS Workflow Manager Online is not a hard project dependency.

Penn State's current licensing may not include the ArcGIS Online Workflow Manager organization extension required for the originally planned implementation. The project must continue without waiting on that license decision.

For the expected reviewer population (one or two people), the preferred fallback is a **minimal authenticated QC review page**, not a large custom operations platform.

Workflow Manager can be integrated later if licensing becomes available and it provides real value.

## Responsibility split

| Component | Responsibility |
| --- | --- |
| Native collector apps | field collection, local drafts, GPS, media, submit/resubmit |
| Firebase staging | unapproved records, revision history, workflow/readback state |
| Validation service | automated structural/scientific checks and flags |
| Minimal QC page | human review actions only |
| Publishing service | transform/verify/idempotently publish approved revision |
| ArcGIS | authoritative approved observations and sites |
| Dashboard | approved maps, trends, exports, analytics |

## Minimal QC page

Keep the reviewer product intentionally small.

Suggested routes:

- `/review` — pending queue
- `/review/{submissionId}` — current observation/revision detail
- `/review/history` — recently reviewed records

The observation detail needs only the information required to make a defensible scientific review decision:

- site and map/GPS context
- collection time
- collector
- method / instrument or lab
- entered measurements and units
- validation flags
- quality/confidence indicators where defined
- notes
- attachments
- immutable revision history

Primary actions:

- **Approve**
- **Request Correction**
- **Reject**

Do not add task boards, chat, project management, elaborate assignment systems, or dashboard analytics to this interface unless pilot feedback demonstrates a need.

## Trusted review actions

The browser should not receive permission to arbitrarily rewrite workflow fields.

A reviewer action should go through trusted backend logic that:

1. verifies the authenticated Firebase UID;
2. verifies `QC_REVIEWER` or `ADMIN` role;
3. loads the current submission and revision;
4. verifies the current state is valid for the requested transition;
5. verifies the reviewed revision is still current;
6. applies the transition atomically;
7. records reviewer UID and trusted server timestamp;
8. records decision/comment/reason;
9. creates an immutable audit event;
10. returns the committed state to the browser.

This makes double-clicks and stale browser tabs safe.

## Correction loop

```mermaid
flowchart LR
    A[PENDING_REVIEW] -->|Request Correction| B[NEEDS_CORRECTION]
    B --> C[Collector mobile sees reason]
    C --> D[Create Revision N+1]
    D --> E[RESUBMITTED]
    E --> F[VALIDATING]
    F --> G[PENDING_REVIEW]
```

The previous revision is never overwritten.

## Approval / publication loop

```mermaid
flowchart LR
    A[PENDING_REVIEW] -->|Approve| B[APPROVED]
    B --> C[Publishing service]
    C --> D[Transform canonical revision]
    D --> E[ArcGIS write]
    E --> F[Verify feature]
    F --> G[PUBLISHED]
```

The reviewer browser never talks directly to ArcGIS.

## Publishing idempotency

Define a deterministic publication key from the approved scientific identity, for example a stable combination of:

- `submission_id`
- approved `revision_id`

The exact ArcGIS field/mapping remains part of the publishing contract.

Before creating a new ArcGIS observation, the publisher must check whether the publication key already exists.

This protects against the failure mode where ArcGIS successfully writes a feature but the network response is lost and the publisher retries.

## Publish failure behavior

A publish failure must not erase approval.

Expected state:

`APPROVED -> PUBLISHING -> PUBLISH_FAILED -> PUBLISHING -> PUBLISHED`

Retries should reuse the same publication identity and verify existing ArcGIS state before creating anything new.

## Workflow Manager future adapter

If Penn State later licenses Workflow Manager Online, treat it as an optional integration provider rather than the staging database of truth.

Conceptually:

```text
ReviewWorkflowProvider
├── NativeFirebaseReviewProvider
└── ArcGISWorkflowManagerProvider (optional later)
```

The scientific record, immutable revisions, validation results, and canonical workflow semantics remain owned by the Watershed platform.

## ArcGIS-only fallback

If a custom QC page becomes unexpectedly expensive to maintain, a private ArcGIS review layer/table can be considered as a fallback UI surface.

This should still preserve:

- Firebase as canonical staging state;
- trusted backend synchronization;
- webhook/idempotency protections;
- privacy constraints;
- no direct mobile publishing.

It is a fallback, not the preferred architecture, because it duplicates staging state into ArcGIS earlier than necessary.
