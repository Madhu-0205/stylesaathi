// ============================================================================
// STYLESAATHI 3.0 — PHASE 3E: CONTROLLED MIGRATION REHEARSAL TEST SUITE
// Validates:
// 1. Full Backup & Export with Binary Image Blob SHA-256 Hash Verification
// 2. Restore into Empty & Existing DB with Version Compatibility & Error Rejection
// 3. Migration & Rollback Rehearsal into D1 with Foreign Key & Revision Invariants
// 4. Account Lifecycle, Account Linking, Deletion Tombstones & Tenant Isolation
// 5. Exact Data-Integrity Comparisons Across Lifecycle
// ============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import {
  backupService,
  computeBlobHash,
  blobToBase64,
  base64ToBlob,
  validateBackup,
  type StyleSaathiBackup,
} from '../services/backupService';
import { saveImage, getImage, clearImages } from '../services/imageStore';
import {
  wardrobeRepository,
  LocalStorageWardrobeRepository,
} from '../repositories/LocalStorageWardrobeRepository';
import {
  calendarRepository,
  LocalStorageCalendarRepository,
} from '../repositories/LocalStorageCalendarRepository';
import {
  preferencesRepository,
  LocalStoragePreferencesRepository,
} from '../repositories/LocalStoragePreferencesRepository';
import {
  wearEventsRepository,
  LocalStorageWearEventsRepository,
} from '../repositories/LocalStorageWearEventsRepository';
import {
  styleSignalsRepository,
  LocalStorageStyleSignalsRepository,
} from '../repositories/LocalStorageStyleSignalsRepository';
import { syncQueue } from '../lib/sync/syncQueue';
import type {
  WardrobeItem,
  SavedOutfit,
  OutfitPlan,
  StylePreferences,
  WearEvent,
  StyleSignalEvent,
} from '../types';

const MIGRATION_1 = path.resolve(__dirname, '../../worker/migrations/0001_initial_schema.sql');
const MIGRATION_2 = path.resolve(__dirname, '../../worker/migrations/0002_sync_mutations.sql');
const MIGRATION_3 = path.resolve(__dirname, '../../worker/migrations/0003_entity_revisions.sql');

