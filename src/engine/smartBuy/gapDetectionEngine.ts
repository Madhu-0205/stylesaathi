import {
  Category,
  Subcategory,
  Occasion,
  OutfitSlotRole,
  WardrobeItem,
  OutfitPlan,
  PersonalStyleProfile,
  ContextSnapshot,
  FabricType,
  SilhouetteFit,
} from '../../types';
import { WearAnalyticsReport } from '../analytics/types';
import { OccasionSlotFailure, itemMatchesSlotRole } from './coverageAuditor';
import {
  WardrobeGap,
  WardrobeGapType,
  GapState,
  PurchaseAssessment,
  EvidenceItem,
  RediscoveryCandidate,
  GapAttributeGuidance,
} from './types';

interface GapDetectionInput {
  wardrobe: readonly WardrobeItem[];
  activeOccasions: ReadonlySet<Occasion>;
  slotFailures: readonly OccasionSlotFailure[];
  wearAnalytics?: WearAnalyticsReport;
  outfitPlans?: readonly OutfitPlan[];
  styleProfile?: PersonalStyleProfile;
  contextSnapshot?: ContextSnapshot;
  referenceTimestamp: number;
}

const OCCASION_FORMALITY_DEFAULTS: Record<string, number> = {
  college: 2,
  everyday: 2,
  'casual outing': 2,
  travel: 2,
  office: 4,
  interview: 4,
  date: 3,
  party: 4,
  'family gathering': 3,
  'family function': 4,
  festive: 4,
  puja: 4,
  'wedding guest': 5,
  celebration: 4,
};

/**
 * Deterministic engine synthesizing Tier 1-6 evidence to classify wardrobe gaps.
 */
