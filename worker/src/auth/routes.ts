// ============================================================================
// STYLESAATHI 3.0 — AUTHENTICATION ROUTER (HARDENED)
// Custom Cloudflare Worker & D1 Authentication Engine
// Workstream 2 Hardening: SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-08, SEC-09
// ============================================================================

import { Hono } from 'hono';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import type { WorkerEnv, AuthVariables } from '../types';
import {
  extractSessionToken,
  authMiddleware,
  SESSION_COOKIE_NAME,
} from '../middleware/auth';
import { validateSession, revokeSession } from './session';
import {
  sha256Hex,
  getAuthSecretKey,
  generateSecureToken,
  generatePkcePair,
  encryptOAuthTx,
  decryptOAuthTx,
} from './crypto';
import {
  buildGoogleAuthorizationUrl,
  exchangeGoogleCodeForTokens,
  verifyGoogleIdToken,
  provisionUserAndSession,
  createExchangeCode,
  consumeExchangeCode,
  type JwtVerifyKey,
} from './oauth';

export const OAUTH_TX_COOKIE_NAME = 'stylesaathi_oauth_tx';
export const OAUTH_TX_COOKIE_NONE = 'stylesaathi_oauth_tx_none';
export const MAX_CONCURRENT_OAUTH_TRANSACTIONS = 3;

/**
 * Prunes expired transaction cookies and bounds outstanding concurrent transactions
 * to MAX_CONCURRENT_OAUTH_TRANSACTIONS to guarantee bounded HTTP request header sizes (< 3 KB)
 * even after repeated abandoned login attempts.
 */
export async function pruneStaleTransactionCookies(c: any, secretKey: Uint8Array): Promise<void> {
  const cookieHeader = c.req.header('cookie');
  if (!cookieHeader) return;

  const stateRegex = new RegExp(`^${OAUTH_TX_COOKIE_NAME}(_none)?_([0-9a-f]{24,64})$`);
  const existingTxItems: { key: string; isNone: boolean; state: string; value: string }[] = [];

  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;
    const name = pair.slice(0, eqIdx).trim();
    const val = pair.slice(eqIdx + 1).trim();
    const match = name.match(stateRegex);
    if (match) {
      existingTxItems.push({
        key: name,
        isNone: Boolean(match[1]),
        state: match[2],
        value: val,
      });
    }
  }

  if (existingTxItems.length === 0) return;

  const stateGroups = new Map<string, { createdAt: number; keys: string[] }>();

  for (const item of existingTxItems) {
    const existing = stateGroups.get(item.state);
    if (!existing) {
      let createdAt = 0;
      try {
        const payload = await decryptOAuthTx(item.value, secretKey);
        if (payload && typeof payload.createdAt === 'number') {
          createdAt = payload.createdAt;
        }
      } catch {
        // Expired or malformed
      }
      stateGroups.set(item.state, { createdAt, keys: [item.key] });
    } else {
      existing.keys.push(item.key);
    }
  }

  const now = Date.now();
  const TEN_MINUTES_MS = 10 * 60 * 1000;
  const activeStates: { state: string; createdAt: number }[] = [];

  for (const [st, info] of stateGroups.entries()) {
    if (info.createdAt === 0 || now - info.createdAt >= TEN_MINUTES_MS) {
      deleteCookie(c, `${OAUTH_TX_COOKIE_NAME}_${st}`, { path: '/', secure: true, sameSite: 'Lax' });
      deleteCookie(c, `${OAUTH_TX_COOKIE_NONE}_${st}`, { path: '/', secure: true, sameSite: 'None' });
    } else {
      activeStates.push({ state: st, createdAt: info.createdAt });
    }
  }

  // Enforce bounded concurrency: allow at most (MAX_CONCURRENT_OAUTH_TRANSACTIONS - 1) active
  // prior transactions before adding the new one, pruning the oldest if needed.
  if (activeStates.length >= MAX_CONCURRENT_OAUTH_TRANSACTIONS) {
    activeStates.sort((a, b) => a.createdAt - b.createdAt);
    const toPrune = activeStates.length - (MAX_CONCURRENT_OAUTH_TRANSACTIONS - 1);
    for (let i = 0; i < toPrune; i++) {
      const stToPrune = activeStates[i].state;
      deleteCookie(c, `${OAUTH_TX_COOKIE_NAME}_${stToPrune}`, { path: '/', secure: true, sameSite: 'Lax' });
      deleteCookie(c, `${OAUTH_TX_COOKIE_NONE}_${stToPrune}`, { path: '/', secure: true, sameSite: 'None' });
    }
  }
}

