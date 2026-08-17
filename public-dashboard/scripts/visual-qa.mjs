import { chromium } from "playwright";
import fs from "node:fs/promises";

const baseUrl = process.env.DASHBOARD_QA_URL || "http://127.0.0.1:3000";
const outDir = process.env.DASHBOARD_QA_OUT || "artifacts/visual-qa";
const mode = process.env.DASHBOARD_QA_MODE || "demo";
const viewports = [
  { name: "desktop", width: 1600, height: 1000 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "iphone", width: 390, height: 844 },
];

await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const failures = [];
const results = [];

async function waitForMapStable(page, viewportName) {
  await page.locator("arcgis-map").waitFor({ state: "attached", timeout: 30000 });
  try {
    await page.waitForFunction(() => {
      const map = document.querySelector("arcgis-map");
      return Boolean(map && map.ready === true && map.stationary === true && map.updating === false && map.dataset.viewStable === "true");
    }, undefined, { timeout: 90000 });
    await page.waitForTimeout(450);
  } catch {
    failures.push(`${viewportName}: ArcGIS map did not reach a ready/stationary/non-updating state before capture`);
  }
}

async function collectLayoutMetrics(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const shell = document.querySelector(".dashboard-shell");
    const workspace = document.querySelector(".workspace");
    const map = document.querySelector(".map-frame");
    const shellRect = shell?.getBoundingClientRect();
    const visibleControls = Array.from(document.querySelectorAll(".mobile-view-button,.data-subview-tabs button,.range-button,.parameter-tab,.parameter-select-wrap select,.map-tool-button,.site-search-input"))
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const visibleText = (element.textContent || "").trim();
        return {
          tag: element.tagName,
          label: (element.getAttribute("aria-label") || visibleText || element.tagName).trim(),
          visibleText,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
        };
      });
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      rootScrollWidth: root.scrollWidth,
      rootClientWidth: root.clientWidth,
      rootScrollHeight: root.scrollHeight,
      rootClientHeight: root.clientHeight,
      bodyScrollWidth: body.scrollWidth,
      bodyScrollHeight: body.scrollHeight,
      shellScrollWidth: shell?.scrollWidth ?? 0,
      shellClientWidth: shell?.clientWidth ?? 0,
      shellScrollHeight: shell?.scrollHeight ?? 0,
      shellClientHeight: shell?.clientHeight ?? 0,
      workspaceScrollHeight: workspace?.scrollHeight ?? 0,
      workspaceClientHeight: workspace?.clientHeight ?? 0,
      shellRect: shellRect ? { left: shellRect.left, top: shellRect.top, right: shellRect.right, bottom: shellRect.bottom } : null,
      mapHeight: map?.getBoundingClientRect().height ?? 0,
      fontFamily: getComputedStyle(document.body).fontFamily,
      visibleControls,
    };
  });
}

function assertNoDocumentOverflow(viewportName, metrics, stage) {
  if (metrics.rootScrollWidth > metrics.rootClientWidth + 1) failures.push(`${viewportName}/${stage}: document horizontal overflow ${metrics.rootScrollWidth}px > ${metrics.rootClientWidth}px`);
  if (metrics.rootScrollHeight > metrics.rootClientHeight + 1) failures.push(`${viewportName}/${stage}: document vertical overflow ${metrics.rootScrollHeight}px > ${metrics.rootClientHeight}px`);
  if (metrics.bodyScrollHeight > metrics.viewportHeight + 1) failures.push(`${viewportName}/${stage}: body exceeds viewport height`);
  if (metrics.shellScrollHeight > metrics.shellClientHeight + 1) failures.push(`${viewportName}/${stage}: application shell has vertical overflow`);
  if (metrics.shellRect && (metrics.shellRect.top < -1 || metrics.shellRect.left < -1 || metrics.shellRect.right > metrics.viewportWidth + 1 || metrics.shellRect.bottom > metrics.viewportHeight + 1)) failures.push(`${viewportName}/${stage}: application shell extends outside viewport`);
  for (const control of metrics.visibleControls) {
    if (control.left < -1 || control.right > metrics.viewportWidth + 1 || control.top < -1 || control.bottom > metrics.viewportHeight + 1) failures.push(`${viewportName}/${stage}: visible control outside viewport (${control.label})`);
    if (control.visibleText && control.clientWidth > 0 && control.scrollWidth > control.clientWidth + 2 && control.tag !== "INPUT" && control.tag !== "SELECT") failures.push(`${viewportName}/${stage}: clipped visible control text (${control.visibleText})`);
  }
}

