// Firebase initialization — single source of truth for the Firebase app,
// Auth, and Firestore instances used across the app.
//
// Config is read from environment variables (REACT_APP_FIREBASE_*) so no
// secrets are committed. For local dev, copy .env.example to .env.local and
// fill in the values from the Firebase console (Project settings → Your apps).
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  Firestore,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

/** True when the build has Firebase configuration wired up. */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  authInstance = getAuth(app);
  // Offline-first: cache progress locally so the app works on flaky networks
  // and syncs when back online. Multi-tab safe.
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} else {
  // Surface a clear, single warning instead of cryptic null errors downstream.
  // The app still renders; data calls degrade gracefully (see api.ts guards).
  // eslint-disable-next-line no-console
  console.warn(
    '[firebase] Not configured — set REACT_APP_FIREBASE_* env vars. ' +
      'Running without persistence.'
  );
}

export const auth = authInstance as Auth;
export const db = dbInstance as Firestore;
export const googleProvider = new GoogleAuthProvider();
