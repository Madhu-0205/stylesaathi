import {
  WardrobeItem,
  WearEvent,
} from '../../types';
import {
  AttributeDistribution,
  EvolutionDimensionDelta,
  NormalizedFabricGroup,
  NormalizedPatternGroup,
  NormalizedSilhouetteGroup,
  ReconciledItemWears,
  SnapshotWindowId,
  StyleEvolutionReport,
  StyleSnapshot,
} from './types';
import {
  NEUTRAL_COLORS_SET,
  normalizeFabricGroup,
  normalizePatternGroup,
  normalizeSilhouetteGroup,
} from './wearAnalyticsEngine';

/**
 * Builds normalized AttributeDistribution from weighted value counts.
 */
function buildDistribution(counts: Record<string, number>): AttributeDistribution {
  let total = 0;
  for (const key in counts) {
    total += counts[key];
  }
  const percentages: Record<string, number> = {};
  let topAttribute: string | undefined;
  let topWeight = -1;

  for (const key in counts) {
    const weight = counts[key];
    const pct = total > 0 ? Math.round((weight / total) * 100) / 100 : 0;
    percentages[key] = pct;
    if (weight > topWeight) {
      topWeight = weight;
      topAttribute = key;
    }
  }

  return {
    counts,
    percentages,
    topAttribute,
  };
}

export interface ItemStyleProfile {
  item: WardrobeItem;
  colors: string[];
  colorWeight: number;
  neutralWeight: number;
  fabricGroup: NormalizedFabricGroup;
  isBreathable: boolean;
  patternGroup: NormalizedPatternGroup;
  isSolid: boolean;
  silhouetteGroup: NormalizedSilhouetteGroup;
  isRelaxed: boolean;
  formality: number;
  isEthnic: boolean;
}

export function buildItemStyleProfile(item: WardrobeItem): ItemStyleProfile {
  const colors = item.colors.length > 0 ? item.colors.map((c) => c.trim().toLowerCase()) : ['unknown'];
  const colorWeight = 1.0 / colors.length;
  let neutralWeight = 0;
  for (let i = 0; i < colors.length; i++) {
    if (NEUTRAL_COLORS_SET.has(colors[i])) neutralWeight += colorWeight;
  }
  const fabricGroup = normalizeFabricGroup(item.fabric);
  const patternGroup = normalizePatternGroup(item.pattern);
  const silhouetteGroup = normalizeSilhouetteGroup(item.fit);

  return {
    item,
    colors,
    colorWeight,
    neutralWeight,
    fabricGroup,
    isBreathable: fabricGroup === 'breathable',
    patternGroup,
    isSolid: patternGroup === 'solid',
    silhouetteGroup,
    isRelaxed: silhouetteGroup === 'relaxed',
    formality: item.formality || 3,
    isEthnic: item.category === 'Ethnic',
  };
}

/**
 * Computes a single read-only StyleSnapshot projection for a temporal window.
 */
