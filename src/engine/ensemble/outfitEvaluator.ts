import {
  WardrobeItem,
  Occasion,
  Season,
  ContextSnapshot,
  StylePreferences,
  PersonalStyleProfile,
  CulturalContextSignals,
} from '../../types';
import { seasonFit } from '../compatibility';
import { calculateWeatherComfortScore } from '../contextScoring';
import { evaluateMicroclimateAdaptation } from './microclimateAdapter';
import { EnsembleGraph, OutfitEvaluationBreakdown, OutfitEvaluationResult } from './types';

const OCCASION_FORMALITY_TARGETS: Record<string, number> = {
  college: 1.8,
  school: 1.8,
  everyday: 2.0,
  'casual outing': 2.2,
  travel: 2.0,
  'family gathering': 3.2,
  puja: 3.6,
  date: 3.2,
  party: 3.8,
  office: 3.8,
  'family function': 4.0,
  festive: 4.2,
  Diwali: 4.3,
  Eid: 4.3,
  Holi: 2.2,
  interview: 4.5,
  engagement: 4.4,
  celebration: 4.6,
  'wedding guest': 4.8,
};

const NEUTRAL_COLORS = new Set<string>([
  'black',
  'white',
  'cream',
  'beige',
  'navy',
  'brown',
  'tan',
  'grey',
  'gray',
  'silver',
  'gold',
  'off-white',
  'charcoal',
  'khaki',
  'ivory',
  'ecru',
]);

const STATEMENT_PATTERNS = new Set<string>([
  'floral',
  'geometric',
  'abstract',
  'brocade',
  'zari_brocade',
  'animal',
  'bandhani',
  'ajrakh',
  'ikat',
  'kalamkari',
  'paisley',
  'polka_dots',
  'plaid',
  'embroidered',
]);

const PUJA_AUSPICIOUS_COLORS = new Set<string>([
  'yellow',
  'mustard',
  'saffron',
  'orange',
  'red',
  'maroon',
  'gold',
  'cream',
  'white',
]);

export interface EvaluateOutfitOptions {
  occasion?: Occasion;
  season?: Season;
  context?: ContextSnapshot;
  preferences?: StylePreferences;
  styleProfile?: PersonalStyleProfile;
  culturalSignals?: CulturalContextSignals;
  localDate?: string;
  allowPlanningMode?: boolean;
}

/**
 * Evaluates a complete ensemble graph across holistic outfit dimensions (A through J).
 * Combines role-weighted pairwise edge aggregation with whole-outfit visual balance.
 */
