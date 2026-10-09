import { WardrobeItem, Occasion, Season, StylePreferences, PersonalStyleProfile } from '../types';

/**
 * Stratified Quota Model for Candidate Pre-Ranking:
 *
 * Max 10 candidates per slot:
 * - 4 × Core Affinity / Staples (favorites, high learned affinity, high formality fit)
 * - 3 × Freshness / Rotation (unworn or longest time since worn)
 * - 3 × Novelty / Under-Explored (low sample count, recently added, zero negative signals)
 *
 * Secondary tie-breaking is strictly deterministic by canonical item ID (a.id.localeCompare(b.id)).
 */
export function preRankSlotCandidates(
  slotItems: WardrobeItem[],
  _slotName: string,
  occasion: Occasion,
  _season: Season,
  preferences?: StylePreferences,
  styleProfile?: PersonalStyleProfile
): WardrobeItem[] {
  if (slotItems.length <= 10) {
    // Sort deterministically even when pool <= 10
    return [...slotItems].sort((a, b) => {
      const scoreA = computeQuickCoreScore(a, occasion, preferences, styleProfile);
      const scoreB = computeQuickCoreScore(b, occasion, preferences, styleProfile);
      if (Math.abs(scoreB - scoreA) > 0.001) return scoreB - scoreA;
      return a.id.localeCompare(b.id);
    });
  }

  // Helper to determine if an item has strong learned negative avoidance
  const hasStrongAvoidance = (item: WardrobeItem): boolean => {
    if (!styleProfile) return false;

    if (styleProfile.avoidedColors) {
      for (const color of item.colors) {
        if (styleProfile.avoidedColors.includes(color.toLowerCase())) return true;
        const colorAff = styleProfile.colorAffinities?.[color]?.score ?? 0;
        if (colorAff < -0.3) return true;
      }
    }

    if (item.fabric && styleProfile.avoidedFabrics) {
      if (styleProfile.avoidedFabrics.includes(item.fabric)) return true;
      const fabAff = styleProfile.fabricAffinities?.[item.fabric]?.score ?? 0;
      if (fabAff < -0.3) return true;
    }

    const itemAff = styleProfile.itemAffinities?.[item.id]?.score ?? 0;
    if (itemAff < -0.3) return true;

    return false;
  };

  // 1. Bucket 1: Core Affinity / Staples (Quota: 4)
  const coreSorted = [...slotItems].sort((a, b) => {
    const scoreA = computeQuickCoreScore(a, occasion, preferences, styleProfile);
    const scoreB = computeQuickCoreScore(b, occasion, preferences, styleProfile);
    if (Math.abs(scoreB - scoreA) > 0.001) return scoreB - scoreA;
    return a.id.localeCompare(b.id);
  });

  // 2. Bucket 2: Freshness / Rotation (Quota: 3)
  // Prefers unworn or longest time since worn (lastWorn ascending, undefined first)
  const rotationSorted = [...slotItems].sort((a, b) => {
    const timesA = a.timesWorn || 0;
    const timesB = b.timesWorn || 0;
    if (timesA !== timesB) return timesA - timesB;

    const lastA = a.lastWorn ?? 0;
    const lastB = b.lastWorn ?? 0;
    if (lastA !== lastB) return lastA - lastB;

    return a.id.localeCompare(b.id);
  });

  // 3. Bucket 3: Novelty / Under-Explored (Quota: 3)
  // Prefers low sample count, zero negative signals, diverse palette
  const noveltyPool = slotItems.filter((i) => !hasStrongAvoidance(i));
  const noveltySorted = [...noveltyPool].sort((a, b) => {
    const sampleA = styleProfile?.itemAffinities?.[a.id]?.sampleCount ?? (a.timesWorn || 0);
    const sampleB = styleProfile?.itemAffinities?.[b.id]?.sampleCount ?? (b.timesWorn || 0);
    if (sampleA !== sampleB) return sampleA - sampleB;

    // Favor newer created items if sample counts equal
    const createdA = a.createdAt ?? 0;
    const createdB = b.createdAt ?? 0;
    if (createdA !== createdB) return createdB - createdA;

    return a.id.localeCompare(b.id);
  });

  // Stratified selection
  const selected = new Map<string, WardrobeItem>();

  // Add up to 4 Core
  for (const item of coreSorted) {
    if (selected.size >= 4) break;
    selected.set(item.id, item);
  }

  // Add up to 3 Rotation (not already selected)
  let rotationAdded = 0;
  for (const item of rotationSorted) {
    if (rotationAdded >= 3 || selected.size >= 7) break;
    if (!selected.has(item.id)) {
      selected.set(item.id, item);
      rotationAdded++;
    }
  }

  // Add up to 3 Novelty (not already selected)
  let noveltyAdded = 0;
  for (const item of noveltySorted) {
    if (noveltyAdded >= 3 || selected.size >= 10) break;
    if (!selected.has(item.id)) {
      selected.set(item.id, item);
      noveltyAdded++;
    }
  }

  // If we have fewer than 10 candidates (e.g. overlap between buckets), backfill from coreSorted
  if (selected.size < 10) {
    for (const item of coreSorted) {
      if (selected.size >= 10) break;
      if (!selected.has(item.id)) {
        selected.set(item.id, item);
      }
    }
  }

  return Array.from(selected.values());
}

/**
 * Quick, lightweight heuristic for slot-level core affinity ranking.
 * Does NOT duplicate full combinatorial outfit scoring.
 */
function computeQuickCoreScore(
  item: WardrobeItem,
  occasion: Occasion,
  preferences?: StylePreferences,
  styleProfile?: PersonalStyleProfile
): number {
  let score = 0;

  // Favorites are trusted staples
  if (item.favorite) score += 3.0;

  // Occasion direct match
  if (item.occasions.includes(occasion)) score += 2.0;

  // Personal Style Brain learned affinities
  if (styleProfile) {
    for (const c of item.colors) {
      score += (styleProfile.colorAffinities?.[c]?.score ?? 0) * 0.8;
    }
    if (item.fabric) {
      score += (styleProfile.fabricAffinities?.[item.fabric]?.score ?? 0) * 1.0;
    }
    const itemAff = styleProfile.itemAffinities?.[item.id]?.score ?? 0;
    score += itemAff * 1.2;
  }

  // Preferences
  if (preferences?.preferredAesthetics) {
    if (preferences.preferredAesthetics.includes('Classic') && item.category !== 'Accessories') {
      score += 0.5;
    }
  }

  // Trusted wear history (moderately worn staples)
  if ((item.timesWorn || 0) >= 2) {
    score += 0.5;
  }

  return score;
}
