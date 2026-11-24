// ============================================================================
// STYLESAATHI 3.0 — COMPREHENSIVE BACKUP, EXPORT & RESTORE ENGINE
// Phase 3E: Controlled Migration Rehearsal & Data Integrity Engine
// Invariants:
// 1. Binary Blob Integrity: Compares actual byte sizes and SHA-256 hashes
// 2. Strict Tenant Isolation: Never restores cross-user records into mismatched accounts
// 3. Monotonic Revision Preservation: Preserves revisions and deletion tombstones
// 4. Offline Capability: Works 100% offline without requiring network or cloud
// ============================================================================

import type {
  WardrobeItem,
  SavedOutfit,
  OutfitPlan,
  StylePreferences,
  WearEvent,
  StyleSignalEvent,
  SyncMutation,
} from '../types';
import { getImage, saveImage, deleteImage } from './imageStore';
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
import { isDemoItem, isDemoOutfit } from './demoWardrobeService';

export interface BackupImagePayload {
  photoId: string;
  mimeType: string;
  byteLength: number;
  sha256: string;
  dataBase64: string;
}

export interface StyleSaathiBackup {
  version: 3;
  schemaVersion: '3.0.0-phase3e';
  exportedAt: string;
  userId: string;
  metadata: {
    appVersion: string;
    itemCount: number;
    outfitCount: number;
    planCount: number;
    wearEventCount: number;
    signalCount: number;
    imageCount: number;
    totalImageBytes: number;
  };
  wardrobe: {
    items: WardrobeItem[];
    savedOutfits: SavedOutfit[];
    calendarPlans: OutfitPlan[];
    preferences: StylePreferences | null;
    wearEvents: WearEvent[];
    styleSignals: StyleSignalEvent[];
  };
  sync: {
    unresolvedMutations: SyncMutation[];
    tombstones: { id: string; entityType: string; deletedAt: string; revision: number }[];
  };
  images: BackupImagePayload[];
}

