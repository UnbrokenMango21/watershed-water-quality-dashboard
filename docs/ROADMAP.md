# Development Roadmap

This sequence is the working implementation order for the Watershed Monitoring Platform.

- [x] 1. Architecture + mind map
- [x] 2. GitHub repository
- [x] 3. GitHub documentation / CHANGELOG / Issues foundation
- [x] 4. Formal data dictionary
- [x] 5. ArcGIS Pro geodatabase prototype
- [ ] 6. ArcGIS domains + relationships + IDs
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

**Phase 6 — ArcGIS domains + relationships + IDs**

Phase 5 was visually verified in ArcGIS Pro 3.7.1: `CentralPA_Watershed.gdb` exists, all five empty prototype datasets exist, `SamplingSites` and `SamplingEvents` use WGS 1984 / EPSG:4326, and the expected fields are present. Phase 6 now hardens the geodatabase with GlobalIDs, GUID foreign keys, relationship classes, coded-value domains, attachments, and editor tracking.

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
