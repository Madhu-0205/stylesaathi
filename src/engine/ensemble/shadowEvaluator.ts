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
  ShadowMissingMetadataIndicators,
  ShadowCulturalContextualConsistency,
  ShadowExecutionLatency,
  ShadowWeatherFreshness,
} from './types';

// ============================================================================
// SHADOW STATE & CONFIGURATION
// ============================================================================

let shadowEvaluationEnabled = true;
let isExecutingShadow = false;
export const SHADOW_HISTORY_MAX = 50;
const shadowHistory: ShadowComparisonReport[] = [];

/**
 * Atomically appends a report to the bounded shadow ring buffer,
 * enforcing the strict maximum capacity of 50 records (FIFO eviction).
 */
function appendToRingBuffer(report: ShadowComparisonReport): void {
  shadowHistory.unshift(report);
  while (shadowHistory.length > SHADOW_HISTORY_MAX) {
    shadowHistory.pop();
  }
}

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

/**
 * Computes live operational metrics across the shadow ring buffer.
 */
export function getShadowEvaluationMetrics(): {
  totalEvaluations: number;
  successfulEvaluations: number;
  failedEvaluations: number;
  failureRate: number;
  averageBaselineMs: number;
  averageShadowMs: number;
  averageAddedMs: number;
  bufferCapacity: number;
  bufferOccupancy: number;
} {
  const total = shadowHistory.length;
  if (total === 0) {
    return {
      totalEvaluations: 0,
      successfulEvaluations: 0,
      failedEvaluations: 0,
      failureRate: 0,
      averageBaselineMs: 0,
      averageShadowMs: 0,
      averageAddedMs: 0,
      bufferCapacity: SHADOW_HISTORY_MAX,
      bufferOccupancy: 0,
    };
  }
  const failed = shadowHistory.filter((r) => r.evaluationSuccess === false).length;
  const successful = total - failed;
  const baselineSum = shadowHistory.reduce((acc, r) => acc + (r.executionLatency.baselineMs || 0), 0);
  const shadowSum = shadowHistory.reduce((acc, r) => acc + (r.executionLatency.ensembleMs || 0), 0);
  return {
    totalEvaluations: total,
    successfulEvaluations: successful,
    failedEvaluations: failed,
    failureRate: Math.round((failed / total) * 1000) / 1000,
    averageBaselineMs: Math.round((baselineSum / total) * 100) / 100,
    averageShadowMs: Math.round((shadowSum / total) * 100) / 100,
    averageAddedMs: Math.round((shadowSum / total) * 100) / 100,
    bufferCapacity: SHADOW_HISTORY_MAX,
    bufferOccupancy: total,
  };
}

/**
 * Canonical Weather Freshness Classifier:
 * - Fresh: under 30 minutes (< 30m).
 * - Stale: 30 minutes to 3 hours (30m <= age <= 180m).
 * - Expired: over 3 hours (> 180m).
 * - Simulated: explicitly identified as simulated.
 * - Missing: no usable snapshot.
 */
