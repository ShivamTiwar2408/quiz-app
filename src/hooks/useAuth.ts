import { useState, useEffect, useCallback } from 'react';
import { AuthUser } from '../types';
import { signUp, signIn, signOut, confirmSignUp, getStoredAuth } from '../auth';
import { AUTH_SCREENS } from '../constants';

type AuthScreen = typeof AUTH_SCREENS[keyof typeof AUTH_SCREENS];

export interface UseAuthReturn {
  user: AuthUser | null;
  authScreen: AuthScreen;
  authLoading: boolean;
  authError: string;
  pendingEmail: string;
  setAuthScreen: (screen: AuthScreen) => void;
  handleSignUp: (email: string, password: string) => Promise<void>;
  handleSignIn: (email: string, password: string) => Promise<void>;
  handleConfirm: (code: string) => Promise<void>;
  handleSignOut: () => void;
  clearError: () => void;
}

export function useAuth(): UseAuthReturn {
  const [authScreen, setAuthScreen] = useState<AuthScreen>(AUTH_SCREENS.LOGIN);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');

  useEffect(() => {
    const { user: storedUser } = getStoredAuth();
    if (storedUser) setUser(storedUser);
    setAuthLoading(false);
  }, []);

  const handleSignUp = useCallback(async (email: string, password: string) => {
    setAuthError('');
    try {
      await signUp(email, password);
      setPendingEmail(email);
      setAuthScreen(AUTH_SCREENS.CONFIRM);
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Sign up failed');
    }
  }, []);

  const handleConfirm = useCallback(async (code: string) => {
    setAuthError('');
    try {
      await confirmSignUp(pendingEmail, code);
      setAuthScreen(AUTH_SCREENS.LOGIN);
      setAuthError('Email confirmed! Please sign in.');
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Confirmation failed');
    }
  }, [pendingEmail]);

  const handleSignIn = useCallback(async (email: string, password: string) => {
    setAuthError('');
    try {
      const { user: authUser } = await signIn(email, password);
      setUser(authUser);
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Sign in failed');
    }
  }, []);

  const handleSignOut = useCallback(() => {
    signOut();
    setUser(null);
  }, []);

  const clearError = useCallback(() => setAuthError(''), []);

  return {
    user,
    authScreen,
    authLoading,
    authError,
    pendingEmail,
    setAuthScreen,
    handleSignUp,
    handleSignIn,
    handleConfirm,
    handleSignOut,
    clearError,
  };
}
