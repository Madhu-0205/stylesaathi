import {
  WardrobeItem,
  WearEvent,
  FabricType,
  PatternType,
  SilhouetteFit,
} from '../../types';
import {
  CostPerWearAnalysis,
  ItemRotationAnalysis,
  NormalizedFabricGroup,
  NormalizedPatternGroup,
  NormalizedSilhouetteGroup,
  OrphanWearMetrics,
  ParetoConcentrationMetrics,
  ReconciledItemWears,
  RotationHealthMetrics,
  RotationState,
  WearAnalyticsReport,
} from './types';
import { computeStyleSnapshotsAndEvolution } from './styleEvolutionEngine';

export const NEUTRAL_COLORS = [
  'black',
  'white',
  'cream',
  'beige',
  'navy',
  'grey',
  'brown',
  'tan',
  'silver',
  'gold',
];

export const BREATHABLE_FABRICS: FabricType[] = [
  'cotton',
  'linen',
  'khadi',
  'mulmul',
  'chanderi',
  'modal',
];

export const STRUCTURED_HEAVY_FABRICS: FabricType[] = [
  'wool',
  'velvet',
  'tussar',
  'banarasi',
  'polyblend',
];

export const DRAPE_FLUID_FABRICS: FabricType[] = [
  'silk',
  'chiffon',
  'georgette',
  'organza',
  'satin',
  'crepe',
  'rayon',
  'viscose',
];

export const TRADITIONAL_INDIAN_PATTERNS: PatternType[] = [
  'ikat',
  'bandhani',
  'block_print',
  'kalamkari',
  'chikankari',
  'zari_brocade',
];

export const WESTERN_GEOMETRIC_PATTERNS: PatternType[] = [
  'striped',
  'checked',
  'floral',
  'polka_dot',
  'geometric',
  'abstract',
];

export const STRUCTURED_SILHOUETTES: SilhouetteFit[] = ['slim', 'tailored'];
export const STANDARD_SILHOUETTES: SilhouetteFit[] = ['regular', 'straight'];
export const RELAXED_SILHOUETTES: SilhouetteFit[] = [
  'relaxed',
  'oversized',
  'a_line',
  'flared',
  'anarkali',
];

/**
 * Normalizes fabric enum into approved Phase 8 domain groupings.
 */
export function normalizeFabricGroup(fabric?: FabricType): NormalizedFabricGroup {
  if (!fabric || fabric === 'unknown') return 'unknown';
  if (BREATHABLE_FABRICS.includes(fabric)) return 'breathable';
  if (STRUCTURED_HEAVY_FABRICS.includes(fabric)) return 'structured';
  if (DRAPE_FLUID_FABRICS.includes(fabric)) return 'drape';
  if (fabric === 'denim') return 'denim';
  return 'unknown';
}

/**
 * Normalizes pattern enum into approved Phase 8 domain groupings.
 */
export function normalizePatternGroup(pattern?: PatternType): NormalizedPatternGroup {
  if (!pattern || pattern === 'unknown') return 'unknown';
  if (pattern === 'solid') return 'solid';
  if (TRADITIONAL_INDIAN_PATTERNS.includes(pattern)) return 'traditional_indian';
  if (WESTERN_GEOMETRIC_PATTERNS.includes(pattern)) return 'western_geometric';
  return 'unknown';
}

/**
 * Normalizes silhouette fit enum into approved Phase 8 domain groupings.
 */
export function normalizeSilhouetteGroup(fit?: SilhouetteFit): NormalizedSilhouetteGroup {
  if (!fit) return 'unknown';
  if (STRUCTURED_SILHOUETTES.includes(fit)) return 'structured';
  if (STANDARD_SILHOUETTES.includes(fit)) return 'standard';
  if (RELAXED_SILHOUETTES.includes(fit)) return 'relaxed';
  return 'unknown';
}

/**
 * Deduplicates raw WearEvents preserving legitimate same-timestamp events
 * for different items while filtering duplicate IDs and accidental rapid multi-clicks
 * (< 60s for the exact same item). Excludes future timestamps (> now + 24h).
 */
