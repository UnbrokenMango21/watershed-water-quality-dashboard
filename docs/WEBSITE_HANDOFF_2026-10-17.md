# Website, loading and motion handoff (2026-10-17)

Branch `design/watershed-watch-web-prototype`, from `081a36e`. Nothing is merged, pushed or deployed.
No private data, schema, security rule, function, publisher or native app source was changed.
Direction and storyboard: [WEBSITE_DESIGN_DIRECTION_2026-10-17.md](WEBSITE_DESIGN_DIRECTION_2026-10-17.md).

## Where to look

| What | Path |
| --- | --- |
| Website pages | `public-dashboard/app/page.tsx`, `app/how-it-works/page.tsx`, `app/about/page.tsx`, `app/not-found.tsx`, `app/site.css` |
| Shared chrome | `public-dashboard/components/site/` (header with mobile menu, footer, `DashboardLink`) |
| Map loading veil | `public-dashboard/components/dashboard/MapLoadVeil.tsx`, phases in `useDashboardMap.ts`, wiring in `MapSurface.tsx` and `DashboardShell.tsx` |
| Loading checks | `public-dashboard/scripts/loading-qa.mjs` |
| Screenshots | `docs/images/website-2026-10-17/` (provenance in its README) |
| Logo kit | `brand/logo/` (mark, horizontal, stacked; light, dark, mono) |
| Motion source | `brand/motion/source/` (`motion-spec.json`, `reveal.css`, `composition.html`) |
| Previews | `brand/motion/exports/watershed-watch-reveal-{landscape,square,portrait}-{light,dark}.{mp4,webm}` |
| Stills | `brand/motion/stills/<format>-<theme>-{initial,transition,complete}.png` |
| Native and QC guidance | `brand/motion/NATIVE.md`, sources in `brand/motion/native/` |
| QC Console | `web/components/IdentityReveal.tsx`, loading pane in `web/components/AuthGate.tsx` |
| Build scripts | `scripts/brand-motion/build.mjs` (assets), `scripts/brand-motion/render.mjs` (videos and stills) |

Preview: `cd public-dashboard && npm run build && npx next start -p 3009`, then open
`http://localhost:3009/`. Stop any `next dev` in this folder before building; a running dev server
writes into the same `.next` directory and breaks the build. An older dev server from an earlier
session was running on port 3007 in this worktree; its `.next` was rebuilt, so restart it if you use it.

## Verification (this branch, 2026-10-17)

| Check | Result |
| --- | --- |
| Dashboard `npm run typecheck`, `npm test` (12), `npm run build` | PASS |
| `loading-qa.mjs` on the production build (13 checks: first paint, first and repeat visit, reduced motion, slow, failed and hung basemaps, failed public views, client navigation) | PASS 13/13 |
| axe-core (WCAG 2.1 AA and best practice) on all five routes at 1440 and 390 px | PASS after one fix (dashboard h1 on phones) |
| Mobile menu: focus moves in, Tab cycles, Escape returns focus, navigation closes it, scroll locks | PASS |
| `npm run test:contracts` (75 pass, 3 skipped), `npm run test:publication` (19) | PASS |
| QC Console `typecheck` and `next build --webpack` | PASS |
| QC loading pane in a browser | BLOCKED: without Firebase client config the gate goes straight to "Not configured". Its generated CSS was checked in light and dark with a harness. Needs an emulator session to observe. |
| SwiftUI reveal: `swiftc -typecheck` (iOS 17 simulator SDK), macOS render at 0.24 s, 1.04 s, settled | PASS; frames match the web stills (`brand/motion/native/ios/swiftui-frames.png`) |
| Compose reveal: compiled in the app module with `:app:compileDebugKotlin` (copied in temporarily, then removed) | PASS. No device run. |
| `build.mjs` guards: every output's mark markup equals the master apart from colour; no output contains the legacy name | PASS |
| Existing `scripts/visual-qa.mjs` | Not run (imports `playwright`, which is not installed in the package) |

## Decisions for you

- The QC Console header and title still say "PA Watershed Watch". It is an internal tool, so I left it.
  Renaming is three strings in `web/`.
- The About page says "a watershed research program" and does not name the institution. The
  portfolio notes say naming a lab or supervisor needs your choice.
- Native reveals are drop-in only. Wiring them into the iOS or Android app needs a release decision
  and device checks (`brand/motion/NATIVE.md` lists the steps).

## Known issues not addressed

- The dashboard rebuilds the whole ArcGIS map when the filtered site list changes (each search
  keystroke once sites exist). Empty approved data no longer triggers a rebuild, but the general case
  should update layers in place instead.
- H.264 previews use 4:2:0 colour; flat backgrounds can differ by a value or two from the tokens. The
  PNG stills are exact.
