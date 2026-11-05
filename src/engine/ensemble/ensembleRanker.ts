import {
  RecommendedOutfit,
  ScoreBreakdown,
  RecommendationExplanation,
  ExplanationEvidenceSource,
  Occasion,
  StylePreferences,
  PersonalStyleProfile,
  ContextSnapshot,
  WardrobeItem,
} from '../../types';
import { calculateOutfitDistance, DIVERSIFICATION_DISTANCE_THRESHOLD } from '../diversification';
import { computeWardrobeFingerprint, selectDeterministicExploreCandidate } from '../explorationModel';
import { buildEnsembleGraph } from './ensembleGraph';
import { evaluateEnsembleOutfit } from './outfitEvaluator';
import { GeneratedCandidateOutfit } from './candidateGenerator';
import { EnsembleGraph, OutfitEvaluationResult } from './types';

export interface RankCandidatesOptions {
  occasion: Occasion;
  season?: string;
  context?: ContextSnapshot;
  preferences?: StylePreferences;
  styleProfile?: PersonalStyleProfile;
  culturalSignals?: any;
  localDate: string;
  allowPlanningMode?: boolean;
  limit?: number;
  diversityThreshold?: number;
  explorationSeedOffset?: number;
  anchorItem?: WardrobeItem;
}

export interface RankedEnsemblePool {
  curatedOutfits: RecommendedOutfit[];
  evaluations: Record<string, OutfitEvaluationResult>;
  allRankedCandidates: {
    candidate: GeneratedCandidateOutfit;
    evaluation: OutfitEvaluationResult;
    graph: EnsembleGraph;
  }[];
}

/**
 * Builds a structured explanation object for an ensemble recommendation.
 */
function buildEnsembleExplanation(
  cand: GeneratedCandidateOutfit,
  evalResult: OutfitEvaluationResult,
  role: 'best_match' | 'alternative' | 'explore',
  occasion: Occasion,
  anchorItem?: WardrobeItem
): RecommendationExplanation {
  const evidenceSources: ExplanationEvidenceSource[] = ['compatibility'];
  const reasons: string[] = [];

  // Anchor explanation
  if (anchorItem) {
    reasons.push(`Anchored around your ${anchorItem.name} with coordinated pieces`);
  }

  // Add top evaluation bonuses
  if (evalResult.breakdown.bonusesApplied.length > 0) {
    reasons.push(...evalResult.breakdown.bonusesApplied.slice(0, 3));
  }

  // Cultural context
  if (evalResult.breakdown.culturalRegionalContext > 0.4) {
    evidenceSources.push('cultural');
  }

  // Personalization
  if (evalResult.breakdown.personalStyleFit > 0.1) {
    evidenceSources.push('personal_style');
  }

  // Weather comfort
  if (Math.abs(evalResult.breakdown.climateSeasonalFit) > 0.1) {
    evidenceSources.push('weather');
  }

  if (reasons.length === 0) {
    reasons.push(`Balanced ensemble coordinate for ${occasion}`);
  }

  return {
    headline:
      role === 'best_match'
        ? 'Best Ensemble Match'
        : role === 'alternative'
        ? 'Alternative Ensemble'
        : 'Curated Ensemble Exploration',
    reasons,
    evidenceSources: Array.from(new Set(evidenceSources)),
    confidenceLevel: evalResult.needsUserConfirmation ? 'MEDIUM' : 'HIGH',
    culturalRationale: evalResult.breakdown.bonusesApplied.find((b) => b.toLowerCase().includes('ethnic') || b.toLowerCase().includes('ceremonial') || b.toLowerCase().includes('fusion')),
  };
}

/**
 * Evaluates candidate ensemble outfits using the ensemble graph and holistic dimensions,
 * filters hard constraints, ranks deterministically, and curates diverse roles.
 */
