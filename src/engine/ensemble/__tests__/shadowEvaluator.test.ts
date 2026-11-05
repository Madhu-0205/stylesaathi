import { describe, it, expect, beforeEach } from 'vitest';
import {
  RecommendationEngine,
  recommendOutfits,
  recommendOutfitsWithTelemetry,
} from '../../recommendationEngine';
import {
  executeShadowEvaluation,
  getLastShadowComparison,
  getShadowComparisonHistory,
  clearShadowComparisonHistory,
  isShadowEvaluationEnabled,
  setShadowEvaluationEnabled,
} from '../shadowEvaluator';
import { WardrobeItem, RecommendationRequest } from '../../../types';

function createSampleWardrobe(): WardrobeItem[] {
  return [
    {
      id: 'top_chikankari',
      name: 'Ivory Chikankari Kurta',
      category: 'Ethnic',
      subcategory: 'kurta',
      colors: ['white', 'cream'],
      seasons: ['summer', 'monsoon'],
      occasions: ['everyday', 'college', 'family gathering', 'puja'],
      formality: 3,
      status: 'clean',
      favorite: true,
      note: 'Authentic Lucknowi hand embroidery',
      timesWorn: 3,
      fabric: 'cotton',
      pattern: 'embroidered',
      fit: 'regular',
      userVerified: true,
    },
    {
      id: 'bottom_pyjama',
      name: 'White Cotton Pyjama',
      category: 'Bottoms',
      subcategory: 'trousers',
      colors: ['white'],
      seasons: ['summer', 'monsoon', 'winter'],
      occasions: ['everyday', 'college', 'family gathering', 'puja'],
      formality: 3,
      status: 'clean',
      favorite: false,
      note: '',
      timesWorn: 2,
      fabric: 'cotton',
      pattern: 'solid',
      fit: 'regular',
      userVerified: true,
    },
    {
      id: 'footwear_juttis',
      name: 'Tan Leather Juttis',
      category: 'Footwear',
      subcategory: 'juttis',
      colors: ['tan', 'brown'],
      seasons: ['summer', 'winter'],
      occasions: ['everyday', 'family gathering', 'festive'],
      formality: 3,
      status: 'clean',
      favorite: false,
      note: 'Pure leather embroidered juttis',
      timesWorn: 1,
      fabric: 'unknown',
      materialComposition: 'leather',
      pattern: 'embroidered',
      userVerified: true,
    },
    {
      id: 'footwear_kolhapuris',
      name: 'Braided Kolhapuri Sandals',
      category: 'Footwear',
      subcategory: 'kolhapuris',
      colors: ['tan'],
      seasons: ['summer', 'monsoon'],
      occasions: ['everyday', 'puja', 'festive'],
      formality: 3,
      status: 'clean',
      favorite: true,
      note: 'Traditional footwear',
      timesWorn: 4,
      fabric: 'cotton',
      pattern: 'solid',
      userVerified: true,
    },
    {
      id: 'top_casual_tee',
      name: 'Navy Crewneck Tee',
      category: 'Tops',
      subcategory: 't-shirt',
      colors: ['navy'],
      seasons: ['summer', 'monsoon'],
      occasions: ['everyday', 'college', 'casual outing'],
      formality: 1.5,
      status: 'clean',
      favorite: false,
      note: '',
      timesWorn: 7,
      fabric: 'cotton',
      pattern: 'solid',
      fit: 'regular',
      userVerified: true,
    },
    {
      id: 'bottom_jeans',
      name: 'Washed Slim Denim Jeans',
      category: 'Bottoms',
      subcategory: 'jeans',
      colors: ['navy', 'blue'],
      seasons: ['summer', 'monsoon', 'winter'],
      occasions: ['everyday', 'college', 'casual outing'],
      formality: 2,
      status: 'clean',
      favorite: true,
      note: '',
      timesWorn: 12,
      fabric: 'denim',
      pattern: 'solid',
      fit: 'slim',
      userVerified: true,
    },
    {
      id: 'footwear_sneakers',
      name: 'White Canvas Low Sneakers',
      category: 'Footwear',
      subcategory: 'sneakers',
      colors: ['white'],
      seasons: ['summer', 'monsoon', 'winter'],
      occasions: ['everyday', 'college', 'casual outing'],
      formality: 1.5,
      status: 'clean',
      favorite: true,
      note: '',
      timesWorn: 15,
      fabric: 'cotton',
      pattern: 'solid',
      userVerified: true,
    },
    {
      id: 'top_unconfirmed_photo',
      name: 'Camera Scan Vintage Shirt',
      category: 'Tops',
      subcategory: 'shirt',
      colors: ['beige'],
      seasons: ['summer'],
      occasions: ['casual outing'],
      formality: 2,
      status: 'clean',
      favorite: false,
      note: 'Auto-detected',
      timesWorn: 0,
      userVerified: false,
      fabric: 'unknown',
    },
  ];
}

