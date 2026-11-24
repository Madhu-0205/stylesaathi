// ============================================================================
// STYLESAATHI 3.0 — AUTHENTICATION MIDDLEWARE (HARDENED)
// Custom Cloudflare Worker & D1 Authentication Service
// ============================================================================

import type { Context, MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import type { WorkerEnv, AuthVariables } from '../types';
import { validateSession } from '../auth/session';

export const SESSION_COOKIE_NAME = 'stylesaathi_session';

/**
 * Extracts the session token from either:
 * 1. Authorization: Bearer <token> (Primary for Capacitor Android and API clients)
 * 2. Cookie stylesaathi_session (For web browsers)
 */
export function extractSessionToken(c: Context): string | null {
  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token.length > 0) return token;
  }

  const cookieToken = getCookie(c, SESSION_COOKIE_NAME);
  if (cookieToken && cookieToken.trim().length > 0) {
    return cookieToken.trim();
  }

  return null;
}

/**
 * Hono middleware that requires a valid, unexpired session in D1.
 * Rejects unauthenticated requests with 401 Unauthorized.
 * Injects `user` and `session` into context variables upon success.
 */
export function authMiddleware(): MiddlewareHandler<{
  Bindings: WorkerEnv;
  Variables: AuthVariables;
}> {
  return async (c, next) => {
    const token = extractSessionToken(c);

    if (!token) {
      return c.json(
        {
          error: 'UNAUTHORIZED',
          message: 'Authentication required. No session token provided in Authorization header or cookie.',
        },
        401
      );
    }

    if (!c.env?.DB) {
      return c.json(
        {
          error: 'DATABASE_UNAVAILABLE',
          message: 'Authentication service is currently unavailable.',
        },
        503
      );
    }

    const auth = await validateSession(c.env.DB, token);

    if (!auth) {
      return c.json(
        {
          error: 'UNAUTHORIZED',
          message: 'Session is invalid, expired, or has been revoked. Please sign in again.',
        },
        401
      );
    }

    c.set('user', auth.user);
    c.set('session', auth.session);

    await next();
  };
}