export const authRouter = new Hono<{
  Bindings: WorkerEnv;
  Variables: AuthVariables & { testJwksKey?: JwtVerifyKey };
}>();

// ----------------------------------------------------------------------------
// 1. Session Retrieval Endpoint
// ----------------------------------------------------------------------------
authRouter.get('/get-session', async (c) => {
  const token = extractSessionToken(c);
  if (!token || !c.env?.DB) {
    return c.json(null, 200);
  }

  const auth = await validateSession(c.env.DB, token);
  if (!auth) {
    return c.json(null, 200);
  }

  return c.json({ user: auth.user, session: auth.session }, 200);
});

// ----------------------------------------------------------------------------
// 2. Sign Out Endpoint
// ----------------------------------------------------------------------------
authRouter.post('/sign-out', async (c) => {
  const token = extractSessionToken(c);

  if (token && c.env?.DB) {
    await revokeSession(c.env.DB, token);
  }

  // Clear session cookies across web domains
  deleteCookie(c, SESSION_COOKIE_NAME, {
    path: '/',
    secure: true,
    sameSite: 'Lax',
  });

  return c.json({ success: true, message: 'Signed out successfully' }, 200);
});

// ----------------------------------------------------------------------------
// 3. Social Sign-In Initiation (Zero D1 Writes — SEC-05)
// ----------------------------------------------------------------------------
async function handleSocialSignIn(c: any) {
  let provider = 'google';
  let platform: 'web' | 'android' = 'web';
  let clientCodeChallenge: string | null = null;

  if (c.req.method === 'POST') {
    try {
      const body = await c.req.json();
      if (body?.provider) provider = String(body.provider).toLowerCase();
      if (body?.platform === 'android') platform = 'android';
      if (body?.client_code_challenge) clientCodeChallenge = String(body.client_code_challenge);
    } catch {
      // Fallback to query params if body parsing fails
    }
  }

  const queryProvider = c.req.query('provider');
  if (queryProvider) provider = queryProvider.toLowerCase();

  const queryPlatform = c.req.query('platform');
  if (queryPlatform === 'android') platform = 'android';

  const queryChallenge = c.req.query('client_code_challenge');
  if (queryChallenge) clientCodeChallenge = queryChallenge;

  if (provider !== 'google') {
    return c.json(
      {
        error: 'UNSUPPORTED_PROVIDER',
        message: `Authentication provider '${provider}' is not supported. Only 'google' is supported.`,
      },
      400
    );
  }

  const clientId = c.env?.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return c.json(
      {
        error: 'CONFIGURATION_ERROR',
        message: 'Google OAuth client ID is not configured on this server.',
      },
      503
    );
  }

  const currentUrl = new URL(c.req.url);
  const redirectUri = `${currentUrl.origin}/api/auth/callback/google`;

  // Cryptographic transaction parameters
  const state = generateSecureToken(24);
  const nonce = generateSecureToken(24); // SEC-09
  const pkce = await generatePkcePair();

  // HARDENING (SEC-05): Encrypt transaction state into an authenticated JWE cookie (0 D1 writes!)
  let secretKey: Uint8Array;
  try {
    secretKey = await getAuthSecretKey(c.env?.AUTH_SECRET, c.env?.APP_ENV);
  } catch (err: any) {
    return c.json(
      {
        error: 'CONFIGURATION_ERROR',
        message: err.message || 'AUTH_SECRET must be configured in production environments.',
      },
      503
    );
  }

  // Prune expired transaction cookies and bound outstanding concurrent transactions (FIFO)
  try {
    await pruneStaleTransactionCookies(c, secretKey);
  } catch {
    // Non-blocking cleanup
  }

  const oauthTxToken = await encryptOAuthTx(
    {
      state,
      nonce,
      codeVerifier: pkce.codeVerifier,
      clientCodeChallenge,
      platform,
      redirectUri,
      createdAt: Date.now(),
    },
    secretKey
  );

  // HARDENING (SEC-05 & OAUTH-RESILIENCE):
  // 1. Issue root path ('/') cookie so top-level cross-site redirect navigations are never stripped by subpath rules.
  // 2. Issue dual cookies (SameSite=Lax AND SameSite=None; Secure) for cross-browser resilience (Safari ITP / WebViews).
  // 3. Issue state-scoped cookies (stylesaathi_oauth_tx_${state}) to isolate concurrent multi-tab login attempts.
  // 4. Retain primary stylesaathi_oauth_tx cookie for backward compatibility with existing tests and clients.
  const cookieOptionsBase = {
    path: '/',
    httpOnly: true,
    secure: true,
    maxAge: 600, // 10 minutes TTL
  };

  // Primary Lax cookie
  setCookie(c, OAUTH_TX_COOKIE_NAME, oauthTxToken, {
    ...cookieOptionsBase,
    sameSite: 'Lax',
  });

  // Cross-site None; Secure fallback cookie
  setCookie(c, OAUTH_TX_COOKIE_NONE, oauthTxToken, {
    ...cookieOptionsBase,
    sameSite: 'None',
  });

  // State-scoped transaction cookies (prevents multi-tab overwrite race conditions)
  setCookie(c, `${OAUTH_TX_COOKIE_NAME}_${state}`, oauthTxToken, {
    ...cookieOptionsBase,
    sameSite: 'Lax',
  });

  setCookie(c, `${OAUTH_TX_COOKIE_NONE}_${state}`, oauthTxToken, {
    ...cookieOptionsBase,
    sameSite: 'None',
  });

  // Also maintain legacy subpath cookie for backward compatibility during live worker rolling deployment
  setCookie(c, OAUTH_TX_COOKIE_NAME, oauthTxToken, {
    path: '/api/auth',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 600,
  });

  const authUrl = buildGoogleAuthorizationUrl({
    clientId,
    redirectUri,
    state,
    codeChallenge: pkce.codeChallenge,
    nonce,
  });

  if (c.req.method === 'GET' && !c.req.header('Accept')?.includes('application/json')) {
    return c.redirect(authUrl, 302);
  }

  return c.json({ url: authUrl, state }, 200);
}