export function evaluateEnsembleOutfit(
  graph: EnsembleGraph,
  options: EvaluateOutfitOptions = {}
): OutfitEvaluationResult {
  const {
    occasion = 'everyday',
    season = 'summer',
    context,
    preferences,
    styleProfile,
    culturalSignals,
    localDate,
    allowPlanningMode = false,
  } = options;

  const pieces = graph.nodes.map((n) => n.item);
  const explanations: string[] = [];
  const uncertaintyNotes: string[] = [];
  const penaltiesApplied: string[] = [];
  const bonusesApplied: string[] = [];

  // Propagate node uncertainty
  let needsUserConfirmation = false;
  for (const node of graph.nodes) {
    if (node.needsUserConfirmation) {
      needsUserConfirmation = true;
      uncertaintyNotes.push(...node.uncertaintyNotes);
    }
  }

  // 1. Hard Non-Compensatory Short-Circuit
  if (graph.hasHardIncompatibility) {
    return {
      outfitId: graph.outfitId,
      isValid: false,
      classification: 'hard_incompatible',
      score: 0.0,
      breakdown: {
        individualSuitability: 0.0,
        pairwiseEdgeAggregation: 0.0,
        colorBalance: 0.0,
        patternTextureDistribution: 0.0,
        silhouetteProportionBalance: 0.0,
        formalityConsistency: 0.0,
        climateSeasonalFit: 0.0,
        culturalRegionalContext: 0.0,
        personalStyleFit: 0.0,
        wardrobeConditionRotation: 0.0,
        totalScore: 0.0,
        penaltiesApplied: graph.hardIncompatibilityReasons,
        bonusesApplied: [],
      },
      graph,
      explanations: graph.hardIncompatibilityReasons,
      uncertaintyNotes,
      needsUserConfirmation,
    };
  }

  // ==========================================================================
  // DIMENSION A: INDIVIDUAL GARMENT SUITABILITY
  // ==========================================================================
  let individualSuitability = 0.0;
  for (const item of pieces) {
    // StyleSaathi 4.0.2 (P2-B): only verified season mismatches incur penalty.
    // Unknown / missing season metadata (null) remains neutral.
    if (seasonFit(item, season) === false) {
      individualSuitability -= 0.35;
      penaltiesApplied.push(`"${item.name}" is out of season for ${season}.`);
    }
  }

  // ==========================================================================
  // DIMENSION B: PAIRWISE EDGE AGGREGATION & WEAKEST LINK
  // ==========================================================================
  // Start from role-weighted pairwise score (0.0 to 10.0 scale)
  let pairwiseEdgeAggregation = graph.weightedPairwiseScore;

  // Weakest Link Penalty: a single catastrophic clash (e.g. edge score < 5.0)
  // ruins the ensemble and cannot be compensated by other high-scoring pairs
  if (graph.minimumPairwiseScore < 5.0 && graph.edgeCount > 0) {
    const weakestDeficit = (5.0 - graph.minimumPairwiseScore) * 0.75;
    pairwiseEdgeAggregation = Math.max(0.0, pairwiseEdgeAggregation - weakestDeficit);
    penaltiesApplied.push(
      `Weakest link penalty: clash between items in ${graph.weakestEdge?.pairType || 'pair'} (${graph.minimumPairwiseScore.toFixed(1)}/10).`
    );
  } else if (graph.minimumPairwiseScore >= 7.5 && graph.edgeCount >= 2) {
    bonusesApplied.push('High pairwise consistency across all garment pairings.');
  }

  // ==========================================================================
  // DIMENSION C: WHOLE-OUTFIT COLOUR BALANCE
  // ==========================================================================
  let colorBalance = 0.0;
  const allColors = pieces.flatMap((p) => p.colors || []).map((c) => c.toLowerCase());
  const uniqueColors = Array.from(new Set(allColors));
  const nonNeutralColors = uniqueColors.filter((c) => !NEUTRAL_COLORS.has(c));

  // 1. Neutral grounding
  const hasNeutralAnchor = pieces.some((p) =>
    (p.colors || []).some((c) => NEUTRAL_COLORS.has(c.toLowerCase()))
  );
  if (hasNeutralAnchor && nonNeutralColors.length > 0) {
    colorBalance += 0.3;
    bonusesApplied.push('Grounded palette: neutral anchor balances accent colors.');
  }

  // 2. Color count discipline
  if (nonNeutralColors.length === 1) {
    colorBalance += 0.35;
    bonusesApplied.push(`Focused palette centered on ${nonNeutralColors[0]}.`);
  } else if (nonNeutralColors.length === 2) {
    colorBalance += 0.3;
    bonusesApplied.push(`Two-tone coordinate: ${nonNeutralColors[0]} and ${nonNeutralColors[1]}.`);
  } else if (nonNeutralColors.length >= 4) {
    colorBalance -= 0.65;
    penaltiesApplied.push(
      `Color chaos: ${nonNeutralColors.length} competing accent colors without a dominant hue.`
    );
  }

  // 3. Monochromatic / tonal harmony
  if (nonNeutralColors.length === 1 && pieces.length >= 2 && !hasNeutralAnchor) {
    colorBalance += 0.4;
    bonusesApplied.push(`Monochromatic harmony in tonal ${nonNeutralColors[0]}.`);
  }

  // ==========================================================================
  // DIMENSION D: PATTERN & TEXTURE DISTRIBUTION
  // ==========================================================================
  let patternTextureDistribution = 0.0;
  const statementPatternItems = pieces.filter((p) =>
    p.pattern && STATEMENT_PATTERNS.has(p.pattern.toLowerCase())
  );

  if (statementPatternItems.length === 1 && pieces.length >= 2) {
    patternTextureDistribution += 0.4;
    bonusesApplied.push(
      `Rule of One Statement: ${statementPatternItems[0].name} print anchored by solid pieces.`
    );
  } else if (statementPatternItems.length >= 2) {
    patternTextureDistribution -= 0.7;
    penaltiesApplied.push(
      `Pattern clutter: multiple competing statement prints (${statementPatternItems.map((i) => i.pattern).join(', ')}).`
    );
  } else if (statementPatternItems.length === 0 && pieces.length >= 2) {
    patternTextureDistribution += 0.25;
    bonusesApplied.push('Clean minimalist coordinate: solid textures throughout.');
  }

  // ==========================================================================
  // DIMENSION E: SILHOUETTE & PROPORTION BALANCE
  // ==========================================================================
  let silhouetteProportionBalance = 0.0;
  const tops = pieces.filter((p) => p.category === 'Tops' || (p.category === 'Ethnic' && ['kurta', 'kurti', 'blouse'].includes((p.subcategory || '').toLowerCase())));
  const bottoms = pieces.filter((p) => p.category === 'Bottoms' || (p.category === 'Ethnic' && ['churidar', 'palazzo', 'salwar'].includes((p.subcategory || '').toLowerCase())));

  if (tops.length > 0 && bottoms.length > 0) {
    const topFit = (tops[0].fit || 'regular').toLowerCase();
    const bottomFit = (bottoms[0].fit || 'regular').toLowerCase();

    const isTopFitted = topFit === 'fitted' || topFit === 'slim';
    const isTopRelaxed = topFit === 'relaxed' || topFit === 'oversized' || topFit === 'loose';
    const isBottomFitted = bottomFit === 'fitted' || bottomFit === 'slim';
    const isBottomRelaxed = bottomFit === 'relaxed' || bottomFit === 'wide' || bottomFit === 'flared' || bottomFit === 'oversized';

    if ((isTopFitted && isBottomRelaxed) || (isTopRelaxed && isBottomFitted)) {
      silhouetteProportionBalance += 0.35;
      bonusesApplied.push('Proportional equilibrium: balanced volume between upper and lower silhouettes.');
    } else if (isTopRelaxed && isBottomRelaxed) {
      const prefersRelaxedAesthetic =
        preferences?.preferredAesthetics?.some((a) =>
          ['streetwear', 'korean_aesthetic', 'casual', 'minimalist'].includes(a.toLowerCase())
        );
      if (prefersRelaxedAesthetic) {
        silhouetteProportionBalance += 0.4;
        bonusesApplied.push('Intentional relaxed volume: draped silhouette aligned with aesthetic preference.');
      } else {
        silhouetteProportionBalance -= 2.0;
        penaltiesApplied.push('Volume collision: dual oversized garments create an unstructured silhouette.');
      }
    }
  }

  // ==========================================================================
  // DIMENSION F: FORMALITY & OCCASION CONSISTENCY
  // ==========================================================================
  let formalityConsistency = 0.0;
  const formalities = pieces.map((p) => p.formality ?? 2.5);
  const minFormality = Math.min(...formalities);
  const maxFormality = Math.max(...formalities);
  const formalitySpread = maxFormality - minFormality;
  const avgFormality = formalities.reduce((a, b) => a + b, 0) / formalities.length;
  const targetFormality = OCCASION_FORMALITY_TARGETS[occasion] ?? 2.5;

  // 1. Formality spread across garments
  if (formalitySpread <= 1.0) {
    formalityConsistency += 0.3;
    bonusesApplied.push('Cohesive formality across all garments.');
  } else if (formalitySpread >= 2.5) {
    formalityConsistency -= 0.75;
    penaltiesApplied.push(
      `Severe formality dissonance: span of ${formalitySpread.toFixed(1)} levels between pieces.`
    );
  }

  // 2. Occasion alignment
  const occasionDelta = Math.abs(avgFormality - targetFormality);
  if (occasionDelta <= 0.6) {
    formalityConsistency += 0.35;
    bonusesApplied.push(`Formality (${avgFormality.toFixed(1)}) aligns closely with ${occasion}.`);
  } else if (occasionDelta >= 1.5) {
    formalityConsistency -= 0.5;
    penaltiesApplied.push(
      `Outfit formality (${avgFormality.toFixed(1)}) diverges from ${occasion} expectation (${targetFormality.toFixed(1)}).`
    );
  }

  // ==========================================================================
  // DIMENSION G: CLIMATE & MICROCLIMATE ADAPTATION (STYLESAATHI 3.0 PHASE 5B)
  // ==========================================================================
  let climateSeasonalFit = 0.0;
  const microclimate = evaluateMicroclimateAdaptation(pieces, {
    occasion,
    season,
    context,
    preferences,
  });

  climateSeasonalFit = microclimate.scoreDelta;
  if (microclimate.reasons.length > 0) {
    bonusesApplied.push(...microclimate.reasons);
  }
  if (microclimate.warnings.length > 0) {
    penaltiesApplied.push(...microclimate.warnings);
  }

  // ==========================================================================
  // DIMENSION H: CULTURAL & REGIONAL CONTEXT
  // ==========================================================================
  let culturalRegionalContext = 0.0;
  const subs = pieces.map((p) => (p.subcategory || '').toLowerCase());

  // 1. Authentic Traditional Indian Ensembles
  if (subs.includes('saree') && subs.includes('blouse')) {
    culturalRegionalContext += 0.8;
    bonusesApplied.push('Authentic ethnic drape: coordinated Saree and tailored blouse.');
  } else if (subs.includes('lehenga') && subs.includes('blouse')) {
    culturalRegionalContext += 0.85;
    bonusesApplied.push('Ceremonial coordinate: Lehenga skirt paired with choli.');
  } else if (subs.includes('sherwani') && (subs.includes('churidar') || subs.includes('pajama'))) {
    culturalRegionalContext += 0.9;
    bonusesApplied.push('Regal ceremonial ensemble: Sherwani tailored with traditional churidar.');
  } else if (subs.includes('kurta') && (subs.includes('churidar') || subs.includes('palazzo') || subs.includes('salwar'))) {
    culturalRegionalContext += 0.7;
    bonusesApplied.push('Classic ethnic coordinate: Kurta with complementary ethnic bottom.');
  } else if ((subs.includes('kurti') || subs.includes('kurta')) && subs.includes('jeans')) {
    culturalRegionalContext += 0.65;
    bonusesApplied.push('Indo-Western fusion bridge: everyday kurti paired with denim.');
  }

  // 2. Puja & Sacred Ritual Decorum
  if (occasion === 'puja') {
    const hasAuspiciousColor = allColors.some((c) => PUJA_AUSPICIOUS_COLORS.has(c));
    const hasSomberBlack = allColors.includes('black');

    if (hasAuspiciousColor && !hasSomberBlack) {
      culturalRegionalContext += 0.4;
      bonusesApplied.push('Devotional decorum: auspicious traditional color palette for Puja.');
    } else if (hasSomberBlack) {
      culturalRegionalContext -= 0.6;
      penaltiesApplied.push('Devotional decorum: somber black is inauspicious for sacred Puja ceremonies.');
    }
  }

  // ==========================================================================
  // DIMENSION I: PERSONAL STYLE PREFERENCES (BAYESIAN PROFILE)
  // ==========================================================================
  let personalStyleFit = 0.0;
  if (styleProfile) {
    for (const color of allColors) {
      const affinity = styleProfile.colorAffinities?.[color];
      if (affinity && affinity.sampleCount >= 2) {
        const delta = (affinity.score - 0.5) * 0.1;
        personalStyleFit += delta;
      }
    }
    // Dampen personalization to safe bounds [-0.35, +0.35] to prevent overfitting
    personalStyleFit = Math.max(-0.35, Math.min(0.35, personalStyleFit));
    if (personalStyleFit > 0.1) {
      bonusesApplied.push('Tailored to your established personal color preferences.');
    }
  }

  // ==========================================================================
  // DIMENSION J: WARDROBE AVAILABILITY & ROTATION
  // ==========================================================================
  let wardrobeConditionRotation = 0.0;
  const refTime = localDate ? new Date(localDate).getTime() : Date.now();

  for (const item of pieces) {
    // Recency wear penalty: worn in last 24h
    if (item.lastWorn && Math.abs(refTime - item.lastWorn) < 24 * 3600 * 1000) {
      wardrobeConditionRotation -= 0.7;
      penaltiesApplied.push(`"${item.name}" was worn recently within 24 hours.`);
    }

    // Wear frequency penalty to encourage rotation
    if ((item.timesWorn || 0) >= 5) {
      wardrobeConditionRotation -= 0.1;
    }

    // Novelty bonus for unworn/fresh items
    if ((item.timesWorn || 0) === 0) {
      wardrobeConditionRotation += 0.2;
      bonusesApplied.push(`Wardrobe novelty: styles unworn piece "${item.name}".`);
    }
  }

  // ==========================================================================
  // TOTAL SCORE CALCULATION & CALIBRATION
  // ==========================================================================
  const holisticDeltas =
    individualSuitability +
    colorBalance +
    patternTextureDistribution +
    silhouetteProportionBalance +
    formalityConsistency +
    climateSeasonalFit +
    culturalRegionalContext +
    personalStyleFit +
    wardrobeConditionRotation;

  // Base score from pairwise edge aggregation
  let rawTotal = pairwiseEdgeAggregation + holisticDeltas;

  // Clamping to [0.0, 10.0]
  let totalScore = Math.max(0.0, Math.min(10.0, rawTotal));

  // Non-compensatory cap if weakest edge is severely clashing (< 4.0) or severe formality dissonance
  if (graph.minimumPairwiseScore < 4.0 || formalitySpread >= 2.5) {
    totalScore = Math.min(totalScore, 4.5);
  }

  // Non-compensatory cap if silhouette has an unanchored volume collision (<= -1.5)
  if (silhouetteProportionBalance <= -1.5) {
    totalScore = Math.min(totalScore, 5.8);
  }

  // Uncertainty shrinkage toward neutral prior mean (5.0 / 10.0):
  // When an ensemble contains unverified AI tags or missing core attributes,
  // do not allow it to claim high certainty or high compatibility.
  let classification: OutfitEvaluationResult['classification'] = 'compatible';
  if (needsUserConfirmation) {
    totalScore = 5.0 + (totalScore - 5.0) * 0.2;
    totalScore = Math.max(4.5, Math.min(5.5, totalScore));
    classification = 'neutral';
  } else {
    // Determine classification
    if (totalScore >= 8.0) {
      classification = 'highly_compatible';
    } else if (totalScore >= 6.0) {
      classification = 'compatible';
    } else if (totalScore >= 4.8) {
      classification = 'neutral';
    } else {
      classification = 'clashing';
    }
  }

  // Compile explanations
  if (bonusesApplied.length > 0) {
    explanations.push(bonusesApplied.slice(0, 3).join(' · '));
  }
  if (penaltiesApplied.length > 0) {
    explanations.push(penaltiesApplied.slice(0, 2).join(' · '));
  }

  const breakdown: OutfitEvaluationBreakdown = {
    individualSuitability,
    pairwiseEdgeAggregation,
    colorBalance,
    patternTextureDistribution,
    silhouetteProportionBalance,
    formalityConsistency,
    climateSeasonalFit,
    culturalRegionalContext,
    personalStyleFit,
    wardrobeConditionRotation,
    totalScore,
    penaltiesApplied,
    bonusesApplied,
  };

  return {
    outfitId: graph.outfitId,
    isValid: true,
    classification,
    score: totalScore,
    breakdown,
    graph,
    explanations,
    uncertaintyNotes,
    needsUserConfirmation,
  };
}
