# Creekline Field System

## Purpose

Creekline is the visual and interaction language for the Central PA Watershed
collector app. It must feel like a precise field instrument: calm, legible in
direct sun, trustworthy around scientific data, and native on both iOS and
Android.

The system synthesizes low-chrome native hierarchy, rigorous semantic state
design, warm environmental materials, and the useful parts of the existing
app. It does not reproduce any one third-party brand.

## Design principles

1. **The reading is the hero.** Site, time, location, provenance, units, and
   measurement values outrank decoration.
2. **State is explicit.** Loading, cached, offline, saved locally, syncing,
   synced, failed, submitted, and correction states always use text plus an
   icon or structural cue. Color is never the only signal.
3. **Native before custom.** Use platform navigation, date/time controls,
   permission behavior, keyboard conventions, safe areas, and Android back
   behavior wherever Expo supports them cleanly.
4. **Warm, flat, and field-ready.** Prefer field-paper surfaces, whitespace,
   and hairlines to floating cards, shadows, gradients, or glass effects.
5. **One action signal.** Creek teal identifies interactive controls and focus.
   Hemlock carries identity and structural emphasis, not every action.
6. **No silent work.** Any operation that can take time or fail explains what
   is happening and gives the collector a recovery path.

## Color roles

### Light field theme

| Token | Value | Role |
| --- | --- | --- |
| `fieldPaper` | `#F5F2E8` | Primary warm canvas |
| `workingSurface` | `#FFFDF8` | Inputs, sheets, focused work areas |
| `surfaceMuted` | `#E7ECE6` | Alternate bands, disabled/background state |
| `ink` | `#172321` | Primary text and high-priority data |
| `slate` | `#4E5E5B` | Secondary text and metadata |
| `muted` | `#5B6B68` | Tertiary text; never essential instructions alone |
| `hairline` | `#C9D0CA` | Decorative separators only |
| `controlBorder` | `#7A8985` | Resting input and interactive-row boundary |
| `creek` | `#0B6268` | Primary actions, links, focus, informational state |
| `creekPressed` | `#074C51` | Pressed primary action |
| `creekSoft` | `#DCEBED` | Informational tint |
| `hemlock` | `#24503F` | Brand identity and rare structural bands |
| `hemlockSoft` | `#DDE8DF` | Cached/offline-safe environmental tint |
| `success` | `#276749` | Confirmed completed/synced state |
| `successSoft` | `#E1EFE6` | Success tint |
| `warning` | `#8A5A00` | Needs attention, pending review, reduced accuracy |
| `warningSoft` | `#F6EACB` | Warning tint |
| `danger` | `#B42318` | Errors, failed sync, destructive actions |
| `dangerPressed` | `#8F1C13` | Pressed destructive action |
| `dangerSoft` | `#F8E3DF` | Error tint |
| `disabledSurface` | `#D9DEDA` | Genuinely unavailable control surface |
| `disabledText` | `#5B6B68` | Genuinely unavailable control label |
| `secondaryPressed` | `#E1E6E1` | Pressed secondary control |
| `onAction` | `#FFFFFF` | Text/icons on creek, hemlock, and semantic fills |
| `focus` | `#0B6268` | Focus ring plus non-color focus treatment |

Primary contrast pairs are intentionally strong: ink on field paper, slate on
field paper, and white on creek or hemlock all meet normal-text contrast needs.
Do not reduce important text with opacity.

### Dark field theme

| Token | Value | Role |
| --- | --- | --- |
| `nightCreek` | `#101918` | Primary canvas |
| `nightSurface` | `#182522` | Inputs and working surfaces |
| `nightMuted` | `#21312D` | Alternate bands |
| `paperText` | `#F5F2E8` | Primary text |
| `paperSecondary` | `#C5D0CB` | Secondary text |
| `nightHairline` | `#3C504A` | Decorative separators |
| `nightControlBorder` | `#71867F` | Resting input and interactive-row boundary |
| `creekBright` | `#78CDD0` | Actions and focus |
| `creekBrightPressed` | `#6AB7BB` | Pressed primary action |
| `nightOnAction` | `#101918` | Text/icons on bright semantic fills |
| `hemlockBright` | `#8DC6A8` | Identity and success |
| `nightSuccessSoft` | `#1D392C` | Success tint |
| `nightWarning` | `#E1B75A` | Needs-attention foreground |
| `nightWarningSoft` | `#3A2D12` | Needs-attention tint |
| `nightDanger` | `#F0968C` | Error/destructive foreground |
| `nightDangerSoft` | `#402321` | Error tint |
| `nightInfoSoft` | `#183438` | Informational tint |
| `nightDisabledSurface` | `#2A3935` | Genuinely unavailable control surface |
| `nightDisabledText` | `#A8B5B0` | Genuinely unavailable control label |

Light `muted` meets 4.5:1 on `fieldPaper`; both control-border tokens meet the
3:1 non-text contrast requirement against their working surfaces. Semantic
dark-theme foregrounds use `nightOnAction`, while tinted surfaces use
`paperText` or `paperSecondary` as verified for their role. Light theme remains
the primary outdoor verification target.