export function deduplicateAndFilterWearEvents(
  rawEvents: readonly WearEvent[],
  referenceTimestamp: number
): WearEvent[] {
  if (rawEvents.length === 0) return [];
  const futureCutoff = referenceTimestamp + 24 * 3600 * 1000;
  const seenIds = new Set<string>();
  const validEvents: WearEvent[] = [];

  // Group events by item for fast local deduplication
  const itemEventsMap = new Map<string, WearEvent[]>();
  for (let i = 0; i < rawEvents.length; i++) {
    const event = rawEvents[i];
    if (event.wornAt > futureCutoff || seenIds.has(event.id)) {
      continue;
    }
    seenIds.add(event.id);
    let list = itemEventsMap.get(event.wardrobeItemId);
    if (!list) {
      list = [];
      itemEventsMap.set(event.wardrobeItemId, list);
    }
    list.push(event);
  }

  for (const list of itemEventsMap.values()) {
    if (list.length > 1) {
      list.sort((a, b) => a.wornAt - b.wornAt);
      let lastValid = list[0];
      validEvents.push(lastValid);
      for (let j = 1; j < list.length; j++) {
        const cur = list[j];
        if (
          cur.wornAt - lastValid.wornAt < 60000 &&
          (lastValid.plannedDate === cur.plannedDate || !cur.plannedDate || !lastValid.plannedDate)
        ) {
          continue;
        }
        lastValid = cur;
        validEvents.push(cur);
      }
    } else if (list.length === 1) {
      validEvents.push(list[0]);
    }
  }

  return validEvents;
}

/**
 * Reconciles granular WearEvents against item-level timesWorn counters.
 */
export function reconcileItemWears(
  item: WardrobeItem,
  itemEvents: readonly WearEvent[]
): ReconciledItemWears {
  const eventCount = itemEvents.length;
  const counterTimesWorn = item.timesWorn || 0;

  if (eventCount === counterTimesWorn) {
    return {
      itemId: item.id,
      canonicalEventCount: eventCount,
      counterTimesWorn,
      effectiveLifetimeWears: eventCount,
      legacyWearsDelta: 0,
      reconciliationCase: 'A_MATCH',
    };
  }

  if (eventCount > counterTimesWorn) {
    return {
      itemId: item.id,
      canonicalEventCount: eventCount,
      counterTimesWorn,
      effectiveLifetimeWears: eventCount,
      legacyWearsDelta: 0,
      reconciliationCase: 'B_EVENT_STREAM_PRECEDENCE',
    };
  }

  if (eventCount === 0 && counterTimesWorn > 0) {
    return {
      itemId: item.id,
      canonicalEventCount: 0,
      counterTimesWorn,
      effectiveLifetimeWears: counterTimesWorn,
      legacyWearsDelta: counterTimesWorn,
      reconciliationCase: 'D_PURE_LEGACY',
    };
  }

  // counterTimesWorn > eventCount && eventCount > 0
  const legacyDelta = counterTimesWorn - eventCount;
  return {
    itemId: item.id,
    canonicalEventCount: eventCount,
    counterTimesWorn,
    effectiveLifetimeWears: counterTimesWorn,
    legacyWearsDelta: legacyDelta,
    reconciliationCase: 'C_LEGACY_DELTA',
  };
}

/**
 * Calculates deterministic Cost-Per-Wear (CPW) analysis.
 */
