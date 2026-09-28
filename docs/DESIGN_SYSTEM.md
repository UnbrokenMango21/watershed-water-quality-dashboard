# Design system

The collector app, the QC console and the public dashboard share one visual system, derived from the
PA Watershed Watch Brand Package (standalone HTML, specs checked 26 Sep 2026). The package's logo,
icon and store assets are archived in `submission/brand/assets`.

## Source of truth

`config/brand_tokens.json` holds every shared value: the palette, semantic light/dark colours, status
tones, the presentation tone for each canonical workflow state, radii, spacing and web type.
`node scripts/brand-tokens.mjs --write` regenerates the platform copies:

| Target | Used by |
| --- | --- |
| `web/app/brand-tokens.css`, `web/lib/brandTokens.ts` | QC console |
| `public-dashboard/styles/brand-tokens.css`, `public-dashboard/lib/brandTokens.ts` | Public dashboard |
| Marked block in `Phone App/iPhone App/PAWatershedWatch/PAWatershedWatch/DesignSystem.swift` | iOS app |

Each web app is its own App Hosting root, so each receives its own copy. `npm run test:contracts`
fails when a copy drifts, when a declared text pairing falls below WCAG AA in light or dark, or when a
state in `config/workflow_states.json` has no tone. Tones are presentation only; they never carry
workflow meaning.

## Rules carried from the Brand Package

- Hemlock `#0D5C4B` is primary, Deep Water `#167A8B` secondary, Goldenrod `#A76100` is for graphics
  only (Goldenrod Text `#955600` for words), Fern `#2E7D52` for approved, Alert `#A3342B` for errors
  and changes requested. Surfaces are warm Limestone, hairline-bordered and flat.
- Workflow status (where a record stands in human review) is a tinted rectangle with a leading square.
  Sync status (where the data is) is a bare circle glyph with text. The two never share a shape, and a
  label always carries the meaning.
- Native apps use system type (SwiftUI text styles with Dynamic Type) with tabular figures for values.
  The web surfaces use Public Sans for everything people normally read, labels included, in sentence
  case. IBM Plex Mono is reserved for technical identifiers in the QC console's collapsed technical
  sections; the public dashboard does not load it. Fonts are self-hosted under the SIL OFL 1.1.
- Copy is plain and short: no em dashes or decorative bullet separators, no backend vocabulary in the
  main interface. Icons appear where they carry meaning or replace a label; icon-only web controls
  have an accessible name and a hover tooltip.
- Values keep their unit in the same run, separated by a non-breaking space.
- The QC console follows the viewer's light/dark preference. The public dashboard stays light so the
  basemap and page read as one surface; demo mode is a Goldenrod band that is never subtle.

## Verification

- iOS: `bash scripts/dev.sh ios` and the emulator-backed `bash scripts/dev.sh ios-ui`
  (`IOS_UI_APPEARANCE=dark` for dark mode); the UI tests attach a screenshot of each screen.
- QC console: typecheck, production build, and browser review against the emulator smoke scenarios in
  `QC_CONSOLE_RUNBOOK.md`.
- Dashboard: `npm test`, typecheck, build and `scripts/visual-qa.mjs` in demo and empty modes.
