# Website screenshots, 2026-10-17

Captured with headless Chromium from a local production build of `public-dashboard/` (`next build`,
served on port 3009) on branch `design/watershed-watch-web-prototype`. The dashboard ran in production
mode against the real public ArcGIS views, which hold no approved observations, so every map shows
reference geography only. No demo data was used.

| File | What it shows |
| --- | --- |
| `home-desktop.webp`, `home-phone.webp` | Home page at 1440 and 390 px, full length |
| `how-it-works-desktop.webp`, `how-it-works-phone.webp` | How it works at 1440 and 390 px |
| `about-desktop.webp` | About at 1440 px |
| `menu-phone.webp` | Open mobile menu at 390 px, keyboard focus on Home |
| `dashboard-reveal-desktop.webp` | First visit: the mark drawing inside the map region while the rest of the dashboard is already usable |
| `dashboard-desktop.webp`, `dashboard-phone.webp` | Dashboard after the veil lifts |
| `dashboard-map-unavailable.webp` | Basemap requests blocked: error state with a retry |
| `dashboard-timeout.webp` | Basemap requests never answered: page released at 15 s with a notice |
| `dashboard-records-error.webp` | Public views blocked: records error banner, map still usable |

Interface images inside the pages are captioned on the site as test data; their sources are listed in
`public-dashboard/README.md`.
