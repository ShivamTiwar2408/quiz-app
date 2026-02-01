import React from 'react';
import { AUTH_SCREENS } from '../constants';

type AuthScreenType = typeof AUTH_SCREENS[keyof typeof AUTH_SCREENS];

interface AuthScreenProps {
  authScreen: AuthScreenType;
  authError: string;
  pendingEmail: string;
  onSignUp: (email: string, password: string) => Promise<void>;
  onSignIn: (email: string, password: string) => Promise<void>;
  onConfirm: (code: string) => Promise<void>;
  onScreenChange: (screen: AuthScreenType) => void;
  onClearError: () => void;
}

export function AuthScreen({
  authScreen,
  authError,
  pendingEmail,
  onSignUp,
  onSignIn,
  onConfirm,
  onScreenChange,
  onClearError,
}: AuthScreenProps) {
  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    await onSignIn(email, password);
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    await onSignUp(email, password);
  };

  const handleConfirm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const code = (form.elements.namedItem('code') as HTMLInputElement).value;
    await onConfirm(code);
  };

  const switchScreen = (screen: AuthScreenType) => {
    onClearError();
    onScreenChange(screen);
  };

  return (
    <div className="app auth-screen">
      <div className="auth-container">
        <div className="auth-logo">🎯 System Design Quiz</div>
        
        {authScreen === AUTH_SCREENS.LOGIN && (
          <form className="auth-form" onSubmit={handleSignIn}>
            <h2>Sign In</h2>
            {authError && <div className="auth-error">{authError}</div>}
            <input type="email" name="email" placeholder="Email" required />
            <input type="password" name="password" placeholder="Password" required minLength={8} />
            <button type="submit" className="auth-btn primary">Sign In</button>
            <p className="auth-switch">
              Don't have an account?{' '}
              <button type="button" onClick={() => switchScreen(AUTH_SCREENS.SIGNUP)}>
                Sign Up
              </button>
            </p>
          </form>
        )}

        {authScreen === AUTH_SCREENS.SIGNUP && (
          <form className="auth-form" onSubmit={handleSignUp}>
            <h2>Create Account</h2>
            {authError && <div className="auth-error">{authError}</div>}
            <input type="email" name="email" placeholder="Email" required />
            <input
              type="password"
              name="password"
              placeholder="Password (min 8 chars, upper, lower, digit)"
              required
              minLength={8}
            />
            <button type="submit" className="auth-btn primary">Sign Up</button>
            <p className="auth-switch">
              Already have an account?{' '}
              <button type="button" onClick={() => switchScreen(AUTH_SCREENS.LOGIN)}>
                Sign In
              </button>
            </p>
          </form>
        )}

        {authScreen === AUTH_SCREENS.CONFIRM && (
          <form className="auth-form" onSubmit={handleConfirm}>
            <h2>Confirm Email</h2>
            <p className="auth-info">We sent a verification code to {pendingEmail}</p>
            {authError && <div className="auth-error">{authError}</div>}
            <input type="text" name="code" placeholder="Verification Code" required />
            <button type="submit" className="auth-btn primary">Confirm</button>
            <p className="auth-switch">
              <button type="button" onClick={() => switchScreen(AUTH_SCREENS.LOGIN)}>
                Back to Sign In
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
