import { describe, it, expect } from 'vitest';
import {
  getRelevantTrendsTool,
  exploreTrendWithWardrobeTool,
  explainTrendTool,
  SAATHI_TOOLS,
} from '../../saathi/toolRegistry';
import { SaathiToolContext } from '../../saathi/types';
import { WardrobeItem, PersonalStyleProfile } from '../../../types';
import { derivePersonalStyleProfile } from '../../styleBrain';

describe('Phase 11 — AI Saathi Read-Only Trend Tools', () => {
  const sampleWardrobe: WardrobeItem[] = [
    {
      id: 'item_linen_shirt',
      name: 'Beige Linen Shirt',
      category: 'Tops',
      subcategory: 'shirt',
      status: 'clean',
      timesWorn: 3,
      createdAt: 1700000000000,
      colors: ['beige'],
      seasons: ['summer'],
      occasions: ['everyday', 'office'],
      formality: 2,
      favorite: false,
      note: '',
      fabric: 'linen',
      fit: 'relaxed',
    },
    {
      id: 'item_linen_trousers',
      name: 'Olive Linen Trousers',
      category: 'Bottoms',
      subcategory: 'trousers',
      status: 'clean',
      timesWorn: 1,
      createdAt: 1700000000000,
      colors: ['olive'],
      seasons: ['summer'],
      occasions: ['everyday', 'office'],
      formality: 2,
      favorite: false,
      note: '',
      fabric: 'linen',
      fit: 'relaxed',
    },
    {
      id: 'item_footwear',
      name: 'White Sneakers',
      category: 'Footwear',
      subcategory: 'sneakers',
      status: 'clean',
      timesWorn: 2,
      createdAt: 1700000000000,
      colors: ['white'],
      seasons: ['summer'],
      occasions: ['everyday', 'office'],
      formality: 2,
      favorite: false,
      note: '',
      fabric: 'polyblend',
      fit: 'regular',
    },
  ];

  const styleProfile: PersonalStyleProfile = {
    ...derivePersonalStyleProfile([]),
    occasionAffinities: {
      everyday: { score: 0.8, confidence: 1.0, sampleCount: 5, lastInteractedAt: 1700000000000 },
    } as any,
  };

  const toolContext: SaathiToolContext = {
    userId: 'user_1',
    wardrobe: sampleWardrobe,
    referenceTimestamp: new Date('2026-05-15T10:00:00Z').getTime(),
    styleProfile,
    wearEvents: [],
  };

  it('registers all 3 read-only tools in canonical SAATHI_TOOLS registry', () => {
    expect(SAATHI_TOOLS.getRelevantTrends).toBeDefined();
    expect(SAATHI_TOOLS.exploreTrendWithWardrobe).toBeDefined();
    expect(SAATHI_TOOLS.explainTrend).toBeDefined();
    expect(SAATHI_TOOLS.getRelevantTrends.isMutation).toBe(false);
    expect(SAATHI_TOOLS.exploreTrendWithWardrobe.isMutation).toBe(false);
    expect(SAATHI_TOOLS.explainTrend.isMutation).toBe(false);
  });

  it('getRelevantTrends tool returns TrendEvidence list for wardrobe', async () => {
    const result = await getRelevantTrendsTool.execute({}, toolContext);

    expect(result.type).toBe('TREND_INTELLIGENCE');
    expect(result.trends).toBeDefined();
    expect(result.trends!.length).toBeGreaterThan(0);
    expect(result.trends![0].wardrobeCoverage).toBeDefined();
  });

  it('exploreTrendWithWardrobe tool delegates to Phase 5 and returns RecommendedOutfit list', async () => {
    const result = await exploreTrendWithWardrobeTool.execute(
      { trendId: 'trend_relaxed_linen_tailoring', occasion: 'everyday' },
      toolContext
    );

    expect(result.type).toBe('RECOMMENDATION');
    expect(result.outfits).toBeDefined();
    expect(result.outfits!.length).toBeGreaterThan(0);
  });

  it('explainTrend tool provides transparent provenance, corroboration, and evidence dimensions', async () => {
    const result = await explainTrendTool.execute(
      { trendId: 'trend_relaxed_linen_tailoring' },
      toolContext
    );

    expect(result.type).toBe('TREND_INTELLIGENCE');
    expect(result.data).toBeDefined();
    const data = result.data!;
    expect(data.trendName).toBe('Relaxed Linen Tailoring');
    expect(data.provenance).toBeDefined();
    expect(data.corroboration).toBeDefined();
    expect(data.evidenceDimensions).toBeDefined();
    expect(data.limitations).toBeDefined();
  });
});
