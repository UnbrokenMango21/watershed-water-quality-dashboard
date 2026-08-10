# Phase 11 Creekline II Design Synthesis

Status: implementation guidance for `phase11/mobile-v1`.

## Goal

The collector must read as one coherent field instrument rather than a set of separately styled screens. Visual refinement must preserve the Phase 9 Firebase/data contracts, Phase 10 validation semantics, offline-first behavior, immutable submitted revisions, correction-by-new-revision behavior, and privacy boundaries.

## Adopted direction

### Quiet canvas, no repeated background stripe

The field-paper / night-creek canvas stays visually quiet. Decorative contour/wave stripes are not a recurring page element and are not part of the production screen grammar. Identity comes from typography, spacing, the project mark, semantic color, and field-record structure rather than wallpaper.

A decorative watershed graphic may appear only in a future dedicated illustration or empty-state asset after explicit visual review. It must never repeat behind every workflow header or compete with data.

### Measurements are an instrument face

Measurement entry uses a stable list so the collector can see the record and what remains incomplete. Rows prioritize:

1. parameter identity,
2. required/optional state,
3. large tabular numeric entry,
4. persistent unit,
5. a structural requiredness cue.

Required rows use a solid creek spine; optional rows use a dashed neutral spine; a required row with an entry error uses a hollow danger spine plus readable error text. Signed entry remains available only for contract parameters that allow it.

The existing platform keyboard and iOS Next/Done accessory remain the release-candidate input mechanism. A bespoke numeric keypad sheet is intentionally deferred: it adds input-method, accessibility, localization, and Android-parity risk without being necessary to complete Phase 11.

### Density follows task

- Entry screens are instrument-spacious with 48+ point targets.
- Review and read-only records become tighter, aligned field-record rows.
- Long scientific labels wrap; values remain right-aligned where practical.
- Units are never hidden in placeholders.

### Status has fixed grammar

- Workflow state: semantic pill chip.
- Transport state: inline icon + text (`Saved locally`, `Syncing`, `Synced`, `Failed to sync`).
- Validation: titled inline rule/alert with severity and explanation.
- Revision history: timeline only where history matters.

Do not reuse one visual shape for all four meanings.

### Home is work-first

Home prioritizes starting or resuming field work. Correction work precedes ordinary drafts; recent submitted records remain secondary. Site-catalog availability stays visible and actionable. Flat list rows and hairlines are preferred over a stack of rounded cards.

### Review is a field record

Review sections use a strong section label with quiet Edit affordance, followed by flat label/value rows on a working surface. Scientific values use tabular figures. Submission remains the only dominant action. The read-only consequence is stated before submission.

### Corrections must show immutability

A correction must make the revision model visually unmistakable:

- Revision 1 remains submitted/read-only.
- Revision 2 is the editable correction.
- Changed values may identify the prior value only when the app has that real revision data available.
- No design may imply in-place editing of prior submitted science.

A rare structural hemlock band is permitted for correction context because it communicates a materially different task; it should not become a general page-header treatment.

## Color and type

Continue the current Creekline tokens in `mobile/src/constants/theme.ts`: warm field paper, working-surface paper, slate/graphite text, creek teal for actions/focus, hemlock for identity, and semantic warning/danger/success tints. System fonts and Dynamic Type remain mandatory.

## Explicit rejections

- repeated contour/wave background stripes
- generic card-on-card dashboard composition
- unit pills attached to every numeric input
- decorative charts or maps without contract-backed data
- glassmorphism, gradients, heavy shadows, marketing chrome
- client-side scientific plausibility claims
- color-only state distinctions
- custom keypad as a Phase 11 release requirement

## Release-candidate acceptance

The design pass is acceptable only if it also preserves:

- iOS and Android navigation/back behavior
- screen-reader semantics and live error/status announcements
- minimum touch targets
- direct-sunlight readability
- dark-mode geometry parity
- offline/cache/sync/error recovery
- scientific units, GPS accuracy, provenance, revision, and transport state
- Phase 9/10 contract guards and privacy CI

Visual polish is subordinate to data integrity and recoverability, but stability is not an excuse for generic presentation. The goal is a precise, calm, distinctive Central PA field-science instrument.
