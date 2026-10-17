# Test Matrix

| Gate | Command/evidence | Expected |
|---|---|---|
| Backend contracts | `npm run test:contracts` | pass |
| Publication | `npm run test:publication` | pass |
| Review | `npm run test:review` | pass |
| Trigger | `npm run test:trigger` | pass |
| Dashboard | test + typecheck + build | pass |
| QC console | typecheck + build | pass |
| Android | `testDebugUnitTest lintDebug assembleDebug` | pass |
| iOS | `xcodebuild ... test` | pass |
| Firestore/Storage rules | emulator/CI | pass |
| ArcGIS public views | anonymous schema/capability verification | query-only/privacy-safe |
| Authoritative ArcGIS | anonymous request | fail closed |
| Scientific E2E | non-test approved observation | gated |

Fresh local results belong in `docs/VERIFICATION_REPORT.md`.