export function detectWardrobeGaps(input: GapDetectionInput): WardrobeGap[] {
  const {
    wardrobe,
    activeOccasions,
    slotFailures,
    wearAnalytics,
    outfitPlans = [],
    styleProfile,
    contextSnapshot,
    referenceTimestamp,
  } = input;

  const gaps: WardrobeGap[] = [];
  const processedKeys = new Set<string>();

  // Extract scheduled calendar plans
  const scheduledOccasions = new Set<Occasion>();
  for (const plan of outfitPlans) {
    if (plan.status !== 'cancelled' && plan.occasion) {
      scheduledOccasions.add(plan.occasion);
    }
  }

  // Pre-index dormant items from Phase 8 wear analytics
  const dormantItemIds = new Set<string>();
  if (wearAnalytics?.rotation?.itemsByState) {
    for (const itemAnalysis of wearAnalytics.rotation.itemsByState.dormant) {
      dormantItemIds.add(itemAnalysis.item.id);
    }
    for (const itemAnalysis of wearAnalytics.rotation.itemsByState.never_worn) {
      dormantItemIds.add(itemAnalysis.item.id);
    }
  }

  // Fallback dormancy check if wearAnalytics is omitted
  for (const item of wardrobe) {
    const ageDays = (referenceTimestamp - (item.createdAt || referenceTimestamp)) / 86400000;
    const lastWornDays = item.lastWorn ? (referenceTimestamp - item.lastWorn) / 86400000 : 999;
    if (ageDays > 30 && lastWornDays > 90) {
      dormantItemIds.add(item.id);
    }
  }

  // 1. Group template slot failures by (targetRole, expectedCategory)
  const failureGroups = new Map<
    string,
    {
      role: OutfitSlotRole;
      category: Category;
      subcategories: Subcategory[];
      occasions: Set<Occasion>;
      templateNames: Set<string>;
    }
  >();

  for (const failure of slotFailures) {
    const key = `${failure.role}_${failure.expectedCategory}`;
    let group = failureGroups.get(key);
    if (!group) {
      group = {
        role: failure.role,
        category: failure.expectedCategory,
        subcategories: [...failure.subcategories],
        occasions: new Set(),
        templateNames: new Set(),
      };
      failureGroups.set(key, group);
    }
    group.occasions.add(failure.occasion);
    group.templateNames.add(failure.templateName);
    for (const sub of failure.subcategories) {
      if (!group.subcategories.includes(sub)) {
        group.subcategories.push(sub);
      }
    }
  }

  // 2. Evaluate structural slot failures
  for (const [key, group] of failureGroups.entries()) {
    processedKeys.add(key);

    const relevantOccasions = Array.from(group.occasions);
    const hasScheduledEvent = relevantOccasions.some((occ) => scheduledOccasions.has(occ));

    // Check owned inventory matching this role
    const matchingOwned = wardrobe.filter((item) =>
      itemMatchesSlotRole(item, group.role, [group.category])
    );
    const cleanMatches = matchingOwned.filter((i) => i.status === 'clean');
    const dormantMatches = matchingOwned.filter((i) => dormantItemIds.has(i.id));

    // Construct evidence items
    const evidence: EvidenceItem[] = [];

    // Tier 1 evidence
    if (hasScheduledEvent) {
      evidence.push({
        tier: 'TIER_1_EXPLICIT_DEMAND',
        description: `Upcoming scheduled calendar event requires ${relevantOccasions.join(', ')} ensemble`,
      });
    } else {
      evidence.push({
        tier: 'TIER_1_EXPLICIT_DEMAND',
        description: `Active wardrobe routine declared for ${relevantOccasions.join(', ')}`,
      });
    }

    // Tier 2 evidence
    evidence.push({
      tier: 'TIER_2_UNRESOLVED_REQUIREMENTS',
      description: `Occasion templates (${Array.from(group.templateNames).join(', ')}) have 0 clean candidates for ${group.role}`,
      dataPoints: {
        missingRole: group.role,
        cleanCandidates: cleanMatches.length,
      },
    });

    // Tier 4 evidence
    evidence.push({
      tier: 'TIER_4_WARDROBE_COMPOSITION',
      description: `You currently have ${cleanMatches.length} clean ${group.category} pieces matching ${group.role}`,
    });

    // Determine GapState and PurchaseAssessment
    let gapState: GapState;
    let purchaseAssessment: PurchaseAssessment;
    let rediscoveryCandidate: RediscoveryCandidate | undefined;
    let headline: string;
    let explanation: string;
    let severityScore = 0.5;

    if (dormantMatches.length > 0) {
      // Dormancy suppresses purchase justification!
      const dormantItem = dormantMatches[0];
      gapState = 'REDISCOVERY_SUGGESTED';
      purchaseAssessment = 'NO_PURCHASE_NEEDED';
      severityScore = 0.4;
      rediscoveryCandidate = {
        item: dormantItem,
        targetRole: group.role,
        resolvedOccasions: relevantOccasions,
        action: 'STYLE_ITEM',
      };
      evidence.push({
        tier: 'TIER_3_WEAR_ROTATION',
        description: `You own ${dormantMatches.length} dormant piece(s) (including ${dormantItem.name}) capable of satisfying this role`,
      });
      headline = `Rediscover in Closet: ${dormantItem.name}`;
      explanation = `Your wardrobe has an active shortage of clean ${group.role} pieces for ${relevantOccasions.join(', ')}, but you already own ${dormantItem.name}. Styling this existing garment will resolve the gap without purchasing anything new.`;
    } else if (matchingOwned.length === 0) {
      // Zero owned pieces
      if (hasScheduledEvent) {
        gapState = 'CRITICAL_GAP';
        purchaseAssessment = 'PURCHASE_JUSTIFIED';
        severityScore = 0.95;
        headline = `Critical Gap: ${group.category} (${group.role})`;
        explanation = `You have upcoming scheduled events for ${relevantOccasions.join(', ')}, but own 0 pieces capable of fulfilling the required ${group.role} role. Adding a versatile staple is justified.`;
      } else {
        gapState = 'OBSERVED_GAP';
        purchaseAssessment = 'PURCHASE_JUSTIFIED';
        severityScore = 0.8;
        headline = `Verified Gap: ${group.category} (${group.role})`;
        explanation = `Your active lifestyle demand for ${relevantOccasions.join(', ')} cannot form complete looks because you own 0 compatible ${group.role} pieces.`;
      }
    } else {
      // Owned pieces exist, but are trapped in laundry
      gapState = 'OBSERVED_GAP';
      purchaseAssessment = 'NO_PURCHASE_NEEDED';
      severityScore = 0.5;
      headline = `Laundry Latency Shortage: ${group.category}`;
      explanation = `All ${matchingOwned.length} of your ${group.role} pieces are currently in laundry or need washing. Refreshing existing pieces will restore complete looks.`;
      evidence.push({
        tier: 'TIER_4_WARDROBE_COMPOSITION',
        description: `All ${matchingOwned.length} matching pieces are in laundry/washing status`,
      });
    }

    // Personal Style attribute guidance
    const guidance = buildGapAttributeGuidance(group.category, relevantOccasions, styleProfile);

    gaps.push({
      id: `gap_${group.role}_${group.category.toLowerCase()}`,
      type: matchingOwned.length === 0 ? 'MISSING_CATEGORY' : 'FUNCTIONAL_GAP',
      targetRole: group.role,
      expectedCategory: group.category,
      compatibleSubcategories: group.subcategories,
      activeOccasions: relevantOccasions,
      gapState,
      purchaseAssessment,
      severityScore,
      confidence: hasScheduledEvent ? 0.85 : 0.72,
      evidence,
      rediscoveryCandidate,
      attributeGuidance: guidance,
      headline,
      explanation,
    });
  }

  // 3. Category Under-Coverage / Rotation Stress Check (Phase 8 empirical evidence)
  if (wearAnalytics?.rotation?.itemsByState) {
    const categories: Category[] = ['Tops', 'Bottoms', 'Ethnic', 'Footwear', 'Outerwear'];
    for (const cat of categories) {
      const catKey = `cat_${cat.toLowerCase()}`;
      if (processedKeys.has(catKey)) continue;

      const catItems = wardrobe.filter((i) => i.category === cat);
      const cleanCatItems = catItems.filter((i) => i.status === 'clean');
      const activeCatItems = catItems.filter((i) =>
        wearAnalytics.rotation.itemsByState.active.some((a) => a.item.id === i.id)
      );
      const dormantCatItems = catItems.filter((i) =>
        wearAnalytics.rotation.itemsByState.dormant.some((d) => d.item.id === i.id)
      );

      // Check for extreme Pareto concentration (e.g. solitary staple carrying >= 80% category wear)
      const totalCatWears = catItems.reduce(
        (sum, item) => sum + (wearAnalytics.reconciledWears?.[item.id]?.effectiveLifetimeWears || 0),
        0
      );

      if (cleanCatItems.length <= 2 && totalCatWears >= 15 && activeCatItems.length === 1) {
        const solitaryStaple = activeCatItems[0];
        const stapleWears = wearAnalytics.reconciledWears?.[solitaryStaple.id]?.effectiveLifetimeWears || 0;
        const concentrationRatio = totalCatWears > 0 ? stapleWears / totalCatWears : 0;

        if (concentrationRatio >= 0.75) {
          processedKeys.add(catKey);

          if (dormantCatItems.length > 0) {
            const dormantAlt = dormantCatItems[0];
            gaps.push({
              id: `stress_${cat.toLowerCase()}`,
              type: 'UNDER_COVERED_CATEGORY',
              targetRole: cat === 'Bottoms' ? 'bottom' : cat === 'Tops' ? 'top' : 'outerwear',
              expectedCategory: cat,
              compatibleSubcategories: [solitaryStaple.subcategory],
              activeOccasions: Array.from(activeOccasions),
              gapState: 'REDISCOVERY_SUGGESTED',
              purchaseAssessment: 'NO_PURCHASE_NEEDED',
              severityScore: 0.45,
              confidence: 0.7,
              evidence: [
                {
                  tier: 'TIER_3_WEAR_ROTATION',
                  description: `${Math.round(concentrationRatio * 100)}% of your ${cat} wear is concentrated on ${solitaryStaple.name}`,
                },
                {
                  tier: 'TIER_3_WEAR_ROTATION',
                  description: `You have ${dormantCatItems.length} unworn ${cat} piece(s) in your wardrobe (e.g. ${dormantAlt.name})`,
                },
              ],
              rediscoveryCandidate: {
                item: dormantAlt,
                targetRole: cat === 'Bottoms' ? 'bottom' : cat === 'Tops' ? 'top' : 'outerwear',
                resolvedOccasions: Array.from(activeOccasions),
                action: 'STYLE_ITEM',
              },
              headline: `Rotate Existing ${cat}: ${dormantAlt.name}`,
              explanation: `Your usage is heavily concentrated on ${solitaryStaple.name}. Rather than buying more ${cat}, rotate your existing ${dormantAlt.name} to balance wear.`,
            });
          }
        }
      }
    }
  }

  // 4. High Utilization Diagnostic (NOT physical damage/replacement)
  if (wearAnalytics?.reconciledWears) {
    for (const item of wardrobe) {
      const rec = wearAnalytics.reconciledWears[item.id];
      if (rec && rec.effectiveLifetimeWears >= 75) {
        const catItems = wardrobe.filter((i) => i.category === item.category);
        const catWears = catItems.reduce(
          (sum, i) => sum + (wearAnalytics.reconciledWears[i.id]?.effectiveLifetimeWears || 0),
          0
        );
        const share = catWears > 0 ? rec.effectiveLifetimeWears / catWears : 0;

        if (share >= 0.7) {
          gaps.push({
            id: `diag_high_util_${item.id}`,
            type: 'UNDER_COVERED_CATEGORY',
            targetRole: item.category === 'Bottoms' ? 'bottom' : 'top',
            expectedCategory: item.category,
            compatibleSubcategories: [item.subcategory],
            activeOccasions: Array.from(activeOccasions),
            gapState: 'POSSIBLE_GAP',
            purchaseAssessment: 'NO_PURCHASE_NEEDED',
            severityScore: 0.35,
            confidence: 0.65,
            evidence: [
              {
                tier: 'TIER_3_WEAR_ROTATION',
                description: `${item.name} has reached ${rec.effectiveLifetimeWears} recorded wears (${Math.round(share * 100)}% of category)`,
              },
            ],
            headline: `High Utilization: ${item.name}`,
            explanation: `This staple piece is heavily utilized (${rec.effectiveLifetimeWears} wears). No purchase is needed; consider rotating other pieces to prolong its longevity.`,
          });
        }
      }
    }
  }

  // 5. Environmental Context Gap (Phase 4 Verified Snapshot Only)
  if (contextSnapshot?.thermalContext === 'very_hot') {
    const breathablePieces = wardrobe.filter(
      (i) => i.status === 'clean' && ['cotton', 'linen', 'mulmul', 'khadi'].includes(i.fabric || '')
    );
    if (breathablePieces.length === 0) {
      gaps.push({
        id: 'gap_context_breathable',
        type: 'CONTEXT_GAP',
        targetRole: 'top',
        expectedCategory: 'Tops',
        compatibleSubcategories: ['shirt', 't-shirt', 'kurta'],
        activeOccasions: Array.from(activeOccasions),
        gapState: 'POSSIBLE_GAP',
        purchaseAssessment: 'NO_PURCHASE_NEEDED',
        severityScore: 0.5,
        confidence: 0.6,
        evidence: [
          {
            tier: 'TIER_5_ENVIRONMENTAL_CONTEXT',
            description: `Current verified thermal context is very hot, but wardrobe has 0 breathable cotton/linen tops`,
          },
        ],
        headline: 'Climate Context: Breathable Textiles',
        explanation: 'Your current climate is very hot, but your wardrobe contains no clean cotton, linen, or lightweight natural fabrics.',
      });
    }
  }

  // Stable sort: highest severity first, tie-break by ID
  return gaps.sort((a, b) => b.severityScore - a.severityScore || a.id.localeCompare(b.id));
}