## Typography

Use the platform system font. Do not add a font dependency for brand effect.
Support Dynamic Type/font scaling and test wrapping rather than truncating
scientific labels.

| Token | Size / line | Weight | Use |
| --- | --- | --- | --- |
| `screenTitle` | 30 / 36 | 700 | One clear screen purpose |
| `sectionTitle` | 20 / 26 | 600 | Major form/list sections |
| `body` | 17 / 24 | 400 | Primary reading text |
| `bodyStrong` | 17 / 24 | 600 | Emphasized values and row titles |
| `label` | 15 / 20 | 600 | Form labels |
| `helper` | 14 / 20 | 400 | Guidance and validation explanation |
| `caption` | 13 / 18 | 500 | Metadata and compact status text |
| `eyebrow` | 12 / 16 | 700 | Rare Central PA identity or step context |
| `numeric` | 30 / 36 | 600 | Measurement entry and review values |

`numeric` uses tabular figures. Unit labels remain visible beside the number;
never rely on placeholder text to communicate a unit. Avoid weights below 400
and body sizes below 14 in field workflows.

## Spacing and layout

- Base grid: 4 points.
- Scale: 4, 8, 12, 16, 20, 24, 32, 48.
- Phone horizontal gutter: 20 points; 16 only when width is constrained.
- Main content width caps at 680 points on tablets/large windows.
- Separate ordinary sections with 24–32 points of space or a hairline.
- Keep related label/input/helper groups within 8 points.
- Primary bottom actions remain reachable above safe area and keyboard.
- Long forms scroll as one clear sequence. Do not nest scroll views.

Prefer full-width working sections and list rows. A border does not make a
section a card. Reserve bounded containers for records, alerts, modal sheets,
or grouped content that genuinely needs an edge.

## Shape and elevation

| Token | Value | Use |
| --- | --- | --- |
| `radiusInput` | 8 | Inputs, buttons, selectable rows |
| `radiusRecord` | 10 | Draft/submission record groups |
| `radiusSheet` | 16 | Native-style modal sheets only |
| `radiusPill` | full | Compact status chips only |

Normal form sections, list rows, buttons, and inputs have no drop shadow.
Use a subtle shadow only for a true overlay or floating modal: on iOS, a
maximum `0 8 20 rgba(23, 35, 33, 0.12)`; on Android, elevation 4 or lower.
Never stack rounded cards inside rounded cards.

## Touch and interaction

- Absolute minimum touch target: 48 × 48 points.
- Primary actions and numeric inputs: 52–56 points high.
- Pressed state must be immediate through color/surface change; optional scale
  feedback must not make targets appear unstable.
- Keep destructive actions separated and clearly labeled.
- Motion is short (120–200 ms), functional, and disabled/reduced when the
  platform requests reduced motion.
- Do not disable a visible action without adjacent plain-language reasoning.
- Do not expose controls for unimplemented work.

## Component grammar

### Navigation and headers

- Keep the custom identity header on collector home only. Child routes use one
  native stack title/back path and the platform's default transition.
- Use a quiet screen header: step/context, title, and at most one supporting
  sentence.
- Android system back and iOS back gestures return to the prior editable step
  without losing draft data.
- Keep Android predictive back enabled unless a reproduced Expo/Router defect
  requires a documented temporary exception.
- Profile/account is a real control with identity and sign-out, not an avatar
  ornament. Present account controls in a native sheet or stack screen, with a
  destructive sign-out confirmation.
- Show workflow progress as `Step N of 5 · Step name`; do not compress five
  labels into a rail that truncates under large text.

### Buttons

- Primary: creek fill, `onAction` label, 52–56 high, 8 radius. Dark theme uses
  `creekBright` with `nightOnAction`.
- Secondary: working-surface fill, `controlBorder`, ink label.
- Destructive: danger text/border or fill according to consequence.
- Text action: creek text with at least a 48-point hit area.
- Pressed states use the matching pressed token; focus adds both the focus ring
  and a structural cue. Disabled states use the disabled tokens only for a real,
  adjacent prerequisite.
- Loading buttons retain their visible label and width, expose busy state, and
  prevent duplicate work.

### Inputs and selection rows

- Labels stay above fields; required/optional context is explicit.
- Rest: working surface + `controlBorder`. Focus: creek 2-point border plus a
  visible focus treatment that does not rely on color alone.
- Error: danger structural cue plus readable message and recovery instruction.
- Disabled style is reserved for real prerequisites and must explain them.
- Selection rows show current value, chevron where navigation follows, and a
  full-row 52-point target.

### Measurement entry

- Large tabular numeric value with persistent unit.
- Decimal keypad where available; preserve transient strings such as `-`, `.`,
  and `1.` until commit. Signed entry is offered only for contract parameters
  that permit it. iOS numeric entry includes a reachable Next/Done accessory.
- Temperature asks for entered unit first, preserves that entered value/unit,
  and derives the counterpart immediately. A new draft begins with neither unit
  selected; a resumed draft restores its explicit unit.
