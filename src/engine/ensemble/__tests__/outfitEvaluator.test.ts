import { describe, it, expect } from 'vitest';
import { buildEnsembleGraph } from '../ensembleGraph';
import { evaluateEnsembleOutfit } from '../outfitEvaluator';
import {
  ENSEMBLE_FIXTURE_ITEMS,
  COMPLETE_OUTFIT_EVALUATION_DATASET,
} from '../evaluation/ensembleDataset';

describe('StyleSaathi 3.0 — Whole-Outfit Evaluator (Dimensions A through J)', () => {
  it('hard-rejects ensembles with unwearable laundry items', () => {
    const pieces = [
      ENSEMBLE_FIXTURE_ITEMS.dirtyLinenShirtInLaundry,
      ENSEMBLE_FIXTURE_ITEMS.slimBlueJeans,
      ENSEMBLE_FIXTURE_ITEMS.whiteSneakers,
    ];
    const graph = buildEnsembleGraph(pieces);
    const result = evaluateEnsembleOutfit(graph);

    expect(result.isValid).toBe(false);
    expect(result.score).toBe(0.0);
    expect(result.classification).toBe('hard_incompatible');
  });

  it('applies weakest link penalty when a single piece clashes severely', () => {
    // Navy blazer + navy trousers + neon orange flip flops
    const pieces = [
      ENSEMBLE_FIXTURE_ITEMS.navyTailoredBlazer,
      ENSEMBLE_FIXTURE_ITEMS.tailoredTrousersNavy,
      ENSEMBLE_FIXTURE_ITEMS.neonOrangeFlipFlops,
    ];
    const graph = buildEnsembleGraph(pieces, { occasion: 'interview' });
    const result = evaluateEnsembleOutfit(graph, { occasion: 'interview' });

    expect(result.breakdown.penaltiesApplied.some((p) => p.includes('Weakest link'))).toBe(true);
    expect(result.score).toBeLessThan(5.0);
    expect(result.classification).toBe('clashing');
  });

  it('rewards Rule of One Statement pattern balance', () => {
    // 1 statement pattern + 2 solid pieces
    const pieces = [
      ENSEMBLE_FIXTURE_ITEMS.chikankariKurtaWhite, // embroidered
      ENSEMBLE_FIXTURE_ITEMS.cottonChuridarWhite, // solid
      ENSEMBLE_FIXTURE_ITEMS.yellowChiffonDupatta, // solid
    ];
    const graph = buildEnsembleGraph(pieces, { occasion: 'puja' });
    const result = evaluateEnsembleOutfit(graph, { occasion: 'puja' });

    expect(result.breakdown.patternTextureDistribution).toBeGreaterThan(0);
    expect(
      result.breakdown.bonusesApplied.some((b) => b.includes('Rule of One Statement'))
    ).toBe(true);
  });

  it('penalizes pattern clutter when 2 statement prints compete', () => {
    const pieces = [
      ENSEMBLE_FIXTURE_ITEMS.floralBlouseMagenta,
      ENSEMBLE_FIXTURE_ITEMS.geometricTrousersGreen,
      ENSEMBLE_FIXTURE_ITEMS.whiteSneakers,
    ];
    const graph = buildEnsembleGraph(pieces, { occasion: 'casual outing' });
    const result = evaluateEnsembleOutfit(graph, { occasion: 'casual outing' });

    expect(result.breakdown.patternTextureDistribution).toBeLessThan(0);
    expect(
      result.breakdown.penaltiesApplied.some((p) => p.includes('Pattern clutter'))
    ).toBe(true);
  });

  it('rewards Korean relaxed volume when streetwear aesthetic is selected', () => {
    const pieces = [
      ENSEMBLE_FIXTURE_ITEMS.oversizedBoxyTee,
      ENSEMBLE_FIXTURE_ITEMS.wideBalloonPants,
      ENSEMBLE_FIXTURE_ITEMS.chunkySneakersBlack,
    ];
    const graph = buildEnsembleGraph(pieces);
    const resultWithAesthetic = evaluateEnsembleOutfit(graph, {
      preferences: {
        preferredAesthetics: ['streetwear', 'korean_aesthetic'],
        stylingMode: 'balanced',
      } as any,
    });

    expect(resultWithAesthetic.breakdown.silhouetteProportionBalance).toBeGreaterThan(0);
    expect(
      resultWithAesthetic.breakdown.bonusesApplied.some((b) =>
        b.includes('Intentional relaxed volume')
      )
    ).toBe(true);
  });

  it('penalizes oversized volume collision when classic aesthetic is selected', () => {
    const pieces = [
      ENSEMBLE_FIXTURE_ITEMS.oversizedBoxyTee,
      ENSEMBLE_FIXTURE_ITEMS.wideBalloonPants,
      ENSEMBLE_FIXTURE_ITEMS.chunkySneakersBlack,
    ];
    const graph = buildEnsembleGraph(pieces);
    const resultClassic = evaluateEnsembleOutfit(graph, {
      preferences: {
        preferredAesthetics: ['classic'],
        stylingMode: 'balanced',
      } as any,
    });

    expect(resultClassic.breakdown.silhouetteProportionBalance).toBeLessThan(0);
    expect(
      resultClassic.breakdown.penaltiesApplied.some((p) =>
        p.includes('Volume collision')
      )
    ).toBe(true);
  });

  it('awards sacred decorum for Puja occasion with auspicious colors', () => {
    const pieces = [
      ENSEMBLE_FIXTURE_ITEMS.chikankariKurtaWhite,
      ENSEMBLE_FIXTURE_ITEMS.cottonChuridarWhite,
      ENSEMBLE_FIXTURE_ITEMS.yellowChiffonDupatta,
    ];
    const graph = buildEnsembleGraph(pieces, { occasion: 'puja' });
    const result = evaluateEnsembleOutfit(graph, { occasion: 'puja' });

    expect(
      result.breakdown.bonusesApplied.some((b) => b.includes('Devotional decorum'))
    ).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(8.0);
  });

  it('correctly evaluates all 13+ labelled complete outfit benchmark cases', () => {
    let passedCount = 0;

    for (const testCase of COMPLETE_OUTFIT_EVALUATION_DATASET) {
      const graph = buildEnsembleGraph(testCase.pieces, {
        outfitId: testCase.id,
        anchorItemId: testCase.anchorItemId,
        occasion: testCase.occasion,
        season: testCase.season,
        context: testCase.context,
        preferences: testCase.preferences,
        styleProfile: testCase.styleProfile,
      });

      const res = evaluateEnsembleOutfit(graph, {
        occasion: testCase.occasion,
        season: testCase.season,
        context: testCase.context,
        preferences: testCase.preferences,
        styleProfile: testCase.styleProfile,
      });

      expect(res.classification).toBe(testCase.expectedClassification);

      if (testCase.expectedMinScore !== undefined) {
        expect(res.score).toBeGreaterThanOrEqual(testCase.expectedMinScore);
      }
      if (testCase.expectedMaxScore !== undefined) {
        expect(res.score).toBeLessThanOrEqual(testCase.expectedMaxScore);
      }
      if (testCase.expectedHardIncompatible !== undefined) {
        expect(res.isValid).toBe(!testCase.expectedHardIncompatible);
      }

      passedCount++;
    }

    expect(passedCount).toBe(COMPLETE_OUTFIT_EVALUATION_DATASET.length);
  });
});