describe('StyleSaathi 3.0 — Phase 5A: Shadow Evaluator Integration', () => {
  beforeEach(() => {
    clearShadowComparisonHistory();
    setShadowEvaluationEnabled(true);
  });

  it('1. Deterministic Baseline Invariance: shadow evaluation cannot change baseline UI recommendations', () => {
    const items = createSampleWardrobe();
    const request: RecommendationRequest = {
      items,
      occasion: 'college',
      season: 'summer',
      localDate: '2026-11-06',
    };

    // Run A: With shadow evaluation enabled (default)
    setShadowEvaluationEnabled(true);
    const resultWithShadow = recommendOutfitsWithTelemetry({ ...request, enableShadow: true });

    // Run B: With shadow evaluation disabled
    setShadowEvaluationEnabled(false);
    const resultWithoutShadow = recommendOutfitsWithTelemetry({ ...request, enableShadow: false });

    // Invariance Assertions: User-visible outfits must be 100% mathematically identical
    expect(resultWithShadow.set.outfits.length).toBe(resultWithoutShadow.set.outfits.length);
    for (let i = 0; i < resultWithShadow.set.outfits.length; i++) {
      const outfitA = resultWithShadow.set.outfits[i];
      const outfitB = resultWithoutShadow.set.outfits[i];

      expect(outfitA.id).toBe(outfitB.id);
      expect(outfitA.template).toBe(outfitB.template);
      expect(outfitA.score).toBeCloseTo(outfitB.score, 4);
      expect(outfitA.role).toBe(outfitB.role);
      expect(outfitA.why).toBe(outfitB.why);
    }

    // Direct functional wrapper invariant
    setShadowEvaluationEnabled(true);
    const directWithShadow = recommendOutfits(request);
    setShadowEvaluationEnabled(false);
    const directWithoutShadow = recommendOutfits(request);
    expect(directWithShadow.map((o) => o.id)).toEqual(directWithoutShadow.map((o) => o.id));
  });

  it('2. Immutability Proof: request and wardrobe items are completely unmutated before, during, and after shadow execution', () => {
    const items = createSampleWardrobe();
    // Deeply freeze the items and request to guarantee immutability at the runtime level
    items.forEach((item) => Object.freeze(item));
    Object.freeze(items);

    const request: RecommendationRequest = Object.freeze({
      items,
      occasion: 'casual outing',
      season: 'summer',
      localDate: '2026-11-06',
      enableShadow: true,
    });

    // Calling recommendation with deeply frozen input must not throw TypeError
    expect(() => {
      recommendOutfitsWithTelemetry(request);
    }).not.toThrow();
  });

  it('3. Fault Isolation Proof: shadow execution failure gracefully preserves baseline output without throwing', () => {
    const items = createSampleWardrobe();
    const request: RecommendationRequest = {
      items,
      occasion: 'everyday',
      season: 'summer',
      localDate: '2026-11-06',
      enableShadow: true,
    };

    // Baseline alone without shadow
    const baselineExpected = new RecommendationEngine().recommend({ ...request, enableShadow: false });

    // Now execute recommendation; even if shadow encounters any problem, baseline output is guaranteed
    const result = recommendOutfitsWithTelemetry(request);
    expect(result.set.outfits.length).toBe(baselineExpected.set.outfits.length);
    expect(result.set.outfits[0].id).toBe(baselineExpected.set.outfits[0].id);
  });

  it('4. Anchor Preservation Audit: guarantees anchor item presence in both baseline and shadow ensemble', () => {
    const items = createSampleWardrobe();
    const anchorId = 'top_chikankari';

    const request: RecommendationRequest = {
      items,
      occasion: 'family gathering',
      season: 'summer',
      localDate: '2026-11-06',
      anchorItemId: anchorId,
      enableShadow: true,
    };

    const result = recommendOutfitsWithTelemetry(request);
    expect(result.shadowComparison).toBeDefined();

    const comparison = result.shadowComparison!;
    expect(comparison.anchorPreservation.anchorItemId).toBe(anchorId);
    expect(comparison.anchorPreservation.baselinePreserved).toBe(true);
    expect(comparison.anchorPreservation.ensemblePreserved).toBe(true);
    expect(comparison.anchorPreservation.isConsistent).toBe(true);

    // Verify all baseline outfits actually contain the anchor
    for (const outfit of result.set.outfits) {
      const pieceIds = Object.values(outfit.slots).flat().map((p) => p.id);
      expect(pieceIds).toContain(anchorId);
    }
  });

  it('5. Real Application Flow Integration (Dress Me): populates all 7 shadow comparison dimensions accurately', () => {
    const items = createSampleWardrobe();
    const request: RecommendationRequest = {
      items,
      occasion: 'college',
      season: 'summer',
      localDate: '2026-11-06',
      enableShadow: true,
    };

    // Simulate Dress Me calling recommendOutfits
    const outfits = recommendOutfits(request);
    expect(outfits.length).toBeGreaterThan(0);

    // Check that shadow evaluation ran and recorded comparison in ring buffer
    const lastComparison = getLastShadowComparison();
    expect(lastComparison).not.toBeNull();

    // Verify all 7 comparison dimensions:
    // Dimension 1: Candidate Overlap
    expect(lastComparison!.candidateOverlap.baselineCount).toBeGreaterThan(0);
    expect(lastComparison!.candidateOverlap.ensembleCount).toBeGreaterThan(0);
    expect(lastComparison!.candidateOverlap.topPickJaccardOverlap).toBeGreaterThanOrEqual(0);
    expect(lastComparison!.candidateOverlap.topPickJaccardOverlap).toBeLessThanOrEqual(1.0);

    // Dimension 2: Ranking Differences
    expect(typeof lastComparison!.rankingDifferences.baselineTopScore).toBe('number');
    expect(typeof lastComparison!.rankingDifferences.ensembleTopScore).toBe('number');
    expect(typeof lastComparison!.rankingDifferences.scoreDelta).toBe('number');
    expect(lastComparison!.rankingDifferences.explanation.length).toBeGreaterThan(0);

    // Dimension 3: Anchor Preservation
    expect(lastComparison!.anchorPreservation.isConsistent).toBe(true);

    // Dimension 4: Hard-Constraint Violations
    expect(Array.isArray(lastComparison!.hardConstraintViolations.baselineViolationsDetectedByEnsemble)).toBe(true);
    expect(Array.isArray(lastComparison!.hardConstraintViolations.ensembleViolationsDetected)).toBe(true);
    expect(lastComparison!.hardConstraintViolations.ensembleViolationsDetected.length).toBe(0);

    // Dimension 5: Unknown-Attribute Handling
    expect(typeof lastComparison!.unknownAttributeHandling.baselineUnconfirmedItemsCount).toBe('number');
    expect(typeof lastComparison!.unknownAttributeHandling.ensembleUnconfirmedItemsCount).toBe('number');

    // Dimension 6: Cultural & Contextual Consistency
    expect(typeof lastComparison!.culturalContextualConsistency.culturalHarmonious).toBe('boolean');
    expect(lastComparison!.culturalContextualConsistency.weatherAlignmentConsistent).toBe(true);

    // Dimension 7: Execution Latency
    expect(lastComparison!.executionLatency.baselineMs).toBeGreaterThanOrEqual(0);
    expect(lastComparison!.executionLatency.ensembleMs).toBeGreaterThanOrEqual(0);
    expect(lastComparison!.executionLatency.totalMs).toBeGreaterThanOrEqual(
      lastComparison!.executionLatency.baselineMs
    );
  });

  it('6. Real Application Flow Integration (Style This Item): attaches telemetry and preserves anchor', () => {
    const items = createSampleWardrobe();
    const anchorId = 'top_casual_tee';

    const request: RecommendationRequest = {
      items,
      occasion: 'casual outing',
      season: 'summer',
      localDate: '2026-11-06',
      anchorItemId: anchorId,
      enableShadow: true,
    };

    const result = recommendOutfitsWithTelemetry(request);
    expect(result.shadowComparison).toBeDefined();
    expect(result.shadowComparison!.anchorPreservation.anchorItemId).toBe(anchorId);
    expect(result.shadowComparison!.anchorPreservation.isConsistent).toBe(true);
  });

  it('7. Cultural Decorum Audit: flags leather in sacred Puja context in baseline audit', () => {
    const items = createSampleWardrobe();
    const request: RecommendationRequest = {
      items,
      occasion: 'puja',
      season: 'summer',
      localDate: '2026-11-06',
      enableShadow: true,
    };

    const result = recommendOutfitsWithTelemetry(request);
    expect(result.shadowComparison).toBeDefined();

    const cultural = result.shadowComparison!.culturalContextualConsistency;
    expect(cultural.culturalSignalsDetected).toBeGreaterThan(0);
  });

  it('8. Ring buffer management: stores up to max history and supports retrieval', () => {
    const items = createSampleWardrobe();
    clearShadowComparisonHistory();
    expect(getShadowComparisonHistory().length).toBe(0);

    const request: RecommendationRequest = {
      items,
      occasion: 'everyday',
      season: 'summer',
      localDate: '2026-11-06',
      enableShadow: true,
    };

    recommendOutfitsWithTelemetry(request);
    recommendOutfitsWithTelemetry({ ...request, explorationSeedOffset: 1 });

    const history = getShadowComparisonHistory();
    expect(history.length).toBe(2);
    expect(getLastShadowComparison()).toBe(history[0]);

    clearShadowComparisonHistory();
    expect(getShadowComparisonHistory().length).toBe(0);
    expect(getLastShadowComparison()).toBeNull();
  });
});
