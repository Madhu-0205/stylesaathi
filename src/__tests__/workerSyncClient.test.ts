// ============================================================================
// STYLESAATHI 3.0 — WORKER SYNC CLIENT TESTS
// Workstream 5 & Workstream 6: Quota Awareness & Device-Local Image Boundary
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  WorkerSyncClient,
  QuotaExceededError,
  isQuotaExhaustedError,
  sanitizeMutationPayload,
} from '../lib/sync/workerSyncClient';
import type { SyncMutation } from '../types';

describe('Workstream 5 & 6: WorkerSyncClient Tests', () => {
  let client: WorkerSyncClient;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    client = new WorkerSyncClient('https://api.stylesaathi.test');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('isQuotaExhaustedError classification', () => {
    it('identifies HTTP 429 as quota exhausted', () => {
      expect(isQuotaExhaustedError(429)).toBe(true);
      expect(isQuotaExhaustedError(429, 'Too Many Requests')).toBe(true);
    });

    it('identifies error messages containing quota or limit exceeded keywords', () => {
      expect(isQuotaExhaustedError(400, 'D1_QUOTA_EXCEEDED')).toBe(true);
      expect(isQuotaExhaustedError(500, 'Daily request limit exceeded')).toBe(true);
      expect(isQuotaExhaustedError(400, 'Database size limit exceeded')).toBe(true);
      expect(isQuotaExhaustedError(400, 'Rate limit exceeded')).toBe(true);
    });

    it('does not classify standard errors as quota errors', () => {
      expect(isQuotaExhaustedError(401, 'Unauthorized')).toBe(false);
      expect(isQuotaExhaustedError(404, 'Not Found')).toBe(false);
      expect(isQuotaExhaustedError(400, 'Validation failed')).toBe(false);
      expect(isQuotaExhaustedError(500, 'Internal server error')).toBe(false);
    });
  });

  describe('sanitizeMutationPayload (Image Boundary)', () => {
    it('strips local photo blob URLs and base64 strings from mutation payload', () => {
      const mutation: SyncMutation = {
        id: 'mut-1',
        clientTimestamp: Date.now(),
        attemptCount: 0,
        maxAttempts: 5,
        nextRetryAt: 0,
        lastError: null,
        status: 'pending',
        entityType: 'wardrobe_item',
        entityId: 'item-1',
        operation: 'UPSERT',
        payload: {
          id: 'item-1',
          name: 'Indigo Cotton Shirt',
          photo: 'blob:http://localhost:5173/12345-6789', // Local blob URL
          photoId: 'photo-uuid-1',
          category: 'Tops',
          subcategory: 'Shirt',
          formality: 3,
        } as any,
      };

      const sanitized = sanitizeMutationPayload(mutation);

      expect(sanitized.id).toBe('item-1');
      expect(sanitized.name).toBe('Indigo Cotton Shirt');
      expect(sanitized.photoId).toBe('photo-uuid-1');
      // Crucial: photo field MUST BE STRIPPED
      expect(sanitized.photo).toBeUndefined();
    });

    it('strips data:image base64 strings from any field in payload', () => {
      const mutation: SyncMutation = {
        id: 'mut-2',
        clientTimestamp: Date.now(),
        attemptCount: 0,
        maxAttempts: 5,
        nextRetryAt: 0,
        lastError: null,
        status: 'pending',
        entityType: 'wardrobe_item',
        entityId: 'item-2',
        operation: 'UPSERT',
        payload: {
          id: 'item-2',
          name: 'Silk Saree',
          rawImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA...',
        } as any,
      };

      const sanitized = sanitizeMutationPayload(mutation);
      expect(sanitized.rawImage).toBeUndefined();
    });
  });

  describe('pushMutations', () => {
    it('sends sanitized mutations to /api/sync/push and parses results', async () => {
      const mockResponse = {
        success: true,
        processed: 1,
        results: [
          {
            mutationId: 'mut-1',
            entityType: 'wardrobe_item',
            entityId: 'item-1',
            status: 'applied',
            serverUpdatedAt: '2026-11-07T00:00:00.000Z',
          },
        ],
        serverTime: '2026-11-07T00:00:00.000Z',
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const mutations: SyncMutation[] = [
        {
          id: 'mut-1',
          clientTimestamp: Date.now(),
          attemptCount: 0,
          maxAttempts: 5,
          nextRetryAt: 0,
          lastError: null,
          status: 'pending',
          entityType: 'wardrobe_item',
          entityId: 'item-1',
          operation: 'UPSERT',
          payload: { id: 'item-1', name: 'Cotton Shirt', photo: 'blob:...' } as any,
        },
      ];

      const res = await client.pushMutations(mutations, 'valid-auth-token');
      expect(res.success).toBe(true);
      expect(res.results[0].status).toBe('applied');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.stylesaathi.test/api/sync/push',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer valid-auth-token',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('throws QuotaExceededError on HTTP 429 response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: 'D1_QUOTA_EXCEEDED' }),
      });

      const mutations: SyncMutation[] = [
        {
          id: 'mut-quota',
          clientTimestamp: Date.now(),
          attemptCount: 0,
          maxAttempts: 5,
          nextRetryAt: 0,
          lastError: null,
          status: 'pending',
          entityType: 'wardrobe_item',
          entityId: 'item-q',
          operation: 'UPSERT',
          payload: { id: 'item-q', name: 'Kurta' } as any,
        },
      ];

      await expect(client.pushMutations(mutations)).rejects.toThrow(QuotaExceededError);
    });
  });

  describe('pullDeltas', () => {
    it('queries /api/sync/pull with query params and returns delta changes', async () => {
      const mockResponse = {
        success: true,
        changes: {
          wardrobe_items: [{ id: 'item-remote-1', name: 'Silk Dupatta' }],
          saved_outfits: [],
          calendar_plans: [],
          style_preferences: null,
          wear_events: [],
          style_signals: [],
        },
        nextCursor: null,
        hasMore: false,
        serverTime: '2026-11-07T00:00:00.000Z',
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const res = await client.pullDeltas({
        since: '2026-11-06T00:00:00.000Z',
        limit: 50,
      });

      expect(res.success).toBe(true);
      expect(res.changes.wardrobe_items).toHaveLength(1);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/sync/pull?since=2026-11-06T00%3A00%3A00.000Z&limit=50'),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('throws QuotaExceededError when pull returns 429', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: 'Daily request limit exceeded' }),
      });

      await expect(client.pullDeltas({ since: '2026-11-06T00:00:00.000Z' })).rejects.toThrow(
        QuotaExceededError
      );
    });
  });
});

