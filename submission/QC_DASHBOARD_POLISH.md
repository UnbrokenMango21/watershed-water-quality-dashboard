# QC console / public dashboard visual polish

Isolated frontend-polish pass on `agent/claude-final-polish`, based on
`62fd499`, then reviewed and cherry-picked into the release branch. Scope was
restricted to `web/`, `public-dashboard/`, and `submission/` docs/screenshots.
No backend, science, publication, config, credential, or auth-logic files were
touched.

## Commits

- `3a221b4` — QC console: hemlock brand palette + `<nav>`/`<main>` landmarks.
- `c1dd85f` — Public dashboard: hemlock brand palette + demo-banner emphasis.
- `7b7cb7d` — submission documentation and screenshot checklist.

The three commits were reviewed individually and integrated as `6638b04`,
`6134ca2`, and `563cd77` on the release branch. The source polish diff touches
only `web/` and `public-dashboard/`; the documentation commit touches
`submission/`.

## What changed and why

1. **Brand harmonization.** Before this pass, the QC console used a teal/navy
   accent ladder (`--brand-*`, `--navy`) and the public dashboard used an
   unrelated blue (`--accent`, `#007ac2`). Neither matched the hemlock-green
   watershed brand already applied to the iOS/Android apps and store assets
   in `3a0547a`/`62fd499` (see `Phone App/iPhone App/PAWatershedWatch/brand-spec.md`).
   Both apps' color tokens — and every hardcoded blue literal derived from
   them (hover/selected states, map tool ring, Calcite focus color,
   parameter-tab glyph swatches) — were re-hued to hemlock green. Semantic
   severity colors (error/warning/alert/ok/info) were left untouched;
   `--success`/`--warning` in the dashboard were aligned to the brand's exact
   Fern/Goldenrod hex values, which were already nearly identical. No
   layout, spacing, or component structure changed.
2. **Accessibility.** The QC console's reviewer workspace had no landmark
   elements besides the app bar; the queue rail is now a `<nav
   aria-label="Review queue">` and the record pane a `<main>`. The public
   dashboard's global `focus-visible` rule was extended to cover anchor
   links (previously only `button`/`input`/`select`/`[tabindex]`).
3. **Demo-mode disclosure.** The public dashboard's existing `DEMO MODE`
   banner (`NEXT_PUBLIC_DASHBOARD_DATA_MODE=demo`, driving a mock data
   source with zero fallback to synthetic data in production — this was
   already correct and untouched) got a warning icon and heavier visual
   weight so it reads as a warning strip rather than a thin caption line.

## Verified (PASS)

Run from repo root after `npm ci --prefix web && npm ci --prefix
public-dashboard` (neither app's `node_modules` was present in this
worktree beforehand):

- `npm test --prefix public-dashboard` — 6/6 pass.
- `npm run typecheck --prefix web` — pass (`tsc --noEmit`).
- `npm run build --prefix web` — pass (Next.js 16 / Turbopack).
- `npm run typecheck --prefix public-dashboard` — pass.
- `npm run build --prefix public-dashboard` — pass (Next.js 15).

Equivalent to `bash scripts/dev.sh web-checks`, run directly rather than
through the wrapper script for the dependency-install step.

## Proof limits — explicit

- **Live browser verification was performed separately.** The hosted QC
  console was opened with the ADMIN session and a live TEST-014 Revision 2
  readback was verified without taking a review action. The hosted public
  dashboard was opened anonymously and showed the connected empty source with
  ArcGIS attribution and no synthetic fallback. Those checks are evidence of
  live behavior; image files were not committed to this repository.
- **Brand-mark image files not copied.** The task brief allowed copying
  `qc-brand-mark.png` / `dashboard-brand-mark.png` from
  `Watershed-release-evidence/2026-09-27/` into `web/public/brand-mark.png`
  and `public-dashboard/public/brand-mark.png` (both empty directories were
  created and are ready to receive them). This session's sandbox refused
  every `cp`/shell read from that path (outside the allowed working
  directory, and not approvable non-interactively), so the two app bars
  still render their placeholder glyph (an inline icon in `web`, the
  literal character `≈` in `public-dashboard`) instead of the real mark.
  Copying the two files and swapping `AuthGate.tsx`'s `<Icon name="waves">`
  and `DashboardShell.tsx`'s `≈` span for an `<img src="/brand-mark.png">`
  is a small follow-up someone with filesystem access outside this worktree
  can do directly.
- **No deployment was invoked by the polish branch.** The integrated commits
  passed the release web checks. The existing hosted development QC console
  and dashboard were verified separately; no Firestore/Storage rules or
  scientific records were changed.
- **Not reviewed for scientific or release sign-off.** This is a frontend
  polish diff. It does not
  authorize activating publication, approving science, or certifying
  semester hours (per `CLAUDE.md`).

## Not attempted (out of scope for this pass)

- Retrofitting the QC console's ad-hoc pixel spacing to a spacing-scale
  token set (the public dashboard already has one, `--s1`..`--s4`; the QC
  console does not). Judged too large a structural change for a polish
  pass — would touch most of `web/app/globals.css` — and left as a
  recommendation, not a defect.
- ArcGIS map attribution: already present natively via the ArcGIS Maps SDK
  web component (`attribution-mode="light"` in `useDashboardMap.ts`); no
  additional source-attribution UI was added on top of it.