for (const viewport of viewports) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
  const consoleErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });

  const response = await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 90000 });
  if (!response || !response.ok()) failures.push(`${viewport.name}: page returned ${response?.status() ?? "no response"}`);
  await page.locator(".dashboard-shell").waitFor({ state: "visible", timeout: 30000 });
  await waitForMapStable(page, viewport.name);

  const compact = viewport.width <= 960;

  if ((await page.getByText("Synthetic demonstration geography", { exact: false }).count()) > 0) failures.push(`${viewport.name}: obsolete map instruction overlay remains`);
  if ((await page.locator(".map-status").count()) > 0) failures.push(`${viewport.name}: obsolete map status overlay remains`);
  if ((await page.locator(".app-actions").count()) > 0) failures.push(`${viewport.name}: obsolete global action bar remains`);
  if ((await page.locator(".map-tool-panel").count()) > 0) failures.push(`${viewport.name}: a secondary ArcGIS panel opened automatically`);
  if ((await page.getByText("There are currently no items to display.", { exact: false }).count()) > 0) failures.push(`${viewport.name}: empty ArcGIS panel is visible automatically`);

  const initialMetrics = await collectLayoutMetrics(page);
  assertNoDocumentOverflow(viewport.name, initialMetrics, "initial");
  if (!initialMetrics.fontFamily.toLowerCase().includes("avenir")) failures.push(`${viewport.name}: app typography is not using the Calcite-aligned Avenir family`);

  if (mode === "demo") {
    if ((await page.getByRole("heading", { name: "No site selected" }).count()) === 0 && !compact) failures.push(`${viewport.name}: no-selection site state is not visible initially`);
    if ((await page.locator(".sample-summary").count()) !== 0) failures.push(`${viewport.name}: sample metadata is rendered before a site is selected`);
    if ((await page.locator(".metrics").count()) !== 0) failures.push(`${viewport.name}: measurement rows are rendered before a site is selected`);
    if ((await page.locator(".range-controls").count()) !== 0) failures.push(`${viewport.name}: chart range controls are active before a site is selected`);
    if ((await page.locator(".parameter-tabs").count()) !== 0) failures.push(`${viewport.name}: chart parameter controls are active before a site is selected`);

    if (compact) await page.getByRole("button", { name: "Sites", exact: true }).click();
    await page.locator(".site-row").first().waitFor({ state: "visible", timeout: 30000 });
    if (compact) await page.screenshot({ path: `${outDir}/${viewport.name}-sites.png`, fullPage: false });
    if ((await page.locator(".site-row").count()) !== 8) failures.push(`${viewport.name}: expected 8 demo sites`);

    const search = page.locator('.site-search-input[aria-label="Search monitoring sites"]');
    if (await search.isDisabled()) failures.push(`${viewport.name}: demo site search is unexpectedly disabled`);
    await search.fill("Kish");
    if ((await page.locator(".site-row").count()) !== 1) failures.push(`${viewport.name}: site search did not filter to one result`);
    await search.fill("");
    await page.locator(".site-row").filter({ hasText: "Demo Bald Eagle Creek Site" }).click();

    if (compact) {
      await page.waitForFunction(() => document.querySelector('.mobile-view-button[aria-pressed="true"]')?.textContent?.trim() === "Data", undefined, { timeout: 30000 });
      await page.getByRole("button", { name: "Readings", exact: true }).click();
    }

    await page.getByRole("heading", { name: "Demo Bald Eagle Creek Site" }).waitFor({ state: "visible" });
    if (!(await page.locator(".missing-summary").innerText()).includes("1 of 5")) failures.push(`${viewport.name}: partial-sample summary is missing`);
    if (compact) await page.screenshot({ path: `${outDir}/${viewport.name}-readings.png`, fullPage: false });

    if (compact) await page.getByRole("button", { name: "Time series", exact: true }).click();
    if (compact) {
      const parameterSelect = page.locator('.parameter-select-wrap select[aria-label="Water quality parameter"]');
      await parameterSelect.waitFor({ state: "visible" });
      await parameterSelect.selectOption("ph");
      if ((await page.locator(".parameter-tabs:visible").count()) !== 0) failures.push(`${viewport.name}: compact layout still shows desktop parameter tabs`);
    } else {
      await page.getByRole("tab", { name: /pH/ }).click();
    }
    try {
      await page.locator(".export-button").waitFor({ state: "visible", timeout: 30000 });
    } catch {
      failures.push(`${viewport.name}: contextual CSV export is unavailable for sampled data`);
    }

    const dataMetrics = await collectLayoutMetrics(page);
    assertNoDocumentOverflow(viewport.name, dataMetrics, "data");
    if (compact) await page.screenshot({ path: `${outDir}/${viewport.name}-data.png`, fullPage: false });

    if (compact) await page.getByRole("button", { name: "Map", exact: true }).click();
    await waitForMapStable(page, viewport.name);
    const layersButton = page.getByRole("button", { name: "Layers", exact: true });
    await layersButton.waitFor({ state: "visible" });
    await layersButton.click();
    await page.locator('.map-tool-panel[data-map-panel="layers"]').waitFor({ state: "visible" });
    if ((await page.getByText("There are currently no items to display.", { exact: false }).count()) > 0) failures.push(`${viewport.name}: demo Layers tool opened an empty-state overlay`);
    await page.getByRole("button", { name: "Close Layers" }).click();
  } else {
    const sourceState = page.locator(".site-browser").getByText("Monitoring data unavailable", { exact: true });
    await sourceState.waitFor({ state: compact ? "hidden" : "visible", timeout: 30000 }).catch(() => undefined);
    if (compact) {
      await page.getByRole("button", { name: "Sites", exact: true }).click();
      await sourceState.waitFor({ state: "visible" });
      await page.screenshot({ path: `${outDir}/${viewport.name}-sites.png`, fullPage: false });
    }
    if ((await page.locator(".site-row").count()) !== 0) failures.push(`${viewport.name}: disconnected mode unexpectedly rendered sites`);
    const search = page.locator('.site-search-input[aria-label="Search monitoring sites"]');
    if (!(await search.isDisabled())) failures.push(`${viewport.name}: disconnected site search should be disabled`);
    if ((await page.getByRole("button", { name: "Layers", exact: true }).count()) !== 0) failures.push(`${viewport.name}: Layers action is exposed without operational layers`);
    if ((await page.getByRole("button", { name: "Legend", exact: true }).count()) !== 0) failures.push(`${viewport.name}: Legend action is exposed without operational layers`);
    if ((await page.locator(".sample-summary").count()) !== 0 || (await page.locator(".metrics").count()) !== 0) failures.push(`${viewport.name}: disconnected mode renders observation-level UI`);

    if (compact) {
      await page.getByRole("button", { name: "Data", exact: true }).click();
      await page.getByRole("button", { name: "Readings", exact: true }).click();
      await page.getByRole("heading", { name: "No site selected" }).waitFor({ state: "visible" });
      await page.getByRole("button", { name: "Time series", exact: true }).click();
    }
    if ((await page.locator(".range-controls").count()) !== 0 || (await page.locator(".parameter-tabs").count()) !== 0) failures.push(`${viewport.name}: disconnected chart exposes meaningless active controls`);
    const dataMetrics = await collectLayoutMetrics(page);
    assertNoDocumentOverflow(viewport.name, dataMetrics, "disconnected-data");
    if (compact) await page.screenshot({ path: `${outDir}/${viewport.name}-data.png`, fullPage: false });
    if (compact) await page.getByRole("button", { name: "Map", exact: true }).click();
    await waitForMapStable(page, viewport.name);
  }

  const finalMetrics = await collectLayoutMetrics(page);
  assertNoDocumentOverflow(viewport.name, finalMetrics, "final");
  if (finalMetrics.mapHeight < (compact ? 260 : 180)) failures.push(`${viewport.name}: map is too short (${finalMetrics.mapHeight}px)`);

  await page.screenshot({ path: `${outDir}/${viewport.name}.png`, fullPage: false });
  const relevantConsoleErrors = consoleErrors.filter((message) => !message.includes("Failed to load resource") && !message.includes("favicon") && !message.includes("AbortError"));
  if (relevantConsoleErrors.length) failures.push(`${viewport.name}: console errors: ${relevantConsoleErrors.join(" | ")}`);
  results.push({ mode, viewport, initialMetrics, finalMetrics, consoleErrors });
  await page.close();
}

await browser.close();
await fs.writeFile(`${outDir}/results.json`, JSON.stringify({ mode, baseUrl, results, failures }, null, 2));
if (failures.length) {
  console.error("Visual QA failures:\n" + failures.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}
console.log(`Visual QA passed for ${viewports.length} viewports in ${mode} mode with viewport-height and map-stability assertions.`);
