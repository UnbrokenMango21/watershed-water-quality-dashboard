'use client';

/**
 * Firebase Web (client) SDK. Browser-only and lazily initialized: nothing runs
 * at module evaluation time, so SSR/prerender during `next build` never touches
 * Firebase and never crashes on missing NEXT_PUBLIC_* config.
 *
 * This SDK is only ever used for Email/Password sign-in and for the read-only
 * queries QC_REVIEWER/ADMIN are granted by firebase/firestore.rules. Reviewers
 * cannot write anything through it; every privileged review write goes through
 * the server-side API route.
 */
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** True when the six NEXT_PUBLIC_FIREBASE_* variables are actually present. */
export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);
}

function clientApp(): FirebaseApp {
  if (typeof window === 'undefined') {
    throw new Error('The Firebase client SDK is browser-only; use it from an effect or event handler.');
  }
  if (!isFirebaseConfigured()) {
    throw new Error(
      'Firebase web config is missing. Copy web/.env.example to web/.env.local and fill in the NEXT_PUBLIC_FIREBASE_* values.',
    );
  }
  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}

function connectLocalEmulators(app: FirebaseApp): void {
  const state = globalThis as typeof globalThis & { __watershedFirebaseEmulatorsConnected?: boolean };
  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS !== 'true' || state.__watershedFirebaseEmulatorsConnected) return;
  connectAuthEmulator(getAuth(app), 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(getFirestore(app), '127.0.0.1', 8080);
  state.__watershedFirebaseEmulatorsConnected = true;
}

export function clientAuth(): Auth {
  const app = clientApp();
  connectLocalEmulators(app);
  return getAuth(app);
}

export function clientDb(): Firestore {
  const app = clientApp();
  connectLocalEmulators(app);
  return getFirestore(app);
}
