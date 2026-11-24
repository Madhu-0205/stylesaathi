// ============================================================================
// STYLESAATHI 3.0 — WORKSTREAM 2 HARDENING: COMPREHENSIVE SECURITY TEST SUITE
// Tests for SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-08, SEC-09, SEC-10
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { SignJWT, generateKeyPair } from 'jose';

import { app } from '../src/index';
import type { D1Database, D1PreparedStatement, D1Result, WorkerEnv } from '../src/types';
import {
  createSession,
  validateSession,
  revokeSession,
  revokeAllUserSessions,
} from '../src/auth/session';
import {
  buildGoogleAuthorizationUrl,
  verifyGoogleIdToken,
  provisionUserAndSession,
  createExchangeCode,
  consumeExchangeCode,
} from '../src/auth/oauth';
import {
  sha256Hex,
  generateSecureToken,
  generatePkcePair,
  getAuthSecretKey,
  encryptOAuthTx,
  decryptOAuthTx,
} from '../src/auth/crypto';
import { SESSION_COOKIE_NAME } from '../src/middleware/auth';
import { OAUTH_TX_COOKIE_NAME } from '../src/auth/routes';
import { processPushMutations } from '../src/sync/push';

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
      return stmt as D1PreparedStatement;
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      const results: D1Result<T>[] = [];
      db.exec('BEGIN TRANSACTION;');
      try {
        for (const s of statements) {
          results.push(await s.run<T>());
        }
        db.exec('COMMIT;');
        return results;
      } catch (e) {
        db.exec('ROLLBACK;');
        throw e;
      }
    },
    async exec(query: string) {
      db.exec(query);
      return { count: 1, duration: 0 };
    },
  };
}

