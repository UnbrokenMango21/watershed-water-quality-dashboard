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
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  const response = await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 90000 });
  if (!response || !response.ok()) failures.push(`${viewport.name}: page returned ${response?.status() ?? "no response"}`);

  await page.locator(".dashboard-shell").waitFor({ state: "visible", timeout: 30000 });
  await page.locator(".site-row").first().waitFor({ state: "visible", timeout: 30000 });

  const initialCount = await page.locator(".site-row").count();
  if (initialCount !== 8) failures.push(`${viewport.name}: expected 8 synthetic sites, found ${initialCount}`);

  const search = page.locator('.site-search-input[aria-label="Search monitoring sites"]');
  await search.fill("Kish");
  if ((await page.locator(".site-row").count()) !== 1) failures.push(`${viewport.name}: site search did not filter to one row`);
  await search.fill("");

  await page.locator(".site-row").filter({ hasText: "Demo Bald Eagle Creek Site" }).click();
  await page.getByRole("heading", { name: "Demo Bald Eagle Creek Site" }).last().waitFor({ state: "visible" });
  if ((await page.getByText("Not recorded").count()) < 1) failures.push(`${viewport.name}: partial sample does not expose missing measurement state`);

  await page.getByRole("tab", { name: "pH", exact: true }).click();
  if (!(await page.getByRole("tab", { name: "pH", exact: true }).getAttribute("aria-selected"))?.includes("true")) {
    failures.push(`${viewport.name}: parameter tab did not activate`);
  }

  await page.screenshot({ path: `${outDir}/${viewport.name}.png`, fullPage: true });

  const metrics = await page.evaluate(() => {
    const root = document.documentElement;
    const map = document.querySelector(".map-frame");
    return {
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      mapHeight: map?.getBoundingClientRect().height ?? 0,
      shellVisible: Boolean(document.querySelector(".dashboard-shell")),
      browserVisible: Boolean(document.querySelector(".site-browser")),
      detailVisible: Boolean(document.querySelector(".site-detail")),
      chartVisible: Boolean(document.querySelector(".trend-panel")),
      hasMain: Boolean(document.querySelector("main")),
      hasH1: Boolean(document.querySelector("h1")),
      searchLabel: document.querySelector(".site-search-input")?.getAttribute("aria-label") ?? null,
      mapAria: document.querySelector("arcgis-map")?.getAttribute("aria-label") ?? null,
      demoBanner: document.querySelector(".demo-banner")?.textContent ?? null,
    };
  });

  if (metrics.scrollWidth > metrics.clientWidth + 1) failures.push(`${viewport.name}: horizontal overflow ${metrics.scrollWidth}px > ${metrics.clientWidth}px`);
  if (metrics.mapHeight < 300) failures.push(`${viewport.name}: map is too short (${metrics.mapHeight}px)`);
  if (!metrics.shellVisible || !metrics.browserVisible || !metrics.detailVisible || !metrics.chartVisible) failures.push(`${viewport.name}: one or more primary dashboard surfaces are missing`);
  if (!metrics.hasMain || !metrics.hasH1) failures.push(`${viewport.name}: semantic main/title missing`);
  if (!metrics.searchLabel) failures.push(`${viewport.name}: site search lacks an accessible label`);
  if (!metrics.mapAria) failures.push(`${viewport.name}: map lacks an accessible label`);
  if (!metrics.demoBanner?.includes("Synthetic")) failures.push(`${viewport.name}: synthetic data disclosure banner missing`);

  const relevantConsoleErrors = consoleErrors.filter(
    (message) => !message.includes("Failed to load resource") && !message.includes("favicon") && !message.includes("AbortError"),
  );
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

console.log(`Visual QA passed for ${viewports.length} viewports with synthetic demo interactions.`);
