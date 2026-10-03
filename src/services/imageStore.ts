import { get, set, del, clear, createStore, UseStore } from 'idb-keyval';

const DB_NAME = 'stylesaathi-images-db';
const STORE_NAME = 'images';

let customStore: UseStore | undefined;
try {
  customStore = createStore(DB_NAME, STORE_NAME);
} catch {
  // Graceful fallback for environments where createStore fails
}

// In-memory fallback if IndexedDB is unavailable (e.g. Node tests without mocks, private browsing)
const memoryFallback = new Map<string, Blob>();

// Cache for Object URLs: id -> objectUrl to avoid duplicate blob allocations
const urlCache = new Map<string, string>();

/**
 * Saves an image Blob into IndexedDB under the given id.
 */
export async function saveImage(id: string, blob: Blob): Promise<void> {
  // Revoke any existing cached URL for this id
  if (urlCache.has(id)) {
    try {
      URL.revokeObjectURL(urlCache.get(id)!);
    } catch {}
    urlCache.delete(id);
  }

  try {
    if (customStore) {
      await set(id, blob, customStore);
    } else {
      await set(id, blob);
    }
  } catch (err: any) {
    memoryFallback.set(id, blob);
    if (typeof indexedDB !== 'undefined') {
      console.warn('IndexedDB saveImage failed, saved to memory fallback:', err);
      throw err;
    }
  }
}

/**
 * Retrieves an image Blob from IndexedDB by id.
 */
export async function getImage(id: string): Promise<Blob | undefined> {
  try {
    const val = customStore ? await get<Blob>(id, customStore) : await get<Blob>(id);
    if (val) return val;
  } catch (err) {
    if (typeof indexedDB !== 'undefined') {
      console.warn(`IndexedDB getImage failed for ${id}:`, err);
    }
  }
  return memoryFallback.get(id);
}

/**
 * Deletes an image from IndexedDB and revokes any cached Object URL.
 */
export async function deleteImage(id: string): Promise<void> {
  if (urlCache.has(id)) {
    try {
      URL.revokeObjectURL(urlCache.get(id)!);
    } catch {}
    urlCache.delete(id);
  }

  try {
    if (customStore) {
      await del(id, customStore);
    } else {
      await del(id);
    }
  } catch (err) {
    if (typeof indexedDB !== 'undefined') {
      console.warn(`IndexedDB deleteImage failed for ${id}:`, err);
    }
  }
  memoryFallback.delete(id);
}

/**
 * Clears all images from IndexedDB and revokes all cached Object URLs.
 */
export async function clearImages(): Promise<void> {
  urlCache.forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch {}
  });
  urlCache.clear();

  try {
    if (customStore) {
      await clear(customStore);
    } else {
      await clear();
    }
  } catch (err) {
    if (typeof indexedDB !== 'undefined') {
      console.warn('IndexedDB clearImages failed:', err);
    }
  }
  memoryFallback.clear();
}

/**
 * Returns an Object URL for the given image id.
 * Reuses cached URLs until the image is deleted or explicitly revoked.
 */
export async function getImageUrl(id: string): Promise<string | undefined> {
  if (urlCache.has(id)) {
    return urlCache.get(id);
  }

  const blob = await getImage(id);
  if (!blob) return undefined;

  try {
    const url = URL.createObjectURL(blob);
    urlCache.set(id, url);
    return url;
  } catch (err) {
    console.warn(`Failed to create object URL for ${id}:`, err);
    return undefined;
  }
}

/**
 * Explicitly revokes a cached Object URL (e.g. on component unmount or replacement).
 */
export function revokeImageUrl(id: string): void {
  if (urlCache.has(id)) {
    try {
      URL.revokeObjectURL(urlCache.get(id)!);
    } catch {}
    urlCache.delete(id);
  }
}
