import { describe, it, expect } from 'vitest';
import { RecommendationEngine } from '../../recommendationEngine';
import { EnsembleRecommendationEngine } from '../../ensemble/ensembleEngine';
import { RecommendationRequest, WardrobeItem, StylePreferences } from '../../../types';
import { FASHION_ACCURACY_EVALUATION_DATASET } from '../datasets/fashionAccuracyDataset';
import { COMPLETE_OUTFIT_EVALUATION_DATASET } from '../../ensemble/evaluation/ensembleDataset';
import { validateOutfitWearability } from '../../hardConstraints';
import { getOutfitPieces } from '../evaluationHarness';

describe('StyleSaathi 3.0 — Phase 5D: Paired Evaluation & Independent Validation', () => {
  const baseEngine = new RecommendationEngine();
  const ensembleEngine = new EnsembleRecommendationEngine();

  // ==========================================================================
  // 1. Full 30-case Paired Evaluation across Fashion Accuracy Dataset
  // ==========================================================================
  it('1. Executes paired evaluation across all 30 Fashion Accuracy cases', () => {
    let baselineTotalOutfits = 0;
    let ensembleTotalOutfits = 0;
    let exactTopMatchCount = 0;
    let baselineHardViolations = 0;
    let ensembleHardViolations = 0;
    let totalLatencyBase = 0;
    let totalLatencyEns = 0;

    const disagreements: Array<{
      caseId: string;
      caseName: string;
      category: string;
      baseTop: string;
      baseScore: number;
      ensTop: string;
      ensScore: number;
      delta: number;
      reason: string;
    }> = [];

    for (const testCase of FASHION_ACCURACY_EVALUATION_DATASET) {
      const request: RecommendationRequest = {
        items: testCase.wardrobe as WardrobeItem[],
        occasion: testCase.occasion,
        season: testCase.season || 'summer',
        localDate: '2026-11-06',
        preferences: {
          preferredContexts: [],
          preferredAesthetics: [],
          updatedAt: Date.now(),
          ...testCase.userPreferences,
        } as StylePreferences,
        styleProfile: testCase.styleProfile,
        context: testCase.weatherFixture,
        culturalSignals: testCase.culturalSignals,
        limit: 3,
      };

      // Baseline Run
      const t0Base = performance.now();
      const baseRes = baseEngine.recommend(request);
      const t1Base = performance.now();
      totalLatencyBase += (t1Base - t0Base);

      // Ensemble Run
      const t0Ens = performance.now();
      const ensRes = ensembleEngine.recommend(request);
      const t1Ens = performance.now();
      totalLatencyEns += (t1Ens - t0Ens);

      const baseOutfits = baseRes.set.outfits;
      const ensOutfits = ensRes.outfits;

      baselineTotalOutfits += baseOutfits.length;
      ensembleTotalOutfits += ensOutfits.length;

      // Hard constraint audit on baseline outfits
      for (const bo of baseOutfits) {
        const pieces = getOutfitPieces(bo);
        // Check clean status
        if (pieces.some((p) => p.status !== 'clean')) {
          baselineHardViolations++;
        }
      }

      // Hard constraint audit on ensemble outfits
      for (const eo of ensOutfits) {
        const pieces = getOutfitPieces(eo);
        // Check clean status
        if (pieces.some((p) => p.status !== 'clean')) {
          ensembleHardViolations++;
        }
      }

      // Check Top Recommendation Agreement
      if (baseOutfits.length > 0 && ensOutfits.length > 0) {
        const baseTop = baseOutfits[0];
        const ensTop = ensOutfits[0];
        const baseSig = getOutfitPieces(baseTop).map((p) => p.id).sort().join('+');
        const ensSig = getOutfitPieces(ensTop).map((p) => p.id).sort().join('+');

        if (baseSig === ensSig) {
          exactTopMatchCount++;
        } else {
          disagreements.push({
            caseId: testCase.id,
            caseName: testCase.name,
            category: testCase.category,
            baseTop: getOutfitPieces(baseTop).map((p) => p.name).join(' + '),
            baseScore: Number(baseTop.score.toFixed(2)),
            ensTop: getOutfitPieces(ensTop).map((p) => p.name).join(' + '),
            ensScore: Number(ensTop.score.toFixed(2)),
            delta: Number((ensTop.score - baseTop.score).toFixed(2)),
            reason: `Ranking divergence in ${testCase.category}`,
          });
        }
      } else if (baseOutfits.length === 0 && ensOutfits.length === 0) {
        // Both correctly generated 0 outfits (e.g. empty wardrobe or missing blouse)
        exactTopMatchCount++;
      } else {
        disagreements.push({
          caseId: testCase.id,
          caseName: testCase.name,
          category: testCase.category,
          baseTop: baseOutfits.length > 0 ? `${baseOutfits.length} outfits` : 'None',
          baseScore: baseOutfits.length > 0 ? baseOutfits[0].score : 0,
          ensTop: ensOutfits.length > 0 ? `${ensOutfits.length} outfits` : 'None',
          ensScore: ensOutfits.length > 0 ? ensOutfits[0].score : 0,
          delta: 0,
          reason: 'Generation count mismatch (one engine found candidates, other did not)',
        });
      }
    }

    console.log('\n================================================================================');
    console.log('       STYLESAATHI PHASE 5D — PAIRED EVALUATION SUMMARY REPORT (N = 30)         ');
    console.log('================================================================================');
    console.log(`Total Cases Evaluated:           30`);
    console.log(`Baseline Total Outfits:          ${baselineTotalOutfits}`);
    console.log(`Ensemble Total Outfits:          ${ensembleTotalOutfits}`);
    console.log(`Exact Top-1 Outfit Agreement:    ${exactTopMatchCount} / 30 (${((exactTopMatchCount / 30) * 100).toFixed(1)}%)`);
    console.log(`Baseline Hard Violations:        ${baselineHardViolations}`);
    console.log(`Ensemble Hard Violations:        ${ensembleHardViolations}`);
    console.log(`Avg Latency Baseline:            ${(totalLatencyBase / 30).toFixed(2)} ms`);
    console.log(`Avg Latency Ensemble:            ${(totalLatencyEns / 30).toFixed(2)} ms`);
    console.log(`Disagreements Count:             ${disagreements.length}`);
    console.log('--------------------------------------------------------------------------------');
    console.log('Disagreements Detail:');
    for (const d of disagreements) {
      console.log(`  [${d.caseId}] ${d.caseName} (${d.category})`);
      console.log(`    - Baseline Top (Score ${d.baseScore}): ${d.baseTop}`);
      console.log(`    - Ensemble Top (Score ${d.ensScore}): ${d.ensTop} [Δ ${d.delta}]`);
    }
    console.log('================================================================================\n');

    expect(baselineHardViolations).toBe(0);
    expect(ensembleHardViolations).toBe(0);
    expect(exactTopMatchCount).toBeGreaterThanOrEqual(15); // Expect significant baseline/ensemble alignment
  });

  // ==========================================================================
  // 2. Determinism and Permutation Invariance
  // ==========================================================================
  it('2. Verifies determinism and permutation invariance across both engines', () => {
    const testCase = FASHION_ACCURACY_EVALUATION_DATASET[0]; // Sherwani case
    const request: RecommendationRequest = {
      items: [...testCase.wardrobe] as WardrobeItem[],
      occasion: testCase.occasion,
      season: testCase.season || 'summer',
      localDate: '2026-11-06',
      limit: 3,
    };

    // Run 1
    const baseRun1 = baseEngine.recommend(request);
    const ensRun1 = ensembleEngine.recommend(request);

    // Run 2 (Identical input)
    const baseRun2 = baseEngine.recommend(request);
    const ensRun2 = ensembleEngine.recommend(request);

    // Assert Determinism
    expect(baseRun1.set.outfits[0].score).toBe(baseRun2.set.outfits[0].score);
    expect(ensRun1.outfits[0].score).toBe(ensRun2.outfits[0].score);

    // Run 3: Reversed Wardrobe Order (Permutation Invariance)
    const reversedRequest: RecommendationRequest = {
      ...request,
      items: [...testCase.wardrobe].reverse() as WardrobeItem[],
    };
    const baseRun3 = baseEngine.recommend(reversedRequest);
    const ensRun3 = ensembleEngine.recommend(reversedRequest);

    const baseTopPieces1 = getOutfitPieces(baseRun1.set.outfits[0]).map((p) => p.id).sort().join('+');
    const baseTopPieces3 = getOutfitPieces(baseRun3.set.outfits[0]).map((p) => p.id).sort().join('+');
    const ensTopPieces1 = getOutfitPieces(ensRun1.outfits[0]).map((p) => p.id).sort().join('+');
    const ensTopPieces3 = getOutfitPieces(ensRun3.outfits[0]).map((p) => p.id).sort().join('+');

    expect(baseTopPieces1).toBe(baseTopPieces3);
    expect(ensTopPieces1).toBe(ensTopPieces3);
  });

  // ==========================================================================
  // 3. Anchor Preservation Across Both Engines
  // ==========================================================================
  it('3. Verifies anchor preservation across both engines', () => {
    for (const testCase of FASHION_ACCURACY_EVALUATION_DATASET) {
      if (!testCase.wardrobe || testCase.wardrobe.length === 0) continue;
      const anchor = testCase.wardrobe[0];
      if (anchor.status !== 'clean') continue;

      const request: RecommendationRequest = {
        items: testCase.wardrobe as WardrobeItem[],
        occasion: testCase.occasion,
        season: testCase.season || 'summer',
        localDate: '2026-11-06',
        anchorItemId: anchor.id,
        limit: 3,
      };

      const baseRes = baseEngine.recommend(request);
      const ensRes = ensembleEngine.recommend(request);

      for (const outfit of baseRes.set.outfits) {
        const pieces = getOutfitPieces(outfit);
        expect(pieces.some((p) => p.id === anchor.id)).toBe(true);
      }

      for (const outfit of ensRes.outfits) {
        const pieces = getOutfitPieces(outfit);
        expect(pieces.some((p) => p.id === anchor.id)).toBe(true);
      }
    }
  });

  // ==========================================================================
  // 4. Laundry Planning-Mode Alignment & Boundary Verification
  // ==========================================================================
  it('4. Verifies laundry planning-mode alignment and wear boundary rejection', async () => {
    const dirtyAnchorCase = FASHION_ACCURACY_EVALUATION_DATASET.find(
      (c) => c.id === 'case-21-dirty-clothes-laundry-exclusion'
    );
    expect(dirtyAnchorCase).toBeDefined();

    const dirtyItem = dirtyAnchorCase!.wardrobe.find((i) => i.status === 'in_laundry' || i.status === 'needs_washing');
    expect(dirtyItem).toBeDefined();

    // Standard run: unwashed item must be strictly excluded from outfits
    const reqNormal: RecommendationRequest = {
      items: dirtyAnchorCase!.wardrobe as WardrobeItem[],
      occasion: dirtyAnchorCase!.occasion,
      season: dirtyAnchorCase!.season || 'summer',
      localDate: '2026-11-06',
    };
    const baseNormal = baseEngine.recommend(reqNormal);
    const ensNormal = ensembleEngine.recommend(reqNormal);

    for (const o of baseNormal.set.outfits) {
      expect(getOutfitPieces(o).some((p) => p.id === dirtyItem!.id)).toBe(false);
    }
    for (const o of ensNormal.outfits) {
      expect(getOutfitPieces(o).some((p) => p.id === dirtyItem!.id)).toBe(false);
    }

    // Planning mode run: unwashed anchor is permitted for planning exploration
    const reqPlanning: RecommendationRequest = {
      ...reqNormal,
      anchorItemId: dirtyItem!.id,
      allowPlanningMode: true,
    };
    const basePlanning = baseEngine.recommend(reqPlanning);
    const ensPlanning = ensembleEngine.recommend(reqPlanning);

    expect(basePlanning.set.outfits.length).toBeGreaterThan(0);
    expect(ensPlanning.outfits.length).toBeGreaterThan(0);

    const baseTopPlan = basePlanning.set.outfits[0];
    const ensTopPlan = ensPlanning.outfits[0];

    expect(getOutfitPieces(baseTopPlan).some((p) => p.id === dirtyItem!.id)).toBe(true);
    expect(getOutfitPieces(ensTopPlan).some((p) => p.id === dirtyItem!.id)).toBe(true);

    // Wear boundary: validateOutfitWearability strictly rejects wear for both planned outfits
    const baseWearCheck = validateOutfitWearability(baseTopPlan);
    const ensWearCheck = validateOutfitWearability(ensTopPlan);

    expect(baseWearCheck.canWear).toBe(false);
    expect(ensWearCheck.canWear).toBe(false);
    expect(baseWearCheck.error).toContain('needs washing before wearing');
    expect(ensWearCheck.error).toContain('needs washing before wearing');
  });

  // ==========================================================================
  // 5. Clashing and Boundary Cases from Ensemble Dataset
  // ==========================================================================
  it('5. Evaluates curated clashing and boundary cases from ensemble dataset', () => {
    for (const ensCase of COMPLETE_OUTFIT_EVALUATION_DATASET) {
      const request: RecommendationRequest = {
        items: ensCase.pieces,
        occasion: ensCase.occasion,
        season: ensCase.season || 'summer',
        localDate: '2026-11-06',
        context: ensCase.context,
        preferences: ensCase.preferences,
        styleProfile: ensCase.styleProfile,
        anchorItemId: ensCase.anchorItemId,
        limit: 3,
      };

      const baseRes = baseEngine.recommend(request);
      const ensRes = ensembleEngine.recommend(request);

      if (ensCase.expectedHardIncompatible) {
        // If expected to be hard-incompatible (e.g. laundry, deluge)
        // Ensemble should have score < 5 or empty outfits
        if (ensRes.outfits.length > 0) {
          expect(ensRes.outfits[0].score).toBeLessThanOrEqual(5.0);
        }
      }
    }
  });

  // ==========================================================================
  // 6. Deep Diagnostic Inspection on Disagreement Cases
  // ==========================================================================
  it('6. Inspects all 9 disagreement dynamics in depth', () => {
    const disagreementIds = [
      'case-05-women-lucknowi-chikankari-summer',
      'case-10-men-corporate-interview-bandhgala',
      'case-11-women-executive-interview-tailored-western',
      'case-13-women-eid-modest-pastel-mulmul',
      'case-16-korean-contemporary-streetwear-fusion',
      'case-17-japanese-relaxed-workwear-handloom',
      'case-23-explicit-disliked-styles-and-color-preferences',
      'case-27-west-gujarat-navratri-high-mobility',
      'case-28-travel-comfort-hot-humid-transit',
    ];

    console.log('\n================================================================================');
    console.log('              DEEP DIVE: 9 PAIRED DISAGREEMENT INVESTIGATIONS                   ');
    console.log('================================================================================');

    for (const id of disagreementIds) {
      const testCase = FASHION_ACCURACY_EVALUATION_DATASET.find((c) => c.id === id)!;
      const request: RecommendationRequest = {
        items: testCase.wardrobe as WardrobeItem[],
        occasion: testCase.occasion,
        season: testCase.season || 'summer',
        localDate: '2026-11-06',
        preferences: {
          preferredContexts: [],
          preferredAesthetics: [],
          updatedAt: Date.now(),
          ...testCase.userPreferences,
        } as StylePreferences,
        styleProfile: testCase.styleProfile,
        context: testCase.weatherFixture,
        culturalSignals: testCase.culturalSignals,
        limit: 3,
      };

      const baseRes = baseEngine.recommend(request);
      const ensRes = ensembleEngine.recommend(request);

      const bTop = baseRes.set.outfits[0];
      const eTop = ensRes.outfits[0];
      const eEval = ensRes.evaluations[eTop.id];

      console.log(`\n--------------------------------------------------------------------------------`);
      console.log(`CASE: [${testCase.id}] ${testCase.name}`);
      console.log(`Occasion: ${testCase.occasion} | Season: ${testCase.season || 'summer'}`);
      console.log(`BASELINE Top: [${bTop.template}] score=${bTop.score.toFixed(2)}`);
      console.log(`  Pieces:`, getOutfitPieces(bTop).map((p) => `${p.name} (${p.category})`).join(' + '));
      console.log(`ENSEMBLE Top: [${eTop.template}] score=${eTop.score.toFixed(2)}`);
      console.log(`  Pieces:`, getOutfitPieces(eTop).map((p) => `${p.name} (${p.category})`).join(' + '));
      if (eEval) {
        console.log(`  Ensemble Breakdown:`);
        console.log(`    Pairwise: ${eEval.breakdown.pairwiseEdgeAggregation.toFixed(2)} | Min Edge: ${eEval.graph.minimumPairwiseScore.toFixed(2)}`);
        console.log(`    Formality (${eEval.breakdown.formalityConsistency >= 0 ? '+' : ''}${eEval.breakdown.formalityConsistency.toFixed(2)}) | Cultural (${eEval.breakdown.culturalRegionalContext >= 0 ? '+' : ''}${eEval.breakdown.culturalRegionalContext.toFixed(2)}) | Color (${eEval.breakdown.colorBalance >= 0 ? '+' : ''}${eEval.breakdown.colorBalance.toFixed(2)})`);
        console.log(`    Penalties: ${eEval.breakdown.penaltiesApplied.join('; ') || 'None'}`);
        console.log(`    Bonuses:   ${eEval.breakdown.bonusesApplied.join('; ') || 'None'}`);
      }
    }
  });
});
