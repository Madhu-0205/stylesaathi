// ============================================================================
// STYLESAATHI 3.0 — DELTA SYNCHRONIZATION API ROUTES
// Phase 3C: POST /api/sync/push & GET /api/sync/pull
// ============================================================================

import { Hono } from 'hono';
import type { WorkerEnv, AuthVariables } from '../types';
import { authMiddleware } from '../middleware/auth';
import {
  normalizeAndValidateMutation,
  MAX_PAYLOAD_BYTES,
  MAX_MUTATIONS_PER_BATCH,
  type NormalizedMutation,
} from './validation';
import { processPushMutations } from './push';
import { pullDeltas, decodeCursor } from './pull';
import type { SyncPushRequest, SyncPushResponse } from './types';

export const syncRouter = new Hono<{
  Bindings: WorkerEnv;
  Variables: AuthVariables;
}>();

// All sync routes require authenticated session
syncRouter.use('*', authMiddleware());

// ----------------------------------------------------------------------------
// 1. Authenticated Push Endpoint: POST /api/sync/push
// ----------------------------------------------------------------------------
syncRouter.post('/push', async (c) => {
  const user = c.get('user');
  if (!user || !user.id) {
    return c.json({ error: 'UNAUTHORIZED', message: 'Authentication required' }, 401);
  }

  if (!c.env?.DB) {
    return c.json({ error: 'DATABASE_UNAVAILABLE', message: 'Database binding unavailable' }, 503);
  }

  // 1. Payload size guard
  const contentLength = c.req.header('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_BYTES) {
    return c.json(
      {
        error: 'PAYLOAD_TOO_LARGE',
        message: `Sync payload exceeds maximum size limit of ${MAX_PAYLOAD_BYTES} bytes.`,
      },
      413
    );
  }

  let body: SyncPushRequest;
  try {
    const rawText = await c.req.text();
    if (new TextEncoder().encode(rawText).length > MAX_PAYLOAD_BYTES) {
      return c.json(
        {
          error: 'PAYLOAD_TOO_LARGE',
          message: `Sync payload exceeds maximum size limit of ${MAX_PAYLOAD_BYTES} bytes.`,
        },
        413
      );
    }
    body = JSON.parse(rawText);
  } catch {
    return c.json({ error: 'MALFORMED_PAYLOAD', message: 'Invalid JSON request body.' }, 400);
  }

  if (!body || !Array.isArray(body.mutations)) {
    return c.json(
      {
        error: 'INVALID_MUTATION_BATCH',
        message: 'Request body must contain a non-empty mutations array.',
      },
      400
    );
  }

  if (body.mutations.length === 0) {
    return c.json(
      {
        error: 'INVALID_MUTATION_BATCH',
        message: 'Mutations array cannot be empty.',
      },
      400
    );
  }

  if (body.mutations.length > MAX_MUTATIONS_PER_BATCH) {
    return c.json(
      {
        error: 'BATCH_SIZE_EXCEEDED',
        message: `Batch mutation count exceeds maximum of ${MAX_MUTATIONS_PER_BATCH} items.`,
      },
      400
    );
  }

  // 2. Validate and normalize each mutation
  const normalizedMutations: NormalizedMutation[] = [];
  for (let i = 0; i < body.mutations.length; i++) {
    const { mutation, error } = normalizeAndValidateMutation(body.mutations[i], i);
    if (error || !mutation) {
      return c.json({ error: 'VALIDATION_FAILED', message: error || 'Validation error' }, 400);
    }
    normalizedMutations.push(mutation);
  }

  // 3. Process mutations atomically within user boundary
  try {
    const results = await processPushMutations(c.env.DB, user.id, normalizedMutations);

    const response: SyncPushResponse = {
      success: true,
      processed: results.length,
      results,
      serverTime: new Date().toISOString(),
    };

    return c.json(response, 200);
  } catch (err: any) {
    console.error('Sync push execution error:', err);
    return c.json(
      {
        error: 'INTERNAL_ERROR',
        message: c.env?.APP_ENV === 'production' ? 'Sync push execution failed' : err.message,
      },
      500
    );
  }
});

// ----------------------------------------------------------------------------
// 2. Authenticated Pull Endpoint: GET /api/sync/pull
// ----------------------------------------------------------------------------
syncRouter.get('/pull', async (c) => {
  const user = c.get('user');
  if (!user || !user.id) {
    return c.json({ error: 'UNAUTHORIZED', message: 'Authentication required' }, 401);
  }

  if (!c.env?.DB) {
    return c.json({ error: 'DATABASE_UNAVAILABLE', message: 'Database binding unavailable' }, 503);
  }

  const since = c.req.query('since') || null;
  const cursor = c.req.query('cursor') || null;
  const limitQuery = c.req.query('limit');
  const limit = limitQuery ? parseInt(limitQuery, 10) : 100;

  if (cursor) {
    try {
      decodeCursor(cursor);
    } catch {
      return c.json(
        {
          error: 'INVALID_CURSOR',
          message: 'Supplied pagination cursor is malformed or invalid.',
        },
        400
      );
    }
  }

  try {
    const result = await pullDeltas(c.env.DB, user.id, {
      since,
      cursor,
      limit: isNaN(limit) ? 100 : limit,
    });

    return c.json(result, 200);
  } catch (err: any) {
    console.error('Sync pull execution error:', err);
    return c.json(
      {
        error: 'INTERNAL_ERROR',
        message: c.env?.APP_ENV === 'production' ? 'Sync pull execution failed' : err.message,
      },
      500
    );
  }
});

