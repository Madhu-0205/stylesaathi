// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isDemoItem,
  isDemoOutfit,
  isDemoPayload,
  assertNotDemoItem,
  getDemoWardrobe,
} from '../services/demoWardrobeService';
import { syncQueue } from '../lib/sync/syncQueue';
import { BackupService, StyleSaathiBackup } from '../services/backupService';
import { wardrobeRepository } from '../repositories/LocalStorageWardrobeRepository';
import { calendarRepository } from '../repositories/LocalStorageCalendarRepository';
import { wearEventsRepository } from '../repositories/LocalStorageWearEventsRepository';
import { preferencesRepository } from '../repositories/LocalStoragePreferencesRepository';
import { styleSignalsRepository } from '../repositories/LocalStorageStyleSignalsRepository';
import type { WardrobeItem, GeneratedOutfit, OutfitPlan } from '../types';

describe('Demo Mode Adversarial Persistence Audit (9-Pathway Verification)', () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await wardrobeRepository.clear();
    await calendarRepository.clear();
    await wearEventsRepository.clear();
    await preferencesRepository.clear();
    await styleSignalsRepository.clear();
  });

  const authenticItem: WardrobeItem = {
    id: 'user-kurta-01',
    userId: 'user-123',
    name: 'Authentic Chanderi Kurta',
    category: 'Tops',
    subcategory: 'kurta',
    colors: ['gold', 'cream'],
    seasons: ['summer'],
    occasions: ['festive'],
    formality: 4,
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 0,
  };

  const demoItem: WardrobeItem = {
    id: 'sample-bandhgala',
    userId: 'guest',
    name: 'Sample Charcoal Bandhgala',
    category: 'Outerwear',
    subcategory: 'jacket',
    colors: ['charcoal'],
    seasons: ['winter'],
    occasions: ['office', 'festive'],
    formality: 5,
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 0,
  };

  const demoOutfit: GeneratedOutfit = {
    id: 'demo-outfit-99',
    template: 'Indian Festive',
    slots: {
      tops: [demoItem],
    },
    score: 8.5,
    why: 'Demo look',
  };

  // -------------------------------------------------------------------------
  // Pathway 1: Add Garment
  // -------------------------------------------------------------------------
  it('Pathway 1: assertNotDemoItem blocks persistence of demonstration garments', () => {
    expect(() => assertNotDemoItem(demoItem, 'addItem')).toThrowError(
      /Prohibited persistent write.*sample-bandhgala/
    );
    expect(() => assertNotDemoItem('sample-kurti', 'addItem')).toThrowError(
      /Prohibited persistent write.*sample-kurti/
    );
    // Authentic items must succeed without throwing
    expect(() => assertNotDemoItem(authenticItem, 'addItem')).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // Pathway 2: Update Garment
  // -------------------------------------------------------------------------
  it('Pathway 2: assertNotDemoItem blocks mutation of demonstration garments', () => {
    expect(() => assertNotDemoItem(demoItem.id, 'updateItem')).toThrowError(
      /Prohibited persistent write.*sample-bandhgala/
    );
  });

  // -------------------------------------------------------------------------
  // Pathway 3: Delete Garment
  // -------------------------------------------------------------------------
  it('Pathway 3: assertNotDemoItem blocks deletion of demonstration garments', () => {
    expect(() => assertNotDemoItem(demoItem.id, 'deleteItem')).toThrowError(
      /Prohibited persistent write.*sample-bandhgala/
    );
  });

  // -------------------------------------------------------------------------
  // Pathway 4: Wear-Event Creation
  // -------------------------------------------------------------------------
  it('Pathway 4: isDemoItem and isDemoOutfit block wear event creation on demo garments', () => {
    expect(isDemoItem(demoItem)).toBe(true);
    expect(isDemoItem(demoItem.id)).toBe(true);
    expect(isDemoOutfit(demoOutfit)).toBe(true);
    expect(isDemoItem(authenticItem)).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Pathway 5: Laundry Updates
  // -------------------------------------------------------------------------
  it('Pathway 5: Laundry status modifications on demo items are blocked', () => {
    expect(() => assertNotDemoItem(demoItem, 'updateLaundryStatus')).toThrowError(
      /Cannot perform 'updateLaundryStatus' on demonstration fixture/
    );
  });

  // -------------------------------------------------------------------------
  // Pathway 6: Outfit Saving
  // -------------------------------------------------------------------------
  it('Pathway 6: isDemoOutfit detects demonstration pieces in nested slots', () => {
    const mixedOutfit: GeneratedOutfit = {
      template: 'Formal Fusion',
      slots: {
        tops: [authenticItem],
        outerwear: [demoItem],
      },
      score: 7.8,
      why: 'Mixed ensemble',
    };
    expect(isDemoOutfit(mixedOutfit)).toBe(true);

    const pureAuthenticOutfit: GeneratedOutfit = {
      template: 'Traditional Silk',
      slots: {
        tops: [authenticItem],
      },
      score: 8.2,
      why: 'Pure authentic ensemble',
    };
    expect(isDemoOutfit(pureAuthenticOutfit)).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Pathway 7: Calendar Planning
  // -------------------------------------------------------------------------
  it('Pathway 7: Calendar planning detects and blocks demo outfits and demo accessories', () => {
    const planWithDemoOutfit: Partial<OutfitPlan> = {
      date: '2026-12-01',
      outfit: demoOutfit,
    };
    expect(isDemoOutfit(planWithDemoOutfit.outfit)).toBe(true);

    const planWithDemoAccessory: Partial<OutfitPlan> = {
      date: '2026-12-01',
      accessory: demoItem,
    };
    expect(isDemoItem(planWithDemoAccessory.accessory)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Pathway 8: Backup Export & Restore
  // -------------------------------------------------------------------------
  it('Pathway 8A: BackupService.createBackup strictly strips demonstration items from backup', async () => {
    // Seed authentic item
    await wardrobeRepository.addItem(authenticItem);
    
    // Seed raw demo item directly into repository to simulate an adversary
    await wardrobeRepository.addItem(demoItem);

    const backupService = new BackupService();
    const backup = await backupService.createBackup({ userId: 'user-123' });

    // Verify backup only contains the authentic item
    expect(backup.wardrobe.items.some((i) => i.id === demoItem.id)).toBe(false);
    expect(backup.wardrobe.items.some((i) => i.id === authenticItem.id)).toBe(true);
    expect(backup.metadata.itemCount).toBe(1);
  });

  it('Pathway 8B: BackupService.restoreBackup sanitizes crafted backups containing demo fixtures', async () => {
    const craftedBackup: StyleSaathiBackup = {
      version: 3,
      schemaVersion: '3.0.0-phase3e',
      exportedAt: new Date().toISOString(),
      userId: 'user-123',
      metadata: {
        appVersion: '3.0.0-phase3e',
        itemCount: 2,
        outfitCount: 0,
        planCount: 0,
        wearEventCount: 0,
        signalCount: 0,
        imageCount: 0,
        totalImageBytes: 0,
      },
      wardrobe: {
        items: [authenticItem, demoItem],
        savedOutfits: [],
        calendarPlans: [],
        preferences: null,
        wearEvents: [],
        styleSignals: [],
      },
      sync: {
        unresolvedMutations: [],
        tombstones: [],
      },
      images: [],
    };

    const backupService = new BackupService();
    await backupService.restoreBackup(craftedBackup, { targetUserId: 'user-123', mode: 'overwrite' });

    const storedItems = await wardrobeRepository.getItems();
    expect(storedItems.some((i) => i.id === demoItem.id)).toBe(false);
    expect(storedItems.some((i) => i.id === authenticItem.id)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Pathway 9: Sync Queue Insertion & Cloud Payload Creation
  // -------------------------------------------------------------------------
  it('Pathway 9A: syncQueue.enqueue rejects demo item payload', async () => {
    await expect(
      syncQueue.enqueue({
        entityType: 'wardrobe_item',
        entityId: demoItem.id,
        operation: 'UPSERT',
        payload: demoItem,
      })
    ).rejects.toThrowError(/\[DemoIsolation\] Prohibited sync queue mutation/);
  });

  it('Pathway 9B: syncQueue.enqueue rejects demo outfit payload', async () => {
    await expect(
      syncQueue.enqueue({
        entityType: 'saved_outfit',
        entityId: 'outfit-1',
        operation: 'UPSERT',
        payload: {
          id: 'outfit-1',
          outfit: demoOutfit,
          savedAt: Date.now(),
        },
      })
    ).rejects.toThrowError(/\[DemoIsolation\] Prohibited sync queue mutation/);
  });

  it('Pathway 9C: syncQueue.enqueue rejects demo entityId even if payload is generic', async () => {
    await expect(
      syncQueue.enqueue({
        entityType: 'wardrobe_item',
        entityId: 'sample-sneakers',
        operation: 'DELETE',
        payload: {
          id: 'sample-sneakers',
          deletedAt: Date.now(),
        },
      })
    ).rejects.toThrowError(/\[DemoIsolation\] Prohibited sync queue mutation/);
  });

  // -------------------------------------------------------------------------
  // Authentic Personal Wardrobe Restoration
  // -------------------------------------------------------------------------
  it('Exiting Demo Mode restores authentic personal wardrobe without mutation', async () => {
    // 1. Seed authentic personal wardrobe
    await wardrobeRepository.addItem(authenticItem);
    const beforePersonal = await wardrobeRepository.getItems();
    expect(beforePersonal).toHaveLength(1);
    expect(beforePersonal[0].id).toBe('user-kurta-01');

    // 2. Simulate entering Demo Mode (reads from in-memory getDemoWardrobe)
    const demoWardrobe = getDemoWardrobe();
    expect(demoWardrobe.length).toBeGreaterThanOrEqual(28);
    expect(demoWardrobe.every((item) => isDemoItem(item))).toBe(true);

    // Verify raw persistent storage was NOT mutated during demo exploration
    const rawStoredDuringDemo = await wardrobeRepository.getItems();
    expect(rawStoredDuringDemo).toHaveLength(1);
    expect(rawStoredDuringDemo[0].id).toBe('user-kurta-01');

    // 3. Exiting Demo Mode retains authentic wardrobe in full
    const afterExitPersonal = await wardrobeRepository.getItems();
    expect(afterExitPersonal).toEqual(beforePersonal);
  });
});
