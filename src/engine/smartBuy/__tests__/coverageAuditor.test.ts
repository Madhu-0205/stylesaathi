import { describe, it, expect } from 'vitest';
import {
  getApplicableTemplatesForOccasion,
  itemMatchesSlotRole,
  getSlotRoleDetails,
  extractActiveOccasions,
  auditOccasionCoverage,
} from '../coverageAuditor';
import { WardrobeItem, OutfitPlan, StylePreferences } from '../../../types';

describe('Phase 9 — Coverage Auditor', () => {
  const createMockItem = (overrides: Partial<WardrobeItem>): WardrobeItem => ({
    id: `item_${Math.random().toString(36).substring(2, 9)}`,
    name: 'Sample Item',
    category: 'Tops',
    subcategory: 'shirt',
    status: 'clean',
    timesWorn: 5,
    createdAt: 1700000000000,
    colors: ['navy'],
    seasons: ['summer'],
    occasions: ['office', 'everyday'],
    formality: 3,
    favorite: false,
    note: '',
    ...overrides,
  });

  describe('Template and Slot Role Mapping', () => {
    it('returns applicable Phase 5 templates for given occasions', () => {
      const officeTemplates = getApplicableTemplatesForOccasion('office');
      expect(officeTemplates.some((t) => t.name === 'Indo-western tailored')).toBe(true);
      expect(officeTemplates.some((t) => t.name === 'Tailored Western')).toBe(true);

      const festiveTemplates = getApplicableTemplatesForOccasion('Diwali');
      expect(festiveTemplates.some((t) => t.name === 'Kurta & Nehru jacket')).toBe(true);
      expect(festiveTemplates.some((t) => t.name === 'Lehenga ensemble')).toBe(true);
    });

    it('matches slot roles correctly for both western and ethnic items', () => {
      const shirt = createMockItem({ category: 'Tops', subcategory: 'shirt' });
      const dupatta = createMockItem({ category: 'Ethnic', subcategory: 'dupatta' });
      const saree = createMockItem({ category: 'Ethnic', subcategory: 'saree' });
      const blazer = createMockItem({ category: 'Outerwear', subcategory: 'blazer' });
      const nehruJacket = createMockItem({ category: 'Ethnic', subcategory: 'nehru jacket' });

      expect(itemMatchesSlotRole(shirt, 'top', ['Tops'])).toBe(true);
      expect(itemMatchesSlotRole(dupatta, 'dupatta', ['Ethnic'])).toBe(true);
      expect(itemMatchesSlotRole(saree, 'saree', ['Ethnic'])).toBe(true);
      expect(itemMatchesSlotRole(blazer, 'jacket', ['Outerwear'])).toBe(true);
      expect(itemMatchesSlotRole(nehruJacket, 'jacket', ['Outerwear'])).toBe(true);
    });

    it('extracts correct metadata details for slot names', () => {
      expect(getSlotRoleDetails('top')).toEqual({
        role: 'top',
        category: 'Tops',
        subcategories: ['shirt', 't-shirt', 'top', 'kurta', 'crop top'],
      });
      expect(getSlotRoleDetails('shoes')).toEqual({
        role: 'footwear',
        category: 'Footwear',
        subcategories: ['sneakers', 'formal shoes', 'loafers', 'flats', 'sandals', 'heels', 'juttis'],
      });
      expect(getSlotRoleDetails('dupatta')).toEqual({
        role: 'dupatta',
        category: 'Ethnic',
        subcategories: ['dupatta'],
      });
    });
  });

  describe('Active Occasion Extraction', () => {
    it('extracts active occasions from active outfit plans', () => {
      const plans: OutfitPlan[] = [
        {
          id: 'p1',
          date: '2026-10-15',
          occasion: 'office',
          status: 'planned',
          outfit: {} as any,
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          id: 'p2',
          date: '2026-10-16',
          occasion: 'date',
          status: 'planned',
          outfit: {} as any,
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          id: 'p3',
          date: '2026-10-17',
          occasion: 'wedding guest',
          status: 'cancelled', // Cancelled must be ignored
          outfit: {} as any,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ];

      const active = extractActiveOccasions(plans, undefined);
      expect(active.has('office')).toBe(true);
      expect(active.has('date')).toBe(true);
      expect(active.has('wedding guest')).toBe(false);
    });

    it('extracts active occasions from style preferences', () => {
      const prefs: Partial<StylePreferences> = {
        preferredContexts: ['college', 'party'],
      };

      const active = extractActiveOccasions(undefined, prefs as StylePreferences);
      expect(active.has('college')).toBe(true);
      expect(active.has('party')).toBe(true);
      expect(active.has('wedding guest')).toBe(false);
    });

    it('falls back to everyday and casual outing when zero demand is declared', () => {
      const active = extractActiveOccasions([], { occasions: [] } as any);
      expect(active.has('everyday')).toBe(true);
      expect(active.has('casual outing')).toBe(true);
      expect(active.has('wedding guest')).toBe(false);
    });
  });

  describe('Occasion Coverage Audit Execution', () => {
    it('detects slot failure when required category has 0 clean pieces', () => {
      const items: WardrobeItem[] = [
        createMockItem({ id: 'top1', category: 'Tops', subcategory: 'shirt', status: 'clean' }),
        createMockItem({ id: 'bot1', category: 'Bottoms', subcategory: 'trousers', status: 'clean' }),
        // Footwear is missing!
      ];

      const activeOccasions = new Set<'office'>(['office']);
      const { readinessList, failures } = auditOccasionCoverage(items, activeOccasions);

      expect(readinessList.length).toBe(1);
      expect(readinessList[0].occasion).toBe('office');
      expect(readinessList[0].readiness).toBe('unsupported');
      expect(readinessList[0].missingRoles).toContain('footwear');
      expect(failures.some((f) => f.role === 'footwear')).toBe(true);
    });

    it('ignores laundry/dirty garments when calculating ready looks', () => {
      const items: WardrobeItem[] = [
        createMockItem({ id: 'top1', category: 'Tops', subcategory: 'shirt', status: 'clean' }),
        createMockItem({ id: 'bot1', category: 'Bottoms', subcategory: 'trousers', status: 'clean' }),
        createMockItem({
          id: 'shoes1',
          category: 'Footwear',
          subcategory: 'formal shoes',
          status: 'in_laundry', // Trapped in laundry
        }),
      ];

      const activeOccasions = new Set<'office'>(['office']);
      const { readinessList, failures } = auditOccasionCoverage(items, activeOccasions);

      expect(readinessList[0].readiness).toBe('unsupported');
      expect(failures.some((f) => f.role === 'footwear')).toBe(true);
    });

    it('reports fully ready when all slots are covered with clean items', () => {
      const items: WardrobeItem[] = [
        createMockItem({ id: 'top1', category: 'Tops', subcategory: 'shirt', status: 'clean' }),
        createMockItem({ id: 'top2', category: 'Tops', subcategory: 'top', status: 'clean' }),
        createMockItem({ id: 'bot1', category: 'Bottoms', subcategory: 'trousers', status: 'clean' }),
        createMockItem({ id: 'bot2', category: 'Bottoms', subcategory: 'jeans', status: 'clean' }),
        createMockItem({ id: 'shoe1', category: 'Footwear', subcategory: 'loafers', status: 'clean' }),
      ];

      const activeOccasions = new Set<'office'>(['office']);
      const { readinessList, failures, coverageSummary } = auditOccasionCoverage(items, activeOccasions);

      expect(readinessList[0].readiness).toBe('fully_ready');
      expect(coverageSummary.coveredOccasionsCount).toBe(1);
      expect(coverageSummary.unsupportedActiveOccasionsCount).toBe(0);
      expect(failures.length).toBe(0);
    });
  });
});
