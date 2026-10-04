import { describe, it, expect, beforeEach } from 'vitest';
import { SyncQueue } from '../lib/sync/syncQueue';

describe('Production Sync Queue', () => {
  let queue: SyncQueue;

  beforeEach(async () => {
    queue = new SyncQueue();
    await queue.clear();
  });

  it('enqueues mutations and preserves FIFO order', async () => {
    const m1 = await queue.enqueue({
      entityType: 'wardrobe_item',
      entityId: 'item-1',
      operation: 'UPSERT',
      payload: { id: 'item-1', name: 'Item 1' } as any,
    });

    const m2 = await queue.enqueue({
      entityType: 'wardrobe_item',
      entityId: 'item-2',
      operation: 'UPSERT',
      payload: { id: 'item-2', name: 'Item 2' } as any,
    });

    const all = await queue.getAllMutations();
    expect(all).toHaveLength(2);
    expect(all[0].id).toBe(m1.id);
    expect(all[1].id).toBe(m2.id);

    const next = await queue.peekNext();
    expect(next?.id).toBe(m1.id);
  });

  it('enforces dependency awareness: dependent mutation waits until dependency resolves', async () => {
    // 1. Enqueue image upload mutation
    const uploadMut = await queue.enqueue({
      entityType: 'wardrobe_image',
      entityId: 'photo-123',
      operation: 'UPLOAD_IMAGE',
      payload: { itemId: 'item-1', photoId: 'photo-123', storagePath: 'path/1.jpg' },
    });

    // 2. Enqueue item upsert mutation that depends on the image upload
    const itemMut = await queue.enqueue({
      entityType: 'wardrobe_item',
      entityId: 'item-1',
      operation: 'UPSERT',
      payload: { id: 'item-1', name: 'Silk Saree' } as any,
      dependencies: [uploadMut.id],
    });

    // First peek should yield the image upload, NOT the item upsert
    const firstRunnable = await queue.peekNext();
    expect(firstRunnable?.id).toBe(uploadMut.id);

    // Simulate image upload in-flight
    await queue.markInFlight(uploadMut.id);

    // With image upload in-flight, item upsert still cannot run
    const secondRunnable = await queue.peekNext();
    expect(secondRunnable).toBeNull();

    // Image upload completes successfully
    await queue.markSuccess(uploadMut.id);

    // Now item upsert is unblocked and runnable!
    const thirdRunnable = await queue.peekNext();
    expect(thirdRunnable?.id).toBe(itemMut.id);
  });

  it('calculates exponential backoff and tracks attempt counts on failure', async () => {
    const mut = await queue.enqueue({
      entityType: 'wardrobe_item',
      entityId: 'item-err',
      operation: 'UPSERT',
      payload: { id: 'item-err', name: 'Err Item' } as any,
      maxAttempts: 3,
    });

    // Fail attempt 1
    await queue.markFailed(mut.id, 'Temporary network timeout');
    let all = await queue.getAllMutations();
    expect(all[0].attemptCount).toBe(1);
    expect(all[0].status).toBe('pending');
    expect(all[0].nextRetryAt).toBeGreaterThan(Date.now());

    // Fail attempt 2
    await queue.markFailed(mut.id, 'Temporary 503');
    all = await queue.getAllMutations();
    expect(all[0].attemptCount).toBe(2);

    // Fail attempt 3 (exhausted)
    await queue.markFailed(mut.id, 'Server offline');
    all = await queue.getAllMutations();
    expect(all[0].attemptCount).toBe(3);
    expect(all[0].status).toBe('dead_letter');

    // Dead letter mutation should not be returned by peekNext
    const next = await queue.peekNext();
    expect(next).toBeNull();
  });

  it('marks permanent errors (e.g., RLS violation) as dead_letter immediately', async () => {
    const mut = await queue.enqueue({
      entityType: 'wardrobe_item',
      entityId: 'forbidden-1',
      operation: 'UPSERT',
      payload: { id: 'forbidden-1', name: 'Forbidden' } as any,
    });

    await queue.markFailed(mut.id, 'RLS policy violation: 42501', true);
    const all = await queue.getAllMutations();
    expect(all[0].status).toBe('dead_letter');
    expect(all[0].attemptCount).toBe(1);
  });

  // ==========================================================================
  // O. Queue Crash Recovery
  // ==========================================================================
  describe('O. Queue crash recovery', () => {
    it('resets in_flight mutations back to pending on recoverFromCrash', async () => {
      const mut1 = await queue.enqueue({
        entityType: 'wardrobe_item',
        entityId: 'item-crash',
        operation: 'UPSERT',
        payload: { id: 'item-crash', name: 'Crash Item' } as any,
      });

      // Browser starts processing and crashes while in-flight
      await queue.markInFlight(mut1.id);
      let all = await queue.getAllMutations();
      expect(all[0].status).toBe('in_flight');

      // On app reboot / service initialization, recoverFromCrash is called
      await queue.recoverFromCrash();

      all = await queue.getAllMutations();
      expect(all[0].status).toBe('pending');

      const next = await queue.peekNext();
      expect(next?.id).toBe(mut1.id);
    });
  });
});
