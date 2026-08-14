# QC Console Remaining Work

## NO CURRENT QC CONSOLE RELEASE BLOCKERS

The DEV QC console is connected to real Firebase Auth and Firestore, deployed on
the single `qc-console-dev` App Hosting backend, and verified through the live
HTTPS reviewer workflow. Blaze, ADC, Web SDK configuration, dev identities,
fixtures, runtime IAM, queue indexing, review actions, audit, stale conflict,
idempotency, immutable science, responsive layout, and security denials all
passed. The backend is also connected only to
`UnbrokenMango21/watershed-water-quality-dashboard`, live branch
`codex/qc-console-production-v1`, root `web`.

## Known limitations and intentionally deferred work

- `central-pa-watershed-dev.firebasestorage.app` is named by the registered Web
  SDK configuration but is not currently provisioned as a real bucket. This does
  not block the QC console because it performs no media upload.
- Historical attachment metadata remains readable. Current mobile photo/audio
  capture remains intentionally deferred to a later science-safe media phase.
- The console uses the Firebase-provided App Hosting domain; no custom domain is
  required for this DEV release.
- ArcGIS and public-dashboard publication are outside this phase and were not
  started.
