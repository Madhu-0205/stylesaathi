// @vitest-environment jsdom
// ============================================================================
// STYLESAATHI 3.0 — CLIENT PKCE & MEMORY-ONLY SESSION TOKEN UNIT TESTS
// Phase 3F.10A.3: Unified PKCE Authentication Architecture
// ============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generatePkceVerifier,
  generatePkceChallenge,
  base64UrlEncode,
  savePendingPkceVerifier,
  getAndClearPendingPkceVerifier,
  extractAndScrubExchangeCode,
  setInMemorySession,
  getInMemorySessionToken,
  getInMemoryUserId,
  clearInMemorySession,
  redeemExchangeCode,
} from '../lib/auth/pkce';

describe('Phase 3F.10A.3: Client PKCE & Memory-Only Session Token Security', () => {
  beforeEach(() => {
    clearInMemorySession();
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.clear();
    }
  });

  describe('1. Cryptographic PKCE Generation (RFC 7636)', () => {
    it('generates high-entropy code_verifier with unreserved URL characters only', () => {
      const verifier = generatePkceVerifier(64);
      expect(verifier).toBeDefined();
      expect(verifier.length).toBe(64);
      // RFC 7636 unreserved characters: [A-Z], [a-z], [0-9], "-", ".", "_", "~"
      expect(/^[A-Za-z0-9\-._~]+$/.test(verifier)).toBe(true);
    });

    it('generates distinct verifiers on consecutive calls (cryptographic randomness)', () => {
      const v1 = generatePkceVerifier(64);
      const v2 = generatePkceVerifier(64);
      expect(v1).not.toBe(v2);
    });

    it('generates deterministic SHA-256 S256 code_challenge from verifier', async () => {
      const verifier = 'test-verifier-abcdef1234567890-test-verifier-abcdef1234567890';
      const challenge1 = await generatePkceChallenge(verifier);
      const challenge2 = await generatePkceChallenge(verifier);

      expect(challenge1).toBeDefined();
      expect(challenge1).toBe(challenge2);
      // Must be Base64url without padding characters
      expect(challenge1).not.toContain('+');
      expect(challenge1).not.toContain('/');
      expect(challenge1).not.toContain('=');
    });
  });

  describe('2. Transient Verifier Storage & Atomic Scrubbing', () => {
    it('persists transient verifier across redirect and scrubs on retrieval', () => {
      const verifier = generatePkceVerifier(64);
      savePendingPkceVerifier(verifier);

      // First retrieval succeeds
      const retrieved = getAndClearPendingPkceVerifier();
      expect(retrieved).toBe(verifier);

      // Second retrieval returns null (atomic consumption)
      const secondAttempt = getAndClearPendingPkceVerifier();
      expect(secondAttempt).toBeNull();
    });
  });

  describe('3. Strict Zero-Persistence Invariant for Session Tokens', () => {
    it('holds session tokens in memory only and never writes to localStorage or sessionStorage', () => {
      const mockToken = 'stylesaathi_bearer_mock_secret_token_12345';
      const mockUserId = 'user-abc-123';

      setInMemorySession(mockToken, mockUserId);

      expect(getInMemorySessionToken()).toBe(mockToken);
      expect(getInMemoryUserId()).toBe(mockUserId);

      // Verify ZERO persistence in web storage
      if (typeof window !== 'undefined') {
        if (window.localStorage) {
          expect(window.localStorage.getItem('token')).toBeNull();
          expect(window.localStorage.getItem('sessionToken')).toBeNull();
          expect(window.localStorage.getItem('stylesaathi_session')).toBeNull();
        }
        if (window.sessionStorage) {
          expect(window.sessionStorage.getItem('token')).toBeNull();
          expect(window.sessionStorage.getItem('sessionToken')).toBeNull();
          expect(window.sessionStorage.getItem('stylesaathi_session')).toBeNull();
        }
      }

      // Clearing in-memory session removes access
      clearInMemorySession();
      expect(getInMemorySessionToken()).toBeNull();
      expect(getInMemoryUserId()).toBeNull();
    });
  });

  describe('4. URL Fragment Scrubbing (history.replaceState)', () => {
    it('extracts exchange code from hash fragment and scrubs URL immediately', () => {
      // Mock window.location and window.history
      const originalLocation = window.location;
      const originalHistory = window.history;

      try {
        const replaceStateMock = vi.fn();
        delete (window as any).location;
        delete (window as any).history;

        window.location = {
          pathname: '/app',
          search: '',
          hash: '#code=test-exchange-code-98765&state=valid-state',
        } as any;

        window.history = {
          replaceState: replaceStateMock,
        } as any;

        const extractedCode = extractAndScrubExchangeCode();

        expect(extractedCode).toBe('test-exchange-code-98765');
        // history.replaceState must have been called to strip the fragment
        expect(replaceStateMock).toHaveBeenCalledWith(null, document.title, '/app');
      } finally {
        (window as any).location = originalLocation;
        (window as any).history = originalHistory;
      }
    });

    it('returns null when no exchange code is in the fragment', () => {
      const originalLocation = window.location;
      try {
        delete (window as any).location;
        window.location = {
          pathname: '/app',
          search: '',
          hash: '#unrelated-anchor',
        } as any;

        const code = extractAndScrubExchangeCode();
        expect(code).toBeNull();
      } finally {
        (window as any).location = originalLocation;
      }
    });
  });

  describe('5. TLS Exchange Code Redemption', () => {
    it('executes TLS POST to /api/auth/exchange-code with code and code_verifier', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          sessionToken: 'raw-bearer-session-token-xyz',
          userId: 'user-777',
        }),
      });

      const result = await redeemExchangeCode(
        'https://stylesaathi-api-staging.madhuvalurouthu52.workers.dev',
        'exchange-code-123',
        'verifier-abc',
        mockFetch as any
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://stylesaathi-api-staging.madhuvalurouthu52.workers.dev/api/auth/exchange-code',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            code: 'exchange-code-123',
            code_verifier: 'verifier-abc',
          }),
        })
      );

      expect(result.sessionToken).toBe('raw-bearer-session-token-xyz');
      expect(result.userId).toBe('user-777');
      // Must be set in-memory
      expect(getInMemorySessionToken()).toBe('raw-bearer-session-token-xyz');
    });

    it('throws error when server rejects exchange code', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'INVALID_EXCHANGE_CODE',
          message: 'Exchange code is invalid, expired, or has already been used.',
        }),
      });

      await expect(
        redeemExchangeCode(
          'https://stylesaathi-api-staging.madhuvalurouthu52.workers.dev',
          'expired-code',
          'verifier-abc',
          mockFetch as any
        )
      ).rejects.toThrow('Exchange code is invalid, expired, or has already been used.');
    });
  });
});
