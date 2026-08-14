#!/usr/bin/env node
// Seeds a broader `siteCatalog` fixture set into the DEV Firestore project only, so
// mobile/site-selection UI (list rendering, search, filtering, similar-name
// disambiguation, multi-region coverage, selection persistence, and sync) can be
// exercised with more than a single synthetic test site.
//
// Every site here is a development fixture, never an authoritative production site:
// this script refuses to run against anything but the dev project (see the guard
// below, identical in spirit to scripts/provision_test_users.mjs), and every
// site_code is prefixed "TEST-" so it can never be mistaken for a real catalog entry
// even if a project's data were ever inspected directly.
//
// Safe by default: requires --apply to write anything; otherwise prints a dry-run plan.
//
// Usage:
//   node scripts/seed_test_sites.mjs             # dry run
//   node scripts/seed_test_sites.mjs --apply      # actually write siteCatalog docs

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, GeoPoint } from 'firebase-admin/firestore';

const DEV_PROJECT_ID = 'central-pa-watershed-dev';

// Deliberately includes several similarly-named sites on the same named waterway
// (e.g. three "Spring Creek" sites, two "Loyalhanna Creek" sites) to exercise
// disambiguation in search/filter UI, and spans multiple counties/watersheds.
const TEST_SITES = [
  { code: 'TEST-001', name: 'Spring Creek at Houserville Road Bridge', county: 'Centre', watershed: 'Spring Creek', lat: 40.7934, lon: -77.8600 },
  { code: 'TEST-002', name: 'Spring Creek below Benner Spring Fish Hatchery', county: 'Centre', watershed: 'Spring Creek', lat: 40.8467, lon: -77.7961 },
  { code: 'TEST-003', name: 'Spring Creek at Shiloh Road', county: 'Centre', watershed: 'Spring Creek', lat: 40.8123, lon: -77.8288 },
  { code: 'TEST-004', name: 'Little Juniata River at Spruce Creek', county: 'Huntingdon', watershed: 'Little Juniata River', lat: 40.6126, lon: -78.1409 },
  { code: 'TEST-005', name: 'Little Juniata River at Barree', county: 'Huntingdon', watershed: 'Little Juniata River', lat: 40.5893, lon: -78.0524 },
  { code: 'TEST-006', name: 'Susquehanna River at City Island', county: 'Dauphin', watershed: 'Susquehanna River', lat: 40.2665, lon: -76.8969 },
  { code: 'TEST-007', name: 'Susquehanna River at Fort Hunter', county: 'Dauphin', watershed: 'Susquehanna River', lat: 40.3232, lon: -76.8749 },
  { code: 'TEST-008', name: 'Loyalhanna Creek at Ligonier', county: 'Westmoreland', watershed: 'Loyalhanna Creek', lat: 40.2456, lon: -79.2372 },
  { code: 'TEST-009', name: 'Loyalhanna Creek at Kingston Dam', county: 'Westmoreland', watershed: 'Loyalhanna Creek', lat: 40.3106, lon: -79.3156 },
  { code: 'TEST-010', name: 'Lehigh River below Jim Thorpe', county: 'Carbon', watershed: 'Lehigh River', lat: 40.8720, lon: -75.7327 },
  { code: 'TEST-011', name: 'Lehigh River at Bowmanstown', county: 'Carbon', watershed: 'Lehigh River', lat: 40.7873, lon: -75.6249 },
  { code: 'TEST-012', name: 'Penns Creek at Coburn', county: 'Centre', watershed: 'Penns Creek', lat: 40.8967, lon: -77.5169 },
  { code: 'TEST-013', name: 'Bald Eagle Creek at Milesburg', county: 'Centre', watershed: 'Bald Eagle Creek', lat: 40.9412, lon: -77.7897 },
  { code: 'TEST-014', name: 'Slate Run at Slate Run Village', county: 'Lycoming', watershed: 'Pine Creek', lat: 41.5186, lon: -77.5461 },
  { code: 'TEST-015', name: 'Fishing Creek at Lamar', county: 'Clinton', watershed: 'Fishing Creek', lat: 41.0234, lon: -77.5108 },
  { code: 'TEST-016', name: 'Cedar Run at Cedar Run Village', county: 'Lycoming', watershed: 'Pine Creek', lat: 41.5389, lon: -77.4633 },
  { code: 'TEST-017', name: 'Buffalo Creek at Mifflinburg', county: 'Union', watershed: 'Buffalo Creek', lat: 40.9192, lon: -77.0397 },
  { code: 'TEST-018', name: 'Six Mile Run at Whipple Dam', county: 'Huntingdon', watershed: 'Six Mile Run', lat: 40.6467, lon: -77.9075 },
];

const apply = process.argv.includes('--apply');

console.log(`Target project: ${DEV_PROJECT_ID}${apply ? ' (APPLY)' : ' (dry run)'}`);

const app = initializeApp({ projectId: DEV_PROJECT_ID });
const usingEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

if (!usingEmulator && app.options.projectId !== DEV_PROJECT_ID) {
  console.error(`Refusing to run: resolved project '${app.options.projectId}' is not the dev project '${DEV_PROJECT_ID}'.`);
  process.exit(1);
}

const db = getFirestore(app);

async function upsertSite(site) {
  const siteId = `site-${site.code.toLowerCase()}`;
  console.log(`[${apply ? 'apply' : 'dry-run'}] upsert ${siteId} "${site.name}" (${site.county} County · ${site.watershed})`);
  if (!apply) return;

  await db.collection('siteCatalog').doc(siteId).set({
    site_id: siteId,
    site_code: site.code,
    site_name_display: site.name,
    county: site.county,
    watershed_name: site.watershed,
    latitude: site.lat,
    longitude: site.lon,
    location: new GeoPoint(site.lat, site.lon),
    site_tolerance_m: 30,
    active: true,
    updated_at: FieldValue.serverTimestamp(),
  }, { merge: true });
}

for (const site of TEST_SITES) {
  await upsertSite(site);
}

if (!apply) {
  console.log(`\nDry run only — no changes made. ${TEST_SITES.length} fixture sites would be written. Re-run with --apply to seed them.`);
}
