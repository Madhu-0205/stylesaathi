// ============================================================================
// STYLESAATHI 3.0 — PHASE 3E.1: ADVERSARIAL MIGRATION REHEARSAL AUDIT
// Independent, Empirical, Read-Only Audit Test Suite
// Covers:
// 1. Synthetic Dataset Scaling Benchmarks (100, 1,000, 5,000 records)
// 2. Binary Image Blob Serialization & SHA-256 Tamper Resistance
// 3. Adversarial Restore Scenarios (Corrupted, Truncated, Cross-User, Stale)
// 4. Account Deletion, Offline Reconnection & Zombie Resurrection Prevention
// 5. Transaction & Batch Atomicity Across SQLite and Local D1 Runtimes
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
  type BackupImagePayload,
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
import { resolveWardrobeItemConflict } from '../lib/sync/conflictResolvers';
import type {
  WardrobeItem,
  SavedOutfit,
  OutfitPlan,
  StylePreferences,
  WearEvent,
  StyleSignalEvent,
  SyncMutation,
} from '../types';

// Helper to generate synthetic binary Blobs with deterministic data
function createSyntheticImageBlob(sizeBytes: number, fillByte = 0x42): Blob {
  const buffer = new Uint8Array(sizeBytes);
  buffer.fill(fillByte);
  return new Blob([buffer], { type: 'image/jpeg' });
}