export function computeStyleSnapshot(
  windowId: SnapshotWindowId,
  windowStartMs: number,
  windowEndMs: number,
  itemsOrProfiles: readonly WardrobeItem[] | ReadonlyMap<string, WardrobeItem> | ReadonlyMap<string, ItemStyleProfile>,
  eventsInWindow: readonly WearEvent[] | ReadonlyMap<string, number>,
  totalWearEventsOverride?: number
): StyleSnapshot {
  let profileMap: ReadonlyMap<string, ItemStyleProfile>;
  if (itemsOrProfiles instanceof Map) {
    const firstVal = itemsOrProfiles.values().next().value;
    if (firstVal && 'colorWeight' in firstVal) {
      profileMap = itemsOrProfiles as ReadonlyMap<string, ItemStyleProfile>;
    } else {
      const pm = new Map<string, ItemStyleProfile>();
      for (const item of (itemsOrProfiles as ReadonlyMap<string, WardrobeItem>).values()) {
        pm.set(item.id, buildItemStyleProfile(item));
      }
      profileMap = pm;
    }
  } else {
    const pm = new Map<string, ItemStyleProfile>();
    for (const item of itemsOrProfiles as readonly WardrobeItem[]) {
      pm.set(item.id, buildItemStyleProfile(item));
    }
    profileMap = pm;
  }

  const colorCounts: Record<string, number> = {};
  const fabricCounts: Record<string, number> = {};
  const patternCounts: Record<string, number> = {};
  const silhouetteCounts: Record<string, number> = {};

  let totalGarmentsCount = 0;
  let totalFormalitySum = 0;
  let ethnicGarmentsCount = 0;

  let neutralColorWeightSum = 0;
  let totalColorWeightSum = 0;

  let breathableFabricWeightSum = 0;
  let classifiedFabricWeightSum = 0;

  let solidPatternWeightSum = 0;
  let classifiedPatternWeightSum = 0;

  let relaxedSilhouetteWeightSum = 0;
  let classifiedSilhouetteWeightSum = 0;

  let uniqueGarmentsWorn = 0;
  let eventCountsByItem: ReadonlyMap<string, number>;
  let totalWearEvents: number;

  if (Array.isArray(eventsInWindow)) {
    const countsMap = new Map<string, number>();
    for (let i = 0; i < eventsInWindow.length; i++) {
      const id = eventsInWindow[i].wardrobeItemId;
      countsMap.set(id, (countsMap.get(id) || 0) + 1);
    }
    eventCountsByItem = countsMap;
    totalWearEvents = totalWearEventsOverride !== undefined ? totalWearEventsOverride : eventsInWindow.length;
  } else {
    const mapInput = eventsInWindow as ReadonlyMap<string, number>;
    eventCountsByItem = mapInput;
    if (totalWearEventsOverride !== undefined) {
      totalWearEvents = totalWearEventsOverride;
    } else {
      let sum = 0;
      for (const c of mapInput.values()) sum += c;
      totalWearEvents = sum;
    }
  }

  for (const [itemId, count] of eventCountsByItem.entries()) {
    if (count <= 0) continue;
    const profile = profileMap.get(itemId);
    // Exclude orphaned events from attribute distributions
    if (!profile) continue;

    uniqueGarmentsWorn++;
    totalGarmentsCount += count;
    totalFormalitySum += profile.formality * count;

    if (profile.isEthnic) {
      ethnicGarmentsCount += count;
    }

    // 1. Color with fractional weighting (1 / N colors per wear)
    totalColorWeightSum += count;
    neutralColorWeightSum += profile.neutralWeight * count;
    const itemColorWeight = profile.colorWeight * count;
    for (let c = 0; c < profile.colors.length; c++) {
      const col = profile.colors[c];
      colorCounts[col] = (colorCounts[col] || 0) + itemColorWeight;
    }

    // 2. Fabric grouping
    fabricCounts[profile.fabricGroup] = (fabricCounts[profile.fabricGroup] || 0) + count;
    if (profile.fabricGroup !== 'unknown') {
      classifiedFabricWeightSum += count;
      if (profile.isBreathable) {
        breathableFabricWeightSum += count;
      }
    }

    // 3. Pattern grouping
    patternCounts[profile.patternGroup] = (patternCounts[profile.patternGroup] || 0) + count;
    if (profile.patternGroup !== 'unknown') {
      classifiedPatternWeightSum += count;
      if (profile.isSolid) {
        solidPatternWeightSum += count;
      }
    }

    // 4. Silhouette grouping
    silhouetteCounts[profile.silhouetteGroup] = (silhouetteCounts[profile.silhouetteGroup] || 0) + count;
    if (profile.silhouetteGroup !== 'unknown') {
      classifiedSilhouetteWeightSum += count;
      if (profile.isRelaxed) {
        relaxedSilhouetteWeightSum += count;
      }
    }
  }

  const neutralColorRatio =
    totalColorWeightSum > 0
      ? Math.round((neutralColorWeightSum / totalColorWeightSum) * 100) / 100
      : 0;

  const breathableFabricRatio =
    classifiedFabricWeightSum > 0
      ? Math.round((breathableFabricWeightSum / classifiedFabricWeightSum) * 100) / 100
      : 0;

  const solidPatternRatio =
    classifiedPatternWeightSum > 0
      ? Math.round((solidPatternWeightSum / classifiedPatternWeightSum) * 100) / 100
      : 0;

  const relaxedSilhouetteRatio =
    classifiedSilhouetteWeightSum > 0
      ? Math.round((relaxedSilhouetteWeightSum / classifiedSilhouetteWeightSum) * 100) / 100
      : 0;

  const averageFormality =
    totalGarmentsCount > 0
      ? Math.round((totalFormalitySum / totalGarmentsCount) * 10) / 10
      : 3.0;

  const ethnicGarmentRatio =
    totalGarmentsCount > 0
      ? Math.round((ethnicGarmentsCount / totalGarmentsCount) * 100) / 100
      : 0;

  // Window sample eligibility: minimum wears required per window
  const isEligible =
    windowId === 'recent_30d' || windowId === 'baseline_60d'
      ? totalWearEvents >= 8
      : totalWearEvents >= 3;

  return {
    windowId,
    windowStartMs,
    windowEndMs,
    totalWearEvents,
    uniqueGarmentsWorn,
    isEligible,
    color: buildDistribution(colorCounts),
    neutralColorRatio,
    fabric: buildDistribution(fabricCounts),
    breathableFabricRatio,
    pattern: buildDistribution(patternCounts),
    solidPatternRatio,
    silhouette: buildDistribution(silhouetteCounts),
    relaxedSilhouetteRatio,
    averageFormality,
    ethnicGarmentRatio,
  };
}

