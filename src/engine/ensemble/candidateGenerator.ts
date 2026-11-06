import {
  WardrobeItem,
  Category,
  Occasion,
  Season,
  ContextSnapshot,
  StylePreferences,
  PersonalStyleProfile,
  CulturalContextSignals,
} from '../../types';
import { TEMPLATES, OutfitTemplate } from '../outfitTemplates';
import { compatible, seasonFit } from '../compatibility';
import { preRankSlotCandidates } from '../candidatePreRank';
import { computeCanonicalOutfitId } from '../explorationModel';
import { AnchorState, CandidateGenerationOptions } from './types';

export interface GeneratedCandidateOutfit {
  id: string;
  template: OutfitTemplate;
  slots: Record<string, WardrobeItem[]>;
  pieces: WardrobeItem[];
  anchorItem?: WardrobeItem;
}

function isDrapedAccessory(item: WardrobeItem): boolean {
  const s = (item.subcategory || '').toLowerCase();
  const n = item.name.toLowerCase();
  const drapedKeywords = ['dupatta', 'shawl', 'scarf', 'stole', 'chunni', 'dupatto', 'muffler'];
  return drapedKeywords.some((kw) => s.includes(kw) || n.includes(kw));
}

function isOuterwearItem(item: WardrobeItem): boolean {
  if (item.category === 'Outerwear') return true;
  const subcategories = ['blazer', 'jacket', 'shrug', 'nehru jacket', 'trench coat', 'cardigan', 'coat'];
  return subcategories.includes((item.subcategory || '').toLowerCase());
}

/**
 * Filters templates matching occasion and gender presentation preference.
 */
export function filterViableTemplates(
  templates: OutfitTemplate[],
  occasion: Occasion,
  presentationPreference?: StylePreferences['presentationPreference']
): OutfitTemplate[] {
  return templates.filter((t) => {
    // 1. Presentation preference
    if (presentationPreference === 'masculine') {
      if (['Saree look', 'Lehenga ensemble', 'Anarkali look', 'Western dress'].includes(t.name)) {
        return false;
      }
    } else if (presentationPreference === 'feminine') {
      if (['Sherwani look'].includes(t.name)) {
        return false;
      }
    }

    // 2. Occasion alignment
    if (t.name === 'Indo-western') {
      return ['college', 'casual outing', 'everyday', 'date', 'travel', 'party'].includes(occasion);
    }
    if (t.name === 'Indo-western tailored') {
      return ['office', 'date', 'party', 'college', 'casual outing', 'family function', 'family gathering'].includes(occasion);
    }
    if (t.name === 'Kurta & Nehru jacket') {
      return ['wedding guest', 'celebration', 'festive', 'Diwali', 'Eid', 'family function', 'family gathering', 'puja'].includes(occasion);
    }
    if (t.name === 'Tailored Western') {
      return ['office', 'interview', 'date', 'party', 'family function', 'family gathering', 'celebration'].includes(occasion);
    }
    if (t.name === 'Lehenga ensemble') {
      return ['wedding guest', 'celebration', 'festive', 'Diwali', 'family function'].includes(occasion);
    }
    if (t.name === 'Kurta with dupatta') {
      return [
        'puja',
        'festive',
        'wedding guest',
        'celebration',
        'Diwali',
        'Eid',
        'family function',
        'family gathering',
        'office',
        'college',
        'everyday',
      ].includes(occasion);
    }
    if (t.name === 'Western dress') {
      return !['puja', 'wedding guest'].includes(occasion);
    }
    if (t.name === 'Sherwani look') {
      return ['wedding guest', 'celebration', 'festive', 'engagement', 'family function', 'family gathering'].includes(occasion);
    }
    if (t.name === 'Dhoti & Kurta look') {
      return ['puja', 'festive', 'celebration', 'wedding guest', 'family function', 'family gathering', 'everyday'].includes(occasion);
    }
    if (t.name === 'Bandhgala look') {
      return ['office', 'interview', 'wedding guest', 'celebration', 'festive', 'engagement', 'family function', 'family gathering', 'party', 'date'].includes(occasion);
    }
    return true;
  });
}

/**
 * Generates candidate ensembles from wardrobe items, honoring anchor locking constraints
 * and role-aware pruning to prevent combinatorial explosion.
 */
