#!/usr/bin/env node
// READ ONLY. Inventory all Auth accounts and exact-UID Firestore references. No raw report on stdout.
import { writeFileSync, mkdirSync, realpathSync, existsSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { firebaseCliReadCredential } from './lib/firebase_cli_read_credential.mjs';
import { firestoreReadInventory } from './lib/firestore_read_inventory.mjs';
import { attributionReferences, classifyIdentity, identityFingerprint, identitySnapshot, PROJECT_ID, uidReferences } from './lib/identity_safety.mjs';

export async function collectAccountInventory({ auth, db, now = new Date(), target = 'LIVE' }) {
  const users = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  const accounts = users.map((user) => ({ ...identitySnapshot(user), identity_fingerprint: identityFingerprint(user), profile: null, references: [] }));
  const byUid = new Map(accounts.map((account) => [account.uid, account]));
  const knownUids = new Set(byUid.keys());
  let scannedDocuments = 0;
  const unmatchedAttribution = [];
  const profilesWithoutAuth = [];
  async function walk(collection) {
    // listDocuments includes missing ancestor documents, preserving discovery of orphaned subcollections.
    const documents = await collection.listDocuments();
    for (const ref of documents) {
      const snapshot = await ref.get();
      if (snapshot.exists) {
        scannedDocuments += 1;
        const data = snapshot.data();
        const profileOnly = /^users\/[^/]+$/.test(ref.path);
        const profile = profileOnly ? byUid.get(ref.id) : null;
        if (profileOnly && !profile) profilesWithoutAuth.push({ uid: ref.id, role: data.role ?? null, active: data.active ?? null });
        for (const match of attributionReferences(data)) {
          if (!knownUids.has(match.uid)) unmatchedAttribution.push({ uid: match.uid, path: ref.path, field: match.field, actor_type: data.actor_type ?? null });
        }
        if (profile) profile.profile = {
          display_name: data.display_name ?? null, role: data.role ?? null,
          active: data.active ?? null, is_test: data.is_test === true,
        };
        for (const match of uidReferences(data, knownUids)) {
          byUid.get(match.uid).references.push({ path: ref.path, field: match.field, profile_only: profileOnly });
        }
      }
      for (const child of await ref.listCollections()) await walk(child);
    }
  }
  for (const collection of await db.listCollections()) await walk(collection);
  for (const account of accounts) account.classification = classifyIdentity(account);
  accounts.sort((a, b) => a.uid.localeCompare(b.uid));
  return {
    schema_version: '1.0.0', project_id: PROJECT_ID, target, generated_at: now.toISOString(), complete: true,
    scanned_documents: scannedDocuments,
    profiles_without_auth: profilesWithoutAuth,
    unmatched_attribution_references: unmatchedAttribution,
    scope: 'All Auth users; all Firestore documents and subcollections; exact UID string references only. External Storage/ArcGIS and non-UID aliases require separate review; deletion is unavailable.',
    accounts,
  };
}

export function privateIdentityReportPath(outputPath) {
  const root = realpathSync(fileURLToPath(new URL('..', import.meta.url)));
  const directory = resolve(root, 'artifacts/identity');
  const destination = resolve(outputPath);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const realDirectory = realpathSync(directory);
  if (realDirectory !== directory) throw new Error('Private inventory directory must not be a symlink.');
  const requestedRelative = relative(directory, destination);
  if (requestedRelative.startsWith('..') || isAbsolute(requestedRelative)) throw new Error('Inventory output must stay under ignored artifacts/identity.');
  mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
  const realParent = realpathSync(dirname(destination));
  const pathFromPrivate = relative(realDirectory, realParent);
  if (pathFromPrivate.startsWith('..') || isAbsolute(pathFromPrivate)) throw new Error('Inventory output must stay under ignored artifacts/identity.');
  if (existsSync(destination)) {
    const actual = relative(realDirectory, realpathSync(destination));
    if (actual.startsWith('..') || isAbsolute(actual)) throw new Error('Report files cannot resolve outside the private inventory directory.');
  }
  return destination;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg, index) => !['--output', '--firebase-cli-credentials'].includes(arg) && args[index - 1] !== '--output')) throw new Error('Usage: node scripts/audit_auth_accounts.mjs [--output artifacts/identity/report.json] [--firebase-cli-credentials]');
  if (args.includes('--output') && !args[args.indexOf('--output') + 1]) throw new Error('--output needs a private file path.');
  const output = privateIdentityReportPath(args.includes('--output') ? args[args.indexOf('--output') + 1] : `artifacts/identity/accounts-${Date.now()}.json`);
  const authEmulated = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);
  const firestoreEmulated = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  if (authEmulated !== firestoreEmulated) throw new Error('Both emulator hosts must be set together; mixed live/emulator inventories are refused.');
  if (authEmulated && args.includes('--firebase-cli-credentials')) throw new Error('CLI credentials are not used with emulators.');
  const credential = args.includes('--firebase-cli-credentials') ? firebaseCliReadCredential(fileURLToPath(new URL('..', import.meta.url))) : null;
  const app = initializeApp({ projectId: PROJECT_ID, ...(credential ? { credential } : {}) }, 'account-inventory');
  const db = credential ? firestoreReadInventory({ credential, projectId: PROJECT_ID }) : getFirestore(app);
  const report = await collectAccountInventory({ auth: getAuth(app), db, target: authEmulated ? 'EMULATOR' : 'LIVE' });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  const counts = {};
  for (const account of report.accounts) counts[account.classification] = (counts[account.classification] ?? 0) + 1;
  console.log(JSON.stringify({ project_id: PROJECT_ID, target: report.target, account_count: report.accounts.length, scanned_documents: report.scanned_documents, unmatched_attribution_reference_count: report.unmatched_attribution_references.length, profiles_without_auth_count: report.profiles_without_auth.length, classifications: counts, report_path: output, mutation_count: 0 }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => { console.error('Identity inventory failed; no cleanup is authorized. Check private credentials, read permissions, output path and filesystem access. No credentials or identity contents were printed.'); process.exitCode = 1; });
}
