// ============================================================================
// STYLESAATHI 3.0 — WORKER SYNC CLIENT
// Workstream 5 & Workstream 6: Strict ₹0 & Local Image Boundaries
// ============================================================================

import type { SyncMutation } from '../../types';
import { getWorkerBaseUrl } from '../auth/pkce';

export class QuotaExceededError extends Error {
  public retryAfterMs: number;
  constructor(message = 'Cloudflare D1 daily quota limit reached', retryAfterMs = 3600000) {
    super(message);
    this.name = 'QuotaExceededError';
    this.retryAfterMs = retryAfterMs;
  }
}

export interface ClientSyncPushResult {
  mutationId: string;
  entityType: string;
  entityId: string;
  status: 'applied' | 'already_applied' | 'conflict_server_wins' | 'rejected';
  serverUpdatedAt?: string;
  conflictData?: Record<string, any>;
  error?: string;
}

export interface ClientSyncPushResponse {
  success: boolean;
  processed: number;
  results: ClientSyncPushResult[];
  serverTime: string;
}

export interface ClientSyncPullResponse {
  success: boolean;
  changes: {
    wardrobe_items: any[];
    saved_outfits: any[];
    calendar_plans: any[];
    style_preferences: any | null;
    wear_events: any[];
    style_signals: any[];
  };
  nextCursor: string | null;
  hasMore: boolean;
  serverTime: string;
}

/**
 * Detects whether an HTTP status or error payload indicates Cloudflare Worker / D1 quota exhaustion.
 */
export function isQuotaExhaustedError(status: number, messageOrCode?: string): boolean {
  if (status === 429) return true;
  if (!messageOrCode) return false;
  const lower = String(messageOrCode).toLowerCase();
  return (
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('limit exceeded') ||
    lower.includes('too many requests') ||
    lower.includes('d1_quota_exceeded')
  );
}

/**
 * Sanitizes mutation payload to guarantee NO local image blobs or base64 data leave the device (Workstream 6).
 */
export function sanitizeMutationPayload(mutation: SyncMutation): Record<string, any> {
  const raw = (mutation as any).payload || {};
  const clean: Record<string, any> = {};

  for (const [key, value] of Object.entries(raw)) {
    // Strip local blob URLs and raw photo fields that are device-local
    if (key === 'photo') {
      continue;
    }
    if (typeof value === 'string' && (value.startsWith('blob:') || value.startsWith('data:image/'))) {
      continue;
    }
    clean[key] = value;
  }

  return clean;
}

export class WorkerSyncClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl =
      baseUrl ||
      (typeof import.meta !== 'undefined' && import.meta.env
        ? import.meta.env.VITE_WORKER_URL || import.meta.env.VITE_API_URL || getWorkerBaseUrl()
        : getWorkerBaseUrl());
  }

  private getHeaders(token?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * Pushes a batch of local mutations to the Worker /api/sync/push endpoint.
   */
  async pushMutations(
    mutations: SyncMutation[],
    authToken?: string
  ): Promise<ClientSyncPushResponse> {
    if (!mutations || mutations.length === 0) {
      return {
        success: true,
        processed: 0,
        results: [],
        serverTime: new Date().toISOString(),
      };
    }

    // Filter out client-side image-only mutations (images stay 100% device-local in IndexedDB)
    const validMutations = mutations.filter((m) => m.entityType !== 'wardrobe_image');
    if (validMutations.length === 0) {
      return {
        success: true,
        processed: 0,
        results: mutations.map((m) => ({
          mutationId: m.id,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'applied',
        })),
        serverTime: new Date().toISOString(),
      };
    }

    const payload = {
      mutations: validMutations.map((m) => {
        const rawPayload = (m as any).payload || {};
        const expectedRevision =
          (m as any).expectedRevision ??
          rawPayload.expectedRevision ??
          rawPayload.revision ??
          rawPayload.version;
        return {
          mutationId: m.id,
          entityType: m.entityType,
          entityId: m.entityId,
          expectedRevision: typeof expectedRevision === 'number' ? expectedRevision : undefined,
          action:
            m.operation === 'DELETE'
              ? 'delete'
              : m.operation === 'APPEND_WEAR' || m.operation === 'APPEND_SIGNAL'
              ? 'append'
              : 'upsert',
          clientTimestamp: m.clientTimestamp || Date.now(),
          data: sanitizeMutationPayload(m),
        };
      }),
    };

    const url = `${this.baseUrl}/api/sync/push`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(authToken),
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    if (res.status === 429) {
      throw new QuotaExceededError('D1 daily write quota exhausted (HTTP 429)');
    }

    const body: any = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (isQuotaExhaustedError(res.status, body?.message || body?.error)) {
        throw new QuotaExceededError(body?.message || 'D1 quota exhausted');
      }
      const err: any = new Error(body?.message || `Sync push failed with status ${res.status}`);
      err.status = res.status;
      throw err;
    }

    return body as ClientSyncPushResponse;
  }

  /**
   * Pulls remote deltas since the specified timestamp or pagination cursor.
   */
  async pullDeltas(
    options: { since?: string | null; cursor?: string | null; limit?: number },
    authToken?: string
  ): Promise<ClientSyncPullResponse> {
    const params = new URLSearchParams();
    if (options.since) params.set('since', options.since);
    if (options.cursor) params.set('cursor', options.cursor);
    if (options.limit) params.set('limit', String(options.limit));

    const url = `${this.baseUrl}/api/sync/pull${params.toString() ? `?${params.toString()}` : ''}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(authToken),
      credentials: 'include',
    });

    if (res.status === 429) {
      throw new QuotaExceededError('D1 daily read quota exhausted (HTTP 429)');
    }

    const body: any = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (isQuotaExhaustedError(res.status, body?.message || body?.error)) {
        throw new QuotaExceededError(body?.message || 'D1 quota exhausted');
      }
      const err: any = new Error(body?.message || `Sync pull failed with status ${res.status}`);
      err.status = res.status;
      throw err;
    }

    return body as ClientSyncPullResponse;
  }
}

export const workerSyncClient = new WorkerSyncClient();

