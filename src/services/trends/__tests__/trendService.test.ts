import { describe, it, expect, beforeEach } from 'vitest';
import { TrendService, TREND_CACHE_TTL_MS, TREND_CACHE_VERSION } from '../trendService';

describe('Phase 11 — TrendService & Local Cache', () => {
  let service: TrendService;
  const mockStorageKey = 'stylesaathi_trend_cache_test';

  beforeEach(() => {
    service = new TrendService(mockStorageKey);
    service.clearCache();
  });

  it('initializes and populates cache from bundled catalog on cold start', () => {
    const refMs = 1773000000000; // Explicit timestamp
    const cache = service.getCache(refMs);

    expect(cache.version).toBe(TREND_CACHE_VERSION);
    expect(cache.curatedSource).toBe('bundled');
    expect(cache.fetchedAt).toBe(refMs);
    expect(cache.expiresAt).toBe(refMs + TREND_CACHE_TTL_MS);
    expect(cache.concepts.length).toBeGreaterThanOrEqual(1);
  });

  it('reuses valid cache within TTL window', () => {
    const t0 = 1773000000000;
    const cache0 = service.getCache(t0);

    // 2 days later (well within 7 days TTL)
    const t1 = t0 + 2 * 24 * 60 * 60 * 1000;
    const cache1 = service.getCache(t1);

    expect(cache1.fetchedAt).toBe(cache0.fetchedAt);
    expect(cache1.expiresAt).toBe(cache0.expiresAt);
  });

  it('refreshes cache when TTL expires (after 7 days)', () => {
    const t0 = 1773000000000;
    service.getCache(t0);

    // 8 days later (exceeds 7 days TTL)
    const t2 = t0 + 8 * 24 * 60 * 60 * 1000;
    const cache2 = service.getCache(t2);

    expect(cache2.fetchedAt).toBe(t2);
    expect(cache2.expiresAt).toBe(t2 + TREND_CACHE_TTL_MS);
  });

  it('filters active trends using explicit reference date without Date.now()', () => {
    const refMs = 1773000000000;
    const activeTrends2026 = service.getActiveTrends('2026-06-15', refMs);
    expect(activeTrends2026.length).toBeGreaterThan(0);

    // Far in the future (2030) - trends expired
    const activeTrends2030 = service.getActiveTrends('2030-01-01', refMs);
    expect(activeTrends2030.length).toBe(0);
  });
});
