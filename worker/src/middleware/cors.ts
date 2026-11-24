// ============================================================================
// STYLESAATHI 3.0 — CORS & ORIGIN VALIDATION MIDDLEWARE
// Workstream 1: D1 Database & Worker Scaffolding
// ============================================================================

import { MiddlewareHandler } from 'hono';
import { WorkerEnv } from '../types';

export const DEFAULT_ALLOWED_ORIGINS = [
  'https://stylesaathi.pages.dev',
  'http://localhost:5173',
  'http://localhost:4173',
  'capacitor://localhost',
  'https://localhost',
];

export function resolveAllowedOrigins(env?: WorkerEnv): Set<string> {
  const custom = env?.ALLOWED_ORIGINS;
  if (!custom || typeof custom !== 'string') {
    return new Set(DEFAULT_ALLOWED_ORIGINS);
  }
  const origins = custom
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return new Set(origins.length > 0 ? origins : DEFAULT_ALLOWED_ORIGINS);
}

export const corsGuard = (): MiddlewareHandler<{ Bindings: WorkerEnv }> => {
  return async (c, next) => {
    const origin = c.req.header('Origin');
    const allowedSet = resolveAllowedOrigins(c.env);

    // If no origin header is provided (e.g. server-to-server or curl), allow through
    if (!origin) {
      await next();
      return;
    }

    const isAllowed = allowedSet.has(origin);

    // Handle preflight OPTIONS request
    if (c.req.method === 'OPTIONS') {
      if (!isAllowed) {
        return c.text('CORS origin unauthorized', 403);
      }

      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Client-Version, X-Deletion-Secret',
          'Access-Control-Max-Age': '86400',
          'Vary': 'Origin',
        },
      });
    }

    // Process actual request
    await next();

    // If origin is allowed, append CORS response headers
    if (isAllowed) {
      c.header('Access-Control-Allow-Origin', origin);
      c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      c.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Client-Version, X-Deletion-Secret');
      c.header('Vary', 'Origin');
    }
  };
};