authRouter.get('/sign-in/social', handleSocialSignIn);
authRouter.post('/sign-in/social', handleSocialSignIn);

// ----------------------------------------------------------------------------
// 4. Google OAuth Callback Handler (Hardened)
// ----------------------------------------------------------------------------
authRouter.get('/callback/google', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');
  const errorDescription = c.req.query('error_description');

  // Helper for reporting callback errors:
  // For top-level browser navigations, redirects to frontend #auth_error=... (never exposes raw JSON!)
  // For programmatic / unit tests (without text/html), returns HTTP JSON with exact error code
  const handleCallbackError = (
    errorCode: string,
    errorMessage: string,
    statusCode: 400 | 403 | 503 = 400,
    clientErrorCode: string = 'auth_failed'
  ) => {
    const isBrowserDoc =
      c.req.header('Accept')?.includes('text/html') ||
      c.req.header('Sec-Fetch-Dest') === 'document';

    if (isBrowserDoc) {
      const baseUrl = c.env?.APP_URL || 'https://stylesaathi.pages.dev';
      const redirectTarget = `${baseUrl.replace(/\/+$/, '')}/#auth_error=${encodeURIComponent(clientErrorCode)}`;
      return c.redirect(redirectTarget, 302);
    }

    return c.json(
      {
        error: errorCode,
        message: errorMessage,
      },
      statusCode
    );
  };

  if (error) {
    const isAccessDenied = error === 'access_denied';
    return handleCallbackError(
      'OAUTH_PROVIDER_ERROR',
      errorDescription || error,
      400,
      isAccessDenied ? 'access_denied' : 'provider_error'
    );
  }

  if (!code || !state) {
    return handleCallbackError(
      'BAD_REQUEST',
      'Missing required OAuth parameter: code or state.',
      400,
      'missing_parameters'
    );
  }

  if (!c.env?.DB) {
    return handleCallbackError(
      'DATABASE_UNAVAILABLE',
      'Database binding is not available.',
      503,
      'database_unavailable'
    );
  }

  // 1. Read and decrypt OAuth transaction cookie (SEC-05)
  // Check state-specific cookies first (multi-tab isolation), then global fallback
  const stateScopedLax = state ? getCookie(c, `${OAUTH_TX_COOKIE_NAME}_${state}`) : undefined;
  const stateScopedNone = state ? getCookie(c, `${OAUTH_TX_COOKIE_NONE}_${state}`) : undefined;
  const globalLax = getCookie(c, OAUTH_TX_COOKIE_NAME);
  const globalNone = getCookie(c, OAUTH_TX_COOKIE_NONE);

  const txCookie = stateScopedLax || stateScopedNone || globalLax || globalNone;
  const usedGlobalFallback = !stateScopedLax && !stateScopedNone && Boolean(globalLax || globalNone);

  if (!txCookie) {
    return handleCallbackError(
      'INVALID_STATE',
      'OAuth transaction state has expired or cookie is missing.',
      400,
      'session_expired'
    );
  }

  let secretKey: Uint8Array;
  try {
    secretKey = await getAuthSecretKey(c.env?.AUTH_SECRET, c.env?.APP_ENV);
  } catch (err: any) {
    return handleCallbackError(
      'CONFIGURATION_ERROR',
      err.message || 'AUTH_SECRET must be configured in production environments.',
      503,
      'config_error'
    );
  }
  const stateData = await decryptOAuthTx(txCookie, secretKey);

  // Validate state BEFORE touching cookies!
  if (!stateData || stateData.state !== state) {
    // If state parameter matches an invalid or malformed state-scoped cookie, clean that one only.
    // Crucially: NEVER delete global fallback or other active transactions on a mismatched callback!
    if (state && (stateScopedLax || stateScopedNone)) {
      deleteCookie(c, `${OAUTH_TX_COOKIE_NAME}_${state}`, { path: '/', secure: true, sameSite: 'Lax' });
      deleteCookie(c, `${OAUTH_TX_COOKIE_NONE}_${state}`, { path: '/', secure: true, sameSite: 'None' });
    }
    return handleCallbackError(
      'INVALID_STATE',
      'OAuth state parameter does not match the authenticated transaction.',
      400,
      'state_mismatch'
    );
  }

  // Atomic single-use consumption: consume ONLY the transaction matching this verified callback
  if (state) {
    deleteCookie(c, `${OAUTH_TX_COOKIE_NAME}_${state}`, { path: '/', secure: true, sameSite: 'Lax' });
    deleteCookie(c, `${OAUTH_TX_COOKIE_NONE}_${state}`, { path: '/', secure: true, sameSite: 'None' });
  }

  // Only if this transaction actually came from the legacy global fallback cookie, clear the global cookie
  if (usedGlobalFallback) {
    deleteCookie(c, OAUTH_TX_COOKIE_NAME, { path: '/', secure: true, sameSite: 'Lax' });
    deleteCookie(c, OAUTH_TX_COOKIE_NONE, { path: '/', secure: true, sameSite: 'None' });
    deleteCookie(c, OAUTH_TX_COOKIE_NAME, { path: '/api/auth', secure: true, sameSite: 'Lax' });
  }

  const clientId = c.env?.GOOGLE_CLIENT_ID;
  const clientSecret = c.env?.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return handleCallbackError(
      'CONFIGURATION_ERROR',
      'Google OAuth credentials are not fully configured.',
      503,
      'config_error'
    );
  }

  try {
    // 2. Exchange authorization code for tokens
    const tokens = await exchangeGoogleCodeForTokens({
      code,
      codeVerifier: stateData.codeVerifier,
      redirectUri: stateData.redirectUri,
      clientId,
      clientSecret,
    });

    // 3. Cryptographically verify Google ID token (SEC-03 & SEC-09)
    // Allows injecting test JWKS key in automated unit testing environments
    const testJwksKey = c.env?.TEST_JWKS_KEY;
    const profile = await verifyGoogleIdToken(tokens.id_token, clientId, {
      keyOrJwks: testJwksKey,
      expectedNonce: stateData.nonce,
    });

    // 4. Provision user & account in D1, enforcing verified email (SEC-04)
    const ipAddress = c.req.header('CF-Connecting-IP') || null;
    const userAgent = c.req.header('User-Agent') || null;

    const { user, sessionToken } = await provisionUserAndSession(
      c.env.DB,
      profile,
      {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        idToken: tokens.id_token,
        expiresIn: tokens.expires_in,
      },
      { ipAddress, userAgent }
    );

    // 5. Unified PKCE Exchange-Code Delivery (Phase 3F.10A.3)
    // CRITICAL SECURITY INVARIANT (SEC-02):
    // Neither Web nor Android ever receives a raw bearer token in URLs!
    // Both platforms receive a single-use, 60-second exchange code bound to clientCodeChallenge.
    const exchangeCode = await createExchangeCode(
      c.env.DB,
      sessionToken,
      user.id,
      stateData.clientCodeChallenge
    );

    if (stateData.platform === 'android') {
      const deepLink = `stylesaathi://auth/callback?code=${encodeURIComponent(exchangeCode)}`;
      return c.redirect(deepLink, 302);
    }

    // Web platform: Deliver single-use exchange code via URL fragment (#code=<exchange_code>)
    // The web client reads the code, immediately scrubs the URL fragment via history.replaceState(),
    // and redeems it via TLS POST /api/auth/exchange-code with its in-memory PKCE code_verifier.
    const baseUrl = c.env?.APP_URL || 'https://stylesaathi.pages.dev';
    const webRedirectUrl = `${baseUrl}/#code=${encodeURIComponent(exchangeCode)}`;
    return c.redirect(webRedirectUrl, 302);
  } catch (err: any) {
    return handleCallbackError(
      'AUTHENTICATION_FAILED',
      err.message || 'Authentication with Google failed.',
      400,
      'auth_failed'
    );
  }
});

