// Builds the Watershed Watch logo and motion kit from the archived masters and motion-spec.json.
//
//   node scripts/brand-motion/build.mjs
//
// The mark is copied verbatim from submission/brand/assets/logo/pww-mark-master.svg (only colour
// attributes change between variants). The wordmark outlines come from the archived "PA Watershed
// Watch" masters with the "PA" contours removed (see wordmark.mjs). Outputs:
//   brand/logo/*.svg                     reusable static variants
//   brand/motion/source/lockup-geometry.json  geometry consumed by the native sources
//   brand/motion/source/reveal.css, reveal-*.svg, reveal-data.js   animated sources (from motion-spec.json)
//   public-dashboard/public/brand/*.svg  copies served by the website
//   public-dashboard/styles/reveal.css, public-dashboard/lib/brand/reveal.generated.ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bbox, loadCorrectedWordmark, serialize, transform } from "./wordmark.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const masters = path.join(root, "submission/brand/assets/logo");
const out = path.join(root, "brand/logo");
const motionSource = path.join(root, "brand/motion/source");
const webBrand = path.join(root, "public-dashboard/public/brand");
const tokens = JSON.parse(fs.readFileSync(path.join(root, "config/brand_tokens.json"), "utf8")).palette;

const masterSvg = fs.readFileSync(path.join(masters, "pww-mark-master.svg"), "utf8");
const markGroup = masterSvg.match(/<g id="mark"[\s\S]*?<\/circle><\/g>/)?.[0];
if (!markGroup) throw new Error("Could not find <g id=\"mark\"> in the master mark");

// Visible extent of the mark in master coordinates (stroke caps included, after translate(0 -5)).
const MARK = { minX: 17.5, maxX: 110.5, minY: 8.5, maxY: 119, centerX: 64 };
const PAD = 5;

export const themes = {
  light: { stream: tokens.hemlock, point: tokens.goldenrod, word: tokens.hemlock, canvas: tokens.limestone50 },
  dark: { stream: tokens.iconStroke, point: tokens.goldenrod300, word: tokens.iconStroke, canvas: tokens.night },
  "mono-black": { stream: "#000000", point: "#000000", word: "#000000" },
  "mono-white": { stream: "#FFFFFF", point: "#FFFFFF", word: "#FFFFFF" },
};

const recolor = (group, theme) => group
  .replace('stroke="#0D5C4B"', `stroke="${theme.stream}"`)
  .replace('fill="#A76100"', `fill="${theme.point}"`);

