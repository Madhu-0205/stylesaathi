import { CuratedActiveTrend, LocalTrendCache } from '../../engine/trends/types';
import { getBundledCuratedTrends } from '../../engine/trends/trendCatalog';
import { isTrendEligibleForActiveDiscovery } from '../../engine/trends/provenancePolicy';

export const TREND_CACHE_STORAGE_KEY = 'stylesaathi_trend_cache_v1';
export const TREND_CACHE_VERSION = '1.0.0';
export const TREND_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// In-memory fallback if localStorage is unavailable
const memStore = new Map<string, string>();

function getStorageItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {}
  return memStore.get(key) || null;
}

function setStorageItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
      return;
    }
  } catch {}
  memStore.set(key, value);
}

function removeStorageItem(key: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
      return;
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
      return;
    }
  } catch {}
  memStore.delete(key);
}

/**
 * Trend service managing the local offline-first trend cache.
 * All operations take an explicit reference timestamp / date to guarantee determinism.
 */
export class TrendService {
  private storageKey: string;

  constructor(storageKey: string = TREND_CACHE_STORAGE_KEY) {
    this.storageKey = storageKey;
  }

  /**
   * Retrieves or initializes the local trend cache.
   * Uses referenceTimestampMs (or defaults explicitly) to check TTL.
   */
  public getCache(referenceTimestampMs: number): LocalTrendCache {
    const raw = getStorageItem(this.storageKey);
    if (raw) {
      try {
        const parsed: LocalTrendCache = JSON.parse(raw);
        if (
          parsed &&
          parsed.version === TREND_CACHE_VERSION &&
          Array.isArray(parsed.concepts) &&
          referenceTimestampMs <= parsed.expiresAt
        ) {
          return parsed;
        }
      } catch {
        // Corrupted cache - fallback to rebuild
      }
    }

    // Cache missing or expired; refresh from bundled catalog
    return this.refreshFromBundled(referenceTimestampMs);
  }

  /**
   * Refreshes cache from local bundled catalog with explicit timestamp.
   */
  public refreshFromBundled(referenceTimestampMs: number): LocalTrendCache {
    const bundled = getBundledCuratedTrends();
    const cache: LocalTrendCache = {
      version: TREND_CACHE_VERSION,
      fetchedAt: referenceTimestampMs,
      expiresAt: referenceTimestampMs + TREND_CACHE_TTL_MS,
      curatedSource: 'bundled',
      concepts: bundled,
    };
    this.saveCache(cache);
    return cache;
  }

  /**
   * Directly save a cache structure.
   */
  public saveCache(cache: LocalTrendCache): void {
    setStorageItem(this.storageKey, JSON.stringify(cache));
  }

  /**
   * Clear the local cache.
   */
  public clearCache(): void {
    removeStorageItem(this.storageKey);
  }

  /**
   * Returns all active discoverable trends for a given reference date and timestamp.
   */
  public getActiveTrends(
    referenceDate: string,
    referenceTimestampMs: number
  ): CuratedActiveTrend[] {
    const cache = this.getCache(referenceTimestampMs);
    return cache.concepts.filter((trend) =>
      isTrendEligibleForActiveDiscovery(trend, referenceDate)
    );
  }

  /**
   * Looks up a single trend by ID from cache.
   */
  public getTrendById(
    trendId: string,
    referenceTimestampMs: number
  ): CuratedActiveTrend | undefined {
    const cache = this.getCache(referenceTimestampMs);
    return cache.concepts.find((t) => t.concept.id === trendId);
  }
}

export const defaultTrendService = new TrendService();
