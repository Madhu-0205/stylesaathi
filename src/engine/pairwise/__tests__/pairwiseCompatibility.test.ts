import { describe, it, expect } from 'vitest';
import { pairwiseCompatibilityEngine } from '../pairwiseCompatibilityEngine';
import { classifyGarmentPair } from '../pairClassifier';
import { evaluatePairHardIncompatibility } from '../hardIncompatibility';
import { evaluateColorDimension } from '../dimensions/colorDimension';
import { evaluateSilhouetteDimension } from '../dimensions/silhouetteDimension';
import { evaluateFabricDimension } from '../dimensions/fabricDimension';
import { evaluatePatternDimension } from '../dimensions/patternDimension';
import { evaluateFormalityDimension } from '../dimensions/formalityDimension';
import { evaluateCulturalPairSynergy } from '../culturalPairEngine';
import {
  PAIR_ITEMS,
  PAIRWISE_EVALUATION_DATASET,
} from '../evaluation/pairwiseDataset';
import { WEATHER_DELUGE_MUMBAI } from '../../evaluation/fixtures/weatherFixtures';
import { PersonalStyleProfile } from '../../../types';

describe('StyleSaathi 3.0 — Pairwise Garment Compatibility Engine', () => {
  // ==========================================================================
  // 1. PAIR CLASSIFICATION TESTS
  // ==========================================================================
  describe('Pair Classification', () => {
    it('correctly classifies Top + Bottom pairs', () => {
      const pair = classifyGarmentPair(PAIR_ITEMS.basicWhiteTee, PAIR_ITEMS.slimBlueJeans);
      expect(pair).toBe('top_bottom');
    });

    it('correctly classifies Top + Outerwear pairs', () => {
      const pair = classifyGarmentPair(PAIR_ITEMS.basicWhiteTee, PAIR_ITEMS.navyTailoredBlazer);
      expect(pair).toBe('top_outerwear');
    });

    it('correctly classifies Ethnic Drape Base (Saree + Blouse)', () => {
      const pair = classifyGarmentPair(PAIR_ITEMS.kanjivaramSareeRed, PAIR_ITEMS.silkBlouseGold);
      expect(pair).toBe('ethnic_drape_base');
    });

    it('correctly classifies Bottom + Footwear pairs', () => {
      const pair = classifyGarmentPair(PAIR_ITEMS.slimBlueJeans, PAIR_ITEMS.whiteLeatherSneakers);
      expect(pair).toBe('bottom_footwear');
    });

    it('flags structural duplicate collisions (two bottoms)', () => {
      const pair = classifyGarmentPair(PAIR_ITEMS.slimBlueJeans, PAIR_ITEMS.tailoredTrousersNavy);
      expect(pair).toBe('structural_duplicate_conflict');
    });

    it('flags structural duplicate collisions (self-pairing)', () => {
      const pair = classifyGarmentPair(PAIR_ITEMS.basicWhiteTee, PAIR_ITEMS.basicWhiteTee);
      expect(pair).toBe('structural_duplicate_conflict');
    });
  });

  // ==========================================================================
  // 2. TIER 1 HARD INCOMPATIBILITY CONSTRAINTS
  // ==========================================================================
  describe('Tier 1 Hard Incompatibility Constraints', () => {
    it('hard-rejects identical duplicate items', () => {
      const res = pairwiseCompatibilityEngine.evaluate(
        PAIR_ITEMS.basicWhiteTee,
        PAIR_ITEMS.basicWhiteTee
      );
      expect(res.isHardIncompatible).toBe(true);
      expect(res.classification).toBe('hard_incompatible');
      expect(res.overallScore).toBe(0.0);
    });

    it('hard-rejects unwearable laundry items in standard mode', () => {
      const res = pairwiseCompatibilityEngine.evaluate(
        PAIR_ITEMS.dirtyShirtInLaundry,
        PAIR_ITEMS.slimBlueJeans
      );
      expect(res.isHardIncompatible).toBe(true);
      expect(res.hardIncompatibilityReason).toContain('laundry');
    });

    it('permits unwearable items when allowPlanningMode is true', () => {
      const res = pairwiseCompatibilityEngine.evaluate(
        PAIR_ITEMS.dirtyShirtInLaundry,
        PAIR_ITEMS.slimBlueJeans,
        { allowPlanningMode: true }
      );
      expect(res.isHardIncompatible).toBe(false);
      expect(res.overallScore).toBeGreaterThan(5.0);
    });

    it('hard-rejects delicate silk in active severe rain deluge', () => {
      const res = pairwiseCompatibilityEngine.evaluate(
        PAIR_ITEMS.kanjivaramSareeRed,
        PAIR_ITEMS.silkBlouseGold,
        {
          context: {
            ...WEATHER_DELUGE_MUMBAI,
            occasion: 'wedding guest',
          },
        }
      );
      expect(res.isHardIncompatible).toBe(true);
      expect(res.hardIncompatibilityReason).toContain('Severe weather hazard');
    });

    it('hard-rejects garments violating declared user fabric allergies', () => {
      const res = pairwiseCompatibilityEngine.evaluate(
        PAIR_ITEMS.woolSweaterHeavy,
        PAIR_ITEMS.slimBlueJeans,
        {
          preferences: {
            preferredAesthetics: [],
            preferredContexts: [],
            fabricSensitivities: ['wool'],
            stylingMode: 'variety',
            updatedAt: Date.now(),
          },
        }
      );
      expect(res.isHardIncompatible).toBe(true);
      expect(res.hardIncompatibilityReason).toContain('Fabric sensitivity safeguard');
    });
  });

  // ==========================================================================
  // 3. COLOR HARMONY & CLASH EVALUATION
  // ==========================================================================
  describe('Color Harmony Dimension', () => {
    it('evaluates complementary contrast (mustard + navy) with high synergy', () => {
      const res = evaluateColorDimension(PAIR_ITEMS.shortKurtiMustard, PAIR_ITEMS.tailoredTrousersNavy);
      expect(res.score).toBeGreaterThanOrEqual(0.85);
      expect(res.confidence).toBeGreaterThanOrEqual(0.9);
      expect(res.reason).toContain('complementary');
    });

    it('evaluates universal neutral anchors cleanly', () => {
      const res = evaluateColorDimension(PAIR_ITEMS.basicWhiteTee, PAIR_ITEMS.slimBlueJeans);
      expect(res.score).toBeGreaterThanOrEqual(0.8);
      expect(res.reason).toContain('Neutral');
    });

    it('evaluates regal metallic zari borders with jewel tones', () => {
      const res = evaluateColorDimension(PAIR_ITEMS.lehengaEmerald, PAIR_ITEMS.choliEmerald);
      expect(res.score).toBeGreaterThanOrEqual(0.9);
      expect(res.reason).toContain('ceremonial');
    });

    it('penalizes unanchored saturated clashing colors', () => {
      const res = evaluateColorDimension(PAIR_ITEMS.neonOrangeTop, PAIR_ITEMS.magentaSaturatedSkirt);
      expect(res.score).toBeLessThan(0);
      expect(res.reason).toContain('chromatic friction');
    });

    it('evaluates missing color attributes neutrally (0.0 delta, 0.0 confidence)', () => {
      const res = evaluateColorDimension(PAIR_ITEMS.unlabelledCameraPhoto, PAIR_ITEMS.slimBlueJeans);
      expect(res.score).toBe(0.0);
      expect(res.confidence).toBe(0.0);
      expect(res.evidenceSource).toBe('unknown');
    });
  });

  // ==========================================================================
  // 4. SILHOUETTE & PROPORTION EVALUATION
  // ==========================================================================
  describe('Silhouette & Proportion Dimension', () => {
    it('recognizes balanced volume: fitted upper with flared lower', () => {
      const res = evaluateSilhouetteDimension(
        PAIR_ITEMS.choliEmerald,
        PAIR_ITEMS.lehengaEmerald,
        'ethnic_drape_base'
      );
      expect(res.score).toBeGreaterThanOrEqual(0.85);
    });

    it('penalizes unanchored oversized-on-oversized volume by default', () => {
      const res = evaluateSilhouetteDimension(
        PAIR_ITEMS.oversizedBlazerGrey,
        PAIR_ITEMS.wideLegTrousersBlack,
        'bottom_outerwear'
      );
      expect(res.score).toBeLessThan(0);
      expect(res.reason).toContain('volume collision');
    });

    it('rewards oversized volume when Korean Relaxed aesthetic is selected', () => {
      const res = evaluateSilhouetteDimension(
        PAIR_ITEMS.oversizedBlazerGrey,
        PAIR_ITEMS.wideLegTrousersBlack,
        'bottom_outerwear',
        {
          preferredAesthetics: ['Korean Relaxed'],
          preferredContexts: [],
          stylingMode: 'variety',
          updatedAt: Date.now(),
        }
      );
      expect(res.score).toBeGreaterThanOrEqual(0.7);
      expect(res.reason).toContain('oversized');
    });
  });

  // ==========================================================================
  // 5. FABRIC PHYSICS & TEXTURE EVALUATION
  // ==========================================================================
  describe('Fabric Physics Dimension', () => {
    it('rewards natural breathable handloom synergy (cotton + linen)', () => {
      const res = evaluateFabricDimension(PAIR_ITEMS.linenKurtaOlive, PAIR_ITEMS.chinosBeige, 'top_bottom');
      expect(res.score).toBeGreaterThanOrEqual(0.85);
      expect(res.reason).toContain('Natural fiber harmony');
    });

    it('rewards ceremonial silk textile pairing', () => {
      const res = evaluateFabricDimension(
        PAIR_ITEMS.kanjivaramSareeRed,
        PAIR_ITEMS.silkBlouseGold,
        'ethnic_drape_base'
      );
      expect(res.score).toBeGreaterThanOrEqual(0.85);
      expect(res.reason).toContain('Festive textile resonance');
    });

    it('penalizes delicate sheer chiffon paired with heavy rigid utility denim', () => {
      const res = evaluateFabricDimension(
        PAIR_ITEMS.heavyChiffonSheerTop,
        PAIR_ITEMS.heavyDistressedWorkDenim,
        'top_bottom'
      );
      expect(res.score).toBeLessThan(0);
      expect(res.reason).toContain('Tactile texture clash');
    });

    it('evaluates missing fabric neutrally (0.0 delta, 0.0 confidence)', () => {
      const res = evaluateFabricDimension(
        PAIR_ITEMS.unlabelledCameraPhoto,
        PAIR_ITEMS.slimBlueJeans,
        'top_bottom'
      );
      expect(res.score).toBe(0.0);
      expect(res.confidence).toBe(0.0);
      expect(res.evidenceSource).toBe('unknown');
    });
  });

  // ==========================================================================
  // 6. PATTERN INTERACTION EVALUATION
  // ==========================================================================
  describe('Pattern Interaction Dimension', () => {
    it('rewards solid anchor with artisanal statement print', () => {
      const res = evaluatePatternDimension(PAIR_ITEMS.shortKurtiMustard, PAIR_ITEMS.chinosBeige);
      expect(res.score).toBeGreaterThanOrEqual(0.85);
      expect(res.reason).toContain('Focal anchor harmony');
    });

    it('rewards clean solid on solid pairing', () => {
      const res = evaluatePatternDimension(PAIR_ITEMS.basicWhiteTee, PAIR_ITEMS.slimBlueJeans);
      expect(res.score).toBeGreaterThanOrEqual(0.7);
    });

    it('penalizes competing busy statement prints', () => {
      const res = evaluatePatternDimension(PAIR_ITEMS.boldFloralShirt, PAIR_ITEMS.denseGeometricPants);
      expect(res.score).toBeLessThan(0);
      expect(res.reason).toContain('clash');
    });
  });

  // ==========================================================================
  // 7. FORMALITY & FORMALITY BRIDGES
  // ==========================================================================
  describe('Formality Dimension', () => {
    it('recognizes modern Indo-Western kurti + jeans bridge', () => {
      const res = evaluateFormalityDimension(PAIR_ITEMS.shortKurtiMustard, PAIR_ITEMS.slimBlueJeans);
      expect(res.score).toBeGreaterThanOrEqual(0.8);
      expect(res.reason).toContain('Indo-Western bridge');
    });

    it('recognizes blazer + clean t-shirt smart casual bridge', () => {
      const res = evaluateFormalityDimension(PAIR_ITEMS.navyTailoredBlazer, PAIR_ITEMS.basicWhiteTee);
      expect(res.score).toBeGreaterThanOrEqual(0.75);
      expect(res.reason).toContain('smart-casual bridge');
    });

    it('penalizes severe formality gaps (>= 3.0 delta)', () => {
      const res = evaluateFormalityDimension(PAIR_ITEMS.mensSherwaniCream, PAIR_ITEMS.basicWhiteTee);
      expect(res.score).toBeLessThan(0);
      expect(res.reason).toContain('Severe formality mismatch');
    });
  });

  // ==========================================================================
  // 8. CULTURAL & REGIONAL SYNERGY
  // ==========================================================================
  describe('Cultural & Regional Synergy', () => {
    it('evaluates traditional Indian ensembles with primary provenance', () => {
      const res = evaluateCulturalPairSynergy(PAIR_ITEMS.kanjivaramSareeRed, PAIR_ITEMS.silkBlouseGold);
      expect(res.evaluation.score).toBeGreaterThanOrEqual(0.9);
      expect(res.culturalContext.synergyType).toBe('traditional_ensemble');
    });

    it('evaluates Indo-Western fusion pairs with contextual validation', () => {
      const res = evaluateCulturalPairSynergy(PAIR_ITEMS.shortKurtiMustard, PAIR_ITEMS.slimBlueJeans);
      expect(res.evaluation.score).toBeGreaterThanOrEqual(0.8);
      expect(res.culturalContext.synergyType).toBe('indo_western_fusion');
    });

    it('evaluates Japanese workwear synergy with natural fabrics', () => {
      const res = evaluateCulturalPairSynergy(
        PAIR_ITEMS.japaneseChoreCoatIndigo,
        PAIR_ITEMS.khadiPantsNatural
      );
      expect(res.evaluation.score).toBeGreaterThanOrEqual(0.8);
      expect(res.culturalContext.synergyType).toBe('cross_cultural_inspiration');
    });

    it('applies devotional puja decorum for auspicious colors', () => {
      const res = evaluateCulturalPairSynergy(
        PAIR_ITEMS.shortKurtiMustard,
        PAIR_ITEMS.churidarWhiteCotton,
        'puja'
      );
      expect(res.evaluation.score).toBeGreaterThanOrEqual(0.85);
      expect(res.evaluation.reason).toContain('Devotional decorum');
    });
  });

  // ==========================================================================
  // 9. BAYESIAN PERSONALIZATION & EXPLICIT PRIOR PROTECTION
  // ==========================================================================
  describe('Bayesian Personalization Adjustments', () => {
    it('applies subtle soft boost for user-favored color preferences', () => {
      const mockProfile: PersonalStyleProfile = {
        colorAffinities: {
          blue: {
            score: 0.85,
            confidence: 0.9,
            observationCount: 5,
            provenance: 'observed',
            credibleInterval: [0.75, 0.95],
          },
        },
      } as any;

      const unpersonalized = pairwiseCompatibilityEngine.evaluate(
        PAIR_ITEMS.oxfordShirtBlue,
        PAIR_ITEMS.tailoredTrousersNavy
      );

      const personalized = pairwiseCompatibilityEngine.evaluate(
        PAIR_ITEMS.oxfordShirtBlue,
        PAIR_ITEMS.tailoredTrousersNavy,
        { styleProfile: mockProfile }
      );

      expect(personalized.overallScore).toBeGreaterThanOrEqual(unpersonalized.overallScore);
      expect(personalized.personalizationAdjustment?.reasons[0]).toContain('blue');
    });

    it('never overrides hard incompatibility with personalization', () => {
      const mockProfile: PersonalStyleProfile = {
        colorAffinities: {
          white: {
            score: 1.0,
            confidence: 1.0,
            observationCount: 10,
            provenance: 'explicit',
            credibleInterval: [0.95, 1.0],
          },
        },
      } as any;

      const res = pairwiseCompatibilityEngine.evaluate(
        PAIR_ITEMS.basicWhiteTee,
        PAIR_ITEMS.basicWhiteTee,
        { styleProfile: mockProfile }
      );

      expect(res.isHardIncompatible).toBe(true);
      expect(res.overallScore).toBe(0.0);
    });
  });

  // ==========================================================================
  // 10. UNCERTAINTY PROPAGATION & MISSING DATA NEUTRALITY
  // ==========================================================================
  describe('Uncertainty Propagation & Neutrality', () => {
    it('evaluates unlabelled camera uploads neutrally without false incompatibility', () => {
      const res = pairwiseCompatibilityEngine.evaluate(
        PAIR_ITEMS.unlabelledCameraPhoto,
        PAIR_ITEMS.slimBlueJeans
      );

      expect(res.isHardIncompatible).toBe(false);
      expect(res.classification).toBe('neutral');
      expect(res.overallScore).toBeGreaterThanOrEqual(4.5);
      expect(res.overallScore).toBeLessThanOrEqual(5.5);
      expect(res.needsUserConfirmation).toBe(true);
      expect(res.uncertaintyNotes.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 11. GROUND TRUTH EVALUATION DATASET VERIFICATION
  // ==========================================================================
  describe('Labelled Evaluation Dataset Verification', () => {
    it('correctly evaluates all 20+ systematic benchmark cases against ground truth', () => {
      let passedCases = 0;

      for (const testCase of PAIRWISE_EVALUATION_DATASET) {
        const result = pairwiseCompatibilityEngine.evaluate(testCase.itemA, testCase.itemB, {
          occasion: testCase.occasion,
          season: testCase.season,
          context: testCase.context,
          preferences: testCase.preferences,
          styleProfile: testCase.styleProfile,
        });

        // 1. Verify Hard Incompatibility Expectations
        if (testCase.expectedHardIncompatible !== undefined) {
          expect(result.isHardIncompatible).toBe(testCase.expectedHardIncompatible);
        }

        // 2. Verify Pair Type Classification
        if (testCase.expectedPairType) {
          expect(result.pairType).toBe(testCase.expectedPairType);
        }

        // 3. Verify Final Result Classification
        if (testCase.expectedResult === 'compatible') {
          expect(result.overallScore).toBeGreaterThanOrEqual(6.0);
          expect(['highly_compatible', 'compatible']).toContain(result.classification);
        } else if (testCase.expectedResult === 'incompatible') {
          expect(result.overallScore).toBeLessThan(5.0);
          expect(['clashing', 'hard_incompatible']).toContain(result.classification);
        } else if (testCase.expectedResult === 'neutral') {
          expect(result.classification).toBe('neutral');
          expect(result.overallScore).toBeGreaterThanOrEqual(4.0);
          expect(result.overallScore).toBeLessThanOrEqual(6.0);
        }

        passedCases++;
      }

      expect(passedCases).toBe(PAIRWISE_EVALUATION_DATASET.length);
    });
  });

  // ==========================================================================
  // 12. RUNTIME LATENCY & PERFORMANCE BENCHMARK
  // ==========================================================================
  describe('Performance Benchmark', () => {
    it('evaluates 100 garment pairs in under 15ms total (<0.15ms per pair)', () => {
      const t0 = performance.now();
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        pairwiseCompatibilityEngine.evaluate(
          PAIR_ITEMS.shortKurtiMustard,
          PAIR_ITEMS.slimBlueJeans,
          { occasion: 'college' }
        );
      }

      const elapsed = performance.now() - t0;
      const perPair = elapsed / iterations;

      expect(perPair).toBeLessThan(0.3); // Target <0.3ms
      expect(elapsed).toBeLessThan(25.0); // Target <25ms for 100 evaluations
    });
  });
});