const svg = (w, h, title, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${round(w)}" height="${round(h)}" viewBox="0 0 ${round(w)} ${round(h)}" role="img" aria-label="${title}">` +
  `<title>${title}</title>${body}</svg>\n`;
const round = (v) => Number(v.toFixed(2));

// Horizontal: wordmark from the horizontal master, cap height 40 on the mark's vertical centre.
const horizontal = loadCorrectedWordmark(path.join(masters, "pww-wordmark-horizontal-light.svg"), 205);
const hMarkDx = PAD - MARK.minX;
const hMarkDy = PAD - MARK.minY;
// The master placed the mark at translate(-12.5 -3.5): the same offsets as PAD - MARK.min.
const hWord = transform(horizontal.subpaths, { dx: hMarkDx + 12.5, dy: hMarkDy + 3.5 });
const hBox = bbox(hWord);
const hW = hBox.maxX + PAD;
const hH = MARK.maxY - MARK.minY + PAD * 2;

// Stacked: wordmark from the stacked master (cap height 26), centred under the mark.
const stacked = loadCorrectedWordmark(path.join(masters, "pww-wordmark-stacked-light.svg"), 55);
const sRaw = bbox(stacked.subpaths);
const sSidePad = 8;
const sW = sRaw.width + sSidePad * 2;
const sMarkDx = sW / 2 - MARK.centerX;
const sMarkDy = PAD - MARK.minY;
// Keep the master's vertical rhythm: the stacked master put the mark at translate(117 -3.5).
const sWord = transform(stacked.subpaths, { dx: sSidePad - sRaw.minX, dy: sMarkDy + 3.5 });
const sH = bbox(sWord).maxY + PAD + 1.5;

const markPlaced = (theme, dx, dy) => `<g transform="translate(${round(dx)} ${round(dy)})">${recolor(markGroup, theme)}</g>`;
const wordPath = (subpaths, theme) => `<path id="wordmark" fill="${theme.word}" d="${serialize(subpaths)}"/>`;

fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(motionSource, { recursive: true });
fs.mkdirSync(webBrand, { recursive: true });

const written = [];
const write = (dir, name, content) => { fs.writeFileSync(path.join(dir, name), content); written.push(path.relative(root, path.join(dir, name))); };

for (const [name, theme] of Object.entries(themes)) {
  const suffix = name === "light" ? "" : `-${name}`;
  const markW = MARK.maxX - MARK.minX + PAD * 2;
  const markH = MARK.maxY - MARK.minY + PAD * 2;
  write(out, `watershed-watch-mark${suffix}.svg`, svg(markW, markH, "Watershed Watch", markPlaced(theme, PAD - MARK.minX, PAD - MARK.minY)));
  write(out, `watershed-watch-horizontal${suffix}.svg`, svg(hW, hH, "Watershed Watch", markPlaced(theme, hMarkDx, hMarkDy) + wordPath(hWord, theme)));
  write(out, `watershed-watch-stacked${suffix}.svg`, svg(sW, sH, "Watershed Watch", markPlaced(theme, sMarkDx, sMarkDy) + wordPath(sWord, theme)));
}

for (const name of ["watershed-watch-mark.svg", "watershed-watch-mark-dark.svg", "watershed-watch-horizontal.svg", "watershed-watch-horizontal-dark.svg"]) {
  fs.copyFileSync(path.join(out, name), path.join(webBrand, name));
  written.push(path.relative(root, path.join(webBrand, name)));
}

const geometry = {
  $comment: "Generated by scripts/brand-motion/build-logos.mjs. Mark paths are verbatim from submission/brand/assets/logo/pww-mark-master.svg; wordmark outlines are the archived master's lettering with \"PA\" removed.",
  mark: {
    markGroupTransform: "translate(0 -5)",
    visibleBounds: MARK,
    paths: {
      "tributary-left": { d: "M22 18C28 36 40 50 53.8 60.4", strokeWidth: 9 },
      "tributary-middle": { d: "M64 30L64 57", strokeWidth: 9 },
      "tributary-right": { d: "M106 18C100 36 88 50 74.2 60.4", strokeWidth: 9 },
      river: { d: "M64 91C64 104 55 107 55 118", strokeWidth: 12 },
    },
    monitoringPoint: { cx: 64, cy: 74, r: 9.5 },
  },
  horizontal: { width: round(hW), height: round(hH), markTranslate: [round(hMarkDx), round(hMarkDy)], wordmark: serialize(hWord), wordmarkBounds: mapRound(hBox), capHeight: 40 },
  stacked: { width: round(sW), height: round(sH), markTranslate: [round(sMarkDx), round(sMarkDy)], wordmark: serialize(sWord), wordmarkBounds: mapRound(bbox(sWord)), capHeight: 26 },
  themes: { light: themes.light, dark: themes.dark },
};
function mapRound(b) { return Object.fromEntries(Object.entries(b).map(([k, v]) => [k, round(v)])); }
write(motionSource, "lockup-geometry.json", JSON.stringify(geometry, null, 2) + "\n");

// Guard: the mark markup in every output must equal the master apart from colour attributes.
const normalise = (s) => s.replace(/(stroke|fill)="#[0-9A-Fa-f]{6}"/g, "$1=\"*\"");
for (const file of written.filter((f) => f.endsWith(".svg"))) {
  const group = fs.readFileSync(path.join(root, file), "utf8").match(/<g id="mark"[\s\S]*?<\/circle><\/g>/)?.[0];
  if (!group || normalise(group) !== normalise(markGroup)) throw new Error(`${file}: mark geometry differs from the master`);
}

// ---------------------------------------------------------------------------------------------
// Animated sources. Same mark markup, with classes for the reveal and pathLength="1" on strokes.
const spec = JSON.parse(fs.readFileSync(path.join(motionSource, "motion-spec.json"), "utf8"));
const track = (part) => spec.tracks.find((t) => t.part === part);
const easing = (name) => `cubic-bezier(${spec.easings[name].join(",")})`;
const paths = geometry.mark.paths;
const revealMark = (dx, dy) =>
  `<g transform="translate(${round(dx)} ${round(dy)})"><g transform="${geometry.mark.markGroupTransform}">` +
  `<g class="wwr-streams" fill="none" stroke="${themes.light.stream}" stroke-linecap="round" stroke-linejoin="round">` +
  Object.entries(paths).map(([part, p]) => `<path class="wwr-${part}" stroke-width="${p.strokeWidth}" pathLength="1" d="${p.d}"/>`).join("") +
  `</g><circle class="wwr-point" cx="64" cy="74" r="9.5" fill="${themes.light.point}"/></g></g>`;

const sweeps = {};
function revealSvg(layout) {
  if (layout === "mark") {
    const w = MARK.maxX - MARK.minX + PAD * 2, h = MARK.maxY - MARK.minY + PAD * 2;
    return { width: round(w), height: round(h), svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round(w)} ${round(h)}" width="${round(w)}" height="${round(h)}" aria-hidden="true" focusable="false">${revealMark(PAD - MARK.minX, PAD - MARK.minY)}</svg>` };
  }
  const g = geometry[layout];
  const b = g.wordmarkBounds;
  const W = b.width;
  const feather = track("wordmark").featherFraction;
  // The mask rectangle ends just left of the word with its solid part past the right edge, and
  // starts fully left of the word: the reveal travels 1.3 word widths with a soft leading edge.
  const sweepWidth = 1.35 * W;
  const endX = b.minX - 0.06 * W;
  const travel = 1.3 * W;
  const region = { x: b.minX - 1.5 * W, y: b.minY - 6, w: 2.6 * W, h: b.height + 12 };
  sweeps[layout] = { endX: round(endX), width: round(sweepWidth), travel: round(travel), feather };
  const defs = `<defs><linearGradient id="__ID__-g"><stop offset="0" stop-color="#fff"/><stop offset="${1 - feather}" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<mask id="__ID__-m" maskUnits="userSpaceOnUse" x="${round(region.x)}" y="${round(region.y)}" width="${round(region.w)}" height="${round(region.h)}">` +
    `<rect class="wwr-sweep" x="${round(endX)}" y="${round(region.y)}" width="${round(sweepWidth)}" height="${round(region.h)}" fill="url(#__ID__-g)"/></mask></defs>`;
  return {
    width: g.width, height: g.height,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${g.width} ${g.height}" width="${g.width}" height="${g.height}" aria-hidden="true" focusable="false" style="--wwr-travel:${round(travel)}px">` +
      defs + revealMark(g.markTranslate[0], g.markTranslate[1]) +
      `<g mask="url(#__ID__-m)"><path class="wwr-word" fill="${themes.light.word}" d="${g.wordmark}"/></g></svg>`,
  };
}
const reveal = Object.fromEntries(["mark", "horizontal", "stacked"].map((layout) => [layout, revealSvg(layout)]));

const fade = `${Math.round(spec.strokeFadeInFraction * 100)}%`;
const css = [
  "/* GENERATED from brand/motion/source/motion-spec.json by scripts/brand-motion/build.mjs. Do not edit by hand.",
  "   Watershed Watch identity reveal. Add data-play=\"true\" to a .wwr element to play it once; without it",
  "   the lockup is drawn settled, which is also the reduced-motion presentation. */",
  `.wwr{--wwr-stream:${themes.light.stream};--wwr-point:${themes.light.point};--wwr-word:${themes.light.word};display:block;line-height:0}`,
  `.wwr--dark,[data-theme="dark"] .wwr{--wwr-stream:${themes.dark.stream};--wwr-point:${themes.dark.point};--wwr-word:${themes.dark.word}}`,
  // Surfaces that follow the viewer's preference (the QC Console uses <html data-theme="system">).
  `@media (prefers-color-scheme:dark){[data-theme="system"] .wwr{--wwr-stream:${themes.dark.stream};--wwr-point:${themes.dark.point};--wwr-word:${themes.dark.word}}}`,
  ".wwr svg{display:block;width:100%;height:auto;overflow:visible}",
  ".wwr .wwr-streams{stroke:var(--wwr-stream)}.wwr .wwr-point{fill:var(--wwr-point)}.wwr .wwr-word{fill:var(--wwr-word)}",
  ...spec.tracks.map((t) => {
    const selector = t.kind === "sweep" ? ".wwr-sweep" : t.kind === "resolve" ? ".wwr-point" : `.wwr-${t.part}`;
    const extra = t.kind === "resolve" ? "transform-box:fill-box;transform-origin:50% 50%;" : "";
    return `.wwr[data-play="true"] ${selector}{${extra}animation:wwr-${t.kind} ${t.duration}ms ${easing(t.easing)} ${t.delay}ms backwards}`;
  }),
  `@keyframes wwr-draw{0%{stroke-dasharray:1 3;stroke-dashoffset:1.02;opacity:0}${fade}{opacity:1}100%{stroke-dasharray:1 3;stroke-dashoffset:0;opacity:1}}`,
  `@keyframes wwr-resolve{0%{opacity:${track("monitoring-point").fromOpacity};transform:scale(${track("monitoring-point").fromScale})}100%{opacity:1;transform:scale(1)}}`,
  "@keyframes wwr-sweep{0%{transform:translateX(calc(var(--wwr-travel) * -1))}100%{transform:translateX(0)}}",
  '@media (prefers-reduced-motion:reduce){.wwr[data-play="true"] *{animation:none!important}}',
  "",
].join("\n");

write(motionSource, "reveal.css", css);
for (const [layout, r] of Object.entries(reveal)) write(motionSource, `reveal-${layout}.svg`, r.svg.replaceAll("__ID__", "wwr") + "\n");
write(motionSource, "reveal-data.js", "// GENERATED by scripts/brand-motion/build.mjs. Used by composition.html.\n" +
  `window.WW_REVEAL = ${JSON.stringify({ svg: Object.fromEntries(Object.entries(reveal).map(([k, v]) => [k, v.svg])), size: Object.fromEntries(Object.entries(reveal).map(([k, v]) => [k, { width: v.width, height: v.height }])), themes: geometry.themes, spec })};\n`);

const tsModule = "// GENERATED from brand/motion/source/motion-spec.json by scripts/brand-motion/build.mjs. Do not edit by hand.\n" +
  "/** Reveal markup per layout. Replace __ID__ with a document-unique id before inserting. */\n" +
  `export const REVEAL_SVG = ${JSON.stringify(Object.fromEntries(Object.entries(reveal).map(([k, v]) => [k, v.svg])), null, 2)} as const;\n` +
  `export const REVEAL_SIZE = ${JSON.stringify(Object.fromEntries(Object.entries(reveal).map(([k, v]) => [k, { width: v.width, height: v.height }])))} as const;\n` +
  `export const REVEAL_TIMING = ${JSON.stringify({ ...spec.web, settledAt: spec.settledAt })} as const;\n` +
  "export type RevealLayout = keyof typeof REVEAL_SVG;\n";
// Each web app is its own App Hosting root, so each receives its own copy (like brand-tokens.css).
fs.mkdirSync(path.join(root, "public-dashboard/lib/brand"), { recursive: true });
write(path.join(root, "public-dashboard/styles"), "reveal.css", css);
write(path.join(root, "public-dashboard/lib/brand"), "reveal.generated.ts", tsModule);
write(path.join(root, "web/app"), "reveal.css", css);
write(path.join(root, "web/lib"), "reveal.generated.ts", tsModule);

// Native geometry and timing, generated so SwiftUI and Compose match the web reveal exactly.
const nativeDir = path.join(root, "brand/motion/native");
fs.mkdirSync(path.join(nativeDir, "ios"), { recursive: true });
fs.mkdirSync(path.join(nativeDir, "android"), { recursive: true });
const markSize = { width: round(MARK.maxX - MARK.minX + PAD * 2), height: round(MARK.maxY - MARK.minY + PAD * 2) };
const layouts = {
  mark: { ...markSize, markTranslate: [round(PAD - MARK.minX), round(PAD - MARK.minY)], wordmark: "", sweep: { endX: 0, width: 0, travel: 0, feather: 0 } },
  horizontal: { width: geometry.horizontal.width, height: geometry.horizontal.height, markTranslate: geometry.horizontal.markTranslate, wordmark: geometry.horizontal.wordmark, sweep: sweeps.horizontal },
  stacked: { width: geometry.stacked.width, height: geometry.stacked.height, markTranslate: geometry.stacked.markTranslate, wordmark: geometry.stacked.wordmark, sweep: sweeps.stacked },
};
const t = Object.fromEntries(spec.tracks.map((k) => [k.part, k]));
const hex = (c) => c.replace("#", "");
const header = "GENERATED from brand/motion/source/motion-spec.json and the archived logo masters by scripts/brand-motion/build.mjs. Do not edit by hand.";
const swiftLayout = (name, l) => `    static let ${name} = Layout(width: ${l.width}, height: ${l.height}, markOffset: CGPoint(x: ${l.markTranslate[0]}, y: ${l.markTranslate[1] - 5}), wordmark: "${l.wordmark}", sweepEndX: ${l.sweep.endX}, sweepWidth: ${l.sweep.width}, sweepTravel: ${l.sweep.travel}, sweepFeather: ${l.sweep.feather})`;
write(path.join(nativeDir, "ios"), "WatershedWatchRevealGeometry.swift", `// ${header}
import CoreGraphics

enum WatershedWatchRevealGeometry {
    struct Layout {
        let width: CGFloat
        let height: CGFloat
        /// Where the master mark's coordinate space sits in the layout (includes the master's translate(0 -5)).
        let markOffset: CGPoint
        /// Wordmark outlines (absolute M/L/Q/Z), already in layout coordinates. Empty for the mark alone.
        let wordmark: String
        let sweepEndX: CGFloat
        let sweepWidth: CGFloat
        let sweepTravel: CGFloat
        let sweepFeather: CGFloat
    }

${swiftLayout("mark", layouts.mark)}
${swiftLayout("horizontal", layouts.horizontal)}
${swiftLayout("stacked", layouts.stacked)}

    /// The original strokes, in the master mark's coordinates (pww-mark-master.svg).
    static let strokes: [(part: String, d: String, width: CGFloat)] = [
${Object.entries(paths).map(([part, p]) => `        ("${part}", "${p.d}", ${p.strokeWidth}),`).join("\n")}
    ]
    static let point = (cx: CGFloat(64), cy: CGFloat(74), r: CGFloat(9.5))

    struct Track { let delay: Double; let duration: Double }
${Object.entries(t).map(([part, k]) => `    static let ${part.replace(/-([a-z])/g, (_, c) => c.toUpperCase())} = Track(delay: ${k.delay / 1000}, duration: ${k.duration / 1000})`).join("\n")}
    static let strokeEasing: (Double, Double, Double, Double) = (${spec.easings.stroke.join(", ")})
    static let settleEasing: (Double, Double, Double, Double) = (${spec.easings.settle.join(", ")})
    static let strokeFadeInFraction = ${spec.strokeFadeInFraction}
    static let pointFromScale: CGFloat = ${t["monitoring-point"].fromScale}
    static let settledMark = ${spec.settledAt.mark / 1000}
    static let settledLockup = ${spec.settledAt.lockup / 1000}

    /// Light: Hemlock, Goldenrod, Limestone. Dark: icon stroke, Goldenrod 300, Night.
    static let light = (stream: 0x${hex(themes.light.stream)}, point: 0x${hex(themes.light.point)}, word: 0x${hex(themes.light.word)}, canvas: 0x${hex(themes.light.canvas)})
    static let dark = (stream: 0x${hex(themes.dark.stream)}, point: 0x${hex(themes.dark.point)}, word: 0x${hex(themes.dark.word)}, canvas: 0x${hex(themes.dark.canvas)})
}
`);
const ktLayout = (name, l) => `    val ${name} = Layout(${l.width}f, ${l.height}f, ${l.markTranslate[0]}f, ${l.markTranslate[1] - 5}f, "${l.wordmark}", ${l.sweep.endX}f, ${l.sweep.width}f, ${l.sweep.travel}f, ${l.sweep.feather}f)`;
write(path.join(nativeDir, "android"), "WatershedWatchRevealGeometry.kt", `// ${header}
package org.watershed.pawatershedwatch.brand

internal object WatershedWatchRevealGeometry {
    class Layout(
        val width: Float,
        val height: Float,
        /** Where the master mark's coordinate space sits in the layout (includes the master's translate(0 -5)). */
        val markOffsetX: Float,
        val markOffsetY: Float,
        /** Wordmark outlines (absolute M/L/Q/Z), already in layout coordinates. Empty for the mark alone. */
        val wordmark: String,
        val sweepEndX: Float,
        val sweepWidth: Float,
        val sweepTravel: Float,
        val sweepFeather: Float,
    )

${ktLayout("mark", layouts.mark)}
${ktLayout("horizontal", layouts.horizontal)}
${ktLayout("stacked", layouts.stacked)}

    class Stroke(val part: String, val d: String, val width: Float)
    /** The original strokes, in the master mark's coordinates (pww-mark-master.svg). */
    val strokes = listOf(
${Object.entries(paths).map(([part, p]) => `        Stroke("${part}", "${p.d}", ${p.strokeWidth}f),`).join("\n")}
    )
    const val POINT_CX = 64f
    const val POINT_CY = 74f
    const val POINT_R = 9.5f

    class Track(val delayMs: Int, val durationMs: Int)
${Object.entries(t).map(([part, k]) => `    val ${part.replace(/-([a-z])/g, (_, c) => c.toUpperCase())} = Track(${k.delay}, ${k.duration})`).join("\n")}
    val STROKE_EASING = floatArrayOf(${spec.easings.stroke.map((v) => v + "f").join(", ")})
    val SETTLE_EASING = floatArrayOf(${spec.easings.settle.map((v) => v + "f").join(", ")})
    const val STROKE_FADE_IN_FRACTION = ${spec.strokeFadeInFraction}f
    const val POINT_FROM_SCALE = ${t["monitoring-point"].fromScale}f
    const val SETTLED_MARK_MS = ${spec.settledAt.mark}
    const val SETTLED_LOCKUP_MS = ${spec.settledAt.lockup}

    /** Light: Hemlock, Goldenrod, Limestone. Dark: icon stroke, Goldenrod 300, Night. */
    const val LIGHT_STREAM = 0xFF${hex(themes.light.stream)}
    const val LIGHT_POINT = 0xFF${hex(themes.light.point)}
    const val LIGHT_WORD = 0xFF${hex(themes.light.word)}
    const val LIGHT_CANVAS = 0xFF${hex(themes.light.canvas)}
    const val DARK_STREAM = 0xFF${hex(themes.dark.stream)}
    const val DARK_POINT = 0xFF${hex(themes.dark.point)}
    const val DARK_WORD = 0xFF${hex(themes.dark.word)}
    const val DARK_CANVAS = 0xFF${hex(themes.dark.canvas)}
}
`);

if (written.some((f) => /PA Watershed/.test(fs.readFileSync(path.join(root, f), "utf8")))) throw new Error("Legacy name found in an output");
console.log(`Wrote ${written.length} files. Horizontal ${round(hW)}x${round(hH)}, stacked ${round(sW)}x${round(sH)}.`);
