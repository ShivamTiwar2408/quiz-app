// Authentication — Firebase Auth with Google Sign-In.
//
// This module is the single auth boundary for the app. It preserves the
// function names the rest of the codebase already imports (signInWithGoogle,
// signOut, getStoredAuth, onAuthChange, getIdToken) so screens/hooks are
// unaffected by the move off Amazon Cognito.
import {
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { AuthUser } from './types';
import { auth, googleProvider, isFirebaseConfigured } from './firebase';

const USER_KEY = 'authUser';

function toAuthUser(u: FirebaseUser): AuthUser {
  return {
    email: u.email || u.displayName || 'user',
    userId: u.uid,
  };
}

/** Sign in with a Google popup. Resolves to the signed-in user. */
export async function signInWithGoogle(): Promise<AuthUser> {
  if (!isFirebaseConfigured) {
    throw new Error(
      'Sign-in is unavailable: Firebase is not configured for this build.'
    );
  }
  const cred = await signInWithPopup(auth, googleProvider);
  const user = toAuthUser(cred.user);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

/** Sign the current user out and clear cached identity. */
export async function signOut(): Promise<void> {
  localStorage.removeItem(USER_KEY);
  if (isFirebaseConfigured) {
    try {
      await fbSignOut(auth);
    } catch {
      /* ignore — local state already cleared */
    }
  }
}

/**
 * Subscribe to auth state changes. Fires immediately with the current user
 * (or null) and then on every sign-in/out. Returns an unsubscribe function.
 */
export function onAuthChange(cb: (user: AuthUser | null) => void): () => void {
  if (!isFirebaseConfigured) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(auth, (u) => {
    if (u) {
      const user = toAuthUser(u);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      cb(user);
    } else {
      localStorage.removeItem(USER_KEY);
      cb(null);
    }
  });
}

/** Synchronously read the last-known user from localStorage (for first paint). */
export function getStoredAuth(): { user: AuthUser | null } {
  const userStr = localStorage.getItem(USER_KEY);
  return { user: userStr ? JSON.parse(userStr) : null };
}

/** The Firebase ID token for the current user, or null. */
export async function getIdToken(): Promise<string | null> {
  if (!isFirebaseConfigured || !auth.currentUser) return null;
  return auth.currentUser.getIdToken();
}

/** The current user's uid, or null. Used by the Firestore data layer. */
export function getCurrentUserId(): string | null {
  return auth.currentUser?.uid ?? getStoredAuth().user?.userId ?? null;
}