- Core and optional fields come from repository configuration/contracts.
- Client messages explain missing/invalid entry shape only; Phase 10 remains
  authoritative for scientific validation semantics.

### Lists and records

- Site, draft, and submission rows are flat working rows separated by space or
  hairlines.
- Primary line: site/record identity. Secondary line: location/time/context.
- Trailing content: concise status or navigation affordance, never both if it
  creates clutter.
- Loading uses stable skeleton/indicator geometry. Empty and error states name
  the state and offer the next real action.

### Status and alerts

- Status chips are compact pills; ordinary buttons are not pills.
- Each state combines icon, text, and semantic color.
- Offline/cached state stays visible near the affected content.
- Sync status is persistent on drafts/submissions: Saved locally, Syncing,
  Synced, or Failed with Retry.
- Alerts do not disappear before the collector can understand the outcome.

## Screen patterns

### Authentication

Calm identity, two direct fields, one primary sign-in action, visible invalid
authentication/network feedback, and no extra marketing chrome.

### Collector home

Identity and account access first, then one working action for a new
observation, followed by recent drafts/submissions. Site availability and
offline/cached state must be actionable rather than a disabled placeholder.

### Site catalog

Search/refresh only if implemented. Support loading, error with retry, empty,
fresh, and cached-offline states. Site rows optimize for name and field
disambiguation, not decorative imagery.

### Observation workflow

Use short native-feeling steps with a visible progress context:

1. Site
2. Visit (date/time and GPS accuracy)
3. Method (test type and provenance)
4. Measurements
5. Review

Back/edit preserves the draft. Review uses flat labeled rows and explicit edit
links with 48-point targets. Site, local time/timezone, GPS and reported
accuracy, test type, provenance, every measurement and unit, notes, revision,
and transport state are visible. Submission is never conflated with local save
or Firestore acknowledgement, and an explicit confirmation explains that the
submitted revision becomes read-only.

### Drafts, submissions, and corrections

Drafts expose local/sync state and resume action. Workflow state and transport
state are separate. Submitted science is read-only. `NEEDS_CORRECTION` starts a
new revision, shows permitted validation feedback with blocking errors first,
preserves the prior revision, and ends in `RESUBMITTED` when the existing
contract permits it. Known and unknown server states render safely rather than
crashing or being presented as transport state.

Attachments are absent from the exposed v1 UI unless a real contract-backed
implementation is added. Notes appear only where the existing schema permits.

## Watershed motif

Use one or two thin creek/topographic contour lines as low-contrast background
detail in otherwise empty header or empty-state space. In light theme use
`creek` at 4% alpha; in dark theme use `creekBright` at 3.5% alpha. Motifs are
hidden from the accessibility tree, never sit behind data, never animate during
entry, and never become a repeated decorative border.

## Accessibility and outdoor verification

- Verify normal text at 4.5:1 and large/non-text essentials at 3:1 minimum.
- Support screen-reader names, roles, values, hints, and live announcements for
  auth, permission, validation, and sync changes.
- Focus moves to the first relevant error after failed submission/review.
- Do not truncate site names, measurement labels, validation messages, or units.
- Do not cap text scaling in the field workflow. Let rows grow and summaries
  stack vertically at large sizes.
- Test large text, dark mode, reduce motion, and touch targets.
- Test light theme at maximum simulator brightness and with grayscale/contrast
  inspection as proxies for direct-sunlight use.

## Platform behavior

- iOS: safe-area-aware stack/sheet behavior, native back gesture, appropriate
  keyboard content types, and system date/time/location permission UI.
- Android: system back handling, material-native permission and date/time UI,
  keyboard avoidance, predictive back, and no iOS-only spacing assumptions.
- Shared semantics and data state stay identical; platform chrome may differ.

## Scientific display precision

- Keep stored numeric and coordinate values unrounded wherever the contract
  permits. Display rounding is presentation only.
- Coordinates show enough decimal places for the reported GPS accuracy and
  always show accuracy separately as `±N m`; never infer suitability from an
  ad-hoc client threshold.
- Temperature follows the existing two-decimal display contract. Other
  measurements use contract/catalog display precision when the matching code
  exists; Phase 10 parameter code and unit remain authoritative when older
  presentation metadata disagrees.

## Guardrails

### Do

- Preserve useful existing components and move shared refinement into tokens.
- Keep data hierarchy and status language consistent across every screen.
- Use surface bands, whitespace, and hairlines before adding containers.
- Make every exposed control complete, recoverable, and testable.
- Keep analytics coarse and free of scientific, location, note, identity, or
  authentication payloads.

### Do not

- Do not turn every section into a floating rounded card.
- Do not use universal pills, decorative gradients, glass, or heavy shadows.
- Do not use saturated green as decoration or color alone as status.
- Do not hide units, GPS accuracy, provenance, revision, or sync state.
- Do not invent validation, ownership, quality, or publication semantics.
- Do not expose decorative, dead, or future-facing controls in v1.
