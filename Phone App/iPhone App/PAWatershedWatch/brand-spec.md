# PA Watershed Watch visual identity

PA Watershed Watch is a calm, field-ready instrument for Pennsylvania water research. It favors scientific clarity, strong alignment, generous spacing, and native controls over decoration.

- Tokens: generated from `config/brand_tokens.json` into the marked `BrandTokens` block of `DesignSystem.swift`; screens use `FieldTheme` names, never raw hex. See `docs/DESIGN_SYSTEM.md`.
- Primary: Hemlock `#0D5C4B` (dark `#6CC3AA`)
- Secondary: Deep Water `#167A8B` (dark `#6CC2D1`)
- Attention: Goldenrod `#A76100` for graphics; Goldenrod Text `#955600` for words
- Success: Fern `#2E7D52`
- Errors, changes requested, destructive: Alert `#A3342B` (dark `#F08A7E`)
- Surfaces: Limestone canvas `#F6F3EC`, cards `#FBFAF6` with a 1 pt Limestone hairline, no shadows; Night `#0F1A17` in dark mode
- Type: SF Pro system text styles with Dynamic Type; values use monospaced digits with units in the same run
- Store and wordmark lettering: outlined Public Sans artwork; the app itself keeps system typography
- Spacing: 4, 8, 16, 24, 32, 48 points
- Radius: 6 (status pills), 8 (inputs, tiles), 12 (cards, primary buttons), 16 (hero surfaces)
- Minimum target: 44 points; primary actions are 56 points
- Interface icons: SF Symbols; the supplied watershed mark is used for the app identity
- Status: workflow state is a tinted rectangle with a leading square (`WorkflowPill`); sync state is a bare circle glyph with text (`SyncStatusLabel`). They never share a shape.

Signature behavior: every collection screen ends in a persistent action shelf showing progress and local save state. Workflow state and sync state are always displayed separately.

The approved store-mark package is preserved in `submission/brand/assets` at the repository root. The iOS app icon and Android adaptive icon are build copies of that package. Screenshot templates are marked `PENDING`; only actual app captures may be submitted to stores.
