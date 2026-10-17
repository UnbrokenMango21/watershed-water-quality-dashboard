# How PA Watershed Watch evolved

The project began with watershed spreadsheets, ArcGIS maps and a local ArcGIS Pro geodatabase. Those assets remain useful historical and GIS workbench material; they are not the transactional mobile workflow.

Field collection introduced the difficult part: a collector must save locally, submit reliably and correct an observation without rewriting scientific history. The active implementation uses native SwiftUI and Jetpack Compose applications, Firebase Authentication, immutable Firestore revisions and trusted validation. The earlier Expo implementation remains in Git history.

Human review moved into the private QC Console. Reviewer actions apply to a specific current revision, reject stale requests, preserve science and record an audit event. ArcGIS Workflow Manager is no longer a required release dependency.

Real correction testing exposed acknowledgment ordering and phantom-revision problems. The fixes preserve pending local state and require synchronization before another correction. iOS build 12 contains those fixes; its exact source and TestFlight evidence are recorded in [the release lock](PHASE11_RELEASE_LOCK.md).

The September consolidation found that several local directories were linked or historical copies, while tested iOS, publisher and dashboard work lived on different branches. Unique local mobile work was preserved on an archive branch. The missing Android model was a local filesystem deletion: authoritative Git history still contained it. It was restored from Git, then native checks passed.

The publisher and existing ArcGIS Maps SDK/Calcite dashboard were merged into an integration branch based on current main. Integration exposed two contract gaps: public measurements needed an opaque observation join key, and chart/sample dates needed collection time rather than approval time. Both are now explicit in the publication/adapter contract.

Provisioning needed stronger privacy checks. Requested field visibility is insufficient evidence: the actual returned schema must match the public allowlist before sharing. Tests verify that an unexpected schema prevents the sharing call for the entire batch.

Live provisioning exposed ArcGIS numeric-ID assignment and Python helper compatibility differences. The new private service was retained, its actual IDs captured, and private views were completed using explicit REST view definitions. No staging service or GIS workbench was replaced.

The historical layer once called “117 sites” contains **117 records across five site IDs**. Its public metadata does not establish scientific provenance or permission for reuse as approved monitoring data. It stays separate pending stakeholder review. No historical values have been silently folded into production.

Deployment facts and unfinished release gates belong in [the roadmap](ROADMAP.md), rather than being represented as completed milestones.
