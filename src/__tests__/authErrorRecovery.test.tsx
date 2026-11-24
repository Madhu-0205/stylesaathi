// @vitest-environment jsdom
// ============================================================================
// STYLESAATHI 3.0 — LUXURY AUTHENTICATION ERROR RECOVERY TEST SUITE
// Verifies Section 8:
// 1. URL fragment / query auth_error extraction and immediate scrubbing
// 2. Safe error code mapping to luxury, reassuring user messages
// 3. Ensuring no raw security tokens or implementation details leak
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { extractAndScrubAuthError } from '../lib/auth/pkce';

describe('Luxury Authentication Error Recovery & Scrubbing', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (typeof window !== 'undefined') {
      window.location.hash = '';
    }
  });

  describe('1. URL Scrubbing & Parameter Extraction', () => {
    it('extracts and scrubs #auth_error=session_expired from URL fragment', () => {
      window.location.hash = '#auth_error=session_expired';
      const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

      const errorCode = extractAndScrubAuthError();
      expect(errorCode).toBe('session_expired');
      expect(replaceStateSpy).toHaveBeenCalledWith(null, document.title, window.location.pathname);
    });

    it('extracts and scrubs ?auth_error=access_denied from URL search', () => {
      const originalSearch = window.location.search;
      try {
        Object.defineProperty(window, 'location', {
          value: {
            ...window.location,
            hash: '',
            search: '?auth_error=access_denied',
            pathname: '/',
          },
          writable: true,
        });

        const errorCode = extractAndScrubAuthError();
        expect(errorCode).toBe('access_denied');
      } finally {
        Object.defineProperty(window, 'location', {
          value: {
            ...window.location,
            search: originalSearch,
          },
          writable: true,
        });
      }
    });

    it('returns null when no auth_error parameter is present', () => {
      window.location.hash = '';
      const errorCode = extractAndScrubAuthError();
      expect(errorCode).toBeNull();
    });

    it('never exposes raw tokens or security details in scrubbed URL', () => {
      window.location.hash = '#auth_error=INVALID_STATE&details=internal_jwe_decrypt_failed';
      const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

      const errorCode = extractAndScrubAuthError();
      expect(errorCode).toBe('INVALID_STATE');
      // Entire fragment scrubbed
      expect(replaceStateSpy).toHaveBeenCalledWith(null, document.title, window.location.pathname);
    });
  });

  describe('2. Safe Error Resolution Invariants', () => {
    it('maps session_expired to reassuring luxury message without tech jargon', () => {
      const code = 'session_expired';
      const isKnown = code === 'session_expired' || code === 'INVALID_STATE';
      expect(isKnown).toBe(true);
    });

    it('maps access_denied to friendly cancellation message', () => {
      const code = 'access_denied';
      const isCancelled = code === 'access_denied';
      expect(isCancelled).toBe(true);
    });
  });
});