export function classifyWeatherFreshness(
  context?: RecommendationRequest['context'] | null,
  now: number = Date.now()
): ShadowWeatherFreshness {
  if (!context || !context.weather || context.source === 'unavailable' || context.freshness === 'unavailable') {
    return 'missing';
  }
  if (
    context.source === 'simulated' ||
    (context.weather as { source?: string }).source === 'simulated' ||
    (context.weather as { source?: string }).source === 'fallback'
  ) {
    return 'simulated';
  }
  const weatherTimestamp =
    context.weather.observedAt || (context.weather as { timestamp?: number }).timestamp;
  if (!weatherTimestamp || weatherTimestamp <= 0) {
    if (context.freshness === 'expired') return 'expired';
    if (context.freshness === 'stale') return 'stale';
    return 'fresh';
  }
  const ageMs = now - weatherTimestamp;
  if (ageMs < 0) {
    return 'fresh';
  }
  const ageMinutes = ageMs / (60 * 1000);
  if (ageMinutes < 30) {
    return 'fresh';
  }
  if (ageMinutes <= 180) {
    return 'stale';
  }
  return 'expired';
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

  const anchorItem = request.anchorItemId
    ? request.items.find((i) => i.id === request.anchorItemId)
    : undefined;
  const isPlanningMode =
    request.allowPlanningMode === true ||
    (request.allowPlanningMode !== false &&
      Boolean(anchorItem && (anchorItem.status === 'needs_washing' || anchorItem.status === 'in_laundry')));

  try {
    const ensembleEngine = new EnsembleRecommendationEngine();
    const ensembleResult = ensembleEngine.recommend(request, {
      allowPlanningMode: isPlanningMode,
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
        const graph = buildEnsembleGraph(pieces, {
          allowPlanningMode: isPlanningMode,
          anchorItemId: request.anchorItemId,
        });
        const evalResult = evaluateEnsembleOutfit(graph, {
          occasion: request.occasion,
          season: request.season,
          context: request.context,
          preferences: request.preferences,
          styleProfile: request.styleProfile,
          culturalSignals: request.culturalSignals,
          allowPlanningMode: isPlanningMode,
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
        const graph = buildEnsembleGraph(pieces, {
          allowPlanningMode: isPlanningMode,
          anchorItemId: request.anchorItemId,
        });
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
    // 5b. Missing Metadata Indicators
    // ------------------------------------------------------------------------
    let missingFabricCount = 0;
    let missingFitCount = 0;
    let missingSeasonsCount = 0;
    let missingColorCount = 0;
    let unconfirmedCount = 0;

    for (const item of request.items) {
      if (!item.fabric || item.fabric === 'unknown') missingFabricCount++;
      if (!item.fit || (item.fit as string) === 'unknown') missingFitCount++;
      if (!item.seasons || item.seasons.length === 0) missingSeasonsCount++;
      if (!item.colors || item.colors.length === 0) missingColorCount++;
      if (!item.userVerified) unconfirmedCount++;
    }

    const missingMetadataIndicators: ShadowMissingMetadataIndicators = {
      missingFabricCount,
      missingFitCount,
      missingSeasonsCount,
      missingColorCount,
      unconfirmedCount,
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

    const weatherFreshness = classifyWeatherFreshness(request.context);

    const evaluationId = `shadow_eval_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const report: ShadowComparisonReport = {
      evaluationId,
      timestamp: Date.now(),
      engineVersions: {
        baseline: '2.0.0-baseline',
        shadow: ensembleEngine.version || '3.0.0-ensemble',
      },
      evaluationSuccess: true,
      requestContext: {
        occasion: request.occasion,
        season: request.season,
        itemCount: request.items.length,
        anchorItemId: request.anchorItemId,
        hasGenuineWeather: Boolean(hasGenuineWeather),
        weatherFreshness,
        hasStyleProfile: Boolean(request.styleProfile),
      },
      baselineRecommendationIds: baselineOutfits.map((o) => o.id),
      shadowRecommendationIds: ensembleOutfits.map((o) => o.id),
      candidateOverlap,
      rankingDifferences,
      anchorPreservation,
      hardConstraintViolations,
      unknownAttributeHandling,
      missingMetadataIndicators,
      culturalContextualConsistency,
      executionLatency,
    };

    appendToRingBuffer(report);
    return report;
  } catch (err) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[ShadowEvaluator] Non-fatal shadow evaluation failure:', err);
    }
    // Record shadow failure in ring buffer so failure rate can be measured without failing baseline
    const failureReport: ShadowComparisonReport = {
      evaluationId: `shadow_failed_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
      engineVersions: {
        baseline: '2.0.0-baseline',
        shadow: '3.0.0-ensemble',
      },
      evaluationSuccess: false,
      failureReason: err instanceof Error ? err.message : String(err),
      requestContext: {
        occasion: request.occasion,
        season: request.season,
        itemCount: request.items.length,
        anchorItemId: request.anchorItemId,
        hasGenuineWeather: Boolean(
          request.context?.weather != null &&
          request.context.source !== 'simulated' &&
          request.context.source !== 'unavailable'
        ),
        weatherFreshness: classifyWeatherFreshness(request.context),
        hasStyleProfile: Boolean(request.styleProfile),
      },
      baselineRecommendationIds: baselineResult.set.outfits?.map((o) => o.id) || [],
      shadowRecommendationIds: [],
      candidateOverlap: {
        baselineCount: baselineResult.set.outfits?.length || 0,
        ensembleCount: 0,
        sharedTopCandidateIds: [],
        topPickJaccardOverlap: 0,
      },
      rankingDifferences: {
        baselineTopScore: baselineResult.set.outfits?.[0]?.score || 0,
        ensembleTopScore: 0,
        scoreDelta: 0,
        rankInversionsCount: 0,
        explanation: 'Shadow execution failed; fallback to baseline only.',
      },
      anchorPreservation: {
        anchorItemId: request.anchorItemId,
        baselinePreserved: true,
        ensemblePreserved: false,
        isConsistent: false,
      },
      hardConstraintViolations: {
        baselineViolationsDetectedByEnsemble: [],
        ensembleViolationsDetected: [],
        weakestEdgeClashesCaught: 0,
        formalitySpreadViolationsPrevented: 0,
      },
      unknownAttributeHandling: {
        baselineUnconfirmedItemsCount: 0,
        ensembleUnconfirmedItemsCount: 0,
        uncertaintyShrinkageApplied: false,
      },
      missingMetadataIndicators: {
        missingFabricCount: 0,
        missingFitCount: 0,
        missingSeasonsCount: 0,
        missingColorCount: 0,
        unconfirmedCount: 0,
      },
      culturalContextualConsistency: {
        culturalHarmonious: true,
        culturalSignalsDetected: 0,
        culturalMismatchesCaught: [],
        weatherAlignmentConsistent: true,
      },
      executionLatency: {
        baselineMs: Math.max(0, Math.round((baselineResult.telemetry?.timings?.totalMs || 0) * 100) / 100),
        ensembleMs: 0,
        totalMs: Math.max(0, Math.round((baselineResult.telemetry?.timings?.totalMs || 0) * 100) / 100),
      },
    };
    appendToRingBuffer(failureReport);
    return null;
  } finally {
    isExecutingShadow = false;
  }
}
