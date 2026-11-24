import { describe, it, expect } from 'vitest';
import { recommendOutfitsWithTelemetry } from '../engine/recommendationEngine';
import { evaluateTier1HardConstraints, validateOutfitWearability } from '../engine/hardConstraints';
import { computeWardrobeGaps } from '../engine/smartBuy/smartBuyEngine';
import { TEMPLATES } from '../engine/outfitTemplates';
import {
  WardrobeItem,
  GeneratedOutfit,
  StylePreferences,
  DEFAULT_STYLE_PREFERENCES,
} from '../types';

describe('Phase 1.2.1 Adversarial Trust & Grounding Tests', () => {
  const FIXED_TIMESTAMP = 1718000000000;

  const mockItem = (overrides: Partial<WardrobeItem>): WardrobeItem => ({
    id: `item_${Math.random().toString(36).substring(2, 9)}`,
    name: 'Sample Garment',
    category: 'Tops',
    subcategory: 'shirt',
    status: 'clean',
    timesWorn: 3,
    colors: ['white'],
    formality: 3,
    favorite: false,
    note: '',
    seasons: ['summer', 'monsoon', 'winter'],
    occasions: ['college', 'everyday', 'office', 'puja'],
    ...overrides,
  });

  const balancedWardrobe: WardrobeItem[] = [
    mockItem({ id: 'top-1', name: 'Oxford Shirt', category: 'Tops', subcategory: 'shirt', colors: ['white'], status: 'clean' }),
    mockItem({ id: 'bottom-1', name: 'Navy Chinos', category: 'Bottoms', subcategory: 'trousers', colors: ['navy'], status: 'clean' }),
    mockItem({ id: 'shoes-1', name: 'White Sneakers', category: 'Footwear', subcategory: 'sneakers', colors: ['white'], status: 'clean' }),
  ];

  describe('1. Laundry and Planning Mode Adversarial Isolation', () => {
    it('strictly rejects dirty anchor when allowPlanningMode is explicitly false', () => {
      const dirtyAnchor = mockItem({
        id: 'anchor-dirty',
        name: 'Linen Kurta',
        category: 'Tops',
        subcategory: 'kurta',
        colors: ['beige'],
        status: 'needs_washing',
      });
      const wardrobe = [dirtyAnchor, ...balancedWardrobe];

      const res = recommendOutfitsWithTelemetry({
        items: wardrobe,
        occasion: 'college',
        season: 'summer',
        localDate: '2026-11-14',
        anchorItemId: dirtyAnchor.id,
        allowPlanningMode: false,
      });

      expect(res.set.outfits).toHaveLength(0);
      expect(res.set.missingRequirements).toBeDefined();
      expect(res.set.missingRequirements?.[0]?.templateId).toBe('unwashed_anchor');
      expect(res.set.missingRequirements?.[0]?.explanation).toMatch(/wash/i);
    });

    it('permits dirty anchor when allowPlanningMode is explicitly true', () => {
      const dirtyAnchor = mockItem({
        id: 'anchor-dirty',
        name: 'Linen Kurta',
        category: 'Tops',
        subcategory: 'kurta',
        colors: ['beige'],
        status: 'needs_washing',
      });
      const wardrobe = [dirtyAnchor, ...balancedWardrobe];

      const res = recommendOutfitsWithTelemetry({
        items: wardrobe,
        occasion: 'college',
        season: 'summer',
        localDate: '2026-11-14',
        anchorItemId: dirtyAnchor.id,
        allowPlanningMode: true,
      });

      expect(res.set.outfits.length).toBeGreaterThan(0);
      const firstOutfitPieces = Object.values(res.set.outfits[0].slots).flat();
      expect(firstOutfitPieces.some((p) => p.id === dirtyAnchor.id)).toBe(true);
      expect(res.set.outfits[0].explanation?.assumptions?.some((a) => a.includes('washing before wear'))).toBe(true);
    });

    it('rejects dirty companion pieces even when planning mode is true for anchor', () => {
      const dirtyAnchor = mockItem({
        id: 'anchor-dirty',
        name: 'Linen Kurta',
        category: 'Tops',
        subcategory: 'kurta',
        colors: ['beige'],
        status: 'needs_washing',
      });
      const dirtyBottom = mockItem({
        id: 'bottom-dirty',
        name: 'Dirty Chinos',
        category: 'Bottoms',
        subcategory: 'trousers',
        colors: ['navy'],
        status: 'in_laundry',
      });
      const wardrobe = [dirtyAnchor, dirtyBottom, balancedWardrobe[2]]; // Only dirty bottom available

      const res = recommendOutfitsWithTelemetry({
        items: wardrobe,
        occasion: 'college',
        season: 'summer',
        localDate: '2026-11-14',
        anchorItemId: dirtyAnchor.id,
        allowPlanningMode: true,
      });

      // No outfit should be generated because companion bottom is dirty
      expect(res.set.outfits).toHaveLength(0);
    });

    it('safely treats unknown garment status as unwearable without runtime crashes', () => {
      const template = TEMPLATES[0];
      const unknownItem = mockItem({
        id: 'item-unknown',
        status: 'damaged' as any, // non-clean status
      });

      const check = evaluateTier1HardConstraints(
        {
          template,
          slots: {
            top: [unknownItem],
            bottom: [balancedWardrobe[1]],
            footwear: [balancedWardrobe[2]],
          },
        },
        undefined,
        undefined,
        'college'
      );
      expect(check.passed).toBe(false);
      expect(check.failureReason).toMatch(/status|clean|wash|laundry/i);
    });
  });

  describe('2. Saved Outfit Integrity & Wear Logging Guards', () => {
    const mockOutfit: GeneratedOutfit = {
      id: 'outfit-1',
      template: 'Smart Casual',
      slots: {
        top: [mockItem({ id: 'top-1', name: 'White Shirt' })],
        bottom: [mockItem({ id: 'bottom-1', name: 'Navy Trousers' })],
        footwear: [mockItem({ id: 'shoes-1', name: 'Loafers' })],
      },
      score: 85,
      why: 'Smart Casual Look',
    };

    it('blocks wear logging when a garment in the saved outfit was deleted from wardrobe', () => {
      // Live wardrobe only has top and footwear; bottom was deleted
      const liveWardrobe = [
        mockItem({ id: 'top-1', name: 'White Shirt', status: 'clean' }),
        mockItem({ id: 'shoes-1', name: 'Loafers', status: 'clean' }),
      ];

      // Re-map pieces against live inventory as done in WardrobeContext.markOutfitWornOnDate
      const allPieces = Object.values(mockOutfit.slots).flat();
      const missingPiece = allPieces.find((p) => !liveWardrobe.some((item) => item.id === p.id));
      expect(missingPiece).toBeDefined();
      expect(missingPiece?.id).toBe('bottom-1');

      // Validating live pieces count
      const livePieces = allPieces.map((p) => liveWardrobe.find((item) => item.id === p.id)).filter(Boolean) as WardrobeItem[];
      expect(livePieces.length).toBeLessThan(allPieces.length);
    });

    it('blocks wear logging when a garment became dirty after saving', () => {
      const liveWardrobe = [
        mockItem({ id: 'top-1', name: 'White Shirt', status: 'clean' }),
        mockItem({ id: 'bottom-1', name: 'Navy Trousers', status: 'in_laundry' }),
        mockItem({ id: 'shoes-1', name: 'Loafers', status: 'clean' }),
      ];

      const liveOutfit: GeneratedOutfit = {
        ...mockOutfit,
        slots: {
          top: [liveWardrobe[0]],
          bottom: [liveWardrobe[1]],
          footwear: [liveWardrobe[2]],
        },
      };

      const wearCheck = validateOutfitWearability(liveOutfit);
      expect(wearCheck.canWear).toBe(false);
      expect(wearCheck.error).toMatch(/needs washing|in laundry/i);
    });

    it('reports all unavailable garments when multiple pieces are dirty or deleted', () => {
      const liveWardrobe = [
        mockItem({ id: 'top-1', name: 'White Shirt', status: 'needs_washing' }),
        mockItem({ id: 'bottom-1', name: 'Navy Trousers', status: 'in_laundry' }),
        mockItem({ id: 'shoes-1', name: 'Loafers', status: 'clean' }),
      ];

      const allPieces = [liveWardrobe[0], liveWardrobe[1], liveWardrobe[2]];
      const dirtyPieces = allPieces.filter((p) => p.status !== 'clean');
      expect(dirtyPieces).toHaveLength(2);
      const names = dirtyPieces.map((p) => `"${p.name}"`).join(', ');
      expect(names).toBe('"White Shirt", "Navy Trousers"');
    });

    it('successfully validates wearability when all saved garments are clean and present', () => {
      const cleanWardrobe = [
        mockItem({ id: 'top-1', name: 'White Shirt', status: 'clean' }),
        mockItem({ id: 'bottom-1', name: 'Navy Trousers', status: 'clean' }),
        mockItem({ id: 'shoes-1', name: 'Loafers', status: 'clean' }),
      ];

      const cleanOutfit: GeneratedOutfit = {
        ...mockOutfit,
        slots: {
          top: [cleanWardrobe[0]],
          bottom: [cleanWardrobe[1]],
          footwear: [cleanWardrobe[2]],
        },
      };

      const wearCheck = validateOutfitWearability(cleanOutfit);
      expect(wearCheck.canWear).toBe(true);
      expect(wearCheck.error).toBeUndefined();
    });
  });

  describe('3. Smart Buy & Wardrobe Gap Correctness', () => {
    it('detects 0 bottoms with 0 wear count as CRITICAL_GAP and PURCHASE_JUSTIFIED', () => {
      const wardrobeNoBottoms = [
        mockItem({ id: 'top-1', category: 'Tops', subcategory: 'shirt', timesWorn: 0 }),
        mockItem({ id: 'shoes-1', category: 'Footwear', subcategory: 'sneakers', timesWorn: 0 }),
      ];

      const report = computeWardrobeGaps({
        wardrobe: wardrobeNoBottoms,
        outfitPlans: [],
        referenceTimestamp: FIXED_TIMESTAMP,
      });
      const bottomGap = report.gaps.find((g) => g.expectedCategory === 'Bottoms');

      expect(bottomGap).toBeDefined();
      expect(bottomGap?.gapState).toBe('CRITICAL_GAP');
      expect(bottomGap?.purchaseAssessment).toBe('PURCHASE_JUSTIFIED');
      expect(report.purchaseAssessment).toBe('PURCHASE_JUSTIFIED');
    });

    it('detects 0 footwear with 0 wear count as CRITICAL_GAP and PURCHASE_JUSTIFIED', () => {
      const wardrobeNoShoes = [
        mockItem({ id: 'top-1', category: 'Tops', subcategory: 'shirt', timesWorn: 0 }),
        mockItem({ id: 'bottom-1', category: 'Bottoms', subcategory: 'trousers', timesWorn: 0 }),
      ];

      const report = computeWardrobeGaps({
        wardrobe: wardrobeNoShoes,
        outfitPlans: [],
        referenceTimestamp: FIXED_TIMESTAMP,
      });
      const shoeGap = report.gaps.find((g) => g.expectedCategory === 'Footwear');

      expect(shoeGap).toBeDefined();
      expect(shoeGap?.gapState).toBe('CRITICAL_GAP');
      expect(shoeGap?.purchaseAssessment).toBe('PURCHASE_JUSTIFIED');
      expect(report.purchaseAssessment).toBe('PURCHASE_JUSTIFIED');
    });

    it('prioritizes dormant closet rediscovery over purchase when underused items exist', () => {
      const wardrobeWithDormant = [
        mockItem({ id: 'top-1', category: 'Tops', subcategory: 'shirt', timesWorn: 10 }),
        mockItem({ id: 'top-2', category: 'Tops', subcategory: 't-shirt', timesWorn: 0, lastWorn: undefined }), // Dormant
        mockItem({ id: 'bottom-1', category: 'Bottoms', subcategory: 'trousers', timesWorn: 8 }),
        mockItem({ id: 'shoes-1', category: 'Footwear', subcategory: 'sneakers', timesWorn: 8 }),
        mockItem({ id: 'shoes-2', category: 'Footwear', subcategory: 'loafers', timesWorn: 0 }), // Dormant
      ];

      const report = computeWardrobeGaps({
        wardrobe: wardrobeWithDormant,
        outfitPlans: [],
        referenceTimestamp: FIXED_TIMESTAMP,
      });

      // With essential categories fulfilled, no critical purchase is forced
      expect(report.purchaseAssessment).toBe('NO_PURCHASE_NEEDED');
    });

    it('respects user budget constraints by permitting only essential gaps', () => {
      const wardrobeWithTopsAndBottoms = [
        mockItem({ id: 'top-1', category: 'Tops', subcategory: 'shirt', timesWorn: 2 }),
        mockItem({ id: 'bottom-1', category: 'Bottoms', subcategory: 'trousers', timesWorn: 2 }),
      ];

      // User has configured budget constraint to only prioritize essential gaps
      const preferencesWithBudget: StylePreferences = {
        ...DEFAULT_STYLE_PREFERENCES,
        budgetConstraints: {
          prioritizeEssentialGapsOnly: true,
          maxMonthlyBudget: 3000,
        },
      };

      const report = computeWardrobeGaps({
        wardrobe: wardrobeWithTopsAndBottoms,
        outfitPlans: [],
        referenceTimestamp: FIXED_TIMESTAMP,
        stylePreferences: preferencesWithBudget,
      });
      const shoeGap = report.gaps.find((g) => g.expectedCategory === 'Footwear');
      expect(shoeGap).toBeDefined();
      expect(shoeGap?.gapState).toBe('CRITICAL_GAP');
      expect(shoeGap?.purchaseAssessment).toBe('PURCHASE_JUSTIFIED');
      expect(report.purchaseAssessment).toBe('PURCHASE_JUSTIFIED');
    });
  });

  describe('4. Cultural Preference Correctness (Puja Leather Decorum)', () => {
    const template = TEMPLATES.find((t) => t.name === 'Kurta ensemble') || TEMPLATES[0];

    const leatherShoe = mockItem({
      id: 'shoe-leather',
      name: 'Leather Oxford Shoes',
      category: 'Footwear',
      subcategory: 'formal shoes',
      fabric: 'leather' as any,
      status: 'clean',
    });

    const createPujaCandidate = () => ({
      template,
      slots: {
        top: [mockItem({ id: 'top-kurta', name: 'Cotton Kurta', category: 'Ethnic', subcategory: 'kurta', fabric: 'cotton' })],
        bottom: [mockItem({ id: 'bot-pajama', name: 'Cotton Pajama', category: 'Ethnic', subcategory: 'churidar', fabric: 'cotton' })],
        footwear: [leatherShoe],
      },
    });

    it('hard-rejects animal leather during puja by default', () => {
      const candidate = createPujaCandidate();
      const check = evaluateTier1HardConstraints(candidate, undefined, undefined, 'puja');
      expect(check.passed).toBe(false);
      expect(check.failureReason).toContain('Leather');
      expect(check.failureReason).toContain('puja');
    });

    it('allows leather during puja when user explicitly sets culturalOverrides.allowLeatherInPuja = true', () => {
      const preferences: StylePreferences = {
        ...DEFAULT_STYLE_PREFERENCES,
        culturalOverrides: {
          allowLeatherInPuja: true,
        },
      };

      const candidate = createPujaCandidate();
      const check = evaluateTier1HardConstraints(candidate, undefined, preferences, 'puja');
      expect(check.passed).toBe(true);
      expect(check.failureReason).toBeUndefined();
    });

    it('allows leather during puja when user preferredAesthetics includes modern western', () => {
      const preferences: StylePreferences = {
        ...DEFAULT_STYLE_PREFERENCES,
        preferredAesthetics: ['modern western'],
      };

      const candidate = createPujaCandidate();
      const check = evaluateTier1HardConstraints(candidate, undefined, preferences, 'puja');
      expect(check.passed).toBe(true);
      expect(check.failureReason).toBeUndefined();
    });
  });

  describe('5. Stylist Missing Requirements Truthfulness', () => {
    it('returns missing requirement for footwear when wardrobe lacks footwear', () => {
      const wardrobeNoFootwear = [
        mockItem({ id: 'top-1', category: 'Tops', subcategory: 'shirt', status: 'clean' }),
        mockItem({ id: 'bottom-1', category: 'Bottoms', subcategory: 'trousers', status: 'clean' }),
      ];

      const res = recommendOutfitsWithTelemetry({
        items: wardrobeNoFootwear,
        occasion: 'office',
        season: 'summer',
        localDate: '2026-11-14',
      });

      expect(res.set.outfits).toHaveLength(0);
      expect(res.set.missingRequirements).toBeDefined();
      expect(res.set.missingRequirements!.length).toBeGreaterThan(0);
      expect(res.set.missingRequirements![0].missingRole).toBe('footwear');
      expect(res.set.missingRequirements![0].expectedCategory).toBe('Footwear');
    });

    it('returns missing requirement for bottom when wardrobe lacks bottoms', () => {
      const wardrobeNoBottom = [
        mockItem({ id: 'top-1', category: 'Tops', subcategory: 'shirt', status: 'clean' }),
        mockItem({ id: 'shoes-1', category: 'Footwear', subcategory: 'sneakers', status: 'clean' }),
      ];

      const res = recommendOutfitsWithTelemetry({
        items: wardrobeNoBottom,
        occasion: 'college',
        season: 'summer',
        localDate: '2026-11-14',
      });

      expect(res.set.outfits).toHaveLength(0);
      expect(res.set.missingRequirements).toBeDefined();
      expect(res.set.missingRequirements!.length).toBeGreaterThan(0);
      expect(res.set.missingRequirements![0].missingRole).toBe('bottom');
      expect(res.set.missingRequirements![0].expectedCategory).toBe('Bottoms');
    });
  });
});
