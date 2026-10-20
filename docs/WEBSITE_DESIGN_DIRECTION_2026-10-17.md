# Website and motion design direction (2026-10-17)

Scope: the public Watershed Watch website in `public-dashboard/`, the shared identity reveal, and the
motion kit in `brand/`. The QC Console and native apps are touched only through drop-in sources.

## What was inspected first

- Branch `design/watershed-watch-web-prototype` at `081a36e`, clean. The site had two routes: a landing
  page that loaded a live ArcGIS map and also embedded `/dashboard` in an iframe, so the same heavy
  experience loaded twice on one page.
- The landing copy used slash eyebrows, numbered stages, letter-spaced caps and arrow glyphs on every
  link. The dashboard's empty-state panel had the same patterns.
- `html, body { overflow: hidden }` was global, so the landing page scrolled inside a fixed container.
- Reference package `~/Downloads/WatershedWatch-Claude-Handoff.zip`: every logo, photo and token file
  matches its repository original by SHA-256, so the repository is the source of truth.
- `docs/images/portfolio/README.md` already excludes the older `PAWatershedWatch-Previews` iPhone images
  because they show private-looking names and requirement labels that conflict with schema 0.2.0.

## Direction

A plain, confident field-science site. One warm Limestone surface, Hemlock for type and actions,
Deep Water for anything that is water on a map, and Goldenrod used once: the monitoring point. Public
Sans only, sentence case, no letter-spaced labels. Hairline rules and whitespace do the grouping;
there are no cards for their own sake.

Product first. The home page shows the real dashboard within the first screen and explains, in the
same place, why it holds no published readings yet. One interactive map exists on the site, at
`/dashboard`. The home page links to it and warms its code on intent instead of embedding it.

Pages: Home, Dashboard, How it works (the journey from phone to public map, with captioned interface
screens), About (who it is for, data sources, photo credit, what is never published).

Screens used, all captioned as interface illustrations with test data:

- iPhone correction revision (`05-Correction-Revision.png`): shows revision N kept when N+1 is made.
- iPhone offline sync status (`06-Offline-Waiting.png`), cropped to the sync steps.
- iPhone optional measurements (`08-Optional-Measurements.png`): units chosen per reading.
- QC Console review panel and entered/canonical temperature, cropped from the emulator test record.

Not used: the home, measurements and review iPhone screens (sample names, "Required" labels from the
0.1.0 contract, implausible test values) and the sign-in screen (legacy name).

## Motion storyboard

The original strokes draw in their own path direction, which is the direction water flows.

| Time | Event |
| --- | --- |
| 0 ms | Empty surface |
| 0 to 720 ms | Left and right tributaries draw from their headwaters toward the point |
| 300 to 720 ms | The shorter middle tributary draws, so all three arrive together |
| 620 to 980 ms | Monitoring point resolves: opacity and scale 0.72 to 1, no overshoot |
| 860 to 1280 ms | River draws downstream from the point |
| 1160 to 1760 ms | Wordmark appears behind a soft left-to-right mask; the letters never move |
| 1760 ms | Settled. Geometry equals the master exactly |

Easing: `cubic-bezier(0.25, 0.46, 0.45, 0.94)` for strokes with a 16% opacity ramp, and
`cubic-bezier(0.2, 0, 0, 1)` for the point and mask. The first draft used an ease-in-out for strokes;
frame review showed the river starting as a detached dot below the point, so strokes now start
promptly and arrive gently. No loops, glow, bounce or particles. Reduced motion shows the settled lockup.

## Loading behaviour

The page shell, site list and navigation render immediately. Only the map region carries the
reveal, and only if the map is not ready within 200 ms. The reveal plays once per session; later
loads show the settled mark. The veil reports real phases (map, boundaries, approved records), keeps
slow, failed, timed-out and empty states distinct, and lifts as soon as the map is usable. After 15 s it
gives way to the page with a retry, never a dead end.
