# Watershed Watch logo and motion kit

Everything here is generated from two archived sources and one spec, so it can be rebuilt exactly.

| Source | Role |
| --- | --- |
| `submission/brand/assets/logo/pww-mark-master.svg` | The original mark. Its `<g id="mark">` markup is copied verbatim; variants change colour attributes only. |
| `submission/brand/assets/logo/pww-wordmark-{horizontal,stacked}-light.svg` | The original lettering. These masters read "PA Watershed Watch"; the build drops the four "P" and "A" contours and shifts the rest left, so "Watershed Watch" keeps the master's Public Sans glyph shapes and spacing. |
| `brand/motion/source/motion-spec.json` | Timings and easings for the reveal, shared by web, QC Console and native sources. |
| `config/brand_tokens.json` | Light palette (Hemlock, Goldenrod, Limestone) and dark palette (icon stroke, Goldenrod 300, Night). |

```bash
node scripts/brand-motion/build.mjs    # SVG variants, reveal CSS/markup, website copies
node scripts/brand-motion/render.mjs   # MP4/WebM previews and still frames (needs Playwright + ffmpeg)
```

`build.mjs` fails if any output's mark markup differs from the master (apart from colour) or if the
legacy name appears in any output. `render.mjs` seeks paused animations frame by frame, so renders are
deterministic. Set `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` if Playwright is not installed in the repo.

## Static logo

`brand/logo/`, each as `light` (no suffix), `-dark`, `-mono-black`, `-mono-white`:

- `watershed-watch-mark*.svg`: mark only, 103 x 120.5.
- `watershed-watch-horizontal*.svg`: mark and wordmark, 589 x 120.5. Cap height is 40 units, centred on the mark.
- `watershed-watch-stacked*.svg`: mark over wordmark, 310.6 x 178.4. Cap height 26 units.

Use the light lockups on Limestone `#F6F3EC` or white, the dark lockups on Night `#0F1A17`. Keep clear
space of at least the monitoring point's diameter (19 units) on every side. Do not redraw, recolour
individual strokes, add effects or set the name in another typeface.

## Identity reveal

| Time | Event |
| --- | --- |
| 0 to 720 ms | Left and right tributaries draw from their headwaters, in their original path direction |
| 300 to 720 ms | The middle tributary draws, so all three arrive at the point together |
| 620 to 980 ms | The monitoring point resolves: opacity 0 to 1, scale 0.72 to 1, no overshoot |
| 860 to 1280 ms | The river draws downstream from the point (mark settled at 1280 ms) |
| 1160 to 1760 ms | The wordmark appears behind a feathered left-to-right mask; the letters never move |

Strokes use `cubic-bezier(0.25, 0.46, 0.45, 0.94)` with a 16% opacity ramp so no stroke begins as a
detached dot. The point and mask use `cubic-bezier(0.2, 0, 0, 1)`. After the last track ends every
animated property returns to its base value, so the settled frame is the static lockup.

`brand/motion/source/`:

- `motion-spec.json`: the numbers above.
- `reveal.css`, `reveal-{mark,horizontal,stacked}.svg`, `reveal-data.js`: generated animated source.
- `composition.html`: the video composition. Open it in a browser to watch, or add
  `?format=landscape|square|portrait&theme=light|dark&still=<ms>` to hold a frame.
- `lockup-geometry.json`: mark paths and lockup offsets for native implementations.

## Previews

`brand/motion/exports/watershed-watch-reveal-<format>-<theme>.{mp4,webm}`, 4.0 s at 60 fps (400 ms
lead-in, 1760 ms reveal, 1840 ms hold):

| Format | Size | Layout |
| --- | --- | --- |
| landscape | 1920 x 1080 | horizontal lockup, 760 px wide |
| square | 1080 x 1080 | stacked lockup, 520 px wide |
| portrait | 1080 x 1920 | stacked lockup, 520 px wide, 48 px above centre (native-safe) |

`brand/motion/stills/<format>-<theme>-{initial,transition,complete}.png` hold frames at 240 ms,
1040 ms and the settled state.

## Platform use

See [`motion/NATIVE.md`](motion/NATIVE.md) for iOS, Android and QC Console guidance and the drop-in
sources in `motion/native/`.
