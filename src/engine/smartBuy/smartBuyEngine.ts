import {
  ComputeWardrobeGapsInput,
  WardrobeGapReport,
  DataSufficiencyMetrics,
  NegativeEvidence,
  PurchaseAssessment,
  WardrobeGap,
} from './types';
import { Occasion } from '../../types';
import { extractActiveOccasions, auditOccasionCoverage } from './coverageAuditor';
import { detectWardrobeGaps } from './gapDetectionEngine';

/**
 * Calculates conservative data sufficiency metrics and confidence score.
 */
export function calculateDataSufficiency(
  itemCount: number,
  wearCount: number,
  planCount: number,
  activeOccasionsCount: number,
  physicalShortageCount: number = 0
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
    if (physicalShortageCount > 0) {
      ineligibilityReason = `Physical wardrobe gap detected. Behavioral preference data is establishing (currently ${wearCount} wears, ${planCount} plans).`;
    } else if (itemCount < 5) {
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

  // 3. Physical Essential Category Audit
  const hasTopUpper = wardrobe.some(
    (i) =>
      i.category === 'Tops' ||
      (i.category === 'Ethnic' && ['kurta', 'top', 'shirt', 'blouse'].includes(i.subcategory?.toLowerCase() || '')) ||
      i.category === 'Dresses' ||
      (i.category === 'Ethnic' && ['saree', 'anarkali'].includes(i.subcategory?.toLowerCase() || ''))
  );
  const hasBottom = wardrobe.some(
    (i) =>
      i.category === 'Bottoms' ||
      i.category === 'Dresses' ||
      (i.category === 'Ethnic' && ['saree', 'anarkali', 'lehenga'].includes(i.subcategory?.toLowerCase() || ''))
  );
  const hasFootwear = wardrobe.some((i) => i.category === 'Footwear');

  const physicalGaps: WardrobeGap[] = [];

  if (!hasBottom && wardrobe.length > 0) {
    physicalGaps.push({
      id: 'physical_gap_bottoms',
      type: 'MISSING_CATEGORY',
      targetRole: 'bottom',
      expectedCategory: 'Bottoms',
      compatibleSubcategories: ['jeans', 'trousers', 'palazzo'],
      activeOccasions: activeOccasions.size > 0 ? Array.from(activeOccasions) : ['everyday' as Occasion],
      gapState: 'CRITICAL_GAP',
      purchaseAssessment: 'PURCHASE_JUSTIFIED',
      severityScore: 1.0,
      confidence: 0.95,
      evidence: [
        {
          tier: 'TIER_4_WARDROBE_COMPOSITION',
          description: 'You currently own 0 bottoms or full-body garments in your wardrobe.',
          dataPoints: { ownedBottoms: 0 },
        },
      ],
      headline: 'Critical Physical Gap: Bottoms (0 Owned)',
      explanation: 'Your wardrobe currently contains 0 bottoms or full-body outfits. Complete looks cannot physically be formed without lower-body garments.',
    });
  }

  if (!hasTopUpper && wardrobe.length > 0) {
    physicalGaps.push({
      id: 'physical_gap_tops',
      type: 'MISSING_CATEGORY',
      targetRole: 'top',
      expectedCategory: 'Tops',
      compatibleSubcategories: ['shirt', 't-shirt', 'kurta'],
      activeOccasions: activeOccasions.size > 0 ? Array.from(activeOccasions) : ['everyday' as Occasion],
      gapState: 'CRITICAL_GAP',
      purchaseAssessment: 'PURCHASE_JUSTIFIED',
      severityScore: 1.0,
      confidence: 0.95,
      evidence: [
        {
          tier: 'TIER_4_WARDROBE_COMPOSITION',
          description: 'You currently own 0 tops, kurtas, or full-body garments in your wardrobe.',
          dataPoints: { ownedTops: 0 },
        },
      ],
      headline: 'Critical Physical Gap: Tops (0 Owned)',
      explanation: 'Your wardrobe currently contains 0 tops or full-body outfits. Complete looks cannot physically be formed without upper-body garments.',
    });
  }

  if (!hasFootwear && wardrobe.length > 0) {
    physicalGaps.push({
      id: 'physical_gap_footwear',
      type: 'MISSING_CATEGORY',
      targetRole: 'footwear',
      expectedCategory: 'Footwear',
      compatibleSubcategories: ['sneakers', 'formal shoes', 'loafers'],
      activeOccasions: activeOccasions.size > 0 ? Array.from(activeOccasions) : ['everyday' as Occasion],
      gapState: 'CRITICAL_GAP',
      purchaseAssessment: 'PURCHASE_JUSTIFIED',
      severityScore: 0.9,
      confidence: 0.95,
      evidence: [
        {
          tier: 'TIER_4_WARDROBE_COMPOSITION',
          description: 'You currently own 0 pairs of footwear in your wardrobe.',
          dataPoints: { ownedFootwear: 0 },
        },
      ],
      headline: 'Critical Physical Gap: Footwear (0 Owned)',
      explanation: 'Your wardrobe currently contains 0 footwear options. Completing and wearing finished outfits requires at least one versatile pair of footwear.',
    });
  }

  // 4. Evaluate Data Sufficiency
  const dataSufficiency = calculateDataSufficiency(
    wardrobe.length,
    totalWears,
    validPlansCount,
    activeOccasions.size,
    physicalGaps.length
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

  // 5. Audit occasion template slot availability (Phase 5 Lightweight Auditor)
  const { failures, coverageSummary } = auditOccasionCoverage(wardrobe, activeOccasions, dormantItemIds);

  // 6. Detect and classify wardrobe gaps
  const detectedGaps = detectWardrobeGaps({
    wardrobe,
    activeOccasions,
    slotFailures: failures,
    wearAnalytics,
    outfitPlans,
    styleProfile,
    contextSnapshot,
    referenceTimestamp,
  });

  // Combine detected and physical gaps with severity-preserving deduplication
  const gaps: WardrobeGap[] = [...detectedGaps];
  for (const pGap of physicalGaps) {
    const existingIndex = gaps.findIndex(
      (g) => g.expectedCategory === pGap.expectedCategory && g.targetRole === pGap.targetRole
    );
    if (existingIndex === -1) {
      gaps.unshift(pGap);
    } else {
      const existing = gaps[existingIndex];
      // A physical gap representing 0 owned essential items must take precedence over weaker observed gaps
      if (existing.gapState !== 'CRITICAL_GAP' || pGap.severityScore > existing.severityScore) {
        gaps[existingIndex] = {
          ...existing,
          ...pGap,
          attributeGuidance: existing.attributeGuidance || pGap.attributeGuidance,
          activeOccasions: existing.activeOccasions.length > 0 ? existing.activeOccasions : pGap.activeOccasions,
          evidence: [
            ...pGap.evidence,
            ...existing.evidence.filter((e) => !pGap.evidence.some((pe) => pe.tier === e.tier)),
          ],
        };
      }
    }
  }

  const confirmedPhysicalGaps = gaps.filter(
    (g) => g.type === 'MISSING_CATEGORY' || g.gapState === 'CRITICAL_GAP'
  );

  const isBehavioralSufficient = wardrobe.length >= 5 && (totalWears >= 10 || validPlansCount >= 3);

  // If behavioral data is insufficient AND no confirmed physical gaps exist, return safe early fallback
  if (!isBehavioralSufficient && confirmedPhysicalGaps.length === 0) {
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
          'Essential categories are present in your wardrobe.',
          'Log your daily outfits and scheduled occasions to unlock verified behavioral gap detection.',
        ],
        rediscoveryOpportunitiesCount: 0,
      },
    };
  }

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
