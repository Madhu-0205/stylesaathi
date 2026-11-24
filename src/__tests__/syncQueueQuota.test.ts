// ============================================================================
// STYLESAATHI 3.0 — LOCAL SYNC QUEUE QUOTA & IDEMPOTENCE TESTS
// Workstream 5: Bounded-Quota Handling & Crash Recovery
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { SyncQueue } from '../lib/sync/syncQueue';

describe('Workstream 5: SyncQueue Quota Exhaustion & Invariant Tests', () => {
  let queue: SyncQueue;

  beforeEach(async () => {
    queue = new SyncQueue();
    await queue.clear();
    queue.resumeFromQuota();
  });

  it('correctly pauses on D1 quota exhaustion without incrementing attempt count or dead-lettering', async () => {
    const mut = await queue.enqueue({
      entityType: 'wardrobe_item',
      entityId: 'item-quota-1',
      operation: 'UPSERT',
      payload: { id: 'item-quota-1', name: 'Banarasi Dupatta' } as any,
      maxAttempts: 3,
    });

    expect(mut.attemptCount).toBe(0);
    expect(mut.status).toBe('pending');

    // Mark in-flight
    await queue.markInFlight(mut.id);

    // Encounter D1 quota error: call markFailed with isQuota = true
    await queue.markFailed(mut.id, 'D1 daily quota limit reached', false, true);

    const all = await queue.getAllMutations();
    const updated = all.find((m) => m.id === mut.id);

    expect(updated).toBeDefined();
    // Critical Invariant 1: attemptCount MUST NOT increment on quota failure
    expect(updated?.attemptCount).toBe(0);
    // Critical Invariant 2: status MUST NOT be dead_letter
    expect(updated?.status).toBe('pending');
    expect(updated?.lastError).toContain('quota');
    // Critical Invariant 3: nextRetryAt set in future
    expect(updated?.nextRetryAt).toBeGreaterThan(Date.now());

    // Critical Invariant 4: Queue is paused, peekNext returns null
    expect(queue.isQuotaPaused()).toBe(true);
    const nextRunnable = await queue.peekNext();
    expect(nextRunnable).toBeNull();
  });

  it('safely resumes queue execution after quota reset window', async () => {
    const mut = await queue.enqueue({
      entityType: 'wardrobe_item',
      entityId: 'item-quota-2',
      operation: 'UPSERT',
      payload: { id: 'item-quota-2', name: 'Cotton Chinos' } as any,
    });

    // Simulate quota pause
    await queue.markFailed(mut.id, 'D1_QUOTA_EXCEEDED', false, true);
    expect(queue.isQuotaPaused()).toBe(true);
    expect(await queue.peekNext()).toBeNull();

    // Reset quota window
    queue.resumeFromQuota();
    expect(queue.isQuotaPaused()).toBe(false);

    // Fast-forward retry timestamp to allow immediate peek
    const all = await queue.getAllMutations();
    const m = all[0];
    m.nextRetryAt = Date.now() - 1000;
    (queue as any).memoryQueue?.set(m.id, m);

    // Mutation is ready to run again
    const resumed = await queue.peekNext();
    expect(resumed?.id).toBe(mut.id);
  });

  it('markQuotaExhausted resets in-flight mutations to pending without incrementing attempts', async () => {
    const m1 = await queue.enqueue({
      entityType: 'wardrobe_item',
      entityId: 'item-1',
      operation: 'UPSERT',
      payload: { id: 'item-1', name: 'Item 1' } as any,
    });
    const m2 = await queue.enqueue({
      entityType: 'saved_outfit',
      entityId: 'outfit-1',
      operation: 'UPSERT',
      payload: { id: 'outfit-1', name: 'Outfit 1' } as any,
    });

    await queue.markInFlight(m1.id);
    await queue.markInFlight(m2.id);

    // Entire batch fails with HTTP 429 quota exhaustion
    await queue.markQuotaExhausted(3600000);

    expect(queue.isQuotaPaused()).toBe(true);

    const all = await queue.getAllMutations();
    for (const m of all) {
      expect(m.status).toBe('pending');
      expect(m.attemptCount).toBe(0);
      expect(m.lastError).toBe('D1_QUOTA_EXCEEDED');
    }
  });

  it('crash recovery resets in-flight operations to pending without losing queued data', async () => {
    const m1 = await queue.enqueue({
      entityType: 'calendar_plan',
      entityId: 'plan-crash-1',
      operation: 'UPSERT',
      payload: { id: 'plan-crash-1', date: '2026-11-10' } as any,
    });

    await queue.markInFlight(m1.id);

    // Simulate crash and reboot
    await queue.recoverFromCrash();

    const all = await queue.getAllMutations();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(m1.id);
    expect(all[0].status).toBe('pending');
  });
});