// ----------------------------------------------------------------------------
// 5. Unified Authorization Exchange-Code Endpoint (Web & Android — SEC-02 & SEC-08)
// ----------------------------------------------------------------------------
authRouter.post('/exchange-code', async (c) => {
  if (!c.env?.DB) {
    return c.json(
      {
        error: 'DATABASE_UNAVAILABLE',
        message: 'Database binding is not available.',
      },
      503
    );
  }

  let code: string | undefined;
  let codeVerifier: string | undefined;

  try {
    const body = await c.req.json();
    code = body?.code;
    codeVerifier = body?.code_verifier;
  } catch {
    return c.json(
      {
        error: 'BAD_REQUEST',
        message: 'Invalid JSON request body. Expected { code, code_verifier }.',
      },
      400
    );
  }

  if (!code) {
    return c.json(
      {
        error: 'BAD_REQUEST',
        message: 'Missing required exchange code parameter.',
      },
      400
    );
  }

  try {
    // Atomically consumes exchange code (SEC-08) and validates PKCE challenge (SEC-02)
    const { sessionToken, userId } = await consumeExchangeCode(c.env.DB, code, codeVerifier);

    return c.json(
      {
        sessionToken,
        userId,
      },
      200
    );
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (msg.includes('PKCE_VERIFICATION_FAILED')) {
      return c.json(
        {
          error: 'PKCE_VERIFICATION_FAILED',
          message: 'PKCE code verifier does not match the registered challenge.',
        },
        403
      );
    }

    return c.json(
      {
        error: 'INVALID_EXCHANGE_CODE',
        message: msg || 'Exchange code is invalid, expired, or has already been used.',
      },
      400
    );
  }
});

