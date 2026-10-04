import { describe, it, expect } from 'vitest';
import {
  resolveWardrobeItemConflict,
  resolveCalendarPlanConflict,
  resolvePreferencesConflict,
  resolveSavedOutfitConflict,
} from '../lib/sync/conflictResolvers';
import { WardrobeItem, OutfitPlan, StylePreferences, SavedOutfit } from '../types';

describe('Production Conflict Resolvers', () => {
  const baseItem: WardrobeItem = {
    id: 'item-101',
    name: 'Silk Kurta',
    category: 'Ethnic',
    subcategory: 'kurta',
    colors: ['maroon'],
    seasons: ['winter'],
    occasions: ['festive'],
    formality: 4,
    status: 'clean',
    favorite: false,
    note: 'Festive wear',
    timesWorn: 2,
    createdAt: 1000,
    clientUpdatedAt: 2000,
  };

  // ==========================================================================
  // 1. Clock Skew Regression Tests (Device A +30m, Device B -30m)
  // ==========================================================================
  describe('1. Server Timestamp Conflict Semantics & Clock Skew Immunity', () => {
    it('ensures server_updated_at governs and Device A (+30m skew) cannot falsely win against later server commit', () => {
      // Real time:
      // T1 = 12:00:00 UTC: Device A commits to server
      // Device A has clock skewed +30 minutes into the future (claims client 12:30:00)
      // Database assigns server_updated_at = 2026-10-04T12:00:00.000Z
      const deviceAItem: WardrobeItem = {
        ...baseItem,
        favorite: false,
        name: 'Device A Kurta',
        clientUpdatedAt: new Date('2026-10-04T12:30:00.000Z').getTime(), // +30 min skewed clock
        serverUpdatedAt: '2026-10-04T12:00:00.000Z', // Real database commit T1
      };

      // T2 = 12:05:00 UTC: Device B commits to server
      // Device B has clock skewed -30 minutes into the past (claims client 11:35:00)
      // Database assigns server_updated_at = 2026-10-04T12:05:00.000Z
      const deviceBItem: WardrobeItem = {
        ...baseItem,
        favorite: true,
        name: 'Device B Kurta (Winner)',
        clientUpdatedAt: new Date('2026-10-04T11:35:00.000Z').getTime(), // -30 min skewed clock
        serverUpdatedAt: '2026-10-04T12:05:00.000Z', // Real database commit T2 (> T1)
      };

      // Device B committed LATER on the database server.
      // Even though Device A's client clock was 55 minutes ahead of Device B's client clock,
      // server_updated_at is authoritative and Device B wins!
      const resolvedAB = resolveWardrobeItemConflict(deviceAItem, deviceBItem);
      expect(resolvedAB.name).toBe('Device B Kurta (Winner)');
      expect(resolvedAB.favorite).toBe(true);
      expect(resolvedAB.serverUpdatedAt).toBe('2026-10-04T12:05:00.000Z');

      // Commutative check: resolution must not depend on argument order
      const resolvedBA = resolveWardrobeItemConflict(deviceBItem, deviceAItem);
      expect(resolvedBA.name).toBe('Device B Kurta (Winner)');
      expect(resolvedBA.favorite).toBe(true);
    });

    it('ensures Device B (-30m skew) cannot prevent Device A from winning when Device A commits later', () => {
      // T1 = 12:00:00 UTC: Device B commits first
      const deviceBItem: WardrobeItem = {
        ...baseItem,
        name: 'Early Device B Edit',
        clientUpdatedAt: new Date('2026-10-04T11:30:00.000Z').getTime(),
        serverUpdatedAt: '2026-10-04T12:00:00.000Z',
      };

      // T2 = 12:05:00 UTC: Device A commits later
      const deviceAItem: WardrobeItem = {
        ...baseItem,
        name: 'Later Device A Edit (Winner)',
        clientUpdatedAt: new Date('2026-10-04T12:35:00.000Z').getTime(),
        serverUpdatedAt: '2026-10-04T12:05:00.000Z',
      };

      const resolved = resolveWardrobeItemConflict(deviceBItem, deviceAItem);
      expect(resolved.name).toBe('Later Device A Edit (Winner)');
      expect(resolved.serverUpdatedAt).toBe('2026-10-04T12:05:00.000Z');
    });

    it('never directly compares client_updated_at against server_updated_at as equivalent clocks', () => {
      // Local record has clientUpdatedAt = 5000, but has NOT contacted server (serverUpdatedAt = undefined)
      // Remote record was committed to server at 4000 (serverUpdatedAt = 4000)
      // Because server timestamps are database-controlled and authoritative,
      // uncommitted client wall clock cannot override confirmed server state.
      const localUncommitted: WardrobeItem = {
        ...baseItem,
        name: 'Uncommitted Local Draft',
        clientUpdatedAt: 5000,
        serverUpdatedAt: undefined,
      };
      const remoteCommitted: WardrobeItem = {
        ...baseItem,
        name: 'Server Committed Record',
        serverUpdatedAt: new Date(4000).toISOString(),
      };

      const resolved = resolveWardrobeItemConflict(localUncommitted, remoteCommitted);
      expect(resolved.name).toBe('Server Committed Record');
      expect(resolved.serverUpdatedAt).toBe(remoteCommitted.serverUpdatedAt);
    });

    it('deterministically breaks ties when both records have identical server timestamps', () => {
      const item1: WardrobeItem = {
        ...baseItem,
        id: 'item-aaa',
        name: 'Alpha Kurta',
        serverUpdatedAt: '2026-10-04T12:00:00.000Z',
        clientUpdatedAt: 1000,
      };
      const item2: WardrobeItem = {
        ...baseItem,
        id: 'item-bbb',
        name: 'Beta Kurta',
        serverUpdatedAt: '2026-10-04T12:00:00.000Z',
        clientUpdatedAt: 1000,
      };

      // Both orderings yield the exact same deterministic winner
      const res1 = resolveWardrobeItemConflict(item1, item2);
      const res2 = resolveWardrobeItemConflict(item2, item1);
      expect(res1.id).toBe(res2.id);
    });

    it('resolves style preferences deterministically by latest server timestamp', () => {
      const local: StylePreferences = {
        preferredContexts: ['Work'],
        preferredAesthetics: ['Minimal'],
        stylingMode: 'simple',
        updatedAt: 1000,
        serverUpdatedAt: new Date(1000).toISOString(),
      };
      const remote: StylePreferences = {
        preferredContexts: ['Festive', 'Everyday'],
        preferredAesthetics: ['Traditional'],
        stylingMode: 'variety',
        updatedAt: 2000,
        serverUpdatedAt: new Date(2000).toISOString(),
      };

      const resolved = resolvePreferencesConflict(local, remote);
      expect(resolved.stylingMode).toBe('variety');
      expect(resolved.preferredAesthetics).toEqual(['Traditional']);
    });
  });

  // ==========================================================================
  // 2. Image Source of Truth Regression Tests
  // ==========================================================================
  describe('2. Image Source of Truth (active_image_version_id -> storage_path)', () => {
    it('ensures an obsolete/stale photo_url CANNOT override the active image version', () => {
      // Local has activated a verified image version v2
      const localWithActiveVersion: WardrobeItem = {
        ...baseItem,
        activeImageVersionId: 'img-version-v2-uuid',
        storagePath: 'wardrobe/user-1/item-101/img-version-v2-uuid.webp',
        photoUrl: 'https://storage.supabase.co/wardrobe/user-1/item-101/img-version-v2-uuid.webp',
        serverUpdatedAt: '2026-10-04T12:00:00.000Z',
      };

      // Remote is an older/stale record that only has a legacy photo_url and no active image version
      const remoteWithStalePhotoUrl: WardrobeItem = {
        ...baseItem,
        activeImageVersionId: undefined,
        storagePath: undefined,
        photoUrl: 'https://legacy-storage.example.com/stale-unverified-photo.jpg',
        serverUpdatedAt: '2026-10-04T11:00:00.000Z',
      };

      const resolved = resolveWardrobeItemConflict(localWithActiveVersion, remoteWithStalePhotoUrl);

      // Authoritative image source of truth MUST be the active image version and its storage path
      expect(resolved.activeImageVersionId).toBe('img-version-v2-uuid');
      expect(resolved.storagePath).toBe('wardrobe/user-1/item-101/img-version-v2-uuid.webp');
      expect(resolved.photoUrl).toBe('https://storage.supabase.co/wardrobe/user-1/item-101/img-version-v2-uuid.webp');
      expect(resolved.photoUrl).not.toBe('https://legacy-storage.example.com/stale-unverified-photo.jpg');
    });

    it('preserves active image version identity even if remote metadata update wins on server timestamp', () => {
      // Local has the active image version v2
      const local: WardrobeItem = {
        ...baseItem,
        favorite: false,
        activeImageVersionId: 'img-ver-2',
        storagePath: 'wardrobe/user-1/item-101/ver2.webp',
        photoUrl: 'https://storage.supabase.co/ver2.webp',
        serverUpdatedAt: '2026-10-04T12:00:00.000Z',
      };

      // Remote updated favorite=true 1 minute later, but remote was carrying a stale/cached photo_url
      const remoteWithMetadataUpdate: WardrobeItem = {
        ...baseItem,
        favorite: true,
        activeImageVersionId: undefined, // remote didn't have v2 cached
        storagePath: undefined,
        photoUrl: 'https://old-cache.com/old.jpg',
        serverUpdatedAt: '2026-10-04T12:01:00.000Z',
      };

      const resolved = resolveWardrobeItemConflict(local, remoteWithMetadataUpdate);

      // Metadata update (favorite=true) is accepted from newer server timestamp
      expect(resolved.favorite).toBe(true);

      // BUT the active image identity remains protected and is NOT overwritten by the stale photo_url!
      expect(resolved.activeImageVersionId).toBe('img-ver-2');
      expect(resolved.storagePath).toBe('wardrobe/user-1/item-101/ver2.webp');
      expect(resolved.photoUrl).not.toBe('https://old-cache.com/old.jpg');
    });
  });

  // ==========================================================================
  // 4. Calendar Stale Event Protection (Monotonic Lifecycle)
  // ==========================================================================
  describe('4. Calendar Stale Event Protection (Monotonic Status Transitions)', () => {
    const basePlan: OutfitPlan = {
      id: 'plan-1',
      date: '2026-10-15',
      outfit: { template: 'Ethnic', slots: {}, score: 5, why: 'Festive' },
      occasion: 'festive',
      status: 'planned',
      createdAt: 1000,
      updatedAt: 1000,
      clientUpdatedAt: 1000,
    };

    // Allowed transitions:
    // planned -> worn
    // planned -> cancelled
    // worn -> worn
    it('allows planned -> worn transition', () => {
      const local: OutfitPlan = { ...basePlan, status: 'planned' };
      const remote: OutfitPlan = { ...basePlan, status: 'worn', serverUpdatedAt: '2026-10-04T12:00:00.000Z' };

      const resolved = resolveCalendarPlanConflict(local, remote);
      expect(resolved.status).toBe('worn');
    });

    it('allows planned -> cancelled transition', () => {
      const local: OutfitPlan = { ...basePlan, status: 'planned' };
      const remote: OutfitPlan = { ...basePlan, status: 'cancelled', serverUpdatedAt: '2026-10-04T12:00:00.000Z' };

      const resolved = resolveCalendarPlanConflict(local, remote);
      expect(resolved.status).toBe('cancelled');
    });

    it('allows worn -> worn transition', () => {
      const local: OutfitPlan = { ...basePlan, status: 'worn' };
      const remote: OutfitPlan = { ...basePlan, status: 'worn', serverUpdatedAt: '2026-10-04T12:00:00.000Z' };

      const resolved = resolveCalendarPlanConflict(local, remote);
      expect(resolved.status).toBe('worn');
    });

    // Stale sync must NEVER cause:
    // worn -> planned
    it('strictly prevents stale or newer sync from causing worn -> planned', () => {
      const localWorn: OutfitPlan = {
        ...basePlan,
        status: 'worn',
        serverUpdatedAt: '2026-10-04T11:00:00.000Z',
      };
      const remotePlanned: OutfitPlan = {
        ...basePlan,
        status: 'planned',
        serverUpdatedAt: '2026-10-04T12:00:00.000Z', // Even if remote has newer server timestamp
      };

      const resolved = resolveCalendarPlanConflict(localWorn, remotePlanned);
      expect(resolved.status).toBe('worn');
    });

    // worn -> cancelled
    it('strictly prevents stale sync from causing worn -> cancelled', () => {
      const localWorn: OutfitPlan = {
        ...basePlan,
        status: 'worn',
        serverUpdatedAt: '2026-10-04T11:00:00.000Z',
      };
      const remoteCancelled: OutfitPlan = {
        ...basePlan,
        status: 'cancelled',
        serverUpdatedAt: '2026-10-04T12:00:00.000Z',
      };

      const resolved = resolveCalendarPlanConflict(localWorn, remoteCancelled);
      expect(resolved.status).toBe('worn');
    });

    // cancelled -> planned
    it('strictly prevents stale sync from causing cancelled -> planned (no zombie resurrection)', () => {
      const localCancelled: OutfitPlan = {
        ...basePlan,
        status: 'cancelled',
        serverUpdatedAt: '2026-10-04T11:00:00.000Z',
      };
      const remotePlanned: OutfitPlan = {
        ...basePlan,
        status: 'planned',
        serverUpdatedAt: '2026-10-04T12:00:00.000Z',
      };

      const resolved = resolveCalendarPlanConflict(localCancelled, remotePlanned);
      expect(resolved.status).toBe('cancelled');
    });

    // cancelled -> worn
    it('strictly prevents stale sync from causing cancelled -> worn', () => {
      const localCancelled: OutfitPlan = {
        ...basePlan,
        status: 'cancelled',
        serverUpdatedAt: '2026-10-04T12:00:00.000Z',
      };
      const staleRemoteWorn: OutfitPlan = {
        ...basePlan,
        status: 'worn',
        serverUpdatedAt: '2026-10-04T11:00:00.000Z',
      };

      const resolved = resolveCalendarPlanConflict(localCancelled, staleRemoteWorn);
      expect(resolved.status).toBe('cancelled');
    });
  });

  // ==========================================================================
  // Tombstone vs Stale Update
  // ==========================================================================
  describe('Tombstone vs stale update', () => {
    it('ensures local tombstone prevents resurrection by active remote record', () => {
      const localTombstone: WardrobeItem = {
        ...baseItem,
        isDeleted: true,
        deletedAt: 5000,
        clientUpdatedAt: 5000,
      };
      const staleRemoteActive: WardrobeItem = {
        ...baseItem,
        isDeleted: false,
        name: 'Resurrected Kurta',
        serverUpdatedAt: new Date(6000).toISOString(),
      };

      const resolved = resolveWardrobeItemConflict(localTombstone, staleRemoteActive);
      expect(resolved.isDeleted).toBe(true);
      expect(resolved.deletedAt).toBe(5000);
    });

    it('ensures remote tombstone marks active local record as deleted', () => {
      const localActive: WardrobeItem = {
        ...baseItem,
        isDeleted: false,
        name: 'Edited Locally',
        clientUpdatedAt: 4000,
      };
      const remoteTombstone: WardrobeItem = {
        ...baseItem,
        isDeleted: true,
        deletedAt: 4500,
        serverUpdatedAt: new Date(4500).toISOString(),
      };

      const resolved = resolveWardrobeItemConflict(localActive, remoteTombstone);
      expect(resolved.isDeleted).toBe(true);
      expect(resolved.deletedAt).toBe(4500);
    });

    it('preserves latest deletedAt when both local and remote are tombstones', () => {
      const localTombstone: WardrobeItem = {
        ...baseItem,
        isDeleted: true,
        deletedAt: 3000,
      };
      const remoteTombstone: WardrobeItem = {
        ...baseItem,
        isDeleted: true,
        deletedAt: 4000,
      };

      const resolved = resolveWardrobeItemConflict(localTombstone, remoteTombstone);
      expect(resolved.isDeleted).toBe(true);
      expect(resolved.deletedAt).toBe(4000);
    });

    it('preserves saved outfit tombstones against stale updates', () => {
      const localSaved: SavedOutfit = {
        id: 'outfit-1',
        name: 'Classic Diwali Look',
        outfit: { template: 'Ethnic', slots: {}, score: 5, why: '' },
        savedAt: 1000,
        isDeleted: true,
        deletedAt: 3000,
      };
      const remoteStale: SavedOutfit = {
        id: 'outfit-1',
        name: 'Renamed Diwali Look',
        outfit: { template: 'Ethnic', slots: {}, score: 5, why: '' },
        savedAt: 1000,
        isDeleted: false,
        serverUpdatedAt: new Date(2000).toISOString(),
      };

      const resolved = resolveSavedOutfitConflict(localSaved, remoteStale);
      expect(resolved.isDeleted).toBe(true);
    });
  });
});
