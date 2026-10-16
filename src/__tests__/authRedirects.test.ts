import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SupabaseAuthRepository,
  getValidAuthRedirectUrl,
  PRODUCTION_WEB_ORIGIN,
  NATIVE_REDIRECT_URI,
} from '../repositories/SupabaseAuthRepository';
import { Browser } from '@capacitor/browser';

const { mockSignInWithOtp, mockSignInWithOAuth, mockVerifyOtp, mockGetSession } = vi.hoisted(() => ({
  mockSignInWithOtp: vi.fn(),
  mockSignInWithOAuth: vi.fn(),
  mockVerifyOtp: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    auth: {
      signInWithOtp: mockSignInWithOtp,
      signInWithOAuth: mockSignInWithOAuth,
      verifyOtp: mockVerifyOtp,
      getSession: mockGetSession,
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

vi.mock('@capacitor/browser', () => ({
  Browser: {
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Authentication Redirect Security & Flow Verification', () => {
  let authRepo: SupabaseAuthRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    authRepo = new SupabaseAuthRepository();
  });

  // ==========================================================================
  // 1. Redirect URL Validation & Origin Sanitization
  // ==========================================================================
  describe('Redirect URL Validation (getValidAuthRedirectUrl)', () => {
    it('returns native deep-link URI on native platform when preferNativeScheme is true', () => {
      const url = getValidAuthRedirectUrl({ isNative: true, preferNativeScheme: true });
      expect(url).toBe(NATIVE_REDIRECT_URI);
      expect(url).toBe('stylesaathi://auth/callback');
    });

    it('returns canonical HTTPS web origin on native platform when preferNativeScheme is false (for email links)', () => {
      const url = getValidAuthRedirectUrl({ isNative: true, preferNativeScheme: false });
      expect(url).toBe(PRODUCTION_WEB_ORIGIN);
      expect(url).toBe('https://stylesaathi.vercel.app');
    });

    it('returns canonical production URL when running on https://stylesaathi.vercel.app', () => {
      const url = getValidAuthRedirectUrl({
        isNative: false,
        customOrigin: 'https://stylesaathi.vercel.app',
      });
      expect(url).toBe('https://stylesaathi.vercel.app');
    });

    it('allows valid Vercel preview environments under stylesaathi-*.vercel.app', () => {
      const previewUrl = 'https://stylesaathi-git-feature-preview.vercel.app';
      const url = getValidAuthRedirectUrl({
        isNative: false,
        customOrigin: previewUrl,
      });
      expect(url).toBe(previewUrl);
    });

    it('allows local development origins with custom ports (localhost and 127.0.0.1)', () => {
      expect(
        getValidAuthRedirectUrl({ isNative: false, customOrigin: 'http://localhost:5173' })
      ).toBe('http://localhost:5173');

      expect(
        getValidAuthRedirectUrl({ isNative: false, customOrigin: 'http://localhost:3000' })
      ).toBe('http://localhost:3000');

      expect(
        getValidAuthRedirectUrl({ isNative: false, customOrigin: 'http://127.0.0.1:5173' })
      ).toBe('http://127.0.0.1:5173');
    });

    it('safely rejects untrusted, external, or malicious redirect origins and falls back to production', () => {
      // Phishing / cross-origin spoofing attempts
      expect(
        getValidAuthRedirectUrl({ isNative: false, customOrigin: 'https://evil-attacker.com' })
      ).toBe(PRODUCTION_WEB_ORIGIN);

      expect(
        getValidAuthRedirectUrl({ isNative: false, customOrigin: 'https://stylesaathi.attacker.com' })
      ).toBe(PRODUCTION_WEB_ORIGIN);

      expect(
        getValidAuthRedirectUrl({ isNative: false, customOrigin: 'javascript:alert(document.cookie)' })
      ).toBe(PRODUCTION_WEB_ORIGIN);

      expect(
        getValidAuthRedirectUrl({ isNative: false, customOrigin: 'data:text/html,<script>alert(1)</script>' })
      ).toBe(PRODUCTION_WEB_ORIGIN);
    });

    it('safely falls back to production when origin is empty or invalid', () => {
      expect(getValidAuthRedirectUrl({ isNative: false, customOrigin: '' })).toBe(
        PRODUCTION_WEB_ORIGIN
      );
      expect(getValidAuthRedirectUrl({ isNative: false, customOrigin: 'not-a-valid-url' })).toBe(
        PRODUCTION_WEB_ORIGIN
      );
    });
  });

  // ==========================================================================
  // 2. Email OTP and emailRedirectTo Dispatch
  // ==========================================================================
  describe('Email OTP Flow (sendEmailOtp)', () => {
    it('passes verified emailRedirectTo in options to signInWithOtp', async () => {
      mockSignInWithOtp.mockResolvedValue({ error: null });

      await authRepo.sendEmailOtp('  Test.User@StyleSaathi.IN  ', '  Ananya  ');

      expect(mockSignInWithOtp).toHaveBeenCalledTimes(1);
      const callArgs = mockSignInWithOtp.mock.calls[0][0];

      // Verifies normalization
      expect(callArgs.email).toBe('test.user@stylesaathi.in');

      // Verifies options structure
      expect(callArgs.options).toBeDefined();
      expect(callArgs.options.shouldCreateUser).toBe(true);

      // Verifies emailRedirectTo is supplied (root cause fix)
      expect(callArgs.options.emailRedirectTo).toBe(PRODUCTION_WEB_ORIGIN);

      // Verifies name metadata is trimmed
      expect(callArgs.options.data).toEqual({ name: 'Ananya' });
    });

    it('translates rate limit errors into a clean user-friendly message', async () => {
      mockSignInWithOtp.mockResolvedValue({
        error: { message: 'over_email_send_rate_limit: email rate limit exceeded' },
      });

      await expect(authRepo.sendEmailOtp('user@example.com')).rejects.toThrow(
        'Too many login attempts. Please wait 60 seconds before trying again.'
      );
    });
  });

  // ==========================================================================
  // 3. Google OAuth Redirect Dispatch
  // ==========================================================================
  describe('Google OAuth Flow (signInWithGoogle)', () => {
    it('initiates Google OAuth on web targeting canonical production redirect URL', async () => {
      mockSignInWithOAuth.mockResolvedValue({
        data: { url: 'https://accounts.google.com/o/oauth2/auth?...' },
        error: null,
      });

      const res = await authRepo.signInWithGoogle();

      expect(mockSignInWithOAuth).toHaveBeenCalledTimes(1);
      const callArgs = mockSignInWithOAuth.mock.calls[0][0];

      expect(callArgs.provider).toBe('google');
      expect(callArgs.options.redirectTo).toBe(PRODUCTION_WEB_ORIGIN);
      expect(callArgs.options.skipBrowserRedirect).toBe(false);
      expect(res).toEqual({ url: 'https://accounts.google.com/o/oauth2/auth?...' });
    });
  });

  // ==========================================================================
  // 4. Six-Digit OTP Verification (verifyEmailOtp)
  // ==========================================================================
  describe('Six-Digit OTP Verification (verifyEmailOtp)', () => {
    it('submits 6-digit code with type email and maps authenticated user', async () => {
      const mockSupabaseUser = {
        id: 'usr_sb_verified_123',
        email: 'ananya@stylesaathi.in',
        user_metadata: { full_name: 'Ananya Sharma' },
        created_at: '2026-10-15T12:00:00.000Z',
      };

      mockVerifyOtp.mockResolvedValue({
        data: { user: mockSupabaseUser },
        error: null,
      });

      const user = await authRepo.verifyEmailOtp('ananya@stylesaathi.in', ' 492810 ');

      expect(mockVerifyOtp).toHaveBeenCalledWith({
        email: 'ananya@stylesaathi.in',
        token: '492810',
        type: 'email',
      });

      expect(user.id).toBe('usr_sb_verified_123');
      expect(user.email).toBe('ananya@stylesaathi.in');
      expect(user.name).toBe('Ananya Sharma');
      expect(user.isGuest).toBe(false);
    });

    it('rejects invalid or expired OTP code with actionable error message', async () => {
      mockVerifyOtp.mockResolvedValue({
        data: null,
        error: { message: 'Token has expired or is invalid' },
      });

      await expect(
        authRepo.verifyEmailOtp('ananya@stylesaathi.in', '000000')
      ).rejects.toThrow('Token has expired or is invalid');
    });
  });
});
