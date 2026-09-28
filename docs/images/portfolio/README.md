# Portfolio image provenance

The dashboard captures were copied without editing from [PR #42 visual QA run 36384062900](https://github.com/UnbrokenMango21/watershed-water-quality-dashboard/actions/runs/36384062900), which checked out tested source `b9580c91fb1e8da7f529e5e14ab5eb2cd7ab7ee7` on 2026-09-28. That PR subsequently merged into integration as `1da94e04b8a15a99aacd41210f78c8c6bd2288b3`. These images establish interface states, not a live environmental result.

| File | CI artifact source | Public-use status |
| --- | --- | --- |
| `dashboard-demo-desktop.png` | `public-dashboard-visual-qa-demo/desktop.png` | Safe labeled synthetic demo; sample readings are not monitoring evidence. |
| `dashboard-demo-phone-data.png` | `public-dashboard-visual-qa-demo/iphone-data.png` | Safe labeled synthetic demo. |
| `dashboard-empty-desktop.png` | `public-dashboard-visual-qa-empty/desktop.png` | Safe interface state; empty ArcGIS replies were mocked by the QA script. |
| `dashboard-empty-phone-sites.png` | `public-dashboard-visual-qa-empty/iphone-sites.png` | Safe interface state; empty ArcGIS replies were mocked by the QA script. |
| `social-preview.png` | Composed from the [supplied project wordmark](../../../submission/brand/assets/logo/pww-wordmark-horizontal-light-2400w.png) at `3a0547a423a13f00db60a001c0dbfb91d4f07ce7` and [brand palette](../../../config/brand_tokens.json) at `e5afe310b9802057b92b513b131f84cf72b21b26`, 2026-09-28. | Safe branded title card, not a product screenshot or publication claim. Coordinator should review before setting GitHub metadata. |

The older `PAWatershedWatch-Previews` images were excluded: they contain private-looking names, counts, and requirements that conflict with the current product contract. The Build 13 sign-in capture is an older release image and is linked only as archival evidence.
