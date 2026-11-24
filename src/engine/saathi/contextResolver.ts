import { WardrobeItem, Season, GeneratedOutfit } from '../../types';
import { SaathiEntities, ClarificationRequest } from './types';
import { deriveSeasonalContext } from '../contextEngine';

/**
 * Resolves formatted YYYY-MM-DD date string from reference timestamp and relative date indicator.
 * Supports flexible argument ordering.
 */
export function resolveTargetDate(
  arg1?: number | string,
  arg2?: number | string,
  explicitDate?: string
): string {
  let refTimestamp = 1791892800000;
  let relativeDate: string | undefined;

  if (typeof arg1 === 'number') {
    refTimestamp = arg1;
    relativeDate = typeof arg2 === 'string' ? arg2 : undefined;
  } else if (typeof arg2 === 'number') {
    refTimestamp = arg2;
    relativeDate = typeof arg1 === 'string' ? arg1 : undefined;
  } else if (typeof arg1 === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(arg1)) {
      return arg1;
    }
    relativeDate = arg1;
  }

  if (explicitDate && /^\d{4}-\d{2}-\d{2}$/.test(explicitDate)) {
    return explicitDate;
  }

  const base = new Date(refTimestamp);

  if (relativeDate === 'tomorrow') {
    base.setDate(base.getDate() + 1);
  } else if (relativeDate === 'this_weekend' || relativeDate === 'this weekend') {
    // Advance to upcoming Saturday
    const day = base.getDay();
    const daysUntilSaturday = (6 - day + 7) % 7 || 7;
    base.setDate(base.getDate() + daysUntilSaturday);
  }

  const yyyy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, '0');
  const dd = String(base.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Inherits and merges entities across conversation turns.
 * Rule: Newly stated entities in current turn override previous turn entities;
 * previously resolved entities are retained when omitted.
 */
export function mergeConversationEntities(
  previousEntities: SaathiEntities = {},
  currentEntities: SaathiEntities = {}
): SaathiEntities {
  const merged: SaathiEntities = { ...previousEntities };

  // If a new occasion is provided and differs from previous occasion:
  // Reset previous anchor and swap fields unless explicitly kept in current turn or context correction
  if (
    currentEntities.occasion &&
    previousEntities.occasion &&
    currentEntities.occasion !== previousEntities.occasion &&
    !currentEntities.isCorrection &&
    !currentEntities.keptPieceName &&
    !currentEntities.anchorGarmentName
  ) {
    delete merged.wardrobeItemId;
    delete merged.wardrobeItemName;
    delete merged.anchorGarmentId;
    delete merged.anchorGarmentName;
    delete merged.keptPieceName;
    delete merged.keptPieceRole;
    delete merged.swapRole;
    delete merged.refinementType;
    delete merged.subcategory;
    delete merged.category;
    delete merged.color;
    delete merged.fabric;
    delete merged.garmentType;
    delete merged.garmentCategory;
    delete merged.requestedGarmentName;
  }

  // If unlockedAnchor is requested, clear all anchor references
  if (currentEntities.unlockedAnchor) {
    delete merged.wardrobeItemId;
    delete merged.wardrobeItemName;
    delete merged.anchorGarmentId;
    delete merged.anchorGarmentName;
    delete merged.keptPieceName;
    delete merged.keptPieceRole;
  }

  for (const [key, val] of Object.entries(currentEntities)) {
    if (val !== undefined) {
      (merged as any)[key] = val;
    }
  }

  // Keep constraints unified and deduplicated
  const combinedConstraints = [
    ...(previousEntities.constraints || []),
    ...(currentEntities.constraints || []),
  ];
  merged.constraints = Array.from(new Set(combinedConstraints));

  return merged;
}

export interface GarmentMatchResult {
  status: 'exact_match' | 'resolved' | 'ambiguous' | 'not_found';
  item?: WardrobeItem;
  matchedItem?: WardrobeItem;
  candidates: WardrobeItem[];
  candidateItems?: WardrobeItem[];
  clarification?: ClarificationRequest;
}

/**
 * Deterministically resolves a garment from the user's wardrobe.
 * ABSOLUTE RULE: Never guess between multiple items. If ambiguous, generate clarification.
 */
export function resolveWardrobeGarment(
  arg1: any,
  arg2?: any,
  contextItems?: WardrobeItem[]
): GarmentMatchResult {
  const wardrobe: readonly WardrobeItem[] = Array.isArray(arg1)
    ? arg1
    : Array.isArray(arg2)
    ? arg2
    : [];
  const query: any = Array.isArray(arg1) ? arg2 || {} : arg1 || {};

  const targetId = query.wardrobeItemId || query.itemId;
  const targetName = query.wardrobeItemName || query.itemName;
  const targetColor = query.color;
  const targetSubcategory = query.subcategory || query.garmentType;
  const targetCategory = query.category || query.garmentCategory;
  const targetFabric = query.fabric;

  // 1. Direct ID match
  if (targetId) {
    const direct = wardrobe.find((i) => i.id === targetId);
    if (direct) {
      return {
        status: 'resolved',
        item: direct,
        matchedItem: direct,
        candidates: [direct],
        candidateItems: [direct],
      };
    }
  }

  // 2. Exact name match
  if (targetName) {
    const lowerName = targetName.trim().toLowerCase();
    const exactNameMatches = wardrobe.filter(
      (i) => i.name.toLowerCase() === lowerName
    );
    if (exactNameMatches.length === 1) {
      return {
        status: 'resolved',
        item: exactNameMatches[0],
        matchedItem: exactNameMatches[0],
        candidates: exactNameMatches,
        candidateItems: exactNameMatches,
      };
    }
  }

  // 3. Multi-attribute filtering (color + subcategory + fabric)
  let candidates = [...wardrobe];

  if (targetSubcategory) {
    const isKurtaKurti = targetSubcategory === 'kurta' || targetSubcategory === 'kurti';
    candidates = candidates.filter((i) =>
      isKurtaKurti
        ? i.subcategory === 'kurta' || i.subcategory === 'kurti' || i.name.toLowerCase().includes('kurt')
        : i.subcategory === targetSubcategory || i.name.toLowerCase().includes(targetSubcategory)
    );
  } else if (targetCategory) {
    candidates = candidates.filter((i) => i.category === targetCategory);
  } else if (targetName) {
    const stopWords = ['a', 'an', 'the', 'this', 'that', 'my', 'neon', 'dark', 'light', 'pale', 'bright', 'clean'];
    const terms = targetName.toLowerCase().split(/\s+/).filter((t: string) => t.length > 2 && !stopWords.includes(t));
    if (terms.length > 0) {
      candidates = candidates.filter((i) => {
        const itemText = `${i.name} ${i.subcategory || ''} ${i.category}`.toLowerCase();
        return terms.some((t: string) => itemText.includes(t));
      });
    }
  }

  if (targetColor) {
    const col = targetColor.toLowerCase();
    candidates = candidates.filter((i) =>
      i.colors?.some((c) => c.toLowerCase().includes(col)) ||
      i.name.toLowerCase().includes(col)
    );
  }

  if (targetFabric) {
    const fab = targetFabric.toLowerCase();
    candidates = candidates.filter((i) => i.fabric?.toLowerCase() === fab);
  }

  // Guard against spurious single-attribute matches when targetName was specified
  if (targetName && candidates.length === 1 && !targetSubcategory && !targetCategory) {
    const item = candidates[0];
    const itemText = `${item.name} ${item.subcategory || ''} ${item.category}`.toLowerCase();
    const stopWords = ['a', 'an', 'the', 'this', 'that', 'my', 'neon', 'dark', 'light', 'pale', 'bright', 'clean'];
    const significantTerms = targetName.toLowerCase().split(/\s+/).filter((t: string) => t.length > 3 && !stopWords.includes(t));
    if (significantTerms.length > 0 && !significantTerms.some((t: string) => itemText.includes(t))) {
      return {
        status: 'not_found',
        candidates: [],
        candidateItems: [],
      };
    }
  }

  // 3b. Prioritize pieces featured in recent recommendations (Anaphoric Context Resolution)
  if (candidates.length > 1 && contextItems && contextItems.length > 0) {
    const contextualMatches = candidates.filter((cand) =>
      contextItems.some((ci) => ci.id === cand.id)
    );
    if (contextualMatches.length === 1) {
      return {
        status: 'resolved',
        item: contextualMatches[0],
        matchedItem: contextualMatches[0],
        candidates: contextualMatches,
        candidateItems: contextualMatches,
      };
    }
  }

  // 4. Substring fallback if targetName was provided
  if (candidates.length === 0 && targetName) {
    const lower = targetName.toLowerCase();
    const directSubstring = wardrobe.filter((i) => i.name.toLowerCase().includes(lower));
    if (directSubstring.length > 0) {
      candidates = directSubstring;
    } else {
      const terms = lower.split(/\s+/).filter(Boolean);
      const multiTermMatches = wardrobe.filter((i) => {
        const lowerItemName = i.name.toLowerCase();
        return terms.every((t: string) => lowerItemName.includes(t));
      });
      if (multiTermMatches.length > 0) {
        candidates = multiTermMatches;
      }
    }
  }

  // 5. Evaluate matches
  if (candidates.length === 0) {
    return {
      status: 'not_found',
      candidates: [],
      candidateItems: [],
    };
  }

  if (candidates.length === 1) {
    return {
      status: 'resolved',
      item: candidates[0],
      matchedItem: candidates[0],
      candidates,
      candidateItems: candidates,
    };
  }

  // Multiple candidates: Ambiguous! Must generate clarification
  const targetLabel = `${targetColor ? targetColor + ' ' : ''}${
    targetSubcategory || targetCategory || 'garment'
  }`;

  const clarification: ClarificationRequest = {
    id: `clarify_garment_${candidates[0]?.id || 'item'}`,
    question: `You have ${candidates.length} ${targetLabel} pieces in your closet. Which one would you like to use?`,
    field: 'wardrobeItemId',
    options: candidates.slice(0, 5).map((item) => ({
      label: item.name,
      value: item.id,
      description: `${item.colors.join(', ')} • ${item.subcategory} (${item.status})`,
    })),
  };

  return {
    status: 'ambiguous',
    candidates,
    candidateItems: candidates,
    clarification,
  };
}

/**
 * Resolves canonical season from target date.
 */
export function resolveSeasonForDate(dateStr: string): Season {
  return deriveSeasonalContext(new Date(dateStr));
}

export interface LookResolutionResult {
  look?: GeneratedOutfit;
  lookIndex?: number;
  isAmbiguous: boolean;
  clarification?: ClarificationRequest;
}

/**
 * Deterministically identifies the referenced outfit from ordinal, lookIndex, or selectedOutfitId.
 */
export function resolveReferencedLook(
  outfits: GeneratedOutfit[] | undefined,
  entities: SaathiEntities,
  queryOrState?: string | { selectedLookIndex?: number; selectedOutfitId?: string },
  selectedLookIndex?: number,
  selectedOutfitId?: string
): LookResolutionResult {
  if (!outfits || outfits.length === 0) {
    return { isAmbiguous: false };
  }

  let query: string | undefined;
  let resolvedLookIdx = selectedLookIndex;
  let resolvedOutfitId = selectedOutfitId;

  if (typeof queryOrState === 'string') {
    query = queryOrState;
  } else if (queryOrState && typeof queryOrState === 'object') {
    resolvedLookIdx = queryOrState.selectedLookIndex ?? selectedLookIndex;
    resolvedOutfitId = queryOrState.selectedOutfitId ?? selectedOutfitId;
  }

  // 1. Explicit lookIndex in current entities
  if (entities.lookIndex !== undefined && outfits[entities.lookIndex]) {
    return {
      look: outfits[entities.lookIndex],
      lookIndex: entities.lookIndex,
      isAmbiguous: false,
    };
  }

  // 1b. Ordinal reference in current entities
  if (entities.ordinalRef === 'last' && outfits.length > 0) {
    const lastIdx = outfits.length - 1;
    return { look: outfits[lastIdx], lookIndex: lastIdx, isAmbiguous: false };
  }
  if (entities.ordinalRef === 'first' && outfits[0]) {
    return { look: outfits[0], lookIndex: 0, isAmbiguous: false };
  }
  if (entities.ordinalRef === 'second' && outfits[1]) {
    return { look: outfits[1], lookIndex: 1, isAmbiguous: false };
  }
  if (entities.ordinalRef === 'third' && outfits[2]) {
    return { look: outfits[2], lookIndex: 2, isAmbiguous: false };
  }

  // 2. Direct outfit ID match in current entities
  if (entities.selectedOutfitId) {
    const index = outfits.findIndex((o) => o.id === entities.selectedOutfitId);
    if (index !== -1) {
      return { look: outfits[index], lookIndex: index, isAmbiguous: false };
    }
  }

  // 3. Persisted selectedOutfitId from state
  if (resolvedOutfitId) {
    const index = outfits.findIndex((o) => o.id === resolvedOutfitId);
    if (index !== -1) {
      return { look: outfits[index], lookIndex: index, isAmbiguous: false };
    }
  }

  // 3b. Persisted selectedLookIndex from state
  if (resolvedLookIdx !== undefined && outfits[resolvedLookIdx]) {
    return {
      look: outfits[resolvedLookIdx],
      lookIndex: resolvedLookIdx,
      isAmbiguous: false,
    };
  }

  // 4. Query text parsing for ordinals
  if (query) {
    const q = query.toLowerCase();
    if (/\b(first|1st|look\s*1)\b/i.test(q) && outfits[0]) {
      return { look: outfits[0], lookIndex: 0, isAmbiguous: false };
    }
    if (/\b(second|2nd|look\s*2)\b/i.test(q) && outfits[1]) {
      return { look: outfits[1], lookIndex: 1, isAmbiguous: false };
    }
    if (/\b(third|3rd|look\s*3)\b/i.test(q) && outfits[2]) {
      return { look: outfits[2], lookIndex: 2, isAmbiguous: false };
    }
    if (/\b(last)\b/i.test(q) && outfits.length > 0) {
      const lastIdx = outfits.length - 1;
      return { look: outfits[lastIdx], lookIndex: lastIdx, isAmbiguous: false };
    }
  }

  // 5. If only 1 outfit exists, reference is unambiguous
  if (outfits.length === 1) {
    return { look: outfits[0], lookIndex: 0, isAmbiguous: false };
  }

  // 6. Multiple outfits exist and none specified: Ambiguous!
  const clarification: ClarificationRequest = {
    id: `clarify_look_selection`,
    question: `Which look would you like to use — Look 1, Look 2, or Look 3?`,
    field: 'lookIndex',
    options: outfits.slice(0, 3).map((outfit, idx) => {
      const pieceNames = Object.values(outfit.slots || {}).flat().map((p) => p.name).join(' + ');
      return {
        label: `Look ${idx + 1}`,
        value: String(idx),
        description: pieceNames || outfit.template,
      };
    }),
  };

  return {
    isAmbiguous: true,
    clarification,
  };
}
