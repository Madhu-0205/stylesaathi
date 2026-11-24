// ============================================================================
// STYLESAATHI 3.0 — GOOGLE OAUTH 2.0 & IDENTITY SERVICE (HARDENED)
// Workstream 2 Hardening: SEC-02, SEC-03, SEC-04, SEC-05, SEC-08, SEC-09
// ============================================================================

import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { D1Database } from '../types';
import type {
  User,
  GoogleProfile,
  ExchangeCodePayload,
  AuthContext,
} from './types';
import {
  generateSecureToken,
  sha256Hex,
  verifyPkceChallenge,
} from './crypto';
import { createSession } from './session';

export type JwtVerifyKey = Parameters<typeof jwtVerify>[1];

// Google Public JWKS remote keyset — caches keys and handles rotation automatically
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs')
);

/**
 * Builds the Google OAuth 2.0 authorization URL with PKCE and Nonce parameters.
 * HARDENING (SEC-09): Includes cryptographic nonce in authorization request.
 */
export function buildGoogleAuthorizationUrl(options: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  nonce: string;
}): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', options.clientId);
  url.searchParams.set('redirect_uri', options.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', options.state);
  url.searchParams.set('code_challenge', options.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('nonce', options.nonce);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

export interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
}

/**
 * Exchanges Google authorization code and PKCE verifier for tokens.
 */
export async function exchangeGoogleCodeForTokens(
  options: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
    clientId: string;
    clientSecret: string;
  },
  fetchImpl: typeof fetch = fetch
): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    code: options.code,
    client_id: options.clientId,
    client_secret: options.clientSecret,
    redirect_uri: options.redirectUri,
    grant_type: 'authorization_code',
    code_verifier: options.codeVerifier,
  });

  const response = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google token exchange failed (${response.status}): ${errorText}`);
  }

  return (await response.json()) as GoogleTokenResponse;
}

/**
 * Verifies a Google ID Token using cryptographic RS256 signature verification.
 * CRITICAL SECURITY INVARIANT (SEC-03 & SEC-09):
 * - Validates RS256 signature against Google's public JWKS (or explicit test keyset).
 * - Validates issuer claim ('https://accounts.google.com' or 'accounts.google.com').
 * - Validates audience claim against configured Google Client ID.
 * - Validates expiration and issued-at timestamps.
 * - Validates nonce against transaction nonce if provided.
 * - NEVER falls back to decodeJwt without signature verification.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  clientId: string,
  options?: {
    keyOrJwks?: JwtVerifyKey | JWTVerifyGetKey;
    expectedNonce?: string;
  }
): Promise<GoogleProfile> {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Missing ID token');
  }

  const verifierKey = options?.keyOrJwks || GOOGLE_JWKS;

  const result = await jwtVerify(idToken, verifierKey as any, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: clientId,
  });

  const payload = result.payload;

  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('ID token missing subject (sub) claim');
  }
  if (!payload.email || typeof payload.email !== 'string') {
    throw new Error('ID token missing email claim');
  }

  // Validate nonce against the transaction (SEC-09)
  if (options?.expectedNonce) {
    if (!payload.nonce || payload.nonce !== options.expectedNonce) {
      throw new Error('ID token nonce does not match authentication transaction nonce');
    }
  }

  return {
    sub: payload.sub,
    email: payload.email,
    email_verified: Boolean(payload.email_verified),
    name: (payload.name as string) || (payload.email as string).split('@')[0] || 'StyleSaathi Member',
    picture: (payload.picture as string) || undefined,
  };
}

/**
 * Provisions or links a user from Google OAuth profile data,
 * ensures an application profile exists, and creates a fresh session.
 *
 * CRITICAL SECURITY INVARIANT (SEC-04):
 * An unverified email address (email_verified !== true) is STRICTLY PROHIBITED
 * from claiming or linking to an existing account.
 */
export async function provisionUserAndSession(
  db: D1Database,
  profile: GoogleProfile,
  tokens?: {
    accessToken?: string;
    refreshToken?: string;
    idToken?: string;
    expiresIn?: number;
  },
  meta?: {
    ipAddress?: string | null;
    userAgent?: string | null;
  }
): Promise<{ user: User; sessionToken: string }> {
  const now = new Date();
  const nowIso = now.toISOString();

  // 1. Check if an account already exists for this Google subject (sub)
  interface AccountRow {
    id: string;
    userId: string;
    accountId: string;
    providerId: string;
  }

  const existingAccount = await db
    .prepare(
      `SELECT id, userId, accountId, providerId FROM account WHERE providerId = 'google' AND accountId = ?`
    )
    .bind(profile.sub)
    .first<AccountRow>();

  let userId: string;

  if (existingAccount) {
    userId = existingAccount.userId;

    const tokenExpiresAt = tokens?.expiresIn
      ? new Date(now.getTime() + tokens.expiresIn * 1000).toISOString()
      : null;

    await db
      .prepare(
        `UPDATE account 
         SET accessToken = COALESCE(?, accessToken),
             refreshToken = COALESCE(?, refreshToken),
             idToken = COALESCE(?, idToken),
             accessTokenExpiresAt = COALESCE(?, accessTokenExpiresAt),
             updatedAt = ?
         WHERE id = ?`
      )
      .bind(
        tokens?.accessToken || null,
        tokens?.refreshToken || null,
        tokens?.idToken || null,
        tokenExpiresAt,
        nowIso,
        existingAccount.id
      )
      .run();

    await db
      .prepare(
        `UPDATE user 
         SET name = COALESCE(?, name),
             image = COALESCE(?, image),
             updatedAt = ?
         WHERE id = ?`
      )
      .bind(profile.name || null, profile.picture || null, nowIso, userId)
      .run();
  } else {
    // 2. Check if a user exists with the same email
    interface UserRow {
      id: string;
      email: string;
    }

    const existingUser = await db
      .prepare(`SELECT id, email FROM user WHERE email = ?`)
      .bind(profile.email)
      .first<UserRow>();

    if (existingUser) {
      // HARDENING (SEC-04): Strictly reject account linking if email is unverified
      if (!profile.email_verified) {
        throw new Error(
          'UNVERIFIED_EMAIL: Google account email is not verified. Automatic account linking is prohibited.'
        );
      }
      userId = existingUser.id;
    } else {
      // Reject brand-new user creation with unverified email
      if (!profile.email_verified) {
        throw new Error(
          'UNVERIFIED_EMAIL: Cannot create a new account with an unverified email address.'
        );
      }

      // 3. Create fresh user
      userId = crypto.randomUUID();
      await db
        .prepare(
          `INSERT INTO user (id, name, email, emailVerified, image, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          userId,
          profile.name || 'StyleSaathi Member',
          profile.email,
          1,
          profile.picture || null,
          nowIso,
          nowIso
        )
        .run();
    }

    // Ensure application profile exists
    await db
      .prepare(
        `INSERT OR IGNORE INTO profiles (id, display_name, created_at, updated_at)
         VALUES (?, ?, ?, ?)`
      )
      .bind(userId, profile.name || 'StyleSaathi Member', nowIso, nowIso)
      .run();

    // Link the Google account
    const accountId = crypto.randomUUID();
    const tokenExpiresAt = tokens?.expiresIn
      ? new Date(now.getTime() + tokens.expiresIn * 1000).toISOString()
      : null;

    await db
      .prepare(
        `INSERT INTO account (
           id, userId, accountId, providerId,
           accessToken, refreshToken, idToken,
           accessTokenExpiresAt, createdAt, updatedAt
         ) VALUES (?, ?, ?, 'google', ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        accountId,
        userId,
        profile.sub,
        tokens?.accessToken || null,
        tokens?.refreshToken || null,
        tokens?.idToken || null,
        tokenExpiresAt,
        nowIso,
        nowIso
      )
      .run();
  }

  // 4. Create fresh stateful session (stores SHA-256 hash in D1, returns raw token)
  const sessionResult = await createSession(db, userId, {
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  // 5. Fetch full user object
  interface FullUserRow {
    id: string;
    name: string;
    email: string;
    emailVerified: number;
    image: string | null;
    createdAt: string;
    updatedAt: string;
  }

  const userRow = await db
    .prepare(`SELECT id, name, email, emailVerified, image, createdAt, updatedAt FROM user WHERE id = ?`)
    .bind(userId)
    .first<FullUserRow>();

  if (!userRow) {
    throw new Error('Failed to retrieve user following account provisioning');
  }

  const user: User = {
    id: userRow.id,
    name: userRow.name,
    email: userRow.email,
    emailVerified: Number(userRow.emailVerified),
    image: userRow.image,
    createdAt: userRow.createdAt,
    updatedAt: userRow.updatedAt,
  };

  return { user, sessionToken: sessionResult.rawToken };
}

/**
 * Creates a short-lived (60-second), single-use exchange code in D1 (SEC-02).
 * The exchange code is bound to the session token and optional client PKCE challenge.
 * The deep link delivers only the code; the bearer token is never exposed in URLs.
 */
export async function createExchangeCode(
  db: D1Database,
  sessionToken: string,
  userId: string,
  clientCodeChallenge?: string | null
): Promise<string> {
  const rawExchangeCode = generateSecureToken(32);
  const codeHash = await sha256Hex(rawExchangeCode);
  const now = Date.now();
  const expiresAt = new Date(now + 60 * 1000).toISOString(); // 60-second TTL
  const createdAtIso = new Date(now).toISOString();

  const payload: ExchangeCodePayload = {
    userId,
    sessionToken,
    clientCodeChallenge: clientCodeChallenge || null,
    createdAt: now,
  };

  const id = crypto.randomUUID();
  const identifier = `exchange_code:${codeHash}`;

  await db
    .prepare(
      `INSERT INTO verification (id, identifier, value, expiresAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(id, identifier, JSON.stringify(payload), expiresAt, createdAtIso, createdAtIso)
    .run();

  return rawExchangeCode;
}

/**
 * Atomically consumes a single-use exchange code from D1 (SEC-02 & SEC-08).
 * Uses SQLite `DELETE ... RETURNING *` to eliminate race conditions under concurrent requests.
 * Validates PKCE client_code_verifier if a challenge was bound during initiation.
 */
export async function consumeExchangeCode(
  db: D1Database,
  rawExchangeCode: string,
  codeVerifier?: string | null
): Promise<{ sessionToken: string; userId: string }> {
  if (!rawExchangeCode || typeof rawExchangeCode !== 'string' || rawExchangeCode.trim().length === 0) {
    throw new Error('INVALID_EXCHANGE_CODE: Missing or malformed exchange code.');
  }

  const codeHash = await sha256Hex(rawExchangeCode);
  const identifier = `exchange_code:${codeHash}`;

  interface VerificationRow {
    id: string;
    identifier: string;
    value: string;
    expiresAt: string;
  }

  // 1. Retrieve the exchange-code record without consuming it (Phase 3F.10B.1 remediation)
  const row = await db
    .prepare(`SELECT id, identifier, value, expiresAt FROM verification WHERE identifier = ?`)
    .bind(identifier)
    .first<VerificationRow>();

  if (!row) {
    throw new Error('INVALID_EXCHANGE_CODE: Exchange code is invalid, expired, or has already been used.');
  }

  // 2. Validate 60-second TTL expiration
  const expiresAtMs = new Date(row.expiresAt).getTime();
  if (isNaN(expiresAtMs) || expiresAtMs <= Date.now()) {
    // Eager cleanup of expired code
    try {
      await db.prepare(`DELETE FROM verification WHERE id = ?`).bind(row.id).run();
    } catch {
      // Best-effort cleanup
    }
    throw new Error('EXPIRED_EXCHANGE_CODE: Exchange code has expired (60s lifetime exceeded).');
  }

  let payload: ExchangeCodePayload;
  try {
    payload = JSON.parse(row.value) as ExchangeCodePayload;
  } catch {
    throw new Error('CORRUPT_EXCHANGE_DATA: Failed to parse exchange code payload.');
  }

  // 3. Validate PKCE client code verifier if client challenge was bound
  // Reject incorrect verifiers WITHOUT consuming the exchange code
  if (payload.clientCodeChallenge) {
    if (!codeVerifier) {
      throw new Error('MISSING_CODE_VERIFIER: PKCE code verifier is required to redeem this exchange code.');
    }
    const isValid = await verifyPkceChallenge(codeVerifier, payload.clientCodeChallenge);
    if (!isValid) {
      throw new Error('PKCE_VERIFICATION_FAILED: PKCE code verifier does not match the registered challenge.');
    }
  }

  // 4. Atomically consume the code ONLY after successful PKCE verification (SEC-02 & SEC-08)
  // Single-statement DELETE RETURNING ensures exactly one concurrent request succeeds
  const consumed = await db
    .prepare(`DELETE FROM verification WHERE id = ? RETURNING id`)
    .bind(row.id)
    .first<{ id: string }>();

  if (!consumed) {
    throw new Error('INVALID_EXCHANGE_CODE: Exchange code is invalid, expired, or has already been used.');
  }

  return {
    sessionToken: payload.sessionToken,
    userId: payload.userId,
  };
}
