import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.DASHBOARD_QA_URL || "http://127.0.0.1:3000";
const views = {
  Central_PA_Watershed_Public_Sites: ["site_id", "site_code", "site_name", "latitude", "longitude"],
  Central_PA_Watershed_Public_Observations: ["observation_id", "site_id", "collected_at", "approved_at"],
  Central_PA_Watershed_Public_Measurements: ["observation_id", "site_id", "collected_at", "parameter_code", "value", "unit_code"],
  Central_PA_Watershed_Public_Latest: ["observation_id", "site_id", "collected_at", "temp_c"],
};

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const queried = new Set();
  await page.route("https://services9.arcgis.com/**", async (route) => {
    const url = new URL(route.request().url());
    const entry = Object.entries(views).find(([name]) => url.pathname.includes(`/${name}/FeatureServer`));
    if (!entry) return route.continue();
    const [name, requiredFields] = entry;
    let body;
    if (url.pathname.endsWith("/query")) {
      queried.add(name);
      body = { objectIds: [], exceededTransferLimit: false };
    } else if (url.pathname.endsWith("/FeatureServer")) {
      body = { isView: true, capabilities: "Query" };
    } else {
      body = {
        objectIdField: "OBJECTID",
        capabilities: "Query",
        fields: [
          { name: "OBJECTID", type: "esriFieldTypeOID" },
          ...requiredFields.map((field) => ({ name: field, type: "esriFieldTypeString" })),
        ],
      };
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });

  const response = await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  assert.equal(response?.status(), 200);
  await page.locator('.dashboard-shell[data-source-connected="true"]').waitFor({ timeout: 15000 });
  assert.equal(await page.locator(".site-row").count(), 0);
  assert.equal(await page.getByRole("alert").count(), 0);
  assert.deepEqual([...queried].sort(), Object.keys(views).filter((name) => name.endsWith("Sites") || name.endsWith("Latest")).sort());
  console.log("Production dashboard connected to empty read-only public views without a browser fetch error.");
} finally {
  await browser.close();
}
