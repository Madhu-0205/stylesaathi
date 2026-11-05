import { describe, it, expect } from 'vitest';
import {
  derivePersonalStyleProfile,
  calculatePersonalStyleScore,
  getCombinationKey,
} from '../styleBrain';
import {
  getColorFamily,
  getColorTone,
} from '../features/garmentAttributeModel';
import {
  extractGarmentFeaturesFromImage,
} from '../features/imageFeatureExtractor';
import {
  enrichWardrobeItem,
  getEnrichedAttributeScoreDelta,
} from '../features/featureEnricher';
import {
  WardrobeItem,
  StyleSignalEvent,
  StylePreferences,
  AttributeAffinity,
} from '../../types';

describe('StyleSaathi 3.0 — Phase 2.1: Independent Statistical & Data Integrity Audit', () => {
  const mockTop: WardrobeItem = {
    id: 'top-audit-1',
    name: 'White Cotton Kurta',
    category: 'Ethnic',
    subcategory: 'kurta',
    colors: ['white'],
    seasons: ['summer'],
    occasions: ['college', 'family function'],
    formality: 3,
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 0,
    fabric: 'cotton',
    fit: 'regular',
  };

  const mockBottom: WardrobeItem = {
    id: 'bottom-audit-1',
    name: 'Blue Denim Jeans',
    category: 'Bottoms',
    subcategory: 'jeans',
    colors: ['blue'],
    seasons: ['summer'],
    occasions: ['college', 'casual outing'],
    formality: 2,
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 0,
    fabric: 'denim',
    fit: 'straight',
  };

  const items = [mockTop, mockBottom];

  // ==========================================================================
  // 1. REPEATED INTERACTION SESSION-LEVEL SUBLINEAR DAMPENING
  // ==========================================================================
  describe('1. Repeated-Event and Session-Level Sublinear Dampening', () => {
    it('applies sublinear 1/sqrt(n) dampening to repeated signals on the identical item in a session', () => {
      const now = Date.now();
      // Simulate a user repeatedly liking/selecting the exact same item 5 times in one session
      const signals: StyleSignalEvent[] = Array.from({ length: 5 }, (_, i) => ({
        id: `sig-${i}`,
        userId: 'u1',
        signalType: 'liked', // base weight = 1.0
        itemIds: ['top-audit-1'],
        createdAt: now,
      }));

      const profile = derivePersonalStyleProfile(signals, [], items, undefined, now);
      const topAff = profile.itemAffinities['top-audit-1'];

      expect(topAff).toBeDefined();
      expect(topAff.sampleCount).toBe(5);

      // Theoretical sum of 1/sqrt(k) for k=1..5:
      // 1.0 + 0.7071 + 0.5774 + 0.5000 + 0.4472 ≈ 3.2317
      // If naive un-dampened replication had occurred, effective weight would be 5.0.
      // With Bayesian prior alpha=1, beta=1, effective alpha should be approx 1 + 3.23 ≈ 4.23 (NOT 6.0)
      expect(topAff.alpha).toBeLessThan(5.0);
      expect(topAff.alpha).toBeGreaterThanOrEqual(3.5);
    });
  });

  // ==========================================================================
  // 2. EXPLICIT PREFERENCE PROTECTION AGAINST UNTARGETED DISMISSALS
  // ==========================================================================
  describe('2. Explicit Preference Protection Against Untargeted Card Dismissals', () => {
    it('protects explicit preferred colors from erosion by untargeted outfit dismissals', () => {
      const now = Date.now();
      const declaredPrefs: StylePreferences = {
        preferredColors: ['white'],
        fabricSensitivities: [],
        preferredFits: [],
        preferredAesthetics: [],
        dislikedStyles: [],
        preferredContexts: [],
        stylingMode: 'variety',
        updatedAt: now,
      };

      // User dismisses 3 outfit cards that happen to contain the white piece
      const dismissalSignals: StyleSignalEvent[] = [
        { id: 'd1', userId: 'u1', signalType: 'dismissed', itemIds: ['top-audit-1', 'bottom-audit-1'], createdAt: now },
        { id: 'd2', userId: 'u1', signalType: 'dismissed', itemIds: ['top-audit-1', 'bottom-audit-1'], createdAt: now },
        { id: 'd3', userId: 'u1', signalType: 'dismissed', itemIds: ['top-audit-1', 'bottom-audit-1'], createdAt: now },
      ];

      const profile = derivePersonalStyleProfile(dismissalSignals, [], items, declaredPrefs, now);
      const whiteAff = profile.colorAffinities['white'];

      expect(whiteAff).toBeDefined();
      // Explicit prior (alpha=4.0, beta=1.0) must NOT have been diluted by general outfit dismissals
      expect(whiteAff.status).toBe('explicit');
      expect(whiteAff.score).toBeGreaterThanOrEqual(0.60);
      expect(whiteAff.beta).toBe(1.0); // beta was not inflated by untargeted dismissals
    });

    it('penalizes explicit colors only when an explicit structured rejection reason (wrong_color) is provided', () => {
      const now = Date.now();
      const declaredPrefs: StylePreferences = {
        preferredColors: ['white'],
        fabricSensitivities: [],
        preferredFits: [],
        preferredAesthetics: [],
        dislikedStyles: [],
        preferredContexts: [],
        stylingMode: 'variety',
        updatedAt: now,
      };

      // User explicitly diagnoses: wrong_color
      const targetedRejection: StyleSignalEvent[] = [
        {
          id: 'rej-1',
          userId: 'u1',
          signalType: 'rejected',
          rejectionReason: 'wrong_color',
          itemIds: ['top-audit-1'],
          createdAt: now,
        },
      ];

      const profile = derivePersonalStyleProfile(targetedRejection, [], items, declaredPrefs, now);
      const whiteAff = profile.colorAffinities['white'];

      expect(whiteAff).toBeDefined();
      // Diagnostic rejection correctly applies negative evidence to beta
      expect(whiteAff.beta).toBeGreaterThan(1.0);
    });
  });

  // ==========================================================================
  // 3. COMBINATION REJECTION CREDIT ASSIGNMENT
  // ==========================================================================
  describe('3. Credit Assignment on Combination Rejections', () => {
    it('penalizes the pair combination specifically without degrading individual garment color and fabric', () => {
      const now = Date.now();
      const signals: StyleSignalEvent[] = [
        {
          id: 'combo-rej',
          userId: 'u1',
          signalType: 'rejected',
          rejectionReason: 'dislike_combination',
          itemIds: ['top-audit-1', 'bottom-audit-1'],
          createdAt: now,
        },
      ];

      const profile = derivePersonalStyleProfile(signals, [], items, undefined, now);
      const pairKey = getCombinationKey('top-audit-1', 'bottom-audit-1');

      // The combination receives heavy penalty
      expect(profile.combinationAffinities[pairKey]).toBeDefined();
      expect(profile.combinationAffinities[pairKey].score).toBeLessThan(-0.5);

      // The individual color white and fabric cotton MUST NOT be falsely penalized with a -2.5 rejection weight
      expect(profile.colorAffinities['white'].score).toBe(0);
      expect(profile.fabricAffinities['cotton'].score).toBe(0);
    });
  });

  // ==========================================================================
  // 4. COLOR CLASSIFICATION ROBUSTNESS ON COMPOUND TOKENS
  // ==========================================================================
  describe('4. Color Classification Robustness on Compound Tokens', () => {
    it('correctly maps compound color strings to canonical families and tones', () => {
      expect(getColorFamily('navy blue')).toBe('blues');
      expect(getColorTone('navy blue')).toBe('cool');

      expect(getColorFamily('olive green')).toBe('greens');
      expect(getColorTone('olive green')).toBe('cool');

      expect(getColorFamily('mustard yellow')).toBe('yellows_oranges');
      expect(getColorTone('mustard yellow')).toBe('warm');

      expect(getColorFamily('dark brown')).toBe('earth_tones');
      expect(getColorTone('dark brown')).toBe('warm');

      expect(getColorFamily('charcoal grey')).toBe('neutrals');
      expect(getColorTone('charcoal grey')).toBe('neutral');
    });
  });

  // ==========================================================================
  // 5. TRUTH-IN-AI CAMERA UPLOAD EVALUATION
  // ==========================================================================
  describe('5. Truth-in-AI Evaluation on Real-World Camera Filenames', () => {
    it('correctly reports unknown status, low confidence (<= 0.25), and needsUserConfirmation on camera files', async () => {
      const realCameraFiles = [
        'IMG_20261106_142301.jpg',
        'PXL_20261106_0845.jpg',
        'photo.jpg',
        'camera_upload_9871.png',
      ];

      for (const fn of realCameraFiles) {
        const result = await extractGarmentFeaturesFromImage(fn);
        expect(result.overallConfidence).toBeLessThanOrEqual(0.25);
        expect(result.confidenceLevel).toBe('LOW');
        expect(result.needsUserConfirmation).toBe(true);
        expect(result.fabric).toBeUndefined();
        expect(result.fabricVerificationStatus).toBe('unknown');
        expect(result.materialComposition).toBe('Unspecified fabric composition');
      }
    });
  });

  // ==========================================================================
  // 6. RECOMMENDATION NEUTRALITY & DATA INTEGRITY
  // ==========================================================================
  describe('6. Recommendation Neutrality & Data Integrity', () => {
    it('guarantees 0.0 delta in recommendation score when an attribute is unknown', () => {
      const incompleteItem: WardrobeItem = {
        id: 'inc-1',
        name: 'Incomplete Item',
        category: 'Tops',
        subcategory: 'shirt',
        colors: ['unknown'],
        seasons: ['summer'],
        occasions: ['college'],
        formality: 2,
        status: 'clean',
        favorite: false,
        note: '',
        timesWorn: 0,
        fabric: 'unknown',
      };

      const highNegativeAffinity: AttributeAffinity = {
        score: -0.9,
        confidence: 0.8,
        sampleCount: 10,
        lastInteractedAt: Date.now(),
        status: 'observed',
        alpha: 1,
        beta: 9,
        variance: 0.01,
        uncertainty: 0.2,
        provenance: {
          status: 'observed',
          observationCount: 10,
          alpha: 1,
          beta: 9,
          variance: 0.01,
          uncertainty: 0.2,
          credibleInterval: [-0.95, -0.6],
          signalCounts: {},
          lastInteractedAt: Date.now(),
          isExplicitOverride: false,
        },
      };

      // Unknown fabric MUST NOT trigger the -0.9 penalty
      const delta = getEnrichedAttributeScoreDelta(incompleteItem, 'fabric', highNegativeAffinity);
      expect(delta).toBe(0.0);
    });

    it('preserves user_confirmed attributes during enrichWardrobeItem', () => {
      const userItem: WardrobeItem = {
        id: 'u-1',
        name: 'My Custom Tunic',
        category: 'Ethnic',
        subcategory: 'kurta',
        colors: ['navy'],
        seasons: ['summer'],
        occasions: ['college'],
        formality: 3,
        status: 'clean',
        favorite: false,
        note: '',
        timesWorn: 1,
        fabric: 'silk',
        userVerified: true,
      };

      const enriched = enrichWardrobeItem(userItem);
      expect(enriched.attributeProvenance?.fabric.source).toBe('user_confirmed');
      expect(enriched.attributeProvenance?.fabric.confidence).toBe(1.0);
      expect(enriched.fabricVerificationStatus).toBe('user_confirmed');
    });
  });
});
