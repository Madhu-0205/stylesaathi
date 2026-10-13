import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { WearAnalyticsView } from '../WearAnalyticsView';
import { WardrobeItem, WearAnalyticsReport, ItemRotationAnalysis } from '../../../types';

const mockUseWearAnalytics = vi.fn();

vi.mock('../../../hooks/useWearAnalytics', () => ({
  useWearAnalytics: (...args: any[]) => mockUseWearAnalytics(...args),
}));

// Mock StyleItemSheet so it doesn't need context
vi.mock('../../wardrobe/StyleItemSheet', () => ({
  StyleItemSheet: ({ anchorItem, isOpen }: any) => {
    if (!isOpen) return null;
    return <div data-testid="style-item-sheet">Styling {anchorItem.name}</div>;
  },
}));

describe('WearAnalyticsView Component', () => {
  const dummyItem: WardrobeItem = {
    id: 'item-1',
    name: 'Classic White Shirt',
    category: 'Tops',
    subcategory: 'shirt',
    colors: ['White'],
    fabric: 'cotton',
    pattern: 'solid',
    fit: 'slim',
    seasons: ['summer'],
    formality: 3,
    occasions: ['office'],
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 12,
    purchasePrice: 2400,
    createdAt: Date.now() - 100 * 86400000,
  };

  const dummyItemAnalysis: ItemRotationAnalysis = {
    item: dummyItem,
    state: 'active',
    effectiveWears: 12,
    lastWornDaysAgo: 4,
    itemAgeDays: 100,
    costPerWear: {
      purchasePrice: 2400,
      effectiveWears: 12,
      costPerWear: 200,
      status: 'amortizing',
      formattedCPW: '₹200/wear',
    },
  };

  const createDummyReport = (overrides: Partial<WearAnalyticsReport> = {}): WearAnalyticsReport => ({
    generatedAt: Date.now(),
    referenceTimestamp: Date.now(),
    totalLifetimeWears: 18,
    uniqueWornItemsCount: 8,
    reconciledWears: {
      'item-1': {
        itemId: 'item-1',
        effectiveLifetimeWears: 12,
        canonicalEventCount: 12,
        counterTimesWorn: 12,
        legacyWearsDelta: 0,
        reconciliationCase: 'A_MATCH',
      },
    },
    rotation: {
      isEligible: true,
      confidence: 0.75,
      totalCleanItems: 10,
      activeCount: 6,
      occasionalCount: 3,
      dormantCount: 1,
      neverWornCount: 0,
      rotationHealthPercentage: 60,
      itemsByState: {
        active: [dummyItemAnalysis],
        occasional: [],
        dormant: [],
        never_worn: [],
      },
    },
    concentration: {
      isEligible: true,
      confidence: 0.75,
      totalWardrobeCount: 10,
      kItemsCount: 2,
      topKWears: 15,
      totalLifetimeWears: 18,
      concentrationRatio: 83,
      interpretation: 'High Concentration',
      explanation: 'Your top 2 pieces account for 83% of all wears.',
    },
    snapshots: {
      weekly_7d: {
        windowId: 'weekly_7d',
        windowStartMs: 0,
        windowEndMs: 0,
        totalWearEvents: 3,
        uniqueGarmentsWorn: 2,
        isEligible: true,
        color: { counts: {}, percentages: {} },
        neutralColorRatio: 0.75,
        fabric: { counts: {}, percentages: {} },
        breathableFabricRatio: 0.8,
        pattern: { counts: {}, percentages: {} },
        solidPatternRatio: 0.9,
        silhouette: { counts: {}, percentages: {} },
        relaxedSilhouetteRatio: 0.4,
        averageFormality: 2.8,
        ethnicGarmentRatio: 0.2,
      },
      recent_30d: {} as any,
      baseline_60d: {} as any,
      all_time: {} as any,
    },
    evolution: {
      isEligible: true,
      confidence: 0.7,
      baselineSnapshot: {} as any,
      recentSnapshot: {} as any,
      dimensions: [
        {
          dimension: 'palette',
          baselineRatio: 0.4,
          recentRatio: 0.75,
          deltaRatio: 0.35,
          isSignificant: true,
          headline: 'Shift toward Neutrals',
          evidenceText: 'Increased neutral color wears by 35% compared to baseline.',
        },
      ],
      significantShifts: [
        {
          dimension: 'palette',
          baselineRatio: 0.4,
          recentRatio: 0.75,
          deltaRatio: 0.35,
          isSignificant: true,
          headline: 'Shift toward Neutrals',
          evidenceText: 'Increased neutral color wears by 35% compared to baseline.',
        },
      ],
    },
    orphans: {
      unresolvedOrphanCount: 0,
      explanation: undefined,
    },
    mostWornItems: [dummyItemAnalysis],
    dormantItems: [],
    ...overrides,
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders cold start banner when total lifetime wears < 5', () => {
    const report = createDummyReport({
      totalLifetimeWears: 2,
    });

    mockUseWearAnalytics.mockReturnValue({
      report,
      selectedTimeframe: 'all',
      setSelectedTimeframe: vi.fn(),
      activeSnapshot: report.snapshots.weekly_7d,
      rotation: report.rotation,
      concentration: report.concentration,
      evolution: report.evolution,
      mostWornItems: report.mostWornItems,
      dormantItems: [],
      orphans: report.orphans,
    });

    const html = renderToString(<WearAnalyticsView />);

    expect(html).toContain('StyleSaathi is Observing Habits (2/5 Wears)');
    expect(html).toContain('ANALYTICS &amp; EVOLUTION');
  });

  it('renders summary KPI tiles and CPW amortization badges', () => {
    const report = createDummyReport();

    mockUseWearAnalytics.mockReturnValue({
      report,
      selectedTimeframe: 'all',
      setSelectedTimeframe: vi.fn(),
      activeSnapshot: report.snapshots.weekly_7d,
      rotation: report.rotation,
      concentration: report.concentration,
      evolution: report.evolution,
      mostWornItems: report.mostWornItems,
      dormantItems: [],
      orphans: report.orphans,
    });

    const html = renderToString(<WearAnalyticsView />);

    expect(html).toContain('TOTAL WEARS');
    expect(html).toContain('18');
    expect(html).toContain('PIECES REACHED');
    expect(html).toContain('8');
    expect(html).toContain('ACTIVE ROTATION');
    expect(html).toContain('60%');
    expect(html).toContain('CONCENTRATION');
    expect(html).toContain('83%');
    expect(html).toContain('High Concentration');
    expect(html).toContain('₹200/wear');
  });

  it('renders Style Evolution cards and significant shifts', () => {
    const report = createDummyReport();

    mockUseWearAnalytics.mockReturnValue({
      report,
      selectedTimeframe: 'all',
      setSelectedTimeframe: vi.fn(),
      activeSnapshot: report.snapshots.weekly_7d,
      rotation: report.rotation,
      concentration: report.concentration,
      evolution: report.evolution,
      mostWornItems: report.mostWornItems,
      dormantItems: [],
      orphans: report.orphans,
    });

    const html = renderToString(<WearAnalyticsView />);

    expect(html).toContain('STYLE EVOLUTION');
    expect(html).toContain('Shift toward Neutrals');
    expect(html).toContain('+35%');
  });

  it('renders dormant items and triggers Phase 7 Style Item integration', () => {
    const dormantItem: WardrobeItem = {
      ...dummyItem,
      id: 'dormant-1',
      name: 'Unworn Raw Silk Kurta',
    };

    const dormantAnalysis: ItemRotationAnalysis = {
      item: dormantItem,
      state: 'dormant',
      effectiveWears: 1,
      lastWornDaysAgo: 110,
      itemAgeDays: 120,
      costPerWear: {
        purchasePrice: 3000,
        effectiveWears: 1,
        costPerWear: 3000,
        status: 'amortizing',
        formattedCPW: '₹3000/wear',
      },
    };

    const report = createDummyReport({
      rotation: {
        isEligible: true,
        confidence: 0.7,
        totalCleanItems: 10,
        activeCount: 5,
        occasionalCount: 3,
        dormantCount: 1,
        neverWornCount: 1,
        rotationHealthPercentage: 50,
        itemsByState: {
          active: [dummyItemAnalysis],
          occasional: [],
          dormant: [dormantAnalysis],
          never_worn: [],
        },
      },
      dormantItems: [dormantAnalysis],
    });

    mockUseWearAnalytics.mockReturnValue({
      report,
      selectedTimeframe: 'all',
      setSelectedTimeframe: vi.fn(),
      activeSnapshot: report.snapshots.weekly_7d,
      rotation: report.rotation,
      concentration: report.concentration,
      evolution: report.evolution,
      mostWornItems: report.mostWornItems,
      dormantItems: [dormantAnalysis],
      orphans: report.orphans,
    });

    const html = renderToString(<WearAnalyticsView />);

    expect(html).toContain('Unworn Raw Silk Kurta');
    expect(html).toContain('Last worn 110d ago');
    expect(html).toContain('Style');
  });
});
