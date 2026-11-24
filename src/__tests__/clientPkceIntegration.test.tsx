// @vitest-environment jsdom
// ============================================================================
// STYLESAATHI 3.0 — CLIENT PKCE INTEGRATION & SECURITY VERIFICATION SUITE
// Phase 3F.10A.5: Client PKCE Integration
// RFC 7636 PKCE, Memory-Only Bearer Tokens, Deep Link & Sync Integration
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generatePkceVerifier,
  generatePkceChallenge,
  savePendingPkceVerifier,
  getAndClearPendingPkceVerifier,
  extractAndScrubExchangeCode,
  setInMemorySession,
  getInMemorySessionToken,
  clearInMemorySession,
  redeemExchangeCode,
  fetchAuthenticatedUser,
  revokeWorkerSession,
  deleteWorkerAccount,
  getWorkerBaseUrl,
} from '../lib/auth/pkce';
import { deepLinkAuthHandler, validateOAuthCallbackUrl } from '../services/deepLinkHandler';
import { syncService } from '../lib/sync/syncService';
import { syncQueue } from '../lib/sync/syncQueue';
import { workerSyncClient } from '../lib/sync/workerSyncClient';

describe('Phase 3F.10A.5: Client PKCE Production Integration', () => {
  const STAGING_WORKER_URL = 'https://stylesaathi-api-staging.madhuvalurouthu52.workers.dev';

  beforeEach(() => {
    vi.clearAllMocks();
    clearInMemorySession();
    deepLinkAuthHandler.reset();
    syncService.setCurrentUser(null);
    syncService.setAuthToken(null);
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.clear();
    }
  });

  afterEach(() => {
    clearInMemorySession();
  });

  describe('1. Web Client URL Scrubbing & Code Redemption Flow', () => {
    it('immediately scrubs #code= from window.location.hash and redeems with pending PKCE verifier', async () => {
      const originalLocation = window.location;
      const originalHistory = window.history;

      const replaceStateMock = vi.fn();
      delete (window as any).location;
      delete (window as any).history;

      window.location = {
        pathname: '/app',
        search: '',
        hash: '#code=exchange_code_web_12345',
      } as any;

      window.history = {
        replaceState: replaceStateMock,
      } as any;

      try {
        // Step 1: Client generated verifier prior to redirect
        const testVerifier = 'test_code_verifier_1234567890_abcdefghijklmnopqrstuvwxyz';
        savePendingPkceVerifier(testVerifier);

        // Step 2: On application boot, extract and scrub the code
        const code = extractAndScrubExchangeCode();
        expect(code).toBe('exchange_code_web_12345');
        expect(replaceStateMock).toHaveBeenCalledWith(null, document.title, '/app');

        // Step 3: Retrieve transient verifier
        const retrievedVerifier = getAndClearPendingPkceVerifier();
        expect(retrievedVerifier).toBe(testVerifier);

        // Step 4: Exchange code via TLS POST
        const mockFetch = vi.fn().mockImplementation(async (url: string) => {
          if (url.includes('/api/auth/exchange-code')) {
            return {
              ok: true,
              status: 200,
              json: async () => ({
                sessionToken: 'bearer_token_abc_xyz_789',
                userId: 'usr_staging_test_001',
              }),
            };
          }
          if (url.includes('/api/auth/me')) {
            return {
              ok: true,
              status: 200,
              json: async () => ({
                user: {
                  id: 'usr_staging_test_001',
                  email: 'ananya@example.com',
                  name: 'Ananya Roy',
                  createdAt: '2026-11-11T12:00:00Z',
                },
                session: {
                  id: 'sess_001',
                  userId: 'usr_staging_test_001',
                },
              }),
            };
          }
          return { ok: false, status: 404 };
        });

        const redemption = await redeemExchangeCode(
          STAGING_WORKER_URL,
          code!,
          retrievedVerifier!,
          mockFetch as any
        );

        expect(redemption.sessionToken).toBe('bearer_token_abc_xyz_789');
        expect(redemption.userId).toBe('usr_staging_test_001');

        // Verify in-memory session token is set
        expect(getInMemorySessionToken()).toBe('bearer_token_abc_xyz_789');

        // Step 5: Fetch authenticated user
        const user = await fetchAuthenticatedUser(
          STAGING_WORKER_URL,
          redemption.sessionToken,
          mockFetch as any
        );

        expect(user.id).toBe('usr_staging_test_001');
        expect(user.email).toBe('ananya@example.com');
        expect(user.name).toBe('Ananya Roy');
        expect(user.isGuest).toBe(false);

        // Step 6: Verify sync service updates
        syncService.setCurrentUser(user);
        syncService.setAuthToken(redemption.sessionToken);

        expect(syncService.getCurrentUser()?.id).toBe('usr_staging_test_001');
        expect(syncService.getAuthToken()).toBe('bearer_token_abc_xyz_789');
      } finally {
        (window as any).location = originalLocation;
        (window as any).history = originalHistory;
      }
    });

    it('deduplicates in-flight code redemption requests (React 18 Strict Mode resilience)', async () => {
      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(async () => {
        callCount++;
        // Simulate network latency
        await new Promise((r) => setTimeout(r, 20));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            sessionToken: 'strict_mode_token_abc',
            userId: 'user_strict_01',
          }),
        };
      });

      const promise1 = redeemExchangeCode(
        STAGING_WORKER_URL,
        'duplicate_exchange_code_999',
        'verifier_strict_mode',
        mockFetch as any
      );

      const promise2 = redeemExchangeCode(
        STAGING_WORKER_URL,
        'duplicate_exchange_code_999',
        'verifier_strict_mode',
        mockFetch as any
      );

      const [res1, res2] = await Promise.all([promise1, promise2]);

      expect(res1.sessionToken).toBe('strict_mode_token_abc');
      expect(res2.sessionToken).toBe('strict_mode_token_abc');
      // Must only call fetch ONCE despite concurrent double invocation
      expect(callCount).toBe(1);
    });
  });

  describe('2. Memory-Only Token Storage Invariant (SEC-02)', () => {
    it('holds bearer tokens strictly in JavaScript heap memory and never writes to localStorage or sessionStorage', () => {
      const mockToken = 'memory_only_secret_session_token_999';
      const mockUserId = 'usr_memory_001';

      setInMemorySession(mockToken, mockUserId);

      expect(getInMemorySessionToken()).toBe(mockToken);

      // Verify ZERO storage persistence
      if (typeof window !== 'undefined') {
        expect(window.localStorage.getItem('token')).toBeNull();
        expect(window.localStorage.getItem('sessionToken')).toBeNull();
        expect(window.localStorage.getItem('stylesaathi_session')).toBeNull();
        expect(window.sessionStorage.getItem('token')).toBeNull();
        expect(window.sessionStorage.getItem('sessionToken')).toBeNull();
      }

      // Reload simulation: clear memory
      clearInMemorySession();
      expect(getInMemorySessionToken()).toBeNull();
    });
  });

  describe('3. Android Deep Link PKCE Redemption Flow', () => {
    it('validates deep link scheme and redeems single-use exchange code with pending PKCE verifier', async () => {
      const deepLinkUrl = 'stylesaathi://auth/callback?code=android_exchange_code_456';
      const validation = validateOAuthCallbackUrl(deepLinkUrl);

      expect(validation.isValid).toBe(true);
      expect(validation.code).toBe('android_exchange_code_456');

      // Save client verifier
      const androidVerifier = 'android_client_verifier_xyz_789';
      savePendingPkceVerifier(androidVerifier);

      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/auth/exchange-code')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              sessionToken: 'android_session_token_777',
              userId: 'usr_android_001',
            }),
          };
        }
        if (url.includes('/api/auth/me')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              user: {
                id: 'usr_android_001',
                email: 'vikram@example.com',
                name: 'Vikram Joshi',
                createdAt: '2026-11-11T12:00:00Z',
              },
            }),
          };
        }
        return { ok: false, status: 404 };
      });

      // Execute deep link handler
      let authenticatedUser: any = null;
      let authError: string | null = null;

      // Mock global fetch for deepLinkAuthHandler
      const originalFetch = globalThis.fetch;
      globalThis.fetch = mockFetch as any;

      try {
        const handled = await deepLinkAuthHandler.handleDeepLink(
          deepLinkUrl,
          (user) => {
            authenticatedUser = user;
          },
          (err) => {
            authError = err;
          }
        );

        expect(handled).toBe(true);
        expect(authError).toBeNull();
        expect(authenticatedUser).not.toBeNull();
        expect(authenticatedUser.id).toBe('usr_android_001');
        expect(authenticatedUser.name).toBe('Vikram Joshi');
        expect(getInMemorySessionToken()).toBe('android_session_token_777');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('prevents replay attacks by rejecting already-processed deep link authorization codes', async () => {
      const deepLinkUrl = 'stylesaathi://auth/callback?code=replay_code_001';
      savePendingPkceVerifier('test_verifier_001');

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          sessionToken: 'token_001',
          userId: 'user_001',
        }),
      });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = mockFetch as any;

      try {
        // First execution succeeds
        const firstAttempt = await deepLinkAuthHandler.handleDeepLink(deepLinkUrl);
        expect(firstAttempt).toBe(true);

        // Second execution with identical code is rejected by duplicate callback protection
        const secondAttempt = await deepLinkAuthHandler.handleDeepLink(deepLinkUrl);
        expect(secondAttempt).toBe(false);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('4. Sign Out & Account Deletion Protocol', () => {
    it('revokes remote session on Worker and terminates in-memory session', async () => {
      setInMemorySession('bearer_token_to_revoke', 'usr_001');

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      await revokeWorkerSession(STAGING_WORKER_URL, null, mockFetch as any);

      expect(mockFetch).toHaveBeenCalledWith(
        `${STAGING_WORKER_URL}/api/auth/sign-out`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer bearer_token_to_revoke',
          }),
        })
      );

      // In-memory session must be cleared
      expect(getInMemorySessionToken()).toBeNull();
    });

    it('executes cascade deletion tombstone on Worker and clears in-memory session', async () => {
      setInMemorySession('bearer_token_for_deletion', 'usr_002');

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: 'Account and all associated records deleted permanently.',
          requestId: 'del-12345',
        }),
      });

      await deleteWorkerAccount(STAGING_WORKER_URL, null, mockFetch as any);

      expect(mockFetch).toHaveBeenCalledWith(
        `${STAGING_WORKER_URL}/api/auth/delete-account`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer bearer_token_for_deletion',
          }),
        })
      );

      expect(getInMemorySessionToken()).toBeNull();
    });
  });

  describe('5. Sync Service Bearer Token Propagation & HTTP 401 Safety', () => {
    it('propagates in-memory session token to Worker sync client headers', async () => {
      const mockSessionToken = 'active_bearer_token_sync_test';
      setInMemorySession(mockSessionToken, 'user_sync_01');

      let capturedHeaders: Record<string, string> = {};
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation(async (url: string, opts: any) => {
        capturedHeaders = opts?.headers || {};
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, processed: 1, results: [] }),
        };
      });

      try {
        await workerSyncClient.pushMutations(
          [
            {
              id: 'mut_sync_001',
              entityType: 'wardrobe_item',
              entityId: 'item_001',
              operation: 'UPSERT',
              payload: { name: 'Silk Kurta' } as any,
              clientTimestamp: Date.now(),
              attemptCount: 0,
              maxAttempts: 5,
              nextRetryAt: null,
              lastError: null,
              status: 'pending',
            } as any,
          ],
          syncService.getAuthToken() || undefined
        );

        expect(capturedHeaders['Authorization']).toBe(`Bearer ${mockSessionToken}`);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('preserves local offline mutations without dead-lettering when Worker returns HTTP 401', async () => {
      syncService.setSyncBackend('worker');
      syncService.setCurrentUser({
        id: 'usr_401_test',
        name: 'Test Stylist',
        isGuest: false,
        createdAt: Date.now(),
      });

      // Enqueue a local mutation
      await syncQueue.enqueue({
        userId: 'usr_401_test',
        entityType: 'wardrobe_item',
        entityId: 'item_unauth_01',
        operation: 'UPSERT',
        payload: { name: 'Chanderi Saree' } as any,
      });

      // Mock Worker returning HTTP 401 Unauthorized
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          error: 'UNAUTHORIZED',
          message: 'Invalid or expired session token.',
        }),
      });

      try {
        // Run queue processing
        await syncService.processQueue();

        // 1. Sync service status must transition to error with clear message
        expect(syncService.getStatus()).toBe('error');
        expect(syncService.getLastError()).toContain('authentication required');

        // 2. The mutation MUST NOT be dead-lettered!
        const stats = await syncQueue.getStats('usr_401_test');
        expect(stats.deadLetter).toBe(0);
        // It remains pending or failed for transient retry
        expect(stats.total).toBe(1);
      } finally {
        globalThis.fetch = originalFetch;
        // Clean up queue
        await syncQueue.clear();
      }
    });
  });
});