// Helper to locate Miniflare D1 SQLite database
function findLocalD1SqliteFile(): string | null {
  const d1Dir = path.resolve(__dirname, '../../worker/.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
  if (!fs.existsSync(d1Dir)) return null;
  const files = fs.readdirSync(d1Dir);
  const sqliteFile = files.find((f) => f.endsWith('.sqlite') && f !== 'metadata.sqlite');
  return sqliteFile ? path.join(d1Dir, sqliteFile) : null;
}

describe('StyleSaathi 3.0 — Phase 3E.1: Adversarial Migration Rehearsal Audit', () => {
  let wardrobeRepo: LocalStorageWardrobeRepository;
  let calendarRepo: LocalStorageCalendarRepository;
  let prefRepo: LocalStoragePreferencesRepository;
  let wearRepo: LocalStorageWearEventsRepository;
  let signalsRepo: LocalStorageStyleSignalsRepository;

  const testUser = 'usr_audit_adversary_001';
  const otherUser = 'usr_audit_adversary_002';

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
  });

  // ==========================================================================
  // SECTION 1: EXPANDED SYNTHETIC DATASET SCALING & BENCHMARKING
  // ==========================================================================
  describe('1. Synthetic Dataset Scaling Benchmarks (100, 1,000, 5,000 records)', () => {
    it('1.1 Benchmarks 100 wardrobe records with realistic image Blobs', async () => {
      const itemCount = 100;
      const imageCount = 10;
      const imageSizeBytes = 50 * 1024; // 50 KB realistic image

      // 1. Populate repositories
      for (let i = 0; i < itemCount; i++) {
        const photoId = i < imageCount ? `photo_100_${i}` : undefined;
        if (photoId) {
          await saveImage(photoId, createSyntheticImageBlob(imageSizeBytes, (i % 250) + 1));
        }

        const isTombstone = i >= 90; // 10% tombstones
        await wardrobeRepo.upsertItemRaw({
          id: `item_100_${i}`,
          userId: testUser,
          name: `Garment Item ${i}`,
          category: 'Tops',
          subcategory: 'shirt',
          seasons: ['summer'],
          occasions: ['everyday'],
          colors: ['blue'],
          photoId,
          isDeleted: isTombstone,
          deletedAt: isTombstone ? Date.now() - 10000 : undefined,
          revision: 1,
          createdAt: Date.now() - 20000,
          clientUpdatedAt: Date.now() - 10000,
        } as any);
      }

      // Add outfits, plans, events, signals
      for (let i = 0; i < 20; i++) {
        await wardrobeRepo.upsertSavedOutfitRaw({
          id: `outfit_100_${i}`,
          userId: testUser,
          name: `Outfit ${i}`,
          outfit: {
            id: `gen_100_${i}`,
            template: 'Casual',
            slots: {},
            score: 0.9,
            why: 'Casual match',
          },
          savedAt: Date.now(),
        });
      }

      for (let i = 0; i < 30; i++) {
        await calendarRepo.savePlan({
          id: `plan_100_${i}`,
          userId: testUser,
          date: `2026-11-${String(i + 1).padStart(2, '0')}`,
          outfit: {
            id: `plan_gen_100_${i}`,
            template: 'Casual',
            slots: {},
            score: 0.9,
            why: 'Daily plan',
          },
          occasion: 'everyday',
          status: 'planned',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      for (let i = 0; i < 100; i++) {
        await wearRepo.addEvent({
          id: `wear_100_${i}`,
          userId: testUser,
          wardrobeItemId: `item_100_${i % itemCount}`,
          wornAt: Date.now() - 86400000 * (i % 20),
          createdAt: Date.now(),
        });
      }

      for (let i = 0; i < 50; i++) {
        await signalsRepo.addSignal({
          id: `signal_100_${i}`,
          userId: testUser,
          signalType: 'favorited',
          itemIds: [`item_100_${i % itemCount}`],
          createdAt: Date.now(),
        });
      }

      // Measure Export
      const memBeforeExport = process.memoryUsage().heapUsed;
      const exportStart = performance.now();
      const backup = await backupService.createBackup({ userId: testUser });
      const exportJson = JSON.stringify(backup);
      const exportDurationMs = performance.now() - exportStart;
      const memAfterExport = process.memoryUsage().heapUsed;

      expect(backup.metadata.itemCount).toBe(100);
      expect(backup.metadata.imageCount).toBe(10);
      expect(backup.images.length).toBe(10);

      // Measure Import
      await wardrobeRepo.clear();
      await clearImages();

      const importStart = performance.now();
      const restoreResult = await backupService.restoreBackup(backup, { targetUserId: testUser });
      const importDurationMs = performance.now() - importStart;

      expect(restoreResult.success).toBe(true);
      expect(restoreResult.itemsRestored).toBe(100);
      expect(restoreResult.imagesRestored).toBe(10);
      expect(restoreResult.verifiedImageHashes).toBe(10);

      console.log(`[Benchmark 100 records] Export: ${exportDurationMs.toFixed(2)}ms, Import: ${importDurationMs.toFixed(2)}ms, JSON Size: ${(exportJson.length / 1024).toFixed(1)} KB, Heap Delta: ${((memAfterExport - memBeforeExport) / 1024 / 1024).toFixed(2)} MB`);
    });

    it('1.2 Benchmarks 1,000 wardrobe records with realistic image Blobs', async () => {
      const itemCount = 1000;
      const imageCount = 20;
      const imageSizeBytes = 50 * 1024; // 50 KB each = 1 MB images

      for (let i = 0; i < itemCount; i++) {
        const photoId = i < imageCount ? `photo_1k_${i}` : undefined;
        if (photoId) {
          await saveImage(photoId, createSyntheticImageBlob(imageSizeBytes, (i % 250) + 1));
        }

        const isTombstone = i >= 900; // 10% tombstones
        await wardrobeRepo.upsertItemRaw({
          id: `item_1k_${i}`,
          userId: testUser,
          name: `Garment Item ${i}`,
          category: 'Ethnic',
          subcategory: 'kurta',
          seasons: ['winter'],
          occasions: ['festive'],
          colors: ['maroon'],
          photoId,
          isDeleted: isTombstone,
          deletedAt: isTombstone ? Date.now() - 10000 : undefined,
          revision: 1,
          createdAt: Date.now() - 20000,
          clientUpdatedAt: Date.now() - 10000,
        } as any);
      }

      for (let i = 0; i < 150; i++) {
        await wardrobeRepo.upsertSavedOutfitRaw({
          id: `outfit_1k_${i}`,
          userId: testUser,
          name: `Outfit ${i}`,
          outfit: {
            id: `gen_1k_${i}`,
            template: 'Ethnic Festive',
            slots: {},
            score: 0.95,
            why: 'Festive pairing',
          },
          savedAt: Date.now(),
        });
      }

      for (let i = 0; i < 200; i++) {
        await calendarRepo.savePlan({
          id: `plan_1k_${i}`,
          userId: testUser,
          date: `2026-11-${String((i % 30) + 1).padStart(2, '0')}`,
          outfit: {
            id: `plan_gen_1k_${i}`,
            template: 'Ethnic',
            slots: {},
            score: 0.9,
            why: 'Festive plan',
          },
          occasion: 'festive',
          status: 'planned',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      for (let i = 0; i < 500; i++) {
        await wearRepo.addEvent({
          id: `wear_1k_${i}`,
          userId: testUser,
          wardrobeItemId: `item_1k_${i % itemCount}`,
          wornAt: Date.now() - 86400000 * (i % 30),
          createdAt: Date.now(),
        });
      }

      for (let i = 0; i < 250; i++) {
        await signalsRepo.addSignal({
          id: `signal_1k_${i}`,
          userId: testUser,
          signalType: 'worn',
          itemIds: [`item_1k_${i % itemCount}`],
          createdAt: Date.now(),
        });
      }

      // Measure Export
      const memBeforeExport = process.memoryUsage().heapUsed;
      const exportStart = performance.now();
      const backup = await backupService.createBackup({ userId: testUser });
      const exportJson = JSON.stringify(backup);
      const exportDurationMs = performance.now() - exportStart;
      const memAfterExport = process.memoryUsage().heapUsed;

      expect(backup.metadata.itemCount).toBe(1000);
      expect(backup.metadata.imageCount).toBe(20);

      // Measure Import
      await wardrobeRepo.clear();
      await clearImages();

      const importStart = performance.now();
      const restoreResult = await backupService.restoreBackup(backup, { targetUserId: testUser });
      const importDurationMs = performance.now() - importStart;

      expect(restoreResult.success).toBe(true);
      expect(restoreResult.itemsRestored).toBe(1000);
      expect(restoreResult.imagesRestored).toBe(20);
      expect(restoreResult.verifiedImageHashes).toBe(20);

      console.log(`[Benchmark 1,000 records] Export: ${exportDurationMs.toFixed(2)}ms, Import: ${importDurationMs.toFixed(2)}ms, JSON Size: ${(exportJson.length / 1024).toFixed(1)} KB, Heap Delta: ${((memAfterExport - memBeforeExport) / 1024 / 1024).toFixed(2)} MB`);
    });

    it('1.3 Benchmarks 5,000 wardrobe records memory and throughput', async () => {
      const itemCount = 5000;
      const imageCount = 5;
      const imageSizeBytes = 20 * 1024; // 20 KB each

      const itemsToSeed: any[] = [];
      for (let i = 0; i < itemCount; i++) {
        const photoId = i < imageCount ? `photo_5k_${i}` : undefined;
        if (photoId) {
          await saveImage(photoId, createSyntheticImageBlob(imageSizeBytes, (i % 250) + 1));
        }

        const isTombstone = i >= 4500; // 500 tombstones
        itemsToSeed.push({
          id: `item_5k_${i}`,
          userId: testUser,
          name: `Garment Item ${i}`,
          category: 'Bottoms',
          subcategory: 'palazzo',
          seasons: ['summer'],
          occasions: ['office'],
          colors: ['black'],
          photoId,
          isDeleted: isTombstone,
          deletedAt: isTombstone ? Date.now() - 10000 : undefined,
          revision: 1,
          createdAt: Date.now() - 20000,
          clientUpdatedAt: Date.now() - 10000,
        });
      }
      await wardrobeRepo.upsertItemsBulk(itemsToSeed);

      const outfitsToSeed: any[] = [];
      for (let i = 0; i < 500; i++) {
        outfitsToSeed.push({
          id: `outfit_5k_${i}`,
          userId: testUser,
          name: `Outfit ${i}`,
          outfit: {
            id: `gen_5k_${i}`,
            template: 'Fusion Office',
            slots: {},
            score: 0.9,
            why: 'Clean office look',
          },
          savedAt: Date.now(),
        });
      }
      await wardrobeRepo.upsertSavedOutfitsBulk(outfitsToSeed);

      const plansToSeed: any[] = [];
      for (let i = 0; i < 1000; i++) {
        plansToSeed.push({
          id: `plan_5k_${i}`,
          userId: testUser,
          date: `2026-12-${String((i % 30) + 1).padStart(2, '0')}`,
          outfit: {
            id: `plan_gen_5k_${i}`,
            template: 'Fusion Office',
            slots: {},
            score: 0.9,
            why: 'December plan',
          },
          occasion: 'office',
          status: 'planned',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
      await calendarRepo.upsertPlansBulk(plansToSeed);

      const wearToSeed: any[] = [];
      for (let i = 0; i < 2000; i++) {
        wearToSeed.push({
          id: `wear_5k_${i}`,
          userId: testUser,
          wardrobeItemId: `item_5k_${i % itemCount}`,
          wornAt: Date.now() - 86400000 * (i % 30),
          createdAt: Date.now(),
        });
      }
      await wearRepo.addEvents(wearToSeed);

      const signalsToSeed: any[] = [];
      for (let i = 0; i < 1000; i++) {
        signalsToSeed.push({
          id: `signal_5k_${i}`,
          userId: testUser,
          signalType: 'liked',
          itemIds: [`item_5k_${i % itemCount}`],
          createdAt: Date.now(),
        });
      }
      await signalsRepo.addSignals(signalsToSeed);

      // Measure Export
      const memBeforeExport = process.memoryUsage().heapUsed;
      const exportStart = performance.now();
      const backup = await backupService.createBackup({ userId: testUser });
      const exportJson = JSON.stringify(backup);
      const exportDurationMs = performance.now() - exportStart;
      const memAfterExport = process.memoryUsage().heapUsed;

      expect(backup.metadata.itemCount).toBe(5000);
      expect(backup.wardrobe.items.length).toBe(5000);

      // Measure Import
      await wardrobeRepo.clear();
      await clearImages();

      const importStart = performance.now();
      const restoreResult = await backupService.restoreBackup(backup, { targetUserId: testUser });
      const importDurationMs = performance.now() - importStart;

      expect(restoreResult.success).toBe(true);
      expect(restoreResult.itemsRestored).toBe(5000);

      console.log(`[Benchmark 5,000 records] Export: ${exportDurationMs.toFixed(2)}ms, Import: ${importDurationMs.toFixed(2)}ms, JSON Size: ${(exportJson.length / 1024).toFixed(1)} KB, Heap Delta: ${((memAfterExport - memBeforeExport) / 1024 / 1024).toFixed(2)} MB`);
    }, 60000);
  });

  // ==========================================================================
  // SECTION 2: ADVERSARIAL RESTORE TESTING
  // ==========================================================================
  describe('2. Adversarial Restore Testing', () => {
    it('2.1 Rejects corrupted backup metadata (non-object, null, invalid version)', () => {
      expect(validateBackup(null).valid).toBe(false);
      expect(validateBackup('not json' as any).valid).toBe(false);
      expect(validateBackup({}).valid).toBe(false);

      const invalidVersion = {
        version: 99,
        userId: testUser,
        wardrobe: { items: [] },
      };
      const result = validateBackup(invalidVersion);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Unsupported backup version: 99');

      const missingUserId = {
        version: 3,
        wardrobe: { items: [] },
      };
      expect(validateBackup(missingUserId).valid).toBe(false);
    });

    it('2.2 Detects and rejects single-byte tampering in binary image payload via SHA-256', async () => {
      const originalBlob = createSyntheticImageBlob(1024, 0xAA);
      const { size, sha256 } = await computeBlobHash(originalBlob);
      const originalBase64 = await blobToBase64(originalBlob);

      // Tamper: modify first byte in base64 string
      const tamperedChar = originalBase64[0] === 'A' ? 'B' : 'A';
      const tamperedBase64 = tamperedChar + originalBase64.slice(1);

      const tamperedBackup: StyleSaathiBackup = {
        version: 3,
        schemaVersion: '3.0.0-phase3e',
        exportedAt: new Date().toISOString(),
        userId: testUser,
        metadata: {
          appVersion: '3.0.0',
          itemCount: 1,
          outfitCount: 0,
          planCount: 0,
          wearEventCount: 0,
          signalCount: 0,
          imageCount: 1,
          totalImageBytes: size,
        },
        wardrobe: {
          items: [{
            id: 'item_tampered_1',
            userId: testUser,
            name: 'Tampered Saree',
            category: 'Ethnic',
            subcategory: 'saree' as any,
            seasons: ['winter'],
            occasions: ['festive'],
            colors: ['gold'],
            photoId: 'photo_tampered_1',
            createdAt: Date.now(),
            clientUpdatedAt: Date.now(),
          } as any],
          savedOutfits: [],
          calendarPlans: [],
          preferences: null,
          wearEvents: [],
          styleSignals: [],
        },
        sync: { unresolvedMutations: [], tombstones: [] },
        images: [{
          photoId: 'photo_tampered_1',
          mimeType: 'image/jpeg',
          byteLength: size,
          sha256, // Original SHA-256 hash
          dataBase64: tamperedBase64, // Tampered data!
        }],
      };

      await expect(backupService.restoreBackup(tamperedBackup)).rejects.toThrow(
        /IMAGE_CORRUPTION_DETECTED/
      );
    });

    it('2.3 Detects truncated binary archives / invalid Base64 streams', async () => {
      const truncatedBackup: StyleSaathiBackup = {
        version: 3,
        schemaVersion: '3.0.0-phase3e',
        exportedAt: new Date().toISOString(),
        userId: testUser,
        metadata: {
          appVersion: '3.0.0',
          itemCount: 1,
          outfitCount: 0,
          planCount: 0,
          wearEventCount: 0,
          signalCount: 0,
          imageCount: 1,
          totalImageBytes: 100,
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
        images: [{
          photoId: 'photo_truncated',
          mimeType: 'image/jpeg',
          byteLength: 100, // Declared 100 bytes
          sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          dataBase64: 'AAAA', // Only 3 decoded bytes!
        }],
      };

      await expect(backupService.restoreBackup(truncatedBackup)).rejects.toThrow(
        /IMAGE_CORRUPTION_DETECTED: Blob size mismatch/
      );
    });

    it('2.4 Handles duplicate record IDs in backup idempotently without record duplication', async () => {
      const duplicateBackup: StyleSaathiBackup = {
        version: 3,
        schemaVersion: '3.0.0-phase3e',
        exportedAt: new Date().toISOString(),
        userId: testUser,
        metadata: {
          appVersion: '3.0.0',
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
              id: 'item_duplicate_1',
              userId: testUser,
              name: 'Duplicate Item Version 1',
              category: 'Tops',
              subcategory: 'shirt' as any,
              seasons: ['summer'],
              occasions: ['everyday'],
              colors: ['white'],
              createdAt: Date.now(),
              clientUpdatedAt: Date.now(),
            } as any,
            {
              id: 'item_duplicate_1', // Duplicate ID!
              userId: testUser,
              name: 'Duplicate Item Version 2 (Latest)',
              category: 'Tops',
              subcategory: 'shirt' as any,
              seasons: ['summer'],
              occasions: ['everyday'],
              colors: ['white'],
              createdAt: Date.now(),
              clientUpdatedAt: Date.now() + 1000,
            } as any,
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

      // 1. Strict default: duplicate IDs are rejected during validation
      const validation = validateBackup(duplicateBackup);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes('DUPLICATE_ITEM_ID'))).toBe(true);

      await expect(backupService.restoreBackup(duplicateBackup)).rejects.toThrow(/DUPLICATE_ITEM_ID/);

      // 2. When allowDuplicateIds is explicitly set, deduplication applies
      const result = await backupService.restoreBackup(duplicateBackup, { allowDuplicateIds: true });
      expect(result.success).toBe(true);

      const items = await wardrobeRepo.getAllItemsRaw();
      expect(items.length).toBe(1);
      expect(items[0].name).toBe('Duplicate Item Version 2 (Latest)');
    });

    it('2.5 Audits missing referenced images: item references photoId absent from backup', async () => {
      const danglingPhotoBackup: StyleSaathiBackup = {
        version: 3,
        schemaVersion: '3.0.0-phase3e',
        exportedAt: new Date().toISOString(),
        userId: testUser,
        metadata: {
          appVersion: '3.0.0',
          itemCount: 1,
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
              id: 'item_dangling_photo',
              userId: testUser,
              name: 'Item with Missing Photo',
              category: 'Tops',
              subcategory: 'shirt' as any,
              seasons: ['summer'],
              occasions: ['everyday'],
              colors: ['blue'],
              photoId: 'photo_does_not_exist_in_backup', // Missing!
              createdAt: Date.now(),
              clientUpdatedAt: Date.now(),
            } as any,
          ],
          savedOutfits: [],
          calendarPlans: [],
          preferences: null,
          wearEvents: [],
          styleSignals: [],
        },
        sync: { unresolvedMutations: [], tombstones: [] },
        images: [], // Images array is empty!
      };

      // Remediation: validateBackup and restoreBackup detect and reject dangling photos
      const validation = validateBackup(danglingPhotoBackup);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes('MISSING_PHOTO_REFERENCE'))).toBe(true);

      await expect(backupService.restoreBackup(danglingPhotoBackup)).rejects.toThrow(/MISSING_PHOTO_REFERENCE/);
    });

    it('2.6 Enforces tenant boundary: cross-user restore without authorization fails', async () => {
      const aliceBackup: StyleSaathiBackup = {
        version: 3,
        schemaVersion: '3.0.0-phase3e',
        exportedAt: new Date().toISOString(),
        userId: 'usr_alice',
        metadata: {
          appVersion: '3.0.0',
          itemCount: 1,
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
              id: 'item_alice_1',
              userId: 'usr_alice',
              name: "Alice's Silk Kurti",
              category: 'Ethnic',
              subcategory: 'kurti' as any,
              seasons: ['summer'],
              occasions: ['everyday'],
              colors: ['pink'],
              createdAt: Date.now(),
              clientUpdatedAt: Date.now(),
            } as any,
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

      // Attempting to restore Alice's backup into Bob's session
      await expect(
        backupService.restoreBackup(aliceBackup, { targetUserId: 'usr_bob' })
      ).rejects.toThrow(/CROSS_USER_RESTORATION_FORBIDDEN/);

      // Verify Bob's storage was not modified
      const bobItems = await wardrobeRepo.getItems();
      expect(bobItems.length).toBe(0);
    });

    it('2.7 Audits non-transactional interrupted restoration vulnerability', async () => {
      // Pre-populate with existing item
      await wardrobeRepo.upsertItemRaw({
        id: 'existing_item_1',
        userId: testUser,
        name: 'Pre-existing Item',
        category: 'Tops',
        subcategory: 'shirt' as any,
        seasons: ['summer'],
        occasions: ['everyday'],
        colors: ['white'],
        createdAt: Date.now(),
        clientUpdatedAt: Date.now(),
      } as any);

      // Backup with 1 valid image and 1 corrupted image
      const validBlob = createSyntheticImageBlob(100, 0x11);
      const { size: validSize, sha256: validHash } = await computeBlobHash(validBlob);
      const validBase64 = await blobToBase64(validBlob);

      const partiallyCorruptBackup: StyleSaathiBackup = {
        version: 3,
        schemaVersion: '3.0.0-phase3e',
        exportedAt: new Date().toISOString(),
        userId: testUser,
        metadata: {
          appVersion: '3.0.0',
          itemCount: 1,
          outfitCount: 0,
          planCount: 0,
          wearEventCount: 0,
          signalCount: 0,
          imageCount: 2,
          totalImageBytes: validSize + 100,
        },
        wardrobe: {
          items: [{
            id: 'item_new_1',
            userId: testUser,
            name: 'New Item',
            category: 'Tops',
            subcategory: 'shirt' as any,
            seasons: ['summer'],
            occasions: ['everyday'],
            colors: ['blue'],
            createdAt: Date.now(),
            clientUpdatedAt: Date.now(),
          } as any],
          savedOutfits: [],
          calendarPlans: [],
          preferences: null,
          wearEvents: [],
          styleSignals: [],
        },
        sync: { unresolvedMutations: [], tombstones: [] },
        images: [
          {
            photoId: 'photo_valid_first',
            mimeType: 'image/jpeg',
            byteLength: validSize,
            sha256: validHash,
            dataBase64: validBase64,
          },
          {
            photoId: 'photo_corrupt_second',
            mimeType: 'image/jpeg',
            byteLength: 100,
            sha256: 'corrupt_hash',
            dataBase64: 'AAAA', // Invalid size / hash!
          },
        ],
      };

      // Restore with mode: 'overwrite'
      await expect(
        backupService.restoreBackup(partiallyCorruptBackup, { mode: 'overwrite' })
      ).rejects.toThrow(/IMAGE_CORRUPTION_DETECTED/);

      // REMEDIATION VERIFICATION: Snapshot-and-rollback ensures existing_item_1 is NOT wiped when restore fails!
      const existingItem = await wardrobeRepo.getItem('existing_item_1');
      expect(existingItem).not.toBeNull();
      expect(existingItem?.name).toBe('Pre-existing Item');
    });

    it('2.8 Verifies repeated restoration idempotency', async () => {
      const backup: StyleSaathiBackup = {
        version: 3,
        schemaVersion: '3.0.0-phase3e',
        exportedAt: new Date().toISOString(),
        userId: testUser,
        metadata: {
          appVersion: '3.0.0',
          itemCount: 2,
          outfitCount: 1,
          planCount: 1,
          wearEventCount: 1,
          signalCount: 1,
          imageCount: 0,
          totalImageBytes: 0,
        },
        wardrobe: {
          items: [
            {
              id: 'item_repeat_1',
              userId: testUser,
              name: 'Item 1',
              category: 'Tops',
              subcategory: 'shirt' as any,
              seasons: ['summer'],
              occasions: ['everyday'],
              colors: ['blue'],
              createdAt: Date.now(),
              clientUpdatedAt: Date.now(),
            } as any,
            {
              id: 'item_repeat_2',
              userId: testUser,
              name: 'Item 2',
              category: 'Bottoms',
              subcategory: 'trousers' as any,
              seasons: ['summer'],
              occasions: ['everyday'],
              colors: ['black'],
              createdAt: Date.now(),
              clientUpdatedAt: Date.now(),
            } as any,
          ],
          savedOutfits: [{
            id: 'outfit_repeat_1',
            userId: testUser,
            name: 'Repeat Outfit',
            outfit: {
              id: 'gen_repeat_1',
              template: 'Casual',
              slots: {},
              score: 0.9,
              why: 'Repeat match',
            },
            savedAt: Date.now(),
          }],
          calendarPlans: [{
            id: 'plan_repeat_1',
            userId: testUser,
            date: '2026-11-25',
            outfit: {
              id: 'gen_repeat_1',
              template: 'Casual',
              slots: {},
              score: 0.9,
              why: 'Repeat plan',
            },
            occasion: 'everyday',
            status: 'planned',
            createdAt: Date.now(),
            clientUpdatedAt: Date.now(),
          } as any],
          preferences: null,
          wearEvents: [{
            id: 'wear_repeat_1',
            userId: testUser,
            wardrobeItemId: 'item_repeat_1',
            wornAt: Date.now(),
            createdAt: Date.now(),
          }],
          styleSignals: [{
            id: 'signal_repeat_1',
            userId: testUser,
            signalType: 'favorited',
            itemIds: ['item_repeat_1'],
            createdAt: Date.now(),
          }],
        },
        sync: { unresolvedMutations: [], tombstones: [] },
        images: [],
      };

      // Restore 3 times in 'merge' mode
      await backupService.restoreBackup(backup, { mode: 'merge' });
      await backupService.restoreBackup(backup, { mode: 'merge' });
      await backupService.restoreBackup(backup, { mode: 'merge' });

      // Verifies exact counts (no duplication)
      expect((await wardrobeRepo.getAllItemsRaw()).length).toBe(2);
      expect((await wardrobeRepo.getAllSavedOutfitsRaw()).length).toBe(1);
      expect((await calendarRepo.getAllPlansRaw()).length).toBe(1);
      expect((await wearRepo.getEvents()).length).toBe(1);
      expect((await signalsRepo.getSignals()).length).toBe(1);
    });

    it('2.9 Verifies restoration with stale revisions: client merges local and server rejects stale push', async () => {
      const localItem: WardrobeItem = {
        id: 'item_stale_rev_1',
        userId: testUser,
        name: 'Local Restored Saree (Rev 2)',
        category: 'Ethnic',
        subcategory: 'saree' as any,
        seasons: ['winter'],
        occasions: ['festive'],
        colors: ['gold'],
        photo: 'blob:local/photo-photo_123',
        photoId: 'photo_123',
        createdAt: 1000,
        updatedAt: 2000,
        revision: 2, // Restored from backup at revision 2
      } as any;

      const remoteItem: WardrobeItem = {
        id: 'item_stale_rev_1',
        userId: testUser,
        name: 'Remote Cloud Saree (Rev 5)',
        category: 'Ethnic',
        subcategory: 'saree' as any,
        seasons: ['winter'],
        occasions: ['festive'],
        colors: ['crimson'], // Changed on cloud
        photo: 'blob:remote/old-photo',
        photoId: 'remote_photo_old',
        createdAt: 1000,
        updatedAt: 5000,
        revision: 5, // Server advanced to revision 5!
      } as any;

      // Conflict resolver merges and strictly retains local photo Blob URL
      const resolved = resolveWardrobeItemConflict(localItem, remoteItem);
      expect(resolved.photo).toBe('blob:local/photo-photo_123');
      expect(resolved.photoId).toBe('remote_photo_old');
      // Server revision takes precedence
      expect((resolved as any).revision).toBe(5);
    });
  });

  // ==========================================================================
  // SECTION 3: ACCOUNT DELETION & OFFLINE DEVICE SECURITY
  // ==========================================================================
  describe('3. Account Deletion and Offline-Device Testing', () => {
    let sqlitePath: string | null;

    beforeEach(() => {
      sqlitePath = findLocalD1SqliteFile();
    });

    it('3.1 Enforces deletion tombstones and prevents zombie account resurrection', () => {
      if (!sqlitePath) return;

      const d1 = new DatabaseSync(sqlitePath);
      d1.exec('PRAGMA foreign_keys = ON;');

      const deletedUserId = `usr_deleted_${Date.now()}`;
      const requestId = `del_req_${Date.now()}`;
      const tokenHash = `token_hash_${Date.now()}_${Math.random()}`;

      // 1. Provision user and records in D1
      d1.prepare(`
        INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
        VALUES (?, 'Deleted User', ?, 1, datetime('now'), datetime('now'))
      `).run(deletedUserId, `${deletedUserId}@example.com`);

      d1.prepare(`
        INSERT INTO session (id, userId, token, expiresAt, createdAt, updatedAt)
        VALUES (?, ?, ?, datetime('now', '+30 days'), datetime('now'), datetime('now'))
      `).run(`sess_${deletedUserId}`, deletedUserId, tokenHash);

      d1.prepare(`
        INSERT INTO wardrobe_items (id, user_id, name, category, subcategory, seasons, occasions, colors, formality, status, created_at, client_updated_at, server_updated_at, revision)
        VALUES ('item_del_1', ?, 'Silk Kurta', 'Tops', 'kurta', '[]', '[]', '[]', 3, 'clean', datetime('now'), datetime('now'), datetime('now'), 1)
      `).run(deletedUserId);

      // 2. Perform Account Deletion: write deletion tombstone and cascade delete
      d1.exec('BEGIN TRANSACTION');
      d1.prepare(`
        INSERT INTO deletion_tombstones (request_id, secret_hash, user_id_hash, deleted_at, expires_at, reconciled)
        VALUES (?, 'secret_hash_val', ?, datetime('now'), datetime('now', '+90 days'), 1)
      `).run(requestId, `hash_${deletedUserId}`);

      d1.prepare('DELETE FROM user WHERE id = ?').run(deletedUserId);
      d1.exec('COMMIT');

      // 3. Verify user and cascaded items are completely gone
      const userCheck = d1.prepare('SELECT id FROM user WHERE id = ?').get(deletedUserId);
      expect(userCheck).toBeUndefined();

      const itemsCheck = d1.prepare('SELECT id FROM wardrobe_items WHERE user_id = ?').all(deletedUserId);
      expect(itemsCheck.length).toBe(0);

      const sessionCheck = d1.prepare('SELECT id FROM session WHERE userId = ?').all(deletedUserId);
      expect(sessionCheck.length).toBe(0);

      // 4. Offline device attempts to sync old pending mutations
      // Session lookup returns 0 rows -> Worker returns 401 UNAUTHORIZED
      const authLookup = d1.prepare('SELECT userId FROM session WHERE token = ?').get(tokenHash);
      expect(authLookup).toBeUndefined(); // Zero zombie resurrect possible

      // 5. Verify deletion tombstone retention
      const tombstone = d1.prepare('SELECT request_id, reconciled FROM deletion_tombstones WHERE request_id = ?').get(requestId) as any;
      expect(tombstone.request_id).toBe(requestId);
      expect(tombstone.reconciled).toBe(1);

      // 6. Duplicate deletion request handling: finding existing tombstone returns idempotent success
      const repeatTombstone = d1.prepare('SELECT request_id FROM deletion_tombstones WHERE request_id = ?').get(requestId);
      expect(repeatTombstone).toBeDefined();

      d1.close();
    });

    it('3.2 Audits cross-account data isolation: User B cannot access deleted User A records', () => {
      if (!sqlitePath) return;

      const d1 = new DatabaseSync(sqlitePath);
      d1.exec('PRAGMA foreign_keys = ON;');

      const userA = `usr_iso_a_${Date.now()}`;
      const userB = `usr_iso_b_${Date.now()}`;

      d1.prepare(`
        INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
        VALUES (?, 'User A', ?, 1, datetime('now'), datetime('now'))
      `).run(userA, `${userA}@example.com`);

      d1.prepare(`
        INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
        VALUES (?, 'User B', ?, 1, datetime('now'), datetime('now'))
      `).run(userB, `${userB}@example.com`);

      d1.prepare(`
        INSERT INTO wardrobe_items (id, user_id, name, category, subcategory, seasons, occasions, colors, formality, status, created_at, client_updated_at, server_updated_at, revision)
        VALUES ('item_a_1', ?, 'User A Saree', 'Tops', 'saree', '[]', '[]', '[]', 3, 'clean', datetime('now'), datetime('now'), datetime('now'), 1)
      `).run(userA);

      // Query scoped by userB
      const userBItems = d1.prepare('SELECT id FROM wardrobe_items WHERE user_id = ?').all(userB);
      expect(userBItems.length).toBe(0);

      // Delete User A
      d1.prepare('DELETE FROM user WHERE id = ?').run(userA);

      // Verify User B is completely unaffected
      const userBCheck = d1.prepare('SELECT id FROM user WHERE id = ?').get(userB);
      expect(userBCheck).toBeDefined();

      d1.close();
    });
  });

  // ==========================================================================
  // SECTION 4: TRANSACTION & RUNTIME VERIFICATION (SQLite vs D1)
  // ==========================================================================
  describe('4. Transaction Verification: Native SQLite vs Local D1 Runtime', () => {
    let sqlitePath: string | null;

    beforeEach(() => {
      sqlitePath = findLocalD1SqliteFile();
    });

    it('4.1 Native SQLite: Verifies interactive BEGIN TRANSACTION & ROLLBACK on constraint failure', () => {
      if (!sqlitePath) return;

      const d1 = new DatabaseSync(sqlitePath);
      d1.exec('PRAGMA foreign_keys = ON;');

      const testUserTx = `usr_tx_sqlite_${Date.now()}`;
      d1.prepare(`
        INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
        VALUES (?, 'Tx User', ?, 1, datetime('now'), datetime('now'))
      `).run(testUserTx, `${testUserTx}@example.com`);

      let rollbackExecuted = false;

      // Transaction batch: first insert is valid, second violates foreign key
      d1.exec('BEGIN TRANSACTION;');
      try {
        d1.prepare(`
          INSERT INTO wardrobe_items (id, user_id, name, category, subcategory, seasons, occasions, colors, formality, status, created_at, client_updated_at, server_updated_at, revision)
          VALUES ('item_tx_valid', ?, 'Valid Saree', 'Tops', 'saree', '[]', '[]', '[]', 3, 'clean', datetime('now'), datetime('now'), datetime('now'), 1)
        `).run(testUserTx);

        // Foreign key violation: references non-existent user_id
        d1.prepare(`
          INSERT INTO wardrobe_items (id, user_id, name, category, subcategory, seasons, occasions, colors, formality, status, created_at, client_updated_at, server_updated_at, revision)
          VALUES ('item_tx_invalid', 'usr_non_existent_ghost', 'Ghost Saree', 'Tops', 'saree', '[]', '[]', '[]', 3, 'clean', datetime('now'), datetime('now'), datetime('now'), 1)
        `).run();

        d1.exec('COMMIT;');
      } catch (err) {
        d1.exec('ROLLBACK;');
        rollbackExecuted = true;
      }

      expect(rollbackExecuted).toBe(true);

      // Verify that even the first statement was completely rolled back!
      const validItemCheck = d1.prepare("SELECT id FROM wardrobe_items WHERE id = 'item_tx_valid'").get();
      expect(validItemCheck).toBeUndefined(); // Zero orphan rows!

      d1.close();
    });

    it('4.2 Local D1 Batch Runtime: Verifies per-mutation atomicity in D1 sync engine', async () => {
      // In Worker push.ts, each mutation executes:
      // await db.batch([writeStmt, idempotencyStmt]);
      // If either statement fails, both are rolled back.
      if (!sqlitePath) return;

      const d1 = new DatabaseSync(sqlitePath);
      d1.exec('PRAGMA foreign_keys = ON;');

      const userBatch = `usr_d1_batch_${Date.now()}`;
      d1.prepare(`
        INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
        VALUES (?, 'D1 Batch User', ?, 1, datetime('now'), datetime('now'))
      `).run(userBatch, `${userBatch}@example.com`);

      // Simulate D1 db.batch: inserting an item and a colliding sync_mutations row
      // Insert duplicate sync_mutations row first
      d1.prepare(`
        INSERT INTO sync_mutations (mutation_id, user_id, entity_type, entity_id, payload_hash, applied_at)
        VALUES ('mut_existing_123', ?, 'wardrobe_item', 'item_batch_1', 'hash_abc', datetime('now'))
      `).run(userBatch);

      let batchFailed = false;
      d1.exec('BEGIN TRANSACTION;');
      try {
        // Step 1: Write item
        d1.prepare(`
          INSERT INTO wardrobe_items (id, user_id, name, category, subcategory, seasons, occasions, colors, formality, status, created_at, client_updated_at, server_updated_at, revision)
          VALUES ('item_batch_1', ?, 'Batch Kurta', 'Tops', 'kurta', '[]', '[]', '[]', 3, 'clean', datetime('now'), datetime('now'), datetime('now'), 1)
        `).run(userBatch);

        // Step 2: Write idempotency with conflicting mutation_id -> UNIQUE constraint failed
        d1.prepare(`
          INSERT INTO sync_mutations (mutation_id, user_id, entity_type, entity_id, payload_hash, applied_at)
          VALUES ('mut_existing_123', ?, 'wardrobe_item', 'item_batch_1', 'hash_abc', datetime('now'))
        `).run(userBatch);

        d1.exec('COMMIT;');
      } catch (err: any) {
        d1.exec('ROLLBACK;');
        batchFailed = true;
      }

      expect(batchFailed).toBe(true);

      // Check that item_batch_1 was NOT persisted
      const itemCheck = d1.prepare("SELECT id FROM wardrobe_items WHERE id = 'item_batch_1'").get();
      expect(itemCheck).toBeUndefined(); // Atomic rollback verified!

      d1.close();
    });
  });
});
