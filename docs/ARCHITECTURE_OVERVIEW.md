# Architecture Overview

PA Watershed Watch uses a deliberate trust boundary:

```text
Native iOS / Android
        ↓
Firebase Authentication
        ↓
Private Firestore immutable revisions
        ↓
Trusted server validation
        ↓
PENDING_REVIEW
        ↓
Authenticated QC Console
        ↓
APPROVED
        ↓
Approved-only publisher
        ↓
Private ArcGIS authoritative service
        ↓
Field-restricted query-only public views
        ↓
Responsive public dashboard
```

Firestore owns operational workflow, revisions, identities and private audit. ArcGIS owns approved geospatial publication. The dashboard never reads private Firebase workflow data.

The publisher is revision-aware and retry-safe through claim/lease tokens, read-before-write checks, unique indexes and immutable content hashes.