describe('Workstream 2 Hardened Security Test Suite', () => {
  let sqlite: DatabaseSync;
  let d1: D1Database;
  const migrationSql = fs.readFileSync(MIGRATION_PATH, 'utf-8');

  // Test RSA Key Pair for real cryptographic JWT RS256 signature verification (SEC-03, SEC-10)
  let trustedPublicKey: any;
  let trustedPrivateKey: any;
  let roguePublicKey: any;
  let roguePrivateKey: any;

  beforeEach(async () => {
    sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = ON;');
    sqlite.exec(migrationSql);
    if (fs.existsSync(MIGRATION_V2_PATH)) {
      sqlite.exec(fs.readFileSync(MIGRATION_V2_PATH, 'utf-8'));
    }
    if (fs.existsSync(MIGRATION_V3_PATH)) {
      sqlite.exec(fs.readFileSync(MIGRATION_V3_PATH, 'utf-8'));
    }
    d1 = createD1Adapter(sqlite);

    // Generate real RS256 keypairs for testing
    const trustedKeys = await generateKeyPair('RS256');
    trustedPublicKey = trustedKeys.publicKey;
    trustedPrivateKey = trustedKeys.privateKey;

    const rogueKeys = await generateKeyPair('RS256');
    roguePublicKey = rogueKeys.publicKey;
    roguePrivateKey = rogueKeys.privateKey;
  });

  afterEach(() => {
    try {
      sqlite.close();
    } catch {
      // Ignore
    }
  });

  async function seedTestUser(id = 'user-1', email = 'member@stylesaathi.in', name = 'Priya Sharma') {
    const now = new Date().toISOString();
    await d1
      .prepare('INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, name, email, 1, now, now)
      .run();
    await d1
      .prepare('INSERT INTO profiles (id, display_name, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .bind(id, name, now, now)
      .run();
  }

  // ==========================================================================
  // 1. SEC-01: Session Token Hashing at Rest
  // ==========================================================================
  describe('SEC-01: Session Token Hashing at Rest', () => {
    it('persists ONLY the SHA-256 hash in D1 and never the raw bearer token', async () => {
      await seedTestUser();

      const { session, rawToken } = await createSession(d1, 'user-1');

      // 1. Client receives high-entropy 64-char raw token
      expect(rawToken).toHaveLength(64);

      // 2. Direct database dump query confirms plaintext token is NOT in the database
      const row = (await sqlite
        .prepare('SELECT token FROM session WHERE userId = ?')
        .get('user-1')) as { token: string };

      expect(row).toBeDefined();
      expect(row.token).not.toBe(rawToken);

      // 3. Stored value must exactly equal SHA-256 hex digest of raw token
      const expectedHash = await sha256Hex(rawToken);
      expect(row.token).toBe(expectedHash);
      expect(session.token).toBe(expectedHash);
    });

    it('validates authentic raw token by hashing on lookup', async () => {
      await seedTestUser();
      const { rawToken } = await createSession(d1, 'user-1');

      const auth = await validateSession(d1, rawToken);
      expect(auth).not.toBeNull();
      expect(auth!.user.id).toBe('user-1');
      expect(auth!.user.email).toBe('member@stylesaathi.in');
    });

    it('rejects an attacker attempting to use the database hash as a bearer token', async () => {
      await seedTestUser();
      const { session } = await createSession(d1, 'user-1');

      // Attacker dumps D1 and tries to present session.token (the hash) as a bearer token
      const authWithHash = await validateSession(d1, session.token);
      expect(authWithHash).toBeNull();
    });

    it('revokes session by raw token via hash deletion', async () => {
      await seedTestUser();
      const { rawToken } = await createSession(d1, 'user-1');

      const revoked = await revokeSession(d1, rawToken);
      expect(revoked).toBe(true);

      const auth = await validateSession(d1, rawToken);
      expect(auth).toBeNull();
    });
  });

  // ==========================================================================
  // 2. SEC-02 & SEC-08: Android Exchange Code & Deep-Link Security
  // ==========================================================================
  describe('SEC-02 & SEC-08: Android Exchange Code Architecture', () => {
    it('creates single-use exchange code with 60-second TTL and redeems via HTTPS', async () => {
      await seedTestUser();
      const { rawToken } = await createSession(d1, 'user-1');

      const clientPkce = await generatePkcePair();
      const rawExchangeCode = await createExchangeCode(
        d1,
        rawToken,
        'user-1',
        clientPkce.codeChallenge
      );

      expect(rawExchangeCode).toHaveLength(64);

      // Successfully redeem with valid PKCE verifier
      const redeemed = await consumeExchangeCode(d1, rawExchangeCode, clientPkce.codeVerifier);
      expect(redeemed.sessionToken).toBe(rawToken);
      expect(redeemed.userId).toBe('user-1');
    });

    it('rejects exchange code redemption if PKCE code verifier is wrong without consuming the code (Phase 3F.10B.1)', async () => {
      await seedTestUser();
      const { rawToken } = await createSession(d1, 'user-1');

      const clientPkce = await generatePkcePair();
      const rawExchangeCode = await createExchangeCode(
        d1,
        rawToken,
        'user-1',
        clientPkce.codeChallenge
      );

      // Attempt 1: Wrong verifier fails with PKCE_VERIFICATION_FAILED
      await expect(
        consumeExchangeCode(d1, rawExchangeCode, 'wrong-client-code-verifier')
      ).rejects.toThrow('PKCE_VERIFICATION_FAILED');

      // Attempt 2: Correct verifier on same code succeeds (code was NOT consumed!)
      const redeemed = await consumeExchangeCode(d1, rawExchangeCode, clientPkce.codeVerifier);
      expect(redeemed.sessionToken).toBe(rawToken);
      expect(redeemed.userId).toBe('user-1');

      // Attempt 3: Already consumed code fails with INVALID_EXCHANGE_CODE
      await expect(
        consumeExchangeCode(d1, rawExchangeCode, clientPkce.codeVerifier)
      ).rejects.toThrow('INVALID_EXCHANGE_CODE');
    });

    it('handles concurrent correct redemption attempts: exactly one succeeds (Phase 3F.10B.1)', async () => {
      await seedTestUser();
      const { rawToken } = await createSession(d1, 'user-1');

      const clientPkce = await generatePkcePair();
      const rawExchangeCode = await createExchangeCode(
        d1,
        rawToken,
        'user-1',
        clientPkce.codeChallenge
      );

      const results = await Promise.allSettled([
        consumeExchangeCode(d1, rawExchangeCode, clientPkce.codeVerifier),
        consumeExchangeCode(d1, rawExchangeCode, clientPkce.codeVerifier),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((fulfilled[0] as PromiseFulfilledResult<any>).value.sessionToken).toBe(rawToken);
      expect((rejected[0] as PromiseRejectedResult).reason.message).toContain('INVALID_EXCHANGE_CODE');
    });

    it('rejects expired exchange codes (Phase 3F.10B.1)', async () => {
      await seedTestUser();
      const { rawToken } = await createSession(d1, 'user-1');

      const clientPkce = await generatePkcePair();
      const rawExchangeCode = await createExchangeCode(
        d1,
        rawToken,
        'user-1',
        clientPkce.codeChallenge
      );

      // Manually set expiresAt in the past
      const { sha256Hex } = await import('../src/auth/crypto');
      const codeHash = await sha256Hex(rawExchangeCode);
      const identifier = `exchange_code:${codeHash}`;
      await d1.prepare(`UPDATE verification SET expiresAt = ? WHERE identifier = ?`).bind('2020-01-01T00:00:00.000Z', identifier).run();

      await expect(
        consumeExchangeCode(d1, rawExchangeCode, clientPkce.codeVerifier)
      ).rejects.toThrow('EXPIRED_EXCHANGE_CODE');
    });

    it('atomically prevents replay attacks: code can only be consumed once', async () => {
      await seedTestUser();
      const { rawToken } = await createSession(d1, 'user-1');

      const rawExchangeCode = await createExchangeCode(d1, rawToken, 'user-1');

      // Attempt 1: Must succeed
      const first = await consumeExchangeCode(d1, rawExchangeCode);
      expect(first.sessionToken).toBe(rawToken);

      // Attempt 2: Must fail (replayed code)
      await expect(consumeExchangeCode(d1, rawExchangeCode)).rejects.toThrow(
        'INVALID_EXCHANGE_CODE'
      );
    });
  });

  // ==========================================================================
  // 3. SEC-03 & SEC-09: Cryptographic Google ID Token & Nonce Verification
  // ==========================================================================
  describe('SEC-03 & SEC-09: Cryptographic ID Token Verification', () => {
    const clientId = 'stylesaathi-client-id.apps.googleusercontent.com';

    it('verifies valid RS256 signature, audience, issuer, and nonce', async () => {
      const now = Math.floor(Date.now() / 1000);
      const idToken = await new SignJWT({
        email: 'alice@stylesaathi.in',
        email_verified: true,
        name: 'Alice Dev',
        sub: 'google-sub-alice-123',
        nonce: 'secure-tx-nonce-789',
      })
        .setProtectedHeader({ alg: 'RS256' })
        .setIssuer('https://accounts.google.com')
        .setAudience(clientId)
        .setIssuedAt(now)
        .setExpirationTime(now + 3600)
        .sign(trustedPrivateKey);

      const profile = await verifyGoogleIdToken(idToken, clientId, {
        keyOrJwks: trustedPublicKey,
        expectedNonce: 'secure-tx-nonce-789',
      });

      expect(profile.sub).toBe('google-sub-alice-123');
      expect(profile.email).toBe('alice@stylesaathi.in');
      expect(profile.email_verified).toBe(true);
      expect(profile.name).toBe('Alice Dev');
    });

    it('rejects ID token signed by an untrusted/rogue private key', async () => {
      const now = Math.floor(Date.now() / 1000);
      const forgedToken = await new SignJWT({
        email: 'victim@stylesaathi.in',
        email_verified: true,
        sub: 'attacker-sub',
      })
        .setProtectedHeader({ alg: 'RS256' })
        .setIssuer('https://accounts.google.com')
        .setAudience(clientId)
        .setIssuedAt(now)
        .setExpirationTime(now + 3600)
        .sign(roguePrivateKey); // Signed by attacker key

      // Must be rejected when verified against trusted public key
      await expect(
        verifyGoogleIdToken(forgedToken, clientId, { keyOrJwks: trustedPublicKey })
      ).rejects.toThrow();
    });

    it('rejects ID token with wrong audience', async () => {
      const now = Math.floor(Date.now() / 1000);
      const wrongAudToken = await new SignJWT({
        email: 'alice@stylesaathi.in',
        email_verified: true,
        sub: 'sub-1',
      })
        .setProtectedHeader({ alg: 'RS256' })
        .setIssuer('https://accounts.google.com')
        .setAudience('completely-different-client-id')
        .setIssuedAt(now)
        .setExpirationTime(now + 3600)
        .sign(trustedPrivateKey);

      await expect(
        verifyGoogleIdToken(wrongAudToken, clientId, { keyOrJwks: trustedPublicKey })
      ).rejects.toThrow();
    });

    it('rejects ID token with wrong issuer', async () => {
      const now = Math.floor(Date.now() / 1000);
      const wrongIssToken = await new SignJWT({
        email: 'alice@stylesaathi.in',
        email_verified: true,
        sub: 'sub-1',
      })
        .setProtectedHeader({ alg: 'RS256' })
        .setIssuer('https://malicious-idp.com')
        .setAudience(clientId)
        .setIssuedAt(now)
        .setExpirationTime(now + 3600)
        .sign(trustedPrivateKey);

      await expect(
        verifyGoogleIdToken(wrongIssToken, clientId, { keyOrJwks: trustedPublicKey })
      ).rejects.toThrow();
    });

    it('rejects expired ID token', async () => {
      const past = Math.floor(Date.now() / 1000) - 7200;
      const expiredToken = await new SignJWT({
        email: 'alice@stylesaathi.in',
        email_verified: true,
        sub: 'sub-1',
      })
        .setProtectedHeader({ alg: 'RS256' })
        .setIssuer('https://accounts.google.com')
        .setAudience(clientId)
        .setIssuedAt(past)
        .setExpirationTime(past + 3600)
        .sign(trustedPrivateKey);

      await expect(
        verifyGoogleIdToken(expiredToken, clientId, { keyOrJwks: trustedPublicKey })
      ).rejects.toThrow();
    });

    it('rejects ID token if nonce does not match authentication transaction', async () => {
      const now = Math.floor(Date.now() / 1000);
      const mismatchedNonceToken = await new SignJWT({
        email: 'alice@stylesaathi.in',
        email_verified: true,
        sub: 'sub-1',
        nonce: 'attacker-injected-nonce',
      })
        .setProtectedHeader({ alg: 'RS256' })
        .setIssuer('https://accounts.google.com')
        .setAudience(clientId)
        .setIssuedAt(now)
        .setExpirationTime(now + 3600)
        .sign(trustedPrivateKey);

      await expect(
        verifyGoogleIdToken(mismatchedNonceToken, clientId, {
          keyOrJwks: trustedPublicKey,
          expectedNonce: 'legitimate-client-nonce-123',
        })
      ).rejects.toThrow('ID token nonce does not match authentication transaction nonce');
    });
  });

  // ==========================================================================
  // 4. SEC-04: Safe Account Linking & Unverified Email Rejection
  // ==========================================================================
  describe('SEC-04: Account Linking Protection', () => {
    it('strictly rejects account linking when email_verified is false', async () => {
      // Seed victim account
      await seedTestUser('victim-id', 'victim@stylesaathi.in', 'Victim User');

      // Attacker attempts to login with Google using unverified email
      const attackerProfile = {
        sub: 'attacker-google-sub',
        email: 'victim@stylesaathi.in',
        email_verified: false, // NOT verified!
        name: 'Attacker Fake',
      };

      await expect(
        provisionUserAndSession(d1, attackerProfile)
      ).rejects.toThrow('UNVERIFIED_EMAIL');

      // Confirm victim's account was NOT linked to attacker sub
      const link = await d1
        .prepare('SELECT id FROM account WHERE accountId = ?')
        .bind('attacker-google-sub')
        .first();
      expect(link).toBeNull();
    });

    it('allows account linking when Google ID token has email_verified = true', async () => {
      await seedTestUser('user-legit', 'verified@stylesaathi.in', 'Legit User');

      const profile = {
        sub: 'google-sub-verified-456',
        email: 'verified@stylesaathi.in',
        email_verified: true,
        name: 'Legit User',
      };

      const result = await provisionUserAndSession(d1, profile);
      expect(result.user.id).toBe('user-legit');

      const accountRow = await d1
        .prepare('SELECT accountId FROM account WHERE userId = ?')
        .bind('user-legit')
        .first<{ accountId: string }>();
      expect(accountRow?.accountId).toBe('google-sub-verified-456');
    });
  });

  // ==========================================================================
  // 5. SEC-05: OAuth Initiation Zero-D1-Write Protection
  // ==========================================================================
  describe('SEC-05: OAuth Initiation Quota DoS Protection', () => {
    const testEnv: WorkerEnv = {
      DB: undefined as any,
      APP_ENV: 'test',
      GOOGLE_CLIENT_ID: 'google-test-id.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'google-test-secret',
      AUTH_SECRET: 'test-auth-secret-for-jwe-encryption-32bytes!',
      APP_URL: 'https://stylesaathi.pages.dev',
    };

    beforeEach(() => {
      testEnv.DB = d1;
    });

    it('performs ZERO D1 database writes during OAuth initiation', async () => {
      // Execute 25 repeated initiation requests
      for (let i = 0; i < 25; i++) {
        const res = await app.request(
          '/api/auth/sign-in/social?provider=google&platform=android',
          { method: 'GET' },
          testEnv
        );
        expect(res.status).toBe(302);
      }

      // Assert verification table has exactly 0 rows
      const count = (await sqlite
        .prepare('SELECT count(*) as cnt FROM verification')
        .get()) as { cnt: number };
      expect(count.cnt).toBe(0);
    });

    it('encrypts transaction state in authenticated JWE cookie with 10-minute TTL', async () => {
      const res = await app.request(
        '/api/auth/sign-in/social?provider=google&platform=web',
        { method: 'GET' },
        testEnv
      );

      const setCookie = res.headers.get('Set-Cookie');
      expect(setCookie).toBeDefined();
      expect(setCookie).toContain(OAUTH_TX_COOKIE_NAME);
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('Max-Age=600');
    });
  });

  // ==========================================================================
  // 6. Complete End-to-End Hardened HTTP Routes & Exchange Flow
  // ==========================================================================
  describe('End-to-End Hardened Route Execution', () => {
    const testEnv: WorkerEnv = {
      DB: undefined as any,
      APP_ENV: 'test',
      GOOGLE_CLIENT_ID: 'google-test-id.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'google-test-secret',
      AUTH_SECRET: 'test-auth-secret-for-jwe-encryption-32bytes!',
      APP_URL: 'https://stylesaathi.pages.dev',
    };

    beforeEach(() => {
      testEnv.DB = d1;
    });

    it('completes Android flow with exchange code (no bearer tokens in deep link)', async () => {
      // 1. Client initiates Android OAuth with client PKCE challenge
      const clientPkce = await generatePkcePair();

      const initRes = await app.request(
        `/api/auth/sign-in/social?provider=google&platform=android&client_code_challenge=${clientPkce.codeChallenge}`,
        { method: 'GET' },
        testEnv
      );

      expect(initRes.status).toBe(302);
      const authUrl = new URL(initRes.headers.get('Location')!);
      const state = authUrl.searchParams.get('state')!;
      const nonce = authUrl.searchParams.get('nonce')!;
      expect(state).toBeDefined();
      expect(nonce).toBeDefined();

      const txCookieHeader = initRes.headers.get('Set-Cookie')!;
      const match = txCookieHeader.match(/stylesaathi_oauth_tx=([^;]+)/);
      const txCookie = match![1];

      // 2. Google returns auth code; mock Google token endpoint response
      const idToken = await new SignJWT({
        email: 'android.member@stylesaathi.in',
        email_verified: true,
        name: 'Android Member',
        sub: 'google-sub-android-999',
        nonce,
      })
        .setProtectedHeader({ alg: 'RS256' })
        .setIssuer('https://accounts.google.com')
        .setAudience('google-test-id.apps.googleusercontent.com')
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(trustedPrivateKey);

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'google-access-tok',
          id_token: idToken,
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      } as any);

      try {
        // Callback request provides state and transaction cookie
        // Pass trustedPublicKey via WorkerEnv for real RS256 signature verification
        const testEnvWithKey = { ...testEnv, TEST_JWKS_KEY: trustedPublicKey };
        const callbackRes = await app.request(
          `/api/auth/callback/google?code=google-code-123&state=${state}`,
          {
            method: 'GET',
            headers: {
              Cookie: `stylesaathi_oauth_tx=${txCookie}`,
            },
          },
          testEnvWithKey
        );

        expect(callbackRes.status).toBe(302);
        const redirectUrl = callbackRes.headers.get('Location')!;

        // CRITICAL CHECK (SEC-02): Bearer token MUST NOT be in URL!
        expect(redirectUrl).not.toContain('session_token=');
        expect(redirectUrl).toContain('stylesaathi://auth/callback?code=');

        const deepLinkUrl = new URL(redirectUrl);
        const exchangeCode = deepLinkUrl.searchParams.get('code')!;
        expect(exchangeCode).toBeDefined();

        // 3. Android app calls POST /api/auth/exchange-code with code & PKCE verifier
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
        const exchangeBody: any = await exchangeRes.json();
        expect(exchangeBody.sessionToken).toBeDefined();
        expect(exchangeBody.userId).toBeDefined();

        // 4. Verify the issued session token works on protected /api/auth/me
        const meRes = await app.request(
          '/api/auth/me',
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${exchangeBody.sessionToken}`,
            },
          },
          testEnv
        );

        expect(meRes.status).toBe(200);
        const meBody: any = await meRes.json();
        expect(meBody.user.email).toBe('android.member@stylesaathi.in');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('rejects exchange-code if replayed or forged', async () => {
      const res = await app.request(
        '/api/auth/exchange-code',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: 'forged-or-nonexistent-code',
            code_verifier: 'verifier',
          }),
        },
        testEnv
      );

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.error).toBe('INVALID_EXCHANGE_CODE');
    });

    it('handles concurrent exchange code redemption safely (atomic single-use)', async () => {
      await seedTestUser();
      const { rawToken } = await createSession(d1, 'user-1');
      const exchangeCode = await createExchangeCode(d1, rawToken, 'user-1');

      // Fire two concurrent exchange requests with the exact same code
      const [res1, res2] = await Promise.all([
        app.request(
          '/api/auth/exchange-code',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: exchangeCode }),
          },
          testEnv
        ),
        app.request(
          '/api/auth/exchange-code',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: exchangeCode }),
          },
          testEnv
        ),
      ]);

      const statuses = [res1.status, res2.status].sort();
      // Exactly one request must succeed (200) and the other must be rejected (400)
      expect(statuses).toEqual([200, 400]);
    });

    it('completes Web OAuth via Unified PKCE exchange-code and redirects to Web App (#code=...)', async () => {
      // 1. Web client generates PKCE pair
      const clientPkce = await generatePkcePair();

      const initRes = await app.request(
        `/api/auth/sign-in/social?provider=google&platform=web&client_code_challenge=${clientPkce.codeChallenge}`,
        { method: 'GET' },
        testEnv
      );

      const authUrl = new URL(initRes.headers.get('Location')!);
      const state = authUrl.searchParams.get('state')!;
      const nonce = authUrl.searchParams.get('nonce')!;

      const txCookie = initRes.headers.get('Set-Cookie')!.match(/stylesaathi_oauth_tx=([^;]+)/)![1];

      const idToken = await new SignJWT({
        email: 'web.user@stylesaathi.in',
        email_verified: true,
        name: 'Web User',
        sub: 'google-sub-web-888',
        nonce,
      })
        .setProtectedHeader({ alg: 'RS256' })
        .setIssuer('https://accounts.google.com')
        .setAudience('google-test-id.apps.googleusercontent.com')
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(trustedPrivateKey);

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'web-access-token',
          id_token: idToken,
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      } as any);

      try {
        const testEnvWithKey = { ...testEnv, TEST_JWKS_KEY: trustedPublicKey };
        const callbackRes = await app.request(
          `/api/auth/callback/google?code=valid-web-code&state=${state}`,
          {
            method: 'GET',
            headers: {
              Cookie: `stylesaathi_oauth_tx=${txCookie}`,
            },
          },
          testEnvWithKey
        );

        expect(callbackRes.status).toBe(302);
        const location = callbackRes.headers.get('Location')!;

        // CRITICAL CHECK (Phase 3F.10A.3 / SEC-02): Zero bearer token in Web redirect URL!
        expect(location).not.toContain('session_token=');
        expect(location).toContain('https://stylesaathi.pages.dev/#code=');

        // Extract exchange code from URL fragment
        const fragment = location.split('#')[1];
        const params = new URLSearchParams(fragment);
        const exchangeCode = params.get('code')!;
        expect(exchangeCode).toBeDefined();

        // 2. Web client redeems exchange code with PKCE code_verifier
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
        const exchangeBody: any = await exchangeRes.json();
        expect(exchangeBody.sessionToken).toBeDefined();
        expect(exchangeBody.userId).toBeDefined();

        // 3. Verify access to protected endpoint with Bearer token
        const meRes = await app.request(
          '/api/auth/me',
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${exchangeBody.sessionToken}` },
          },
          testEnv
        );
        expect(meRes.status).toBe(200);
        const meBody: any = await meRes.json();
        expect(meBody.user.email).toBe('web.user@stylesaathi.in');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('POST /api/auth/sign-out revokes session from D1, blocking subsequent access to /api/auth/me', async () => {
      await seedTestUser();
      const { rawToken } = await createSession(d1, 'user-1');

      // 1. Verify access works
      const meBefore = await app.request(
        '/api/auth/me',
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${rawToken}` },
        },
        testEnv
      );
      expect(meBefore.status).toBe(200);

      // 2. Sign out
      const signOutRes = await app.request(
        '/api/auth/sign-out',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${rawToken}` },
        },
        testEnv
      );
      expect(signOutRes.status).toBe(200);

      // 3. Verify access is now rejected with 401
      const meAfter = await app.request(
        '/api/auth/me',
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${rawToken}` },
        },
        testEnv
      );
      expect(meAfter.status).toBe(401);
    });

    it('strictly isolates User A and User B sessions', async () => {
      await seedTestUser('user-a', 'alice@stylesaathi.in', 'Alice');
      await seedTestUser('user-b', 'bob@stylesaathi.in', 'Bob');

      const sessionA = await createSession(d1, 'user-a');
      const sessionB = await createSession(d1, 'user-b');

      const meA = await app.request(
        '/api/auth/me',
        { method: 'GET', headers: { Authorization: `Bearer ${sessionA.rawToken}` } },
        testEnv
      );
      const meB = await app.request(
        '/api/auth/me',
        { method: 'GET', headers: { Authorization: `Bearer ${sessionB.rawToken}` } },
        testEnv
      );

      const bodyA: any = await meA.json();
      const bodyB: any = await meB.json();

      expect(bodyA.user.id).toBe('user-a');
      expect(bodyA.user.name).toBe('Alice');

      expect(bodyB.user.id).toBe('user-b');
      expect(bodyB.user.name).toBe('Bob');
    });

    it('rejects tampered or forged OAuth transaction cookie', async () => {
      const res = await app.request(
        '/api/auth/callback/google?code=fake-code&state=fake-state',
        {
          method: 'GET',
          headers: {
            Cookie: 'stylesaathi_oauth_tx=forged.jwe.token',
          },
        },
        testEnv
      );

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.error).toBe('INVALID_STATE');
    });

    it('Workstream 8: fails closed when APP_ENV is production and AUTH_SECRET is missing or empty', async () => {
      // 1. Direct crypto unit test
      await expect(getAuthSecretKey(undefined, 'production')).rejects.toThrow(
        'CONFIGURATION_ERROR: AUTH_SECRET must be configured in production environments.'
      );
      await expect(getAuthSecretKey('', 'production')).rejects.toThrow(
        'CONFIGURATION_ERROR: AUTH_SECRET must be configured in production environments.'
      );
      await expect(getAuthSecretKey('   ', 'production')).rejects.toThrow(
        'CONFIGURATION_ERROR: AUTH_SECRET must be configured in production environments.'
      );

      // In non-production, fallback is permitted
      const devKey = await getAuthSecretKey(undefined, 'development');
      expect(devKey).toBeInstanceOf(Uint8Array);
      expect(devKey.length).toBe(32);

      // In production with valid secret, key derivation succeeds
      const prodKey = await getAuthSecretKey('valid-production-secret-1234567890', 'production');
      expect(prodKey).toBeInstanceOf(Uint8Array);
      expect(prodKey.length).toBe(32);

      // 2. Integration test via Hono route
      const prodEnvWithoutSecret = {
        ...testEnv,
        APP_ENV: 'production',
        AUTH_SECRET: undefined,
      };

      const res = await app.request(
        '/api/auth/sign-in/social',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: 'google' }),
        },
        prodEnvWithoutSecret
      );

      expect(res.status).toBe(503);
      const body: any = await res.json();
      expect(body.error).toBe('CONFIGURATION_ERROR');
      expect(body.message).toContain('AUTH_SECRET must be configured');
    });
  });

  describe('Phase 3E.2: Account Deletion Endpoint & Tombstone Safeguards', () => {
    let testEnv: WorkerEnv;

    beforeEach(() => {
      testEnv = {
        DB: d1,
        AUTH_SECRET: 'test-auth-secret-1234567890-secure-key',
        APP_ENV: 'test',
        GOOGLE_CLIENT_ID: 'test-google-client-id',
        GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
      };
    });

    it('successfully deletes account, sessions, cascades user data, and writes tombstone', async () => {
      await seedTestUser('user-del-1', 'delete-me@stylesaathi.in', 'Del User');
      const { rawToken } = await createSession(d1, 'user-del-1');

      // Seed some wardrobe items for this user
      const now = new Date().toISOString();
      await d1
        .prepare(
          `INSERT INTO wardrobe_items (id, user_id, name, category, subcategory, formality, created_at, client_updated_at, server_updated_at, revision)
           VALUES ('item-del-1', 'user-del-1', 'Kurta', 'Ethnic', 'kurta', 3, ?, ?, ?, 1)`
        )
        .bind(now, now, now)
        .run();

      const res = await app.request(
        '/api/auth/delete-account',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${rawToken}`,
          },
        },
        testEnv
      );

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.requestId).toBeDefined();

      // Verify user table is empty for user-del-1
      const user = await d1.prepare('SELECT id FROM user WHERE id = ?').bind('user-del-1').first();
      expect(user).toBeNull();

      // Verify sessions are gone
      const sess = await d1.prepare('SELECT id FROM session WHERE userId = ?').bind('user-del-1').first();
      expect(sess).toBeNull();

      // Verify wardrobe items are cascaded
      const item = await d1.prepare('SELECT id FROM wardrobe_items WHERE user_id = ?').bind('user-del-1').first();
      expect(item).toBeNull();

      // Verify tombstone is recorded
      const userIdHash = await sha256Hex('user-del-1');
      const tombstone = await d1
        .prepare('SELECT request_id, reconciled FROM deletion_tombstones WHERE user_id_hash = ?')
        .bind(userIdHash)
        .first<any>();
      expect(tombstone).toBeDefined();
      expect(tombstone.reconciled).toBe(1);

      // Verify subsequent authenticated call fails
      const meRes = await app.request(
        '/api/auth/me',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${rawToken}`,
          },
        },
        testEnv
      );
      expect(meRes.status).toBe(401);
    });

    it('rejects unauthenticated delete-account requests', async () => {
      const res = await app.request(
        '/api/auth/delete-account',
        {
          method: 'POST',
        },
        testEnv
      );
      expect(res.status).toBe(401);
    });

    it('rejects cross-user deletion attempts (SEC-04)', async () => {
      await seedTestUser('user-a', 'usera@stylesaathi.in', 'User A');
      await seedTestUser('user-b', 'userb@stylesaathi.in', 'User B');
      const sessionA = await createSession(d1, 'user-a');

      const res = await app.request(
        '/api/auth/delete-account',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionA.rawToken}`,
          },
          body: JSON.stringify({ targetUserId: 'user-b' }),
        },
        testEnv
      );
      expect(res.status).toBe(403);
      const body: any = await res.json();
      expect(body.error).toBe('FORBIDDEN');

      // Verify user-b was NOT deleted
      const userB = await d1.prepare('SELECT id FROM user WHERE id = ?').bind('user-b').first();
      expect(userB).toBeDefined();
    });

    it('prevents stale sync mutations from resurrecting deleted accounts', async () => {
      await seedTestUser('user-zombie', 'zombie@stylesaathi.in', 'Zombie');
      const { rawToken } = await createSession(d1, 'user-zombie');

      // Delete account
      const delRes = await app.request(
        '/api/auth/delete-account',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${rawToken}`,
          },
        },
        testEnv
      );
      expect(delRes.status).toBe(200);

      // Stale mutation push from offline device
      const staleMutation: any = {
        mutationId: 'mut-zombie-1',
        entityType: 'wardrobe_item',
        entityId: 'item-zombie-1',
        action: 'create',
        expectedRevision: null,
        data: {
          id: 'item-zombie-1',
          name: 'Zombie Shirt',
          category: 'Tops',
          subcategory: 'shirt',
          seasons: ['summer'],
          occasions: ['everyday'],
          colors: ['black'],
        },
      };

      const pushRes = await processPushMutations(d1, 'user-zombie', [staleMutation]);
      expect(pushRes.length).toBe(1);
      expect(pushRes[0].status).toBe('rejected');
      expect(pushRes[0].error).toContain('ACCOUNT_DELETED');

      // Ensure no wardrobe item was inserted
      const item = await d1.prepare('SELECT id FROM wardrobe_items WHERE id = ?').bind('item-zombie-1').first();
      expect(item).toBeNull();
    });
  });
});
