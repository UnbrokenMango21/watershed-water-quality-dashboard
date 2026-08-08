# Watershed Monitoring Platform

A clean-slate watershed data platform for field collection, automated validation, supervisor QC, authoritative ArcGIS publication, and public/research dashboards.

## Product flow

Field App → Firebase Staging → Automated Validation → ArcGIS Workflow Manager Review → Publishing Service → ArcGIS Authoritative Data → Dashboard & Analytics

Correction requests loop back to Firebase staging for revision and resubmission.

## Data ownership

- **Firebase:** unapproved / staging submissions and workflow state
- **ArcGIS:** approved authoritative sampling sites and observations
- **GitHub:** source code, schemas, validation rules, documentation, changelog, issues, and releases

## Development roadmap

1. Architecture + mind map
2. GitHub repository
3. GitHub documentation / CHANGELOG / Issues / Projects
4. Formal data dictionary
5. ArcGIS Pro geodatabase prototype
6. ArcGIS domains + relationships + IDs
7. Publish clean ArcGIS Online staging environment
8. Design Workflow Manager
9. Create Firebase project and production schema
10. Build validation engine
11. Build mobile app
12. Connect Firebase → Workflow Manager
13. Connect approval → ArcGIS publication
14. Build dashboard
15. End-to-end testing
16. v1.0 release

## Core principles

- Preserve original field submissions.
- Record who changed what, when, and why.
- Version schemas, validation rules, and applications.
- Flag unusual measurements without automatically treating them as invalid.
- Publish only data that has been approved and successfully written to ArcGIS.
- Keep sampling sites separate from time-stamped observations.
- Make all important state transitions auditable.

## Current phase

**v0.1 — Platform foundation**

We are currently establishing the project architecture, repository structure, documentation, and formal data model before creating Firebase, the mobile app, or production ArcGIS services.
