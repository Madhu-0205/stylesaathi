// ============================================================================
// STYLESAATHI 3.0 — CLOUDFLARE WORKER ENTRY POINT
// Workstream 1: D1 Database & Worker Foundation
// ============================================================================

import { Hono } from 'hono';
import { WorkerEnv, AuthVariables, HealthCheckResponse } from './types';
import { corsGuard } from './middleware/cors';
import { authRouter } from './auth/routes';
import { syncRouter } from './sync/routes';

export const app = new Hono<{ Bindings: WorkerEnv; Variables: AuthVariables }>();

// 1. Global Middleware
app.use('*', corsGuard());

// 2. Custom Authentication Router (Hono & D1 Zero-Cost Service)
app.route('/api/auth', authRouter);

// 3. Delta Synchronization Router (Phase 3C)
app.route('/api/sync', syncRouter);

// 4. Health Check Endpoint
app.get('/api/health', async (c) => {
  const start = Date.now();
  let dbStatus: 'connected' | 'unconfigured' | 'error' = 'unconfigured';
  let dbError: string | undefined;

  if (c.env?.DB) {
    const isProductionOrStaging = c.env?.APP_ENV === 'production' || c.env?.APP_ENV === 'staging';
    try {
      const res = await c.env.DB.prepare('SELECT 1 as alive').first<{ alive: number }>();
      if (res && res.alive === 1) {
        dbStatus = 'connected';
      } else {
        dbStatus = 'error';
        dbError = isProductionOrStaging
          ? 'Database service unavailable'
          : 'Unexpected database ping response';
      }
    } catch (err: any) {
      dbStatus = 'error';
      // In production and staging, mask raw database exceptions to avoid leaking SQL structure or internal errors
      dbError = isProductionOrStaging
        ? 'Database service unavailable'
        : String(err?.message || 'Database connection error');
    }
  }

  const latencyMs = Date.now() - start;
  const isProduction = c.env?.APP_ENV === 'production';
  const isHealthy =
    dbStatus === 'connected' ||
    (dbStatus === 'unconfigured' && !isProduction);

  const body: HealthCheckResponse = {
    status: isHealthy ? 'ok' : 'degraded',
    service: 'stylesaathi-api',
    version: '3.0.0-phase3c',
    timestamp: new Date().toISOString(),
    environment: c.env?.APP_ENV || 'development',
    database: dbStatus,
    details: {
      latencyMs,
      ...(dbError ? { error: dbError } : {}),
    },
  };

  return c.json(body, isHealthy ? 200 : 503);
});

// 3. Fallback 404 Handler
app.notFound((c) => {
  return c.json(
    {
      error: 'NOT_FOUND',
      message: `The requested endpoint ${c.req.method} ${c.req.path} was not found on this server.`,
    },
    404
  );
});

// 4. Global Error Handler
app.onError((err, c) => {
  console.error('Unhandled Worker error:', err);
  return c.json(
    {
      error: 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred processing your request.',
    },
    500
  );
});

export default app;

