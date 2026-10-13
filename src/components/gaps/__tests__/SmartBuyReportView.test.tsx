import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { SmartBuyReportView } from '../SmartBuyReportView';
import { WardrobeGapReport, WardrobeItem } from '../../../types';

const mockUseSmartBuy = vi.fn();
const mockUseWardrobeContext = vi.fn();

vi.mock('../../../hooks/useSmartBuy', () => ({
  useSmartBuy: (...args: any[]) => mockUseSmartBuy(...args),
}));

vi.mock('../../../context/WardrobeContext', () => ({
  useWardrobeContext: () => mockUseWardrobeContext(),
}));

vi.mock('../../wardrobe/StyleItemSheet', () => ({
  StyleItemSheet: ({ anchorItem, isOpen }: any) => {
    if (!isOpen) return null;
    return <div data-testid="style-item-sheet">Styling {anchorItem.name}</div>;
  },
}));

describe('SmartBuyReportView UI Component', () => {
  const dummyItem: WardrobeItem = {
    id: 'item_1',
    name: 'Oxford Shoes',
    category: 'Footwear',
    subcategory: 'formal shoes',
    colors: ['Black'],
    status: 'clean',
    timesWorn: 3,
    createdAt: 1700000000000,
    seasons: ['summer', 'winter'],
    occasions: ['office'],
    formality: 4,
    favorite: false,
    note: '',
  };

  const createDummyReport = (overrides: Partial<WardrobeGapReport> = {}): WardrobeGapReport => ({
    referenceTimestamp: 1718000000000,
    dataSufficiency: {
      isSufficient: true,
      totalGarments: 12,
      totalWearEvents: 45,
      activeOccasionsCount: 2,
      confidenceScore: 0.88,
    },
    gaps: [],
    purchaseAssessment: 'NO_PURCHASE_NEEDED',
    coverageSummary: {
      totalGarments: 12,
      activeGarments: 11,
      overallCoverageScore: 1.0,
      occasionReadiness: [
        {
          occasion: 'office',
          isDeclaredActive: true,
          viableOutfitCount: 8,
          readiness: 'fully_ready',
          missingRoles: [],
          summaryText: '8+ looks ready ✓',
        },
        {
          occasion: 'everyday',
          isDeclaredActive: true,
          viableOutfitCount: 15,
          readiness: 'fully_ready',
          missingRoles: [],
          summaryText: '15+ looks ready ✓',
        },
      ],
      coveredOccasionsCount: 2,
      unsupportedActiveOccasionsCount: 0,
    },
    negativeEvidence: {
      hasNoPurchaseNeeded: true,
      primaryReason: 'Your wardrobe covers 100% of your active lifestyle routines with healthy rotation.',
      details: ['No functional or structural shortages detected across any declared occasion.'],
      rediscoveryOpportunitiesCount: 0,
    },
    ...overrides,
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    const defaultReport = createDummyReport();
    mockUseSmartBuy.mockReturnValue({
      report: defaultReport,
      dataSufficiency: defaultReport.dataSufficiency,
      gaps: defaultReport.gaps,
      purchaseAssessment: defaultReport.purchaseAssessment,
      coverageSummary: defaultReport.coverageSummary,
      negativeEvidence: defaultReport.negativeEvidence,
    });
  });

  it('renders empty state when wardrobe has 0 items', () => {
    mockUseWardrobeContext.mockReturnValue({
      items: [],
      loadSample: vi.fn(),
    });

    const html = renderToString(<SmartBuyReportView />);
    expect(html).toContain('Your wardrobe gap intelligence is waiting');
    expect(html).toContain('Load Sample Wardrobe');
  });

  it('renders data sufficiency alert when data baseline is establishing', () => {
    const report = createDummyReport({
      dataSufficiency: {
        isSufficient: false,
        totalGarments: 3,
        totalWearEvents: 2,
        activeOccasionsCount: 1,
        confidenceScore: 0.25,
        ineligibilityReason: 'Add at least 5 garments to establish your wardrobe baseline (currently 3).',
      },
    });

    mockUseWardrobeContext.mockReturnValue({
      items: [dummyItem],
      loadSample: vi.fn(),
    });

    mockUseSmartBuy.mockReturnValue({
      report,
      dataSufficiency: report.dataSufficiency,
      gaps: report.gaps,
      purchaseAssessment: report.purchaseAssessment,
      coverageSummary: report.coverageSummary,
      negativeEvidence: report.negativeEvidence,
    });

    const html = renderToString(<SmartBuyReportView />);
    expect(html).toContain('Baseline Data Establishing');
    expect(html).toContain('Add at least 5 garments to establish your wardrobe baseline');
  });

  it('renders NO PURCHASE NEEDED card when wardrobe is balanced', () => {
    const report = createDummyReport({
      purchaseAssessment: 'NO_PURCHASE_NEEDED',
    });

    mockUseWardrobeContext.mockReturnValue({
      items: [dummyItem],
      loadSample: vi.fn(),
    });

    mockUseSmartBuy.mockReturnValue({
      report,
      dataSufficiency: report.dataSufficiency,
      gaps: report.gaps,
      purchaseAssessment: report.purchaseAssessment,
      coverageSummary: report.coverageSummary,
      negativeEvidence: report.negativeEvidence,
    });

    const html = renderToString(<SmartBuyReportView />);
    expect(html).toContain('NO PURCHASE NEEDED');
    expect(html).toContain('Your wardrobe baseline is complete');
    expect(html).toContain('100% Demand Covered');
  });

  it('renders Dormant Rediscovery card when shortage can be solved by owned pieces', () => {
    const report = createDummyReport({
      purchaseAssessment: 'NO_PURCHASE_NEEDED',
      gaps: [
        {
          id: 'gap_footwear',
          type: 'UNDER_COVERED_CATEGORY',
          targetRole: 'footwear',
          expectedCategory: 'Footwear',
          compatibleSubcategories: ['formal shoes'],
          activeOccasions: ['office'],
          gapState: 'REDISCOVERY_SUGGESTED',
          purchaseAssessment: 'NO_PURCHASE_NEEDED',
          severityScore: 0.45,
          confidence: 0.8,
          evidence: [],
          rediscoveryCandidate: {
            item: dummyItem,
            targetRole: 'footwear',
            resolvedOccasions: ['office'],
            action: 'STYLE_ITEM',
          },
          headline: 'Rediscover in Closet: Oxford Shoes',
          explanation: 'Your wardrobe has an active shortage, but you already own Oxford Shoes.',
        },
      ],
    });

    mockUseWardrobeContext.mockReturnValue({
      items: [dummyItem],
      loadSample: vi.fn(),
    });

    mockUseSmartBuy.mockReturnValue({
      report,
      dataSufficiency: report.dataSufficiency,
      gaps: report.gaps,
      purchaseAssessment: report.purchaseAssessment,
      coverageSummary: report.coverageSummary,
      negativeEvidence: report.negativeEvidence,
    });

    const html = renderToString(<SmartBuyReportView />);
    expect(html).toContain('REDISCOVER IN YOUR WARDROBE');
    expect(html).toContain('STYLE THIS ITEM');
    expect(html).toContain('Oxford Shoes');
    expect(html).toContain('Dormant in closet — Ready to be restyled');
  });

  it('renders verified gap card with evidence checkpoints and Style Brain constraints', () => {
    const report = createDummyReport({
      purchaseAssessment: 'PURCHASE_JUSTIFIED',
      gaps: [
        {
          id: 'gap_footwear_critical',
          type: 'MISSING_CATEGORY',
          targetRole: 'footwear',
          expectedCategory: 'Footwear',
          compatibleSubcategories: ['formal shoes', 'loafers'],
          activeOccasions: ['office'],
          gapState: 'CRITICAL_GAP',
          purchaseAssessment: 'PURCHASE_JUSTIFIED',
          severityScore: 0.95,
          confidence: 0.85,
          evidence: [
            {
              tier: 'TIER_1_EXPLICIT_DEMAND',
              description: 'Upcoming scheduled calendar event requires office ensemble',
            },
          ],
          attributeGuidance: {
            preferredFabrics: ['cotton'],
            avoidedFabrics: ['polyblend'],
            preferredFits: ['regular'],
            avoidedColors: ['neon'],
            formalityTarget: 4,
          },
          headline: 'Critical Gap: Footwear (footwear)',
          explanation: 'Upcoming scheduled events for office cannot form complete looks.',
        },
      ],
    });

    mockUseWardrobeContext.mockReturnValue({
      items: [dummyItem],
      loadSample: vi.fn(),
    });

    mockUseSmartBuy.mockReturnValue({
      report,
      dataSufficiency: report.dataSufficiency,
      gaps: report.gaps,
      purchaseAssessment: report.purchaseAssessment,
      coverageSummary: report.coverageSummary,
      negativeEvidence: report.negativeEvidence,
    });

    const html = renderToString(<SmartBuyReportView />);
    expect(html).toContain('CRITICAL WARDROBE GAP');
    expect(html).toContain('PURCHASE JUSTIFIED');
    expect(html).toContain('Personal Style Brain Guidance');
    expect(html).toContain('polyblend');
    expect(html).toContain('Level 4 / 5');
    // Ensure zero e-commerce / affiliate traces
    expect(html).not.toContain('Buy on Amazon');
    expect(html).not.toContain('Affiliate');
    expect(html).not.toContain('₹');
  });

  it('renders Occasion Readiness Audit with computed counts and readiness status', () => {
    const report = createDummyReport();

    mockUseWardrobeContext.mockReturnValue({
      items: [dummyItem],
      loadSample: vi.fn(),
    });

    mockUseSmartBuy.mockReturnValue({
      report,
      dataSufficiency: report.dataSufficiency,
      gaps: report.gaps,
      purchaseAssessment: report.purchaseAssessment,
      coverageSummary: report.coverageSummary,
      negativeEvidence: report.negativeEvidence,
    });

    const html = renderToString(<SmartBuyReportView />);
    expect(html).toContain('OCCASION READINESS AUDIT');
    expect(html).toContain('office');
    expect(html).toContain('8+ looks ready ✓');
    expect(html).toContain('everyday');
    expect(html).toContain('15+ looks ready ✓');
  });
});
