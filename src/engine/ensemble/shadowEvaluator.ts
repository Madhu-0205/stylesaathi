import {
  RecommendationRequest,
  RecommendationResultWithTelemetry,
  RecommendedOutfit,
  WardrobeItem,
} from '../../types';
import { EnsembleRecommendationEngine } from './ensembleEngine';
import { buildEnsembleGraph } from './ensembleGraph';
import { evaluateEnsembleOutfit } from './outfitEvaluator';
import {
  ShadowComparisonReport,
  ShadowCandidateOverlap,
  ShadowRankingDifferences,
  ShadowAnchorPreservation,
  ShadowHardConstraintViolations,
  ShadowUnknownAttributeHandling,
  ShadowCulturalContextualConsistency,
  ShadowExecutionLatency,
} from './types';

// ============================================================================
// SHADOW STATE & CONFIGURATION
// ============================================================================

let shadowEvaluationEnabled = true;
let isExecutingShadow = false;
const SHADOW_HISTORY_MAX = 50;
const shadowHistory: ShadowComparisonReport[] = [];

/**
 * Returns whether shadow ensemble evaluation is currently enabled.
 */
export function isShadowEvaluationEnabled(): boolean {
  return shadowEvaluationEnabled;
}

/**
 * Enables or disables shadow ensemble evaluation.
 */
export function setShadowEvaluationEnabled(enabled: boolean): void {
  shadowEvaluationEnabled = enabled;
}

/**
 * Returns the most recent shadow comparison report, or null if none recorded.
 */
export function getLastShadowComparison(): ShadowComparisonReport | null {
  return shadowHistory[0] || null;
}

/**
 * Returns recent shadow comparison history (up to limit).
 */
export function getShadowComparisonHistory(limit = 10): ShadowComparisonReport[] {
  return shadowHistory.slice(0, limit);
}

/**
 * Clears the in-memory shadow comparison ring buffer.
 */
export function clearShadowComparisonHistory(): void {
  shadowHistory.length = 0;
}

// ============================================================================
// HELPER FUNCTIONS FOR COMPARISON DIMENSIONS
// ============================================================================

function extractGarmentIds(outfits: RecommendedOutfit[]): Set<string> {
  const ids = new Set<string>();
  for (const o of outfits) {
    if (!o.slots) continue;
    for (const pieces of Object.values(o.slots)) {
      if (Array.isArray(pieces)) {
        for (const p of pieces) {
          if (p && p.id) ids.add(p.id);
        }
      }
    }
  }
  return ids;
}

function extractAllPieces(outfit: RecommendedOutfit): WardrobeItem[] {
  if (!outfit.slots) return [];
  return Object.values(outfit.slots).flat().filter(Boolean);
}

function getPieceSignature(pieces: WardrobeItem[]): string {
  return pieces
    .map((p) => p.id)
    .sort()
    .join('+');
}

// ============================================================================
// SHADOW EVALUATOR EXECUTION
// ============================================================================

/**
 * StyleSaathi 3.0 — Phase 5A: Shadow Evaluator
 *
 * Runs the ensemble recommendation engine alongside baseline recommendation,
 * comparing candidate overlap, ranking differences, anchor preservation,
 * hard-constraint violations, unknown-attribute handling, cultural consistency,
 * and execution latency.
 *
 * GUARANTEES:
 * 1. Strictly non-invasive: Does not alter or mutate baselineResult or request.
 * 2. Fault-isolated: All ensemble operations are safely enclosed; errors return null.
 * 3. Re-entrancy safe: Prevents recursive execution.
 * 4. Zero PII: Retains only anonymized IDs, scores, and categorical metrics.
 */
