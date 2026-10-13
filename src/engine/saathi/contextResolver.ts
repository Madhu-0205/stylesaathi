import { WardrobeItem, Season } from '../../types';
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
  return {
    ...previousEntities,
    ...currentEntities,
    // Keep constraints unified
    constraints: [
      ...(previousEntities.constraints || []),
      ...(currentEntities.constraints || []),
    ],
  };
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
  arg2?: any
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
    candidates = candidates.filter((i) => i.subcategory === targetSubcategory);
  } else if (targetCategory) {
    candidates = candidates.filter((i) => i.category === targetCategory);
  }

  if (targetColor) {
    const col = targetColor.toLowerCase();
    candidates = candidates.filter((i) =>
      i.colors?.some((c) => c.toLowerCase().includes(col))
    );
  }

  if (targetFabric) {
    const fab = targetFabric.toLowerCase();
    candidates = candidates.filter((i) => i.fabric?.toLowerCase() === fab);
  }

  // 4. Substring fallback if targetName was provided
  if (candidates.length === 0 && targetName) {
    const lower = targetName.toLowerCase();
    candidates = wardrobe.filter((i) => i.name.toLowerCase().includes(lower));
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
