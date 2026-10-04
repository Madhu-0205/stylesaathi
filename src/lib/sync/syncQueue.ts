import { get, set, del, entries, clear, createStore, UseStore } from 'idb-keyval';
import { SyncMutation } from '../../types';

const DB_NAME = 'stylesaathi-sync-queue-db';
const STORE_NAME = 'mutations';

let queueStore: UseStore | undefined;
try {
  if (typeof indexedDB !== 'undefined') {
    queueStore = createStore(DB_NAME, STORE_NAME);
  }
} catch {
  // Graceful fallback for environments where createStore fails
}

// In-memory fallback for headless/test environments
const memoryQueue = new Map<string, SyncMutation>();

type QueueListener = () => void;
const listeners = new Set<QueueListener>();

function notifyListeners() {
  listeners.forEach((l) => {
    try {
      l();
    } catch (e) {
      console.error('SyncQueue listener error:', e);
    }
  });
}

export class SyncQueue {
  private customStore: UseStore | undefined;

  constructor(customStore?: UseStore) {
    this.customStore = customStore || queueStore;
  }

  private async getStoreEntries(): Promise<[string, SyncMutation][]> {
    try {
      if (this.customStore) {
        return await entries<string, SyncMutation>(this.customStore);
      }
    } catch {
      // Fallback
    }
    return Array.from(memoryQueue.entries());
  }

  private async setMutation(id: string, mutation: SyncMutation): Promise<void> {
    try {
      if (this.customStore) {
        await set(id, mutation, this.customStore);
        memoryQueue.set(id, mutation);
        notifyListeners();
        return;
      }
    } catch {
      // Fallback to memory
    }
    memoryQueue.set(id, mutation);
    notifyListeners();
  }

  private async removeMutation(id: string): Promise<void> {
    try {
      if (this.customStore) {
        await del(id, this.customStore);
      }
    } catch {
      // Fallback
    }
    memoryQueue.delete(id);
    notifyListeners();
  }

  /**
   * Recovers from crashes by resetting any 'in_flight' mutations to 'pending'.
   * Should be called when app boots or sync engine initializes.
   */
  async recoverFromCrash(): Promise<void> {
    const all = await this.getAllMutations();
    for (const m of all) {
      if (m.status === 'in_flight') {
        const recovered: SyncMutation = {
          ...m,
          status: 'pending',
        };
        await this.setMutation(m.id, recovered);
      }
    }
  }

  /**
   * Enqueues a new typed mutation into the persistent queue.
   */
  async enqueue(
    mutationInput: Omit<
      SyncMutation,
      'id' | 'clientTimestamp' | 'attemptCount' | 'maxAttempts' | 'nextRetryAt' | 'lastError' | 'status'
    > & {
      id?: string;
      maxAttempts?: number;
      dependencies?: string[];
    }
  ): Promise<SyncMutation> {
    const id =
      (mutationInput as any).mutationId ||
      mutationInput.id ||
      (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `mut-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);

    const now = Date.now();
    const mutation: SyncMutation = {
      ...(mutationInput as any),
      id,
      mutationId: id,
      createdAt: (mutationInput as any).createdAt || now,
      clientTimestamp: now,
      attemptCount: 0,
      maxAttempts: mutationInput.maxAttempts || 5,
      nextRetryAt: 0,
      lastError: null,
      status: 'pending',
      dependencies: mutationInput.dependencies || [],
    };

    await this.setMutation(id, mutation);
    return mutation;
  }

  /**
   * Retrieves all mutations currently in the queue, sorted by timestamp (FIFO).
   */
  async getAllMutations(): Promise<SyncMutation[]> {
    const allEntries = await this.getStoreEntries();
    return allEntries
      .map(([, m]) => m)
      .sort((a, b) => a.clientTimestamp - b.clientTimestamp);
  }

  /**
   * Returns next runnable mutation whose dependencies have completed and retry window is open.
   */
  async peekNext(): Promise<SyncMutation | null> {
    const now = Date.now();
    const all = await this.getAllMutations();
    const existingIds = new Set(all.map((m) => m.id));

    for (const m of all) {
      // Must be pending and ready for retry
      if (m.status !== 'pending' || m.nextRetryAt > now) {
        continue;
      }

      // Check dependencies: all dependencies must have resolved (no longer in queue)
      const hasUnresolvedDeps = m.dependencies?.some((depId) => existingIds.has(depId));
      if (hasUnresolvedDeps) {
        continue;
      }

      return m;
    }

    return null;
  }

  /**
   * Marks a mutation as currently in flight.
   */
  async markInFlight(id: string): Promise<void> {
    const all = await this.getAllMutations();
    const mutation = all.find((m) => m.id === id);
    if (!mutation) return;

    const updated: SyncMutation = {
      ...mutation,
      status: 'in_flight',
    };
    await this.setMutation(id, updated);
  }

  /**
   * Removes a successfully processed mutation from the queue.
   */
  async markSuccess(id: string): Promise<void> {
    await this.removeMutation(id);
  }

  /**
   * Records a failure and updates retry backoff or marks as dead_letter.
   */
  async markFailed(id: string, errorMessage: string, isPermanent = false): Promise<void> {
    const all = await this.getAllMutations();
    const mutation = all.find((m) => m.id === id);
    if (!mutation) return;

    const attempts = mutation.attemptCount + 1;
    const isExhausted = isPermanent || attempts >= mutation.maxAttempts;

    // Exponential backoff with jitter: min(1000 * 2^attempts + jitter, 60000)
    const baseDelay = Math.min(1000 * Math.pow(2, attempts), 60000);
    const jitter = Math.random() * 500;
    const nextRetryAt = isExhausted ? 0 : Date.now() + baseDelay + jitter;

    const updated: SyncMutation = {
      ...mutation,
      attemptCount: attempts,
      lastError: errorMessage,
      nextRetryAt,
      status: isExhausted ? 'dead_letter' : 'pending',
    };

    await this.setMutation(id, updated);
  }

  /**
   * Returns current statistics of the queue.
   */
  async getStats(): Promise<{
    pending: number;
    inFlight: number;
    failed: number;
    deadLetter: number;
    total: number;
  }> {
    const all = await this.getAllMutations();
    let pending = 0;
    let inFlight = 0;
    let failed = 0;
    let deadLetter = 0;

    for (const m of all) {
      if (m.status === 'pending') {
        if (m.attemptCount > 0) failed++;
        else pending++;
      } else if (m.status === 'in_flight') {
        inFlight++;
      } else if (m.status === 'dead_letter') {
        deadLetter++;
      }
    }

    return {
      pending,
      inFlight,
      failed,
      deadLetter,
      total: all.length,
    };
  }

  /**
   * Clears the entire queue.
   */
  async clear(): Promise<void> {
    try {
      if (this.customStore) {
        await clear(this.customStore);
      }
    } catch {
      // Fallback
    }
    memoryQueue.clear();
    notifyListeners();
  }

  /**
   * Subscribes to changes in the queue (enqueue, state change, deletion).
   */
  subscribe(listener: QueueListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }
}

export const syncQueue = new SyncQueue();
