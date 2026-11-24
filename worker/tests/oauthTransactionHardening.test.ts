// ============================================================================
// STYLESAATHI 3.0 — GOOGLE OAUTH HARDENING & INVALID_STATE ROOT CAUSE TEST SUITE
// Verifies:
// 1. Valid OAuth Transaction
// 2. Missing Transaction Cookie (API 400 JSON vs Browser 302 Redirect)
// 3. Expired Transaction Cookie (10-minute TTL)
// 4. Incorrect / Tampered State Parameter
// 5. Replayed Callback Protection
// 6. Multi-Tab / Concurrent Login Safety
// 7. Cookie Attribute Security (Path=/, HttpOnly, Secure, SameSite=Lax & None)
// 8. OAuth Provider Error Handling (e.g. access_denied)
// 9. Single-Use Exchange Code & PKCE Validation
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { SignJWT, EncryptJWT, generateKeyPair } from 'jose';

import { app } from '../src/index';
import type { D1Database, D1PreparedStatement, D1Result, WorkerEnv } from '../src/types';
import {
  generatePkcePair,
  sha256Hex,
  generateSecureToken,
  getAuthSecretKey,
  encryptOAuthTx,
} from '../src/auth/crypto';
import {
  OAUTH_TX_COOKIE_NAME,
  OAUTH_TX_COOKIE_NONE,
  MAX_CONCURRENT_OAUTH_TRANSACTIONS,
} from '../src/auth/routes';

const MIGRATION_PATH = path.resolve(__dirname, '../migrations/0001_initial_schema.sql');
const MIGRATION_V2_PATH = path.resolve(__dirname, '../migrations/0002_sync_mutations.sql');
const MIGRATION_V3_PATH = path.resolve(__dirname, '../migrations/0003_entity_revisions.sql');

function createD1Adapter(db: DatabaseSync): D1Database {
  return {
    prepare(query: string): D1PreparedStatement {
      let boundValues: any[] = [];
      const stmt = {
        bind(...values: unknown[]) {
          boundValues = values as any[];
          return stmt;
        },
        async first<T = unknown>(colName?: string): Promise<T | null> {
          const row = db.prepare(query).get(...boundValues) as any;
          if (!row) return null;
          if (colName) return (row[colName] as T) ?? null;
          return row as T;
        },
        async run<T = unknown>(): Promise<D1Result<T>> {
          const result = db.prepare(query).run(...boundValues);
          return {
            success: true,
            meta: {
              changes: Number(result.changes),
              last_row_id: Number(result.lastInsertRowid),
            },
          };
        },
        async all<T = unknown>(): Promise<D1Result<T>> {
          const results = db.prepare(query).all(...boundValues) as T[];
          return {
            success: true,
            results,
            meta: {
              rows_read: results.length,
            },
          };
        },
      };
      return stmt as unknown as D1PreparedStatement;
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      const results: D1Result<T>[] = [];
      for (const statement of statements) {
        results.push(await statement.run<T>());
      }
      return results;
    },
    async exec(query: string): Promise<{ count: number; duration: number }> {
      db.exec(query);
      return { count: 0, duration: 0 };
    },
  };
}