export function computeCostPerWear(
  item: WardrobeItem,
  effectiveWears: number
): CostPerWearAnalysis {
  const price = item.purchasePrice;

  // Invalid or negative price
  if (price === undefined || price === null || price < 0) {
    return {
      purchasePrice: undefined,
      effectiveWears,
      costPerWear: undefined,
      unamortizedCost: undefined,
      status: 'unpriced',
      formattedCPW: 'Price not set',
    };
  }

  // ₹0 price (Gift, hand-me-down, heirloom)
  if (price === 0) {
    return {
      purchasePrice: 0,
      effectiveWears,
      costPerWear: undefined,
      unamortizedCost: 0,
      status: 'unpriced',
      formattedCPW: 'Gift / Zero Cost',
    };
  }

  // Positive price + 0 wears (Unamortized)
  if (effectiveWears === 0) {
    return {
      purchasePrice: price,
      effectiveWears: 0,
      costPerWear: undefined,
      unamortizedCost: price,
      status: 'unworn',
      formattedCPW: 'Not worn yet',
    };
  }

  // Positive price + >= 1 wear (Amortizing)
  const cpw = Math.round((price / effectiveWears) * 100) / 100;
  const displayCpw = cpw >= 10 ? `₹${Math.round(cpw)}` : `₹${cpw.toFixed(1)}`;

  return {
    purchasePrice: price,
    effectiveWears,
    costPerWear: cpw,
    unamortizedCost: 0,
    status: 'amortizing',
    formattedCPW: `${displayCpw}/wear`,
  };
}

/**
 * Calculates rotation state for an item based on objective product heuristics.
 */
export function computeItemRotationState(
  item: WardrobeItem,
  effectiveWears: number,
  referenceTimestamp: number
): { state: RotationState; lastWornDaysAgo?: number; itemAgeDays: number } {
  const itemAgeDays = Math.max(
    0,
    Math.floor((referenceTimestamp - (item.createdAt || referenceTimestamp)) / (24 * 3600 * 1000))
  );

  const lastWornDaysAgo =
    item.lastWorn && item.lastWorn <= referenceTimestamp
      ? Math.max(0, Math.floor((referenceTimestamp - item.lastWorn) / (24 * 3600 * 1000)))
      : undefined;

  // 1. Never worn (with 14-day grace period for new additions)
  if (effectiveWears === 0) {
    if (itemAgeDays > 14) {
      return { state: 'never_worn', lastWornDaysAgo, itemAgeDays };
    }
    // Newly added items (< 14 days) are treated as occasional while finding initial rotation
    return { state: 'occasional', lastWornDaysAgo, itemAgeDays };
  }

  // 2. Active rotation: worn within last 30 days
  if (lastWornDaysAgo !== undefined && lastWornDaysAgo <= 30) {
    return { state: 'active', lastWornDaysAgo, itemAgeDays };
  }

  // 3. Occasional rotation: worn between 31 and 90 days
  if (lastWornDaysAgo !== undefined && lastWornDaysAgo <= 90) {
    return { state: 'occasional', lastWornDaysAgo, itemAgeDays };
  }

  // 4. Dormant: has wear count > 0, but no wear in > 90 days AND item age > 90 days
  if (itemAgeDays > 90) {
    return { state: 'dormant', lastWornDaysAgo, itemAgeDays };
  }

  return { state: 'occasional', lastWornDaysAgo, itemAgeDays };
}

/**
 * Evaluates Stage 3 continuous confidence score (0.0 to 1.0).
 */
export function calculateAnalyticsConfidence(
  totalWears: number,
  uniqueGarmentsWorn: number,
  timeSpanDays: number
): number {
  if (totalWears === 0) return 0;
  const volumeFactor = Math.min(1.0, totalWears / 30);
  const timeSpanFactor = Math.min(1.0, Math.max(0, timeSpanDays) / 60);
  const coverageFactor = Math.min(1.0, uniqueGarmentsWorn / 12);

  const rawScore = 0.4 * volumeFactor + 0.35 * timeSpanFactor + 0.25 * coverageFactor;
  return Math.round(Math.min(1.0, Math.max(0, rawScore)) * 100) / 100;
}

/**
 * Computes Pareto concentration metrics (Top 20% item wear share).
 */