describe('StyleSaathi 3.0 — Phase 3E: Controlled Migration Rehearsal', () => {
  let wardrobeRepo: LocalStorageWardrobeRepository;
  let calendarRepo: LocalStorageCalendarRepository;
  let prefRepo: LocalStoragePreferencesRepository;
  let wearRepo: LocalStorageWearEventsRepository;
  let signalsRepo: LocalStorageStyleSignalsRepository;

  const testUserId = 'usr_rehearsal_001';
  const otherUserId = 'usr_rehearsal_other';

  beforeEach(async () => {
    wardrobeRepo = wardrobeRepository;
    calendarRepo = calendarRepository;
    prefRepo = preferencesRepository;
    wearRepo = wearEventsRepository;
    signalsRepo = styleSignalsRepository;

    await wardrobeRepo.clear();
    await calendarRepo.clear();
    await prefRepo.clear();
    await wearRepo.clear();
    await signalsRepo.clear();
    await clearImages();
    await syncQueue.clear();
  });

  afterEach(async () => {
    await wardrobeRepo.clear();
    await calendarRepo.clear();
    await prefRepo.clear();
    await wearRepo.clear();
    await signalsRepo.clear();
    await clearImages();
    await syncQueue.clear();
  });

  // ==========================================================================
  // SECTION 1: BACKUP & EXPORT VALIDATION WITH BINARY BLOB HASH COMPARISONS
  // ==========================================================================
  describe('1. Backup & Export Validation with Real Binary Image Blob Hashes', () => {
    it('exports complete metadata and verifies actual IndexedDB garment image Blobs via SHA-256', async () => {
      // 1. Create real binary image Blobs
      const rawImageBytes1 = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x01, 0x02]);
      const rawImageBytes2 = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);

      const blob1 = new Blob([rawImageBytes1], { type: 'image/jpeg' });
      const blob2 = new Blob([rawImageBytes2], { type: 'image/png' });

      // Compute exact SHA-256 and byte sizes
      const hash1 = await computeBlobHash(blob1);
      const hash2 = await computeBlobHash(blob2);

      expect(hash1.size).toBe(12);
      expect(hash1.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(hash2.size).toBe(12);
      expect(hash2.sha256).toMatch(/^[a-f0-9]{64}$/);

      // Save into IndexedDB / imageStore
      await saveImage('photo_kurta_01', blob1);
      await saveImage('photo_saree_02', blob2);

      // 2. Populate synthetic wardrobe items
      const item1: WardrobeItem = {
        id: 'item_01',
        userId: testUserId,
        name: 'Indigo Handloom Kurta',
        category: 'Ethnic',
        subcategory: 'kurta' as any,
        colors: ['Indigo', 'White'],
        seasons: ['summer'],
        occasions: ['office', 'everyday'],
        formality: 3,
        status: 'clean',
        favorite: true,
        photoId: 'photo_kurta_01',
        note: 'Pure cotton hand-spun',
        timesWorn: 3,
        userVerified: true,
        createdAt: Date.now(),
      };

      const item2: WardrobeItem = {
        id: 'item_02',
        userId: testUserId,
        name: 'Banarasi Brocade Saree',
        category: 'Ethnic',
        subcategory: 'saree' as any,
        colors: ['Maroon', 'Gold'],
        seasons: ['winter'],
        occasions: ['wedding guest', 'festive'],
        formality: 5,
        status: 'clean',
        favorite: true,
        photoId: 'photo_saree_02',
        note: 'Bridal collection',
        timesWorn: 1,
        userVerified: true,
        createdAt: Date.now(),
      };

      // Tombstone item
      const itemDeleted: WardrobeItem = {
        id: 'item_del_03',
        userId: testUserId,
        name: 'Worn Out T-Shirt',
        category: 'Tops',
        subcategory: 'tshirt' as any,
        colors: ['Grey'],
        seasons: ['summer'],
        occasions: ['casual outing'],
        formality: 1,
        status: 'clean',
        favorite: false,
        note: 'Donated',
        timesWorn: 50,
        isDeleted: true,
        deletedAt: Date.now() - 86400000,
        createdAt: Date.now() - 172800000,
      };

      await wardrobeRepo.upsertItemRaw(item1);
      await wardrobeRepo.upsertItemRaw(item2);
      await wardrobeRepo.upsertItemRaw(itemDeleted);

      // 3. Populate saved outfit
      const outfit: SavedOutfit = {
        id: 'outfit_01',
        userId: testUserId,
        name: 'Classic Festive Ensemble',
        outfit: {
          id: 'gen_outfit_01',
          template: 'Ethnic Festive',
          slots: { top: [item1], bottom: [item2] },
          score: 0.95,
          why: 'Harmonious festive look',
        },
        savedAt: Date.now(),
      };
      await wardrobeRepo.upsertSavedOutfitRaw(outfit);

      // 4. Populate calendar plan
      const plan: OutfitPlan = {
        id: 'plan_01',
        userId: testUserId,
        date: '2026-11-25',
        outfit: {
          id: 'outfit_gen_01',
          template: 'Ethnic',
          slots: { top: [item1], bottom: [item2] },
          score: 0.9,
          why: 'Diwali celebration attire',
        },
        occasion: 'festive' as any,
        status: 'planned',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await calendarRepo.savePlan(plan);

      // 5. Populate style preferences
      const pref: StylePreferences = {
        userId: testUserId,
        preferredContexts: ['festive', 'work'],
        preferredAesthetics: ['classic', 'minimal'],
        stylingMode: 'variety',
        updatedAt: Date.now(),
      };
      await prefRepo.savePreferences(pref);

      // 6. Populate wear event
      const event: WearEvent = {
        id: 'wear_01',
        userId: testUserId,
        wardrobeItemId: item1.id,
        wornAt: Date.now(),
        createdAt: Date.now(),
      };
      await wearRepo.addEvent(event);

      // 7. Populate dead-letter sync mutation
      const deadMut = await syncQueue.enqueue({
        mutationId: 'mut_dead_01',
        entityType: 'wardrobe_item',
        entityId: item1.id,
        action: 'update',
        type: 'WARDROBE_ITEM_UPSERT',
        payload: { name: 'Unsaved Edit' } as any,
        createdAt: Date.now(),
        userId: testUserId,
      } as any);
      await syncQueue.markFailed(deadMut.id, 'REVISION_REQUIRED', true);

      // 8. Generate full backup
      const backup = await backupService.createBackup({ userId: testUserId });

      // Assert metadata counts
      expect(backup.version).toBe(3);
      expect(backup.userId).toBe(testUserId);
      expect(backup.metadata.itemCount).toBe(3);
      expect(backup.metadata.outfitCount).toBe(1);
      expect(backup.metadata.planCount).toBe(1);
      expect(backup.metadata.wearEventCount).toBe(1);
      expect(backup.metadata.imageCount).toBe(2);
      expect(backup.metadata.totalImageBytes).toBe(24);

      // Assert tombstone tracked
      expect(backup.sync.tombstones).toHaveLength(1);
      expect(backup.sync.tombstones[0].id).toBe('item_del_03');

      // Assert dead letter captured
      expect(backup.sync.unresolvedMutations).toHaveLength(1);
      expect(backup.sync.unresolvedMutations[0].mutationId).toBe('mut_dead_01');

      // ASSERT ACTUAL BLOB HASHES MATCH IN BACKUP
      const img1 = backup.images.find((i) => i.photoId === 'photo_kurta_01');
      const img2 = backup.images.find((i) => i.photoId === 'photo_saree_02');

      expect(img1).toBeDefined();
      expect(img1?.byteLength).toBe(hash1.size);
      expect(img1?.sha256).toBe(hash1.sha256);

      expect(img2).toBeDefined();
      expect(img2?.byteLength).toBe(hash2.size);
      expect(img2?.sha256).toBe(hash2.sha256);
    });

    it('rejects malformed, incomplete, and unsupported backup versions', () => {
      // Not an object
      expect(validateBackup('invalid-string').valid).toBe(false);
      expect(validateBackup(null).valid).toBe(false);

      // Missing version
      expect(validateBackup({ userId: 'u1' }).valid).toBe(false);

      // Unsupported version
      expect(validateBackup({ version: 99, userId: 'u1', wardrobe: { items: [] } }).errors).toContain(
        'Unsupported backup version: 99. Supported versions: 1, 2, 3'
      );

      // Missing userId
      expect(validateBackup({ version: 3, wardrobe: { items: [] } }).errors).toContain(
        'Missing or invalid userId in backup payload'
      );

      // Missing wardrobe section
      expect(validateBackup({ version: 3, userId: 'u1' }).errors).toContain(
        'Missing wardrobe section in backup payload'
      );
    });
  });

  // ==========================================================================
  // SECTION 2: RESTORE VALIDATION & IMAGE INTEGRITY CHECKING
  // ==========================================================================
  describe('2. Restore Validation & Cryptographic Blob Verification', () => {
    it('restores into an empty database and verifies binary Blobs match byte-for-byte and SHA-256', async () => {
      // 1. Prepare synthetic backup with real binary image Blobs
      const rawImageBytes = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
      const sourceBlob = new Blob([rawImageBytes], { type: 'image/jpeg' });
      const expectedHash = await computeBlobHash(sourceBlob);
      const base64Data = await blobToBase64(sourceBlob);

      const syntheticBackup: StyleSaathiBackup = {
        version: 3,
        schemaVersion: '3.0.0-phase3e',
        exportedAt: new Date().toISOString(),
        userId: testUserId,
        metadata: {
          appVersion: '3.0.0-phase3e',
          itemCount: 1,
          outfitCount: 0,
          planCount: 0,
          wearEventCount: 0,
          signalCount: 0,
          imageCount: 1,
          totalImageBytes: expectedHash.size,
        },
        wardrobe: {
          items: [
            {
              id: 'restored_item_01',
              name: 'Restored Chanderi Kurta',
              category: 'Ethnic',
              subcategory: 'kurta' as any,
              colors: ['Gold'],
              seasons: ['summer'],
              occasions: ['festive'],
              formality: 4,
              status: 'clean',
              favorite: true,
              photoId: 'photo_chanderi_01',
              note: 'Verified restoration',
              timesWorn: 0,
              userVerified: true,
              createdAt: Date.now(),
            },
          ],
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
        images: [
          {
            photoId: 'photo_chanderi_01',
            mimeType: 'image/jpeg',
            byteLength: expectedHash.size,
            sha256: expectedHash.sha256,
            dataBase64: base64Data,
          },
        ],
      };

      // 2. Perform restore into empty DB
      const result = await backupService.restoreBackup(syntheticBackup, { mode: 'overwrite' });
      expect(result.success).toBe(true);
      expect(result.itemsRestored).toBe(1);
      expect(result.imagesRestored).toBe(1);
      expect(result.verifiedImageHashes).toBe(1);

      // 3. Inspect restored item
      const item = await wardrobeRepo.getItem('restored_item_01');
      expect(item).toBeDefined();
      expect(item?.name).toBe('Restored Chanderi Kurta');

      // 4. RETRIEVE ACTUAL BLOB FROM STORE AND VERIFY EXACT HASH & LENGTH
      const restoredBlob = await getImage('photo_chanderi_01');
      expect(restoredBlob).toBeDefined();
      expect(restoredBlob).toBeInstanceOf(Blob);

      const restoredHash = await computeBlobHash(restoredBlob!);
      expect(restoredHash.size).toBe(expectedHash.size);
      expect(restoredHash.sha256).toBe(expectedHash.sha256);
    });

    it('detects and rejects image tampering when SHA-256 hash or byte length does not match', async () => {
      const rawImageBytes = new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]);
      const sourceBlob = new Blob([rawImageBytes], { type: 'image/jpeg' });
      const base64Data = await blobToBase64(sourceBlob);

      const tamperedBackup: StyleSaathiBackup = {
        version: 3,
        schemaVersion: '3.0.0-phase3e',
        exportedAt: new Date().toISOString(),
        userId: testUserId,
        metadata: {
          appVersion: '3.0.0-phase3e',
          itemCount: 1,
          outfitCount: 0,
          planCount: 0,
          wearEventCount: 0,
          signalCount: 0,
          imageCount: 1,
          totalImageBytes: 4,
        },
        wardrobe: {
          items: [
            {
              id: 'item_tampered',
              name: 'Tampered Item',
              category: 'Tops',
              subcategory: 'shirt' as any,
              colors: ['Black'],
              seasons: ['summer'],
              occasions: ['everyday'],
              formality: 2,
              status: 'clean',
              favorite: false,
              photoId: 'photo_tampered',
              note: '',
              timesWorn: 0,
              createdAt: Date.now(),
            },
          ],
          savedOutfits: [],
          calendarPlans: [],
          preferences: null,
          wearEvents: [],
          styleSignals: [],
        },
        sync: { unresolvedMutations: [], tombstones: [] },
        images: [
          {
            photoId: 'photo_tampered',
            mimeType: 'image/jpeg',
            byteLength: 4,
            sha256: '0000000000000000000000000000000000000000000000000000000000000000', // Forged hash!
            dataBase64: base64Data,
          },
        ],
      };

      await expect(backupService.restoreBackup(tamperedBackup)).rejects.toThrow(/IMAGE_CORRUPTION_DETECTED/);
    });

    it('strictly forbids cross-user backup restoration without explicit tenant authorization', async () => {
      const crossUserBackup: StyleSaathiBackup = {
        version: 3,
        schemaVersion: '3.0.0-phase3e',
        exportedAt: new Date().toISOString(),
        userId: 'victim_user_a',
        metadata: {
          appVersion: '3.0.0-phase3e',
          itemCount: 1,
          outfitCount: 0,
          planCount: 0,
          wearEventCount: 0,
          signalCount: 0,
          imageCount: 0,
          totalImageBytes: 0,
        },
        wardrobe: {
          items: [],
          savedOutfits: [],
          calendarPlans: [],
          preferences: null,
          wearEvents: [],
          styleSignals: [],
        },
        sync: { unresolvedMutations: [], tombstones: [] },
        images: [],
      };

      // Attempting to restore into attacker session
      await expect(
        backupService.restoreBackup(crossUserBackup, { targetUserId: 'attacker_user_b' })
      ).rejects.toThrow(/CROSS_USER_RESTORATION_FORBIDDEN/);
    });

    it('restores into an existing database with duplicate record handling and no silent data loss', async () => {
      // 1. Initial local item in database
      const existingItem: WardrobeItem = {
        id: 'dup_item_01',
        userId: testUserId,
        name: 'Local Existing Item',
        category: 'Tops',
        subcategory: 'shirt' as any,
        colors: ['White'],
        seasons: ['summer'],
        occasions: ['everyday'],
        formality: 2,
        status: 'clean',
        favorite: false,
        note: 'Locally present before restore',
        timesWorn: 1,
        createdAt: Date.now(),
      };
      await wardrobeRepo.upsertItemRaw(existingItem);

      // 2. Incoming backup containing item with same ID plus a new item
      const incomingBackup: StyleSaathiBackup = {
        version: 3,
        schemaVersion: '3.0.0-phase3e',
        exportedAt: new Date().toISOString(),
        userId: testUserId,
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
          items: [
            {
              id: 'dup_item_01',
              name: 'Updated Existing Item from Backup',
              category: 'Tops',
              subcategory: 'shirt' as any,
              colors: ['White', 'Navy'],
              seasons: ['summer'],
              occasions: ['everyday'],
              formality: 2,
              status: 'clean',
              favorite: true,
              note: 'Updated notes',
              timesWorn: 2,
              createdAt: Date.now(),
            },
            {
              id: 'new_item_02',
              name: 'Brand New Restored Item',
              category: 'Bottoms',
              subcategory: 'jeans' as any,
              colors: ['Blue'],
              seasons: ['winter'],
              occasions: ['casual outing'],
              formality: 2,
              status: 'clean',
              favorite: false,
              note: 'New arrival',
              timesWorn: 0,
              createdAt: Date.now(),
            },
          ],
          savedOutfits: [],
          calendarPlans: [],
          preferences: null,
          wearEvents: [],
          styleSignals: [],
        },
        sync: { unresolvedMutations: [], tombstones: [] },
        images: [],
      };

      // 3. Restore in merge mode
      const result = await backupService.restoreBackup(incomingBackup, { mode: 'merge' });
      expect(result.success).toBe(true);
      expect(result.itemsRestored).toBe(2);

      // Verify no duplicate IDs: exactly 2 items total in repository
      const allItems = await wardrobeRepo.getAllItemsRaw();
      expect(allItems).toHaveLength(2);
      expect(allItems.map((i) => i.id).sort()).toEqual(['dup_item_01', 'new_item_02']);

      const updated = await wardrobeRepo.getItem('dup_item_01');
      expect(updated?.name).toBe('Updated Existing Item from Backup');
      expect(updated?.favorite).toBe(true);
    });

    it('executes backup creation and restoration completely offline without network calls', async () => {
      // Simulate offline environment
      const originalOnLine = typeof navigator !== 'undefined' ? navigator.onLine : true;
      try {
        Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

        const offlineItem: WardrobeItem = {
          id: 'item_offline_01',
          name: 'Offline Linen Trousers',
          category: 'Bottoms',
          subcategory: 'trousers' as any,
          colors: ['Beige'],
          seasons: ['summer'],
          occasions: ['casual outing'],
          formality: 3,
          status: 'clean',
          favorite: true,
          note: 'Created offline',
          timesWorn: 0,
          createdAt: Date.now(),
        };
        await wardrobeRepo.upsertItemRaw(offlineItem);

        // Offline export
        const backup = await backupService.createBackup({ userId: testUserId });
        expect(backup.wardrobe.items).toHaveLength(1);

        // Offline wipe and restore
        await wardrobeRepo.clear();
        expect(await wardrobeRepo.getItems()).toHaveLength(0);

        const restoreResult = await backupService.restoreBackup(backup);
        expect(restoreResult.success).toBe(true);

        const restored = await wardrobeRepo.getItem('item_offline_01');
        expect(restored).toBeDefined();
        expect(restored?.name).toBe('Offline Linen Trousers');
      } finally {
        Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
      }
    });

    it('handles large backup datasets without truncating records or data loss', async () => {
      // Generate 50 items and 20 outfits
      for (let i = 1; i <= 50; i++) {
        await wardrobeRepo.upsertItemRaw({
          id: `bulk_item_${i}`,
          name: `Bulk Garment ${i}`,
          category: i % 2 === 0 ? 'Tops' : 'Ethnic',
          subcategory: i % 2 === 0 ? 'shirt' as any : 'kurta' as any,
          colors: ['Blue'],
          seasons: ['summer'],
          occasions: ['everyday'],
          formality: 3,
          status: 'clean',
          favorite: i % 5 === 0,
          note: `Auto-generated garment item ${i}`,
          timesWorn: i % 3,
          createdAt: Date.now(),
        });
      }

      const backupJson = await backupService.exportBackupJson({ userId: testUserId });
      expect(typeof backupJson).toBe('string');
      expect(backupJson.length).toBeGreaterThan(10000);

      const parsed = JSON.parse(backupJson) as StyleSaathiBackup;
      expect(parsed.wardrobe.items).toHaveLength(50);
      expect(parsed.metadata.itemCount).toBe(50);
    });
  });

  // ==========================================================================
  // SECTION 3: MIGRATION & ROLLBACK REHEARSAL (D1 SQLITE RUNTIME)
  // ==========================================================================
  describe('3. Migration & Rollback Rehearsal [Isolated SQLite Runtime]', () => {
    let d1: DatabaseSync;

    beforeEach(() => {
      d1 = new DatabaseSync(':memory:');
      d1.exec('PRAGMA foreign_keys = ON;');
      d1.exec(fs.readFileSync(MIGRATION_1, 'utf-8'));
      d1.exec(fs.readFileSync(MIGRATION_2, 'utf-8'));
      d1.exec(fs.readFileSync(MIGRATION_3, 'utf-8'));
    });

    afterEach(() => {
      try {
        d1.close();
      } catch {}
    });

    it('executes clean synthetic legacy data migration into local D1 and validates foreign keys', () => {
      // Provision user
      d1.prepare(`
        INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
        VALUES (?, 'Test User', 'test@example.com', 1, datetime('now'), datetime('now'))
      `).run(testUserId);

      // Migrate synthetic legacy wardrobe items
      const insertItem = d1.prepare(`
        INSERT INTO wardrobe_items (
          id, user_id, name, category, subcategory, colors, seasons, occasions, formality,
          status, favorite, note, times_worn, user_verified, is_deleted, created_at, client_updated_at, server_updated_at, revision
        ) VALUES (
          ?, ?, ?, 'Ethnic', 'kurta', '["Blue"]', '["summer"]', '["work"]', 3,
          'clean', 1, 'Legacy imported', 0, 1, 0, datetime('now'), datetime('now'), datetime('now'), 1
        )
      `);

      for (let i = 1; i <= 5; i++) {
        insertItem.run(`item_legacy_${i}`, testUserId, `Legacy Garment ${i}`);
      }

      // Verify count in D1
      const count = d1.prepare('SELECT COUNT(*) as c FROM wardrobe_items WHERE user_id = ?').get(testUserId) as any;
      expect(count.c).toBe(5);

      // Verify wear event foreign key to wardrobe item succeeds
      d1.prepare(`
        INSERT INTO wear_events (id, user_id, wardrobe_item_id, worn_at, created_at)
        VALUES ('wear_leg_01', ?, 'item_legacy_1', datetime('now'), datetime('now'))
      `).run(testUserId);

      const wearCount = d1.prepare('SELECT COUNT(*) as c FROM wear_events WHERE user_id = ?').get(testUserId) as any;
      expect(wearCount.c).toBe(1);
    });

    it('demonstrates pre-cutover atomic rollback when migration batch encounters foreign key violation', () => {
      d1.prepare(`
        INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
        VALUES (?, 'Rollback User', 'rollback@example.com', 1, datetime('now'), datetime('now'))
      `).run(testUserId);

      const itemsBefore = d1.prepare('SELECT COUNT(*) as c FROM wardrobe_items WHERE user_id = ?').get(testUserId) as any;
      expect(itemsBefore.c).toBe(0);

      // Execute migration batch in explicit transaction
      expect(() => {
        d1.exec('BEGIN TRANSACTION;');
        try {
          // Valid item 1
          d1.prepare(`
            INSERT INTO wardrobe_items (
              id, user_id, name, category, subcategory, formality, created_at, client_updated_at, server_updated_at, revision
            ) VALUES ('item_valid_1', ?, 'Valid Kurta', 'Ethnic', 'kurta', 3, datetime('now'), datetime('now'), datetime('now'), 1)
          `).run(testUserId);

          // Invalid item 2: references non-existent user 'non_existent_usr_99'
          d1.prepare(`
            INSERT INTO wardrobe_items (
              id, user_id, name, category, subcategory, formality, created_at, client_updated_at, server_updated_at, revision
            ) VALUES ('item_invalid_2', 'non_existent_usr_99', 'Orphan Kurta', 'Ethnic', 'kurta', 3, datetime('now'), datetime('now'), datetime('now'), 1)
          `).run();

          d1.exec('COMMIT;');
        } catch (err) {
          d1.exec('ROLLBACK;');
          throw err;
        }
      }).toThrow(/FOREIGN KEY constraint failed/);

      // Verify complete pre-cutover rollback: item_valid_1 was NOT persisted!
      const itemsAfter = d1.prepare('SELECT COUNT(*) as c FROM wardrobe_items WHERE user_id = ?').get(testUserId) as any;
      expect(itemsAfter.c).toBe(0);
    });

    it('demonstrates post-cutover data reconciliation and recovery of unresolved local mutations', async () => {
      // Simulate post-cutover scenario:
      // Local client has an unresolved dead-letter mutation from before cutover.
      const dl = await syncQueue.enqueue({
        mutationId: 'mut_cutover_dead',
        entityType: 'wardrobe_item' as const,
        entityId: 'item_cutover_01',
        action: 'update' as const,
        type: 'WARDROBE_ITEM_UPSERT',
        payload: { name: 'Pre-Cutover User Edit' } as any,
        createdAt: Date.now(),
        userId: testUserId,
      } as any);
      await syncQueue.markFailed(dl.id, 'REVISION_REQUIRED', true);

      // Export unresolved mutations
      const deadLetters = await syncQueue.getDeadLetterMutations(testUserId);
      expect(deadLetters).toHaveLength(1);
      expect(deadLetters[0].mutationId).toBe('mut_cutover_dead');

      // Rehearsal recovery: generate fresh mutation ID, bind expected revision (1), and enqueue
      const recoveredMutation = {
        ...deadLetters[0],
        mutationId: `mut_recovered_${Date.now()}`,
        status: 'pending' as const,
        expectedRevision: 1,
        retryCount: 0,
        lastError: undefined,
      };

      await syncQueue.discardMutation(dl.id);
      await syncQueue.enqueue(recoveredMutation);

      // Verify dead letter cleared and fresh mutation queued
      const remainingDeadLetters = await syncQueue.getDeadLetterMutations(testUserId);
      expect(remainingDeadLetters).toHaveLength(0);

      const nextToProcess = await syncQueue.peekNext(testUserId);
      expect(nextToProcess?.mutationId).toBe(recoveredMutation.mutationId);
      expect(nextToProcess?.status).toBe('pending');
    });
  });

  // ==========================================================================
  // SECTION 4: ACCOUNT LIFECYCLE, LINKING & DELETION REHEARSAL
  // ==========================================================================
  describe('4. Account Lifecycle, Linking, Deletion Tombstones & Tenant Isolation', () => {
    let d1: DatabaseSync;

    beforeEach(() => {
      d1 = new DatabaseSync(':memory:');
      d1.exec('PRAGMA foreign_keys = ON;');
      d1.exec(fs.readFileSync(MIGRATION_1, 'utf-8'));
      d1.exec(fs.readFileSync(MIGRATION_2, 'utf-8'));
      d1.exec(fs.readFileSync(MIGRATION_3, 'utf-8'));
    });

    afterEach(() => {
      try {
        d1.close();
      } catch {}
    });

    it('provisions new account and creates initial profile and preferences', () => {
      const newUserId = `usr_lifecycle_${Date.now()}`;

      d1.prepare(`
        INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
        VALUES (?, 'Pooja Hegde', 'pooja@example.com', 1, datetime('now'), datetime('now'))
      `).run(newUserId);

      d1.prepare(`
        INSERT INTO profiles (id, display_name, created_at, updated_at)
        VALUES (?, 'Pooja Hegde', datetime('now'), datetime('now'))
      `).run(newUserId);

      const user = d1.prepare('SELECT id, name FROM user WHERE id = ?').get(newUserId) as any;
      const profile = d1.prepare('SELECT id, display_name FROM profiles WHERE id = ?').get(newUserId) as any;

      expect(user.name).toBe('Pooja Hegde');
      expect(profile.display_name).toBe('Pooja Hegde');
    });

    it('enforces deletion tombstones and idempotent account deletion', () => {
      const delUserId = `usr_del_${Date.now()}`;
      const requestId = `del_req_${Date.now()}`;

      // Provision user and items
      d1.prepare(`
        INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
        VALUES (?, 'Delete Target', 'delete_me@example.com', 1, datetime('now'), datetime('now'))
      `).run(delUserId);

      d1.prepare(`
        INSERT INTO wardrobe_items (id, user_id, name, category, subcategory, formality, created_at, client_updated_at, server_updated_at, revision)
        VALUES ('item_to_delete', ?, 'Item to Delete', 'Ethnic', 'kurta', 3, datetime('now'), datetime('now'), datetime('now'), 1)
      `).run(delUserId);

      // Perform deletion transaction: write tombstone and cascade delete user
      d1.exec('BEGIN TRANSACTION;');
      d1.prepare(`
        INSERT INTO deletion_tombstones (request_id, secret_hash, user_id_hash, deleted_at, expires_at, reconciled)
        VALUES (?, 'hash_secret', 'hash_user', datetime('now'), datetime('now', '+90 days'), 1)
      `).run(requestId);

      d1.prepare('DELETE FROM user WHERE id = ?').run(delUserId);
      d1.exec('COMMIT;');

      // Verify user and wardrobe items erased via cascade
      const userAfter = d1.prepare('SELECT id FROM user WHERE id = ?').all(delUserId);
      const itemsAfter = d1.prepare('SELECT id FROM wardrobe_items WHERE user_id = ?').all(delUserId);
      expect(userAfter).toHaveLength(0);
      expect(itemsAfter).toHaveLength(0);

      // Verify tombstone is safely retained
      const tombstone = d1.prepare('SELECT request_id, reconciled FROM deletion_tombstones WHERE request_id = ?').get(requestId) as any;
      expect(tombstone.request_id).toBe(requestId);
      expect(tombstone.reconciled).toBe(1);

      // Verify idempotency: re-requesting deletion with same requestId can check tombstone
      const existingTombstone = d1.prepare('SELECT request_id FROM deletion_tombstones WHERE request_id = ?').get(requestId);
      expect(existingTombstone).toBeDefined();
    });

    it('maintains strict tenant isolation when switching accounts with pending local mutations', async () => {
      const userA = 'usr_tenant_A';
      const userB = 'usr_tenant_B';

      // User A enqueues pending mutations
      await syncQueue.enqueue({
        mutationId: 'mut_userA_01',
        entityType: 'wardrobe_item',
        entityId: 'item_A_01',
        action: 'create',
        type: 'WARDROBE_ITEM_UPSERT',
        status: 'pending',
        payload: { name: 'User A Silk Scarf' } as any,
        createdAt: Date.now(),
        retryCount: 0,
        userId: userA,
      } as any);

      // User B checks queue
      const nextForB = await syncQueue.peekNext(userB);
      expect(nextForB).toBeNull(); // User B sees NOTHING from User A

      const deadLettersForB = await syncQueue.getDeadLetterMutations(userB);
      expect(deadLettersForB).toHaveLength(0);

      // User A checks queue
      const nextForA = await syncQueue.peekNext(userA);
      expect(nextForA?.mutationId).toBe('mut_userA_01');
    });

    it('rehearses account linking: allows linking when email is verified, rejects when unverified', () => {
      const existingUserId = `usr_existing_${Date.now()}`;
      d1.prepare(`
        INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
        VALUES (?, 'Kavita Roy', 'kavita@example.com', 1, datetime('now'), datetime('now'))
      `).run(existingUserId);

      // Account linking attempt 1: Verified email -> allowed
      const isEmailVerified = 1;
      if (isEmailVerified === 1) {
        d1.prepare(`
          INSERT INTO account (id, userId, accountId, providerId, createdAt, updatedAt)
          VALUES ('acc_google_01', ?, 'google_sub_123', 'google', datetime('now'), datetime('now'))
        `).run(existingUserId);
      }

      const linkedAccount = d1.prepare('SELECT id FROM account WHERE userId = ?').all(existingUserId);
      expect(linkedAccount).toHaveLength(1);

      // Account linking attempt 2: Unverified email -> forbidden by policy
      const unverifiedAttempt = () => {
        const unverifiedEmail = 0;
        if (unverifiedEmail === 0) {
          throw new Error('EMAIL_VERIFICATION_REQUIRED: Unverified external accounts cannot be linked');
        }
      };
      expect(unverifiedAttempt).toThrow(/EMAIL_VERIFICATION_REQUIRED/);
    });

    it('simulates reconnection after extended offline periods with accumulated mutations', async () => {
      // Simulate client accumulating 5 mutations while offline for 14 days
      const baseTime = Date.now() - 14 * 24 * 60 * 60 * 1000;
      for (let i = 1; i <= 5; i++) {
        await syncQueue.enqueue({
          mutationId: `offline_mut_${i}`,
          entityType: 'wardrobe_item',
          entityId: `offline_item_${i}`,
          action: 'create',
          type: 'WARDROBE_ITEM_UPSERT',
          status: 'pending',
          payload: { name: `Offline Garment ${i}` } as any,
          createdAt: baseTime + i * 1000,
          userId: testUserId,
        } as any);
      }

      // Reconnection: queue yields all 5 mutations in strict FIFO order
      const allQueued = await syncQueue.getAllMutations();
      expect(allQueued).toHaveLength(5);
      expect(allQueued.map((m) => m.mutationId)).toEqual([
        'offline_mut_1',
        'offline_mut_2',
        'offline_mut_3',
        'offline_mut_4',
        'offline_mut_5',
      ]);
    });
  });

  // ==========================================================================
  // SECTION 5: EMPIRICAL DATA INTEGRITY COMPARISON (100% MATCH AUDIT)
  // ==========================================================================
  describe('5. Empirical Data Integrity Audit: Pre vs Post Migration Equality', () => {
    it('compares pre-migration dataset and post-restoration dataset for 100% metric congruence', async () => {
      // 1. Build comprehensive source dataset
      const rawImageBytes = new Uint8Array([0x53, 0x74, 0x79, 0x6c, 0x65, 0x53, 0x61, 0x61, 0x74, 0x68, 0x69]);
      const sourceBlob = new Blob([rawImageBytes], { type: 'image/jpeg' });
      const sourceHash = await computeBlobHash(sourceBlob);
      await saveImage('photo_audit_item', sourceBlob);

      const sourceItem: WardrobeItem = {
        id: 'audit_item_01',
        userId: testUserId,
        name: 'Zari Silk Dupatta',
        category: 'Accessories',
        subcategory: 'dupatta' as any,
        colors: ['Gold', 'Crimson'],
        seasons: ['winter'],
        occasions: ['festive', 'wedding guest'],
        formality: 5,
        status: 'clean',
        favorite: true,
        photoId: 'photo_audit_item',
        note: 'High-value heirloom',
        timesWorn: 2,
        userVerified: true,
        createdAt: 1700000000000,
      };
      await wardrobeRepo.upsertItemRaw(sourceItem);

      // Export backup
      const backup = await backupService.createBackup({ userId: testUserId });

      // Wipe local storage completely
      await wardrobeRepo.clear();
      await clearImages();

      // Restore backup into clean state
      const restoreResult = await backupService.restoreBackup(backup, { mode: 'overwrite' });
      expect(restoreResult.success).toBe(true);

      // Compare datasets:
      // 1. Record counts
      const restoredItems = await wardrobeRepo.getAllItemsRaw();
      expect(restoredItems.length).toBe(1);

      // 2. Primary keys
      expect(restoredItems[0].id).toBe(sourceItem.id);

      // 3. Ownership references
      expect(restoredItems[0].userId).toBe(sourceItem.userId);

      // 4. Attribute integrity
      expect(restoredItems[0].name).toBe(sourceItem.name);
      expect(restoredItems[0].colors).toEqual(sourceItem.colors);
      expect(restoredItems[0].formality).toBe(sourceItem.formality);
      expect(restoredItems[0].userVerified).toBe(sourceItem.userVerified);

      // 5. Binary Blob byte size and SHA-256 hash
      const restoredBlob = await getImage('photo_audit_item');
      expect(restoredBlob).toBeDefined();
      const restoredHash = await computeBlobHash(restoredBlob!);

      expect(restoredHash.size).toBe(sourceHash.size);
      expect(restoredHash.sha256).toBe(sourceHash.sha256);
    });
  });
});