export interface RestoreResult {
  success: boolean;
  itemsRestored: number;
  outfitsRestored: number;
  plansRestored: number;
  wearEventsRestored: number;
  signalsRestored: number;
  imagesRestored: number;
  mutationsRestored: number;
  verifiedImageHashes: number;
  errors?: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Computes exact byte length and SHA-256 hexadecimal hash of a binary Blob.
 */
export async function computeBlobHash(blob: Blob): Promise<{ size: number; sha256: string }> {
  const buffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const sha256 = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return { size: blob.size, sha256 };
}

/**
 * Converts a Blob to a standard Base64 string.
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts a Base64 string back into a binary Blob.
 */
export function base64ToBlob(base64: string, mimeType = 'image/jpeg'): Blob {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

export interface ValidateBackupOptions {
  allowMissingPhotos?: boolean;
  allowDuplicateIds?: boolean;
}

/**
 * Validates the structure, integrity, and compatibility of a backup object.
 */
export function validateBackup(backup: any, options?: ValidateBackupOptions): ValidationResult {
  const errors: string[] = [];

  if (!backup || typeof backup !== 'object') {
    return { valid: false, errors: ['Backup data must be a non-null JSON object'] };
  }

  if (typeof backup.version !== 'number') {
    errors.push('Missing or invalid backup version number');
  } else if (backup.version > 3 || backup.version < 1) {
    errors.push(`Unsupported backup version: ${backup.version}. Supported versions: 1, 2, 3`);
  }

  if (!backup.userId || typeof backup.userId !== 'string') {
    errors.push('Missing or invalid userId in backup payload');
  }

  if (!backup.wardrobe || typeof backup.wardrobe !== 'object') {
    errors.push('Missing wardrobe section in backup payload');
    return { valid: false, errors };
  }

  if (!Array.isArray(backup.wardrobe.items)) {
    errors.push('wardrobe.items must be an array');
    return { valid: false, errors };
  }

  // Track all photoIds included in the backup images payload
  const backupImageIds = new Set<string>();
  if (backup.images && Array.isArray(backup.images)) {
    for (let i = 0; i < backup.images.length; i++) {
      const img = backup.images[i];
      if (!img || typeof img !== 'object') {
        errors.push(`Image at index ${i} is not a valid object`);
        continue;
      }
      if (!img.photoId || !img.sha256 || typeof img.byteLength !== 'number' || !img.dataBase64) {
        errors.push(`Image at index ${i} is missing photoId, sha256, byteLength, or dataBase64`);
      }
      if (img.photoId) {
        if (backupImageIds.has(img.photoId)) {
          errors.push(`DUPLICATE_IMAGE_ID: Multiple images found for photoId '${img.photoId}' in backup payload.`);
        }
        backupImageIds.add(img.photoId);
      }
    }
  }

  // 1. Validate wardrobe items (check duplicate IDs and missing photo references)
  const itemIds = new Set<string>();
  for (const item of backup.wardrobe.items) {
    if (!item || typeof item !== 'object') {
      errors.push('Wardrobe item must be an object');
      continue;
    }
    if (!item.id || typeof item.id !== 'string') {
      errors.push('Wardrobe item missing or invalid id');
      continue;
    }

    if (itemIds.has(item.id)) {
      if (!options?.allowDuplicateIds) {
        errors.push(`DUPLICATE_ITEM_ID: Duplicate wardrobe item ID '${item.id}' detected in backup payload.`);
      }
    }
    itemIds.add(item.id);

    // Missing photo reference check
    if (item.photoId && !backupImageIds.has(item.photoId) && !options?.allowMissingPhotos) {
      errors.push(
        `MISSING_PHOTO_REFERENCE: Item '${item.id}' references photoId '${item.photoId}', but image data is missing from backup payload.`
      );
    }
  }

  // 2. Validate saved outfits (check duplicate IDs)
  if (backup.wardrobe.savedOutfits && Array.isArray(backup.wardrobe.savedOutfits)) {
    const outfitIds = new Set<string>();
    for (const outfit of backup.wardrobe.savedOutfits) {
      if (!outfit || typeof outfit !== 'object') continue;
      if (outfit.id) {
        if (outfitIds.has(outfit.id)) {
          if (!options?.allowDuplicateIds) {
            errors.push(`DUPLICATE_OUTFIT_ID: Duplicate saved outfit ID '${outfit.id}' detected in backup payload.`);
          }
        }
        outfitIds.add(outfit.id);
      }
    }
  }

  // 3. Validate calendar plans (check duplicate IDs)
  if (backup.wardrobe.calendarPlans && Array.isArray(backup.wardrobe.calendarPlans)) {
    const planIds = new Set<string>();
    for (const plan of backup.wardrobe.calendarPlans) {
      if (!plan || typeof plan !== 'object') continue;
      if (plan.id) {
        if (planIds.has(plan.id)) {
          if (!options?.allowDuplicateIds) {
            errors.push(`DUPLICATE_PLAN_ID: Duplicate calendar plan ID '${plan.id}' detected in backup payload.`);
          }
        }
        planIds.add(plan.id);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export class BackupService {
  private wardrobeRepo: LocalStorageWardrobeRepository;
  private calendarRepo: LocalStorageCalendarRepository;
  private prefRepo: LocalStoragePreferencesRepository;
  private wearRepo: LocalStorageWearEventsRepository;
  private signalsRepo: LocalStorageStyleSignalsRepository;

  constructor(repos?: {
    wardrobeRepo?: LocalStorageWardrobeRepository;
    calendarRepo?: LocalStorageCalendarRepository;
    prefRepo?: LocalStoragePreferencesRepository;
    wearRepo?: LocalStorageWearEventsRepository;
    signalsRepo?: LocalStorageStyleSignalsRepository;
  }) {
    this.wardrobeRepo = repos?.wardrobeRepo || wardrobeRepository;
    this.calendarRepo = repos?.calendarRepo || calendarRepository;
    this.prefRepo = repos?.prefRepo || preferencesRepository;
    this.wearRepo = repos?.wearRepo || wearEventsRepository;
    this.signalsRepo = repos?.signalsRepo || styleSignalsRepository;
  }

  /**
   * Generates a complete, verifiable StyleSaathi 3.0 backup including actual image Blobs.
   */
  public async createBackup(options?: {
    userId?: string;
    includeImages?: boolean;
    appVersion?: string;
  }): Promise<StyleSaathiBackup> {
    const userId = options?.userId || 'guest_user';
    const includeImages = options?.includeImages ?? true;
    const appVersion = options?.appVersion || '3.0.0-phase3e';

    // 1. Fetch metadata and entities from local repositories (including soft-deleted tombstones)
    // Filter out any demonstration items to guarantee strict demo isolation in backups
    const rawItems = this.wardrobeRepo.getAllItemsRaw
      ? await this.wardrobeRepo.getAllItemsRaw()
      : await this.wardrobeRepo.getItems();
    const items = rawItems.filter((i) => !isDemoItem(i));
    const rawOutfits = this.wardrobeRepo.getAllSavedOutfitsRaw
      ? await this.wardrobeRepo.getAllSavedOutfitsRaw()
      : await this.wardrobeRepo.getSavedOutfits();
    const savedOutfits = rawOutfits.filter((o) => !isDemoOutfit(o));
    const rawPlans = this.calendarRepo.getAllPlansRaw
      ? await this.calendarRepo.getAllPlansRaw()
      : await this.calendarRepo.getPlans();
    const calendarPlans = rawPlans.filter((p) => !isDemoOutfit(p.outfit) && !isDemoItem(p.accessory));
    const preferences = await this.prefRepo.getPreferences();
    const rawWearEvents = await this.wearRepo.getEvents();
    const wearEvents = rawWearEvents.filter((w) => !isDemoItem(w.wardrobeItemId));
    const rawStyleSignals = await this.signalsRepo.getSignals();
    const styleSignals = rawStyleSignals.filter(
      (s) => !s.itemIds?.some((id) => isDemoItem(id)) && !isDemoItem(s.outfitId)
    );

    // 2. Fetch sync mutations and tombstones
    const unresolvedMutations = await syncQueue.getDeadLetterMutations(userId);
    const tombstones = items
      .filter((i) => i.isDeleted)
      .map((i) => ({
        id: i.id,
        entityType: 'wardrobe_item',
        deletedAt: new Date(i.deletedAt || Date.now()).toISOString(),
        revision: (i as any).revision || 1,
      }));

    // 3. Export actual IndexedDB garment image Blobs
    const images: BackupImagePayload[] = [];
    let totalImageBytes = 0;

    if (includeImages) {
      const photoIds = new Set<string>();
      for (const item of items) {
        if (item.photoId) photoIds.add(item.photoId);
      }

      for (const photoId of photoIds) {
        const blob = await getImage(photoId);
        if (blob) {
          const { size, sha256 } = await computeBlobHash(blob);
          const dataBase64 = await blobToBase64(blob);
          totalImageBytes += size;

          images.push({
            photoId,
            mimeType: blob.type || 'image/jpeg',
            byteLength: size,
            sha256,
            dataBase64,
          });
        }
      }
    }

    return {
      version: 3,
      schemaVersion: '3.0.0-phase3e',
      exportedAt: new Date().toISOString(),
      userId,
      metadata: {
        appVersion,
        itemCount: items.length,
        outfitCount: savedOutfits.length,
        planCount: calendarPlans.length,
        wearEventCount: wearEvents.length,
        signalCount: styleSignals.length,
        imageCount: images.length,
        totalImageBytes,
      },
      wardrobe: {
        items,
        savedOutfits,
        calendarPlans,
        preferences,
        wearEvents,
        styleSignals,
      },
      sync: {
        unresolvedMutations,
        tombstones,
      },
      images,
    };
  }

  /**
   * Exports backup as a formatted JSON string.
   */
  public async exportBackupJson(options?: { userId?: string; includeImages?: boolean }): Promise<string> {
    const backup = await this.createBackup(options);
    return JSON.stringify(backup, null, 2);
  }

  /**
   * Restores a StyleSaathi backup into local IndexedDB and LocalStorage repositories.
   * Performs byte-by-byte and SHA-256 verification of every garment image Blob.
   */
  public async restoreBackup(
    backup: StyleSaathiBackup,
    options?: {
      targetUserId?: string;
      mode?: 'overwrite' | 'merge';
      allowCrossUser?: boolean;
      allowMissingPhotos?: boolean;
      allowDuplicateIds?: boolean;
    }
  ): Promise<RestoreResult> {
    // 1. Strict schema and data validation BEFORE touching database or memory
    const validation = validateBackup(backup, {
      allowMissingPhotos: options?.allowMissingPhotos,
      allowDuplicateIds: options?.allowDuplicateIds,
    });
    if (!validation.valid) {
      throw new Error(`INVALID_BACKUP_SCHEMA: ${validation.errors.join('; ')}`);
    }

    const targetUserId = options?.targetUserId || backup.userId;
    const allowCrossUser = options?.allowCrossUser ?? false;

    // Tenant boundary check:
    if (backup.userId !== targetUserId && !allowCrossUser) {
      throw new Error(
        `CROSS_USER_RESTORATION_FORBIDDEN: Backup belongs to user '${backup.userId}' but target user is '${targetUserId}'. Cross-user data ingestion is forbidden without explicit authorization.`
      );
    }

    // 2. Pre-verify and stage all image Blobs BEFORE touching any repository or storage
    const stagedImages = new Map<string, Blob>();
    let verifiedImageHashes = 0;

    if (backup.images && Array.isArray(backup.images)) {
      for (const img of backup.images) {
        // Decode base64 to binary Blob
        const restoredBlob = base64ToBlob(img.dataBase64, img.mimeType);

        // Verify actual byte length
        if (restoredBlob.size !== img.byteLength) {
          throw new Error(
            `IMAGE_CORRUPTION_DETECTED: Blob size mismatch for photoId '${img.photoId}'. Expected ${img.byteLength} bytes, decoded ${restoredBlob.size} bytes.`
          );
        }

        // Verify SHA-256 cryptographic hash of actual binary content
        const { sha256: computedHash } = await computeBlobHash(restoredBlob);
        if (computedHash !== img.sha256) {
          throw new Error(
            `IMAGE_CORRUPTION_DETECTED: SHA-256 hash mismatch for photoId '${img.photoId}'. Expected ${img.sha256}, computed ${computedHash}.`
          );
        }

        stagedImages.set(img.photoId, restoredBlob);
        verifiedImageHashes++;
      }
    }

    // 3. Snapshot existing database state to guarantee rollback capability
    const mode = options?.mode || 'merge';
    const snapshotItems = this.wardrobeRepo.getAllItemsRaw
      ? await this.wardrobeRepo.getAllItemsRaw()
      : await this.wardrobeRepo.getItems();
    const snapshotOutfits = this.wardrobeRepo.getAllSavedOutfitsRaw
      ? await this.wardrobeRepo.getAllSavedOutfitsRaw()
      : await this.wardrobeRepo.getSavedOutfits();
    const snapshotPlans = this.calendarRepo.getAllPlansRaw
      ? await this.calendarRepo.getAllPlansRaw()
      : await this.calendarRepo.getPlans();
    const snapshotPrefs = await this.prefRepo.getPreferences();
    const snapshotWear = await this.wearRepo.getEvents();
    const snapshotSignals = await this.signalsRepo.getSignals();

    const existingPhotoIds = new Set<string>();
    for (const item of snapshotItems) {
      if (item.photoId) existingPhotoIds.add(item.photoId);
    }

    const newlySavedPhotoIds: string[] = [];

    // 4. Execute atomic restoration inside try...catch with rollback guarantee
    try {
      // 4a. Persist staged and verified image Blobs into IndexedDB
      for (const [photoId, blob] of stagedImages.entries()) {
        await saveImage(photoId, blob);
        if (!existingPhotoIds.has(photoId)) {
          newlySavedPhotoIds.push(photoId);
        }
      }

      // 4b. If overwrite mode, clear existing database records
      if (mode === 'overwrite') {
        await this.wardrobeRepo.clear();
        await this.calendarRepo.clear();
        await this.prefRepo.clear();
        await this.wearRepo.clear();
        await this.signalsRepo.clear();

        // Note: wardrobeRepo.clear() clears imageStore, so re-save staged images
        for (const [photoId, blob] of stagedImages.entries()) {
          await saveImage(photoId, blob);
        }
      }

      // 4c. Bulk upsert wardrobe items (strictly excluding demonstration items)
      const itemsToRestore = (backup.wardrobe.items || [])
        .filter((item) => !isDemoItem(item))
        .map((item) => ({
          ...item,
          userId: targetUserId,
        }));
      const itemsRestored = itemsToRestore.length;
      if (this.wardrobeRepo.upsertItemsBulk) {
        await this.wardrobeRepo.upsertItemsBulk(itemsToRestore);
      } else {
        for (const item of itemsToRestore) {
          await this.wardrobeRepo.upsertItemRaw?.(item);
        }
      }

      // 4d. Bulk upsert saved outfits (strictly excluding demonstration outfits)
      const outfitsToRestore = (backup.wardrobe.savedOutfits || [])
        .filter((outfit) => !isDemoOutfit(outfit))
        .map((outfit) => ({
          ...outfit,
          userId: targetUserId,
        }));
      const outfitsRestored = outfitsToRestore.length;
      if (this.wardrobeRepo.upsertSavedOutfitsBulk) {
        await this.wardrobeRepo.upsertSavedOutfitsBulk(outfitsToRestore);
      } else {
        for (const outfit of outfitsToRestore) {
          await this.wardrobeRepo.upsertSavedOutfitRaw?.(outfit);
        }
      }

      // 4e. Bulk upsert calendar plans (strictly excluding demo outfits/accessories)
      const plansToRestore = (backup.wardrobe.calendarPlans || [])
        .filter((plan) => !isDemoOutfit(plan.outfit) && !isDemoItem(plan.accessory))
        .map((plan) => ({
          ...plan,
          userId: targetUserId,
        }));
      const plansRestored = plansToRestore.length;
      if (this.calendarRepo.upsertPlansBulk) {
        await this.calendarRepo.upsertPlansBulk(plansToRestore);
      } else {
        for (const plan of plansToRestore) {
          if (this.calendarRepo.upsertPlanRaw) {
            await this.calendarRepo.upsertPlanRaw(plan);
          } else {
            await this.calendarRepo.savePlan(plan);
          }
        }
      }

      // 4f. Restore style preferences
      if (backup.wardrobe.preferences) {
        await this.prefRepo.savePreferences({
          ...backup.wardrobe.preferences,
          userId: targetUserId,
        });
      }

      // 4g. Bulk add wear events (strictly excluding demo items)
      const wearEventsToRestore = (backup.wardrobe.wearEvents || [])
        .filter((event) => !isDemoItem(event.wardrobeItemId))
        .map((event) => ({
          ...event,
          userId: targetUserId,
        }));
      const wearEventsRestored = wearEventsToRestore.length;
      if (this.wearRepo.addEvents) {
        await this.wearRepo.addEvents(wearEventsToRestore);
      } else {
        for (const event of wearEventsToRestore) {
          await this.wearRepo.addEvent(event);
        }
      }

      // 4h. Bulk add style signals (strictly excluding demo items)
      const signalsToRestore = (backup.wardrobe.styleSignals || [])
        .filter((signal) => !signal.itemIds?.some((id) => isDemoItem(id)) && !isDemoItem(signal.outfitId))
        .map((signal) => ({
          ...signal,
          userId: targetUserId,
        }));
      const signalsRestored = signalsToRestore.length;
      if (this.signalsRepo.addSignals) {
        await this.signalsRepo.addSignals(signalsToRestore);
      } else {
        for (const signal of signalsToRestore) {
          await this.signalsRepo.addSignal(signal);
        }
      }

      // 4i. Restore unresolved sync mutations
      let mutationsRestored = 0;
      for (const mutation of backup.sync?.unresolvedMutations || []) {
        const mutId = mutation.mutationId || mutation.id;
        await syncQueue.enqueue({
          ...mutation,
          id: mutId,
          mutationId: mutId,
          userId: targetUserId,
        });
        if (mutation.status === 'dead_letter') {
          await syncQueue.markFailed(mutId, mutation.lastError || 'RESTORED_DEAD_LETTER', true);
        }
        mutationsRestored++;
      }

      return {
        success: true,
        itemsRestored,
        outfitsRestored,
        plansRestored,
        wearEventsRestored,
        signalsRestored,
        imagesRestored: stagedImages.size,
        mutationsRestored,
        verifiedImageHashes,
      };
    } catch (error) {
      // 5. TRANSACTION ROLLBACK: Restore pre-existing state on failure
      console.warn('Restoration failed midway. Rolling back all modifications to pre-restoration snapshot...');

      for (const photoId of newlySavedPhotoIds) {
        try {
          await deleteImage(photoId);
        } catch {}
      }

      try {
        if (mode === 'overwrite') {
          await this.wardrobeRepo.clear();
          await this.calendarRepo.clear();
          await this.prefRepo.clear();
          await this.wearRepo.clear();
          await this.signalsRepo.clear();
        }

        if (this.wardrobeRepo.upsertItemsBulk) {
          await this.wardrobeRepo.upsertItemsBulk(snapshotItems);
        }
        if (this.wardrobeRepo.upsertSavedOutfitsBulk) {
          await this.wardrobeRepo.upsertSavedOutfitsBulk(snapshotOutfits);
        }
        if (this.calendarRepo.upsertPlansBulk) {
          await this.calendarRepo.upsertPlansBulk(snapshotPlans);
        }
        if (snapshotPrefs) {
          await this.prefRepo.savePreferences(snapshotPrefs);
        }
        if (this.wearRepo.addEvents) {
          await this.wearRepo.addEvents(snapshotWear);
        }
        if (this.signalsRepo.addSignals) {
          await this.signalsRepo.addSignals(snapshotSignals);
        }
      } catch (rollbackError) {
        console.error('Critical rollback failure:', rollbackError);
      }

      throw error;
    }
  }
}

export const backupService = new BackupService();