export function generateEnsembleCandidates(
  items: WardrobeItem[],
  options: CandidateGenerationOptions
): GeneratedCandidateOutfit[] {
  const {
    anchor,
    occasion,
    season,
    preferences,
    styleProfile,
    allowPlanningMode = false,
    maxCandidates = 300,
    perTemplateBudget = 40,
  } = options;

  const anchorItem = anchor?.item;
  const isAnchorLocked = anchor?.isLocked ?? false;

  // Filter available companion pool (companion pieces must strictly be clean and season-appropriate)
  const eligiblePool = items.filter((i) => {
    if (anchorItem && i.id === anchorItem.id) return false;
    return i.status === 'clean' && seasonFit(i, season);
  });

  // Group by category for quick lookup
  const poolByCategory = new Map<Category, WardrobeItem[]>();
  for (const item of eligiblePool) {
    let list = poolByCategory.get(item.category);
    if (!list) {
      list = [];
      poolByCategory.set(item.category, list);
    }
    list.push(item);
  }

  const viableTemplates = filterViableTemplates(
    TEMPLATES,
    occasion,
    preferences?.presentationPreference
  );

  const rawCandidates: GeneratedCandidateOutfit[] = [];
  const seenOutfitIds = new Set<string>();

  let cachedFootwearRanked: WardrobeItem[] | null = null;
  let cachedAccessoryRanked: WardrobeItem[] | null = null;

  for (const template of viableTemplates) {
    if (rawCandidates.length >= maxCandidates) break;

    let effectiveTemplate = template;
    let anchorSlot: string | null = null;

    if (anchorItem) {
      // 1. Check required slots
      for (const reqSlot of Object.keys(template.required)) {
        if (compatible(reqSlot, anchorItem, template)) {
          anchorSlot = reqSlot;
          break;
        }
      }

      // 2. Outerwear anchor promotion
      if (!anchorSlot && isOuterwearItem(anchorItem)) {
        for (const optSlot of Object.keys(template.optional)) {
          if (
            (optSlot === 'outerwear' || optSlot === 'jacket') &&
            compatible(optSlot, anchorItem, template)
          ) {
            anchorSlot = optSlot;
            effectiveTemplate = {
              name: template.name,
              required: { ...template.required, [optSlot]: template.optional[optSlot] },
              optional: { ...template.optional },
            };
            delete (effectiveTemplate.optional as Record<string, string[]>)[optSlot];
            break;
          }
        }
      }

      // 3. Draped accessory anchor promotion
      if (!anchorSlot && isDrapedAccessory(anchorItem)) {
        for (const optSlot of Object.keys(template.optional)) {
          if (
            (optSlot === 'dupatta' || optSlot === 'accessory') &&
            compatible(optSlot, anchorItem, template)
          ) {
            anchorSlot = optSlot;
            effectiveTemplate = {
              name: template.name,
              required: { ...template.required, [optSlot]: template.optional[optSlot] },
              optional: { ...template.optional },
            };
            delete (effectiveTemplate.optional as Record<string, string[]>)[optSlot];
            break;
          }
        }
      }

      // If anchor is locked but cannot fit this template, strictly do not replace the anchor
      if (!anchorSlot) {
        continue;
      }
    }

    const slotCandidates: Record<string, WardrobeItem[]> = {};
    let hasAllRequired = true;
    const requiredKeys = Object.keys(effectiveTemplate.required);

    for (const slot of requiredKeys) {
      if (anchorItem && slot === anchorSlot) {
        slotCandidates[anchorSlot] = [anchorItem];
      } else if (slot === 'footwear') {
        if (!cachedFootwearRanked) {
          const fwPool = poolByCategory.get('Footwear') || [];
          cachedFootwearRanked = preRankSlotCandidates(
            fwPool,
            'footwear',
            occasion,
            season,
            preferences,
            styleProfile
          );
        }
        if (cachedFootwearRanked.length === 0) {
          hasAllRequired = false;
          break;
        }
        slotCandidates[slot] = cachedFootwearRanked.slice(0, 6);
      } else {
        const matching = eligiblePool.filter((i) => compatible(slot, i, effectiveTemplate));
        const ranked = preRankSlotCandidates(
          matching,
          slot,
          occasion,
          season,
          preferences,
          styleProfile
        );
        if (ranked.length === 0) {
          hasAllRequired = false;
          break;
        }
        slotCandidates[slot] = ranked.slice(0, 8);
      }
    }

    if (!hasAllRequired) continue;

    // Pruned grid generation to prevent combinatorial explosion
    const generateGrid = (
      keys: string[],
      idx: number,
      current: Record<string, WardrobeItem[]>
    ): Record<string, WardrobeItem[]>[] => {
      if (idx === keys.length) return [current];
      const k = keys[idx];
      const candidates = (slotCandidates[k] || []).slice(0, 4); // Limit breadth per slot
      return candidates.flatMap((item) =>
        generateGrid(keys, idx + 1, { ...current, [k]: [item] })
      );
    };

    const combos = generateGrid(requiredKeys, 0, {});
    let templateCount = 0;

    for (const combo of combos) {
      if (templateCount >= perTemplateBudget || rawCandidates.length >= maxCandidates) break;

      const pieces = Object.values(combo).flat();
      const outfitId = computeCanonicalOutfitId({
        template: effectiveTemplate.name,
        slots: combo,
      });

      if (seenOutfitIds.has(outfitId)) continue;
      seenOutfitIds.add(outfitId);

      // Verify anchor presence if locked
      if (isAnchorLocked && anchorItem && !pieces.some((p) => p.id === anchorItem.id)) {
        continue;
      }

      rawCandidates.push({
        id: outfitId,
        template: effectiveTemplate,
        slots: combo,
        pieces,
        anchorItem: anchorItem || undefined,
      });
      templateCount++;
    }
  }

  return rawCandidates;
}

