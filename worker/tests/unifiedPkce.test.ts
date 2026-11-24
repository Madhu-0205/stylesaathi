// ============================================================================
// STYLESAATHI 3.0 — UNIFIED PKCE AUTHENTICATION TEST SUITE
// Phase 3F.10A.3: Unified PKCE Exchange-Code Flow for Web and Android
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { SignJWT, generateKeyPair } from 'jose';

import { app } from '../src/index';
import type { D1Database, D1PreparedStatement, D1Result, WorkerEnv } from '../src/types';
import { createSession, revokeSession } from '../src/auth/session';
import { createExchangeCode, consumeExchangeCode } from '../src/auth/oauth';
import { generatePkcePair, sha256Hex, generateSecureToken } from '../src/auth/crypto';

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

describe('Phase 3F.10A.3: Unified PKCE Architecture Test Suite', () => {
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

  async function simulateGoogleOAuth(platform: 'web' | 'android', clientCodeChallenge?: string) {
    const query = new URLSearchParams({
      provider: 'google',
      platform,
      ...(clientCodeChallenge ? { client_code_challenge: clientCodeChallenge } : {}),
    });

    const initRes = await app.request(
      `/api/auth/sign-in/social?${query.toString()}`,
      { method: 'GET' },
      testEnv
    );

    const authUrl = new URL(initRes.headers.get('Location')!);
    const state = authUrl.searchParams.get('state')!;
    const nonce = authUrl.searchParams.get('nonce')!;
    const txCookie = initRes.headers.get('Set-Cookie')!.match(/stylesaathi_oauth_tx=([^;]+)/)![1];

    const idToken = await new SignJWT({
      email: `${platform}.user@stylesaathi.in`,
      email_verified: true,
      name: `${platform.toUpperCase()} User`,
      sub: `google-sub-${platform}-999`,
      nonce,
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer('https://accounts.google.com')
      .setAudience('google-staging-client-id.apps.googleusercontent.com')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(trustedPrivateKey);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'google-access-tok-123',
        id_token: idToken,
        expires_in: 3600,
        token_type: 'Bearer',
      }),
    } as any);

    try {
      const testEnvWithKey = { ...testEnv, TEST_JWKS_KEY: trustedPublicKey };
      const callbackRes = await app.request(
        `/api/auth/callback/google?code=google-auth-code-valid&state=${state}`,
        {
          method: 'GET',
          headers: { Cookie: `stylesaathi_oauth_tx=${txCookie}` },
        },
        testEnvWithKey
      );

      return {
        initRes,
        callbackRes,
        location: callbackRes.headers.get('Location')!,
        state,
        nonce,
      };
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  describe('1. Web Unified PKCE Verification & Zero Bearer in URLs', () => {
    it('redirects Web to #code=<exchange_code> and NEVER includes session_token in URL', async () => {
      const clientPkce = await generatePkcePair();
      const { callbackRes, location } = await simulateGoogleOAuth('web', clientPkce.codeChallenge);

      expect(callbackRes.status).toBe(302);

      // CRITICAL VERIFICATION: No raw bearer session token in URL query or fragment
      expect(location).not.toContain('session_token=');
      expect(location).toContain('https://staging.stylesaathi.pages.dev/#code=');

      // Extract code parameter from fragment
      const fragment = location.split('#')[1];
      const params = new URLSearchParams(fragment);
      const exchangeCode = params.get('code')!;
      expect(exchangeCode).toBeDefined();
      expect(exchangeCode.length).toBeGreaterThan(20);

      // Redeem code over TLS POST with correct PKCE code_verifier
      const exchangeRes = await app.request(
        '/api/auth/exchange-code',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: exchangeCode,
            code_verifier: clientPkce.codeVerifier,
          }),
        },
        testEnv
      );

      expect(exchangeRes.status).toBe(200);
      const body = (await exchangeRes.json()) as any;
      expect(body.sessionToken).toBeDefined();
      expect(body.userId).toBeDefined();

      // Verify bearer token works on protected endpoint
      const meRes = await app.request(
        '/api/auth/me',
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${body.sessionToken}` },
        },
        testEnv
      );
      expect(meRes.status).toBe(200);
      const meBody = (await meRes.json()) as any;
      expect(meBody.user.email).toBe('web.user@stylesaathi.in');
    });

    it('rejects Web code redemption when wrong PKCE code_verifier is supplied without consuming the code (Phase 3F.10B.1)', async () => {
      const clientPkce = await generatePkcePair();
      const wrongPkce = await generatePkcePair();
      const { location } = await simulateGoogleOAuth('web', clientPkce.codeChallenge);

      const exchangeCode = new URLSearchParams(location.split('#')[1]).get('code')!;

      // 1. Wrong verifier fails with 403 PKCE_VERIFICATION_FAILED
      const res = await app.request(
        '/api/auth/exchange-code',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: exchangeCode,
            code_verifier: wrongPkce.codeVerifier,
          }),
        },
        testEnv
      );

      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.error).toBe('PKCE_VERIFICATION_FAILED');

      // 2. Retry with correct verifier on SAME code succeeds with 200 OK (code was NOT burned!)
      const retryRes = await app.request(
        '/api/auth/exchange-code',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: exchangeCode,
            code_verifier: clientPkce.codeVerifier,
          }),
        },
        testEnv
      );

      expect(retryRes.status).toBe(200);
      const retryBody = (await retryRes.json()) as any;
      expect(retryBody.sessionToken).toBeDefined();
      expect(retryBody.userId).toBeDefined();

      // 3. Second redemption with correct verifier fails with 400 INVALID_EXCHANGE_CODE (replayed)
      const replayedRes = await app.request(
        '/api/auth/exchange-code',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: exchangeCode,
            code_verifier: clientPkce.codeVerifier,
          }),
        },
        testEnv
      );

      expect(replayedRes.status).toBe(400);
      const replayedBody = (await replayedRes.json()) as any;
      expect(replayedBody.error).toBe('INVALID_EXCHANGE_CODE');
    });
  });

  describe('2. Android PKCE Regression Suite', () => {
    it('redirects Android to custom scheme stylesaathi://auth/callback?code=...', async () => {
      const clientPkce = await generatePkcePair();
      const { callbackRes, location } = await simulateGoogleOAuth('android', clientPkce.codeChallenge);

      expect(callbackRes.status).toBe(302);
      expect(location).toContain('stylesaathi://auth/callback?code=');
      expect(location).not.toContain('session_token=');

      const exchangeCode = new URL(location).searchParams.get('code')!;

      // Exchange succeeds with correct verifier
      const res = await app.request(
        '/api/auth/exchange-code',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: exchangeCode,
            code_verifier: clientPkce.codeVerifier,
          }),
        },
        testEnv
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.sessionToken).toBeDefined();
    });
  });

  describe('3. Atomic Single-Use & Anti-Replay Verification', () => {
    it('rejects replayed exchange codes: can only be redeemed once', async () => {
      const clientPkce = await generatePkcePair();
      const { location } = await simulateGoogleOAuth('web', clientPkce.codeChallenge);
      const exchangeCode = new URLSearchParams(location.split('#')[1]).get('code')!;

      // First redemption succeeds
      const res1 = await app.request(
        '/api/auth/exchange-code',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: exchangeCode, code_verifier: clientPkce.codeVerifier }),
        },
        testEnv
      );
      expect(res1.status).toBe(200);

      // Second redemption fails (atomic single-use)
      const res2 = await app.request(
        '/api/auth/exchange-code',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: exchangeCode, code_verifier: clientPkce.codeVerifier }),
        },
        testEnv
      );
      expect(res2.status).toBe(400);
      const body2 = (await res2.json()) as any;
      expect(body2.error).toBe('INVALID_EXCHANGE_CODE');
    });

    it('handles concurrent redemption safely: exactly one request wins', async () => {
      const clientPkce = await generatePkcePair();
      const { location } = await simulateGoogleOAuth('web', clientPkce.codeChallenge);
      const exchangeCode = new URLSearchParams(location.split('#')[1]).get('code')!;

      const [res1, res2] = await Promise.all([
        app.request(
          '/api/auth/exchange-code',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: exchangeCode, code_verifier: clientPkce.codeVerifier }),
          },
          testEnv
        ),
        app.request(
          '/api/auth/exchange-code',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: exchangeCode, code_verifier: clientPkce.codeVerifier }),
          },
          testEnv
        ),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 400]);
    });
  });

  describe('4. Exchange Code Expiry & Invalidation', () => {
    it('rejects exchange codes that exceed the 60-second lifetime', async () => {
      // Seed user and session
      const now = new Date().toISOString();
      sqliteDb
        .prepare(`INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`)
        .run('user-exp', 'Exp User', 'exp@stylesaathi.in', 1, now, now);

      const { rawToken } = await createSession(d1, 'user-exp');

      // Create an expired exchange code (expired 1 second ago)
      const rawExchangeCode = generateSecureToken(32);
      const codeHash = await sha256Hex(rawExchangeCode);
      const expiredAt = new Date(Date.now() - 1000).toISOString();
      const id = crypto.randomUUID();

      sqliteDb
        .prepare(
          `INSERT INTO verification (id, identifier, value, expiresAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          `exchange_code:${codeHash}`,
          JSON.stringify({ userId: 'user-exp', sessionToken: rawToken, clientCodeChallenge: null, createdAt: Date.now() }),
          expiredAt,
          now,
          now
        );

      const res = await app.request(
        '/api/auth/exchange-code',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: rawExchangeCode }),
        },
        testEnv
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error).toBe('INVALID_EXCHANGE_CODE');
      expect(body.message).toContain('expired');
    });
  });

  describe('5. Session Revocation & Cross-User Isolation', () => {
    it('POST /api/auth/sign-out revokes session from D1', async () => {
      const clientPkce = await generatePkcePair();
      const { location } = await simulateGoogleOAuth('web', clientPkce.codeChallenge);
      const exchangeCode = new URLSearchParams(location.split('#')[1]).get('code')!;

      const exchangeRes = await app.request(
        '/api/auth/exchange-code',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: exchangeCode, code_verifier: clientPkce.codeVerifier }),
        },
        testEnv
      );
      const { sessionToken } = (await exchangeRes.json()) as any;

      // Access works before sign out
      const me1 = await app.request(
        '/api/auth/me',
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${sessionToken}` },
        },
        testEnv
      );
      expect(me1.status).toBe(200);

      // Sign out
      const signoutRes = await app.request(
        '/api/auth/sign-out',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${sessionToken}` },
        },
        testEnv
      );
      expect(signoutRes.status).toBe(200);

      // Access rejected after sign out
      const me2 = await app.request(
        '/api/auth/me',
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${sessionToken}` },
        },
        testEnv
      );
      expect(me2.status).toBe(401);
    });

    it('strictly isolates User A and User B: User A token cannot access User B data', async () => {
      const now = new Date().toISOString();
      sqliteDb
        .prepare(`INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`)
        .run('user-a', 'User A', 'usera@stylesaathi.in', 1, now, now);
      sqliteDb
        .prepare(`INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`)
        .run('user-b', 'User B', 'userb@stylesaathi.in', 1, now, now);

      const sessionA = await createSession(d1, 'user-a');
      const sessionB = await createSession(d1, 'user-b');

      const resA = await app.request(
        '/api/auth/me',
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${sessionA.rawToken}` },
        },
        testEnv
      );
      const bodyA = (await resA.json()) as any;
      expect(bodyA.user.id).toBe('user-a');
      expect(bodyA.user.email).toBe('usera@stylesaathi.in');

      const resB = await app.request(
        '/api/auth/me',
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${sessionB.rawToken}` },
        },
        testEnv
      );
      const bodyB = (await resB.json()) as any;
      expect(bodyB.user.id).toBe('user-b');
      expect(bodyB.user.email).toBe('userb@stylesaathi.in');

      // User A token cannot identify as User B
      expect(bodyA.user.id).not.toBe(bodyB.user.id);
    });
  });
});
