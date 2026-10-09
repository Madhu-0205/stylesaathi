import {
  GeneratedOutfit,
  Occasion,
  PersonalStyleProfile,
  StylePreferences,
  ContextSnapshot,
} from '../types';
import { calculateOutfitDistance, DIVERSIFICATION_DISTANCE_THRESHOLD } from './diversification';
import { calculateWeatherComfortScore } from './contextScoring';

/**
 * 32-bit FNV-1a browser-safe hash for deterministic outfit and exploration identity.
 * Zero external dependencies.
 */
export function fnv1a32(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Computes canonical deterministic outfit identity string and hash:
 * Depends only on template and sorted item IDs per slot.
 * Never depends on runtime execution time or array order.
 */
export function computeCanonicalOutfitId(outfit: {
  template: string;
  slots: Record<string, { id: string }[]>;
}): string {
  const sortedSlotKeys = Object.keys(outfit.slots).sort();
  const slotTokens = sortedSlotKeys.map((slotKey) => {
    const sortedItemIds = (outfit.slots[slotKey] || [])
      .map((item) => item.id)
      .sort()
      .join(',');
    return `${slotKey}:${sortedItemIds}`;
  });

  const canonicalContent = `${outfit.template}::${slotTokens.join('|')}`;
  return `outfit_${fnv1a32(canonicalContent)}`;
}

/**
 * Computes deterministic wardrobe fingerprint for stable exploration indexing.
 */
export function computeWardrobeFingerprint(itemIds: string[]): string {
  const sorted = [...itemIds].sort().join(',');
  return fnv1a32(sorted);
}

/**
 * Validates whether an outfit is behaviorally safe for exploration:
 * - Must NOT violate avoided item combinations
 * - Must NOT have strong learned negative category/color/fabric avoidance (< -0.3)
 * - Must NOT have severe climate discomfort
 */
export function isExploreCandidateSafe(
  outfit: GeneratedOutfit,
  _occasion: Occasion,
  styleProfile?: PersonalStyleProfile,
  _preferences?: StylePreferences,
  context?: ContextSnapshot
): boolean {
  const pieces = Object.values(outfit.slots).flat();

  // 1. Avoided item combinations check (learned from explicit user rejections/dismissals)
  if (styleProfile) {
    if (styleProfile.avoidedCombinations) {
      const pieceIds = pieces.map((p) => p.id);
      for (let i = 0; i < pieceIds.length; i++) {
        for (let j = i + 1; j < pieceIds.length; j++) {
          const pairKey = [pieceIds[i], pieceIds[j]].sort().join(':');
          if (styleProfile.avoidedCombinations.includes(pairKey)) {
            return false;
          }
        }
      }
    }

    if ((styleProfile as any).avoidedItemCombinations) {
      const pieceIds = new Set(pieces.map((p) => p.id));
      for (const combo of (styleProfile as any).avoidedItemCombinations) {
        if (combo.itemIds && combo.itemIds.every((id: string) => pieceIds.has(id))) {
          return false;
        }
      }
    }
  }

  // 2. Strong learned negative avoidance check (< -0.3)
  if (styleProfile) {
    for (const piece of pieces) {
      const itemAff = styleProfile.itemAffinities?.[piece.id];
      if (itemAff && itemAff.score < -0.3) return false;

      for (const col of piece.colors) {
        if (styleProfile.avoidedColors?.includes(col.toLowerCase())) return false;
        const colAff = styleProfile.colorAffinities?.[col];
        if (colAff && colAff.score < -0.3) return false;
      }

      if (piece.fabric) {
        if (styleProfile.avoidedFabrics?.includes(piece.fabric)) return false;
        const fabAff = styleProfile.fabricAffinities?.[piece.fabric];
        if (fabAff && fabAff.score < -0.3) return false;
      }
    }
  }

  // 3. Climate comfort check: avoid outfits with severe climate penalty (delta < -1.5)
  if (context && context.weather && context.source !== 'simulated' && context.source !== 'unavailable') {
    const comfort = calculateWeatherComfortScore(pieces, context);
    if (comfort.scoreDelta < -1.5) {
      return false;
    }
  }

  return true;
}

/**
 * Checks if an outfit contains at least one under-explored or fresh piece.
 */
export function hasNoveltyAspect(
  outfit: GeneratedOutfit,
  styleProfile?: PersonalStyleProfile
): boolean {
  const pieces = Object.values(outfit.slots).flat();
  for (const piece of pieces) {
    const sampleCount = styleProfile?.itemAffinities?.[piece.id]?.sampleCount ?? (piece.timesWorn || 0);
    if (sampleCount <= 1 || (piece.timesWorn || 0) === 0) {
      return true;
    }
  }
  return false;
}

/**
 * Deterministically selects an Explore candidate from valid candidates:
 * - Must be behaviorally safe
 * - Must be sufficiently distant from Best Match (>= 0.35) and Alternative (>= 0.30)
 * - Uses deterministic hash of (localDate + occasion + wardrobeFingerprint + seedOffset)
 * - Returns null if no valid explore candidate exists (never fabricates!).
 */
export function selectDeterministicExploreCandidate<T extends GeneratedOutfit>(
  candidates: T[],
  bestMatch: GeneratedOutfit,
  alternative: GeneratedOutfit | null,
  deterministicSeedString: string,
  occasion: Occasion,
  styleProfile?: PersonalStyleProfile,
  preferences?: StylePreferences,
  context?: ContextSnapshot
): T | null {
  // Filter for diversity distance from Best Match and Alternative
  const eligible = candidates.filter((c) => {
    if (c === bestMatch || (alternative && c === alternative)) return false;

    const distFromBest = calculateOutfitDistance(bestMatch, c);
    if (distFromBest < DIVERSIFICATION_DISTANCE_THRESHOLD) return false;

    if (alternative) {
      const distFromAlt = calculateOutfitDistance(alternative, c);
      if (distFromAlt < 0.3) return false;
    }

    if (!isExploreCandidateSafe(c, occasion, styleProfile, preferences, context)) {
      return false;
    }

    return true;
  });

  if (eligible.length === 0) {
    return null;
  }

  // Prioritize candidates with genuine novelty aspect
  const noveltyPool = eligible.filter((c) => hasNoveltyAspect(c, styleProfile));
  const selectionPool = noveltyPool.length > 0 ? noveltyPool : eligible;

  // Sort pool deterministically by score and signature so array indexing is 100% stable
  selectionPool.sort((a, b) => {
    if (Math.abs(b.score - a.score) > 0.0001) return b.score - a.score;
    const sigA = Object.values(a.slots).flat().map((p) => p.id).sort().join('|');
    const sigB = Object.values(b.slots).flat().map((p) => p.id).sort().join('|');
    return sigA.localeCompare(sigB);
  });

  const hashHex = fnv1a32(deterministicSeedString);
  const hashNum = parseInt(hashHex, 16);
  const selectedIndex = hashNum % selectionPool.length;

  return selectionPool[selectedIndex] ?? null;
}