export function computeParetoConcentration(
  itemsAnalysis: ItemRotationAnalysis[],
  totalLifetimeWears: number,
  confidence: number
): ParetoConcentrationMetrics {
  const totalWardrobeCount = itemsAnalysis.length;

  // Gating Stage 2: Requires totalLifetimeWears >= 15 AND wardrobeCount >= 10 AND confidence >= 0.50
  if (totalLifetimeWears < 15 || totalWardrobeCount < 10) {
    return {
      isEligible: false,
      ineligibilityReason: 'Requires at least 15 recorded wears across 10 or more wardrobe items',
      confidence,
      kItemsCount: Math.ceil(0.2 * totalWardrobeCount),
      totalWardrobeCount,
      topKWears: 0,
      totalLifetimeWears,
    };
  }

  if (confidence < 0.5) {
    return {
      isEligible: false,
      ineligibilityReason: 'Confidence is establishing — more wear depth needed for concentration analysis',
      confidence,
      kItemsCount: Math.ceil(0.2 * totalWardrobeCount),
      totalWardrobeCount,
      topKWears: 0,
      totalLifetimeWears,
    };
  }

  const kItemsCount = Math.max(1, Math.ceil(0.2 * totalWardrobeCount));
  const sortedByWears = [...itemsAnalysis].sort((a, b) => b.effectiveWears - a.effectiveWears);
  const topKWears = sortedByWears.slice(0, kItemsCount).reduce((sum, item) => sum + item.effectiveWears, 0);

  const concentrationRatio = Math.round((topKWears / totalLifetimeWears) * 100);

  let interpretation: 'High Concentration' | 'Balanced Rotation' | 'High Variety' = 'Balanced Rotation';
  let explanation = 'Your usage is distributed evenly across your core pieces.';

  if (concentrationRatio >= 70) {
    interpretation = 'High Concentration';
    explanation = `Top ${kItemsCount} items (${Math.round((kItemsCount / totalWardrobeCount) * 100)}% of wardrobe) account for ${concentrationRatio}% of recorded wears.`;
  } else if (concentrationRatio < 40) {
    interpretation = 'High Variety';
    explanation = `Your wardrobe usage is highly dispersed across diverse pieces.`;
  }

  return {
    isEligible: true,
    confidence,
    kItemsCount,
    totalWardrobeCount,
    topKWears,
    totalLifetimeWears,
    concentrationRatio,
    interpretation,
    explanation,
  };
}

/**
 * Primary pure engine function: Computes complete WearAnalyticsReport.
 * Invariant: Never mutates input arrays; accepts injected referenceTimestamp.
 */