// ----------------------------------------------------------------------------
// 6. Protected Identity Verification Endpoint (/api/auth/me)
// ----------------------------------------------------------------------------
authRouter.get('/me', authMiddleware(), (c) => {
  return c.json(
    {
      user: c.get('user'),
      session: c.get('session'),
    },
    200
  );
});

// ----------------------------------------------------------------------------
// 7. Protected Account Deletion Endpoint (/api/auth/delete-account)
// Phase 3E.2: Cryptographic Tombstone Insertion & Complete Cascade Deletion
// ----------------------------------------------------------------------------
authRouter.post('/delete-account', authMiddleware(), async (c) => {
  const user = c.get('user');

  if (!user || !user.id || !c.env?.DB) {
    return c.json(
      {
        error: 'UNAUTHORIZED',
        message: 'Valid authenticated session required for account deletion.',
      },
      401
    );
  }

  // Optional targetUserId verification: enforce strict ownership (SEC-04)
  let targetUserId = user.id;
  try {
    const body = await c.req.json();
    if (body?.targetUserId) {
      if (body.targetUserId !== user.id) {
        return c.json(
          {
            error: 'FORBIDDEN',
            message: 'You are not authorized to delete another user account.',
          },
          403
        );
      }
      targetUserId = body.targetUserId;
    }
  } catch {
    // Body is optional; continue if empty or non-JSON
  }

  const userId = targetUserId;
  const requestId = crypto.randomUUID
    ? crypto.randomUUID()
    : `del-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const userIdHash = await sha256Hex(userId);
  const secretHash = await sha256Hex(`${userId}:${user.email || ''}:${Date.now()}`);
  const nowIso = new Date().toISOString();
  // Retain tombstone for 90 days to prevent zombie account resurrection
  const expiresAtIso = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Insert deletion tombstone (idempotent / upsert)
  await c.env.DB.prepare(
    `INSERT OR REPLACE INTO deletion_tombstones (request_id, secret_hash, user_id_hash, deleted_at, expires_at, reconciled)
     VALUES (?, ?, ?, ?, ?, 1)`
  )
    .bind(requestId, secretHash, userIdHash, nowIso, expiresAtIso)
    .run();

  // 2. Cascade delete all user records atomically using batch
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM session WHERE userId = ?').bind(userId),
    c.env.DB.prepare('DELETE FROM account WHERE userId = ?').bind(userId),
    c.env.DB.prepare('DELETE FROM profiles WHERE id = ?').bind(userId),
    c.env.DB.prepare('DELETE FROM wardrobe_items WHERE user_id = ?').bind(userId),
    c.env.DB.prepare('DELETE FROM saved_outfits WHERE user_id = ?').bind(userId),
    c.env.DB.prepare('DELETE FROM calendar_plans WHERE user_id = ?').bind(userId),
    c.env.DB.prepare('DELETE FROM style_preferences WHERE user_id = ?').bind(userId),
    c.env.DB.prepare('DELETE FROM wear_events WHERE user_id = ?').bind(userId),
    c.env.DB.prepare('DELETE FROM style_signals WHERE user_id = ?').bind(userId),
    c.env.DB.prepare('DELETE FROM sync_mutations WHERE user_id = ?').bind(userId),
    c.env.DB.prepare('DELETE FROM user WHERE id = ?').bind(userId),
  ]);

  // 3. Clear session cookie
  deleteCookie(c, SESSION_COOKIE_NAME, {
    path: '/',
    secure: true,
    sameSite: 'Lax',
  });

  return c.json(
    {
      success: true,
      message: 'Account and all associated records deleted permanently.',
      requestId,
      deletedAt: nowIso,
    },
    200
  );
});
