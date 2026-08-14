/**
 * Firebase Admin SDK - SERVER ONLY.
 *
 * Never import this module from a file marked 'use client' or from anything
 * that ends up in the browser bundle. Its only consumer is the review API
 * route handler (Node.js runtime).
 *
 * Initialization mirrors functions/index.mjs: `initializeApp()` with no
 * explicit credential, i.e. Application Default Credentials. That also makes it
 * work unchanged against the local emulators, because the Admin SDK auto-detects
 * FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST.
 */
import { getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';

function adminApp(): App {
  const existing = getApps();
  return existing.length > 0 ? existing[0] : initializeApp();
}

export function adminAuth(): Auth {
  return getAuth(adminApp());
}

export function adminDb(): Firestore {
  return getFirestore(adminApp());
}

export { Timestamp };
