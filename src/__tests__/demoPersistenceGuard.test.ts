import { describe, it, expect, beforeEach } from 'vitest';
import {
  isDemoItem,
  isDemoOutfit,
  isDemoPayload,
  assertNotDemoItem,
  getDemoWardrobe,
} from '../services/demoWardrobeService';
import { SyncQueue } from '../lib/sync/syncQueue';
import { WardrobeItem, GeneratedOutfit } from '../types';

describe('Demo Mode Isolation & Persistence Protection Guard', () => {
  const authenticItem: WardrobeItem = {
    id: 'user-garment-999',
    name: 'Personal Chikankari Kurta',
    category: 'Ethnic',
    subcategory: 'kurta',
    colors: ['white'],
    seasons: ['summer'],
    occasions: ['puja', 'wedding guest'],
    formality: 4,
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 2,
    createdAt: Date.now(),
  };

  const demoItem: WardrobeItem = {
    id: 'sample-chikankari-kurta',
    name: 'Curated Lucknowi Kurta',
    category: 'Ethnic',
    subcategory: 'kurta',
    colors: ['white'],
    seasons: ['summer'],
    occasions: ['puja'],
    formality: 4,
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 0,
    createdAt: 0,
  };

  it('1. Correctly classifies demo items vs authentic personal items', () => {
    expect(isDemoItem('sample-white-tee')).toBe(true);
    expect(isDemoItem('demo-silk-saree')).toBe(true);
    expect(isDemoItem(demoItem)).toBe(true);

    expect(isDemoItem('user-garment-999')).toBe(false);
    expect(isDemoItem('real-item-42')).toBe(false);
    expect(isDemoItem(authenticItem)).toBe(false);
    expect(isDemoItem(null)).toBe(false);
    expect(isDemoItem(undefined)).toBe(false);
  });

  it('2. Flags outfits containing demonstration pieces', () => {
    const mixedOutfit: GeneratedOutfit = {
      id: 'outfit-1',
      score: 8.5,
      template: 'indo-western',
      why: 'Cultural synergy',
      slots: {
        tops: [demoItem],
        bottoms: [authenticItem],
      },
    };

    const purelyAuthenticOutfit: GeneratedOutfit = {
      id: 'outfit-2',
      score: 9.0,
      template: 'traditional',
      why: 'Traditional harmony',
      slots: {
        tops: [authenticItem],
      },
    };

    expect(isDemoOutfit(mixedOutfit)).toBe(true);
    expect(isDemoOutfit(purelyAuthenticOutfit)).toBe(false);
  });

  it('3. Asserts and throws on prohibited persistent writes for demo items', () => {
    expect(() => assertNotDemoItem(demoItem, 'addItem')).toThrow(
      /Prohibited persistent write: Cannot perform 'addItem' on demonstration fixture item/
    );
    expect(() => assertNotDemoItem('sample-blue-jeans', 'updateItem')).toThrow(
      /Prohibited persistent write/
    );

    // Authentic items must pass cleanly without throwing
    expect(() => assertNotDemoItem(authenticItem, 'addItem')).not.toThrow();
    expect(() => assertNotDemoItem('user-item-123', 'deleteItem')).not.toThrow();
  });

  it('4. Provides the 28-piece curated demonstration capsule without mutating source', () => {
    const demoItems = getDemoWardrobe();
    expect(demoItems.length).toBe(28);
    expect(demoItems.every((i) => i.id.startsWith('sample-'))).toBe(true);

    // Modifying returned array does not mutate subsequent calls
    demoItems[0].name = 'Mutated Name';
    const freshDemoItems = getDemoWardrobe();
    expect(freshDemoItems[0].name).not.toBe('Mutated Name');
  });

  it('5. Protects SyncQueue: Enqueueing a mutation for a demo item is strictly rejected', async () => {
    const syncQueue = new SyncQueue();

    // Attempting to enqueue an authentic item succeeds
    const authenticMutation = await syncQueue.enqueue({
      entityType: 'wardrobe_item',
      entityId: authenticItem.id,
      operation: 'UPSERT',
      payload: authenticItem,
    });
    expect(authenticMutation.id).toBeDefined();

    // Attempting to enqueue a demo item must reject / throw and not enter queue
    await expect(
      syncQueue.enqueue({
        entityType: 'wardrobe_item',
        entityId: demoItem.id,
        operation: 'UPSERT',
        payload: demoItem,
      })
    ).rejects.toThrow(/Demonstration item cannot be enqueued for cloud sync/);

    // Also rejects if payload is an outfit with demo items
    await expect(
      syncQueue.enqueue({
        entityType: 'saved_outfit',
        entityId: 'demo-outfit',
        operation: 'UPSERT',
        payload: {
          id: 'saved-demo-outfit',
          savedAt: Date.now(),
          outfit: {
            id: 'demo-outfit',
            slots: { tops: [demoItem] },
            score: 7,
            template: 'everyday',
            why: 'demo',
          },
        },
      })
    ).rejects.toThrow(/Demonstration item cannot be enqueued for cloud sync/);
  });

  it('6. Backup engine strictly filters out demonstration items', async () => {
    const { backupService } = await import('../services/backupService');
    const backup = await backupService.createBackup({ includeImages: false });
    expect(backup.wardrobe.items.every((i) => !isDemoItem(i))).toBe(true);
  });
});