/**
 * Computes deterministic StyleEvolutionReport comparing recent_30d and baseline_60d snapshots.
 */
export function computeStyleEvolution(
  recentSnapshot: StyleSnapshot,
  baselineSnapshot: StyleSnapshot,
  totalLifetimeWears: number,
  timeSpanDays: number
): StyleEvolutionReport {
  // Hard Gate Stage 1: Global total wears >= 16
  if (totalLifetimeWears < 16) {
    return {
      isEligible: false,
      ineligibilityReason: 'Requires at least 16 recorded wears across your wardrobe history',
      confidence: 0,
      baselineSnapshot,
      recentSnapshot,
      dimensions: [],
      significantShifts: [],
    };
  }

  // Hard Gate Stage 2: Both windows MUST have >= 8 valid wear events
  if (recentSnapshot.totalWearEvents < 8 || baselineSnapshot.totalWearEvents < 8) {
    return {
      isEligible: false,
      ineligibilityReason: `Establishing baseline — requires at least 8 wears in both periods (Recent: ${recentSnapshot.totalWearEvents}, Baseline: ${baselineSnapshot.totalWearEvents})`,
      confidence: 0,
      baselineSnapshot,
      recentSnapshot,
      dimensions: [],
      significantShifts: [],
    };
  }

  // Hard Gate Stage 3: Statistical confidence >= 0.60
  const combinedWears = recentSnapshot.totalWearEvents + baselineSnapshot.totalWearEvents;
  const uniqueGarments = Math.max(recentSnapshot.uniqueGarmentsWorn, baselineSnapshot.uniqueGarmentsWorn);

  const volumeFactor = Math.min(1.0, combinedWears / 30);
  const timeSpanFactor = Math.min(1.0, Math.max(0, timeSpanDays) / 60);
  const coverageFactor = Math.min(1.0, uniqueGarments / 12);
  const confidence = Math.round((0.4 * volumeFactor + 0.35 * timeSpanFactor + 0.25 * coverageFactor) * 100) / 100;

  if (confidence < 0.6) {
    return {
      isEligible: false,
      ineligibilityReason: 'Confidence establishing — more temporal depth needed across seasonal cycles',
      confidence,
      baselineSnapshot,
      recentSnapshot,
      dimensions: [],
      significantShifts: [],
    };
  }

  // Dimension 1: Palette (Neutrals)
  const paletteDelta = Math.round((recentSnapshot.neutralColorRatio - baselineSnapshot.neutralColorRatio) * 100) / 100;
  const isPaletteSignificant = Math.abs(paletteDelta) >= 0.15;
  const paletteHeadline =
    paletteDelta >= 0.15
      ? 'Recent recorded wears contain a higher proportion of neutral colors.'
      : paletteDelta <= -0.15
      ? 'Recent recorded wears feature more vibrant and expressive color palettes.'
      : 'Your color palette distribution has remained stable.';
  const paletteEvidence = `Recent 30d: ${Math.round(recentSnapshot.neutralColorRatio * 100)}% neutrals · Baseline: ${Math.round(baselineSnapshot.neutralColorRatio * 100)}% neutrals (Δ ${paletteDelta > 0 ? '+' : ''}${Math.round(paletteDelta * 100)}%)`;

  const paletteDimension: EvolutionDimensionDelta = {
    dimension: 'palette',
    baselineRatio: baselineSnapshot.neutralColorRatio,
    recentRatio: recentSnapshot.neutralColorRatio,
    deltaRatio: paletteDelta,
    isSignificant: isPaletteSignificant,
    headline: paletteHeadline,
    evidenceText: paletteEvidence,
  };

  // Dimension 2: Textile (Breathable Fabrics)
  const textileDelta = Math.round((recentSnapshot.breathableFabricRatio - baselineSnapshot.breathableFabricRatio) * 100) / 100;
  const isTextileSignificant = Math.abs(textileDelta) >= 0.15;
  const textileHeadline =
    textileDelta >= 0.15
      ? 'Increased usage of lightweight, breathable fabrics over recent weeks.'
      : textileDelta <= -0.15
      ? 'Recent wardrobe usage features more structured and heavier textiles.'
      : 'Your textile preferences have remained consistent.';
  const textileEvidence = `Recent 30d: ${Math.round(recentSnapshot.breathableFabricRatio * 100)}% breathable · Baseline: ${Math.round(baselineSnapshot.breathableFabricRatio * 100)}% (Δ ${textileDelta > 0 ? '+' : ''}${Math.round(textileDelta * 100)}%)`;

  const textileDimension: EvolutionDimensionDelta = {
    dimension: 'textile',
    baselineRatio: baselineSnapshot.breathableFabricRatio,
    recentRatio: recentSnapshot.breathableFabricRatio,
    deltaRatio: textileDelta,
    isSignificant: isTextileSignificant,
    headline: textileHeadline,
    evidenceText: textileEvidence,
  };

  // Dimension 3: Pattern (Solid vs Prints)
  const patternDelta = Math.round((recentSnapshot.solidPatternRatio - baselineSnapshot.solidPatternRatio) * 100) / 100;
  const isPatternSignificant = Math.abs(patternDelta) >= 0.15;
  const patternHeadline =
    patternDelta >= 0.15
      ? 'Recent outfits feature more solid pieces compared to prints.'
      : patternDelta <= -0.15
      ? 'Recent outfits incorporate more traditional and expressive printed motifs.'
      : 'Your pattern balance between solids and prints has remained steady.';
  const patternEvidence = `Recent 30d: ${Math.round(recentSnapshot.solidPatternRatio * 100)}% solids · Baseline: ${Math.round(baselineSnapshot.solidPatternRatio * 100)}% (Δ ${patternDelta > 0 ? '+' : ''}${Math.round(patternDelta * 100)}%)`;

  const patternDimension: EvolutionDimensionDelta = {
    dimension: 'pattern',
    baselineRatio: baselineSnapshot.solidPatternRatio,
    recentRatio: recentSnapshot.solidPatternRatio,
    deltaRatio: patternDelta,
    isSignificant: isPatternSignificant,
    headline: patternHeadline,
    evidenceText: patternEvidence,
  };

  // Dimension 4: Silhouette (Relaxed / Flared vs Structured)
  const silhouetteDelta = Math.round((recentSnapshot.relaxedSilhouetteRatio - baselineSnapshot.relaxedSilhouetteRatio) * 100) / 100;
  const isSilhouetteSignificant = Math.abs(silhouetteDelta) >= 0.15;
  const silhouetteHeadline =
    silhouetteDelta >= 0.15
      ? 'Recent outfits lean toward relaxed and fluid silhouettes.'
      : silhouetteDelta <= -0.15
      ? 'Recent outfits feature more structured and tailored fits.'
      : 'Your silhouette profile has remained balanced.';
  const silhouetteEvidence = `Recent 30d: ${Math.round(recentSnapshot.relaxedSilhouetteRatio * 100)}% relaxed · Baseline: ${Math.round(baselineSnapshot.relaxedSilhouetteRatio * 100)}% (Δ ${silhouetteDelta > 0 ? '+' : ''}${Math.round(silhouetteDelta * 100)}%)`;

  const silhouetteDimension: EvolutionDimensionDelta = {
    dimension: 'silhouette',
    baselineRatio: baselineSnapshot.relaxedSilhouetteRatio,
    recentRatio: recentSnapshot.relaxedSilhouetteRatio,
    deltaRatio: silhouetteDelta,
    isSignificant: isSilhouetteSignificant,
    headline: silhouetteHeadline,
    evidenceText: silhouetteEvidence,
  };

  // Dimension 5: Formality (Average Formality Scale 1-5)
  const formalityDelta = Math.round((recentSnapshot.averageFormality - baselineSnapshot.averageFormality) * 10) / 10;
  const isFormalitySignificant = Math.abs(formalityDelta) >= 0.5;
  const formalityHeadline =
    formalityDelta >= 0.5
      ? 'Your recent wardrobe usage is more formal than the baseline period.'
      : formalityDelta <= -0.5
      ? 'Your recent wardrobe usage is more casual than the baseline period.'
      : 'Your overall formality profile has remained stable.';
  const formalityEvidence = `Recent 30d: ${recentSnapshot.averageFormality} avg formality · Baseline: ${baselineSnapshot.averageFormality} (Δ ${formalityDelta > 0 ? '+' : ''}${formalityDelta})`;

  const formalityDimension: EvolutionDimensionDelta = {
    dimension: 'formality',
    baselineRatio: baselineSnapshot.averageFormality,
    recentRatio: recentSnapshot.averageFormality,
    deltaRatio: formalityDelta,
    isSignificant: isFormalitySignificant,
    headline: formalityHeadline,
    evidenceText: formalityEvidence,
  };

  const dimensions = [
    paletteDimension,
    textileDimension,
    patternDimension,
    silhouetteDimension,
    formalityDimension,
  ];

  const significantShifts = dimensions.filter((d) => d.isSignificant);

  return {
    isEligible: true,
    confidence,
    baselineSnapshot,
    recentSnapshot,
    dimensions,
    significantShifts,
  };
}

