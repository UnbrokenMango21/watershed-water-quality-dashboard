import { chromium } from "playwright";
import fs from "node:fs/promises";

const baseUrl = process.env.DASHBOARD_QA_URL || "http://127.0.0.1:3000";
const outDir = process.env.DASHBOARD_QA_OUT || "artifacts/visual-qa";
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

for (const viewport of viewports) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
  const consoleErrors = [];
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });

  const response = await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 90000 });
  if (!response || !response.ok()) failures.push(`${viewport.name}: page returned ${response?.status() ?? "no response"}`);
  await page.locator(".dashboard-shell").waitFor({ state: "visible", timeout: 30000 });

  const compact = viewport.width <= 960;
  if (compact) await page.getByRole("button", { name: "Sites", exact: true }).click();
  await page.locator(".site-row").first().waitFor({ state: "visible", timeout: 30000 });
  if ((await page.locator(".site-row").count()) !== 8) failures.push(`${viewport.name}: expected 8 demo sites`);

  if ((await page.getByText("Synthetic demonstration geography", { exact: false }).count()) > 0) failures.push(`${viewport.name}: obsolete map instruction overlay remains`);
  if ((await page.locator(".map-status").count()) > 0) failures.push(`${viewport.name}: obsolete map status overlay remains`);
  if ((await page.locator(".app-actions").count()) > 0) failures.push(`${viewport.name}: obsolete global action bar remains`);

  const search = page.locator('.site-search-input[aria-label="Search monitoring sites"]');
  await search.fill("Kish");
  if ((await page.locator(".site-row").count()) !== 1) failures.push(`${viewport.name}: site search did not filter to one result`);
  await search.fill("");
  await page.locator(".site-row").filter({ hasText: "Demo Bald Eagle Creek Site" }).click();

  if (compact) await page.getByRole("button", { name: "Data", exact: true }).click();
  await page.getByRole("heading", { name: "Demo Bald Eagle Creek Site" }).waitFor({ state: "visible" });
  if (!(await page.locator(".missing-summary").innerText()).includes("1 of 5")) failures.push(`${viewport.name}: partial-sample summary is missing`);
  await page.getByRole("tab", { name: /pH/ }).click();
  if ((await page.locator(".export-button").count()) !== 1) failures.push(`${viewport.name}: contextual CSV export is unavailable for sampled data`);

  if (compact) await page.getByRole("button", { name: "Map", exact: true }).click();
  const layersButton = page.getByRole("button", { name: "Layers", exact: true });
  await layersButton.waitFor({ state: "visible" });
  await layersButton.click();
  await page.locator(".map-tool-panel").waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Close Layers" }).click();

  const metrics = await page.evaluate(() => {
    const root = document.documentElement;
    const map = document.querySelector(".map-frame");
    return {
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      scrollHeight: root.scrollHeight,
      clientHeight: root.clientHeight,
      mapHeight: map?.getBoundingClientRect().height ?? 0,
      demoBanner: document.querySelector(".demo-banner")?.textContent ?? "",
      mapAria: document.querySelector("arcgis-map")?.getAttribute("aria-label") ?? null,
      fontFamily: getComputedStyle(document.body).fontFamily,
    };
  });

  if (metrics.scrollWidth > metrics.clientWidth + 1) failures.push(`${viewport.name}: document horizontal overflow`);
  if (metrics.scrollHeight > metrics.clientHeight + 1) failures.push(`${viewport.name}: document vertical overflow`);
  if (metrics.mapHeight < (compact ? 260 : 220)) failures.push(`${viewport.name}: map is too short (${metrics.mapHeight}px)`);
  if (!metrics.demoBanner.includes("Synthetic test sites and measurements")) failures.push(`${viewport.name}: concise demo disclosure missing`);
  if (!metrics.mapAria) failures.push(`${viewport.name}: map lacks accessible label`);
  if (!metrics.fontFamily.toLowerCase().includes("avenir")) failures.push(`${viewport.name}: app typography is not using the Calcite-aligned Avenir family`);

  await page.screenshot({ path: `${outDir}/${viewport.name}.png`, fullPage: true });
  const relevantConsoleErrors = consoleErrors.filter((message) => !message.includes("Failed to load resource") && !message.includes("favicon") && !message.includes("AbortError"));
  if (relevantConsoleErrors.length) failures.push(`${viewport.name}: console errors: ${relevantConsoleErrors.join(" | ")}`);
  results.push({ viewport, metrics, consoleErrors });
  await page.close();
}

await browser.close();
await fs.writeFile(`${outDir}/results.json`, JSON.stringify({ baseUrl, results, failures }, null, 2));
if (failures.length) {
  console.error("Visual QA failures:\n" + failures.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}
console.log(`Visual QA passed for ${viewports.length} viewports after the product-quality refinement pass.`);
