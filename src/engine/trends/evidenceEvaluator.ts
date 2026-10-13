import {
  WardrobeItem,
  PersonalStyleProfile,
  StylePreferences,
  WeatherSnapshot,
  CulturalContextSignals,
  Occasion,
  Season,
} from '../../types';
import {
  CuratedActiveTrend,
  TrendEvidence,
  DiscoveryClassification,
  TrendFreshnessStatus,
} from './types';
import {
  deriveSourceTrustWeight,
  evaluateTrendFreshness,
  isTrendEligibleForActiveDiscovery,
} from './provenancePolicy';
import { FESTIVAL_CONTEXT_RULES } from '../knowledge/knowledgeData';

export interface EvidenceEvaluationInput {
  trend: CuratedActiveTrend;
  wardrobe: WardrobeItem[];
  styleProfile?: PersonalStyleProfile;
  preferences?: StylePreferences;
  weather?: WeatherSnapshot | null;
  culturalSignals?: CulturalContextSignals;
  dormantItemIds?: string[];
  referenceDate: string; // YYYY-MM-DD or ISO
  allowExplicitAvoidanceOverride?: boolean; // Single-turn override if user explicitly asked
}

/**
 * Deterministically evaluates 7 distinct evidence dimensions for an active trend
 * against a user's personal closet, style preferences, context, and rotation history.
 * Supports both options-object and positional argument calls.
 */
