import { describe, it, expect } from 'vitest';
import {
  EnsembleRecommendationEngine,
  recommendEnsembleOutfits,
} from '../ensembleEngine';
import { ENSEMBLE_FIXTURE_ITEMS } from '../evaluation/ensembleDataset';

describe('StyleSaathi 3.0 — Ensemble Recommendation Engine Integration', () => {
  const wardrobe = [
    ENSEMBLE_FIXTURE_ITEMS.kanjivaramSareeRed,
    ENSEMBLE_FIXTURE_ITEMS.silkBlouseGold,
    ENSEMBLE_FIXTURE_ITEMS.goldJuttis,
    ENSEMBLE_FIXTURE_ITEMS.mustardKurtiCotton,
    ENSEMBLE_FIXTURE_ITEMS.slimBlueJeans,
    ENSEMBLE_FIXTURE_ITEMS.whiteSneakers,
    ENSEMBLE_FIXTURE_ITEMS.basicWhiteTee,
    ENSEMBLE_FIXTURE_ITEMS.navyTailoredBlazer,
    ENSEMBLE_FIXTURE_ITEMS.linenShirtWhite,
    ENSEMBLE_FIXTURE_ITEMS.chinosBeige,
    ENSEMBLE_FIXTURE_ITEMS.brownLoafers,
  ];

  it('recommends top 3 diverse outfits with distinct roles (best_match, alternative, explore)', () => {
    const engine = new EnsembleRecommendationEngine();
    const result = engine.recommend({
      items: wardrobe,
      occasion: 'casual outing',
      season: 'summer',
      localDate: '2026-11-06',
    });

    expect(result.outfits.length).toBeGreaterThan(0);
    expect(result.outfits[0].role).toBe('best_match');
    expect(result.outfits[0].score).toBeGreaterThan(6.0);
    expect(result.outfits[0].explanation.reasons.length).toBeGreaterThan(0);

    if (result.outfits.length >= 2) {
      expect(result.outfits[1].role).toBe('alternative');
    }
  });

  it('provides detailed graph and breakdown evaluations in result', () => {
    const engine = new EnsembleRecommendationEngine();
    const result = engine.recommend({
      items: wardrobe,
      occasion: 'wedding guest',
      season: 'winter',
      localDate: '2026-11-06',
      anchorItemId: 'kanjivaram-saree-red',
    });

    expect(result.outfits.length).toBeGreaterThan(0);
    const topOutfit = result.outfits[0];
    const evalData = result.evaluations[topOutfit.id];

    expect(evalData).toBeDefined();
    expect(evalData.graph.nodeCount).toBeGreaterThanOrEqual(2);
    expect(evalData.breakdown.culturalRegionalContext).toBeGreaterThan(0);
    expect(evalData.classification).toBe('highly_compatible');
  });

  it('executes side-by-side comparison with baseline engine', () => {
    const engine = new EnsembleRecommendationEngine();
    const result = engine.recommend(
      {
        items: wardrobe,
        occasion: 'college',
        season: 'summer',
        localDate: '2026-11-06',
      },
      { compareWithBaseline: true }
    );

    expect(result.comparisonTelemetry).toBeDefined();
    expect(result.comparisonTelemetry?.baselineTopScore).toBeGreaterThan(0);
    expect(result.comparisonTelemetry?.ensembleTopScore).toBeGreaterThan(0);
  });

  it('functional wrapper recommendEnsembleOutfits returns list of RecommendedOutfit', () => {
    const outfits = recommendEnsembleOutfits({
      items: wardrobe,
      occasion: 'office',
      season: 'summer',
      localDate: '2026-11-06',
    });

    expect(outfits.length).toBeGreaterThan(0);
    expect(outfits[0].id).toBeDefined();
    expect(outfits[0].score).toBeGreaterThan(0);
  });
});
