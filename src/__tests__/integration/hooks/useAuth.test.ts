/**
 * Integration Tests for useAuth Hook
 * Tests authentication flow including sign up, sign in, sign out
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth } from '../../../hooks/useAuth';

// Mock the auth module
jest.mock('../../../auth', () => ({
  signUp: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
  confirmSignUp: jest.fn(),
  getStoredAuth: jest.fn(),
}));

import * as authModule from '../../../auth';

const mockAuthModule = authModule as jest.Mocked<typeof authModule>;

describe('useAuth Hook Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthModule.getStoredAuth.mockReturnValue({ user: null, tokens: null });
  });

  describe('Initial State', () => {
    it('should start with no user when no stored auth', async () => {
      const { result } = renderHook(() => useAuth());
      
      await waitFor(() => {
        expect(result.current.authLoading).toBe(false);
      });
      
      expect(result.current.user).toBeNull();
      expect(result.current.authError).toBe('');
    });

    it('should restore user from stored auth', async () => {
      const storedUser = { email: 'test@example.com', userId: 'user-123' };
      mockAuthModule.getStoredAuth.mockReturnValue({
        user: storedUser,
        tokens: { idToken: 'token', accessToken: 'access', refreshToken: 'refresh' },
      });

      const { result } = renderHook(() => useAuth());
      
      await waitFor(() => {
        expect(result.current.authLoading).toBe(false);
      });
      
      expect(result.current.user).toEqual(storedUser);
    });
  });

  describe('Sign Up Flow', () => {
    it('should handle successful sign up', async () => {
      mockAuthModule.signUp.mockResolvedValue(undefined);
      
      const { result } = renderHook(() => useAuth());
      
      await waitFor(() => expect(result.current.authLoading).toBe(false));
      
      await act(async () => {
        await result.current.handleSignUp('test@example.com', 'Password123!');
      });
      
      expect(mockAuthModule.signUp).toHaveBeenCalledWith('test@example.com', 'Password123!');
      expect(result.current.authScreen).toBe('confirm');
      expect(result.current.pendingEmail).toBe('test@example.com');
    });

    it('should handle sign up error', async () => {
      mockAuthModule.signUp.mockRejectedValue(new Error('User already exists'));
      
      const { result } = renderHook(() => useAuth());
      
      await waitFor(() => expect(result.current.authLoading).toBe(false));
      
      await act(async () => {
        await result.current.handleSignUp('test@example.com', 'Password123!');
      });
      
      expect(result.current.authError).toBe('User already exists');
    });
  });

  describe('Sign In Flow', () => {
    it('should handle successful sign in', async () => {
      const mockUser = { email: 'test@example.com', userId: 'user-123' };
      mockAuthModule.signIn.mockResolvedValue({
        user: mockUser,
        tokens: { idToken: 'token', accessToken: 'access', refreshToken: 'refresh' },
      });
      
      const { result } = renderHook(() => useAuth());
      
      await waitFor(() => expect(result.current.authLoading).toBe(false));
      
      await act(async () => {
        await result.current.handleSignIn('test@example.com', 'Password123!');
      });
      
      expect(mockAuthModule.signIn).toHaveBeenCalledWith('test@example.com', 'Password123!');
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.authError).toBe('');
    });

    it('should handle sign in error', async () => {
      mockAuthModule.signIn.mockRejectedValue(new Error('Invalid credentials'));
      
      const { result } = renderHook(() => useAuth());
      
      await waitFor(() => expect(result.current.authLoading).toBe(false));
      
      await act(async () => {
        await result.current.handleSignIn('test@example.com', 'wrong-password');
      });
      
      expect(result.current.authError).toBe('Invalid credentials');
      expect(result.current.user).toBeNull();
    });
  });

  describe('Confirmation Flow', () => {
    it('should handle successful confirmation', async () => {
      mockAuthModule.signUp.mockResolvedValue(undefined);
      mockAuthModule.confirmSignUp.mockResolvedValue(undefined);
      
      const { result } = renderHook(() => useAuth());
      
      await waitFor(() => expect(result.current.authLoading).toBe(false));
      
      // First sign up
      await act(async () => {
        await result.current.handleSignUp('test@example.com', 'Password123!');
      });
      
      // Then confirm
      await act(async () => {
        await result.current.handleConfirm('123456');
      });
      
      expect(mockAuthModule.confirmSignUp).toHaveBeenCalledWith('test@example.com', '123456');
      expect(result.current.authScreen).toBe('login');
    });
  });

  describe('Sign Out Flow', () => {
    it('should handle sign out', async () => {
      const mockUser = { email: 'test@example.com', userId: 'user-123' };
      mockAuthModule.getStoredAuth.mockReturnValue({
        user: mockUser,
        tokens: { idToken: 'token', accessToken: 'access', refreshToken: 'refresh' },
      });
      
      const { result } = renderHook(() => useAuth());
      
      await waitFor(() => expect(result.current.user).toEqual(mockUser));
      
      act(() => {
        result.current.handleSignOut();
      });
      
      expect(mockAuthModule.signOut).toHaveBeenCalled();
      expect(result.current.user).toBeNull();
    });
  });
});
