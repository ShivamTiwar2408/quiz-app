import { AuthTokens, AuthUser } from './types';

const COGNITO_REGION = 'us-east-1';
const USER_POOL_ID = process.env.REACT_APP_USER_POOL_ID || '';
const CLIENT_ID = process.env.REACT_APP_USER_POOL_CLIENT_ID || '';

const COGNITO_URL = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/`;

async function cognitoRequest(action: string, payload: Record<string, unknown>) {
  const response = await fetch(COGNITO_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AWSCognitoIdentityProviderService.${action}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.__type || 'Authentication failed');
  }
  return data;
}

export async function signUp(email: string, password: string): Promise<void> {
  await cognitoRequest('SignUp', {
    ClientId: CLIENT_ID,
    Username: email,
    Password: password,
    UserAttributes: [{ Name: 'email', Value: email }],
  });
}

export async function confirmSignUp(email: string, code: string): Promise<void> {
  await cognitoRequest('ConfirmSignUp', {
    ClientId: CLIENT_ID,
    Username: email,
    ConfirmationCode: code,
  });
}

export async function signIn(email: string, password: string): Promise<{ user: AuthUser; tokens: AuthTokens }> {
  const data = await cognitoRequest('InitiateAuth', {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: CLIENT_ID,
    AuthParameters: { USERNAME: email, PASSWORD: password },
  });

  const tokens: AuthTokens = {
    idToken: data.AuthenticationResult.IdToken,
    accessToken: data.AuthenticationResult.AccessToken,
    refreshToken: data.AuthenticationResult.RefreshToken,
  };

  // Decode JWT to get user info
  const payload = JSON.parse(atob(tokens.idToken.split('.')[1]));
  const user: AuthUser = { email: payload.email, userId: payload.sub };

  // Store tokens
  localStorage.setItem('authTokens', JSON.stringify(tokens));
  localStorage.setItem('authUser', JSON.stringify(user));

  return { user, tokens };
}

export async function refreshTokens(): Promise<AuthTokens | null> {
  const stored = localStorage.getItem('authTokens');
  if (!stored) return null;

  const { refreshToken } = JSON.parse(stored);
  try {
    const data = await cognitoRequest('InitiateAuth', {
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: { REFRESH_TOKEN: refreshToken },
    });

    const tokens: AuthTokens = {
      idToken: data.AuthenticationResult.IdToken,
      accessToken: data.AuthenticationResult.AccessToken,
      refreshToken: refreshToken,
    };
    localStorage.setItem('authTokens', JSON.stringify(tokens));
    return tokens;
  } catch {
    signOut();
    return null;
  }
}

export function signOut(): void {
  localStorage.removeItem('authTokens');
  localStorage.removeItem('authUser');
}

export function getStoredAuth(): { user: AuthUser | null; tokens: AuthTokens | null } {
  const tokensStr = localStorage.getItem('authTokens');
  const userStr = localStorage.getItem('authUser');
  return {
    tokens: tokensStr ? JSON.parse(tokensStr) : null,
    user: userStr ? JSON.parse(userStr) : null,
  };
}

export function getIdToken(): string | null {
  const stored = localStorage.getItem('authTokens');
  if (!stored) return null;
  return JSON.parse(stored).idToken;
}

export async function resendConfirmationCode(email: string): Promise<void> {
  await cognitoRequest('ResendConfirmationCode', {
    ClientId: CLIENT_ID,
    Username: email,
  });
}

export async function forgotPassword(email: string): Promise<void> {
  await cognitoRequest('ForgotPassword', {
    ClientId: CLIENT_ID,
    Username: email,
  });
}

export async function confirmForgotPassword(email: string, code: string, newPassword: string): Promise<void> {
  await cognitoRequest('ConfirmForgotPassword', {
    ClientId: CLIENT_ID,
    Username: email,
    ConfirmationCode: code,
    Password: newPassword,
  });
}
