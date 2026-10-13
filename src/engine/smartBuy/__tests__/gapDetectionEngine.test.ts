import { describe, it, expect } from 'vitest';
import { computeWardrobeGaps } from '../smartBuyEngine';
import { simulateBuy } from '../../outfitEngine';
import {
  WardrobeItem,
  OutfitPlan,
  PersonalStyleProfile,
  StylePreferences,
  ContextSnapshot,
} from '../../../types';
import { WearAnalyticsReport } from '../../analytics/types';

describe('Phase 9 — Smart Buy 2.0: Gap Detection Engine', () => {
  const FIXED_TIMESTAMP = 1718000000000;

  const createMockItem = (overrides: Partial<WardrobeItem>): WardrobeItem => ({
    id: `item_${Math.random().toString(36).substring(2, 9)}`,
    name: 'Mock Garment',
    category: 'Tops',
    subcategory: 'shirt',
    status: 'clean',
    timesWorn: 12,
    createdAt: FIXED_TIMESTAMP - 180 * 86400000,
    lastWorn: FIXED_TIMESTAMP - 10 * 86400000,
    colors: ['navy'],
    formality: 2,
    favorite: false,
    note: '',
    seasons: ['summer', 'winter'],
    occasions: ['everyday', 'casual outing', 'office'],
    ...overrides,
  });

  const createBalancedWardrobe = (): WardrobeItem[] => [
    createMockItem({ id: 'top1', name: 'Cotton Shirt', category: 'Tops', subcategory: 'shirt', status: 'clean' }),
    createMockItem({ id: 'top2', name: 'Linen Shirt', category: 'Tops', subcategory: 'shirt', status: 'clean' }),
    createMockItem({ id: 'top3', name: 'Crew T-shirt', category: 'Tops', subcategory: 't-shirt', status: 'clean' }),
    createMockItem({ id: 'bot1', name: 'Dark Trousers', category: 'Bottoms', subcategory: 'trousers', status: 'clean' }),
    createMockItem({ id: 'bot2', name: 'Classic Jeans', category: 'Bottoms', subcategory: 'jeans', status: 'clean' }),
    createMockItem({ id: 'shoe1', name: 'Leather Loafers', category: 'Footwear', subcategory: 'loafers', status: 'clean' }),
    createMockItem({ id: 'shoe2', name: 'Clean Sneakers', category: 'Footwear', subcategory: 'sneakers', status: 'clean' }),
  ];

  // Test 1 — Missing category
  it('Test 1 — Missing category: 0 footwear + active office demand + no dormant alternative = CRITICAL_GAP + PURCHASE_JUSTIFIED', () => {
    const wardrobe: WardrobeItem[] = [
      createMockItem({ id: 'top1', name: 'Formal Shirt', category: 'Tops', subcategory: 'shirt', status: 'clean' }),
      createMockItem({ id: 'top2', name: 'Linen Shirt', category: 'Tops', subcategory: 'shirt', status: 'clean' }),
      createMockItem({ id: 'bot1', name: 'Formal Trousers', category: 'Bottoms', subcategory: 'trousers', status: 'clean' }),
      createMockItem({ id: 'bot2', name: 'Chinos', category: 'Bottoms', subcategory: 'trousers', status: 'clean' }),
      createMockItem({ id: 'top3', name: 'Polo', category: 'Tops', subcategory: 't-shirt', status: 'clean' }),
      // ZERO Footwear in wardrobe!
    ];

    const outfitPlans: OutfitPlan[] = [
      {
        id: 'plan_office_1',
        date: '2026-10-15',
        occasion: 'office',
        status: 'planned',
        outfit: {} as any,
        createdAt: FIXED_TIMESTAMP,
        updatedAt: FIXED_TIMESTAMP,
      },
    ];

    const report = computeWardrobeGaps({
      wardrobe,
      outfitPlans,
      referenceTimestamp: FIXED_TIMESTAMP,
    });

    expect(report.dataSufficiency.isSufficient).toBe(true);
    const footwearGap = report.gaps.find((g) => g.targetRole === 'footwear');
    expect(footwearGap).toBeDefined();
    expect(footwearGap?.type).toBe('MISSING_CATEGORY');
    expect(footwearGap?.gapState).toBe('CRITICAL_GAP');
    expect(footwearGap?.purchaseAssessment).toBe('PURCHASE_JUSTIFIED');
    expect(report.purchaseAssessment).toBe('PURCHASE_JUSTIFIED');
  });

  // Test 2 — Dormant suppression
  it('Test 2 — Dormant suppression: missing active footwear + dormant suitable footwear = REDISCOVERY_SUGGESTED + NO_PURCHASE_NEEDED', () => {
    const dormantShoes = createMockItem({
      id: 'dormant_oxfords',
      name: 'Classic Oxford Shoes',
      category: 'Footwear',
      subcategory: 'formal shoes',
      status: 'clean',
      createdAt: FIXED_TIMESTAMP - 180 * 86400000,
      lastWorn: FIXED_TIMESTAMP - 120 * 86400000, // Not worn for 120 days (dormant)
    });

    const wardrobe: WardrobeItem[] = [
      createMockItem({ id: 'top1', category: 'Tops', subcategory: 'shirt', status: 'clean' }),
      createMockItem({ id: 'top2', category: 'Tops', subcategory: 'shirt', status: 'clean' }),
      createMockItem({ id: 'bot1', category: 'Bottoms', subcategory: 'trousers', status: 'clean' }),
      createMockItem({ id: 'bot2', category: 'Bottoms', subcategory: 'trousers', status: 'clean' }),
      createMockItem({ id: 'top3', category: 'Tops', subcategory: 't-shirt', status: 'clean' }),
      createMockItem({ id: 'blazer1', category: 'Outerwear', subcategory: 'blazer', status: 'clean' }),
      dormantShoes,
    ];

    const outfitPlans: OutfitPlan[] = [
      {
        id: 'plan1',
        date: '2026-10-15',
        occasion: 'office',
        status: 'planned',
        outfit: {} as any,
        createdAt: FIXED_TIMESTAMP,
        updatedAt: FIXED_TIMESTAMP,
      },
    ];

    const mockWearAnalytics: Partial<WearAnalyticsReport> = {
      totalLifetimeWears: 60,
      rotation: {
        isEligible: true,
        confidence: 0.8,
        totalCleanItems: 7,
        activeCount: 4,
        occasionalCount: 2,
        dormantCount: 1,
        neverWornCount: 0,
        itemsByState: {
          active: [],
          occasional: [],
          dormant: [
            {
              item: dormantShoes,
              state: 'dormant',
              itemAgeDays: 180,
              lastWornDaysAgo: 120,
              effectiveWears: 3,
              costPerWear: { effectiveWears: 3, status: 'unpriced', formattedCPW: '—' },
            },
          ],
          never_worn: [],
        },
      },
    };

    const report = computeWardrobeGaps({
      wardrobe,
      wearAnalytics: mockWearAnalytics as WearAnalyticsReport,
      outfitPlans,
      referenceTimestamp: FIXED_TIMESTAMP,
    });

    // The dormant item should be suggested for rediscovery, preventing purchase justification!
    const rediscoveryGap = report.gaps.find((g) => g.rediscoveryCandidate?.item.id === 'dormant_oxfords');
    expect(rediscoveryGap).toBeDefined();
    expect(rediscoveryGap?.gapState).toBe('REDISCOVERY_SUGGESTED');
    expect(rediscoveryGap?.purchaseAssessment).toBe('NO_PURCHASE_NEEDED');
    expect(report.purchaseAssessment).toBe('NO_PURCHASE_NEEDED');
  });

  // Test 3 — Balanced wardrobe
  it('Test 3 — Balanced wardrobe: healthy coverage + healthy rotation = NO_GAP + NO_PURCHASE_NEEDED', () => {
    const wardrobe = createBalancedWardrobe();
    const stylePreferences: Partial<StylePreferences> = {
      preferredContexts: ['everyday', 'casual outing'],
    };

    const report = computeWardrobeGaps({
      wardrobe,
      stylePreferences: stylePreferences as StylePreferences,
      referenceTimestamp: FIXED_TIMESTAMP,
    });

    expect(report.dataSufficiency.isSufficient).toBe(true);
    expect(report.purchaseAssessment).toBe('NO_PURCHASE_NEEDED');
    expect(report.negativeEvidence.hasNoPurchaseNeeded).toBe(true);
    expect(report.coverageSummary.unsupportedActiveOccasionsCount).toBe(0);
  });

  // Test 4 — Insufficient data
  it('Test 4 — Insufficient data: 3 wardrobe items = INSUFFICIENT_DATA + NO_PURCHASE_NEEDED', () => {
    const sparseWardrobe: WardrobeItem[] = [
      createMockItem({ id: 'top1', category: 'Tops' }),
      createMockItem({ id: 'bot1', category: 'Bottoms' }),
      createMockItem({ id: 'shoe1', category: 'Footwear' }),
    ];

    const report = computeWardrobeGaps({
      wardrobe: sparseWardrobe,
      referenceTimestamp: FIXED_TIMESTAMP,
    });

    expect(report.dataSufficiency.isSufficient).toBe(false);
    expect(report.purchaseAssessment).toBe('NO_PURCHASE_NEEDED');
    expect(report.gaps.length).toBe(0);
    expect(report.negativeEvidence.primaryReason).toContain('at least 5 garments');
  });

  // Test 5 — Personal Style Brain Constraints
  it('Test 5 — Personal Style: gap + avoided polyblend = polyblend excluded from guidance', () => {
    const wardrobe: WardrobeItem[] = [
      createMockItem({ id: 'top1', category: 'Tops', subcategory: 'shirt', status: 'clean' }),
      createMockItem({ id: 'top2', category: 'Tops', subcategory: 'shirt', status: 'clean' }),
      createMockItem({ id: 'bot1', category: 'Bottoms', subcategory: 'trousers', status: 'clean' }),
      createMockItem({ id: 'bot2', category: 'Bottoms', subcategory: 'jeans', status: 'clean' }),
      createMockItem({ id: 'top3', category: 'Tops', subcategory: 't-shirt', status: 'clean' }),
      // Missing footwear
    ];

    const styleProfile: Partial<PersonalStyleProfile> = {
      avoidedFabrics: ['polyblend', 'wool'],
      fabricAffinities: {
        cotton: { score: 0.8, signalCount: 10, confidence: 0.9 },
        linen: { score: 0.7, signalCount: 5, confidence: 0.8 },
      } as any,
      fitAffinities: {
        regular: { score: 0.6, signalCount: 6, confidence: 0.7 },
      } as any,
    };

    const outfitPlans: OutfitPlan[] = [
      {
        id: 'plan1',
        date: '2026-10-15',
        occasion: 'office',
        status: 'planned',
        outfit: {} as any,
        createdAt: FIXED_TIMESTAMP,
        updatedAt: FIXED_TIMESTAMP,
      },
    ];

    const report = computeWardrobeGaps({
      wardrobe,
      styleProfile: styleProfile as PersonalStyleProfile,
      outfitPlans,
      referenceTimestamp: FIXED_TIMESTAMP,
    });

    const gap = report.gaps.find((g) => g.targetRole === 'footwear');
    expect(gap).toBeDefined();
    expect(gap?.attributeGuidance?.avoidedFabrics).toContain('polyblend');
    expect(gap?.attributeGuidance?.preferredFabrics).not.toContain('polyblend');
    expect(gap?.attributeGuidance?.preferredFabrics).toContain('cotton');
  });

  // Test 6 — Inactive occasion
  it('Test 6 — Inactive occasion: no wedding preference + no wedding plan = no wedding gap', () => {
    const wardrobe = createBalancedWardrobe(); // Western clothes only, 0 sarees / 0 lehengas
    const stylePreferences: Partial<StylePreferences> = {
      preferredContexts: ['everyday', 'casual outing'],
    };

    const report = computeWardrobeGaps({
      wardrobe,
      stylePreferences: stylePreferences as StylePreferences,
      outfitPlans: [], // Zero wedding plans
      referenceTimestamp: FIXED_TIMESTAMP,
    });

    // Zero ethnic/wedding wear is present, but wedding is NOT active!
    // Therefore, zero wedding gaps should be reported!
    const weddingGap = report.gaps.find((g) => g.activeOccasions.includes('wedding guest'));
    expect(weddingGap).toBeUndefined();
  });

  // Test 7 — Determinism
  it('Test 7 — Determinism: identical inputs + identical referenceTimestamp produce deep equal results', () => {
    const wardrobe = createBalancedWardrobe();
    const outfitPlans: OutfitPlan[] = [
      {
        id: 'plan1',
        date: '2026-10-15',
        occasion: 'office',
        status: 'planned',
        outfit: {} as any,
        createdAt: FIXED_TIMESTAMP,
        updatedAt: FIXED_TIMESTAMP,
      },
    ];

    const input = {
      wardrobe,
      outfitPlans,
      referenceTimestamp: FIXED_TIMESTAMP,
    };

    const run1 = computeWardrobeGaps(input);
    const run2 = computeWardrobeGaps(input);

    expect(run1).toEqual(run2);
  });

  // Test 8 — Current context only
  it('Test 8 — Current context only: current very_hot thermal context flags breathable gap, no historical weather assumed', () => {
    const syntheticWardrobe: WardrobeItem[] = [
      createMockItem({ id: 'top1', category: 'Tops', subcategory: 'shirt', fabric: 'polyblend' }),
      createMockItem({ id: 'top2', category: 'Tops', subcategory: 't-shirt', fabric: 'viscose' }),
      createMockItem({ id: 'top3', category: 'Tops', subcategory: 'shirt', fabric: 'polyblend' }),
      createMockItem({ id: 'bot1', category: 'Bottoms', subcategory: 'trousers', fabric: 'polyblend' }),
      createMockItem({ id: 'shoe1', category: 'Footwear', subcategory: 'sneakers' }),
    ];

    const hotContext: ContextSnapshot = {
      freshness: 'fresh',
      weather: null,
      location: {} as any,
      date: '2026-10-15',
      timeOfDay: 'afternoon',
      thermalContext: 'very_hot',
      rainContext: 'none',
      occasion: 'everyday',
      confidence: 1.0,
      source: 'live',
    };

    const report = computeWardrobeGaps({
      wardrobe: syntheticWardrobe,
      contextSnapshot: hotContext,
      referenceTimestamp: FIXED_TIMESTAMP,
    });

    const contextGap = report.gaps.find((g) => g.type === 'CONTEXT_GAP');
    expect(contextGap).toBeDefined();
    expect(contextGap?.headline).toContain('Breathable Textiles');
    expect(contextGap?.evidence.some((e) => e.tier === 'TIER_5_ENVIRONMENTAL_CONTEXT')).toBe(true);
  });

  // Test 9 — Replacement safety
  it('Test 9 — Replacement safety: high wear count must NOT produce REPLACEMENT_GAP without physical degradation evidence', () => {
    const heavilyWornJeans = createMockItem({
      id: 'core_jeans',
      name: 'Core Selvedge Jeans',
      category: 'Bottoms',
      subcategory: 'jeans',
      timesWorn: 85,
    });

    const wardrobe: WardrobeItem[] = [
      ...createBalancedWardrobe().filter((i) => i.category !== 'Bottoms'),
      heavilyWornJeans,
    ];

    const mockWearAnalytics: Partial<WearAnalyticsReport> = {
      totalLifetimeWears: 150,
      reconciledWears: {
        core_jeans: {
          itemId: 'core_jeans',
          counterTimesWorn: 85,
          canonicalEventCount: 85,
          legacyWearsDelta: 0,
          reconciliationCase: 'A_MATCH',
          effectiveLifetimeWears: 85,
        },
      },
    };

    const report = computeWardrobeGaps({
      wardrobe,
      wearAnalytics: mockWearAnalytics as WearAnalyticsReport,
      referenceTimestamp: FIXED_TIMESTAMP,
    });

    // Must NOT emit REPLACEMENT_GAP
    const replacementGap = report.gaps.find((g) => g.type === 'REPLACEMENT_GAP');
    expect(replacementGap).toBeUndefined();

    // May emit safe HIGH_UTILIZATION advisory with NO_PURCHASE_NEEDED
    const highUtilGap = report.gaps.find((g) => g.headline.includes('High Utilization'));
    if (highUtilGap) {
      expect(highUtilGap.purchaseAssessment).toBe('NO_PURCHASE_NEEDED');
      expect(highUtilGap.explanation).not.toContain('worn out');
      expect(highUtilGap.explanation).toContain('rotating');
    }
  });

  // Test 10 — Tier 6 protection
  it('Test 10 — Tier 6 protection: generic stylist ratio heuristics cannot independently trigger PURCHASE_JUSTIFIED', () => {
    // 6 tops, 2 bottoms (3:1 ratio heuristic might diagnose uneven ratio, but both categories have clean pieces)
    const wardrobe: WardrobeItem[] = [
      createMockItem({ id: 'top1', category: 'Tops', subcategory: 'shirt' }),
      createMockItem({ id: 'top2', category: 'Tops', subcategory: 'shirt' }),
      createMockItem({ id: 'top3', category: 'Tops', subcategory: 't-shirt' }),
      createMockItem({ id: 'top4', category: 'Tops', subcategory: 't-shirt' }),
      createMockItem({ id: 'top5', category: 'Tops', subcategory: 'shirt' }),
      createMockItem({ id: 'top6', category: 'Tops', subcategory: 'shirt' }),
      createMockItem({ id: 'bot1', category: 'Bottoms', subcategory: 'jeans' }),
      createMockItem({ id: 'bot2', category: 'Bottoms', subcategory: 'trousers' }),
      createMockItem({ id: 'shoe1', category: 'Footwear', subcategory: 'sneakers' }),
    ];

    const report = computeWardrobeGaps({
      wardrobe,
      stylePreferences: { preferredContexts: ['everyday', 'casual outing'] } as any,
      referenceTimestamp: FIXED_TIMESTAMP,
    });

    // Ratio heuristic alone cannot force purchase justification when everyday outfits are completely viable!
    expect(report.purchaseAssessment).toBe('NO_PURCHASE_NEEDED');
  });

  // Test 11 — Purchase decoupling
  it('Test 11 — Purchase decoupling: shortage with dormant solution enforces NO_PURCHASE_NEEDED', () => {
    const dormantBlazer = createMockItem({
      id: 'dormant_blazer',
      name: 'Wool Blazer',
      category: 'Outerwear',
      subcategory: 'blazer',
      createdAt: FIXED_TIMESTAMP - 200 * 86400000,
      lastWorn: FIXED_TIMESTAMP - 150 * 86400000,
    });

    const wardrobe: WardrobeItem[] = [
      ...createBalancedWardrobe(),
      dormantBlazer,
    ];

    const mockWearAnalytics: Partial<WearAnalyticsReport> = {
      totalLifetimeWears: 80,
      rotation: {
        isEligible: true,
        confidence: 0.8,
        totalCleanItems: 8,
        activeCount: 6,
        occasionalCount: 1,
        dormantCount: 1,
        neverWornCount: 0,
        itemsByState: {
          active: [],
          occasional: [],
          dormant: [
            {
              item: dormantBlazer,
              state: 'dormant',
              itemAgeDays: 200,
              lastWornDaysAgo: 150,
              effectiveWears: 1,
              costPerWear: { effectiveWears: 1, status: 'unpriced', formattedCPW: '—' },
            },
          ],
          never_worn: [],
        },
      },
    };

    const report = computeWardrobeGaps({
      wardrobe,
      wearAnalytics: mockWearAnalytics as WearAnalyticsReport,
      referenceTimestamp: FIXED_TIMESTAMP,
    });

    expect(report.purchaseAssessment).toBe('NO_PURCHASE_NEEDED');
  });

  // Test 12 — Legacy compatibility
  it('Test 12 — Legacy compatibility: existing simulateBuy function remains functional and intact', () => {
    const wardrobe = createBalancedWardrobe();
    const candidate = createMockItem({
      id: 'cand1',
      name: 'Chambray Shirt',
      category: 'Tops',
      subcategory: 'shirt',
    });

    const delta = simulateBuy(wardrobe, candidate, ['everyday', 'casual outing'], 'summer');
    expect(typeof delta).toBe('number');
    expect(delta).toBeGreaterThanOrEqual(0);
  });
});