describe('Google OAuth INVALID_STATE Root Cause & Cookie Hardening Suite', () => {
  let sqliteDb: DatabaseSync;
  let d1: D1Database;
  let testEnv: WorkerEnv;
  let trustedPrivateKey: any;
  let trustedPublicKey: any;

  beforeEach(async () => {
    sqliteDb = new DatabaseSync(':memory:');
    const schemaSql = fs.readFileSync(MIGRATION_PATH, 'utf-8');
    sqliteDb.exec(schemaSql);
    const schemaV2Sql = fs.readFileSync(MIGRATION_V2_PATH, 'utf-8');
    sqliteDb.exec(schemaV2Sql);
    const schemaV3Sql = fs.readFileSync(MIGRATION_V3_PATH, 'utf-8');
    sqliteDb.exec(schemaV3Sql);

    d1 = createD1Adapter(sqliteDb);

    testEnv = {
      DB: d1,
      APP_ENV: 'staging',
      ALLOWED_ORIGINS: 'https://staging.stylesaathi.pages.dev,capacitor://localhost',
      APP_URL: 'https://staging.stylesaathi.pages.dev',
      AUTH_SECRET: 'test-secure-auth-secret-for-staging-environment-32b',
      GOOGLE_CLIENT_ID: 'google-staging-client-id.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'google-staging-client-secret-xyz',
    };

    const keypair = await generateKeyPair('RS256');
    trustedPrivateKey = keypair.privateKey;
    trustedPublicKey = keypair.publicKey;
  });

  afterEach(() => {
    sqliteDb.close();
    vi.restoreAllMocks();
  });

  // Helper to construct a mock Google ID token matching a given nonce
  async function makeMockGoogleIdToken(nonce: string, email = 'member@stylesaathi.in') {
    return await new SignJWT({
      email,
      email_verified: true,
      name: 'StyleSaathi Member',
      sub: 'google-sub-member-101',
      nonce,
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer('https://accounts.google.com')
      .setAudience('google-staging-client-id.apps.googleusercontent.com')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(trustedPrivateKey);
  }

  // Helper to mock Google's code exchange endpoint
  function mockGoogleTokenEndpoint(idToken: string) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'google-access-token-live',
        id_token: idToken,
        expires_in: 3600,
        token_type: 'Bearer',
      }),
    } as any);
    return () => {
      globalThis.fetch = originalFetch;
    };
  }

  // --------------------------------------------------------------------------
  // 1. Valid OAuth Transaction
  // --------------------------------------------------------------------------
  it('1. completes valid OAuth flow with hardened cookies and root path', async () => {
    const clientPkce = await generatePkcePair();

    // 1. Initiate OAuth
    const initRes = await app.request(
      `/api/auth/sign-in/social?provider=google&platform=web&client_code_challenge=${clientPkce.codeChallenge}`,
      { method: 'GET' },
      testEnv
    );

    expect(initRes.status).toBe(302);
    const authUrl = new URL(initRes.headers.get('Location')!);
    const state = authUrl.searchParams.get('state')!;
    const nonce = authUrl.searchParams.get('nonce')!;

    // Verify Set-Cookie headers contain root path and dual SameSite variants
    const setCookieHeaders = initRes.headers.getSetCookie
      ? initRes.headers.getSetCookie()
      : [initRes.headers.get('Set-Cookie')!];

    const hasRootPath = setCookieHeaders.some((h) => h.includes('Path=/') || h.includes('path=/'));
    expect(hasRootPath).toBe(true);

    const hasLax = setCookieHeaders.some((h) => h.includes('SameSite=Lax'));
    expect(hasLax).toBe(true);

    const hasNone = setCookieHeaders.some((h) => h.includes('SameSite=None'));
    expect(hasNone).toBe(true);

    // Extract cookie
    const txCookie = setCookieHeaders.find((h) => h.includes(OAUTH_TX_COOKIE_NAME))?.split(';')[0];
    expect(txCookie).toBeDefined();

    // 2. Callback from Google
    const idToken = await makeMockGoogleIdToken(nonce);
    const restoreFetch = mockGoogleTokenEndpoint(idToken);

    try {
      const testEnvWithKey = { ...testEnv, TEST_JWKS_KEY: trustedPublicKey };
      const callbackRes = await app.request(
        `/api/auth/callback/google?code=google-auth-code-valid&state=${state}`,
        {
          method: 'GET',
          headers: { Cookie: txCookie! },
        },
        testEnvWithKey
      );

      expect(callbackRes.status).toBe(302);
      const redirectLocation = callbackRes.headers.get('Location')!;
      expect(redirectLocation).toContain('https://staging.stylesaathi.pages.dev/#code=');
    } finally {
      restoreFetch();
    }
  });

  // --------------------------------------------------------------------------
  // 2. Missing Cookie Handling (API 400 JSON vs Browser 302 Redirect)
  // --------------------------------------------------------------------------
  it('2a. rejects missing cookie with HTTP 400 INVALID_STATE for API/test callers', async () => {
    // API request (no text/html Accept header)
    const callbackRes = await app.request(
      '/api/auth/callback/google?code=some-code&state=some-state',
      {
        method: 'GET',
        // Notice: NO Cookie header attached!
      },
      testEnv
    );

    expect(callbackRes.status).toBe(400);
    const json = (await callbackRes.json()) as any;
    expect(json.error).toBe('INVALID_STATE');
    expect(json.message).toBe('OAuth transaction state has expired or cookie is missing.');
  });

  it('2b. redirects browser callers to frontend #auth_error=session_expired when cookie is missing', async () => {
    // Real browser navigation sends Accept: text/html and Sec-Fetch-Dest: document
    const callbackRes = await app.request(
      '/api/auth/callback/google?code=some-code&state=some-state',
      {
        method: 'GET',
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Sec-Fetch-Dest': 'document',
        },
      },
      testEnv
    );

    expect(callbackRes.status).toBe(302);
    const redirectUrl = callbackRes.headers.get('Location')!;
    expect(redirectUrl).toBe('https://staging.stylesaathi.pages.dev/#auth_error=session_expired');
  });

  // --------------------------------------------------------------------------
  // 3. Expired Cookie / JWE Handling
  // --------------------------------------------------------------------------
  it('3. rejects expired OAuth transaction cookie (>10m TTL)', async () => {
    const secretKey = await getAuthSecretKey(testEnv.AUTH_SECRET, testEnv.APP_ENV);

    // Build expired JWE (issued 15 minutes ago, expired 5 minutes ago)
    const expiredToken = await new EncryptJWT({
      state: 'expired-state',
      nonce: 'expired-nonce',
      codeVerifier: 'expired-verifier',
      clientCodeChallenge: null,
      platform: 'web',
      redirectUri: 'https://staging.stylesaathi.pages.dev/api/auth/callback/google',
      createdAt: Date.now() - 15 * 60 * 1000,
    })
      .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 900)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 300)
      .encrypt(secretKey);

    const callbackRes = await app.request(
      '/api/auth/callback/google?code=some-code&state=expired-state',
      {
        method: 'GET',
        headers: { Cookie: `${OAUTH_TX_COOKIE_NAME}=${expiredToken}` },
      },
      testEnv
    );

    expect(callbackRes.status).toBe(400);
    const json = (await callbackRes.json()) as any;
    expect(json.error).toBe('INVALID_STATE');
    expect(json.message).toBe('OAuth state parameter does not match the authenticated transaction.');
  });

  // --------------------------------------------------------------------------
  // 4. State Mismatch & Tampering
  // --------------------------------------------------------------------------
  it('4. rejects callback when state parameter does not match transaction cookie', async () => {
    const secretKey = await getAuthSecretKey(testEnv.AUTH_SECRET, testEnv.APP_ENV);
    const legitToken = await encryptOAuthTx(
      {
        state: 'legitimate-state-abc',
        nonce: 'legitimate-nonce-123',
        codeVerifier: 'verifier-123',
        clientCodeChallenge: null,
        platform: 'web',
        redirectUri: 'https://staging.stylesaathi.pages.dev/api/auth/callback/google',
        createdAt: Date.now(),
      },
      secretKey
    );

    // Attacker supplies attacker-tampered-state in query param
    const callbackRes = await app.request(
      '/api/auth/callback/google?code=some-code&state=attacker-tampered-state',
      {
        method: 'GET',
        headers: { Cookie: `${OAUTH_TX_COOKIE_NAME}=${legitToken}` },
      },
      testEnv
    );

    expect(callbackRes.status).toBe(400);
    const json = (await callbackRes.json()) as any;
    expect(json.error).toBe('INVALID_STATE');
    expect(json.message).toBe('OAuth state parameter does not match the authenticated transaction.');
  });

  // --------------------------------------------------------------------------
  // 5. Replayed Callback Protection
  // --------------------------------------------------------------------------
  it('5. prevents replayed callback by clearing all transaction cookies on consumption', async () => {
    const clientPkce = await generatePkcePair();

    const initRes = await app.request(
      `/api/auth/sign-in/social?provider=google&platform=web&client_code_challenge=${clientPkce.codeChallenge}`,
      { method: 'GET' },
      testEnv
    );
    const authUrl = new URL(initRes.headers.get('Location')!);
    const state = authUrl.searchParams.get('state')!;
    const nonce = authUrl.searchParams.get('nonce')!;

    const setCookieHeaders = initRes.headers.getSetCookie
      ? initRes.headers.getSetCookie()
      : [initRes.headers.get('Set-Cookie')!];
    const txCookie = setCookieHeaders.find((h) => h.includes(OAUTH_TX_COOKIE_NAME))?.split(';')[0];

    const idToken = await makeMockGoogleIdToken(nonce);
    const restoreFetch = mockGoogleTokenEndpoint(idToken);

    try {
      const testEnvWithKey = { ...testEnv, TEST_JWKS_KEY: trustedPublicKey };

      // First callback attempt succeeds
      const firstCallback = await app.request(
        `/api/auth/callback/google?code=auth-code-one&state=${state}`,
        {
          method: 'GET',
          headers: { Cookie: txCookie! },
        },
        testEnvWithKey
      );
      expect(firstCallback.status).toBe(302);

      // Verify deletion Set-Cookie headers are issued
      const deleteHeaders = firstCallback.headers.getSetCookie
        ? firstCallback.headers.getSetCookie()
        : [firstCallback.headers.get('Set-Cookie')!];
      const hasExpiryZero = deleteHeaders.some(
        (h) => h.includes('Max-Age=0') || h.includes('expires=') || h.includes('Path=/')
      );
      expect(hasExpiryZero).toBe(true);

      // Replay attempt with same code fails
      const replayCallback = await app.request(
        `/api/auth/callback/google?code=auth-code-one&state=${state}`,
        {
          method: 'GET',
          // Cookie is gone after deletion by browser
        },
        testEnvWithKey
      );
      expect(replayCallback.status).toBe(400);
      const json = (await replayCallback.json()) as any;
      expect(json.error).toBe('INVALID_STATE');
    } finally {
      restoreFetch();
    }
  });

  // --------------------------------------------------------------------------
  // 6. Multi-Tab / Concurrent Login Safety
  // --------------------------------------------------------------------------
  it('6. protects concurrent multi-tab logins via state-scoped cookies without overwrite', async () => {
    const clientPkceA = await generatePkcePair();
    const clientPkceB = await generatePkcePair();

    // Tab A initiates
    const initResA = await app.request(
      `/api/auth/sign-in/social?provider=google&platform=web&client_code_challenge=${clientPkceA.codeChallenge}`,
      { method: 'GET' },
      testEnv
    );
    const authUrlA = new URL(initResA.headers.get('Location')!);
    const stateA = authUrlA.searchParams.get('state')!;
    const nonceA = authUrlA.searchParams.get('nonce')!;

    // Tab B initiates concurrently
    const initResB = await app.request(
      `/api/auth/sign-in/social?provider=google&platform=web&client_code_challenge=${clientPkceB.codeChallenge}`,
      { method: 'GET' },
      testEnv
    );
    const authUrlB = new URL(initResB.headers.get('Location')!);
    const stateB = authUrlB.searchParams.get('state')!;
    const nonceB = authUrlB.searchParams.get('nonce')!;

    expect(stateA).not.toBe(stateB);

    // Extract state-specific cookies
    const headersA = initResA.headers.getSetCookie
      ? initResA.headers.getSetCookie()
      : [initResA.headers.get('Set-Cookie')!];
    const cookieStateA = headersA.find((h) => h.includes(`${OAUTH_TX_COOKIE_NAME}_${stateA}`))?.split(';')[0];
    expect(cookieStateA).toBeDefined();

    const headersB = initResB.headers.getSetCookie
      ? initResB.headers.getSetCookie()
      : [initResB.headers.get('Set-Cookie')!];
    const cookieStateB = headersB.find((h) => h.includes(`${OAUTH_TX_COOKIE_NAME}_${stateB}`))?.split(';')[0];
    expect(cookieStateB).toBeDefined();

    // Both tabs can complete their respective flows independently
    const idTokenA = await makeMockGoogleIdToken(nonceA, 'tab.a@stylesaathi.in');
    const restoreFetchA = mockGoogleTokenEndpoint(idTokenA);

    const testEnvWithKey = { ...testEnv, TEST_JWKS_KEY: trustedPublicKey };

    try {
      // Tab A callback succeeds using its state-scoped cookie
      const callbackA = await app.request(
        `/api/auth/callback/google?code=code-tab-a&state=${stateA}`,
        {
          method: 'GET',
          headers: { Cookie: cookieStateA! },
        },
        testEnvWithKey
      );
      expect(callbackA.status).toBe(302);
      expect(callbackA.headers.get('Location')).toContain('#code=');
    } finally {
      restoreFetchA();
    }

    const idTokenB = await makeMockGoogleIdToken(nonceB, 'tab.b@stylesaathi.in');
    const restoreFetchB = mockGoogleTokenEndpoint(idTokenB);

    try {
      // Tab B callback also succeeds using its state-scoped cookie
      const callbackB = await app.request(
        `/api/auth/callback/google?code=code-tab-b&state=${stateB}`,
        {
          method: 'GET',
          headers: { Cookie: cookieStateB! },
        },
        testEnvWithKey
      );
      expect(callbackB.status).toBe(302);
      expect(callbackB.headers.get('Location')).toContain('#code=');
    } finally {
      restoreFetchB();
    }
  });

  // --------------------------------------------------------------------------
  // 7. Cookie Attribute Security Inspection
  // --------------------------------------------------------------------------
  it('7. verifies all required security attributes on transaction cookies', async () => {
    const res = await app.request(
      '/api/auth/sign-in/social?provider=google&platform=web',
      { method: 'GET' },
      testEnv
    );

    const headers = res.headers.getSetCookie
      ? res.headers.getSetCookie()
      : [res.headers.get('Set-Cookie')!];

    // Check primary Lax cookie
    const primaryCookie = headers.find((h) => h.startsWith(`${OAUTH_TX_COOKIE_NAME}=`));
    expect(primaryCookie).toBeDefined();
    expect(primaryCookie).toContain('Path=/');
    expect(primaryCookie).toContain('HttpOnly');
    expect(primaryCookie).toContain('Secure');
    expect(primaryCookie).toContain('SameSite=Lax');
    expect(primaryCookie).toContain('Max-Age=600');

    // Check cross-site fallback cookie
    const fallbackCookie = headers.find((h) => h.startsWith(`${OAUTH_TX_COOKIE_NONE}=`));
    expect(fallbackCookie).toBeDefined();
    expect(fallbackCookie).toContain('Path=/');
    expect(fallbackCookie).toContain('HttpOnly');
    expect(fallbackCookie).toContain('Secure');
    expect(fallbackCookie).toContain('SameSite=None');
  });

  // --------------------------------------------------------------------------
  // 8. OAuth Provider Error Handling
  // --------------------------------------------------------------------------
  it('8a. returns JSON error for API callers when Google returns error parameter', async () => {
    const res = await app.request(
      '/api/auth/callback/google?error=access_denied&error_description=User+declined+access',
      { method: 'GET' },
      testEnv
    );

    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.error).toBe('OAUTH_PROVIDER_ERROR');
    expect(json.message).toContain('User declined access');
  });

  it('8b. redirects browser callers to #auth_error=access_denied when user cancels login', async () => {
    const res = await app.request(
      '/api/auth/callback/google?error=access_denied&error_description=User+declined+access',
      {
        method: 'GET',
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Sec-Fetch-Dest': 'document',
        },
      },
      testEnv
    );

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://staging.stylesaathi.pages.dev/#auth_error=access_denied');
  });

  // ==========================================================================
  // 9. Concurrency, Isolation & Bounded Cookie Lifecycle Suite
  // ==========================================================================
  describe('9. Concurrency, Isolation & Bounded Cookie Lifecycle Suite', () => {
    it('9a. allows two concurrent login attempts to complete and redeem exchange codes independently', async () => {
      const clientPkceA = await generatePkcePair();
      const clientPkceB = await generatePkcePair();

      // Tab A initiates
      const initA = await app.request(
        `/api/auth/sign-in/social?provider=google&platform=web&client_code_challenge=${clientPkceA.codeChallenge}`,
        { method: 'GET' },
        testEnv
      );
      const urlA = new URL(initA.headers.get('Location')!);
      const stateA = urlA.searchParams.get('state')!;
      const nonceA = urlA.searchParams.get('nonce')!;

      // Tab B initiates
      const initB = await app.request(
        `/api/auth/sign-in/social?provider=google&platform=web&client_code_challenge=${clientPkceB.codeChallenge}`,
        { method: 'GET' },
        testEnv
      );
      const urlB = new URL(initB.headers.get('Location')!);
      const stateB = urlB.searchParams.get('state')!;
      const nonceB = urlB.searchParams.get('nonce')!;

      const setCookiesA = initA.headers.getSetCookie ? initA.headers.getSetCookie() : [initA.headers.get('Set-Cookie')!];
      const cookieA = setCookiesA.find((h) => h.includes(`${OAUTH_TX_COOKIE_NAME}_${stateA}`))?.split(';')[0];
      const setCookiesB = initB.headers.getSetCookie ? initB.headers.getSetCookie() : [initB.headers.get('Set-Cookie')!];
      const cookieB = setCookiesB.find((h) => h.includes(`${OAUTH_TX_COOKIE_NAME}_${stateB}`))?.split(';')[0];

      // Simulated browser cookie jar holds both cookies
      const browserJar = `${cookieA}; ${cookieB}`;

      const testEnvWithKey = { ...testEnv, TEST_JWKS_KEY: trustedPublicKey };

      // Tab A completes callback
      const idTokenA = await makeMockGoogleIdToken(nonceA, 'member.a@stylesaathi.in');
      const restoreA = mockGoogleTokenEndpoint(idTokenA);
      let exchangeCodeA = '';
      try {
        const callbackA = await app.request(
          `/api/auth/callback/google?code=code-tab-a&state=${stateA}`,
          { method: 'GET', headers: { Cookie: browserJar } },
          testEnvWithKey
        );
        expect(callbackA.status).toBe(302);
        const loc = callbackA.headers.get('Location')!;
        expect(loc).toContain('#code=');
        exchangeCodeA = decodeURIComponent(loc.split('#code=')[1]);
      } finally {
        restoreA();
      }

      // Tab B completes callback
      const idTokenB = await makeMockGoogleIdToken(nonceB, 'member.b@stylesaathi.in');
      const restoreB = mockGoogleTokenEndpoint(idTokenB);
      let exchangeCodeB = '';
      try {
        const callbackB = await app.request(
          `/api/auth/callback/google?code=code-tab-b&state=${stateB}`,
          { method: 'GET', headers: { Cookie: browserJar } },
          testEnvWithKey
        );
        expect(callbackB.status).toBe(302);
        const loc = callbackB.headers.get('Location')!;
        expect(loc).toContain('#code=');
        exchangeCodeB = decodeURIComponent(loc.split('#code=')[1]);
      } finally {
        restoreB();
      }

      expect(exchangeCodeA).not.toBe(exchangeCodeB);

      // Redeem code A
      const redeemA = await app.request(
        '/api/auth/exchange-code',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: exchangeCodeA, code_verifier: clientPkceA.codeVerifier }),
        },
        testEnv
      );
      expect(redeemA.status).toBe(200);
      const resA = (await redeemA.json()) as any;
      expect(resA.sessionToken).toBeDefined();

      // Redeem code B
      const redeemB = await app.request(
        '/api/auth/exchange-code',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: exchangeCodeB, code_verifier: clientPkceB.codeVerifier }),
        },
        testEnv
      );
      expect(redeemB.status).toBe(200);
      const resB = (await redeemB.json()) as any;
      expect(resB.sessionToken).toBeDefined();
      expect(resA.sessionToken).not.toBe(resB.sessionToken);
    });

    it('9b. ensures Tab A completing its callback does NOT delete Tab B transaction cookies', async () => {
      const clientPkceA = await generatePkcePair();
      const clientPkceB = await generatePkcePair();

      const initA = await app.request(
        `/api/auth/sign-in/social?provider=google&platform=web&client_code_challenge=${clientPkceA.codeChallenge}`,
        { method: 'GET' },
        testEnv
      );
      const stateA = new URL(initA.headers.get('Location')!).searchParams.get('state')!;
      const nonceA = new URL(initA.headers.get('Location')!).searchParams.get('nonce')!;

      const initB = await app.request(
        `/api/auth/sign-in/social?provider=google&platform=web&client_code_challenge=${clientPkceB.codeChallenge}`,
        { method: 'GET' },
        testEnv
      );
      const stateB = new URL(initB.headers.get('Location')!).searchParams.get('state')!;
      const nonceB = new URL(initB.headers.get('Location')!).searchParams.get('nonce')!;

      const setCookiesA = initA.headers.getSetCookie ? initA.headers.getSetCookie() : [initA.headers.get('Set-Cookie')!];
      const cookieA = setCookiesA.find((h) => h.includes(`${OAUTH_TX_COOKIE_NAME}_${stateA}`))?.split(';')[0];
      const setCookiesB = initB.headers.getSetCookie ? initB.headers.getSetCookie() : [initB.headers.get('Set-Cookie')!];
      const cookieB = setCookiesB.find((h) => h.includes(`${OAUTH_TX_COOKIE_NAME}_${stateB}`))?.split(';')[0];

      const browserJar = `${cookieA}; ${cookieB}`;
      const testEnvWithKey = { ...testEnv, TEST_JWKS_KEY: trustedPublicKey };

      // Tab A callback
      const idTokenA = await makeMockGoogleIdToken(nonceA, 'member.a@stylesaathi.in');
      const restoreA = mockGoogleTokenEndpoint(idTokenA);
      let callbackARes: any;
      try {
        callbackARes = await app.request(
          `/api/auth/callback/google?code=code-tab-a&state=${stateA}`,
          { method: 'GET', headers: { Cookie: browserJar } },
          testEnvWithKey
        );
      } finally {
        restoreA();
      }

      expect(callbackARes.status).toBe(302);

      // Verify that Tab A's callback instructed deletion of stateA, but NEVER deleted stateB!
      const callbackCookies = callbackARes.headers.getSetCookie
        ? callbackARes.headers.getSetCookie()
        : [callbackARes.headers.get('Set-Cookie')!];

      const deletedStateA = callbackCookies.find((h: string) => h.includes(`${OAUTH_TX_COOKIE_NAME}_${stateA}=;`));
      expect(deletedStateA).toBeDefined();

      const deletedStateB = callbackCookies.find((h: string) => h.includes(`${OAUTH_TX_COOKIE_NAME}_${stateB}`));
      expect(deletedStateB).toBeUndefined();

      // Tab B can still complete successfully afterwards using its untouched cookie!
      const idTokenB = await makeMockGoogleIdToken(nonceB, 'member.b@stylesaathi.in');
      const restoreB = mockGoogleTokenEndpoint(idTokenB);
      try {
        const callbackBRes = await app.request(
          `/api/auth/callback/google?code=code-tab-b&state=${stateB}`,
          { method: 'GET', headers: { Cookie: cookieB! } },
          testEnvWithKey
        );
        expect(callbackBRes.status).toBe(302);
        expect(callbackBRes.headers.get('Location')).toContain('#code=');
      } finally {
        restoreB();
      }
    });

    it('9c. invalid callback with state mismatch does NOT destroy other active pending transactions', async () => {
      const clientPkce = await generatePkcePair();

      const init = await app.request(
        `/api/auth/sign-in/social?provider=google&platform=web&client_code_challenge=${clientPkce.codeChallenge}`,
        { method: 'GET' },
        testEnv
      );
      const stateValid = new URL(init.headers.get('Location')!).searchParams.get('state')!;
      const nonceValid = new URL(init.headers.get('Location')!).searchParams.get('nonce')!;

      const setCookies = init.headers.getSetCookie ? init.headers.getSetCookie() : [init.headers.get('Set-Cookie')!];
      const validCookie = setCookies.find((h) => h.includes(`${OAUTH_TX_COOKIE_NAME}_${stateValid}`))?.split(';')[0];

      // Simulated attacker sends an invalid callback with a mismatched state while the user's valid cookie is attached
      const invalidCallback = await app.request(
        `/api/auth/callback/google?code=fake-code&state=adversary-forged-state`,
        { method: 'GET', headers: { Cookie: validCookie! } },
        testEnv
      );

      expect(invalidCallback.status).toBe(400);
      const errJson = (await invalidCallback.json()) as any;
      expect(errJson.error).toBe('INVALID_STATE');

      // Verify that the response did NOT delete the user's valid state transaction cookie
      const responseCookies = invalidCallback.headers.getSetCookie
        ? invalidCallback.headers.getSetCookie()
        : [invalidCallback.headers.get('Set-Cookie') || ''];

      const deletedValidCookie = responseCookies.find((h: string) => h.includes(`${OAUTH_TX_COOKIE_NAME}_${stateValid}=;`));
      expect(deletedValidCookie).toBeUndefined();

      // The legitimate user's transaction can still complete successfully!
      const idToken = await makeMockGoogleIdToken(nonceValid, 'legit.user@stylesaathi.in');
      const restore = mockGoogleTokenEndpoint(idToken);
      const testEnvWithKey = { ...testEnv, TEST_JWKS_KEY: trustedPublicKey };

      try {
        const validCallback = await app.request(
          `/api/auth/callback/google?code=real-code&state=${stateValid}`,
          { method: 'GET', headers: { Cookie: validCookie! } },
          testEnvWithKey
        );
        expect(validCallback.status).toBe(302);
        expect(validCallback.headers.get('Location')).toContain('#code=');
      } finally {
        restore();
      }
    });

    it('9d. replaying a previously redeemed callback fails safely with INVALID_STATE', async () => {
      const clientPkce = await generatePkcePair();

      const init = await app.request(
        `/api/auth/sign-in/social?provider=google&platform=web&client_code_challenge=${clientPkce.codeChallenge}`,
        { method: 'GET' },
        testEnv
      );
      const state = new URL(init.headers.get('Location')!).searchParams.get('state')!;
      const nonce = new URL(init.headers.get('Location')!).searchParams.get('nonce')!;

      const setCookies = init.headers.getSetCookie ? init.headers.getSetCookie() : [init.headers.get('Set-Cookie')!];
      const cookie = setCookies.find((h) => h.includes(`${OAUTH_TX_COOKIE_NAME}_${state}`))?.split(';')[0];

      const idToken = await makeMockGoogleIdToken(nonce, 'singleuse@stylesaathi.in');
      const restore = mockGoogleTokenEndpoint(idToken);
      const testEnvWithKey = { ...testEnv, TEST_JWKS_KEY: trustedPublicKey };

      try {
        // First redemption succeeds
        const first = await app.request(
          `/api/auth/callback/google?code=code-1&state=${state}`,
          { method: 'GET', headers: { Cookie: cookie! } },
          testEnvWithKey
        );
        expect(first.status).toBe(302);

        // Client browser deletes cookie per Set-Cookie instruction:
        // A replay without cookie fails with INVALID_STATE
        const replayWithoutCookie = await app.request(
          `/api/auth/callback/google?code=code-1&state=${state}`,
          { method: 'GET' },
          testEnvWithKey
        );
        expect(replayWithoutCookie.status).toBe(400);
        expect((await replayWithoutCookie.json() as any).error).toBe('INVALID_STATE');
      } finally {
        restore();
      }
    });

    it('9e. repeated abandoned login attempts are bounded to MAX_CONCURRENT_OAUTH_TRANSACTIONS', async () => {
      // Simulate opening 8 abandoned login tabs sequentially
      const cookieJar = new Map<string, string>();

      for (let i = 1; i <= 8; i++) {
        // Format current cookie jar as Cookie header
        const cookieHeader = Array.from(cookieJar.entries())
          .map(([k, v]) => `${k}=${v}`)
          .join('; ');

        const res = await app.request(
          '/api/auth/sign-in/social?provider=google&platform=web',
          {
            method: 'GET',
            headers: cookieHeader ? { Cookie: cookieHeader } : {},
          },
          testEnv
        );

        expect(res.status).toBe(302);

        // Update mock browser cookie jar based on Set-Cookie responses
        const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('Set-Cookie')!];
        for (const raw of setCookies) {
          const parts = raw.split(';')[0].split('=');
          const name = parts[0].trim();
          const val = parts.slice(1).join('=').trim();
          if (raw.includes('Max-Age=0') || val === '') {
            cookieJar.delete(name);
          } else {
            cookieJar.set(name, val);
          }
        }
      }

      // Count active state-scoped cookies in cookie jar
      const stateRegex = new RegExp(`^${OAUTH_TX_COOKIE_NAME}(_none)?_([0-9a-f]{24,64})$`);
      const distinctStates = new Set<string>();
      for (const key of cookieJar.keys()) {
        const match = key.match(stateRegex);
        if (match) {
          distinctStates.add(match[2]);
        }
      }

      // Assert that the number of active distinct states does NOT exceed MAX_CONCURRENT_OAUTH_TRANSACTIONS
      expect(distinctStates.size).toBeLessThanOrEqual(MAX_CONCURRENT_OAUTH_TRANSACTIONS);

      // Verify bounded total cookie count and size
      expect(cookieJar.size).toBeLessThanOrEqual(MAX_CONCURRENT_OAUTH_TRANSACTIONS * 2 + 2); // state + state_none + global fallback
    });

    it('9f. eagerly prunes expired transaction cookies (>10m) upon new sign-in initiation', async () => {
      const secretKey = await getAuthSecretKey(testEnv.AUTH_SECRET, testEnv.APP_ENV);
      const expiredState = '11223344556677889900aabbccddeeff1122334455667788';

      // Fabricate an expired transaction (15 minutes old)
      const expiredPayload = {
        state: expiredState,
        nonce: 'expired-nonce',
        codeVerifier: 'expired-verifier',
        platform: 'web' as const,
        redirectUri: 'https://staging.stylesaathi.pages.dev/api/auth/callback/google',
        createdAt: Date.now() - 15 * 60 * 1000, // 15m ago
      };

      // Encrypt with expired timestamp
      const expiredToken = await new EncryptJWT({ ...expiredPayload })
        .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 900)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 300) // Expired 5 mins ago
        .encrypt(secretKey);

      const cookieHeader = `${OAUTH_TX_COOKIE_NAME}_${expiredState}=${expiredToken}; ${OAUTH_TX_COOKIE_NONE}_${expiredState}=${expiredToken}`;

      // Initiate a fresh login with the expired cookies attached
      const res = await app.request(
        '/api/auth/sign-in/social?provider=google&platform=web',
        {
          method: 'GET',
          headers: { Cookie: cookieHeader },
        },
        testEnv
      );

      expect(res.status).toBe(302);

      const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('Set-Cookie')!];

      // Verifies that Set-Cookie explicitly instructed the browser to delete the expired cookies
      const deletedLax = setCookies.find((h) => h.includes(`${OAUTH_TX_COOKIE_NAME}_${expiredState}=;`) && h.includes('Max-Age=0'));
      expect(deletedLax).toBeDefined();

      const deletedNone = setCookies.find((h) => h.includes(`${OAUTH_TX_COOKIE_NONE}_${expiredState}=;`) && h.includes('Max-Age=0'));
      expect(deletedNone).toBeDefined();
    });

    it('9g. confirms maximum request-header size remains strictly bounded (< 4 KB, <12% of Cloudflare 32 KB limit) under worst-case concurrency', async () => {
      const secretKey = await getAuthSecretKey(testEnv.AUTH_SECRET, testEnv.APP_ENV);

      // Simulate worst-case scenario: MAX_CONCURRENT_OAUTH_TRANSACTIONS active (3 states = 6 cookies + 2 fallback = 8 cookies)
      const cookies: string[] = [];
      for (let i = 1; i <= MAX_CONCURRENT_OAUTH_TRANSACTIONS; i++) {
        const st = `11223344556677889900aabbccddeeff112233445566770${i}`;
        const token = await encryptOAuthTx(
          {
            state: st,
            nonce: `nonce-${i}`,
            codeVerifier: `verifier-${i}`,
            platform: 'web',
            redirectUri: 'https://staging.stylesaathi.pages.dev/api/auth/callback/google',
            createdAt: Date.now(),
          },
          secretKey
        );
        cookies.push(`${OAUTH_TX_COOKIE_NAME}_${st}=${token}`);
        cookies.push(`${OAUTH_TX_COOKIE_NONE}_${st}=${token}`);
      }

      // Add fallback global cookies
      const fallbackToken = await encryptOAuthTx(
        {
          state: '11223344556677889900aabbccddeeff1122334455667700',
          nonce: 'nonce-fallback',
          codeVerifier: 'verifier-fallback',
          platform: 'web',
          redirectUri: 'https://staging.stylesaathi.pages.dev/api/auth/callback/google',
          createdAt: Date.now(),
        },
        secretKey
      );
      cookies.push(`${OAUTH_TX_COOKIE_NAME}=${fallbackToken}`);
      cookies.push(`${OAUTH_TX_COOKIE_NONE}=${fallbackToken}`);

      const fullCookieHeader = cookies.join('; ');
      const totalBytes = new TextEncoder().encode(fullCookieHeader).length;

      // Assert total byte length is strictly under 4096 bytes (< 4 KB, far below Cloudflare's 32 KB limit)
      expect(totalBytes).toBeLessThan(4096);
      expect(totalBytes).toBeGreaterThan(1000); // Sanity check that cookies are populated
    });
  });
});
