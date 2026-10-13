import {
  TrendSourceType,
  TrendProvenance,
  CuratedActiveTrend,
  TrendFreshnessStatus,
  TrendLifecycleState,
} from './types';

/**
 * StyleSaathi configured source policy.
 * Sourced weights reflect editorial policy decisions, not universal truths.
 */
export const SOURCE_TRUST_POLICY: Readonly<Record<TrendSourceType, number>> = Object.freeze({
  CURATED_EDITORIAL: 1.0,         // Established fashion editorial publications
  OFFICIAL_FASHION_SOURCE: 0.95,  // Industry councils, fashion weeks, textile bodies
  INDIAN_HERITAGE_CURATION: 0.95, // Traditional craft & handloom preservation sources
  DESIGNER_ARCHIVE: 0.85,         // Verified designer collections & retrospectives
  PUBLIC_TREND_REPORT: 0.70,      // General industry trend summaries
  COMMUNITY_OBSERVATION: 0.40,    // Documented regional street/community observations
  UNVERIFIED_SOCIAL: 0.20,        // Social media mentions without editorial corroboration
});

/**
 * Derives the configured policy trust weight for a source type.
 */
export function deriveSourceTrustWeight(sourceType: TrendSourceType): number {
  return SOURCE_TRUST_POLICY[sourceType] ?? 0.30;
}

/**
 * Deterministically computes confidence for a trend observation based on source trust,
 * corroboration count, and expert review status.
 * Supports both CuratedActiveTrend object and individual parameter signatures.
 */
export function deriveTrendConfidence(
  trendOrSourceType: CuratedActiveTrend | TrendSourceType,
  corroborationCountArg?: number,
  reviewedArg?: boolean
): number {
  let sourceType: TrendSourceType;
  let corroborationCount: number;
  let reviewed: boolean;

  if (typeof trendOrSourceType === 'object') {
    sourceType = trendOrSourceType.provenance.sourceType;
    corroborationCount =
      trendOrSourceType.corroboratingSignalIds?.length ||
      trendOrSourceType.provenance.corroborationCount ||
      1;
    reviewed = Boolean(trendOrSourceType.reviewedBy || trendOrSourceType.provenance.reviewed);
  } else {
    sourceType = trendOrSourceType;
    corroborationCount = corroborationCountArg ?? 1;
    reviewed = reviewedArg ?? false;
  }

  const baseWeight = deriveSourceTrustWeight(sourceType);
  const corroborationBonus = Math.min(0.15, Math.max(0, (corroborationCount - 1) * 0.05));
  const rawConfidence = Math.min(1.0, baseWeight + corroborationBonus);

  if (!reviewed) {
    return Math.min(0.50, Math.round(rawConfidence * 0.60 * 100) / 100);
  }

  return Math.round(rawConfidence * 100) / 100;
}

export interface FreshnessResult {
  status: TrendFreshnessStatus;
  daysSinceObservation: number;
}

/**
 * Evaluates the temporal freshness status of a trend concept against an explicit reference date.
 * Does NOT use the system clock; caller must provide referenceDate (YYYY-MM-DD).
 * Supports both CuratedActiveTrend and positional (validFrom, validUntil, observedAt, referenceDate).
 */
export function evaluateTrendFreshness(
  trendOrValidFrom: CuratedActiveTrend | string,
  validUntilOrRefDate?: string,
  observedAtArg?: string,
  referenceDateArg?: string
): FreshnessResult {
  let validFrom: string;
  let validUntil: string;
  let observedAt: string;
  let referenceDate: string;

  if (typeof trendOrValidFrom === 'object') {
    validFrom = trendOrValidFrom.concept.validFrom;
    validUntil = trendOrValidFrom.concept.validUntil;
    observedAt = trendOrValidFrom.provenance.observedAt;
    referenceDate = validUntilOrRefDate || '2026-05-01';
  } else {
    validFrom = trendOrValidFrom;
    validUntil = validUntilOrRefDate || '';
    observedAt = observedAtArg || validFrom;
    referenceDate = referenceDateArg || '2026-05-01';
  }

  const refClean = referenceDate.split('T')[0];
  const obsClean = observedAt.split('T')[0];

  const refMs = new Date(refClean).getTime();
  const obsMs = new Date(obsClean).getTime();
  const daysSinceObservation = Math.max(0, Math.round((refMs - obsMs) / (1000 * 60 * 60 * 24)));

  if (refClean > validUntil) {
    return { status: 'EXPIRED', daysSinceObservation };
  }

  if (refClean < validFrom) {
    return { status: 'UPCOMING', daysSinceObservation };
  }

  if (daysSinceObservation < 90) {
    return { status: 'FRESH', daysSinceObservation };
  }

  if (daysSinceObservation <= 180) {
    return { status: 'ESTABLISHED', daysSinceObservation };
  }

  return { status: 'SEASONAL_CLASSIC', daysSinceObservation };
}

/**
 * Evaluates the appropriate lifecycle state for a normalized trend concept.
 * Supports both CuratedActiveTrend and positional parameter signatures.
 */
export function evaluateTrendLifecycleState(
  trendOrCorroboration: CuratedActiveTrend | number,
  refDateOrReviewed?: string | boolean,
  validFromArg?: string,
  validUntilArg?: string,
  referenceDateArg?: string
): TrendLifecycleState {
  let reviewed: boolean;
  let validFrom: string;
  let validUntil: string;
  let referenceDate: string;

  if (typeof trendOrCorroboration === 'object') {
    reviewed = Boolean(trendOrCorroboration.reviewedBy && trendOrCorroboration.provenance.reviewed);
    validFrom = trendOrCorroboration.concept.validFrom;
    validUntil = trendOrCorroboration.concept.validUntil;
    referenceDate = (refDateOrReviewed as string) || '2026-05-01';
  } else {
    reviewed = Boolean(refDateOrReviewed);
    validFrom = validFromArg || '';
    validUntil = validUntilArg || '';
    referenceDate = referenceDateArg || '2026-05-01';
  }

  const refClean = referenceDate.split('T')[0];

  if (refClean > validUntil) {
    return 'EXPIRED';
  }

  if (!reviewed) {
    return 'OBSERVED';
  }

  if (refClean < validFrom) {
    return 'UPCOMING';
  }

  return 'ACTIVE';
}

/**
 * Mandatory active discovery guard.
 * Verifies that a trend is eligible for discovery:
 * 1. reviewed === true
 * 2. lifecycle is ACTIVE or AGING
 * 3. referenceDate is strictly within [validFrom, validUntil]
 */
export function isTrendEligibleForActiveDiscovery(
  trend: CuratedActiveTrend,
  referenceDate: string
): boolean {
  if (!trend || !trend.provenance || !trend.concept) {
    return false;
  }

  const refClean = referenceDate.split('T')[0];

  // Review Gate: reviewed === false cannot produce active discovery
  const isReviewed = Boolean(trend.reviewedBy && trend.provenance.reviewed);
  if (!isReviewed) {
    return false;
  }

  // Date validity window guard
  if (refClean < trend.concept.validFrom || refClean > trend.concept.validUntil) {
    return false;
  }

  const state = trend.concept.lifecycleState;
  return state === 'ACTIVE' || state === 'AGING';
}