export function evaluateTrendEvidence(
  trendOrInput: CuratedActiveTrend | EvidenceEvaluationInput,
  wardrobeArg?: WardrobeItem[],
  styleProfileArg?: PersonalStyleProfile,
  weatherArg?: WeatherSnapshot | null,
  culturalSignalsArg?: CulturalContextSignals,
  dormantItemsArg?: WardrobeItem[] | string[],
  referenceDateArg?: string,
  allowExplicitAvoidanceOverrideArg?: boolean
): TrendEvidence {
  let trend: CuratedActiveTrend;
  let wardrobe: WardrobeItem[];
  let styleProfile: PersonalStyleProfile | undefined;
  let preferences: StylePreferences | undefined;
  let weather: WeatherSnapshot | null | undefined;
  let culturalSignals: CulturalContextSignals | undefined;
  let dormantItemIds: string[];
  let referenceDate: string;
  let allowExplicitAvoidanceOverride: boolean;

  if (trendOrInput && 'concept' in trendOrInput) {
    // Positional call
    trend = trendOrInput;
    wardrobe = wardrobeArg || [];
    styleProfile = styleProfileArg;
    weather = weatherArg;
    culturalSignals = culturalSignalsArg;
    dormantItemIds = Array.isArray(dormantItemsArg)
      ? dormantItemsArg.map((i) => (typeof i === 'string' ? i : i.id))
      : [];
    referenceDate = (referenceDateArg || '2026-05-01').split('T')[0];
    allowExplicitAvoidanceOverride = Boolean(allowExplicitAvoidanceOverrideArg);
  } else {
    // Options object call
    const inp = trendOrInput as EvidenceEvaluationInput;
    trend = inp.trend;
    wardrobe = inp.wardrobe || [];
    styleProfile = inp.styleProfile;
    preferences = inp.preferences;
    weather = inp.weather;
    culturalSignals = inp.culturalSignals;
    dormantItemIds = inp.dormantItemIds || [];
    referenceDate = (inp.referenceDate || '2026-05-01').split('T')[0];
    allowExplicitAvoidanceOverride = Boolean(inp.allowExplicitAvoidanceOverride);
  }

  // Fallback safety if trend is missing
  if (!trend || !trend.concept) {
    return {
      trendId: 'unknown',
      classification: 'NOT_RELEVANT',
      provenance: {
        sourceType: 'UNVERIFIED_SOCIAL',
        sourceTrustPolicyWeight: 0.2,
        confidence: 0,
        corroborationCount: 0,
        reviewed: false,
      },
      provenanceAndTrust: {
        trustWeight: 0.2,
        sourceType: 'UNVERIFIED_SOCIAL',
        confidence: 0,
        reviewed: false,
      },
      freshness: {
        observedAt: '',
        validUntil: '',
        referenceDate,
        status: 'UNAVAILABLE',
      },
      temporalFreshness: {
        status: 'UNAVAILABLE',
        corroboratingSignalsCount: 0,
        daysSinceObservation: 0,
      },
      wardrobeCoverage: {
        matchingOwnedItemIds: [],
        exactMatchCount: 0,
        substituteMatchCount: 0,
        canFormCompleteLook: false,
        missingSlotRoles: [],
        directMatchesCount: 0,
        structuralSubstitutesCount: 0,
        matchingItemNames: [],
      },
      personalStyleAlignment: {
        isExplicitlyAvoided: true,
        explicitAvoidanceConflict: true,
        avoidanceReason: 'Trend not found',
        learnedAffinityPenalty: false,
        positiveAffinityMatches: [],
        styleDeltaSummary: 'Trend unavailable',
        alignmentScore: 0,
      },
      culturalContext: {
        hasIndianResonance: false,
        modestyStatus: 'NOT_SPECIFIED',
        festivalFit: 'NOT_APPLICABLE',
      },
      culturalModestyContext: {
        isIndianFusion: false,
        modestyAssessment: 'NOT_SPECIFIED',
        culturalResonanceNotes: 'None',
      },
      contextualFit: {
        weatherVerified: false,
        thermalSuitability: 'UNVERIFIED',
      },
      contextThermalFit: {
        thermalSuitability: 'UNVERIFIED',
        weatherNotes: 'Weather context was unverified or unavailable',
      },
      rotationOpportunity: {
        hasDormantPieces: false,
        dormantPieceIds: [],
        dormantItemNames: [],
        potentialUtilizationGain: '0%',
      },
      nonAuthoritativeDiscoveryScore: 0,
      telemetryExplanation: {
        headline: 'Trend Unavailable',
        evidencePoints: [],
        limitations: ['Trend record was missing or corrupted'],
      },
      limitations: ['Trend record was missing or corrupted'],
    };
  }

  const targetAttrs = trend.concept.targetAttributes;

  // ==========================================================================
  // GUARD: Section 10 Active Discovery Guard
  // Expired, unreviewed, or out-of-window trends must never be active.
  // ==========================================================================
  const isEligible = isTrendEligibleForActiveDiscovery(trend, referenceDate);
  const freshnessResult = evaluateTrendFreshness(trend, referenceDate);
  const freshnessStatus: TrendFreshnessStatus = freshnessResult.status;

  // 1. Provenance & Trust Evidence
  const trustPolicyWeight = deriveSourceTrustWeight(trend.provenance.sourceType);
  const corroborationCount = trend.corroboratingSignalIds?.length || trend.provenance.corroborationCount || 1;
  const isReviewed = Boolean(trend.reviewedBy || trend.provenance.reviewed);

  const provenanceEvidence = {
    sourceType: trend.provenance.sourceType,
    sourceTrustPolicyWeight: trustPolicyWeight,
    confidence: trend.provenance.confidence ?? trustPolicyWeight,
    corroborationCount,
    reviewed: isReviewed,
  };

  const provenanceAndTrust = {
    trustWeight: trustPolicyWeight,
    sourceType: trend.provenance.sourceType,
    confidence: provenanceEvidence.confidence,
    reviewed: isReviewed,
  };

  // 2. Freshness Evidence
  const freshnessEvidence = {
    observedAt: trend.provenance.observedAt,
    validUntil: trend.concept.validUntil,
    referenceDate,
    status: freshnessStatus,
  };

  const temporalFreshness = {
    status: freshnessStatus,
    corroboratingSignalsCount: corroborationCount,
    daysSinceObservation: freshnessResult.daysSinceObservation,
  };

  // 3. Wardrobe Coverage Evidence (Wardrobe-first)
  const cleanWardrobe = wardrobe.filter((item) => item.status === 'clean');
  const directMatches: WardrobeItem[] = [];
  const substituteMatches: WardrobeItem[] = [];

  for (const item of cleanWardrobe) {
    const categoryMatch = targetAttrs.categories.length === 0 || targetAttrs.categories.includes(item.category);
    if (!categoryMatch) continue;

    const silhouetteMatch =
      !item.fit ||
      targetAttrs.silhouettes.length === 0 ||
      targetAttrs.silhouettes.includes(item.fit);

    const fabricMatch =
      item.fabric &&
      targetAttrs.fabrics.some((f) => f.toLowerCase() === item.fabric?.toLowerCase());

    const colorMatch =
      item.colors &&
      item.colors.some((c) =>
        targetAttrs.colorPalette.some((tc) => tc.toLowerCase() === c.toLowerCase())
      );

    if (silhouetteMatch && (fabricMatch || colorMatch)) {
      directMatches.push(item);
    } else if (silhouetteMatch) {
      substituteMatches.push(item);
    }
  }

  const matchingOwnedItemIds = Array.from(
    new Set([...directMatches.map((i) => i.id), ...substituteMatches.map((i) => i.id)])
  );

  const allMatchingItems = [...directMatches, ...substituteMatches];
  const matchingItemNames = Array.from(new Set(allMatchingItems.map((i) => i.name)));

  // Can the user form a complete look with clean items?
  const hasTop = cleanWardrobe.some(
    (i) => (i.category === 'Tops' || i.category === 'Ethnic') && matchingOwnedItemIds.includes(i.id)
  );
  const hasBottom = cleanWardrobe.some(
    (i) => (i.category === 'Bottoms' || i.category === 'Ethnic') && matchingOwnedItemIds.includes(i.id)
  );
  const canFormCompleteLook = hasTop && (hasBottom || cleanWardrobe.some((i) => i.category === 'Ethnic'));

  // Missing roles: purely informational; NEVER trigger a purchase recommendation
  const missingSlotRoles: string[] = [];
  if (!hasTop && targetAttrs.categories.includes('Tops')) {
    missingSlotRoles.push('Tops');
  }
  if (!hasBottom && targetAttrs.categories.includes('Bottoms')) {
    missingSlotRoles.push('Bottoms');
  }

  const wardrobeCoverageEvidence = {
    matchingOwnedItemIds,
    exactMatchCount: directMatches.length,
    substituteMatchCount: substituteMatches.length,
    canFormCompleteLook,
    missingSlotRoles,
    directMatchesCount: directMatches.length,
    structuralSubstitutesCount: substituteMatches.length,
    matchingItemNames,
  };

  // 4. Personal Style Alignment Evidence
  let isExplicitlyAvoided = false;
  let explicitAvoidanceConflict = false;
  let avoidanceReason: string | undefined;
  let learnedAffinityPenalty = false;
  const positiveAffinityMatches: string[] = [];
  let affinityScore = 0.5;

  if (styleProfile) {
    // Check explicit avoidance (Colors, Silhouettes, Fabrics, Patterns)
    const avoidedColors = styleProfile.avoidedColors || [];
    const avoidedSilhouettes: string[] = (styleProfile as any).avoidedSilhouettes || (styleProfile as any).avoidedFits || [];
    const avoidedFabrics = styleProfile.avoidedFabrics || [];
    const avoidedPatterns = styleProfile.avoidedPatterns || [];

    const colorConflict = targetAttrs.colorPalette.find((c) =>
      avoidedColors.some((ac) => ac.toLowerCase() === c.toLowerCase())
    );
    const silhouetteConflict = targetAttrs.silhouettes.find((s) =>
      avoidedSilhouettes.some((as: string) => as.toLowerCase() === s.toLowerCase())
    );
    const fabricConflict = targetAttrs.fabrics.find((f) =>
      avoidedFabrics.some((af) => af.toLowerCase() === f.toLowerCase())
    );
    const patternConflict = targetAttrs.patterns.find((p) =>
      avoidedPatterns.some((ap) => ap.toLowerCase() === p.toLowerCase())
    );

    if (colorConflict || silhouetteConflict || fabricConflict || patternConflict) {
      explicitAvoidanceConflict = true;
      avoidanceReason = colorConflict
        ? `Avoided color: ${colorConflict}`
        : silhouetteConflict
        ? `Avoided silhouette: ${silhouetteConflict}`
        : fabricConflict
        ? `Avoided fabric: ${fabricConflict}`
        : `Avoided pattern: ${patternConflict}`;

      if (!allowExplicitAvoidanceOverride) {
        isExplicitlyAvoided = true;
      }
    }

    // Check learned behavioral negative preference (affinity <= -0.3)
    if (styleProfile.colorAffinities) {
      for (const color of targetAttrs.colorPalette) {
        const affObj = (styleProfile.colorAffinities as Record<string, any>)[color.toLowerCase()];
        const aff = typeof affObj === 'number' ? affObj : affObj?.score;
        if (typeof aff === 'number') {
          if (aff <= -0.3) {
            learnedAffinityPenalty = true;
          } else if (aff >= 0.3) {
            positiveAffinityMatches.push(color);
          }
        }
      }
    }

    if (styleProfile.fabricAffinities) {
      for (const fabric of targetAttrs.fabrics) {
        const affObj = (styleProfile.fabricAffinities as Record<string, any>)[fabric.toLowerCase()];
        const aff = typeof affObj === 'number' ? affObj : affObj?.score;
        if (typeof aff === 'number') {
          if (aff <= -0.3) {
            learnedAffinityPenalty = true;
          } else if (aff >= 0.3) {
            positiveAffinityMatches.push(fabric);
          }
        }
      }
    }

    // Compute basic alignment score
    let baseAffinity = 0.6;
    if (positiveAffinityMatches.length > 0) baseAffinity += 0.25;
    if (learnedAffinityPenalty) baseAffinity -= 0.25;
    affinityScore = Math.max(0.1, Math.min(1.0, baseAffinity));
  }

  const personalStyleAlignmentEvidence = {
    isExplicitlyAvoided,
    explicitAvoidanceConflict,
    avoidanceReason,
    learnedAffinityPenalty,
    positiveAffinityMatches,
    styleDeltaSummary: isExplicitlyAvoided
      ? `Explicitly avoided: ${avoidanceReason}`
      : learnedAffinityPenalty
      ? 'Features elements with lower historical engagement'
      : positiveAffinityMatches.length > 0
      ? `Aligns with preferred ${positiveAffinityMatches.slice(0, 2).join(', ')}`
      : 'Neutral style alignment',
    alignmentScore: affinityScore,
  };

  // 5. Cultural Context (Phase 6 Authority)
  const isIndianFusion = Boolean(trend.concept.indianFashionContext?.isIndianFusion);
  let modestyStatus: 'ALIGNED' | 'MISMATCH' | 'NOT_SPECIFIED' = 'NOT_SPECIFIED';
  let modestyDetails: string | undefined;

  if (culturalSignals?.declaredModestyLevel) {
    const level = culturalSignals.declaredModestyLevel;
    if (level === 'high' || (level as any) === 'CONSERVATIVE') {
      const isRevealing = targetAttrs.silhouettes.some((s) => (s as any) === 'slim' || (s as any) === 'fitted');
      if (isRevealing) {
        modestyStatus = 'MISMATCH';
        modestyDetails = 'Fitted silhouettes may not match conservative modesty preference';
      } else {
        modestyStatus = 'ALIGNED';
        modestyDetails = 'Relaxed silhouette matches conservative coverage preferences';
      }
    } else {
      modestyStatus = 'ALIGNED';
    }
  }

  const festivalFit =
    (culturalSignals?.festivalContext || (culturalSignals as any)?.activeFestival) &&
    targetAttrs.occasions.some((o) => (o as any) === 'festive' || (o as any) === 'puja' || (o as any) === 'wedding' || o === 'celebration' || o === 'Diwali' || o === 'Holi' || o === 'Eid')
      ? ('ALIGNED' as const)
      : ('NOT_APPLICABLE' as const);

  const culturalEvidence = {
    hasIndianResonance: isIndianFusion,
    modestyStatus,
    modestyDetails,
    festivalFit,
  };

  const culturalModestyContext = {
    isIndianFusion,
    modestyAssessment: modestyStatus,
    culturalResonanceNotes:
      trend.concept.indianFashionContext?.culturalNotes ||
      (isIndianFusion ? 'Indian fusion silhouette styling' : 'Contemporary styling'),
  };

  // 6. Contextual & Thermal Fit (Phase 4 Authority)
  let weatherVerified = false;
  let thermalSuitability: 'OPTIMAL' | 'ACCEPTABLE' | 'UNSUITABLE' | 'UNVERIFIED' = 'UNVERIFIED';
  let thermalReason: string | undefined;

  if (weather && weather.temperature !== undefined) {
    weatherVerified = true;
    const temp = weather.temperature;
    const isHeavyFabric = targetAttrs.fabrics.some(
      (f) => (f as any) === 'wool' || (f as any) === 'corduroy' || f === 'velvet'
    );
    const isLightFabric = targetAttrs.fabrics.some(
      (f) => f === 'linen' || f === 'cotton' || f === 'chiffon' || f === 'georgette'
    );

    if (temp >= 32) {
      if (isHeavyFabric) {
        thermalSuitability = 'UNSUITABLE';
        thermalReason = 'Heavy fabrics unsuited for high temperatures (>32°C)';
      } else if (isLightFabric) {
        thermalSuitability = 'OPTIMAL';
        thermalReason = 'Light breathable fabrics ideal for hot weather';
      } else {
        thermalSuitability = 'ACCEPTABLE';
      }
    } else if (temp <= 15) {
      if (isLightFabric && !targetAttrs.seasons.includes('winter')) {
        thermalSuitability = 'UNSUITABLE';
        thermalReason = 'Light fabrics unsuited for cold temperatures (<15°C)';
      } else {
        thermalSuitability = 'ACCEPTABLE';
      }
    } else {
      thermalSuitability = 'ACCEPTABLE';
    }
  }

  const contextualFitEvidence = {
    weatherVerified,
    thermalSuitability,
    thermalReason,
  };

  const contextThermalFit = {
    thermalSuitability,
    weatherNotes:
      thermalReason ||
      (thermalSuitability === 'UNVERIFIED'
        ? 'Weather context was unverified or unavailable'
        : 'Contextually suitable'),
  };

  // 7. Rotation Opportunity (Phase 8 Authority)
  const dormantMatches = matchingOwnedItemIds.filter((id) => dormantItemIds.includes(id));
  const hasDormantPieces = dormantMatches.length > 0;
  const dormantItemNames = wardrobe
    .filter((i) => dormantMatches.includes(i.id))
    .map((i) => i.name);

  const rotationOpportunityEvidence = {
    hasDormantPieces,
    dormantPieceIds: dormantMatches,
    dormantItemNames,
    potentialUtilizationGain: hasDormantPieces ? `+${dormantMatches.length * 15}%` : '0%',
  };

  // ==========================================================================
  // DISCOVERY CLASSIFICATION
  // ==========================================================================
  let classification: DiscoveryClassification;

  if (!isEligible || isExplicitlyAvoided || thermalSuitability === 'UNSUITABLE' || modestyStatus === 'MISMATCH') {
    classification = 'NOT_RELEVANT';
  } else if (canFormCompleteLook && affinityScore >= 0.6) {
    classification = 'STRONG_DISCOVERY';
  } else if (matchingOwnedItemIds.length > 0) {
    classification = 'WARDROBE_RELEVANT';
  } else if (affinityScore >= 0.7) {
    classification = 'STYLE_RELEVANT';
  } else {
    classification = 'INFORMATIVE';
  }

  // Non-authoritative score for UI metadata ONLY
  let rawScore = 0.5;
  if (classification === 'STRONG_DISCOVERY') rawScore = 0.95;
  else if (classification === 'WARDROBE_RELEVANT') rawScore = 0.75;
  else if (classification === 'STYLE_RELEVANT') rawScore = 0.60;
  else if (classification === 'INFORMATIVE') rawScore = 0.40;
  else rawScore = 0.10;

  if (hasDormantPieces) rawScore = Math.min(1.0, rawScore + 0.05);
  const nonAuthoritativeDiscoveryScore = Math.round(rawScore * 100) / 100;

  // Telemetry explanation & limitations
  const evidencePoints: string[] = [];
  const limitations: string[] = [];

  if (matchingOwnedItemIds.length > 0) {
    evidencePoints.push(`You own ${matchingOwnedItemIds.length} piece(s) matching this trend`);
  }
  if (hasDormantPieces) {
    evidencePoints.push(`Includes ${dormantMatches.length} dormant wardrobe piece(s) suitable for revival`);
  }
  if (positiveAffinityMatches.length > 0) {
    evidencePoints.push(`Matches your personal affinities (${positiveAffinityMatches.slice(0, 2).join(', ')})`);
  }
  if (thermalReason) {
    evidencePoints.push(thermalReason);
  }

  if (explicitAvoidanceConflict) {
    limitations.push('Trend conflicts with explicit user style avoidance (color/fabric/pattern/silhouette)');
    if (allowExplicitAvoidanceOverride) {
      limitations.push('Explicit user avoidance filter was temporarily overridden for this exploration request');
    }
  }
  if (learnedAffinityPenalty) {
    limitations.push('Features silhouettes or tones you have previously skipped');
  }
  if (missingSlotRoles.length > 0 && !canFormCompleteLook) {
    limitations.push(`Missing owned items for complete styling in: ${missingSlotRoles.join(', ')}`);
  }
  if (thermalSuitability === 'UNVERIFIED') {
    limitations.push('Weather context was unverified or unavailable');
  }

  return {
    trendId: trend.concept.id,
    classification,
    provenance: provenanceEvidence,
    provenanceAndTrust,
    freshness: freshnessEvidence,
    temporalFreshness,
    wardrobeCoverage: wardrobeCoverageEvidence,
    personalStyleAlignment: personalStyleAlignmentEvidence,
    culturalContext: culturalEvidence,
    culturalModestyContext,
    contextualFit: contextualFitEvidence,
    contextThermalFit,
    rotationOpportunity: rotationOpportunityEvidence,
    nonAuthoritativeDiscoveryScore,
    telemetryExplanation: {
      headline:
        classification === 'STRONG_DISCOVERY'
          ? 'Strong Match: You have all the pieces to explore this trend'
          : classification === 'WARDROBE_RELEVANT'
          ? 'Closet Compatible: You have key items that fit this style'
          : classification === 'STYLE_RELEVANT'
          ? 'Aesthetic Fit: Matches your preferred tones and silhouettes'
          : classification === 'NOT_RELEVANT'
          ? 'Not Recommended: Conflicts with your preferences or context'
          : 'Informational: Curated fashion trend',
      evidencePoints,
      limitations,
    },
    limitations,
  };
}

/**
 * Re-exports classification logic if needed.
 */
export function classifyTrendEvidence(evidence: TrendEvidence): DiscoveryClassification {
  return evidence.classification;
}
