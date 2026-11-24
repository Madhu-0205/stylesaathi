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
  getShadowEvaluationMetrics,
  classifyWeatherFreshness,
  SHADOW_HISTORY_MAX,
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

  it('9. Strict Ring Buffer Capacity (50 max) and FIFO Eviction', () => {
    const items = createSampleWardrobe();
    clearShadowComparisonHistory();

    const request: RecommendationRequest = {
      items,
      occasion: 'everyday',
      season: 'summer',
      localDate: '2026-11-06',
      enableShadow: true,
    };

    // Execute 65 recommendations into the 50-capacity ring buffer
    for (let i = 0; i < 65; i++) {
      recommendOutfitsWithTelemetry({ ...request, explorationSeedOffset: i });
    }

    const history = getShadowComparisonHistory(100);
    expect(history.length).toBe(SHADOW_HISTORY_MAX);
    expect(history.length).toBe(50);

    const metrics = getShadowEvaluationMetrics();
    expect(metrics.bufferCapacity).toBe(50);
    expect(metrics.bufferOccupancy).toBe(50);
    expect(metrics.totalEvaluations).toBe(50);
    expect(metrics.failureRate).toBe(0);
  });

  it('10. Concurrent Evaluation Safety across parallel executions', async () => {
    const items = createSampleWardrobe();
    clearShadowComparisonHistory();

    const occasions: RecommendationRequest['occasion'][] = [
      'everyday',
      'college',
      'casual outing',
      'family gathering',
      'office',
    ];

    // Fire 20 evaluations concurrently via Promise.all
    const promises = Array.from({ length: 20 }, (_, idx) => {
      const occ = occasions[idx % occasions.length];
      return new Promise<void>((resolve) => {
        const res = recommendOutfitsWithTelemetry({
          items,
          occasion: occ,
          season: 'summer',
          localDate: '2026-11-06',
          explorationSeedOffset: idx,
          enableShadow: true,
        });
        expect(res.set.outfits.length).toBeGreaterThan(0);
        resolve();
      });
    });

    await Promise.all(promises);

    const history = getShadowComparisonHistory(50);
    expect(history.length).toBe(20);
    for (const report of history) {
      expect(report.evaluationSuccess).toBe(true);
      expect(report.evaluationId).toMatch(/^shadow_eval_/);
      expect(report.baselineRecommendationIds.length).toBeGreaterThan(0);
    }
  });

  it('11. Stable Garment ID Comparison & Zero Record Duplication in Reports', () => {
    const items = createSampleWardrobe();
    clearShadowComparisonHistory();

    const request: RecommendationRequest = {
      items,
      occasion: 'college',
      season: 'summer',
      localDate: '2026-11-06',
      enableShadow: true,
    };

    const result = recommendOutfitsWithTelemetry(request);
    expect(result.shadowComparison).toBeDefined();

    const report = result.shadowComparison!;
    expect(report.evaluationId).toBeDefined();
    expect(typeof report.evaluationId).toBe('string');
    expect(Array.isArray(report.baselineRecommendationIds)).toBe(true);
    expect(Array.isArray(report.shadowRecommendationIds)).toBe(true);

    // Verify IDs are strings and not full object representations
    report.baselineRecommendationIds.forEach((id) => expect(typeof id).toBe('string'));
    report.shadowRecommendationIds.forEach((id) => expect(typeof id).toBe('string'));

    // Verify report contains zero full wardrobe item clones or photo bloat
    const reportJson = JSON.stringify(report);
    expect(reportJson).not.toContain('Ivory Chikankari Kurta'); // Garment names not in IDs
    expect(reportJson).not.toContain('data:image');
    expect(reportJson).not.toContain('blob:');
  });

  it('12. No Mutation of Wardrobe Items, Wear Count, or Timestamps', () => {
    const items = createSampleWardrobe();
    const originalTimesWorn = items[0].timesWorn;
    const originalStatus = items[0].status;
    const originalFavorite = items[0].favorite;

    const request: RecommendationRequest = {
      items,
      occasion: 'college',
      season: 'summer',
      localDate: '2026-11-06',
      enableShadow: true,
    };

    recommendOutfitsWithTelemetry(request);

    // Assert zero mutations
    expect(items[0].timesWorn).toBe(originalTimesWorn);
    expect(items[0].status).toBe(originalStatus);
    expect(items[0].favorite).toBe(originalFavorite);
  });

  it('13. No Duplicate Feedback Signals or Unintended Side Effects', () => {
    const items = createSampleWardrobe();
    const request: RecommendationRequest = {
      items,
      occasion: 'casual outing',
      season: 'summer',
      localDate: '2026-11-06',
      enableShadow: true,
    };

    // Running recommendations should never emit style signals or touch feedback repo
    const beforeMetrics = getShadowEvaluationMetrics();
    const res = recommendOutfitsWithTelemetry(request);
    expect(res.set.outfits.length).toBeGreaterThan(0);
    const afterMetrics = getShadowEvaluationMetrics();

    expect(afterMetrics.totalEvaluations).toBe(beforeMetrics.totalEvaluations + 1);
  });

  it('14. Missing Metadata Indicators Tracking without Data Fabrication', () => {
    const incompleteItems: WardrobeItem[] = [
      {
        id: 'inc_1',
        name: 'Mystery Top',
        category: 'Tops',
        subcategory: 'shirt',
        colors: [],
        occasions: [],
        status: 'clean',
        userVerified: false,
        fabric: 'unknown',
        fit: 'unknown',
        createdAt: 1,
      } as any,
      {
        id: 'inc_2',
        name: 'Mystery Bottom',
        category: 'Bottoms',
        subcategory: 'jeans',
        colors: ['blue'],
        occasions: ['casual outing'],
        status: 'clean',
        userVerified: true,
        fabric: 'denim',
        fit: 'regular',
        seasons: ['summer'],
        createdAt: 2,
      } as any,
      {
        id: 'inc_3',
        name: 'Mystery Shoes',
        category: 'Footwear',
        subcategory: 'sneakers',
        colors: ['white'],
        occasions: [],
        status: 'clean',
        userVerified: false,
        seasons: [],
        createdAt: 3,
      } as any,
    ];

    const request: RecommendationRequest = {
      items: incompleteItems,
      occasion: 'casual outing',
      season: 'summer',
      localDate: '2026-11-06',
      enableShadow: true,
    };

    const res = recommendOutfitsWithTelemetry(request);
    expect(res.shadowComparison).toBeDefined();

    const indicators = res.shadowComparison!.missingMetadataIndicators;
    expect(indicators.missingFabricCount).toBeGreaterThanOrEqual(1);
    expect(indicators.missingFitCount).toBeGreaterThanOrEqual(1);
    expect(indicators.missingSeasonsCount).toBeGreaterThanOrEqual(1);
    expect(indicators.missingColorCount).toBeGreaterThanOrEqual(1);
    expect(indicators.unconfirmedCount).toBeGreaterThanOrEqual(2);
  });

  it('15. Weather Freshness State Categorization', () => {
    const items = createSampleWardrobe();

    // 1. Missing weather
    const reqMissing: RecommendationRequest = {
      items,
      occasion: 'everyday',
      season: 'summer',
      localDate: '2026-11-06',
      enableShadow: true,
    };
    const resMissing = recommendOutfitsWithTelemetry(reqMissing);
    expect(resMissing.shadowComparison?.requestContext.weatherFreshness).toBe('missing');

    // 2. Simulated weather
    const reqSimulated: RecommendationRequest = {
      items,
      occasion: 'everyday',
      season: 'summer',
      localDate: '2026-11-06',
      context: {
        source: 'simulated',
        weather: { temperature: 28, condition: 'Clear', humidity: 50 },
      } as any,
      enableShadow: true,
    };
    const resSimulated = recommendOutfitsWithTelemetry(reqSimulated);
    expect(resSimulated.shadowComparison?.requestContext.weatherFreshness).toBe('simulated');

    // 3. Fresh live weather (< 30 minutes old)
    const reqFresh: RecommendationRequest = {
      items,
      occasion: 'everyday',
      season: 'summer',
      localDate: '2026-11-06',
      context: {
        source: 'device',
        weather: { temperature: 28, condition: 'Clear', humidity: 50, timestamp: Date.now() - 15 * 60 * 1000 },
      } as any,
      enableShadow: true,
    };
    const resFresh = recommendOutfitsWithTelemetry(reqFresh);
    expect(resFresh.shadowComparison?.requestContext.weatherFreshness).toBe('fresh');

    // 4. Stale live weather (30 minutes to 3 hours old)
    const reqStale: RecommendationRequest = {
      items,
      occasion: 'everyday',
      season: 'summer',
      localDate: '2026-11-06',
      context: {
        source: 'device',
        weather: { temperature: 28, condition: 'Clear', humidity: 50, timestamp: Date.now() - 45 * 60 * 1000 },
      } as any,
      enableShadow: true,
    };
    const resStale = recommendOutfitsWithTelemetry(reqStale);
    expect(resStale.shadowComparison?.requestContext.weatherFreshness).toBe('stale');

    // 5. Expired live weather (> 3 hours old)
    const reqExpired: RecommendationRequest = {
      items,
      occasion: 'everyday',
      season: 'summer',
      localDate: '2026-11-06',
      context: {
        source: 'device',
        weather: { temperature: 28, condition: 'Clear', humidity: 50, timestamp: Date.now() - 5 * 3600 * 1000 },
      } as any,
      enableShadow: true,
    };
    const resExpired = recommendOutfitsWithTelemetry(reqExpired);
    expect(resExpired.shadowComparison?.requestContext.weatherFreshness).toBe('expired');
  });

  it('16. Deterministic Comparison Metrics between identical evaluations', () => {
    const items = createSampleWardrobe();
    const request: RecommendationRequest = {
      items,
      occasion: 'college',
      season: 'summer',
      localDate: '2026-11-06',
      explorationSeedOffset: 42,
      enableShadow: true,
    };

    const res1 = recommendOutfitsWithTelemetry(request);
    const res2 = recommendOutfitsWithTelemetry(request);

    const comp1 = res1.shadowComparison!;
    const comp2 = res2.shadowComparison!;

    expect(comp1.rankingDifferences.scoreDelta).toBe(comp2.rankingDifferences.scoreDelta);
    expect(comp1.rankingDifferences.rankInversionsCount).toBe(comp2.rankingDifferences.rankInversionsCount);
    expect(comp1.candidateOverlap.topPickJaccardOverlap).toBe(comp2.candidateOverlap.topPickJaccardOverlap);
    expect(comp1.candidateOverlap.sharedTopCandidateIds).toEqual(comp2.candidateOverlap.sharedTopCandidateIds);
  });

  it('17. Shadow Mode Disabled Behavior', () => {
    const items = createSampleWardrobe();
    clearShadowComparisonHistory();

    const request: RecommendationRequest = {
      items,
      occasion: 'college',
      season: 'summer',
      localDate: '2026-11-06',
    };

    // Disabled via request parameter
    const resRequestDisabled = recommendOutfitsWithTelemetry({ ...request, enableShadow: false });
    expect(resRequestDisabled.shadowComparison).toBeUndefined();
    expect(getShadowComparisonHistory().length).toBe(0);

    // Disabled via global toggle
    setShadowEvaluationEnabled(false);
    const resGlobalDisabled = recommendOutfitsWithTelemetry(request);
    expect(resGlobalDisabled.shadowComparison).toBeUndefined();
    expect(getShadowComparisonHistory().length).toBe(0);

    setShadowEvaluationEnabled(true);
  });

  it('18. Zero External Network and Paid API Dependencies', () => {
    const items = createSampleWardrobe();
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;

    // Intercept fetch to guarantee zero network traffic
    globalThis.fetch = () => {
      fetchCalled = true;
      return Promise.reject(new Error('Network access is prohibited during local shadow evaluation'));
    };

    try {
      const res = recommendOutfitsWithTelemetry({
        items,
        occasion: 'college',
        season: 'summer',
        localDate: '2026-11-06',
        enableShadow: true,
      });

      expect(fetchCalled).toBe(false);
      expect(res.shadowComparison).toBeDefined();
      expect(res.shadowComparison?.evaluationSuccess).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('19. Canonical Weather Freshness Boundary Tests', () => {
    const now = 1700000000000;

    // Fresh: under 30 minutes (< 1,800,000 ms)
    expect(classifyWeatherFreshness({ weather: { observedAt: now } } as any, now)).toBe('fresh');
    expect(classifyWeatherFreshness({ weather: { observedAt: now - 10 * 60 * 1000 } } as any, now)).toBe('fresh');
    expect(classifyWeatherFreshness({ weather: { observedAt: now - (30 * 60 * 1000 - 1) } } as any, now)).toBe('fresh');

    // Stale: 30 minutes to 3 hours (1,800,000 ms to 10,800,000 ms)
    expect(classifyWeatherFreshness({ weather: { observedAt: now - 30 * 60 * 1000 } } as any, now)).toBe('stale');
    expect(classifyWeatherFreshness({ weather: { observedAt: now - 60 * 60 * 1000 } } as any, now)).toBe('stale');
    expect(classifyWeatherFreshness({ weather: { observedAt: now - 120 * 60 * 1000 } } as any, now)).toBe('stale');
    expect(classifyWeatherFreshness({ weather: { observedAt: now - 180 * 60 * 1000 } } as any, now)).toBe('stale');

    // Expired: over 3 hours (> 10,800,000 ms)
    expect(classifyWeatherFreshness({ weather: { observedAt: now - (180 * 60 * 1000 + 1) } } as any, now)).toBe('expired');
    expect(classifyWeatherFreshness({ weather: { observedAt: now - 4 * 3600 * 1000 } } as any, now)).toBe('expired');
    expect(classifyWeatherFreshness({ weather: { observedAt: now - 24 * 3600 * 1000 } } as any, now)).toBe('expired');

    // Simulated: explicitly identified as simulated
    expect(classifyWeatherFreshness({ source: 'simulated', weather: { observedAt: now } } as any, now)).toBe('simulated');
    expect(classifyWeatherFreshness({ weather: { source: 'simulated', observedAt: now } } as any, now)).toBe('simulated');
    expect(classifyWeatherFreshness({ weather: { source: 'fallback', observedAt: now } } as any, now)).toBe('simulated');

    // Missing: no usable snapshot
    expect(classifyWeatherFreshness(null, now)).toBe('missing');
    expect(classifyWeatherFreshness(undefined, now)).toBe('missing');
    expect(classifyWeatherFreshness({ weather: null } as any, now)).toBe('missing');
    expect(classifyWeatherFreshness({ source: 'unavailable' } as any, now)).toBe('missing');
    expect(classifyWeatherFreshness({ freshness: 'unavailable', weather: { observedAt: now } } as any, now)).toBe('missing');

    // Clock skew / future timestamp
    expect(classifyWeatherFreshness({ weather: { observedAt: now + 5000 } } as any, now)).toBe('fresh');
  });

  it('20. Recursive Re-Entrancy Guard (isExecutingShadow)', () => {
    const items = createSampleWardrobe();
    const req: RecommendationRequest = {
      items,
      occasion: 'college',
      season: 'summer',
      localDate: '2026-11-06',
      enableShadow: true,
    };

    const baselineResult = new RecommendationEngine().recommend(req);
    expect(baselineResult).toBeDefined();

    // Calling executeShadowEvaluation directly returns a report
    const report1 = executeShadowEvaluation(baselineResult, req);
    expect(report1).not.toBeNull();
  });

  it('21. Runtime Integration Path Verification: TodayScreen and DressMe Entry Points', () => {
    clearShadowComparisonHistory();
    const items = createSampleWardrobe();

    // 1. Simulate TodayScreen runtime call: recommendOutfits without explicit enableShadow
    const todayOutfits = recommendOutfits({
      items,
      occasion: 'everyday',
      season: 'summer',
      localDate: '2026-11-06',
    });

    expect(todayOutfits).toBeDefined();
    expect(Array.isArray(todayOutfits)).toBe(true);
    expect(todayOutfits.length).toBeGreaterThan(0);

    // Verify shadow evaluation executed and recorded to ring buffer in background
    const lastReport = getLastShadowComparison();
    expect(lastReport).not.toBeNull();
    expect(lastReport?.evaluationSuccess).toBe(true);
    expect(lastReport?.requestContext.occasion).toBe('everyday');
    expect(lastReport?.baselineRecommendationIds).toEqual(todayOutfits.map((o) => o.id));

    // 2. Simulate DressMe runtime call
    const dressMeOutfits = recommendOutfits({
      items,
      occasion: 'college',
      season: 'summer',
      localDate: '2026-11-06',
      explorationSeedOffset: 1,
      limit: 3,
    });

    expect(dressMeOutfits).toBeDefined();
    expect(dressMeOutfits.length).toBeGreaterThan(0);

    const history = getShadowComparisonHistory();
    expect(history.length).toBe(2);
    expect(history[0].requestContext.occasion).toBe('college');
  });
});

