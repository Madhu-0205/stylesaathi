/**
 * Storage Resilience Service
 * Manages best-effort storage persistence, quota checks, and honest
 * failure/eviction handling for both Authenticated and Guest users.
 */

export interface StorageStatus {
  isPersisted: boolean;
  usageBytes?: number;
  quotaBytes?: number;
  percentageUsed?: number;
  isIndexedDBSupported: boolean;
}

export type StorageRecoveryStrategy = 'SUPABASE_REHYDRATION' | 'UNRECOVERABLE_LOCAL_EVICTION';

/**
 * Determines whether an error is a QuotaExceededError across browser engines.
 */
export function isQuotaExceededError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof DOMException) {
    return (
      err.name === 'QuotaExceededError' ||
      err.code === 22 || // Legacy code for QuotaExceededError
      err.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    );
  }
  if (typeof err === 'object' && 'name' in err) {
    const name = (err as { name: unknown }).name;
    return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED';
  }
  return false;
}

/**
 * Checks whether IndexedDB is available and functional in the current environment.
 */
export function isIndexedDBAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined' && window.indexedDB !== null;
  } catch {
    return false;
  }
}

/**
 * Requests persistent storage from the browser / WebView (best-effort only).
 * Never assumes persistence is guaranteed.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.persist === 'function') {
    try {
      const persisted = await navigator.storage.persist();
      return persisted;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Checks current storage quota and usage.
 */
export async function checkStorageStatus(): Promise<StorageStatus> {
  const isIdbSupported = isIndexedDBAvailable();
  let isPersisted = false;
  let usageBytes: number | undefined;
  let quotaBytes: number | undefined;
  let percentageUsed: number | undefined;

  if (typeof navigator !== 'undefined' && navigator.storage) {
    try {
      if (typeof navigator.storage.persisted === 'function') {
        isPersisted = await navigator.storage.persisted();
      }
      if (typeof navigator.storage.estimate === 'function') {
        const estimate = await navigator.storage.estimate();
        usageBytes = estimate.usage;
        quotaBytes = estimate.quota;
        if (usageBytes !== undefined && quotaBytes !== undefined && quotaBytes > 0) {
          percentageUsed = Math.round((usageBytes / quotaBytes) * 100);
        }
      }
    } catch {
      // Storage API access restricted or failed
    }
  }

  return {
    isPersisted,
    usageBytes,
    quotaBytes,
    percentageUsed,
    isIndexedDBSupported: isIdbSupported,
  };
}

/**
 * Explains recovery capability honestly based on user authentication state.
 */
export function getStorageRecoveryModel(isGuest: boolean): {
  strategy: StorageRecoveryStrategy;
  description: string;
} {
  if (isGuest) {
    return {
      strategy: 'UNRECOVERABLE_LOCAL_EVICTION',
      description:
        'As a guest, your wardrobe is saved strictly on this device. If the device OS clears application storage, unsynchronized local data cannot be recovered. Create an account to enable cloud backup.',
    };
  }

  return {
    strategy: 'SUPABASE_REHYDRATION',
    description:
      'Your wardrobe is synchronized with the cloud. If local device storage is cleared, your wardrobe will automatically rehydrate from Supabase once network connectivity is restored.',
  };
}
