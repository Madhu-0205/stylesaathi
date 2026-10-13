import { describe, it, expect } from 'vitest';
import {
  normalizeRawTrendSignal,
  createCuratedActiveTrend,
  normalizeStringListToTaxonomy,
} from '../trendNormalizer';
import { RawTrendSignal, CuratedActiveTrend } from '../types';

describe('Phase 11 — Trend Normalizer', () => {
  const mockRawSignal: RawTrendSignal = {
    id: 'sig_101',
    sourceId: 'src_vogue_2026',
    sourceType: 'OFFICIAL_FASHION_SOURCE',
    sourceReference: 'Vogue India Runway Report 2026',
    curatorOrAuthor: 'Senior Fashion Editor',
    observedAt: '2026-03-15T10:00:00Z',
    rawHeadline: 'Linen unstructured tailoring takes over smart casual summer dressing',
    rawExcerpt: 'Breathable linen shirts paired with relaxed pleated trousers in earthy sand and olive tones.',
    extractedAttributes: {
      categories: ['Tops', 'Bottoms'],
      subcategories: ['shirt', 'trousers'],
      fabrics: ['linen', 'cotton'],
      patterns: ['solid'],
      silhouettes: ['relaxed', 'straight'],
      colorPalette: ['sand', 'olive', 'white'],
      occasions: ['everyday', 'casual outing', 'office'],
    },
  };

  it('normalizes raw signals into canonical NormalizedTrendConcept without mutating raw facts', () => {
    const rawCopy = JSON.parse(JSON.stringify(mockRawSignal));
    const concept = normalizeRawTrendSignal(
      mockRawSignal,
      'trend_linen_tailoring',
      'Relaxed Linen Tailoring',
      'relaxed-linen-tailoring',
      'Unstructured linen shirts and relaxed trousers in earth tones.',
      '2026-01-01',
      '2026-12-31'
    );

    expect(mockRawSignal).toEqual(rawCopy); // Immutability preserved
    expect(concept.id).toBe('trend_linen_tailoring');
    expect(concept.slug).toBe('relaxed-linen-tailoring');
    expect(concept.lifecycleState).toBe('OBSERVED');
    expect(concept.targetAttributes.categories).toContain('Tops');
    expect(concept.targetAttributes.categories).toContain('Bottoms');
    expect(concept.targetAttributes.subcategories).toContain('shirt');
    expect(concept.targetAttributes.fabrics).toContain('linen');
    expect(concept.validFrom).toBe('2026-01-01');
    expect(concept.validUntil).toBe('2026-12-31');
  });

  it('creates reviewed CuratedActiveTrend with explicit editorial sign-off', () => {
    const concept = normalizeRawTrendSignal(
      mockRawSignal,
      'trend_linen_tailoring',
      'Relaxed Linen Tailoring',
      'relaxed-linen-tailoring',
      'Unstructured linen shirts and relaxed trousers in earth tones.',
      '2026-01-01',
      '2026-12-31'
    );

    const curated: CuratedActiveTrend = createCuratedActiveTrend(
      concept,
      {
        sourceType: 'CURATED_EDITORIAL',
        sourceReference: 'StyleSaathi Editorial Board Review',
        curatorOrReviewer: 'Lead Curator',
        observedAt: '2026-03-20',
      },
      ['sig_101', 'sig_102'],
      'Verified high-utility summer trend suitable for Indian tropical temperatures.',
      'Editorial Board',
      '2026-03-25'
    );

    expect(curated.concept.lifecycleState).toBe('ACTIVE');
    expect(curated.reviewedBy).toBe('Editorial Board');
    expect(curated.reviewedAt).toBe('2026-03-25');
    expect(curated.corroboratingSignalIds).toHaveLength(2);
    expect(curated.provenance.sourceType).toBe('CURATED_EDITORIAL');
  });

  it('maps strings safely to taxonomy sets and filters unknown garbage gracefully', () => {
    const rawCategories = ['Tops', 'Bottoms', 'Hovercraft', 'Jetpack'];
    const valid = normalizeStringListToTaxonomy(rawCategories, new Set(['Tops', 'Bottoms', 'Footwear']));
    expect(valid).toEqual(['Tops', 'Bottoms']);
  });
});
