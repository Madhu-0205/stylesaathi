import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateOAuthCallbackUrl, deepLinkAuthHandler } from '../deepLinkHandler';
import { supabase } from '../../lib/supabase';
import { Browser } from '@capacitor/browser';

// Mock Capacitor
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => true),
    getPlatform: vi.fn(() => 'android'),
  },
}));

vi.mock('@capacitor/browser', () => ({
  Browser: {
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
    getLaunchUrl: vi.fn().mockResolvedValue(null),
  },
}));

describe('Deep Link OAuth Validation & Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deepLinkAuthHandler.reset();
  });

  describe('validateOAuthCallbackUrl', () => {
    it('accepts a valid stylesaathi://auth/callback URL with code', () => {
      const res = validateOAuthCallbackUrl('stylesaathi://auth/callback?code=test-auth-code-999');
      expect(res.isValid).toBe(true);
      expect(res.code).toBe('test-auth-code-999');
      expect(res.error).toBeUndefined();
    });

    it('rejects URLs with incorrect scheme', () => {
      const res = validateOAuthCallbackUrl('https://auth/callback?code=test-code');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Invalid protocol');
    });

    it('rejects URLs with incorrect host', () => {
      const res = validateOAuthCallbackUrl('stylesaathi://payment/callback?code=test-code');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Invalid host');
    });

    it('rejects URLs with incorrect pathname', () => {
      const res = validateOAuthCallbackUrl('stylesaathi://auth/dashboard?code=test-code');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Invalid pathname');
    });

    it('rejects URLs missing the code parameter', () => {
      const res = validateOAuthCallbackUrl('stylesaathi://auth/callback');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Missing authorization code');
    });

    it('rejects URLs with empty code parameter', () => {
      const res = validateOAuthCallbackUrl('stylesaathi://auth/callback?code=   ');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Missing authorization code');
    });

    it('surfaces OAuth provider errors safely without exposing codes', () => {
      const res = validateOAuthCallbackUrl(
        'stylesaathi://auth/callback?error=access_denied&error_description=User+cancelled+sign-in'
      );
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('User cancelled sign-in');
    });

    it('handles malformed string safely', () => {
      const res = validateOAuthCallbackUrl('not a valid url at all :::');
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('Malformed callback URL');
    });
  });

  describe('DeepLinkAuthHandler execution', () => {
    it('successfully exchanges code for session and calls onSuccess', async () => {
      const mockUser = {
        id: 'usr_oauth_123',
        email: 'priya@example.in',
        user_metadata: { name: 'Priya Sharma' },
        created_at: new Date().toISOString(),
      };

      vi.spyOn(supabase.auth, 'exchangeCodeForSession').mockResolvedValueOnce({
        data: {
          user: mockUser as any,
          session: {
            user: mockUser as any,
            access_token: 'mock-token',
            refresh_token: 'mock-refresh',
            expires_in: 3600,
            token_type: 'bearer',
          } as any,
        },
        error: null,
      });

      const onSuccess = vi.fn();
      const onError = vi.fn();

      const handled = await deepLinkAuthHandler.handleDeepLink(
        'stylesaathi://auth/callback?code=valid-code-123',
        onSuccess,
        onError
      );

      expect(handled).toBe(true);
      expect(Browser.close).toHaveBeenCalled();
      expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('valid-code-123');
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'usr_oauth_123',
          email: 'priya@example.in',
          name: 'Priya Sharma',
          isGuest: false,
        })
      );
      expect(onError).not.toHaveBeenCalled();
    });

    it('prevents duplicate exchange attempts for the same authorization code', async () => {
      vi.spyOn(supabase.auth, 'exchangeCodeForSession').mockResolvedValue({
        data: {
          user: { id: 'u1', email: 'u1@ex.in', created_at: new Date().toISOString() } as any,
          session: {
            user: { id: 'u1', email: 'u1@ex.in', created_at: new Date().toISOString() } as any,
            access_token: 'tk',
            refresh_token: 'rf',
            expires_in: 3600,
            token_type: 'bearer',
          } as any,
        },
        error: null,
      } as any);

      const onSuccess = vi.fn();
      const onError = vi.fn();

      // First invocation
      const first = await deepLinkAuthHandler.handleDeepLink(
        'stylesaathi://auth/callback?code=dup-code-abc',
        onSuccess,
        onError
      );
      expect(first).toBe(true);
      expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);

      // Second invocation with identical code
      const second = await deepLinkAuthHandler.handleDeepLink(
        'stylesaathi://auth/callback?code=dup-code-abc',
        onSuccess,
        onError
      );
      expect(second).toBe(false);
      // Still only called once
      expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    });

    it('handles failed code exchange without crashing', async () => {
      vi.spyOn(supabase.auth, 'exchangeCodeForSession').mockResolvedValueOnce({
        data: { user: null, session: null } as any,
        error: {
          message: 'Authorization code has expired',
          name: 'AuthApiError',
          status: 400,
          code: 'expired_code',
          __isAuthError: true,
        } as any,
      } as any);

      const onSuccess = vi.fn();
      const onError = vi.fn();

      const handled = await deepLinkAuthHandler.handleDeepLink(
        'stylesaathi://auth/callback?code=expired-code-xyz',
        onSuccess,
        onError
      );

      expect(handled).toBe(false);
      expect(onSuccess).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith('Authorization code has expired');
    });

    it('ignores unrelated deep link schemes gracefully', async () => {
      const onSuccess = vi.fn();
      const onError = vi.fn();

      const handled = await deepLinkAuthHandler.handleDeepLink(
        'myapp://settings/profile',
        onSuccess,
        onError
      );

      expect(handled).toBe(false);
      expect(onSuccess).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });
  });
});
