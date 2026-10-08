import { describe, it, expect } from 'vitest';
import {
  derivePersonalStyleProfile,
  calculatePersonalStyleScore,
  getPersonalStyleExplanations,
  calculateRecencyWeight,
  getCombinationKey,
  STYLE_SIGNAL_WEIGHTS,
  RECENCY_HALF_LIFE_DAYS,
  MIN_EVIDENCE_COUNT,
  STYLE_BRAIN_VERSION,
} from '../styleBrain';
import {
  WardrobeItem,
  StyleSignalEvent,
  WearEvent,
  StylePreferences,
} from '../../types';

describe('Personal Style Brain Domain Intelligence Engine', () => {
  const mockItemTop: WardrobeItem = {
    id: 'top-1',
    name: 'Handloom Cotton Kurta',
    category: 'Ethnic',
    subcategory: 'kurta',
    colors: ['white', 'blue'],
    seasons: ['summer'],
    occasions: ['college', 'casual outing'],
    formality: 2,
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 3,
    fabric: 'cotton',
    pattern: 'solid',
    fit: 'relaxed',
  };

  const mockItemBottom: WardrobeItem = {
    id: 'bottom-1',
    name: 'Slim Indigo Jeans',
    category: 'Bottoms',
    subcategory: 'jeans',
    colors: ['blue'],
    seasons: ['summer', 'monsoon'],
    occasions: ['college', 'casual outing'],
    formality: 2,
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 2,
    fabric: 'denim',
    pattern: 'solid',
    fit: 'slim',
  };

  const mockItemFormalTop: WardrobeItem = {
    id: 'top-formal-1',
    name: 'Heavy Silk Sherwani',
    category: 'Ethnic',
    subcategory: 'sherwani',
    colors: ['gold', 'red'],
    seasons: ['winter'],
    occasions: ['wedding guest'],
    formality: 5,
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 0,
    fabric: 'banarasi',
    pattern: 'zari_brocade',
    fit: 'tailored',
  };

  const mockItems = [mockItemTop, mockItemBottom, mockItemFormalTop];

  describe('1. Centralized Signal Weights and Constants', () => {
    it('provides deterministic, documented signal weights for all supported actions', () => {
      expect(STYLE_SIGNAL_WEIGHTS.worn).toBe(3.0);
      expect(STYLE_SIGNAL_WEIGHTS.favorited).toBe(2.0);
      expect(STYLE_SIGNAL_WEIGHTS.saved).toBe(1.5);
      expect(STYLE_SIGNAL_WEIGHTS.planned).toBe(1.2);
      expect(STYLE_SIGNAL_WEIGHTS.liked).toBe(1.0);
      expect(STYLE_SIGNAL_WEIGHTS.viewed).toBe(0.1);
      expect(STYLE_SIGNAL_WEIGHTS.skipped).toBe(-0.5);
      expect(STYLE_SIGNAL_WEIGHTS.dismissed).toBe(-1.0);
      expect(STYLE_SIGNAL_WEIGHTS.rejected).toBe(-2.5);
    });

    it('enforces a positive version identifier for style profile evolution', () => {
      expect(STYLE_BRAIN_VERSION).toBeGreaterThanOrEqual(3);
    });
  });

  describe('2. Recency Weighting & Exponential Half-Life Decay', () => {
    it('gives full weight (1.0) to current events', () => {
      const now = Date.now();
      expect(calculateRecencyWeight(now, now)).toBe(1.0);
    });

    it('decays to approximately 0.5 after exactly one half-life period (30 days)', () => {
      const now = Date.now();
      const thirtyDaysAgo = now - RECENCY_HALF_LIFE_DAYS * 24 * 60 * 60 * 1000;
      const weight = calculateRecencyWeight(thirtyDaysAgo, now);
      expect(weight).toBeCloseTo(0.5, 2);
    });

    it('decays to approximately 0.25 after two half-life periods (60 days)', () => {
      const now = Date.now();
      const sixtyDaysAgo = now - 2 * RECENCY_HALF_LIFE_DAYS * 24 * 60 * 60 * 1000;
      const weight = calculateRecencyWeight(sixtyDaysAgo, now);
      expect(weight).toBeCloseTo(0.25, 2);
    });

    it('does not rewrite historical events while computing decayed affinity', () => {
      const now = Date.now();
      const event: StyleSignalEvent = {
        id: 'sig-1',
        userId: 'u1',
        signalType: 'worn',
        itemIds: ['top-1'],
        createdAt: now - 30 * 24 * 60 * 60 * 1000,
      };

      const originalTimestamp = event.createdAt;
      derivePersonalStyleProfile([event], [], mockItems, undefined, now);
      expect(event.createdAt).toBe(originalTimestamp); // Immutable historical contract
    });
  });

  describe('3. Cold Start and Evidence Thresholds', () => {
    it('returns zero overall confidence and no fake personalization for cold start users with < 3 signals', () => {
      const profile = derivePersonalStyleProfile([], [], mockItems);
      expect(profile.totalSignalsCount).toBe(0);
      expect(profile.overallConfidence).toBe(0);
      expect(profile.topColors).toEqual([]);
      expect(profile.topFabrics).toEqual([]);
      expect(profile.avoidedColors).toEqual([]);

      // Personal style score delta must be 0 for cold start
      const scoreDelta = calculatePersonalStyleScore([mockItemTop, mockItemBottom], 'college', profile);
      expect(scoreDelta).toBe(0);

      // Must never fabricate reasons
      const reasons = getPersonalStyleExplanations([mockItemTop, mockItemBottom], 'college', profile);
      expect(reasons).toEqual([]);
    });

    it('requires at least MIN_EVIDENCE_COUNT before establishing moderate confidence', () => {
      const now = Date.now();
      const twoSignals: StyleSignalEvent[] = [
        { id: '1', userId: 'u1', signalType: 'worn', itemIds: ['top-1'], createdAt: now },
        { id: '2', userId: 'u1', signalType: 'saved', itemIds: ['top-1'], createdAt: now },
      ];
      const profileLow = derivePersonalStyleProfile(twoSignals, [], mockItems, undefined, now);
      expect(profileLow.totalSignalsCount).toBe(2);
      expect(profileLow.overallConfidence).toBe(0); // Under minimum evidence threshold

      const threeSignals: StyleSignalEvent[] = [
        ...twoSignals,
        { id: '3', userId: 'u1', signalType: 'worn', itemIds: ['top-1'], createdAt: now },
      ];
      const profileModerate = derivePersonalStyleProfile(threeSignals, [], mockItems, undefined, now);
      expect(profileModerate.totalSignalsCount).toBe(3);
      expect(profileModerate.overallConfidence).toBeGreaterThan(0.2);
    });
  });

  describe('4. Positive Feedback Learning & Attribute Affinities', () => {
    it('learns high affinity for colors, fabrics, and fits when repeatedly worn and saved', () => {
      const now = Date.now();
      const signals: StyleSignalEvent[] = [
        { id: 's1', userId: 'u1', signalType: 'worn', itemIds: ['top-1', 'bottom-1'], createdAt: now },
        { id: 's2', userId: 'u1', signalType: 'saved', itemIds: ['top-1', 'bottom-1'], createdAt: now },
        { id: 's3', userId: 'u1', signalType: 'favorited', itemIds: ['top-1'], createdAt: now },
        { id: 's4', userId: 'u1', signalType: 'worn', itemIds: ['top-1', 'bottom-1'], createdAt: now },
      ];

      const profile = derivePersonalStyleProfile(signals, [], mockItems, undefined, now);
      expect(profile.totalSignalsCount).toBe(4);
      expect(profile.overallConfidence).toBeGreaterThan(0.4);

      // Cotton and denim should have positive affinity
      expect(profile.fabricAffinities.cotton.score).toBeGreaterThan(0.5);
      expect(profile.fabricAffinities.denim.score).toBeGreaterThan(0.5);

      // Relaxed fit should have positive affinity
      expect(profile.fitAffinities.relaxed.score).toBeGreaterThan(0.5);

      // Blue and white should be in topColors
      expect(profile.topColors).toContain('blue');
      expect(profile.topFabrics).toContain('cotton');
    });

    it('seamlessly integrates historical WearEvents as behavioral positive evidence', () => {
      const now = Date.now();
      const wearEvents: WearEvent[] = [
        { id: 'w1', userId: 'u1', wardrobeItemId: 'top-1', wornAt: now, createdAt: now },
        { id: 'w2', userId: 'u1', wardrobeItemId: 'top-1', wornAt: now, createdAt: now },
        { id: 'w3', userId: 'u1', wardrobeItemId: 'top-1', wornAt: now, createdAt: now },
      ];

      const profile = derivePersonalStyleProfile([], wearEvents, mockItems, undefined, now);
      expect(profile.totalSignalsCount).toBe(3);
      expect(profile.itemAffinities['top-1'].score).toBe(1.0);
      expect(profile.fabricAffinities.cotton.score).toBe(1.0);
    });
  });

  describe('5. Negative Feedback & Rejection Reason Context Routing', () => {
    it('distinguishes weak negative (skipped), medium (dismissed), and strong (rejected)', () => {
      expect(STYLE_SIGNAL_WEIGHTS.skipped).toBeGreaterThan(STYLE_SIGNAL_WEIGHTS.dismissed);
      expect(STYLE_SIGNAL_WEIGHTS.dismissed).toBeGreaterThan(STYLE_SIGNAL_WEIGHTS.rejected);
    });

    it('penalizes heavy fabrics and boosts breathable fabrics when rejected for too_hot', () => {
      const now = Date.now();
      const signals: StyleSignalEvent[] = [
        {
          id: 'r1',
          userId: 'u1',
          signalType: 'rejected',
          rejectionReason: 'too_hot',
          itemIds: ['top-formal-1'], // banarasi fabric
          createdAt: now,
        },
        {
          id: 'r2',
          userId: 'u1',
          signalType: 'rejected',
          rejectionReason: 'too_hot',
          itemIds: ['top-formal-1'],
          createdAt: now,
        },
        {
          id: 'r3',
          userId: 'u1',
          signalType: 'worn',
          itemIds: ['top-1'], // cotton fabric
          createdAt: now,
        },
      ];

      const profile = derivePersonalStyleProfile(signals, [], mockItems, undefined, now);
      expect(profile.fabricAffinities.banarasi.score).toBeLessThan(-0.5);
      expect(profile.avoidedFabrics).toContain('banarasi');
      expect(profile.fabricAffinities.cotton.score).toBeGreaterThan(0.5);
    });

    it('penalizes non-neutral colors when rejected for wrong_color', () => {
      const now = Date.now();
      const signals: StyleSignalEvent[] = [
        {
          id: 'r1',
          userId: 'u1',
          signalType: 'rejected',
          rejectionReason: 'wrong_color',
          itemIds: ['top-formal-1'], // red, gold
          createdAt: now,
        },
        {
          id: 'r2',
          userId: 'u1',
          signalType: 'rejected',
          rejectionReason: 'wrong_color',
          itemIds: ['top-formal-1'],
          createdAt: now,
        },
        {
          id: 's1',
          userId: 'u1',
          signalType: 'worn',
          itemIds: ['top-1'],
          createdAt: now,
        },
      ];

      const profile = derivePersonalStyleProfile(signals, [], mockItems, undefined, now);
      expect(profile.colorAffinities.red.score).toBeLessThan(-0.3);
      expect(profile.avoidedColors).toContain('red');
    });

    it('biases formality downwards when rejected for too_formal', () => {
      const now = Date.now();
      const signals: StyleSignalEvent[] = [
        {
          id: 'r1',
          userId: 'u1',
          signalType: 'rejected',
          rejectionReason: 'too_formal',
          itemIds: ['top-formal-1'],
          createdAt: now,
        },
        {
          id: 'r2',
          userId: 'u1',
          signalType: 'rejected',
          rejectionReason: 'too_formal',
          itemIds: ['top-formal-1'],
          createdAt: now,
        },
        {
          id: 's1',
          userId: 'u1',
          signalType: 'worn',
          itemIds: ['top-1'],
          createdAt: now,
        },
      ];

      const profile = derivePersonalStyleProfile(signals, [], mockItems, undefined, now);
      expect(profile.formalityBias).toBeLessThan(0);
    });
  });

  describe('6. Pairwise Combination Affinity & Avoidance', () => {
    it('generates commutative pair keys regardless of parameter order', () => {
      const key1 = getCombinationKey('item-A', 'item-B');
      const key2 = getCombinationKey('item-B', 'item-A');
      expect(key1).toBe('item-A:item-B');
      expect(key2).toBe('item-A:item-B');
    });

    it('learns positive combination affinity when two pieces are worn together', () => {
      const now = Date.now();
      const signals: StyleSignalEvent[] = [
        { id: '1', userId: 'u1', signalType: 'worn', itemIds: ['top-1', 'bottom-1'], createdAt: now },
        { id: '2', userId: 'u1', signalType: 'worn', itemIds: ['top-1', 'bottom-1'], createdAt: now },
        { id: '3', userId: 'u1', signalType: 'saved', itemIds: ['top-1', 'bottom-1'], createdAt: now },
      ];

      const profile = derivePersonalStyleProfile(signals, [], mockItems, undefined, now);
      const pairKey = getCombinationKey('top-1', 'bottom-1');
      expect(profile.combinationAffinities[pairKey].score).toBeGreaterThan(0.7);
    });

    it('penalizes combination when explicitly rejected with dislike_combination', () => {
      const now = Date.now();
      const signals: StyleSignalEvent[] = [
        {
          id: '1',
          userId: 'u1',
          signalType: 'rejected',
          rejectionReason: 'dislike_combination',
          itemIds: ['top-1', 'bottom-1'],
          createdAt: now,
        },
        { id: '2', userId: 'u1', signalType: 'worn', itemIds: ['top-1'], createdAt: now },
        { id: '3', userId: 'u1', signalType: 'worn', itemIds: ['top-1'], createdAt: now },
      ];

      const profile = derivePersonalStyleProfile(signals, [], mockItems, undefined, now);
      const pairKey = getCombinationKey('top-1', 'bottom-1');
      expect(profile.combinationAffinities[pairKey].score).toBeLessThan(-0.5);
      expect(profile.avoidedCombinations).toContain(pairKey);
    });
  });

  describe('7. Personal Style Scoring Integration', () => {
    it('boosts outfits aligned with preferred colors, fabrics, and silhouette', () => {
      const now = Date.now();
      const positiveSignals: StyleSignalEvent[] = [
        { id: '1', userId: 'u1', signalType: 'worn', itemIds: ['top-1', 'bottom-1'], createdAt: now },
        { id: '2', userId: 'u1', signalType: 'worn', itemIds: ['top-1', 'bottom-1'], createdAt: now },
        { id: '3', userId: 'u1', signalType: 'saved', itemIds: ['top-1', 'bottom-1'], createdAt: now },
        { id: '4', userId: 'u1', signalType: 'favorited', itemIds: ['top-1'], createdAt: now },
      ];

      const profile = derivePersonalStyleProfile(positiveSignals, [], mockItems, undefined, now);
      const score = calculatePersonalStyleScore([mockItemTop, mockItemBottom], 'college', profile);
      expect(score).toBeGreaterThan(1.0);
    });

    it('penalizes candidate outfits containing avoided fabrics or combinations', () => {
      const now = Date.now();
      const signals: StyleSignalEvent[] = [
        {
          id: '1',
          userId: 'u1',
          signalType: 'rejected',
          rejectionReason: 'too_hot',
          itemIds: ['top-formal-1'],
          createdAt: now,
        },
        {
          id: '2',
          userId: 'u1',
          signalType: 'rejected',
          rejectionReason: 'too_hot',
          itemIds: ['top-formal-1'],
          createdAt: now,
        },
        { id: '3', userId: 'u1', signalType: 'worn', itemIds: ['top-1'], createdAt: now },
      ];

      const profile = derivePersonalStyleProfile(signals, [], mockItems, undefined, now);
      const score = calculatePersonalStyleScore([mockItemFormalTop], 'wedding guest', profile);
      expect(score).toBeLessThan(-0.5);
    });

    it('respects explicit user preferences as authoritative overrides over learned negatives', () => {
      const now = Date.now();
      const negativeEthnicSignals: StyleSignalEvent[] = [
        { id: '1', userId: 'u1', signalType: 'dismissed', itemIds: ['top-1'], createdAt: now },
        { id: '2', userId: 'u1', signalType: 'dismissed', itemIds: ['top-1'], createdAt: now },
        { id: '3', userId: 'u1', signalType: 'skipped', itemIds: ['top-1'], createdAt: now },
      ];

      const profile = derivePersonalStyleProfile(negativeEthnicSignals, [], mockItems, undefined, now);
      const declaredPrefs: StylePreferences = {
        preferredContexts: ['Everyday'],
        preferredAesthetics: ['Traditional'], // Explicit user declared desire
        stylingMode: 'variety',
        updatedAt: now,
      };

      const score = calculatePersonalStyleScore([mockItemTop], 'everyday', profile, declaredPrefs);
      // Explicit preference override elevates score to positive
      expect(score).toBeGreaterThanOrEqual(0.4);
    });
  });

  describe('8. Explainability & Evidence Integrity', () => {
    it('returns honest, evidence-backed editorial explanations when high confidence exists', () => {
      const now = Date.now();
      const signals: StyleSignalEvent[] = [
        { id: '1', userId: 'u1', signalType: 'worn', itemIds: ['top-1', 'bottom-1'], createdAt: now },
        { id: '2', userId: 'u1', signalType: 'worn', itemIds: ['top-1', 'bottom-1'], createdAt: now },
        { id: '3', userId: 'u1', signalType: 'worn', itemIds: ['top-1', 'bottom-1'], createdAt: now },
        { id: '4', userId: 'u1', signalType: 'saved', itemIds: ['top-1', 'bottom-1'], createdAt: now },
      ];

      const profile = derivePersonalStyleProfile(signals, [], mockItems, undefined, now);
      const explanations = getPersonalStyleExplanations([mockItemTop, mockItemBottom], 'college', profile);

      expect(explanations.length).toBeGreaterThan(0);
      const text = explanations.join(' ');
      expect(text).toMatch(/cotton|relaxed|frequently/i);
    });

    it('never fabricates reasons if confidence is low', () => {
      const explanations = getPersonalStyleExplanations([mockItemTop], 'college', undefined);
      expect(explanations).toEqual([]);
    });
  });
});
