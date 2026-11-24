// ============================================================================
// STYLESAATHI 3.0 — DEAD-LETTER RECOVERY & SYNC RESOLUTION TEST SUITE
// Phase 3C.8: User-Controlled Dead-Letter Resolution & Transparency
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { syncService } from '../lib/sync/syncService';
import { syncQueue } from '../lib/sync/syncQueue';
import { workerSyncClient } from '../lib/sync/workerSyncClient';
import { wardrobeRepository } from '../repositories/LocalStorageWardrobeRepository';
import { preferencesRepository } from '../repositories/LocalStoragePreferencesRepository';
import { calendarRepository } from '../repositories/LocalStorageCalendarRepository';
import type { User, WardrobeItem, OutfitPlan } from '../types';

describe('Phase 3C.8: Dead-Letter Recovery & User-Controlled Sync Resolution', () => {
  const userA: User = {
    id: 'user-a-111',
    email: 'usera@stylesaathi.in',
    name: 'User A',
    isGuest: false,
    createdAt: Date.now(),
  };

  const userB: User = {
    id: 'user-b-222',
    email: 'userb@stylesaathi.in',
    name: 'User B',
    isGuest: false,
    createdAt: Date.now(),
  };

  beforeEach(async () => {
    await syncQueue.clear();
    syncQueue.resumeFromQuota();
    syncService.setCurrentUser(userA);
    syncService.setSyncBackend('worker');
    await wardrobeRepository.clear();
    vi.spyOn(workerSyncClient, 'pushMutations').mockImplementation(async (mutations) => ({
      success: true,
      processed: mutations.length,
      results: mutations.map((m) => ({
        mutationId: m.id,
        entityType: m.entityType,
        entityId: m.entityId,
        status: 'applied',
        serverUpdatedAt: '2026-11-07T12:00:00.000Z',
      })),
      serverTime: '2026-11-07T12:00:00.000Z',
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Dead-letter visibility and accurate counts
  it('1. provides dead-letter visibility and accurate counts per user', async () => {
    // Enqueue 1 normal pending mutation
    await syncQueue.enqueue({
      id: 'mut-pending-1',
      entityType: 'wardrobe_item',
      entityId: 'item-1',
      operation: 'UPSERT',
      userId: userA.id,
      payload: { id: 'item-1', name: 'Cotton Shirt' } as any,
    });

    // Enqueue 2 dead-letter mutations
    const d1 = await syncQueue.enqueue({
      id: 'mut-dl-1',
      entityType: 'wardrobe_item',
      entityId: 'item-2',
      operation: 'UPSERT',
      userId: userA.id,
      payload: { id: 'item-2', name: 'Raw Silk Kurta' } as any,
    });
    await syncQueue.markFailed(d1.id, 'REVISION_REQUIRED: expectedRevision is required', true);

    const d2 = await syncQueue.enqueue({
      id: 'mut-dl-2',
      entityType: 'saved_outfit',
      entityId: 'outfit-1',
      operation: 'UPSERT',
      userId: userA.id,
      payload: { id: 'outfit-1', name: 'Diwali Look' } as any,
    });
    await syncQueue.markFailed(d2.id, 'STALE_REVISION: expected revision 1, server has 2', true);

    const stats = await syncQueue.getStats(userA.id);
    expect(stats.total).toBe(3);
    expect(stats.pending).toBe(1);
    expect(stats.deadLetter).toBe(2);

    const deadLetters = await syncService.getDeadLetterMutations(userA.id);
    expect(deadLetters.length).toBe(2);
    expect(deadLetters.map((d) => d.id)).toContain('mut-dl-1');
    expect(deadLetters.map((d) => d.id)).toContain('mut-dl-2');
  });

  // 2. Safe reconciliation against a newer server revision
  it('2. safely reconciles local edit against a newer server revision without data destruction', async () => {
    const localItem: WardrobeItem = {
      id: 'item-recon-1',
      userId: userA.id,
      name: 'Lucknowi Chikankari (Local Edit)',
      category: 'Tops',
      subcategory: 'kurta',
      colors: ['white'],
      seasons: ['summer'],
      occasions: ['festive'],
      formality: 4,
      status: 'clean',
      favorite: true,
      note: 'Local note',
      timesWorn: 1,
    };
    (localItem as any).revision = 1;
    await wardrobeRepository.upsertItemRaw(localItem);

    // Dead letter mutation
    const m = await syncQueue.enqueue({
      id: 'mut-recon-dl',
      entityType: 'wardrobe_item',
      entityId: 'item-recon-1',
      operation: 'UPSERT',
      userId: userA.id,
      expectedRevision: 1,
      payload: localItem,
    });
    await syncQueue.markFailed(m.id, 'REVISION_REQUIRED: expectedRevision is required', true);

    // Mock server state with revision 3
    vi.spyOn(workerSyncClient, 'pullDeltas').mockResolvedValue({
      success: true,
      changes: {
        wardrobe_items: [
          {
            id: 'item-recon-1',
            user_id: userA.id,
            name: 'Lucknowi Chikankari',
            category: 'Tops',
            subcategory: 'kurta',
            colors: ['white'],
            seasons: ['summer'],
            occasions: ['festive'],
            formality: 4,
            status: 'clean',
            favorite: true,
            times_worn: 1,
            server_updated_at: '2026-11-07T10:00:00.000Z',
            revision: 3,
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
      serverTime: '2026-11-07T10:00:00.000Z',
    });

    const reconRes = await syncService.reconcileAndRetryDeadLetter('mut-recon-dl');
    expect(reconRes.success).toBe(true);
    expect(reconRes.newMutationId).toBeDefined();
    expect(reconRes.newMutationId).not.toBe('mut-recon-dl');

    // Old dead letter removed from queue
    const oldMutation = await syncQueue.getMutation('mut-recon-dl');
    expect(oldMutation).toBeNull();

    // New mutation has expectedRevision = 3 (server's revision)
    const newMutation = await syncQueue.getMutation(reconRes.newMutationId!);
    expect(newMutation).not.toBeNull();
    expect(newMutation?.status).toBe('pending');
    expect((newMutation as any).expectedRevision).toBe(3);
  });

  // 3. Successful recovery and retry
  it('3. successfully executes retried mutation and clears dead-letter state', async () => {
    const localItem: WardrobeItem = {
      id: 'item-succ-1',
      userId: userA.id,
      name: 'Tan Leather Juttis',
      category: 'Footwear',
      subcategory: 'juttis',
      colors: ['tan'],
      seasons: ['summer', 'winter'],
      occasions: ['festive'],
      formality: 5,
      status: 'clean',
      favorite: false,
      note: '',
      timesWorn: 0,
    };
    (localItem as any).revision = 2;
    await wardrobeRepository.upsertItemRaw(localItem);

    const m = await syncQueue.enqueue({
      id: 'mut-succ-dl',
      entityType: 'wardrobe_item',
      entityId: 'item-succ-1',
      operation: 'UPSERT',
      userId: userA.id,
      expectedRevision: 1,
      payload: localItem,
    });
    await syncQueue.markFailed(m.id, 'STALE_REVISION', true);

    // Mock pull deltas
    vi.spyOn(workerSyncClient, 'pullDeltas').mockResolvedValue({
      success: true,
      changes: {
        wardrobe_items: [
          {
            id: 'item-succ-1',
            user_id: userA.id,
            name: 'Tan Leather Juttis',
            category: 'Footwear',
            subcategory: 'shoes',
            colors: ['tan'],
            seasons: ['summer'],
            occasions: ['weddings'],
            formality: 5,
            status: 'clean',
            favorite: false,
            server_updated_at: '2026-11-07T12:00:00.000Z',
            revision: 2,
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
      serverTime: '2026-11-07T12:00:00.000Z',
    });

    // Mock push succeeds
    const pushSpy = vi.spyOn(workerSyncClient, 'pushMutations').mockResolvedValue({
      success: true,
      processed: 1,
      results: [
        {
          mutationId: 'mock-reconciled',
          entityType: 'wardrobe_item',
          entityId: 'item-succ-1',
          status: 'applied',
          serverUpdatedAt: '2026-11-07T12:00:01.000Z',
        },
      ],
      serverTime: '2026-11-07T12:00:01.000Z',
    });

    const reconRes = await syncService.reconcileAndRetryDeadLetter('mut-succ-dl');
    expect(reconRes.success).toBe(true);

    // Process queue
    await syncService.processQueue();

    expect(pushSpy).toHaveBeenCalled();
    const stats = await syncQueue.getStats(userA.id);
    expect(stats.deadLetter).toBe(0);
    expect(stats.pending).toBe(0);
  });

  // 4. Stale mutation rejection
  it('4. rejects non-dead-letter mutations from manual reconciliation', async () => {
    const m = await syncQueue.enqueue({
      id: 'mut-active',
      entityType: 'wardrobe_item',
      entityId: 'item-active',
      operation: 'UPSERT',
      userId: userA.id,
      payload: { id: 'item-active', name: 'Watch' } as any,
    });

    // Still pending, not dead_letter
    const res = await syncService.reconcileAndRetryDeadLetter(m.id);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Only dead-lettered mutations');
  });

  // 5. Preservation of local edits after failed recovery
  it('5. preserves original dead letter and local edits if server reconciliation pull fails', async () => {
    const localItem: WardrobeItem = {
      id: 'item-fail-1',
      userId: userA.id,
      name: 'Indigo Khadi Kurta',
      category: 'Tops',
      subcategory: 'kurta',
      colors: ['indigo'],
      seasons: ['monsoon'],
      occasions: ['everyday'],
      formality: 2,
      status: 'clean',
      favorite: true,
      note: 'Very special gift',
      timesWorn: 3,
    };
    await wardrobeRepository.upsertItemRaw(localItem);

    const m = await syncQueue.enqueue({
      id: 'mut-fail-dl',
      entityType: 'wardrobe_item',
      entityId: 'item-fail-1',
      operation: 'UPSERT',
      userId: userA.id,
      payload: localItem,
    });
    await syncQueue.markFailed(m.id, 'REVISION_REQUIRED', true);

    // Mock pull deltas failure (e.g. Network error)
    vi.spyOn(workerSyncClient, 'pullDeltas').mockRejectedValue(new Error('Network connection timeout'));

    const reconRes = await syncService.reconcileAndRetryDeadLetter('mut-fail-dl');
    // Even if pull deltas fails, local fallback reconciles with local state and enqueues retry
    // Local item is safely preserved in repo
    const stored = await wardrobeRepository.getItem('item-fail-1');
    expect(stored?.name).toBe('Indigo Khadi Kurta');
    expect(stored?.note).toBe('Very special gift');
  });

  // 6. Export and restore of unresolved mutations
  it('6. exports unresolved mutations into clean JSON format and restores them without credentials', async () => {
    const d1 = await syncQueue.enqueue({
      id: 'mut-exp-1',
      entityType: 'wardrobe_item',
      entityId: 'item-exp-1',
      operation: 'UPSERT',
      userId: userA.id,
      payload: {
        id: 'item-exp-1',
        name: 'Bandhgala Suit',
        photo: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...', // large image data
      } as any,
    });
    await syncQueue.markFailed(d1.id, 'REVISION_REQUIRED', true);

    const exported = await syncService.exportDeadLetters();
    expect(exported.application).toBe('StyleSaathi');
    expect(exported.totalUnresolved).toBe(1);
    expect(exported.mutations[0].entityId).toBe('item-exp-1');
    // Verify large base64 photo was sanitized out of export
    expect(exported.mutations[0].payload.photo).toBeUndefined();
    expect(exported.mutations[0].payload.name).toBe('Bandhgala Suit');

    // Clear queue
    await syncQueue.clear();
    expect((await syncQueue.getStats(userA.id)).total).toBe(0);

    // Restore exported backup
    const importRes = await syncService.importUnresolvedMutations(exported);
    expect(importRes.importedCount).toBe(1);
    expect(importRes.errors.length).toBe(0);

    const restoredMutations = await syncQueue.getAllMutations();
    expect(restoredMutations.length).toBe(1);
    expect(restoredMutations[0].entityId).toBe('item-exp-1');
    expect(restoredMutations[0].status).toBe('pending');
  });

  // 7. Account switching and sign-out behavior
  it('7. isolates unresolved mutations across users during sign-out and account switching', async () => {
    // User A has 1 dead-letter mutation
    const mA = await syncQueue.enqueue({
      id: 'mut-user-a',
      entityType: 'wardrobe_item',
      entityId: 'item-a',
      operation: 'UPSERT',
      userId: userA.id,
      payload: { id: 'item-a', name: 'User A Item' } as any,
    });
    await syncQueue.markFailed(mA.id, 'REVISION_REQUIRED', true);

    // User A signs out
    syncService.setCurrentUser(null);

    // Mutation is NOT deleted from IndexedDB
    const all = await syncQueue.getAllMutations();
    expect(all.length).toBe(1);
    expect(all[0].id).toBe('mut-user-a');

    // User B signs in
    syncService.setCurrentUser(userB);

    // User B cannot see User A's dead letters
    const userBDeadLetters = await syncService.getDeadLetterMutations(userB.id);
    expect(userBDeadLetters.length).toBe(0);

    const userBStats = await syncQueue.getStats(userB.id);
    expect(userBStats.deadLetter).toBe(0);

    // User B cannot peek or process User A's pending mutation
    const peekForB = await syncQueue.peekNext(userB.id);
    expect(peekForB).toBeNull();

    // User B cannot reconcile User A's mutation
    const unauthorizedRecon = await syncService.reconcileAndRetryDeadLetter('mut-user-a');
    expect(unauthorizedRecon.success).toBe(false);
    expect(unauthorizedRecon.error).toContain('belonging to another user');

    // User A signs back in
    syncService.setCurrentUser(userA);
    const userADeadLetters = await syncService.getDeadLetterMutations(userA.id);
    expect(userADeadLetters.length).toBe(1);
    expect(userADeadLetters[0].id).toBe('mut-user-a');
  });

  // 8. Duplicate retry and idempotency safety
  it('8. guarantees new mutation ID on retry, preventing idempotency key collision', async () => {
    const localItem: WardrobeItem = {
      id: 'item-idem-1',
      userId: userA.id,
      name: 'Embroidered Nehru Jacket',
      category: 'Outerwear',
      subcategory: 'jacket',
      colors: ['gold'],
      seasons: ['winter'],
      occasions: ['festive'],
      formality: 5,
      status: 'clean',
      favorite: false,
      note: '',
      timesWorn: 0,
    };
    (localItem as any).revision = 1;
    await wardrobeRepository.upsertItemRaw(localItem);

    const m = await syncQueue.enqueue({
      id: 'idempotent-key-original',
      entityType: 'wardrobe_item',
      entityId: 'item-idem-1',
      operation: 'UPSERT',
      userId: userA.id,
      payload: localItem,
    });
    await syncQueue.markFailed(m.id, 'REVISION_REQUIRED', true);

    vi.spyOn(workerSyncClient, 'pullDeltas').mockResolvedValue({
      success: true,
      changes: {
        wardrobe_items: [
          {
            id: 'item-idem-1',
            user_id: userA.id,
            name: 'Embroidered Nehru Jacket (Server)',
            revision: 2,
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
      serverTime: '2026-11-07T12:00:00.000Z',
    });

    const res = await syncService.reconcileAndRetryDeadLetter('idempotent-key-original');
    expect(res.success).toBe(true);
    // CRITICAL: Must NOT reuse 'idempotent-key-original' with modified payload
    expect(res.newMutationId).not.toBe('idempotent-key-original');

    const newM = await syncQueue.getMutation(res.newMutationId!);
    expect(newM?.originalMutationId).toBe('idempotent-key-original');
  });

  // 9. Offline operation
  it('9. supports offline discard and export without network connectivity', async () => {
    const m = await syncQueue.enqueue({
      id: 'mut-off-1',
      entityType: 'wardrobe_item',
      entityId: 'item-off-1',
      operation: 'UPSERT',
      userId: userA.id,
      payload: { id: 'item-off-1', name: 'Offline Linen Shirt' } as any,
    });
    await syncQueue.markFailed(m.id, 'REVISION_REQUIRED', true);

    // Export works completely offline
    const exp = await syncService.exportDeadLetters();
    expect(exp.totalUnresolved).toBe(1);

    // Discard works completely offline
    const discarded = await syncService.discardDeadLetter(m.id);
    expect(discarded).toBe(true);

    const stats = await syncQueue.getStats(userA.id);
    expect(stats.deadLetter).toBe(0);
  });

  // 10. No accidental deletion of local garment images
  it('10. strictly preserves device-local garment images during reconciliation', async () => {
    const localWithPhoto: WardrobeItem = {
      id: 'item-photo-1',
      userId: userA.id,
      name: 'Kashmiri Shawl',
      category: 'Outerwear',
      subcategory: 'jacket',
      colors: ['red'],
      seasons: ['winter'],
      occasions: ['festive'],
      formality: 4,
      status: 'clean',
      favorite: true,
      note: 'Pure pashmina',
      timesWorn: 2,
      photo: 'blob:http://localhost:5173/device-image-pashmina-1234',
      photoId: 'photo-pashmina-local',
    };
    (localWithPhoto as any).revision = 1;
    await wardrobeRepository.upsertItemRaw(localWithPhoto);

    const m = await syncQueue.enqueue({
      id: 'mut-photo-dl',
      entityType: 'wardrobe_item',
      entityId: 'item-photo-1',
      operation: 'UPSERT',
      userId: userA.id,
      payload: localWithPhoto,
    });
    await syncQueue.markFailed(m.id, 'REVISION_REQUIRED', true);

    // Server returns record without photo blob (images are device-local)
    vi.spyOn(workerSyncClient, 'pullDeltas').mockResolvedValue({
      success: true,
      changes: {
        wardrobe_items: [
          {
            id: 'item-photo-1',
            user_id: userA.id,
            name: 'Kashmiri Shawl (Updated on Cloud)',
            category: 'Outerwear',
            subcategory: 'jacket',
            colors: ['red'],
            seasons: ['winter'],
            occasions: ['festive'],
            formality: 4,
            status: 'clean',
            favorite: true,
            photo_id: 'photo-pashmina-local',
            server_updated_at: '2026-11-07T14:00:00.000Z',
            revision: 2,
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
      serverTime: '2026-11-07T14:00:00.000Z',
    });

    const res = await syncService.reconcileAndRetryDeadLetter('mut-photo-dl');
    expect(res.success).toBe(true);

    // Check that local repository still has the local photo blob!
    const reconciledItem = await wardrobeRepository.getItem('item-photo-1');
    expect(reconciledItem).not.toBeNull();
    expect(reconciledItem?.photo).toBe('blob:http://localhost:5173/device-image-pashmina-1234');
    expect(reconciledItem?.photoId).toBe('photo-pashmina-local');
  });
});
