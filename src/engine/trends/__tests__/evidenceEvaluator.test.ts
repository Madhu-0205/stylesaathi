import { describe, it, expect } from 'vitest';
import { evaluateTrendEvidence, classifyTrendEvidence } from '../evidenceEvaluator';
import { CuratedActiveTrend } from '../types';
import { WardrobeItem, PersonalStyleProfile } from '../../../types';
import { derivePersonalStyleProfile } from '../../styleBrain';

describe('Phase 11 — Evidence Evaluator', () => {
  const mockTrend: CuratedActiveTrend = {
    concept: {
      id: 'trend_relaxed_linen',
      name: 'Relaxed Linen Tailoring',
      slug: 'relaxed-linen-tailoring',
      summary: 'Breathable linen shirts and relaxed trousers in neutral earth tones.',
      targetAttributes: {
        categories: ['Tops', 'Bottoms'],
        subcategories: ['shirt', 'trousers'],
        fabrics: ['linen', 'cotton'],
        patterns: ['solid'],
        silhouettes: ['relaxed', 'straight'],
        colorPalette: ['white', 'beige', 'olive'],
        occasions: ['everyday', 'casual outing', 'office'],
        seasons: ['summer'],
      },
      indianFashionContext: {
        isIndianFusion: false,
        culturalNotes: 'Contemporary smart-casual styling.',
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
    corroboratingSignalIds: ['sig_1', 'sig_2'],
    editorialNotes: 'High-utility clean tailoring.',
    reviewedBy: 'Editorial Board',
    reviewedAt: '2026-03-10',
  };

  const createItem = (overrides: Partial<WardrobeItem>): WardrobeItem => ({
    id: `item_${Math.random().toString(36).substring(2, 9)}`,
    name: 'Sample Garment',
    category: 'Tops',
    subcategory: 'shirt',
    status: 'clean',
    timesWorn: 4,
    createdAt: 1700000000000,
    colors: ['beige'],
    seasons: ['summer'],
    occasions: ['everyday', 'office'],
    formality: 2,
    favorite: false,
    note: '',
    fabric: 'linen',
    fit: 'relaxed',
    ...overrides,
  });

  const makeAffinity = (score: number) => ({
    score,
    confidence: 1.0,
    sampleCount: 5,
    lastInteractedAt: 1700000000000,
  });

  const baseStyleProfile: PersonalStyleProfile = {
    ...derivePersonalStyleProfile([]),
    occasionAffinities: { everyday: makeAffinity(0.8) } as any,
    colorAffinities: { beige: makeAffinity(0.8) },
    fabricAffinities: { linen: makeAffinity(0.8) } as any,
    fitAffinities: { relaxed: makeAffinity(0.8) } as any,
  };

  it('evaluates all 7 dimensions and classifies complete clean wardrobe matches as STRONG_DISCOVERY', () => {
    const topItem = createItem({ category: 'Tops', subcategory: 'shirt', fabric: 'linen', colors: ['white'] });
    const bottomItem = createItem({ category: 'Bottoms', subcategory: 'trousers', fabric: 'cotton', colors: ['beige'], fit: 'straight' });

    const evidence = evaluateTrendEvidence(
      mockTrend,
      [topItem, bottomItem],
      baseStyleProfile,
      undefined, // Weather unverified
      undefined,
      [],
      '2026-05-15T10:00:00Z'
    );

    // Dimension checks
    expect(evidence.provenanceAndTrust.trustWeight).toBe(1.0);
    expect(evidence.temporalFreshness.status).toBe('FRESH');
    expect(evidence.wardrobeCoverage.directMatchesCount).toBeGreaterThanOrEqual(1);
    expect(evidence.personalStyleAlignment.alignmentScore).toBeGreaterThan(0.5);
    expect(evidence.contextThermalFit.thermalSuitability).toBe('UNVERIFIED');
    expect(evidence.culturalModestyContext.modestyAssessment).toBe('NOT_SPECIFIED');
    expect(evidence.rotationOpportunity.hasDormantPieces).toBe(false);

    expect(evidence.classification).toBe('STRONG_DISCOVERY');
    expect(evidence.nonAuthoritativeDiscoveryScore).toBeGreaterThan(0.6);
  });

  it('marks thermal suitability as UNVERIFIED if weather data is unavailable (Zero Fake Weather)', () => {
    const item = createItem({ category: 'Tops', subcategory: 'shirt' });
    const evidence = evaluateTrendEvidence(
      mockTrend,
      [item],
      baseStyleProfile,
      undefined,
      undefined,
      [],
      '2026-05-15T10:00:00Z'
    );
    expect(evidence.contextThermalFit.thermalSuitability).toBe('UNVERIFIED');
    expect(evidence.limitations).toContain('Weather context was unverified or unavailable');
  });

  it('classifies trend as INFORMATIVE when user owns zero matching items and has low style affinity', () => {
    const irrelevantItem = createItem({
      category: 'Footwear',
      subcategory: 'sneakers',
      colors: ['red'],
      fabric: 'polyblend',
    });

    const lowAffinityProfile: PersonalStyleProfile = {
      ...baseStyleProfile,
      colorAffinities: { beige: makeAffinity(-0.5) },
      fabricAffinities: { linen: makeAffinity(-0.5) } as any,
    };

    const evidence = evaluateTrendEvidence(
      mockTrend,
      [irrelevantItem],
      lowAffinityProfile,
      undefined,
      undefined,
      [],
      '2026-05-15T10:00:00Z'
    );

    expect(evidence.classification).toBe('INFORMATIVE');
  });

  it('revives dormant items from Phase 8 wear analytics correctly', () => {
    const dormantLinenShirt = createItem({
      id: 'dormant_linen_shirt',
      name: 'Olive Linen Overshirt',
      category: 'Tops',
      subcategory: 'shirt',
      colors: ['olive'],
      fabric: 'linen',
      fit: 'relaxed',
      timesWorn: 0,
    });

    const evidence = evaluateTrendEvidence(
      mockTrend,
      [dormantLinenShirt],
      baseStyleProfile,
      undefined,
      undefined,
      [dormantLinenShirt], // Pass as Phase 8 dormant item
      '2026-05-15T10:00:00Z'
    );

    expect(evidence.rotationOpportunity.hasDormantPieces).toBe(true);
    expect(evidence.rotationOpportunity.dormantItemNames).toContain('Olive Linen Overshirt');
  });
});
