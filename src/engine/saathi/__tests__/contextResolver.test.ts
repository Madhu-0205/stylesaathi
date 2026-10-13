import { describe, it, expect } from 'vitest';
import {
  mergeConversationEntities,
  resolveTargetDate,
  resolveSeasonForDate,
  resolveWardrobeGarment,
} from '../contextResolver';
import { WardrobeItem } from '../../../types';
import { SaathiEntities } from '../types';

function createMockItem(partial: Partial<WardrobeItem> & { id: string; name: string }): WardrobeItem {
  return {
    userId: 'user_1',
    favorite: false,
    note: '',
    timesWorn: 0,
    status: 'clean',
    category: 'Tops',
    subcategory: 'shirt',
    colors: ['blue'],
    seasons: ['summer'],
    occasions: ['office'],
    formality: 3,
    ...partial,
  };
}

describe('Phase 10: AI Saathi Context & Entity Resolver', () => {
  const wardrobe: WardrobeItem[] = [
    createMockItem({
      id: 'item_blue_shirt_1',
      name: 'Navy Linen Oxford Shirt',
      category: 'Tops',
      subcategory: 'shirt',
      colors: ['blue', 'navy'],
      fabric: 'linen',
    }),
    createMockItem({
      id: 'item_blue_shirt_2',
      name: 'Sky Blue Formal Shirt',
      category: 'Tops',
      subcategory: 'shirt',
      colors: ['blue', 'sky blue'],
      fabric: 'cotton',
    }),
    createMockItem({
      id: 'item_black_jeans',
      name: 'Slim Black Denim Jeans',
      category: 'Bottoms',
      subcategory: 'jeans',
      colors: ['black'],
    }),
    createMockItem({
      id: 'item_silk_kurta',
      name: 'Maroon Raw Silk Kurta',
      category: 'Ethnic',
      subcategory: 'kurta',
      colors: ['maroon'],
      fabric: 'silk',
    }),
  ];

  describe('Multi-Turn Entity Inheritance', () => {
    it('inherits previous entities across turns without losing prior context', () => {
      const prior: SaathiEntities = {
        occasion: 'wedding guest',
        date: 'tomorrow',
        season: 'winter',
      };

      const incoming: SaathiEntities = {
        color: 'maroon',
      };

      const merged = mergeConversationEntities(prior, incoming);

      expect(merged.occasion).toBe('wedding guest');
      expect(merged.date).toBe('tomorrow');
      expect(merged.season).toBe('winter');
      expect(merged.color).toBe('maroon');
    });

    it('allows incoming entities to overwrite previous entities when explicitly updated', () => {
      const prior: SaathiEntities = {
        occasion: 'office',
        date: 'today',
      };

      const incoming: SaathiEntities = {
        occasion: 'party',
      };

      const merged = mergeConversationEntities(prior, incoming);

      expect(merged.occasion).toBe('party');
      expect(merged.date).toBe('today');
    });
  });

  describe('Date & Season Resolution', () => {
    it('resolves relative dates deterministically against provided reference timestamp', () => {
      // 2026-10-13T12:00:00Z (Tuesday)
      const refTimestamp = 1791892800000;

      const todayStr = resolveTargetDate('today', refTimestamp);
      expect(todayStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const tomorrowStr = resolveTargetDate('tomorrow', refTimestamp);
      expect(tomorrowStr).not.toBe(todayStr);

      const fallbackStr = resolveTargetDate(undefined, refTimestamp);
      expect(fallbackStr).toBe(todayStr);
    });

    it('resolves seasons from target dates deterministically', () => {
      expect(resolveSeasonForDate('2026-05-15')).toBe('summer');
      expect(resolveSeasonForDate('2026-07-20')).toBe('monsoon');
      expect(resolveSeasonForDate('2026-12-10')).toBe('winter');
    });
  });

  describe('Deterministic Garment Disambiguation (NO GUESSING RULE)', () => {
    it('resolves item deterministically when exactly one match exists', () => {
      const result = resolveWardrobeGarment(
        { color: 'maroon', garmentType: 'kurta' },
        wardrobe
      );

      expect(result.status).toBe('resolved');
      expect(result.item?.id).toBe('item_silk_kurta');
      expect(result.candidates).toHaveLength(1);
    });

    it('flags ambiguity and lists all candidates when multiple items match (NEVER GUESSES)', () => {
      const result = resolveWardrobeGarment(
        { color: 'blue', garmentType: 'shirt' },
        wardrobe
      );

      expect(result.status).toBe('ambiguous');
      expect(result.item).toBeUndefined();
      expect(result.candidates.length).toBe(2);
      expect(result.candidates.map((c) => c.id)).toContain('item_blue_shirt_1');
      expect(result.candidates.map((c) => c.id)).toContain('item_blue_shirt_2');
    });

    it('reports not_found when item does not exist (NEVER INVENTS ITEMS)', () => {
      const result = resolveWardrobeGarment(
        { color: 'yellow', garmentType: 'blazer' },
        wardrobe
      );

      expect(result.status).toBe('not_found');
      expect(result.item).toBeUndefined();
      expect(result.candidates).toHaveLength(0);
    });

    it('resolves directly by explicit wardrobeItemId if provided', () => {
      const result = resolveWardrobeGarment(
        { wardrobeItemId: 'item_black_jeans' },
        wardrobe
      );

      expect(result.status).toBe('resolved');
      expect(result.item?.id).toBe('item_black_jeans');
    });
  });
});
