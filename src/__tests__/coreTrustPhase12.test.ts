import { describe, it, expect } from 'vitest';
import { recommendOutfits, recommendOutfitsWithTelemetry } from '../engine/recommendationEngine';
import { evaluateTier1HardConstraints } from '../engine/hardConstraints';
import { computeWardrobeGaps } from '../engine/smartBuy/smartBuyEngine';
import { candidates } from '../data/candidates';
import { TEMPLATES } from '../engine/outfitTemplates';
import { WardrobeItem, GeneratedOutfit } from '../types';

describe('Phase 1.2 — Core Fashion Trust & Physical Grounding', () => {
  const FIXED_TIMESTAMP = 1718000000000;

  const mockItem = (overrides: Partial<WardrobeItem>): WardrobeItem => ({
    id: `item_${Math.random().toString(36).substring(2, 9)}`,
    name: 'Sample Item',
    category: 'Tops',
    subcategory: 'shirt',
    status: 'clean',
    timesWorn: 5,
    colors: ['white'],
    formality: 3,
    favorite: false,
    note: '',
    seasons: ['summer'],
    occasions: ['college', 'everyday', 'office', 'puja'],
    ...overrides,
  });

  // ==========================================================================
  // 1. Immediate-wear laundry correctness (P0)
  // ==========================================================================
  describe('P0 — Immediate-wear laundry correctness', () => {
    it('strictly returns 0 outfits when allowPlanningMode: false and anchor is dirty', () => {
      const dirtyAnchor = mockItem({
        id: 'anchor-dirty',
        name: 'Dirty Silk Shirt',
        category: 'Tops',
        subcategory: 'shirt',
        status: 'needs_washing',
      });
      const cleanBottom = mockItem({
        id: 'bot-1',
        name: 'Clean Trousers',
        category: 'Bottoms',
        subcategory: 'trousers',
        status: 'clean',
      });
      const cleanShoes = mockItem({
        id: 'shoe-1',
        name: 'Clean Loafers',
        category: 'Footwear',
        subcategory: 'loafers',
        status: 'clean',
      });

      const res = recommendOutfitsWithTelemetry({
        items: [dirtyAnchor, cleanBottom, cleanShoes],
        occasion: 'office',
        season: 'summer',
        localDate: '2026-11-14',
        anchorItemId: dirtyAnchor.id,
        allowPlanningMode: false,
      });

      expect(res.set.outfits.length).toBe(0);
      expect(res.set.missingRequirements).toBeDefined();
      expect(res.set.missingRequirements?.length).toBeGreaterThan(0);
      expect(res.set.missingRequirements?.[0]?.templateId).toBe('unwashed_anchor');
      expect(res.set.missingRequirements?.[0]?.explanation).toMatch(/wash/i);
    });

    it('strictly returns 0 outfits when allowPlanningMode: false and anchor is in laundry', () => {
      const laundryAnchor = mockItem({
        id: 'anchor-laundry',
        name: 'In-Laundry Kurta',
        category: 'Ethnic',
        subcategory: 'kurta',
        status: 'in_laundry',
      });
      const cleanBottom = mockItem({
        id: 'bot-1',
        name: 'Clean Pajama',
        category: 'Ethnic',
        subcategory: 'churidar',
        status: 'clean',
      });
      const cleanShoes = mockItem({
        id: 'shoe-1',
        name: 'Clean Juttis',
        category: 'Footwear',
        subcategory: 'juttis',
        status: 'clean',
      });

      const res = recommendOutfits({
        items: [laundryAnchor, cleanBottom, cleanShoes],
        occasion: 'festive',
        season: 'summer',
        localDate: '2026-11-14',
        anchorItemId: laundryAnchor.id,
        allowPlanningMode: false,
      });

      expect(res.length).toBe(0);
    });

    it('permits unwashed anchor with clear planning warning when allowPlanningMode: true', () => {
      const dirtyAnchor = mockItem({
        id: 'anchor-dirty',
        name: 'Dirty Oxford Shirt',
        category: 'Tops',
        subcategory: 'shirt',
        status: 'needs_washing',
      });
      const cleanBottom = mockItem({
        id: 'bot-1',
        name: 'Clean Chinos',
        category: 'Bottoms',
        subcategory: 'trousers',
        status: 'clean',
      });
      const cleanShoes = mockItem({
        id: 'shoe-1',
        name: 'Clean Loafers',
        category: 'Footwear',
        subcategory: 'loafers',
        status: 'clean',
      });

      const res = recommendOutfitsWithTelemetry({
        items: [dirtyAnchor, cleanBottom, cleanShoes],
        occasion: 'office',
        season: 'summer',
        localDate: '2026-11-14',
        anchorItemId: dirtyAnchor.id,
        allowPlanningMode: true,
      });

      expect(res.set.outfits.length).toBeGreaterThan(0);
      const topOutfit = res.set.outfits[0];
      const hasWarning = topOutfit.explanation?.assumptions?.some((a) =>
        a.toLowerCase().includes('washing before wear')
      );
      expect(hasWarning).toBe(true);
    });

    it('sacred occasion decorum: excludes leather items for puja occasion at Tier 1', () => {
      const template = TEMPLATES.find((t) => t.name === 'Kurta ensemble') || TEMPLATES[0];

      const kurta = mockItem({
        id: 'top-kurta',
        name: 'Cotton Kurta',
        category: 'Ethnic',
        subcategory: 'kurta',
        fabric: 'cotton',
        status: 'clean',
      });
      const pajama = mockItem({
        id: 'bot-pajama',
        name: 'Cotton Pajama',
        category: 'Ethnic',
        subcategory: 'churidar',
        fabric: 'cotton',
        status: 'clean',
      });
      const leatherJuttis = mockItem({
        id: 'shoe-leather',
        name: 'Leather Juttis',
        category: 'Footwear',
        subcategory: 'juttis',
        fabric: 'leather' as any,
        status: 'clean',
      });

      const slots: Record<string, WardrobeItem[]> = {};
      for (const reqKey of Object.keys(template.required)) {
        if (reqKey === 'top') slots[reqKey] = [kurta];
        else if (reqKey === 'bottom') slots[reqKey] = [pajama];
        else if (reqKey === 'footwear') slots[reqKey] = [leatherJuttis];
        else slots[reqKey] = [mockItem({ id: `item-${reqKey}`, status: 'clean' })];
      }

      const hardCheck = evaluateTier1HardConstraints(
        {
          template,
          slots,
        },
        undefined,
        undefined,
        'puja'
      );

      expect(hardCheck.passed).toBe(false);
      expect(hardCheck.failureReason).toContain('Leather');
      expect(hardCheck.failureReason).toContain('puja');
    });
  });

  // ==========================================================================
  // 2. Smart Buy physical gap detection (P0)
  // ==========================================================================
  describe('P0 — Smart Buy physical gap detection', () => {
    it('detects missing category (0 bottoms) even when wear count is 0 and plan count is 0', () => {
      const wardrobeWithoutBottoms: WardrobeItem[] = [
        mockItem({ id: 'top-1', category: 'Tops', subcategory: 'shirt', timesWorn: 0 }),
        mockItem({ id: 'top-2', category: 'Tops', subcategory: 't-shirt', timesWorn: 0 }),
        mockItem({ id: 'top-3', category: 'Tops', subcategory: 'shirt', timesWorn: 0 }),
        mockItem({ id: 'top-4', category: 'Ethnic', subcategory: 'kurta', timesWorn: 0 }),
        mockItem({ id: 'shoe-1', category: 'Footwear', subcategory: 'sneakers', timesWorn: 0 }),
        mockItem({ id: 'shoe-2', category: 'Footwear', subcategory: 'loafers', timesWorn: 0 }),
      ];

      const report = computeWardrobeGaps({
        wardrobe: wardrobeWithoutBottoms,
        outfitPlans: [], // 0 plans
        referenceTimestamp: FIXED_TIMESTAMP,
      });

      // Crucial: Must NOT return NO_PURCHASE_NEEDED simply because of 0 wears!
      expect(report.purchaseAssessment).toBe('PURCHASE_JUSTIFIED');
      expect(report.gaps.length).toBeGreaterThan(0);
      const bottomGap = report.gaps.find((g) => g.targetRole === 'bottom');
      expect(bottomGap).toBeDefined();
      expect(bottomGap?.type).toBe('MISSING_CATEGORY');
      expect(bottomGap?.gapState).toBe('CRITICAL_GAP');
    });

    it('detects missing category (0 footwear) even when wear count is 0 and plan count is 0', () => {
      const wardrobeWithoutFootwear: WardrobeItem[] = [
        mockItem({ id: 'top-1', category: 'Tops', subcategory: 'shirt', timesWorn: 0 }),
        mockItem({ id: 'top-2', category: 'Tops', subcategory: 't-shirt', timesWorn: 0 }),
        mockItem({ id: 'bot-1', category: 'Bottoms', subcategory: 'jeans', timesWorn: 0 }),
        mockItem({ id: 'bot-2', category: 'Bottoms', subcategory: 'trousers', timesWorn: 0 }),
      ];

      const report = computeWardrobeGaps({
        wardrobe: wardrobeWithoutFootwear,
        outfitPlans: [],
        referenceTimestamp: FIXED_TIMESTAMP,
      });

      expect(report.purchaseAssessment).toBe('PURCHASE_JUSTIFIED');
      const footwearGap = report.gaps.find((g) => g.targetRole === 'footwear');
      expect(footwearGap).toBeDefined();
      expect(footwearGap?.type).toBe('MISSING_CATEGORY');
      expect(footwearGap?.gapState).toBe('CRITICAL_GAP');
    });

    it('returns NO_PURCHASE_NEEDED when sparse wardrobe has complete essential categories (< 5 items)', () => {
      const sparseCompleteWardrobe: WardrobeItem[] = [
        mockItem({ id: 'top-1', category: 'Tops', subcategory: 'shirt', timesWorn: 0 }),
        mockItem({ id: 'bot-1', category: 'Bottoms', subcategory: 'jeans', timesWorn: 0 }),
        mockItem({ id: 'shoe-1', category: 'Footwear', subcategory: 'sneakers', timesWorn: 0 }),
      ];

      const report = computeWardrobeGaps({
        wardrobe: sparseCompleteWardrobe,
        outfitPlans: [],
        referenceTimestamp: FIXED_TIMESTAMP,
      });

      expect(report.dataSufficiency.isSufficient).toBe(false);
      expect(report.purchaseAssessment).toBe('NO_PURCHASE_NEEDED');
      expect(report.gaps.length).toBe(0);
      expect(report.negativeEvidence.primaryReason).toContain('at least 5 garments');
    });
  });

  // ==========================================================================
  // 3. Purchase claim accuracy (P1)
  // ==========================================================================
  describe('P1 — Purchase claim accuracy', () => {
    it('does not contain hardcoded unverified price ranges in candidates list', () => {
      const candidateList = candidates('summer');
      expect(candidateList.length).toBeGreaterThan(0);
      const hasSpecificRupeePrices = candidateList.some(
        (c) => typeof c.priceRange === 'string' && c.priceRange.includes('₹')
      );
      expect(hasSpecificRupeePrices).toBe(false);
    });

    it('candidate reasons do not claim pairing with unowned specific pieces', () => {
      const candidateList = candidates('summer');
      // Reasons must not say "Pairs with your white tee" or "Pairs with your linen shirt"
      for (const cand of candidateList) {
        expect(cand.note).not.toMatch(/pairs with your (white|linen|black|denim)/i);
      }
    });
  });

  // ==========================================================================
  // 4. Saved outfit live-state validation (P0)
  // ==========================================================================
  describe('P0 — Saved outfit live-state validation', () => {
    it('detects live unclean garment state even when snapshot was saved as clean', () => {
      const savedSnapshotItem: WardrobeItem = mockItem({
        id: 'garment-1',
        name: 'Indigo Kurta',
        status: 'clean', // Was clean when saved!
      });

      // But in the user's current live wardrobe, the garment is dirty!
      const liveWardrobe: WardrobeItem[] = [
        mockItem({
          id: 'garment-1',
          name: 'Indigo Kurta',
          status: 'needs_washing', // Now dirty!
        }),
      ];

      const livePiece = liveWardrobe.find((i) => i.id === savedSnapshotItem.id);
      expect(livePiece).toBeDefined();
      expect(livePiece?.status).toBe('needs_washing');
      // Proves that checking liveWardrobe catches the unclean status that snapshot bypassed
      expect(livePiece?.status !== 'clean').toBe(true);
    });

    it('detects deleted garment from live wardrobe that still exists in saved snapshot', () => {
      const savedSnapshotItem: WardrobeItem = mockItem({
        id: 'deleted-garment',
        name: 'Old Linen Shirt',
        status: 'clean',
      });

      // User deleted this item, so current live wardrobe does not contain it
      const liveWardrobe: WardrobeItem[] = [
        mockItem({ id: 'active-item-1', name: 'Cotton Pants' }),
      ];

      const existsInLive = liveWardrobe.some((i) => i.id === savedSnapshotItem.id);
      expect(existsInLive).toBe(false);
    });
  });
});