export function rankEnsembleCandidates(
  candidates: GeneratedCandidateOutfit[],
  options: RankCandidatesOptions
): RankedEnsemblePool {
  const {
    occasion,
    season = 'summer',
    context,
    preferences,
    styleProfile,
    culturalSignals,
    localDate,
    allowPlanningMode = false,
    limit = 3,
    diversityThreshold = DIVERSIFICATION_DISTANCE_THRESHOLD,
    explorationSeedOffset = 0,
    anchorItem,
  } = options;

  const evaluations: Record<string, OutfitEvaluationResult> = {};
  const validPool: {
    candidate: GeneratedCandidateOutfit;
    evaluation: OutfitEvaluationResult;
    graph: EnsembleGraph;
  }[] = [];

  for (const cand of candidates) {
    const graph = buildEnsembleGraph(cand.pieces, {
      outfitId: cand.id,
      anchorItemId: cand.anchorItem?.id,
      occasion,
      season: season as any,
      context,
      preferences,
      styleProfile,
      allowPlanningMode,
    });

    const evalResult = evaluateEnsembleOutfit(graph, {
      occasion,
      season: season as any,
      context,
      preferences,
      styleProfile,
      culturalSignals,
      localDate,
      allowPlanningMode,
    });

    evaluations[cand.id] = evalResult;

    if (evalResult.isValid) {
      validPool.push({
        candidate: cand,
        evaluation: evalResult,
        graph,
      });
    }
  }

  // Deterministic sort:
  // 1. Total ensemble score descending
  // 2. Minimum pairwise edge score descending (higher floor / safety)
  // 3. Alphabetical tie-breaking by outfit ID
  validPool.sort((a, b) => {
    if (Math.abs(b.evaluation.score - a.evaluation.score) > 0.0001) {
      return b.evaluation.score - a.evaluation.score;
    }
    if (Math.abs(b.graph.minimumPairwiseScore - a.graph.minimumPairwiseScore) > 0.0001) {
      return b.graph.minimumPairwiseScore - a.graph.minimumPairwiseScore;
    }
    return a.candidate.id.localeCompare(b.candidate.id);
  });

  const curatedOutfits: RecommendedOutfit[] = [];

  if (validPool.length > 0) {
    // Role 1: BEST MATCH (Highest scoring candidate)
    const best = validPool[0];
    const bestExplanation = buildEnsembleExplanation(
      best.candidate,
      best.evaluation,
      'best_match',
      occasion,
      anchorItem
    );

    const bestBreakdown: ScoreBreakdown = {
      baseCompatibility: best.evaluation.breakdown.pairwiseEdgeAggregation,
      personalStyle: best.evaluation.breakdown.personalStyleFit,
      contextFit: best.evaluation.breakdown.climateSeasonalFit,
      culturalFit: best.evaluation.breakdown.culturalRegionalContext,
      noveltyBonus: best.evaluation.breakdown.wardrobeConditionRotation > 0 ? 0.3 : 0.0,
      penalty: best.evaluation.breakdown.wardrobeConditionRotation < 0 ? Math.abs(best.evaluation.breakdown.wardrobeConditionRotation) : 0.0,
      total: best.evaluation.score,
    };

    const bestMatchOutfit: RecommendedOutfit = {
      id: best.candidate.id,
      template: best.candidate.template.name,
      slots: best.candidate.slots,
      score: best.evaluation.score,
      role: 'best_match',
      scoreBreakdown: bestBreakdown,
      explanation: bestExplanation,
      why: bestExplanation.reasons.join(' · '),
    };
    curatedOutfits.push(bestMatchOutfit);

    // Role 2: ALTERNATIVE (Highest score with distance >= diversityThreshold from Best Match)
    let altMatch: (typeof validPool)[0] | null = null;
    for (let i = 1; i < validPool.length; i++) {
      const cand = validPool[i];
      const dist = calculateOutfitDistance(bestMatchOutfit, {
        slots: cand.candidate.slots,
        score: cand.evaluation.score,
      } as any);

      if (dist >= diversityThreshold) {
        altMatch = cand;
        break;
      }
    }

    let alternativeOutfit: RecommendedOutfit | null = null;
    if (altMatch) {
      const altExplanation = buildEnsembleExplanation(
        altMatch.candidate,
        altMatch.evaluation,
        'alternative',
        occasion,
        anchorItem
      );

      const altBreakdown: ScoreBreakdown = {
        baseCompatibility: altMatch.evaluation.breakdown.pairwiseEdgeAggregation,
        personalStyle: altMatch.evaluation.breakdown.personalStyleFit,
        contextFit: altMatch.evaluation.breakdown.climateSeasonalFit,
        culturalFit: altMatch.evaluation.breakdown.culturalRegionalContext,
        noveltyBonus: altMatch.evaluation.breakdown.wardrobeConditionRotation > 0 ? 0.3 : 0.0,
        penalty: altMatch.evaluation.breakdown.wardrobeConditionRotation < 0 ? Math.abs(altMatch.evaluation.breakdown.wardrobeConditionRotation) : 0.0,
        total: altMatch.evaluation.score,
      };

      alternativeOutfit = {
        id: altMatch.candidate.id,
        template: altMatch.candidate.template.name,
        slots: altMatch.candidate.slots,
        score: altMatch.evaluation.score,
        role: 'alternative',
        scoreBreakdown: altBreakdown,
        explanation: altExplanation,
        why: altExplanation.reasons.join(' · '),
      };
      curatedOutfits.push(alternativeOutfit);
    }

    // Role 3: EXPLORE (Controlled novelty inside safe preference boundary)
    const wardrobeFingerprint = computeWardrobeFingerprint(
      Array.from(new Set(candidates.flatMap((c) => c.pieces.map((p) => p.id))))
    );
    const deterministicSeedKey = `${localDate}|${occasion}|${wardrobeFingerprint}|v3-ensemble|${explorationSeedOffset}|${anchorItem?.id || ''}`;

    const candidatePoolForExplore = validPool.map((v) => ({
      id: v.candidate.id,
      template: v.candidate.template.name,
      slots: v.candidate.slots,
      score: v.evaluation.score,
      scoreBreakdown: {
        baseCompatibility: v.evaluation.breakdown.pairwiseEdgeAggregation,
        personalStyle: v.evaluation.breakdown.personalStyleFit,
        contextFit: v.evaluation.breakdown.climateSeasonalFit,
        culturalFit: v.evaluation.breakdown.culturalRegionalContext,
        noveltyBonus: 0.3,
        penalty: 0.0,
        total: v.evaluation.score,
      },
      why: '',
      pieces: v.candidate.pieces,
    }));

    const exploreCandidate = selectDeterministicExploreCandidate(
      candidatePoolForExplore,
      bestMatchOutfit,
      alternativeOutfit,
      deterministicSeedKey,
      occasion,
      styleProfile,
      preferences,
      context
    );

    if (exploreCandidate) {
      const matchedValid = validPool.find((v) => v.candidate.id === exploreCandidate.id);
      if (matchedValid) {
        const expExplanation = buildEnsembleExplanation(
          matchedValid.candidate,
          matchedValid.evaluation,
          'explore',
          occasion,
          anchorItem
        );

        const exploreOutfit: RecommendedOutfit = {
          id: exploreCandidate.id,
          template: exploreCandidate.template,
          slots: exploreCandidate.slots,
          score: matchedValid.evaluation.score,
          role: 'explore',
          scoreBreakdown: matchedValid.candidate ? {
            baseCompatibility: matchedValid.evaluation.breakdown.pairwiseEdgeAggregation,
            personalStyle: matchedValid.evaluation.breakdown.personalStyleFit,
            contextFit: matchedValid.evaluation.breakdown.climateSeasonalFit,
            culturalFit: matchedValid.evaluation.breakdown.culturalRegionalContext,
            noveltyBonus: 0.3,
            penalty: 0.0,
            total: matchedValid.evaluation.score,
          } : exploreCandidate.scoreBreakdown,
          explanation: expExplanation,
          why: expExplanation.reasons.join(' · '),
        };
        curatedOutfits.push(exploreOutfit);
      }
    }
  }

  return {
    curatedOutfits: curatedOutfits.slice(0, limit),
    evaluations,
    allRankedCandidates: validPool,
  };
}
