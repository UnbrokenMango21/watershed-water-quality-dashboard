# Development Roadmap

This sequence is the working implementation order for the Watershed Monitoring Platform.

- [x] 1. Architecture + mind map
- [x] 2. GitHub repository
- [x] 3. GitHub documentation / CHANGELOG / Issues foundation
- [x] 4. Formal data dictionary
- [x] 5. ArcGIS Pro geodatabase prototype
- [x] 6. ArcGIS domains + relationships + IDs
- [ ] 7. Publish clean ArcGIS Online staging environment
- [ ] 8. Design Workflow Manager
- [ ] 9. Create Firebase project and production schema
- [ ] 10. Build validation engine
- [ ] 11. Build mobile app
- [ ] 12. Connect Firebase → Workflow Manager
- [ ] 13. Connect approval → ArcGIS publication
- [ ] 14. Build dashboard
- [ ] 15. End-to-end testing
- [ ] 16. v1.0 release

## Current active phase

**Phase 7 — Publish clean ArcGIS Online staging environment**

Phase 6 is complete and verified in ArcGIS Pro 3.7.1. The hardened `CentralPA_Watershed.gdb` passed 51 read-only verification checks with 0 failures, including GlobalIDs, GUID foreign keys, five relationship classes, coded-value domain assignments, SamplingEvents attachments, and UTC editor tracking. A full save/reopen test also passed.

Phase 7 will publish the empty, hardened schema to ArcGIS Online as a private staging service. The staging service must preserve relationships, GlobalIDs, attachments, domains, editor tracking, and internal/private fields while remaining restricted to the project owner/review team. Public-safe hosted views will be designed later; no production or historical records are loaded in Phase 7.

## Phase gates

Each major stage should be considered complete only when its schema/configuration is documented, versioned, tested, and recoverable.

### v0.1 — Foundation
Architecture, repository structure, roadmap, audit/provenance rules, and formal data model.

### v0.2 — GIS data model
ArcGIS Pro geodatabase, domains, IDs, relationships, and publication-ready schema.

### v0.3 — Review workflow
ArcGIS Online staging and Workflow Manager supervisor/QC process.

### v0.4 — Collection and validation
Firebase staging, validation engine, quality flags/scoring, and mobile data collection.

### v0.5 — Integration
Firebase → review workflow → verified ArcGIS publication.

### v0.6 — Analytics
Dashboard and research-facing analysis.

### v1.0 — Production
End-to-end tested, documented, versioned production release.
