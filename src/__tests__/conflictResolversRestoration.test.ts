// ============================================================================
// STYLESAATHI 3.0 — CONFLICT RESOLVER RESTORATION TESTS
// Phase 3C.2 Remediation: DATA-SYNC-02 Explicit Restoration Semantics
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  resolveWardrobeItemConflict,
  resolveCalendarPlanConflict,
  resolveSavedOutfitConflict,
} from '../lib/sync/conflictResolvers';
import type { WardrobeItem, OutfitPlan, SavedOutfit } from '../types';

function mockItem(
  partial: Partial<WardrobeItem> & {
    id: string;
    name: string;
    revision?: number;
    serverRevision?: number;
  }
): WardrobeItem & { revision?: number; serverRevision?: number } {
  return {
    userId: 'u1',
    category: 'Tops',
    subcategory: 't-shirt',
    colors: ['black'],
    seasons: ['summer'],
    occasions: ['everyday'],
    formality: 3,
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 0,
    ...partial,
  };
}

describe('Phase 3C.2: DATA-SYNC-02 Explicit Restoration Conflict Resolution', () => {
  const tNov1 = new Date('2026-11-01T10:00:00.000Z').getTime();
  const tNov2 = new Date('2026-11-02T10:00:00.000Z').getTime();
  const tNov5 = new Date('2026-11-05T10:00:00.000Z').getTime();
  const tNov6 = new Date('2026-11-06T10:00:00.000Z').getTime();

  // 1. Delete followed by restore across devices
  it('1. allows remote restored record to win when updated strictly after local deletion', () => {
    const localDeleted = mockItem({
      id: 'item-res-1',
      name: 'Cashmere Sweater',
      category: 'Outerwear',
      subcategory: 'jacket',
      isDeleted: true,
      deletedAt: tNov1,
      serverUpdatedAt: '2026-11-01T10:00:00.000Z',
    });

    const remoteRestored = mockItem({
      id: 'item-res-1',
      name: 'Cashmere Sweater (Restored)',
      category: 'Outerwear',
      subcategory: 'jacket',
      isDeleted: false, // Intentionally restored!
      clientUpdatedAt: tNov6,
      serverUpdatedAt: '2026-11-06T10:00:00.000Z', // 5 days newer!
    });

    const result = resolveWardrobeItemConflict(localDeleted, remoteRestored);
    expect(result.isDeleted).toBe(false);
    expect(result.deletedAt).toBeUndefined();
    expect(result.name).toBe('Cashmere Sweater (Restored)');
  });

  // 2. Stale update attempting zombie resurrection is suppressed by tombstone
  it('2. suppresses stale active update from resurrecting a newer tombstone', () => {
    const localDeleted = mockItem({
      id: 'item-res-2',
      name: 'Old Linen Pants',
      category: 'Bottoms',
      subcategory: 'trousers',
      isDeleted: true,
      deletedAt: tNov5,
      serverUpdatedAt: '2026-11-05T10:00:00.000Z',
    });

    const remoteStaleActive = mockItem({
      id: 'item-res-2',
      name: 'Old Linen Pants (Stale)',
      category: 'Bottoms',
      subcategory: 'trousers',
      isDeleted: false,
      clientUpdatedAt: tNov2, // Stale: edited before deletion!
      serverUpdatedAt: '2026-11-02T10:00:00.000Z', // Older than deletion!
    });

    const result = resolveWardrobeItemConflict(localDeleted, remoteStaleActive);
    // Tombstone wins to prevent zombie resurrection!
    expect(result.isDeleted).toBe(true);
  });

  // 3. Local restoration wins over older remote tombstone
  it('3. allows local restored record to win when edited after remote deletion', () => {
    const localRestored = mockItem({
      id: 'item-res-3',
      name: 'Silk Kurti',
      category: 'Ethnic',
      subcategory: 'kurti',
      isDeleted: false,
      clientUpdatedAt: tNov6, // Restored locally at Nov 6
      serverUpdatedAt: '2026-11-06T10:00:00.000Z',
    });

    const remoteDeleted = mockItem({
      id: 'item-res-3',
      name: 'Silk Kurti',
      category: 'Ethnic',
      subcategory: 'kurti',
      isDeleted: true,
      deletedAt: tNov2, // Remote deletion happened at Nov 2
      serverUpdatedAt: '2026-11-02T10:00:00.000Z',
    });

    const result = resolveWardrobeItemConflict(localRestored, remoteDeleted);
    expect(result.isDeleted).toBe(false);
    expect(result.name).toBe('Silk Kurti');
  });

  // 4. Preserves local image blobs when remote item is restored
  it('4. preserves local photo blob reference when remote restored item is reconciled', () => {
    const localDeleted = mockItem({
      id: 'item-res-4',
      name: 'Embroidered Dupatta',
      category: 'Ethnic',
      subcategory: 'dupatta',
      photo: 'blob:device-local-image-url-12345',
      isDeleted: true,
      deletedAt: tNov1,
      serverUpdatedAt: '2026-11-01T10:00:00.000Z',
    });

    const remoteRestored = mockItem({
      id: 'item-res-4',
      name: 'Embroidered Dupatta',
      category: 'Ethnic',
      subcategory: 'dupatta',
      isDeleted: false,
      clientUpdatedAt: tNov6,
      serverUpdatedAt: '2026-11-06T10:00:00.000Z',
    });

    const result = resolveWardrobeItemConflict(localDeleted, remoteRestored);
    expect(result.isDeleted).toBe(false);
    expect(result.photo).toBe('blob:device-local-image-url-12345');
  });

  // 5. Preserves user-verified attributes during restoration
  it('5. preserves user-verified attributes when item is restored', () => {
    const localVerifiedDeleted = mockItem({
      id: 'item-res-5',
      name: 'Handloom Saree',
      category: 'Ethnic',
      subcategory: 'saree',
      fabric: 'silk',
      userVerified: true,
      isDeleted: true,
      deletedAt: tNov1,
      serverUpdatedAt: '2026-11-01T10:00:00.000Z',
    });

    const remoteRestoredUnverified = mockItem({
      id: 'item-res-5',
      name: 'Handloom Saree',
      category: 'Ethnic',
      subcategory: 'saree',
      fabric: 'linen',
      userVerified: false,
      isDeleted: false,
      clientUpdatedAt: tNov6,
      serverUpdatedAt: '2026-11-06T10:00:00.000Z',
    });

    const result = resolveWardrobeItemConflict(localVerifiedDeleted, remoteRestoredUnverified);
    expect(result.isDeleted).toBe(false);
    expect(result.fabric).toBe('silk');
    expect(result.userVerified).toBe(true);
  });

  // 6. Saved outfit restoration
  it('6. applies explicit restoration semantics to saved outfits', () => {
    const localDeletedOutfit: SavedOutfit = {
      id: 'outfit-res-1',
      name: 'Deleted Outfit',
      outfit: { id: 'outfit-res-1', name: 'Deleted Outfit', template: 'classic', slots: {}, score: 8, why: '' } as any,
      savedAt: tNov1,
      isDeleted: true,
      deletedAt: tNov2,
      serverUpdatedAt: '2026-11-02T10:00:00.000Z',
    };

    const remoteRestoredOutfit: SavedOutfit = {
      id: 'outfit-res-1',
      name: 'Restored Outfit',
      outfit: { id: 'outfit-res-1', name: 'Restored Outfit', template: 'classic', slots: {}, score: 8.5, why: '' } as any,
      savedAt: tNov5,
      clientUpdatedAt: tNov6,
      serverUpdatedAt: '2026-11-06T10:00:00.000Z',
      isDeleted: false,
    };

    const result = resolveSavedOutfitConflict(localDeletedOutfit, remoteRestoredOutfit);
    expect(result.isDeleted).toBe(false);
    expect(result.name).toBe('Restored Outfit');
  });

  // 7. Calendar plan restoration
  it('7. applies explicit restoration semantics to calendar plans', () => {
    const localDeletedPlan: OutfitPlan = {
      id: 'plan-res-1',
      userId: 'u1',
      date: '2026-11-20',
      occasion: 'party',
      status: 'planned',
      outfit: { id: 'o1', template: 'classic', slots: {}, score: 8, why: '' } as any,
      isDeleted: true,
      deletedAt: tNov2,
      serverUpdatedAt: '2026-11-02T10:00:00.000Z',
      createdAt: tNov1,
      updatedAt: tNov1,
    };

    const remoteRestoredPlan: OutfitPlan = {
      id: 'plan-res-1',
      userId: 'u1',
      date: '2026-11-20',
      occasion: 'party',
      status: 'planned',
      outfit: { id: 'o1', template: 'classic', slots: {}, score: 8, why: '' } as any,
      isDeleted: false,
      clientUpdatedAt: tNov6,
      serverUpdatedAt: '2026-11-06T10:00:00.000Z',
      createdAt: tNov1,
      updatedAt: tNov6,
    };

    const result = resolveCalendarPlanConflict(localDeletedPlan, remoteRestoredPlan);
    expect(result.isDeleted).toBe(false);
    expect(result.occasion).toBe('party');
  });

  // 8. Phase 3C.6: Revision-authoritative restoration with backward device clock
  it('8. allows remote restoration with higher revision to win even if client clock is backward', () => {
    const localDeleted = mockItem({
      id: 'item-clock-skew-1',
      name: 'Sherwani Jacket',
      category: 'Outerwear',
      subcategory: 'jacket',
      isDeleted: true,
      deletedAt: tNov5,
      serverUpdatedAt: '2026-11-05T10:00:00.000Z',
      revision: 2,
    });

    const remoteRestored = mockItem({
      id: 'item-clock-skew-1',
      name: 'Sherwani Jacket (Restored via Revision 3)',
      category: 'Outerwear',
      subcategory: 'jacket',
      isDeleted: false,
      clientUpdatedAt: tNov1, // Backward client clock: older than localDelTime!
      serverUpdatedAt: '2026-11-06T10:00:00.000Z',
      revision: 3, // Higher server revision!
    });

    const result = resolveWardrobeItemConflict(localDeleted, remoteRestored);
    // Revision 3 strictly beats Tombstone Revision 2, despite backward clientUpdatedAt!
    expect(result.isDeleted).toBe(false);
    expect(result.deletedAt).toBeUndefined();
    expect(result.name).toBe('Sherwani Jacket (Restored via Revision 3)');
  });
});
