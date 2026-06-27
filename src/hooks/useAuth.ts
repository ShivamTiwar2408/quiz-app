import { useState, useEffect, useCallback } from 'react';
import { AuthUser } from '../types';
import { signInWithGoogle, signOut, getStoredAuth, onAuthChange } from '../auth';

export interface UseAuthReturn {
  user: AuthUser | null;
  authLoading: boolean;
  authError: string;
  handleGoogleSignIn: () => Promise<void>;
  handleSignOut: () => void;
  clearError: () => void;
}

export function useAuth(): UseAuthReturn {
  // Optimistic first paint from the last-known user, then reconcile with Firebase.
  const [user, setUser] = useState<AuthUser | null>(() => getStoredAuth().user);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthChange((u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleGoogleSignIn = useCallback(async () => {
    setAuthError('');
    setAuthLoading(true);
    try {
      const u = await signInWithGoogle();
      setUser(u);
    } catch (err: unknown) {
      // Ignore the benign "user closed the popup" case.
      const msg = err instanceof Error ? err.message : 'Sign in failed';
      if (!/popup-closed-by-user|cancelled-popup-request/.test(msg)) {
        setAuthError(msg);
      }
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const handleSignOut = useCallback(() => {
    void signOut();
    setUser(null);
  }, []);

  const clearError = useCallback(() => setAuthError(''), []);

  return { user, authLoading, authError, handleGoogleSignIn, handleSignOut, clearError };
}