export function executeShadowEvaluation(
  baselineResult: RecommendationResultWithTelemetry,
  request: RecommendationRequest
): ShadowComparisonReport | null {
  if (!shadowEvaluationEnabled || isExecutingShadow) {
    return null;
  }

  const tStart = typeof performance !== 'undefined' ? performance.now() : 0;
  isExecutingShadow = true;

  try {
    const ensembleEngine = new EnsembleRecommendationEngine();
    const ensembleResult = ensembleEngine.recommend(request, {
      compareWithBaseline: false,
    });

    const baselineOutfits = baselineResult.set.outfits || [];
    const ensembleOutfits = ensembleResult.outfits || [];

    // ------------------------------------------------------------------------
    // 1. Candidate Overlap
    // ------------------------------------------------------------------------
    const baselineIds = baselineOutfits.map((o) => o.id);
    const ensembleIds = ensembleOutfits.map((o) => o.id);
    const sharedTopCandidateIds = baselineIds.filter((id) => ensembleIds.includes(id));

    const baseGarmentIds = extractGarmentIds(baselineOutfits);
    const ensGarmentIds = extractGarmentIds(ensembleOutfits);

    let intersectionCount = 0;
    for (const gid of baseGarmentIds) {
      if (ensGarmentIds.has(gid)) intersectionCount++;
    }
    const unionCount = new Set([...baseGarmentIds, ...ensGarmentIds]).size;
    const topPickJaccardOverlap =
      unionCount > 0 ? Math.round((intersectionCount / unionCount) * 1000) / 1000 : 1.0;

    // Search for baseline top pick in ensemble candidate rankings
    let baselineTopInEnsembleRank = -1;
    if (baselineOutfits.length > 0 && ensembleResult.allRankedCandidates) {
      const topBaseSig = getPieceSignature(extractAllPieces(baselineOutfits[0]));
      const topBaseId = baselineOutfits[0].id;
      for (let i = 0; i < ensembleResult.allRankedCandidates.length; i++) {
        const item = ensembleResult.allRankedCandidates[i];
        if (
          item.candidate.id === topBaseId ||
          getPieceSignature(item.candidate.pieces) === topBaseSig
        ) {
          baselineTopInEnsembleRank = i + 1;
          break;
        }
      }
    }

    // Search for ensemble top pick in baseline results
    let ensembleTopInBaselineRank = -1;
    if (ensembleOutfits.length > 0) {
      const topEnsSig = getPieceSignature(extractAllPieces(ensembleOutfits[0]));
      const topEnsId = ensembleOutfits[0].id;
      for (let i = 0; i < baselineOutfits.length; i++) {
        const b = baselineOutfits[i];
        if (b.id === topEnsId || getPieceSignature(extractAllPieces(b)) === topEnsSig) {
          ensembleTopInBaselineRank = i + 1;
          break;
        }
      }
    }

    const candidateOverlap: ShadowCandidateOverlap = {
      baselineCount: baselineResult.telemetry.validCandidateCount,
      ensembleCount: ensembleResult.telemetry.validCandidateCount,
      sharedTopCandidateIds,
      topPickJaccardOverlap,
      baselineTopInEnsembleRank: baselineTopInEnsembleRank > 0 ? baselineTopInEnsembleRank : undefined,
      ensembleTopInBaselineRank: ensembleTopInBaselineRank > 0 ? ensembleTopInBaselineRank : undefined,
    };

    // ------------------------------------------------------------------------
    // 2. Ranking Differences
    // ------------------------------------------------------------------------
    const baselineTopScore = baselineOutfits[0]?.score ?? 0;
    const ensembleTopScore = ensembleOutfits[0]?.score ?? 0;
    const scoreDelta = Math.round((ensembleTopScore - baselineTopScore) * 1000) / 1000;

    let rankInversionsCount = 0;
    if (sharedTopCandidateIds.length >= 2) {
      for (let i = 0; i < sharedTopCandidateIds.length; i++) {
        for (let j = i + 1; j < sharedTopCandidateIds.length; j++) {
          const idA = sharedTopCandidateIds[i];
          const idB = sharedTopCandidateIds[j];
          const bIndexA = baselineIds.indexOf(idA);
          const bIndexB = baselineIds.indexOf(idB);
          const eIndexA = ensembleIds.indexOf(idA);
          const eIndexB = ensembleIds.indexOf(idB);
          if ((bIndexA < bIndexB && eIndexA > eIndexB) || (bIndexA > bIndexB && eIndexA < eIndexB)) {
            rankInversionsCount++;
          }
        }
      }
    }

    let rankingExplanation = 'Baseline and ensemble engines agreed on top recommendation ordering.';
    if (baselineOutfits[0] && ensembleOutfits[0] && baselineOutfits[0].id !== ensembleOutfits[0].id) {
      rankingExplanation = `Ensemble elevated alternative candidate (score ${ensembleTopScore.toFixed(
        2
      )}) over baseline top candidate (score ${baselineTopScore.toFixed(
        2
      )}) via whole-outfit graph evaluation and balance criteria.`;
    } else if (scoreDelta !== 0) {
      rankingExplanation = `Top candidate IDs matched, with score calibration delta of ${scoreDelta.toFixed(
        2
      )} points.`;
    }

    const rankingDifferences: ShadowRankingDifferences = {
      baselineTopScore,
      ensembleTopScore,
      scoreDelta,
      rankInversionsCount,
      explanation: rankingExplanation,
    };

    // ------------------------------------------------------------------------
    // 3. Anchor Preservation
    // ------------------------------------------------------------------------
    const anchorId = request.anchorItemId;
    let baselinePreserved = true;
    let ensemblePreserved = true;

    if (anchorId) {
      baselinePreserved =
        baselineOutfits.length > 0 &&
        baselineOutfits.every((o) =>
          extractAllPieces(o).some((p) => p.id === anchorId)
        );
      ensemblePreserved =
        ensembleOutfits.length > 0 &&
        ensembleOutfits.every((o) =>
          extractAllPieces(o).some((p) => p.id === anchorId)
        );
    }

    const anchorPreservation: ShadowAnchorPreservation = {
      anchorItemId: anchorId,
      baselinePreserved,
      ensemblePreserved,
      isConsistent: baselinePreserved === ensemblePreserved,
    };

    // ------------------------------------------------------------------------
    // 4. Hard-Constraint Violations Audit
    // ------------------------------------------------------------------------
    const baselineViolationsDetectedByEnsemble: string[] = [];
    const ensembleViolationsDetected: string[] = [];
    let weakestEdgeClashesCaught = 0;
    let formalitySpreadViolationsPrevented = 0;

    for (const bOutfit of baselineOutfits) {
      const pieces = extractAllPieces(bOutfit);
      if (pieces.length >= 2) {
        const graph = buildEnsembleGraph(pieces);
        const evalResult = evaluateEnsembleOutfit(graph, {
          occasion: request.occasion,
          season: request.season,
          context: request.context,
          preferences: request.preferences,
          styleProfile: request.styleProfile,
          culturalSignals: request.culturalSignals,
        });

        if (graph.minimumPairwiseScore < 4.0) {
          weakestEdgeClashesCaught++;
          baselineViolationsDetectedByEnsemble.push(
            `Outfit ${bOutfit.id}: weakest pairwise score (${graph.minimumPairwiseScore.toFixed(
              1
            )}/10) indicates severe styling clash.`
          );
        }
        if (Math.abs(evalResult.breakdown.formalityConsistency) >= 1.5) {
          formalitySpreadViolationsPrevented++;
          baselineViolationsDetectedByEnsemble.push(
            `Outfit ${bOutfit.id}: formality dispersion delta exceeds recommended boundary.`
          );
        }
      }
    }

    // Inspect ensemble recommendations
    for (const eOutfit of ensembleOutfits) {
      const pieces = extractAllPieces(eOutfit);
      if (pieces.length >= 2) {
        const graph = buildEnsembleGraph(pieces);
        if (graph.hasHardIncompatibility) {
          ensembleViolationsDetected.push(
            `Ensemble outfit ${eOutfit.id} triggered unexpected hard incompatibility: ${graph.hardIncompatibilityReasons.join(
              ', '
            )}`
          );
        }
      }
    }

    const hardConstraintViolations: ShadowHardConstraintViolations = {
      baselineViolationsDetectedByEnsemble,
      ensembleViolationsDetected,
      weakestEdgeClashesCaught,
      formalitySpreadViolationsPrevented,
    };

    // ------------------------------------------------------------------------
    // 5. Unknown-Attribute Handling
    // ------------------------------------------------------------------------
    let baselineUnconfirmedItemsCount = 0;
    for (const o of baselineOutfits) {
      for (const p of extractAllPieces(o)) {
        if (!p.userVerified || !p.fabric || p.fabric === 'unknown' || (p.fabricVerificationStatus && p.fabricVerificationStatus !== 'user_confirmed')) {
          baselineUnconfirmedItemsCount++;
        }
      }
    }

    let ensembleUnconfirmedItemsCount = 0;
    for (const o of ensembleOutfits) {
      for (const p of extractAllPieces(o)) {
        if (!p.userVerified || !p.fabric || p.fabric === 'unknown' || (p.fabricVerificationStatus && p.fabricVerificationStatus !== 'user_confirmed')) {
          ensembleUnconfirmedItemsCount++;
        }
      }
    }

    let uncertaintyShrinkageApplied = false;
    if (ensembleResult.evaluations) {
      for (const ev of Object.values(ensembleResult.evaluations)) {
        if (ev.needsUserConfirmation && ev.score >= 4.5 && ev.score <= 5.5) {
          uncertaintyShrinkageApplied = true;
          break;
        }
      }
    }

    const unknownAttributeHandling: ShadowUnknownAttributeHandling = {
      baselineUnconfirmedItemsCount,
      ensembleUnconfirmedItemsCount,
      uncertaintyShrinkageApplied,
    };

    // ------------------------------------------------------------------------
    // 6. Cultural & Contextual Consistency
    // ------------------------------------------------------------------------
    let culturalSignalsDetected = 0;
    if (request.culturalSignals) {
      culturalSignalsDetected += Object.keys(request.culturalSignals).length;
    }
    const culturalOccasions = [
      'puja',
      'Diwali',
      'Eid',
      'wedding guest',
      'celebration',
      'festive',
      'family function',
    ];
    if (culturalOccasions.includes(request.occasion)) {
      culturalSignalsDetected++;
    }

    const culturalMismatchesCaught: string[] = [];
    if (request.occasion === 'puja') {
      for (const o of baselineOutfits) {
        const pieces = extractAllPieces(o);
        const hasLeather = pieces.some(
          (p) =>
            (p.materialComposition || '').toLowerCase().includes('leather') ||
            p.name.toLowerCase().includes('leather') ||
            (p.note || '').toLowerCase().includes('leather')
        );
        if (hasLeather) {
          culturalMismatchesCaught.push(
            `Baseline outfit ${o.id} contained leather items in sacred Puja context.`
          );
        }
      }
    }

    const culturalContextualConsistency: ShadowCulturalContextualConsistency = {
      culturalHarmonious: culturalMismatchesCaught.length === 0,
      culturalSignalsDetected,
      culturalMismatchesCaught,
      weatherAlignmentConsistent: true,
    };

    // ------------------------------------------------------------------------
    // 7. Execution Latency
    // ------------------------------------------------------------------------
    const tEnd = typeof performance !== 'undefined' ? performance.now() : 0;
    const baselineMs = Math.max(0, Math.round(baselineResult.telemetry.timings.totalMs * 100) / 100);
    const ensembleMs = Math.max(0, Math.round((tEnd - tStart) * 100) / 100);
    const totalMs = Math.max(0, Math.round((baselineMs + ensembleMs) * 100) / 100);

    const executionLatency: ShadowExecutionLatency = {
      baselineMs,
      ensembleMs,
      totalMs,
    };

    const hasGenuineWeather =
      request.context?.weather != null &&
      request.context.source !== 'simulated' &&
      request.context.source !== 'unavailable';

    const report: ShadowComparisonReport = {
      timestamp: Date.now(),
      requestContext: {
        occasion: request.occasion,
        season: request.season,
        itemCount: request.items.length,
        anchorItemId: request.anchorItemId,
        hasGenuineWeather: Boolean(hasGenuineWeather),
        hasStyleProfile: Boolean(request.styleProfile),
      },
      candidateOverlap,
      rankingDifferences,
      anchorPreservation,
      hardConstraintViolations,
      unknownAttributeHandling,
      culturalContextualConsistency,
      executionLatency,
    };

    // Maintain in-memory ring buffer
    shadowHistory.unshift(report);
    if (shadowHistory.length > SHADOW_HISTORY_MAX) {
      shadowHistory.pop();
    }

    return report;
  } catch (err) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[ShadowEvaluator] Non-fatal shadow evaluation failure:', err);
    }
    return null;
  } finally {
    isExecutingShadow = false;
  }
}
