import {
  ComputeWardrobeGapsInput,
  WardrobeGapReport,
  DataSufficiencyMetrics,
  NegativeEvidence,
  PurchaseAssessment,
} from './types';
import { extractActiveOccasions, auditOccasionCoverage } from './coverageAuditor';
import { detectWardrobeGaps } from './gapDetectionEngine';

/**
 * Calculates conservative data sufficiency metrics and confidence score.
 */
export function calculateDataSufficiency(
  itemCount: number,
  wearCount: number,
  planCount: number,
  activeOccasionsCount: number
): DataSufficiencyMetrics {
  const isSufficient = itemCount >= 5 && (wearCount >= 10 || planCount >= 3);

  // Confidence heuristic formula: 0.40 * volume + 0.35 * wardrobe + 0.25 * occasion coverage
  const volumeFactor = Math.min(1.0, wearCount / 25);
  const wardrobeFactor = Math.min(1.0, itemCount / 15);
  const occasionFactor = Math.min(1.0, activeOccasionsCount / 4);

  const rawConfidence = 0.4 * volumeFactor + 0.35 * wardrobeFactor + 0.25 * occasionFactor;
  const confidenceScore = Math.round(Math.min(1.0, Math.max(0.0, rawConfidence)) * 100) / 100;

  let ineligibilityReason: string | undefined;
  if (!isSufficient) {
    if (itemCount < 5) {
      ineligibilityReason = `Add at least 5 garments to establish your wardrobe baseline (currently ${itemCount}).`;
    } else {
      ineligibilityReason = `Log at least 10 recorded wears or 3 calendar plans to establish reliable gap intelligence (currently ${wearCount} wears, ${planCount} plans).`;
    }
  }

  return {
    isSufficient,
    totalGarments: itemCount,
    totalWearEvents: wearCount,
    activeOccasionsCount,
    confidenceScore,
    ineligibilityReason,
  };
}

/**
 * Master pure analytical engine: Computes deterministic WardrobeGapReport.
 * Invariant: Accepts referenceTimestamp explicitly, performs zero async/network/mutation side effects.
 */
export function computeWardrobeGaps(input: ComputeWardrobeGapsInput): WardrobeGapReport {
  const {
    wardrobe,
    wearAnalytics,
    outfitPlans = [],
    styleProfile,
    stylePreferences,
    contextSnapshot,
    referenceTimestamp = 0,
  } = input;

  // 1. Determine active lifestyle occasions
  const activeOccasions = extractActiveOccasions(outfitPlans, stylePreferences);

  // 2. Count total wear volume
  const totalWears = wearAnalytics
    ? wearAnalytics.totalLifetimeWears
    : wardrobe.reduce((sum, item) => sum + (item.timesWorn || 0), 0);

  const validPlansCount = outfitPlans.filter((p) => p.status !== 'cancelled').length;

  // 3. Evaluate Data Sufficiency
  const dataSufficiency = calculateDataSufficiency(
    wardrobe.length,
    totalWears,
    validPlansCount,
    activeOccasions.size
  );

  // Pre-index dormant items from Phase 8 wear analytics or item age/lastWorn
  const dormantItemIds = new Set<string>();
  if (wearAnalytics?.rotation?.itemsByState) {
    for (const itemAnalysis of wearAnalytics.rotation.itemsByState.dormant) {
      dormantItemIds.add(itemAnalysis.item.id);
    }
    for (const itemAnalysis of wearAnalytics.rotation.itemsByState.never_worn) {
      dormantItemIds.add(itemAnalysis.item.id);
    }
  }

  // Fallback dormancy check if wearAnalytics is omitted or partial
  for (const item of wardrobe) {
    const ageDays = (referenceTimestamp - (item.createdAt || referenceTimestamp)) / 86400000;
    const lastWornDays = item.lastWorn ? (referenceTimestamp - item.lastWorn) / 86400000 : 999;
    if (ageDays > 30 && lastWornDays > 90) {
      dormantItemIds.add(item.id);
    }
  }

  // 4. Audit occasion template slot availability (Phase 5 Lightweight Auditor)
  const { failures, coverageSummary } = auditOccasionCoverage(wardrobe, activeOccasions, dormantItemIds);

  // If insufficient data, return safe early fallback
  if (!dataSufficiency.isSufficient) {
    return {
      referenceTimestamp,
      dataSufficiency,
      gaps: [],
      purchaseAssessment: 'NO_PURCHASE_NEEDED',
      coverageSummary,
      negativeEvidence: {
        hasNoPurchaseNeeded: true,
        primaryReason: dataSufficiency.ineligibilityReason || 'Data baseline establishing.',
        details: [
          'StyleSaathi requires sufficient wardrobe depth and activity before recommending any additions.',
          'Log your daily outfits and scheduled occasions to unlock verified gap detection.',
        ],
        rediscoveryOpportunitiesCount: 0,
      },
    };
  }

  // 5. Detect and classify wardrobe gaps
  const gaps = detectWardrobeGaps({
    wardrobe,
    activeOccasions,
    slotFailures: failures,
    wearAnalytics,
    outfitPlans,
    styleProfile,
    contextSnapshot,
    referenceTimestamp,
  });

  // 6. Overall Purchase Assessment
  const purchaseJustifiedGaps = gaps.filter((g) => g.purchaseAssessment === 'PURCHASE_JUSTIFIED');
  const overallPurchaseAssessment: PurchaseAssessment =
    purchaseJustifiedGaps.length > 0 ? 'PURCHASE_JUSTIFIED' : 'NO_PURCHASE_NEEDED';

  // 7. Negative Evidence Synthesis
  const rediscoveryGaps = gaps.filter((g) => g.gapState === 'REDISCOVERY_SUGGESTED');
  const negativeDetails: string[] = [];

  let primaryReason = 'Your wardrobe covers 100% of your active lifestyle routines with healthy rotation.';

  if (overallPurchaseAssessment === 'NO_PURCHASE_NEEDED') {
    if (rediscoveryGaps.length > 0) {
      primaryReason = `You do not need to buy anything. You have ${rediscoveryGaps.length} dormant garment(s) in your wardrobe that can resolve existing shortages immediately.`;
      negativeDetails.push(
        ...rediscoveryGaps.map(
          (g) => `Unworn alternative ready: ${g.rediscoveryCandidate?.item.name} for ${g.activeOccasions.join(', ')}`
        )
      );
    } else if (coverageSummary.unsupportedActiveOccasionsCount === 0) {
      primaryReason = `All ${coverageSummary.coveredOccasionsCount} of your active routines are fully covered with ready looks.`;
      negativeDetails.push('No functional or structural shortages detected across any declared occasion.');
    }
  } else {
    negativeDetails.push(
      `Verified gap confirmed for: ${purchaseJustifiedGaps.map((g) => g.expectedCategory).join(', ')}`
    );
  }

  const concentrationAdvisory =
    wearAnalytics?.concentration?.interpretation === 'High Concentration'
      ? wearAnalytics.concentration.explanation
      : undefined;

  const negativeEvidence: NegativeEvidence = {
    hasNoPurchaseNeeded: overallPurchaseAssessment === 'NO_PURCHASE_NEEDED',
    primaryReason,
    details: negativeDetails,
    rediscoveryOpportunitiesCount: rediscoveryGaps.length,
    concentrationAdvisory,
  };

  return {
    referenceTimestamp,
    dataSufficiency,
    gaps,
    purchaseAssessment: overallPurchaseAssessment,
    coverageSummary,
    negativeEvidence,
  };
}
