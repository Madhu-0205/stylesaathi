import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageWearEventsRepository } from '../repositories/LocalStorageWearEventsRepository';
import { WearEvent } from '../types';

describe('Production Wear Events (Append-Only Event Stream)', () => {
  let repo: LocalStorageWearEventsRepository;

  beforeEach(async () => {
    repo = new LocalStorageWearEventsRepository();
    await repo.clear();
  });

  // ==========================================================================
  // D. Wear Event Duplicate Delivery
  // ==========================================================================
  describe('D. Wear event duplicate delivery', () => {
    it('is strictly idempotent when the exact same event ID is delivered multiple times', async () => {
      const stableEventId = 'wear-evt-uuid-12345';
      const event: WearEvent = {
        id: stableEventId,
        userId: 'user-1',
        wardrobeItemId: 'kurta-01',
        plannedDate: '2026-10-15',
        wornAt: 1729000000000,
        createdAt: 1729000000000,
      };

      // Deliver once
      await repo.addEvent(event);
      let events = await repo.getEvents();
      expect(events).toHaveLength(1);

      // Retry delivery of same event (e.g., network retry / re-sync)
      await repo.addEvent(event);
      events = await repo.getEvents();
      expect(events).toHaveLength(1); // Never double-counted!

      // Batch add same event again
      await repo.addEvents([event, event]);
      events = await repo.getEvents();
      expect(events).toHaveLength(1);
    });
  });

  // ==========================================================================
  // E. Multiple Legitimate Wear Events
  // ==========================================================================
  describe('E. Multiple legitimate wear events', () => {
    it('records multiple legitimate wears on the SAME garment on the SAME date with distinct event IDs', async () => {
      const date = '2026-10-15';
      const itemId = 'kurta-01';

      // Morning wear (e.g., college presentation)
      const morningWear: WearEvent = {
        id: 'wear-morning-uuid-1',
        userId: 'user-1',
        wardrobeItemId: itemId,
        plannedDate: date,
        wornAt: 1729000000000,
        createdAt: 1729000000000,
      };

      // Evening wear (e.g., family dinner after quick steam)
      const eveningWear: WearEvent = {
        id: 'wear-evening-uuid-2',
        userId: 'user-1',
        wardrobeItemId: itemId,
        plannedDate: date,
        wornAt: 1729036000000,
        createdAt: 1729036000000,
      };

      await repo.addEvent(morningWear);
      await repo.addEvent(eveningWear);

      const itemEvents = await repo.getEventsForItem(itemId);
      expect(itemEvents).toHaveLength(2);
      expect(itemEvents.map((e) => e.id)).toEqual(['wear-morning-uuid-1', 'wear-evening-uuid-2']);

      // Deriving timesWorn from append-only stream
      const totalWears = itemEvents.length;
      expect(totalWears).toBe(2);

      // Deriving lastWorn from append-only stream
      const lastWorn = Math.max(...itemEvents.map((e) => e.wornAt));
      expect(lastWorn).toBe(1729036000000);
    });

    it('preserves wear event streams across multiple distinct garments', async () => {
      const event1: WearEvent = {
        id: 'evt-1',
        userId: 'user-1',
        wardrobeItemId: 'item-top-1',
        wornAt: 1000,
        createdAt: 1000,
      };
      const event2: WearEvent = {
        id: 'evt-2',
        userId: 'user-1',
        wardrobeItemId: 'item-bottom-1',
        wornAt: 1000,
        createdAt: 1000,
      };

      await repo.addEvents([event1, event2]);

      const topEvents = await repo.getEventsForItem('item-top-1');
      const bottomEvents = await repo.getEventsForItem('item-bottom-1');

      expect(topEvents).toHaveLength(1);
      expect(bottomEvents).toHaveLength(1);
      expect(topEvents[0].id).toBe('evt-1');
      expect(bottomEvents[0].id).toBe('evt-2');
    });
  });

  // ==========================================================================
  // 3. Wear History Survival Across Wardrobe Archival / Deletion
  // ==========================================================================
  describe('3. Wear history survival across wardrobe item archival/deletion', () => {
    it('ensures wear events survive when wardrobe item is archived/deleted (soft deletion)', async () => {
      const { LocalStorageWardrobeRepository } = await import('../repositories/LocalStorageWardrobeRepository');
      const wardrobeRepo = new LocalStorageWardrobeRepository();
      await wardrobeRepo.clear();

      const item = {
        id: 'sherwani-001',
        name: 'Royal Raw Silk Sherwani',
        category: 'Ethnic' as const,
        subcategory: 'sherwani' as const,
        colors: ['ivory', 'gold'],
        seasons: ['winter'] as any[],
        occasions: ['wedding'] as any[],
        formality: 5,
        status: 'clean' as const,
        favorite: true,
        note: 'Wedding wear',
        timesWorn: 1,
        lastWorn: 1729000000000,
      };

      // 1. Create wardrobe item
      await wardrobeRepo.addItem(item);
      const itemsBefore = await wardrobeRepo.getItems();
      expect(itemsBefore).toHaveLength(1);
      expect(itemsBefore[0].id).toBe('sherwani-001');

      // 2. Create wear event for that wardrobe item
      const wearEvt: WearEvent = {
        id: 'wear-sherwani-wedding-2026',
        userId: 'user-1',
        wardrobeItemId: 'sherwani-001',
        wornAt: 1729000000000,
        createdAt: 1729000000000,
      };
      await repo.addEvent(wearEvt);

      const eventsBeforeDelete = await repo.getEventsForItem('sherwani-001');
      expect(eventsBeforeDelete).toHaveLength(1);
      expect(eventsBeforeDelete[0].id).toBe('wear-sherwani-wedding-2026');

      // 3. Archive / soft-delete wardrobe item
      await wardrobeRepo.deleteItem('sherwani-001');

      // Verify wardrobe item is soft-deleted / tombstoned (no longer in active list)
      const activeItemsAfter = await wardrobeRepo.getItems();
      expect(activeItemsAfter).toHaveLength(0);

      const allItemsRaw = await wardrobeRepo.getAllItemsRaw();
      const tombstone = allItemsRaw.find((i) => i.id === 'sherwani-001');
      expect(tombstone?.isDeleted).toBe(true);
      expect(tombstone?.deletedAt).toBeDefined();

      // 4. Verify wear event still exists and historical wear data is intact!
      const eventsAfterDelete = await repo.getEventsForItem('sherwani-001');
      expect(eventsAfterDelete).toHaveLength(1);
      expect(eventsAfterDelete[0].id).toBe('wear-sherwani-wedding-2026');
      expect(eventsAfterDelete[0].wardrobeItemId).toBe('sherwani-001');

      const allWearEvents = await repo.getEvents();
      expect(allWearEvents).toHaveLength(1);
      expect(allWearEvents[0].id).toBe('wear-sherwani-wedding-2026');
    });
  });
});

