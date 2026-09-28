# PA Watershed Watch engineering instructions

Use the canonical checkout. Preserve unrelated local work and unique Git history. Do not create another implementation or clone to simplify consolidation.

The product is native SwiftUI iOS and Jetpack Compose Android field collection → Firebase Authentication/private Firestore → validation → private `web/` QC Console → human approval → server-side `publication/` → private authoritative ArcGIS service → restricted public views → `public-dashboard/`.

## Invariants

- Submitted scientific revisions are immutable. Correction creates N+1 and preserves N.
- Collector clients cannot author validation, review, audit or publication state.
- Only the current human-approved revision can publish. Approval is distinct from publication success.
- Preserve entered units/values and canonical values. Use `config/production_measurement_catalog.json` for current native units; older spreadsheet catalogs describe legacy ingestion.
- Water Temperature is the only confirmed mandatory measurement. Other requirements need stakeholder evidence.
- Never publish collector/reviewer identities, workflow IDs, notes, private site labels, credentials or authenticated inventory.
- Verify actual view schemas against the exact public allowlist before sharing. Unexpected fields fail closed.
- Production dashboard reads anonymous public-safe ArcGIS views only. Demo mode must be explicit and visibly labeled; no fallback to synthetic data.
- Keep ArcGIS QC staging separate and unchanged unless a verified need authorizes modification. Preserve the GIS workbench and geodatabases.

## Working method

Inspect branch/status and relevant code before edits. Prefer small, reversible changes to proven applications. No architecture restart or speculative design system. Never rewrite shared history or perform unrelated dependency upgrades.

Use the existing checks:

- Backend: `npm run test:contracts`, `npm run test:publication`.
- Provisioning privacy: `python3 -m unittest discover -s tests/publication -p '*_test.py'`.
- Firestore/Storage/validation/review emulator suites under `tests/`.
- QC: typecheck and production build in `web/`, then browser verification.
- Dashboard: `npm test --prefix public-dashboard`, typecheck/build and browser verification.
- iOS: existing Xcode scheme/tests; Android: existing Gradle tests/lint/build and relevant device verification.

Keep secrets, local environment files, build outputs, dependencies and raw authenticated ArcGIS inventory outside Git. Report actual PASS/FAIL/BLOCKED evidence; a build alone is not end-to-end proof.

Historical Expo/React Native and ArcGIS Workflow Manager designs are preserved in Git history and are not active release requirements. Current architecture and release evidence belong in `docs/`.
