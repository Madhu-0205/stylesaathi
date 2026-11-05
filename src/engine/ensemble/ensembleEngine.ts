import {
  RecommendationRequest,
  RecommendationResultWithTelemetry,
  RecommendedOutfit,
  RecommendationPipelineTelemetry,
} from '../../types';
import { RecommendationEngine } from '../recommendationEngine';
import { calculateOutfitDistance } from '../diversification';
import { generateEnsembleCandidates } from './candidateGenerator';
import { rankEnsembleCandidates } from './ensembleRanker';
import {
  EnsembleRecommendationOptions,
  EnsembleRecommendationResult,
  RecommendationComparisonTelemetry,
} from './types';

/**
 * StyleSaathi 3.0 — Outfit Composition Engine & Ensemble Graph Re-ranker
 *
 * Implements full ensemble graph construction, non-compensatory edge aggregation,
 * holistic outfit-level balance dimensions (A through J), anchor locking,
 * and deterministic diverse curation.
 */
export class EnsembleRecommendationEngine {
  readonly version = '3.0.0-ensemble';
  private baselineEngine = new RecommendationEngine();

  public recommend(
    request: RecommendationRequest,
    options: {
      allowPlanningMode?: boolean;
      compareWithBaseline?: boolean;
      diversityThreshold?: number;
    } = {}
  ): EnsembleRecommendationResult {
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    const {
      items,
      occasion,
      season,
      localDate,
      explorationSeedOffset = 0,
      preferences,
      styleProfile,
      context,
      culturalSignals,
      limit = 3,
      anchorItemId,
    } = request;

    const {
      allowPlanningMode = false,
      compareWithBaseline = false,
      diversityThreshold = 0.35,
    } = options;

    const anchorItem = anchorItemId ? items.find((i) => i.id === anchorItemId) : undefined;

    // 1. Candidate Generation
    const tGen0 = typeof performance !== 'undefined' ? performance.now() : 0;
    const candidates = generateEnsembleCandidates(items, {
      anchor: anchorItem
        ? {
            item: anchorItem,
            role: 'top',
            isLocked: true,
            origin: 'user_selected',
          }
        : undefined,
      occasion,
      season,
      context,
      preferences,
      styleProfile,
      culturalSignals,
      allowPlanningMode,
      maxCandidates: 300,
    });
    const tGen1 = typeof performance !== 'undefined' ? performance.now() : 0;

    // 2. Graph Construction, Holistic Evaluation & Ranking
    const tRank0 = typeof performance !== 'undefined' ? performance.now() : 0;
    const { curatedOutfits, evaluations, allRankedCandidates } = rankEnsembleCandidates(
      candidates,
      {
        occasion,
        season,
        context,
        preferences,
        styleProfile,
        culturalSignals,
        localDate,
        allowPlanningMode,
        limit,
        diversityThreshold,
        explorationSeedOffset,
        anchorItem,
      }
    );
    const tRank1 = typeof performance !== 'undefined' ? performance.now() : 0;

    // 3. Side-by-Side Comparison with Baseline (when requested)
    let comparisonTelemetry: RecommendationComparisonTelemetry | undefined;

    if (compareWithBaseline) {
      const baselineResult = this.baselineEngine.recommend(request);
      const baselineTop = baselineResult.set.outfits[0];
      const ensembleTop = curatedOutfits[0];

      let weakestEdgeClashesCaught = 0;
      let colorChaosPrevented = 0;
      let formalitySpreadViolationsPrevented = 0;

      // Inspect how baseline candidates would perform on ensemble graph
      for (const bOutfit of baselineResult.set.outfits) {
        const evalKey = bOutfit.id;
        const bEval = evaluations[evalKey];
        if (bEval) {
          if (bEval.graph.minimumPairwiseScore < 5.0) weakestEdgeClashesCaught++;
          if (bEval.breakdown.colorBalance < -0.5) colorChaosPrevented++;
          if (bEval.breakdown.formalityConsistency < -0.5) formalitySpreadViolationsPrevented++;
        }
      }

      const diversityDist =
        baselineTop && ensembleTop
          ? calculateOutfitDistance(baselineTop, ensembleTop)
          : 0.0;

      comparisonTelemetry = {
        baselineTopScore: baselineTop ? baselineTop.score : 0.0,
        ensembleTopScore: ensembleTop ? ensembleTop.score : 0.0,
        scoreDelta: ensembleTop && baselineTop ? ensembleTop.score - baselineTop.score : 0.0,
        hardConstraintViolationsPrevented: 0,
        weakestEdgeClashesCaught,
        colorChaosPrevented,
        formalitySpreadViolationsPrevented,
        diversityDistance: diversityDist,
      };
    }

    const tEnd = typeof performance !== 'undefined' ? performance.now() : 0;

    const telemetry: RecommendationPipelineTelemetry = {
      candidateCount: candidates.length,
      validCandidateCount: allRankedCandidates.length,
      timings: {
        candidateGenerationMs: Math.max(0, tGen1 - tGen0),
        hardFilteringMs: 0,
        compatibilityMs: 0,
        scoringMs: Math.max(0, tRank1 - tRank0),
        diversificationMs: 0,
        totalMs: Math.max(0, tEnd - t0),
      },
    };

    return {
      outfits: curatedOutfits,
      evaluations,
      telemetry,
      comparisonTelemetry,
      allRankedCandidates,
    };
  }
}

/**
 * Functional wrapper for direct ensemble outfit recommendations.
 */
export function recommendEnsembleOutfits(
  request: RecommendationRequest,
  options?: {
    allowPlanningMode?: boolean;
    compareWithBaseline?: boolean;
    diversityThreshold?: number;
  }
): RecommendedOutfit[] {
  const engine = new EnsembleRecommendationEngine();
  return engine.recommend(request, options).outfits;
}