/**
 * Computes all 4 standard temporal window snapshots and style evolution.
 */
export function computeStyleSnapshotsAndEvolution(
  items: readonly WardrobeItem[] | ReadonlyMap<string, WardrobeItem>,
  validEvents: readonly WearEvent[],
  reconciledWears: Record<string, ReconciledItemWears>,
  referenceTimestamp: number,
  precalculatedLifetimeWears?: number
): {
  snapshots: Record<SnapshotWindowId, StyleSnapshot>;
  evolution: StyleEvolutionReport;
} {
  const now = referenceTimestamp;
  const t7d = now - 7 * 86400000;
  const t30d = now - 30 * 86400000;
  const t90d = now - 90 * 86400000;

  interface ItemCountsBucket {
    w: number;
    r: number;
    b: number;
    a: number;
  }
  const buckets = new Map<string, ItemCountsBucket>();
  let weeklyCount = 0;
  let recentCount = 0;
  let baselineCount = 0;
  let allTimeCount = 0;

  let earliestTime = now;

  for (let i = 0; i < validEvents.length; i++) {
    const e = validEvents[i];
    if (e.wornAt <= now) {
      if (e.wornAt < earliestTime) {
        earliestTime = e.wornAt;
      }
      allTimeCount++;
      let b = buckets.get(e.wardrobeItemId);
      if (!b) {
        b = { w: 0, r: 0, b: 0, a: 0 };
        buckets.set(e.wardrobeItemId, b);
      }
      b.a++;
      if (e.wornAt >= t7d) {
        weeklyCount++;
        b.w++;
      }
      if (e.wornAt >= t30d) {
        recentCount++;
        b.r++;
      } else if (e.wornAt >= t90d) {
        baselineCount++;
        b.b++;
      }
    }
  }

  const weeklyItemCounts = new Map<string, number>();
  const recentItemCounts = new Map<string, number>();
  const baselineItemCounts = new Map<string, number>();
  const allTimeItemCounts = new Map<string, number>();

  for (const [id, b] of buckets.entries()) {
    allTimeItemCounts.set(id, b.a);
    if (b.w > 0) weeklyItemCounts.set(id, b.w);
    if (b.r > 0) recentItemCounts.set(id, b.r);
    if (b.b > 0) baselineItemCounts.set(id, b.b);
  }

  const profileMap = new Map<string, ItemStyleProfile>();
  const iterable = items instanceof Map ? items.values() : items;
  for (const item of iterable) {
    profileMap.set(item.id, buildItemStyleProfile(item));
  }

  const weeklySnapshot = computeStyleSnapshot('weekly_7d', t7d, now, profileMap, weeklyItemCounts, weeklyCount);
  const recentSnapshot = computeStyleSnapshot('recent_30d', t30d, now, profileMap, recentItemCounts, recentCount);
  const baselineSnapshot = computeStyleSnapshot('baseline_60d', t90d, t30d, profileMap, baselineItemCounts, baselineCount);
  const allTimeSnapshot = computeStyleSnapshot('all_time', 0, now, profileMap, allTimeItemCounts, allTimeCount);

  const timeSpanDays = Math.max(0, Math.floor((now - earliestTime) / 86400000));
  let totalLifetimeWears = precalculatedLifetimeWears;
  if (totalLifetimeWears === undefined) {
    totalLifetimeWears = 0;
    for (const key in reconciledWears) {
      totalLifetimeWears += reconciledWears[key].effectiveLifetimeWears;
    }
  }

  const evolution = computeStyleEvolution(
    recentSnapshot,
    baselineSnapshot,
    totalLifetimeWears,
    timeSpanDays
  );

  return {
    snapshots: {
      weekly_7d: weeklySnapshot,
      recent_30d: recentSnapshot,
      baseline_60d: baselineSnapshot,
      all_time: allTimeSnapshot,
    },
    evolution,
  };
}
