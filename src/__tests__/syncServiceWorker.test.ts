// ============================================================================
// STYLESAATHI 3.0 — SYNC SERVICE WORKER INTEGRATION TESTS
// Workstream 5 & Workstream 6: Worker Backend, Quota Pause, & Image Protection
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { syncService } from '../lib/sync/syncService';
import { syncQueue } from '../lib/sync/syncQueue';
import { workerSyncClient, QuotaExceededError } from '../lib/sync/workerSyncClient';
import { wardrobeRepository } from '../repositories/LocalStorageWardrobeRepository';
import type { User, WardrobeItem } from '../types';

describe('Workstream 5 & 6: SyncService Worker Backend Integration', () => {
  const testUser: User = {
    id: 'user-sync-test',
    email: 'user@stylesaathi.in',
    name: 'Priya Sharma',
    isGuest: false,
    createdAt: Date.now(),
  };

  beforeEach(async () => {
    await syncQueue.clear();
    syncQueue.resumeFromQuota();
    syncService.setCurrentUser(testUser);
    syncService.setSyncBackend('worker');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('processes queued mutations via Worker backend and marks success', async () => {
    const pushSpy = vi.spyOn(workerSyncClient, 'pushMutations').mockResolvedValue({
      success: true,
      processed: 1,
      results: [
        {
          mutationId: 'mut-work-1',
          entityType: 'wardrobe_item',
          entityId: 'item-1',
          status: 'applied',
          serverUpdatedAt: '2026-11-07T00:00:00.000Z',
        },
      ],
      serverTime: '2026-11-07T00:00:00.000Z',
    });

    const m = await syncQueue.enqueue({
      id: 'mut-work-1',
      entityType: 'wardrobe_item',
      entityId: 'item-1',
      operation: 'UPSERT',
      payload: { id: 'item-1', name: 'Linen Kurti' } as any,
    });

    await syncService.processQueue();

    expect(pushSpy).toHaveBeenCalled();
    const remaining = await syncQueue.getAllMutations();
    expect(remaining).toHaveLength(0); // Successfully processed and removed
    expect(syncService.getStatus()).toBe('synced');
  });

  it('reconciles local state when server returns conflict_server_wins', async () => {
    // Local item exists
    const localItem: WardrobeItem = {
      id: 'item-conflict-1',
      name: 'Local Version',
      category: 'Tops',
      subcategory: 't-shirt',
      colors: ['blue'],
      seasons: ['summer'],
      occasions: ['everyday'],
      formality: 2,
      status: 'clean',
      favorite: false,
      note: '',
      timesWorn: 0,
      photo: 'blob:local-image-url',
      clientUpdatedAt: 1000,
    };
    await wardrobeRepository.clear();
    await wardrobeRepository.upsertItemRaw(localItem);

    // Server returns newer conflicting version
    vi.spyOn(workerSyncClient, 'pushMutations').mockResolvedValue({
      success: true,
      processed: 1,
      results: [
        {
          mutationId: 'mut-conf-1',
          entityType: 'wardrobe_item',
          entityId: 'item-conflict-1',
          status: 'conflict_server_wins',
          serverUpdatedAt: '2026-11-07T00:10:00.000Z',
          conflictData: {
            id: 'item-conflict-1',
            user_id: testUser.id,
            name: 'Server Authoritative Version',
            category: 'Tops',
            subcategory: 'T-Shirt',
            colors: JSON.stringify(['red']),
            seasons: JSON.stringify(['all']),
            occasions: JSON.stringify(['formal']),
            formality: 4,
            status: 'clean',
            server_updated_at: '2026-11-07T00:10:00.000Z',
            client_updated_at: '2026-11-07T00:10:00.000Z',
          },
        },
      ],
      serverTime: '2026-11-07T00:10:00.000Z',
    });

    await syncQueue.enqueue({
      id: 'mut-conf-1',
      entityType: 'wardrobe_item',
      entityId: 'item-conflict-1',
      operation: 'UPSERT',
      payload: localItem,
    });

    await syncService.processQueue();

    // Verify local item updated with server-authoritative data
    const updatedLocal = await wardrobeRepository.getItem('item-conflict-1');
    expect(updatedLocal?.name).toBe('Server Authoritative Version');
    expect(updatedLocal?.formality).toBe(4);
    // Crucial (Workstream 6): Local photo blob retained!
    expect(updatedLocal?.photo).toBe('blob:local-image-url');

    // Mutation is marked complete because conflict was resolved
    const queueItems = await syncQueue.getAllMutations();
    expect(queueItems).toHaveLength(0);
  });

  it('pauses sync on D1 quota exhaustion without dead-lettering pending mutations', async () => {
    vi.spyOn(workerSyncClient, 'pushMutations').mockRejectedValue(
      new QuotaExceededError('D1 daily write quota exhausted (HTTP 429)')
    );

    const m = await syncQueue.enqueue({
      id: 'mut-quota-test',
      entityType: 'wardrobe_item',
      entityId: 'item-q-test',
      operation: 'UPSERT',
      payload: { id: 'item-q-test', name: 'Festive Saree' } as any,
      maxAttempts: 3,
    });

    await syncService.processQueue();

    expect(syncService.getStatus()).toBe('error');
    expect(syncService.getLastError()).toContain('cloud daily quota reached');

    // Verify queue is paused
    expect(syncQueue.isQuotaPaused()).toBe(true);

    // Verify mutation NOT dead-lettered and attempt count NOT incremented
    const all = await syncQueue.getAllMutations();
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe('pending');
    expect(all[0].attemptCount).toBe(0);
  });

  it('preserves local IndexedDB photo URLs when pulling remote deltas', async () => {
    // Local item with device-local photo blob
    const localItem: WardrobeItem = {
      id: 'item-pull-img',
      name: 'Local Item Name',
      category: 'Bottoms',
      subcategory: 'jeans',
      colors: ['black'],
      seasons: ['summer'],
      occasions: ['casual outing'],
      formality: 2,
      status: 'clean',
      favorite: false,
      note: '',
      timesWorn: 0,
      photo: 'blob:device-local-object-url-1234',
      serverUpdatedAt: '2026-11-06T00:00:00.000Z',
    };
    await wardrobeRepository.clear();
    await wardrobeRepository.upsertItemRaw(localItem);

    // Remote delta pull returns metadata update without photo blob
    vi.spyOn(workerSyncClient, 'pullDeltas').mockResolvedValue({
      success: true,
      changes: {
        wardrobe_items: [
          {
            id: 'item-pull-img',
            user_id: testUser.id,
            name: 'Updated Jeans (From Cloud)',
            category: 'Bottoms',
            subcategory: 'Jeans',
            colors: ['black', 'charcoal'],
            seasons: ['all'],
            occasions: ['casual'],
            formality: 2,
            status: 'clean',
            server_updated_at: '2026-11-07T00:00:00.000Z',
          },
        ],
        saved_outfits: [],
        calendar_plans: [],
        style_preferences: null,
        wear_events: [],
        style_signals: [],
      },
      nextCursor: null,
      hasMore: false,
      serverTime: '2026-11-07T00:00:00.000Z',
    });

    await syncService.pullRemoteDeltas();

    const reconciled = await wardrobeRepository.getItem('item-pull-img');
    expect(reconciled?.name).toBe('Updated Jeans (From Cloud)');
    // CRITICAL: Local device photo blob URL is NOT lost or wiped
    expect(reconciled?.photo).toBe('blob:device-local-object-url-1234');
  });
});
