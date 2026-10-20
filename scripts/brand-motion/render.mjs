// Renders the identity reveal previews from brand/motion/source/composition.html.
//
//   node scripts/brand-motion/render.mjs [--only landscape-light,...] [--stills-only]
//
// Needs Playwright (the `playwright` or `playwright-core` package with a Chromium build) and ffmpeg
// with libx264 and libvpx-vp9. Set CHROMIUM_PATH to use a specific Chromium binary. Frames are
// captured by seeking paused animations, so every render of the same source is identical.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = path.join(root, "brand/motion/source/composition.html");
const exportsDir = path.join(root, "brand/motion/exports");
const stillsDir = path.join(root, "brand/motion/stills");
const spec = JSON.parse(fs.readFileSync(path.join(root, "brand/motion/source/motion-spec.json"), "utf8"));

async function loadChromium() {
  for (const name of [process.env.PLAYWRIGHT_MODULE, "playwright", "playwright-core"].filter(Boolean)) {
    try { return (await import(name)).chromium; } catch { /* try the next one */ }
  }
  throw new Error("Install playwright or playwright-core, or set PLAYWRIGHT_MODULE to its path.");
}

const VARIANTS = {
  "landscape-light": { format: "landscape", theme: "light", w: 1920, h: 1080 },
  "landscape-dark": { format: "landscape", theme: "dark", w: 1920, h: 1080 },
  "square-light": { format: "square", theme: "light", w: 1080, h: 1080 },
  "square-dark": { format: "square", theme: "dark", w: 1080, h: 1080 },
  "portrait-light": { format: "portrait", theme: "light", w: 1080, h: 1920 },
  "portrait-dark": { format: "portrait", theme: "dark", w: 1080, h: 1920 },
};
const lead = spec.video.leadInMs;
const STILLS = { initial: lead + 240, transition: lead + 1040, complete: lead + spec.settledAt.lockup + 200 };

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : Object.keys(VARIANTS);
const stillsOnly = args.includes("--stills-only");

const ffmpeg = (argv) => {
  const result = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...argv], { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`ffmpeg failed: ${argv.join(" ")}`);
};

fs.mkdirSync(exportsDir, { recursive: true });
fs.mkdirSync(stillsDir, { recursive: true });
const chromium = await loadChromium();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });

for (const name of only) {
  const v = VARIANTS[name];
  if (!v) throw new Error(`Unknown variant ${name}`);
  const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1 });
  await page.goto(`${pathToFileURL(source).href}?format=${v.format}&theme=${v.theme}&render=1`);
  const total = await page.evaluate(() => window.WW_TOTAL_MS);

  for (const [label, ms] of Object.entries(STILLS)) {
    await page.evaluate((t) => window.seek(t), ms);
    await page.screenshot({ path: path.join(stillsDir, `${name}-${label}.png`) });
  }
  if (stillsOnly) { await page.close(); continue; }

  const frames = fs.mkdtempSync(path.join(os.tmpdir(), `ww-${name}-`));
  const count = Math.round((total / 1000) * spec.video.fps);
  for (let i = 0; i < count; i += 1) {
    await page.evaluate((t) => window.seek(t), (i * 1000) / spec.video.fps);
    await page.screenshot({ path: path.join(frames, `${String(i).padStart(4, "0")}.png`) });
  }
  await page.close();
  const input = ["-framerate", String(spec.video.fps), "-i", path.join(frames, "%04d.png")];
  ffmpeg([...input, "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart", path.join(exportsDir, `watershed-watch-reveal-${name}.mp4`)]);
  ffmpeg([...input, "-c:v", "libvpx-vp9", "-crf", "28", "-b:v", "0", "-row-mt", "1", "-pix_fmt", "yuv420p", path.join(exportsDir, `watershed-watch-reveal-${name}.webm`)]);
  fs.rmSync(frames, { recursive: true, force: true });
  console.log(`${name}: ${count} frames`);
}
await browser.close();
