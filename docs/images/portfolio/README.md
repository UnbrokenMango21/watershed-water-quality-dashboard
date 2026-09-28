# Portfolio image provenance

These images show interface states. None of them is a live environmental result.

| File | Source | What it shows |
| --- | --- | --- |
| `dashboard-demo-desktop.png` | Repository visual QA (`public-dashboard/scripts/visual-qa.mjs`, demo mode, desktop) run locally on PR #49 head `261196c`, merged into integration as `68a9c5a`, 2026-09-28. | Labeled synthetic demo sites and readings. Not monitoring evidence. |
| `dashboard-demo-phone-data.png` | Same run, iPhone viewport, time series tab. | Labeled synthetic demo readings. |
| `qc-console-record.png` | QC Console at `261196c` running against the local Firebase emulators with `scripts/seed_qc_smoke_data.mjs` fixtures, 2026-09-28. | Emulator-only test identities and records. No live account or record is shown. |
| `dashboard-live-empty-desktop.png` | The deployed development dashboard in production mode, captured 2026-09-28 after rollout of `68a9c5a`. | The real public-safe ArcGIS views, which hold no approved observations yet. |
| `dashboard-empty-desktop.png`, `dashboard-empty-phone-sites.png` | Earlier visual QA with mocked empty ArcGIS replies ([run 36384062900](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/actions/runs/36384062900), source `b9580c9`). Kept for history. | Empty-state interface before the map refinements. |
| `social-preview.png` | Composed from the [project wordmark](../../../submission/brand/assets/logo/pww-wordmark-horizontal-light-2400w.png) and [brand palette](../../../config/brand_tokens.json). | Branded title card for the GitHub social preview. |

Older `PAWatershedWatch-Previews` images are excluded: they contain private-looking names, counts and requirements that conflict with the current product contract.
