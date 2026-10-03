import { WardrobeItem } from '../types';
import { saveImage } from './imageStore';
import { dataUrlToBlob } from '../utils/imageCompressor';

export interface MigrationResult {
  migratedItems: WardrobeItem[];
  hasChanges: boolean;
  migratedCount: number;
}

/**
 * Scans stored wardrobe items. If any item still has a base64 `photo` string,
 * converts it to a Blob, saves it to IndexedDB via saveImage, sets photoId,
 * removes the old `photo` field, and marks hasChanges = true.
 *
 * Safe to re-run (idempotent).
 */
export async function migrateLegacyPhotos(items: WardrobeItem[]): Promise<MigrationResult> {
  let hasChanges = false;
  let migratedCount = 0;

  const migratedItems = await Promise.all(
    items.map(async (item) => {
      // Only migrate if photo is a base64 data URL
      if (item.photo && typeof item.photo === 'string' && item.photo.startsWith('data:')) {
        try {
          const blob = dataUrlToBlob(item.photo);
          const photoId = item.photoId || `photo-${item.id || Date.now()}`;
          await saveImage(photoId, blob);

          const { photo: _removed, ...rest } = item;
          hasChanges = true;
          migratedCount++;
          return {
            ...rest,
            photoId,
          } as WardrobeItem;
        } catch (err) {
          console.warn(`Failed to migrate legacy photo for item ${item.id}:`, err);
          return item;
        }
      }
      return item;
    })
  );

  return {
    migratedItems,
    hasChanges,
    migratedCount,
  };
}
