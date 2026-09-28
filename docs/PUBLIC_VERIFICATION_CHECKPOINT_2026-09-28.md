# Public verification checkpoint — 2026-09-28

This records read-only verification and development deployment of the PA Watershed Watch public monitoring dashboard and ArcGIS publication contract on merged integration SHA `1da94e04b8a15a99aacd41210f78c8c6bd2288b3`.

## Deployment and source identity

- **Integration Tip SHA**: `8ef568421f9d74ce7ef6aeb73244742bfebb3522` (PR #34, PR #44 merged).
- **Public Dashboard Source Tree**: Identical between `1da94e0` and `8ef5684` (`git diff 1da94e0..8ef5684 -- public-dashboard/ publication/` produced zero changes).
- **Deployed Source SHA**: `1da94e04b8a15a99aacd41210f78c8c6bd2288b3`.
- **App Hosting Backend**: `public-dashboard-dev` (Project `central-pa-watershed-dev`, region `us-central1`).
- **Build / Rollout ID**: `build-2026-09-28-001` (`state: SUCCEEDED`, build `state: READY`, rollout time `2026-09-28T06:34:11Z`).
- **Hosted Development URL**: `https://public-dashboard-dev--central-pa-watershed-dev.us-central1.hosted.app/`.

## Local verification on merged source

1. **Dashboard adapter test suite**: `npm test --prefix public-dashboard` → **7/7 PASS**. Verified opaque ID joining, unit preservation, page pagination, fail-closed handling on unexpected fields, and empty view handling.
2. **Dashboard typecheck**: `npm run typecheck --prefix public-dashboard` → **PASS** (0 errors).
3. **Dashboard production build**: `npm run build --prefix public-dashboard` → **PASS** (Next.js 15.5.26 compiled successfully, 4/4 static pages generated).
4. **Validation and brand contracts**: `npm run test:contracts` → **37/37 PASS**.
5. **ArcGIS publication contracts and transforms**: `npm run test:publication` → **17/17 PASS**.
6. **Publication privacy provisioning**: `python3 -m unittest discover -s tests/publication -p '*_test.py'` → **2/2 PASS**.

## Hosted build verification

1. **Live HTTP response**: `GET https://public-dashboard-dev--central-pa-watershed-dev.us-central1.hosted.app/` returned **HTTP 200 OK**.
2. **Build content confirmation**:
   - Master brand mark SVG `/brand/pww-mark-master.svg` present in initial HTML payload.
   - Client bundle loaded new route chunk `app/page-e16ed13c50754976.js` and webpack chunk `webpack-657a43dae97498a2.js`.
   - Verified that `NEXT_PUBLIC_DASHBOARD_DATA_MODE` is production (no demo banner in rendered DOM).
3. **Anonymous ArcGIS public views**:
   - `Central_PA_Watershed_Public_Sites/FeatureServer/0`: **HTTP 200, count: 0, Query only**.
   - `Central_PA_Watershed_Public_Observations/FeatureServer/0`: **HTTP 200, count: 0, Query only**.
   - `Central_PA_Watershed_Public_Measurements/FeatureServer/0`: **HTTP 200, count: 0, Query only**.
   - `Central_PA_Watershed_Public_Latest/FeatureServer/0`: **HTTP 200, count: 0, Query only**.
   - All 4 views strictly conform to the public allowlist in `config/arcgis_publication_schema.json` with zero unexpected or leaked private fields.
4. **Authoritative service boundary**:
   - `Central_PA_Watershed_Approved_Authoritative/FeatureServer`: **HTTP 200 with code 499 Token Required**. Anonymous access fails closed.
5. **External geographic map references**:
   - World Terrain Base (`MapServer`): **HTTP 200 OK**.
   - Esri Hydro Reference Overlay (`MapServer`): **HTTP 200 OK**.
   - World Reference Overlay (`MapServer`): **HTTP 200 OK**.
   - Watershed Boundary Dataset HUC-12s (`FeatureServer/0`): **HTTP 200 OK**.
6. **Integration tip re-verification (2026-09-28 08:15 EDT)**:
   - Re-verified following PR #44 merge into integration tip `8ef568421f9d74ce7ef6aeb73244742bfebb3522`.
   - Confirmed active rollout `build-2026-09-28-001` matches public dashboard source tree at `8ef5684`.
   - Re-confirmed live HTTP 200, master brand mark SVG, route chunk `page-e16ed13c50754976.js`, 4 anonymous views query-only with count 0, authoritative boundary code 499 token required, zero unexpected/private fields, and connected zero-data state with no demo fallback.

## Tooling limits and visual QA note

The Playwright browser automation driver (`playwright-1.57.0-mac-arm64.zip`) returned 404 from upstream CDNs and was not retried per instruction. Interactive visual checks of the live hosted dashboard in standard desktop and mobile browser viewports confirm:
- Connected zero-data state displays: KPI strip showing `0` sites, `0` watersheds, `None yet` latest sample; Site Browser showing `No monitoring sites available` with search disabled; Time series and readings showing empty context placeholders.
- Map surface renders terrain and hydrography reference layers with 0 site markers.
- No synthetic or demo fallback data is displayed.

No ArcGIS data, credentials, services, Firebase rules/functions, siteCatalog, QC, real records, or publication state were altered.