/**
 * Builds Style Brain attribute guidance for an identified gap.
 */
function buildGapAttributeGuidance(
  category: Category,
  occasions: Occasion[],
  styleProfile?: PersonalStyleProfile
): GapAttributeGuidance {
  const preferredFabrics: FabricType[] = [];
  const avoidedFabrics: FabricType[] = styleProfile?.avoidedFabrics ? [...styleProfile.avoidedFabrics] : [];
  const preferredFits: SilhouetteFit[] = [];
  const preferredColors: string[] = styleProfile?.topColors ? [...styleProfile.topColors] : [];
  const avoidedColors: string[] = styleProfile?.avoidedColors ? [...styleProfile.avoidedColors] : [];

  if (styleProfile?.fabricAffinities) {
    for (const [fabric, aff] of Object.entries(styleProfile.fabricAffinities)) {
      if (aff.score > 0.2 && !avoidedFabrics.includes(fabric as FabricType)) {
        preferredFabrics.push(fabric as FabricType);
      }
    }
  }

  if (styleProfile?.fitAffinities) {
    for (const [fit, aff] of Object.entries(styleProfile.fitAffinities)) {
      if (aff.score > 0.2) {
        preferredFits.push(fit as SilhouetteFit);
      }
    }
  }

  // Calculate target formality from active occasions
  let formalitySum = 0;
  for (const occ of occasions) {
    formalitySum += OCCASION_FORMALITY_DEFAULTS[occ] || 2;
  }
  const formalityTarget =
    occasions.length > 0 ? Math.round(formalitySum / occasions.length) : 3;

  return {
    preferredFabrics,
    avoidedFabrics,
    preferredFits,
    preferredColors,
    avoidedColors,
    formalityTarget,
  };
}
