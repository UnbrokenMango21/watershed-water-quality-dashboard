// Browser checks for the dashboard's map loading veil (components/dashboard/MapLoadVeil.tsx).
//
//   DASHBOARD_QA_URL=http://127.0.0.1:3000 node scripts/loading-qa.mjs
//
// Needs Playwright (`playwright` or `playwright-core`, or PLAYWRIGHT_MODULE=<path>) and a running
// dashboard. CHROMIUM_PATH selects a Chromium binary. Network conditions are simulated with request
// routing; the live public views and basemaps are used otherwise. Screenshots go to
// DASHBOARD_QA_OUT (default: a temporary directory).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const baseUrl = process.env.DASHBOARD_QA_URL || "http://127.0.0.1:3000";
const outDir = process.env.DASHBOARD_QA_OUT || fs.mkdtempSync(path.join(os.tmpdir(), "ww-loading-qa-"));
fs.mkdirSync(outDir, { recursive: true });

async function loadChromium() {
  for (const name of [process.env.PLAYWRIGHT_MODULE, "playwright", "playwright-core"].filter(Boolean)) {
    try { return (await import(name)).chromium; } catch { /* next */ }
  }
  throw new Error("Install playwright or playwright-core, or set PLAYWRIGHT_MODULE.");
}

const BASEMAPS = /services\.arcgisonline\.com|tiles\.arcgis\.com/;
const PUBLIC_VIEWS = /services9\.arcgis\.com/;

/** Samples the veil until it is gone (or `limitMs` passes) and returns the distinct states seen. */
async function trace(page, limitMs) {
  const start = Date.now();
  const states = [];
  let last = "";
  while (Date.now() - start < limitMs) {
    const state = await page.evaluate(() => {
      const frame = document.querySelector(".map-frame");
      const veil = document.querySelector(".map-veil");
      const notice = document.querySelector(".map-notice");
      return {
        phase: frame?.getAttribute("data-map-phase") ?? null,
        stage: veil?.getAttribute("data-stage") ?? "gone",
        veil: veil?.getAttribute("data-veil-state") ?? null,
        play: veil?.getAttribute("data-play") ?? null,
        status: document.querySelector(".map-veil-status")?.textContent ?? null,
        animations: veil ? veil.getAnimations({ subtree: true }).length : 0,
        notice: notice?.getAttribute("data-map-notice") ?? null,
        recordsError: Boolean(document.querySelector(".source-error")),
      };
    }).catch(() => null);
    if (state) {
      const key = JSON.stringify({ ...state, animations: state.animations > 0 });
      if (key !== last) { states.push({ t: Date.now() - start, ...state }); last = key; }
      if (state.stage === "gone" && (state.phase === "ready" || state.notice)) break;
    }
    await page.waitForTimeout(80);
  }
  return states;
}

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

const chromium = await loadChromium();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
const newContext = (options = {}) => browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });

// The first paint is server-rendered: header, site list and the veil surface exist before any script runs.
{
  const html = await (await fetch(`${baseUrl}/dashboard`)).text();
  check("first paint includes dashboard shell and veil", html.includes("Public dashboard") && html.includes("map-veil") && html.includes("Monitoring sites"));
}

// Normal first visit: reveal plays once, then lifts at a ready map with settled records.
{
  const context = await newContext();
  const page = await context.newPage();
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded" });
  const states = await trace(page, 30000);
  await page.screenshot({ path: path.join(outDir, "normal-settled.png") });
  const played = states.some((s) => s.stage === "showing" && s.play === "true");
  const end = states.at(-1);
  check("first visit plays the reveal", played, states.map((s) => `${s.t}ms ${s.phase}/${s.stage}`).join(", "));
  check("veil lifts only after the map is ready", end?.stage === "gone" && end.phase === "ready" && !states.some((s) => s.stage === "exiting" && s.phase !== "ready"));

  // Repeat visit in the same session: the mark is shown settled, never replayed.
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded" });
  const again = await trace(page, 30000);
  check("repeat visit does not replay the reveal", !again.some((s) => s.play === "true"), again.map((s) => `${s.stage}:${s.play}`).join(", "));
  await context.close();
}

