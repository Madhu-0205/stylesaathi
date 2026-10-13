import {
  WardrobeItem,
  PersonalStyleProfile,
  StylePreferences,
  WeatherSnapshot,
  CulturalContextSignals,
  RecommendationRequest,
  RecommendationSet,
  RecommendedOutfit,
  MissingOutfitRequirement,
  Occasion,
  Season,
} from '../../types';
import {
  CuratedActiveTrend,
  TrendEvidence,
  TrendDiscoveryOpportunity,
  TrendExplorationContext,
} from './types';
import {
  evaluateTrendEvidence,
  EvidenceEvaluationInput,
} from './evidenceEvaluator';
import { recommendOutfitsWithTelemetry } from '../recommendationEngine';
import { createContextSnapshot } from '../contextEngine';

/**
 * Evaluates a set of curated trends against wardrobe inventory and returns
 * structured discovery opportunities.
 * Supports both options object and positional argument calling styles.
 */
export function evaluateWardrobeDiscoveryOpportunities(
  trends: CuratedActiveTrend[],
  wardrobeOrInput: WardrobeItem[] | Omit<EvidenceEvaluationInput, 'trend'>,
  styleProfileArg?: PersonalStyleProfile,
  weatherArg?: WeatherSnapshot | null,
  culturalSignalsArg?: CulturalContextSignals,
  dormantItemsArg?: WardrobeItem[] | string[],
  referenceTimestampArg?: string
): TrendDiscoveryOpportunity[] {
  const opportunities: TrendDiscoveryOpportunity[] = [];

  for (const trend of trends) {
    let evidence: TrendEvidence;

    if (Array.isArray(wardrobeOrInput)) {
      evidence = evaluateTrendEvidence(
        trend,
        wardrobeOrInput,
        styleProfileArg,
        weatherArg,
        culturalSignalsArg,
        dormantItemsArg,
        referenceTimestampArg
      );
    } else {
      evidence = evaluateTrendEvidence({
        ...wardrobeOrInput,
        trend,
      });
    }

    if (evidence.classification === 'NOT_RELEVANT') {
      continue; // Filtered out by explicit avoidance or invalid state
    }

    const candidateItemIds = evidence.wardrobeCoverage.matchingOwnedItemIds;
    const suggestedOccasions =
      trend.concept.targetAttributes.occasions.length > 0
        ? trend.concept.targetAttributes.occasions
        : [('casual outing' as Occasion), ('everyday' as Occasion)];

    const revivalAnchorItem =
      evidence.rotationOpportunity.hasDormantPieces && evidence.rotationOpportunity.dormantPieceIds.length > 0
        ? (Array.isArray(wardrobeOrInput) ? wardrobeOrInput : (wardrobeOrInput as any).wardrobe)?.find(
            (i: WardrobeItem) => i.id === evidence.rotationOpportunity.dormantPieceIds[0]
          )
        : undefined;

    opportunities.push({
      id: `opp_${trend.concept.id}`,
      trend,
      evidence,
      candidateItemIds,
      suggestedOccasions,
      revivalAnchorItem,
    });
  }

  // Sort opportunities by non-authoritative metadata score for UI display
  return opportunities.sort(
    (a, b) => b.evidence.nonAuthoritativeDiscoveryScore - a.evidence.nonAuthoritativeDiscoveryScore
  );
}

/**
 * Builds the typed exploration context for Phase 5 delegation.
 */
export function buildTrendExplorationContext(
  trend: CuratedActiveTrend,
  evidence?: TrendEvidence,
  explicitOccasion?: Occasion,
  explicitAnchorItemId?: string
): TrendExplorationContext {
  const targetOccasion =
    explicitOccasion ||
    trend.concept.targetAttributes.occasions[0] ||
    ('everyday' as Occasion);

  const targetSeason =
    trend.concept.targetAttributes.seasons[0] ||
    ('summer' as Season);

  const revivalAnchorItemId =
    explicitAnchorItemId ||
    (evidence?.rotationOpportunity?.hasDormantPieces && evidence.rotationOpportunity.dormantPieceIds.length > 0
      ? evidence.rotationOpportunity.dormantPieceIds[0]
      : undefined);

  return {
    trendId: trend.concept.id,
    trendName: trend.concept.name,
    targetOccasion,
    targetSeason,
    targetAttributes: trend.concept.targetAttributes,
    revivalAnchorItemId,
  };
}

function getSafeStyleProfile(profile?: PersonalStyleProfile): PersonalStyleProfile | undefined {
  if (!profile) return undefined;
  return {
    ...profile,
    colorAffinities: profile.colorAffinities || {},
    fabricAffinities: profile.fabricAffinities || {},
    fitAffinities: profile.fitAffinities || {},
    occasionAffinities: profile.occasionAffinities || {},
  };
}

/**
 * "Try With Your Wardrobe" Execution:
 * Delegates to Phase 5 Recommendation Engine 2.0 to rank compatible outfits
 * anchored or tailored to the trend. Phase 5 remains the sole ranking authority.
 */
export function exploreTrendWithWardrobe(
  trend: CuratedActiveTrend,
  wardrobe: WardrobeItem[],
  styleProfile?: PersonalStyleProfile,
  weather?: WeatherSnapshot | null,
  culturalSignals?: CulturalContextSignals,
  referenceTimestamp?: string,
  targetOccasion?: Occasion,
  revivalAnchorItemId?: string,
  evidence?: TrendEvidence
): {
  explorationContext: TrendExplorationContext;
  outfits: RecommendedOutfit[];
  missingRequirements: MissingOutfitRequirement[];
  outfitSet: RecommendationSet;
  trendBadge: string;
} {
  const refDate = (referenceTimestamp || '2026-05-01').split('T')[0];

  const evalEvidence =
    evidence ||
    evaluateTrendEvidence(
      trend,
      wardrobe,
      styleProfile,
      weather,
      culturalSignals,
      revivalAnchorItemId ? [revivalAnchorItemId] : [],
      refDate
    );

  const explorationContext = buildTrendExplorationContext(
    trend,
    evalEvidence,
    targetOccasion,
    revivalAnchorItemId
  );

  const contextSnapshot = weather
    ? createContextSnapshot({
        location: { city: 'Current', country: 'India', source: 'manual' },
        weather,
        occasion: explorationContext.targetOccasion,
        date: new Date(refDate),
      })
    : undefined;

  const request: RecommendationRequest = {
    items: wardrobe,
    occasion: explorationContext.targetOccasion,
    season: explorationContext.targetSeason,
    localDate: refDate,
    styleProfile: getSafeStyleProfile(styleProfile),
    context: contextSnapshot,
    culturalSignals,
    limit: 5,
    anchorItemId: explorationContext.revivalAnchorItemId, // Reuses Phase 7 anchor capability
  };

  const result = recommendOutfitsWithTelemetry(request);

  return {
    explorationContext,
    outfits: result.set.outfits || [],
    missingRequirements: result.set.missingRequirements || [],
    outfitSet: result.set,
    trendBadge: `Trend Alignment: ${trend.concept.name}`,
  };
}
