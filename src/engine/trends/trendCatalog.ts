import curatedTrendsData from '../../data/trends/curatedTrends.json';
import { CuratedActiveTrend } from './types';
import { isTrendEligibleForActiveDiscovery } from './provenancePolicy';

/**
 * Loads all bundled curated trends from local immutable catalog.
 * No remote dependencies; works completely offline.
 */
export function getBundledCuratedTrends(): CuratedActiveTrend[] {
  return (curatedTrendsData as unknown as CuratedActiveTrend[]).map((t) => ({
    ...t,
    corroboratingSignalIds: [...t.corroboratingSignalIds],
  }));
}

/**
 * Look up a bundled trend by its canonical identifier.
 */
export function getBundledTrendById(trendId: string): CuratedActiveTrend | undefined {
  const trends = getBundledCuratedTrends();
  return trends.find((t) => t.concept.id === trendId);
}

/**
 * Look up a bundled trend by its URL-friendly slug.
 */
export function getBundledTrendBySlug(slug: string): CuratedActiveTrend | undefined {
  const trends = getBundledCuratedTrends();
  return trends.find((t) => t.concept.slug === slug);
}

/**
 * Retrieve only trends that pass the active discovery gate at the given reference date:
 * - reviewed === true
 * - lifecycleState === 'ACTIVE'
 * - referenceDate >= validFrom
 * - referenceDate <= validUntil
 */
export function getActiveBundledTrends(referenceDate: string): CuratedActiveTrend[] {
  const allTrends = getBundledCuratedTrends();
  return allTrends.filter((t) => isTrendEligibleForActiveDiscovery(t, referenceDate));
}