export function computeWearAnalytics(
  items: readonly WardrobeItem[],
  rawWearEvents: readonly WearEvent[],
  referenceTimestamp: number = Date.now()
): WearAnalyticsReport {
  const now = referenceTimestamp;

  // 1. Deduplicate events & filter future timestamps
  const validEvents = deduplicateAndFilterWearEvents(rawWearEvents, now);

  // 2. Partition events by item ID and detect orphaned events
  const itemMap = new Map<string, WardrobeItem>();
  for (const item of items) {
    itemMap.set(item.id, item);
  }

  const eventsByItem = new Map<string, WearEvent[]>();
  let unresolvedOrphanCount = 0;

  for (const event of validEvents) {
    if (itemMap.has(event.wardrobeItemId)) {
      let list = eventsByItem.get(event.wardrobeItemId);
      if (!list) {
        list = [];
        eventsByItem.set(event.wardrobeItemId, list);
      }
      list.push(event);
    } else {
      unresolvedOrphanCount++;
    }
  }

  // 3. Reconcile wear counts for all items
  const reconciledWears: Record<string, ReconciledItemWears> = {};
  const itemsAnalysis: ItemRotationAnalysis[] = [];
  const itemsByState: Record<RotationState, ItemRotationAnalysis[]> = {
    active: [],
    occasional: [],
    dormant: [],
    never_worn: [],
  };
  let totalCleanItems = 0;
  let totalItemWearsSum = 0;
  let uniqueWornItemsCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.status === 'clean') {
      totalCleanItems++;
    }

    const itemEvents = eventsByItem.get(item.id) || [];
    const reconciliation = reconcileItemWears(item, itemEvents);
    reconciledWears[item.id] = reconciliation;

    const effectiveWears = reconciliation.effectiveLifetimeWears;
    totalItemWearsSum += effectiveWears;
    if (effectiveWears > 0) {
      uniqueWornItemsCount++;
    }

    const cpw = computeCostPerWear(item, effectiveWears);
    const { state, lastWornDaysAgo, itemAgeDays } = computeItemRotationState(
      item,
      effectiveWears,
      now
    );

    const analysis: ItemRotationAnalysis = {
      item,
      state,
      effectiveWears,
      lastWornDaysAgo,
      itemAgeDays,
      costPerWear: cpw,
    };
    itemsAnalysis.push(analysis);
    itemsByState[state].push(analysis);
  }

  // Orphaned events count toward totalLifetimeWears, but are omitted from attribute distributions
  const totalLifetimeWears = totalItemWearsSum + unresolvedOrphanCount;

  // 4. Time span calculation
  let earliestTimestamp = now;
  for (let i = 0; i < validEvents.length; i++) {
    if (validEvents[i].wornAt < earliestTimestamp) {
      earliestTimestamp = validEvents[i].wornAt;
    }
  }
  const timeSpanDays = Math.max(0, Math.floor((now - earliestTimestamp) / (24 * 3600 * 1000)));

  // 5. Global confidence calculation
  const overallConfidence = calculateAnalyticsConfidence(
    totalLifetimeWears,
    uniqueWornItemsCount,
    timeSpanDays
  );

  // 6. Rotation Health Metrics
  const activeCount = itemsByState.active.length;
  const occasionalCount = itemsByState.occasional.length;
  const dormantCount = itemsByState.dormant.length;
  const neverWornCount = itemsByState.never_worn.length;

  const isRotationEligible =
    totalLifetimeWears >= 10 && totalCleanItems >= 5 && overallConfidence >= 0.35;

  const rotationHealthPercentage =
    isRotationEligible && totalCleanItems > 0
      ? Math.round((activeCount / totalCleanItems) * 100)
      : undefined;

  const rotationMetrics: RotationHealthMetrics = {
    isEligible: isRotationEligible,
    ineligibilityReason: !isRotationEligible
      ? 'Requires at least 10 recorded wears across 5 clean wardrobe items'
      : undefined,
    confidence: overallConfidence,
    totalCleanItems,
    activeCount,
    occasionalCount,
    dormantCount,
    neverWornCount,
    rotationHealthPercentage,
    itemsByState,
  };

  // 7. Pareto Concentration Metrics
  const concentration = computeParetoConcentration(
    itemsAnalysis,
    totalLifetimeWears,
    overallConfidence
  );

  // 8. Snapshots & Style Evolution (Phase 8 Pure Projection)
  const { snapshots, evolution } = computeStyleSnapshotsAndEvolution(
    itemMap,
    validEvents,
    reconciledWears,
    now
  );

  // 9. Sorted Top & Dormant Lists
  const mostWornItems = [...itemsAnalysis]
    .filter((i) => i.effectiveWears > 0)
    .sort((a, b) => b.effectiveWears - a.effectiveWears)
    .slice(0, 6);

  const dormantItems = [...itemsByState.dormant, ...itemsByState.never_worn]
    .sort((a, b) => (b.lastWornDaysAgo || 999) - (a.lastWornDaysAgo || 999))
    .slice(0, 6);

  const orphans: OrphanWearMetrics = {
    unresolvedOrphanCount,
    explanation:
      unresolvedOrphanCount > 0
        ? `Includes ${unresolvedOrphanCount} historical wears from retired garments (attribute details archived).`
        : undefined,
  };

  return {
    generatedAt: now,
    referenceTimestamp: now,
    totalLifetimeWears,
    uniqueWornItemsCount,
    reconciledWears,
    rotation: rotationMetrics,
    concentration,
    evolution,
    orphans,
    snapshots,
    mostWornItems,
    dormantItems,
  };
}
