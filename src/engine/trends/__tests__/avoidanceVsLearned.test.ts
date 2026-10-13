import { describe, it, expect } from 'vitest';
import { evaluateTrendEvidence } from '../evidenceEvaluator';
import { CuratedActiveTrend } from '../types';
import { WardrobeItem, PersonalStyleProfile } from '../../../types';
import { derivePersonalStyleProfile } from '../../styleBrain';

describe('Phase 11 — Explicit Avoidance vs Learned Negative Preference', () => {
  const trendWithBeigeLinenRelaxed: CuratedActiveTrend = {
    concept: {
      id: 'trend_relaxed_linen',
      name: 'Relaxed Linen Tailoring',
      slug: 'relaxed-linen-tailoring',
      summary: 'Breathable linen shirts and relaxed trousers in neutral earth tones.',
      targetAttributes: {
        categories: ['Tops', 'Bottoms'],
        subcategories: ['shirt', 'trousers'],
        fabrics: ['linen'],
        patterns: ['solid'],
        silhouettes: ['relaxed'],
        colorPalette: ['beige', 'olive'],
        occasions: ['everyday'],
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
    editorialNotes: 'Relaxed linen tailoring.',
    reviewedBy: 'Editorial Board',
    reviewedAt: '2026-03-10',
  };

  const sampleWardrobe: WardrobeItem[] = [
    {
      id: 'item_1',
      name: 'Beige Linen Shirt',
      category: 'Tops',
      subcategory: 'shirt',
      status: 'clean',
      timesWorn: 3,
      createdAt: 1700000000000,
      colors: ['beige'],
      seasons: ['summer'],
      occasions: ['everyday'],
      formality: 2,
      favorite: false,
      note: '',
      fabric: 'linen',
      fit: 'relaxed',
    },
    {
      id: 'item_2',
      name: 'Olive Trousers',
      category: 'Bottoms',
      subcategory: 'trousers',
      status: 'clean',
      timesWorn: 5,
      createdAt: 1700000000000,
      colors: ['olive'],
      seasons: ['summer'],
      occasions: ['everyday'],
      formality: 2,
      favorite: false,
      note: '',
      fabric: 'linen',
      fit: 'relaxed',
    },
  ];

  it('enforces hard exclusion to NOT_RELEVANT when user explicitly avoids trend color or silhouette', () => {
    const profileWithExplicitAvoidance: PersonalStyleProfile = {
      ...derivePersonalStyleProfile([]),
      avoidedColors: ['beige'], // User explicitly avoids beige
    };

    const evidence = evaluateTrendEvidence(
      trendWithBeigeLinenRelaxed,
      sampleWardrobe,
      profileWithExplicitAvoidance,
      undefined,
      undefined,
      [],
      '2026-05-15T10:00:00Z',
      false // allowExplicitAvoidanceOverride = false
    );

    expect(evidence.personalStyleAlignment.explicitAvoidanceConflict).toBe(true);
    expect(evidence.classification).toBe('NOT_RELEVANT');
    expect(evidence.limitations).toContain(
      'Trend conflicts with explicit user style avoidance (color/fabric/pattern/silhouette)'
    );
  });

  it('allows single explicit request to override avoidance filter without permanently modifying profile', () => {
    const profileWithExplicitAvoidance: PersonalStyleProfile = {
      ...derivePersonalStyleProfile([]),
      avoidedColors: ['beige'],
    };

    const evidence = evaluateTrendEvidence(
      trendWithBeigeLinenRelaxed,
      sampleWardrobe,
      profileWithExplicitAvoidance,
      undefined,
      undefined,
      [],
      '2026-05-15T10:00:00Z',
      true // allowExplicitAvoidanceOverride = true ("Show me oversized styling even though I usually avoid it")
    );

    // Filter overridden for this single query
    expect(evidence.classification).not.toBe('NOT_RELEVANT');
    expect(evidence.limitations).toContain(
      'Explicit user avoidance filter was temporarily overridden for this exploration request'
    );
    // Profile itself was untouched
    expect(profileWithExplicitAvoidance.avoidedColors).toContain('beige');
  });

  it('treats learned negative behavioral preference as a soft penalty without hard exclusion', () => {
    const profileWithLearnedNegative: PersonalStyleProfile = {
      ...derivePersonalStyleProfile([]),
      colorAffinities: {
        beige: { score: -0.6, confidence: 0.9, sampleCount: 5, lastInteractedAt: 1700000000000 },
      },
      avoidedColors: [], // NO explicit avoidance!
    };

    const evidence = evaluateTrendEvidence(
      trendWithBeigeLinenRelaxed,
      sampleWardrobe,
      profileWithLearnedNegative,
      undefined,
      undefined,
      [],
      '2026-05-15T10:00:00Z',
      false
    );

    // Learned penalty is applied, but NOT excluded
    expect(evidence.personalStyleAlignment.explicitAvoidanceConflict).toBe(false);
    expect(evidence.personalStyleAlignment.learnedAffinityPenalty).toBe(true);
    expect(evidence.classification).not.toBe('NOT_RELEVANT');
    expect(['WARDROBE_RELEVANT', 'STRONG_DISCOVERY']).toContain(evidence.classification);
  });
});