// Reduced motion: settled mark, no running animations.
{
  const context = await newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded" });
  const states = await trace(page, 30000);
  const shown = states.filter((s) => s.stage === "showing");
  check("reduced motion shows the mark without animation", shown.length > 0 && shown.every((s) => s.play === "false" && s.animations === 0), `${shown.length} showing samples`);
  await context.close();
}

// Slow basemap: the veil says so after 6 s, then lifts when the map draws.
{
  const context = await newContext();
  const page = await context.newPage();
  let delayed = 0;
  await page.route(BASEMAPS, async (route) => {
    if (delayed < 6) { delayed += 1; await new Promise((resolve) => setTimeout(resolve, 7500)); }
    await route.continue().catch(() => undefined);
  });
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded" });
  const states = await trace(page, 30000);
  const slowSample = states.find((s) => s.veil === "slow");
  if (slowSample) await page.screenshot({ path: path.join(outDir, "slow.png") });
  check("slow map shows the slow message", Boolean(slowSample), slowSample ? `at ${slowSample.t}ms` : "never slow");
  check("slow map still lifts when ready", states.at(-1)?.stage === "gone");
  await context.close();
}

// Basemaps unavailable: an error with a retry, or the bounded timeout. Never an endless veil.
{
  const context = await newContext();
  const page = await context.newPage();
  await page.route(BASEMAPS, (route) => route.abort("internetdisconnected"));
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded" });
  const states = await trace(page, 19000);
  await page.screenshot({ path: path.join(outDir, "map-unavailable.png") });
  const end = states.at(-1);
  const recovered = end && (end.veil === "error" || end.notice || end.phase === "ready");
  check("unavailable basemaps end in error, notice or a usable map within 19 s", Boolean(recovered), JSON.stringify(end));
  const retryVisible = await page.locator(".map-veil-retry, .map-notice button").count();
  check("a retry is offered when the map is not usable", end?.phase === "ready" || retryVisible > 0);
  await context.close();
}

// Public views unavailable: records error banner, map still usable.
{
  const context = await newContext();
  const page = await context.newPage();
  await page.route(PUBLIC_VIEWS, (route) => route.abort("internetdisconnected"));
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded" });
  const states = await trace(page, 30000);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, "records-error.png") });
  const banner = await page.locator(".source-error").count();
  check("records failure shows the error banner and lifts the veil", banner > 0 && states.at(-1)?.stage === "gone");
  await context.close();
}

// Map never responds: the veil gives way at the 15 s timeout with a notice.
{
  const context = await newContext();
  const page = await context.newPage();
  await page.route(BASEMAPS, () => new Promise(() => undefined));
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded" });
  const states = await trace(page, 20000);
  await page.screenshot({ path: path.join(outDir, "timeout.png") });
  const gone = states.find((s) => s.stage === "gone");
  check("hung map releases the page at the timeout", Boolean(gone && gone.t <= 16500 && gone.notice), gone ? `gone at ${gone.t}ms, notice ${gone.notice}` : "never released");
  await context.close();
}

// Client-side navigation: home, dashboard, back, forward. The reveal plays at most once.
{
  const context = await newContext();
  const page = await context.newPage();
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.locator(".ww-nav .ww-button").click();
  await page.waitForURL("**/dashboard");
  const first = await trace(page, 30000);
  await page.goBack();
  await page.waitForURL(`${baseUrl}/`);
  const homeVisible = await page.locator("#hero-title").isVisible();
  await page.goForward();
  await page.waitForURL("**/dashboard");
  const second = await trace(page, 30000);
  check("navigating home and back keeps the home page usable", homeVisible);
  check("returning to the dashboard does not replay the reveal", !second.some((s) => s.play === "true"), `first played: ${first.some((s) => s.play === "true")}`);
  await context.close();
}

await browser.close();
fs.writeFileSync(path.join(outDir, "loading-qa.json"), JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed. Screenshots: ${outDir}`);
process.exit(failed.length ? 1 : 0);
