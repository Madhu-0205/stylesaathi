import { describe, it, expect } from 'vitest';
import { exploreTrendWithWardrobe } from '../discoveryEngine';
import { CuratedActiveTrend } from '../types';
import { WardrobeItem, PersonalStyleProfile } from '../../../types';
import { derivePersonalStyleProfile } from '../../styleBrain';

describe('Phase 11 — Phase 5 Integration & Handoff', () => {
  const trend: CuratedActiveTrend = {
    concept: {
      id: 'trend_relaxed_linen',
      name: 'Relaxed Linen Tailoring',
      slug: 'relaxed-linen-tailoring',
      summary: 'Breathable linen shirts and relaxed trousers.',
      targetAttributes: {
        categories: ['Tops', 'Bottoms'],
        subcategories: ['shirt', 'trousers'],
        fabrics: ['linen', 'cotton'],
        patterns: ['solid'],
        silhouettes: ['relaxed', 'straight'],
        colorPalette: ['beige', 'white'],
        occasions: ['everyday', 'office'],
        seasons: ['summer'],
      },
      lifecycleState: 'ACTIVE',
      validFrom: '2026-01-01',
      validUntil: '2026-12-31',
    },
    provenance: {
      sourceType: 'CURATED_EDITORIAL',
      sourceReference: 'Vogue India Summer 2026',
      curatorOrReviewer: 'Editorial Board',
      observedAt: '2026-03-01',
      confidence: 1.0,
      reviewed: true,
      corroborationCount: 2,
    },
    corroboratingSignalIds: ['sig_1'],
    editorialNotes: 'High-utility tailoring.',
    reviewedBy: 'Editorial Board',
    reviewedAt: '2026-03-10',
  };

  const sampleWardrobe: WardrobeItem[] = [
    {
      id: 'linen_shirt_1',
      name: 'Beige Linen Shirt',
      category: 'Tops',
      subcategory: 'shirt',
      status: 'clean',
      timesWorn: 1,
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
      id: 'cotton_trouser_1',
      name: 'White Cotton Trousers',
      category: 'Bottoms',
      subcategory: 'trousers',
      status: 'clean',
      timesWorn: 2,
      createdAt: 1700000000000,
      colors: ['white'],
      seasons: ['summer'],
      occasions: ['everyday', 'office'],
      formality: 2,
      favorite: false,
      note: '',
      fabric: 'cotton',
      fit: 'relaxed',
    },
    {
      id: 'footwear_1',
      name: 'Brown Loafers',
      category: 'Footwear',
      subcategory: 'loafers',
      status: 'clean',
      timesWorn: 3,
      createdAt: 1700000000000,
      colors: ['brown'],
      seasons: ['summer'],
      occasions: ['everyday', 'office'],
      formality: 2,
      favorite: false,
      note: '',
      fabric: 'polyblend',
      fit: 'regular',
    },
  ];

  const profile: PersonalStyleProfile = {
    ...derivePersonalStyleProfile([]),
    occasionAffinities: {
      everyday: { score: 0.8, confidence: 1.0, sampleCount: 5, lastInteractedAt: 1700000000000 },
    } as any,
  };

  it('delegates outfit ranking strictly to Phase 5 and preserves Phase 5 scores', () => {
    const result = exploreTrendWithWardrobe(
      trend,
      sampleWardrobe,
      profile,
      undefined,
      undefined,
      '2026-05-15T10:00:00Z',
      'everyday'
    );

    expect(result.explorationContext.trendId).toBe('trend_relaxed_linen');
    expect(result.explorationContext.targetOccasion).toBe('everyday');
    expect(result.outfits.length).toBeGreaterThan(0);

    // Scores belong to Phase 5
    const firstOutfit = result.outfits[0];
    expect(firstOutfit.score).toBeGreaterThan(0);
    const outfitItems = Object.values(firstOutfit.slots).flat();
    expect(outfitItems.some((i) => i.id === 'linen_shirt_1')).toBe(true);
    expect(outfitItems.some((i) => i.id === 'cotton_trouser_1')).toBe(true);
  });

  it('passes revivalAnchorItemId as Phase 5 anchorItemId when dormant piece matches trend', () => {
    const result = exploreTrendWithWardrobe(
      trend,
      sampleWardrobe,
      profile,
      undefined,
      undefined,
      '2026-05-15T10:00:00Z',
      'everyday',
      'linen_shirt_1' // Explicit dormant revival anchor piece
    );

    expect(result.explorationContext.revivalAnchorItemId).toBe('linen_shirt_1');
    expect(result.outfits.length).toBeGreaterThan(0);
    // Anchor item must be present in recommended look
    const anchorLookItems = Object.values(result.outfits[0].slots).flat();
    expect(anchorLookItems.some((i) => i.id === 'linen_shirt_1')).toBe(true);
  });

  it('transparently reports missingRequirements from Phase 5 without fabricating clothing', () => {
    // Only top, no bottom or footwear
    const singleItemWardrobe = [sampleWardrobe[0]];
    const result = exploreTrendWithWardrobe(
      trend,
      singleItemWardrobe,
      profile,
      undefined,
      undefined,
      '2026-05-15T10:00:00Z',
      'everyday',
      'linen_shirt_1' // Anchor item with sparse wardrobe
    );

    expect(result.outfits.length).toBe(0);
    expect(result.missingRequirements.length).toBeGreaterThan(0);
  });
});
