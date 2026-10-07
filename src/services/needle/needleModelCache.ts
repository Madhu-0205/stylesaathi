import { get, set, del, createStore, UseStore } from 'idb-keyval';

const DB_NAME = 'stylesaathi-needle-db';
const STORE_NAME = 'model';
export const MODEL_STORE_KEY = 'needle3_model_bytes';
export const MODEL_META_KEY = 'needle3_model_meta';
export const DEFAULT_MODEL_URL =
  'https://huggingface.co/Cactus-Compute/needle3/resolve/main/needle3.cact';

let needleStore: UseStore | undefined;
const hasIndexedDB = typeof indexedDB !== 'undefined';

if (hasIndexedDB) {
  try {
    needleStore = createStore(DB_NAME, STORE_NAME);
  } catch {
    // Graceful fallback if createStore fails
  }
}

// In-memory fallback if IndexedDB is unavailable
const memoryFallback = new Map<string, unknown>();

export interface CachedModelMetadata {
  version: string;
  size: number;
  cachedAt: number;
  url?: string;
  etag?: string;
  [key: string]: unknown;
}

export async function getCachedModel(): Promise<ArrayBuffer | null> {
  try {
    let data: unknown;
    if (needleStore && hasIndexedDB) {
      data = await get(MODEL_STORE_KEY, needleStore);
    }
    if (!data) {
      data = memoryFallback.get(MODEL_STORE_KEY);
    }
    if (data instanceof ArrayBuffer) {
      return data;
    }
    if (data instanceof Uint8Array) {
      return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    }
    return null;
  } catch (err) {
    console.warn('[NeedleCache] Failed to read from IndexedDB, falling back to memory store:', err);
    const mem = memoryFallback.get(MODEL_STORE_KEY);
    return mem instanceof ArrayBuffer ? mem : null;
  }
}

export async function setCachedModel(
  buffer: ArrayBuffer,
  meta?: Partial<CachedModelMetadata>
): Promise<void> {
  const metadata: CachedModelMetadata = {
    version: 'needle3',
    size: buffer.byteLength,
    cachedAt: Date.now(),
    ...meta,
  };

  try {
    if (needleStore && hasIndexedDB) {
      await set(MODEL_STORE_KEY, buffer, needleStore);
      await set(MODEL_META_KEY, metadata, needleStore);
    }
  } catch (err) {
    console.warn('[NeedleCache] Failed to write to IndexedDB, saving to memory fallback:', err);
  }

  memoryFallback.set(MODEL_STORE_KEY, buffer);
  memoryFallback.set(MODEL_META_KEY, metadata);
}

export async function isModelCached(): Promise<boolean> {
  const buffer = await getCachedModel();
  return buffer !== null && buffer.byteLength > 0;
}

export async function clearCachedModel(): Promise<void> {
  try {
    if (needleStore && hasIndexedDB) {
      await del(MODEL_STORE_KEY, needleStore);
      await del(MODEL_META_KEY, needleStore);
    }
  } catch (err) {
    console.warn('[NeedleCache] Failed to delete from IndexedDB:', err);
  }
  memoryFallback.delete(MODEL_STORE_KEY);
  memoryFallback.delete(MODEL_META_KEY);
}

export async function getCachedModelMetadata(): Promise<CachedModelMetadata | null> {
  try {
    let meta: unknown;
    if (needleStore && hasIndexedDB) {
      meta = await get(MODEL_META_KEY, needleStore);
    }
    if (!meta) {
      meta = memoryFallback.get(MODEL_META_KEY);
    }
    return (meta as CachedModelMetadata) || null;
  } catch {
    return (memoryFallback.get(MODEL_META_KEY) as CachedModelMetadata) || null;
  }
}

export async function downloadAndCacheModel(
  url: string = DEFAULT_MODEL_URL,
  onProgress?: (percent: number) => void
): Promise<ArrayBuffer> {
  // Check if model is already stored locally
  const existing = await getCachedModel();
  if (existing && existing.byteLength > 0) {
    onProgress?.(100);
    return existing;
  }

  // Check if offline
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error(
      'Offline: Needle model is not cached yet and cannot be downloaded without an internet connection.'
    );
  }

  onProgress?.(0);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download Needle model (${response.status} ${response.statusText})`);
  }

  const contentLengthHeader = response.headers.get('content-length');
  const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;

  if (response.body && typeof response.body.getReader === 'function' && totalBytes > 0) {
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        receivedBytes += value.length;
        const pct = Math.min(99, Math.round((receivedBytes / totalBytes) * 100));
        onProgress?.(pct);
      }
    }

    const merged = new Uint8Array(receivedBytes);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    const finalBuffer = merged.buffer;
    await setCachedModel(finalBuffer, { url, size: receivedBytes });
    onProgress?.(100);
    return finalBuffer;
  } else {
    // Fallback if streaming body reader is unavailable
    const arrayBuffer = await response.arrayBuffer();
    await setCachedModel(arrayBuffer, { url, size: arrayBuffer.byteLength });
    onProgress?.(100);
    return arrayBuffer;
  }
}
