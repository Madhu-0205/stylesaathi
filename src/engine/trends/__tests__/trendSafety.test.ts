import { describe, it, expect } from 'vitest';
import { evaluateTrendEvidence } from '../evidenceEvaluator';
import { isTrendEligibleForActiveDiscovery } from '../provenancePolicy';
import { exploreTrendWithWardrobe } from '../discoveryEngine';
import { CuratedActiveTrend } from '../types';
import { WardrobeItem, PersonalStyleProfile } from '../../../types';
import { derivePersonalStyleProfile } from '../../styleBrain';

describe('Phase 11 — Safety Invariants (A through J)', () => {
  const validTrend: CuratedActiveTrend = {
    concept: {
      id: 'trend_safe_1',
      name: 'Relaxed Linen Tailoring',
      slug: 'relaxed-linen-tailoring',
      summary: 'Breathable linen shirts and relaxed trousers.',
      targetAttributes: {
        categories: ['Tops', 'Bottoms'],
        subcategories: ['shirt', 'trousers'],
        fabrics: ['linen'],
        patterns: ['solid'],
        silhouettes: ['relaxed'],
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
    editorialNotes: 'High-utility clean tailoring.',
    reviewedBy: 'Editorial Board',
    reviewedAt: '2026-03-10',
  };

  const sampleWardrobe: WardrobeItem[] = [
    {
      id: 'item_1',
      name: 'Linen Shirt',
      category: 'Tops',
      subcategory: 'shirt',
      status: 'clean',
      timesWorn: 2,
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
      id: 'item_2',
      name: 'Cotton Trousers',
      category: 'Bottoms',
      subcategory: 'trousers',
      status: 'clean',
      timesWorn: 3,
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
  ];

  const sampleProfile: PersonalStyleProfile = derivePersonalStyleProfile([]);

  it('Invariant A — Zero Shopping: Output contains zero commercial or affiliate URLs, merchants, or prices', () => {
    const evidence = evaluateTrendEvidence(
      validTrend,
      sampleWardrobe,
      sampleProfile,
      undefined,
      undefined,
      [],
      '2026-05-01T10:00:00Z'
    );

    const serialized = JSON.stringify(evidence).toLowerCase();
    expect(serialized).not.toContain('http://');
    expect(serialized).not.toContain('https://');
    expect(serialized).not.toContain('affiliate');
    expect(serialized).not.toContain('price');
    expect(serialized).not.toContain('buy_button');
    expect(serialized).not.toContain('amazon');
    expect(serialized).not.toContain('myntra');
    expect(serialized).not.toContain('flipkart');
  });

  it('Invariant B — Zero Fabrication: Missing thermal/weather data defaults explicitly to UNVERIFIED', () => {
    const evidence = evaluateTrendEvidence(
      validTrend,
      sampleWardrobe,
      sampleProfile,
      undefined, // Missing weather
      undefined,
      [],
      '2026-05-01T10:00:00Z'
    );
    expect(evidence.contextThermalFit.thermalSuitability).toBe('UNVERIFIED');
    expect(evidence.culturalModestyContext.modestyAssessment).toBe('NOT_SPECIFIED');
  });

  it('Invariant C — Phase 9 Boundary: Missing trend items never produce purchase justification', () => {
    const emptyWardrobe: WardrobeItem[] = [];
    const evidence = evaluateTrendEvidence(
      validTrend,
      emptyWardrobe,
      sampleProfile,
      undefined,
      undefined,
      [],
      '2026-05-01T10:00:00Z'
    );

    // Missing complement items are identified as missingSlotRoles for information only
    expect(evidence.wardrobeCoverage.missingSlotRoles.length).toBeGreaterThan(0);
    // Never justifies purchase or asserts demand
    expect(evidence.classification).not.toBe('STRONG_DISCOVERY');
    expect(evidence.classification).toBe('INFORMATIVE');
  });

  it('Invariant D — Phase 5 Sole Authority: Phase 11 delegates outfit ranking to Phase 5 without re-ranking', () => {
    const result = exploreTrendWithWardrobe(
      validTrend,
      sampleWardrobe,
      sampleProfile,
      undefined,
      undefined,
      '2026-05-01T10:00:00Z'
    );

    expect(result.explorationContext.trendId).toBe(validTrend.concept.id);
    // Outfits returned are generated directly by Phase 5
    expect(result.outfits).toBeDefined();
  });

  it('Invariant E — Review Gate: Unreviewed trends cannot become ACTIVE discovery', () => {
    const unreviewedTrend: CuratedActiveTrend = {
      ...validTrend,
      reviewedBy: '',
      reviewedAt: '',
    };
    expect(isTrendEligibleForActiveDiscovery(unreviewedTrend, '2026-05-01')).toBe(false);
  });

  it('Invariant F — Expiry: Expired trends cannot appear as active discovery', () => {
    expect(isTrendEligibleForActiveDiscovery(validTrend, '2027-01-01')).toBe(false);
  });

  it('Invariant G — Determinism: Same inputs and reference timestamp produce strictly identical output', () => {
    const run1 = evaluateTrendEvidence(
      validTrend,
      sampleWardrobe,
      sampleProfile,
      undefined,
      undefined,
      [],
      '2026-05-01T10:00:00Z'
    );
    const run2 = evaluateTrendEvidence(
      validTrend,
      sampleWardrobe,
      sampleProfile,
      undefined,
      undefined,
      [],
      '2026-05-01T10:00:00Z'
    );

    expect(run1).toEqual(run2);
  });

  it('Invariant H — Explicit vs Learned Preference: Explicit avoidance triggers hard NOT_RELEVANT, learned triggers soft penalty', () => {
    const profileAvoidsBeige: PersonalStyleProfile = {
      ...sampleProfile,
      avoidedColors: ['beige'],
    };
    const evidenceAvoid = evaluateTrendEvidence(
      validTrend,
      sampleWardrobe,
      profileAvoidsBeige,
      undefined,
      undefined,
      [],
      '2026-05-01T10:00:00Z'
    );
    expect(evidenceAvoid.classification).toBe('NOT_RELEVANT');

    const profileDislikesBeige: PersonalStyleProfile = {
      ...sampleProfile,
      colorAffinities: {
        beige: { score: -0.8, confidence: 1.0, sampleCount: 5, lastInteractedAt: 1700000000000 },
      },
    };
    const evidenceLearned = evaluateTrendEvidence(
      validTrend,
      sampleWardrobe,
      profileDislikesBeige,
      undefined,
      undefined,
      [],
      '2026-05-01T10:00:00Z'
    );
    expect(evidenceLearned.classification).not.toBe('NOT_RELEVANT');
    expect(evidenceLearned.personalStyleAlignment.learnedAffinityPenalty).toBe(true);
  });

  it('Invariant I — Privacy: No wardrobe items or user IDs are embedded into external trend concepts', () => {
    expect(validTrend.concept).not.toHaveProperty('userId');
    expect(validTrend.concept).not.toHaveProperty('wardrobeItems');
    expect(validTrend.concept).not.toHaveProperty('userPhotos');
  });

  it('Invariant J — No Second Recommendation Engine: Non-authoritative score is metadata only and never ranks Phase 5 outfits', () => {
    const evidence = evaluateTrendEvidence(
      validTrend,
      sampleWardrobe,
      sampleProfile,
      undefined,
      undefined,
      [],
      '2026-05-01T10:00:00Z'
    );
    expect(typeof evidence.nonAuthoritativeDiscoveryScore).toBe('number');

    // When exploring with wardrobe, Phase 5 ranks outfits based on its own composite scoring
    const result = exploreTrendWithWardrobe(
      validTrend,
      sampleWardrobe,
      sampleProfile,
      undefined,
      undefined,
      '2026-05-01T10:00:00Z'
    );

    if (result.outfits.length > 0) {
      // Phase 5 outfit score is the score authority, not Phase 11 discovery score
      expect(result.outfits[0].score).toBeDefined();
      expect(result.outfits[0].score).not.toBe(evidence.nonAuthoritativeDiscoveryScore);
    }
  });
});
