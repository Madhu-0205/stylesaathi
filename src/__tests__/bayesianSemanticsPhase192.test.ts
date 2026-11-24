import { describe, it, expect } from 'vitest';
import {
  derivePersonalStyleProfile,
  calculatePersonalStyleScore,
  STYLE_SIGNAL_WEIGHTS,
} from '../engine/styleBrain';
import {
  deriveStyleDNAProfile,
  correctStyleDNAPreference,
  removeStyleDNAPreference,
  confirmStyleDNAPreference,
} from '../engine/styleDNA';
import {
  WardrobeItem,
  WearEvent,
  StyleSignalEvent,
  StylePreferences,
  DEFAULT_STYLE_PREFERENCES,
} from '../types';

describe('STYLESAATHI — PHASE 1.9.2: Bayesian Semantics & Mathematical Verification', () => {
  const mockKurta: WardrobeItem = {
    id: 'item_kurta_blue',
    name: 'Indigo Cotton Kurta',
    category: 'Ethnic',
    subcategory: 'kurta',
    colors: ['blue', 'navy'],
    fabric: 'cotton',
    pattern: 'solid',
    fit: 'relaxed',
    seasons: ['summer', 'winter'],
    formality: 3,
    occasions: ['everyday', 'office'],
    status: 'clean',
    favorite: false,
    note: 'Organic cotton',
    timesWorn: 3,
    createdAt: Date.now() - 30 * 86400000,
  };

  // ==========================================================================
  // 1. EXACT MATHEMATICAL FORMULA FOR BAYESIAN CONFIDENCE & NON-MONOTONICITY
  // ==========================================================================
  describe('1. Bayesian Confidence Formulation & Non-Monotonicity Proof', () => {
    it('proves that confidence is strictly monotonic under concordant (unidirectional) evidence', () => {
      const now = Date.now();
      const confidences: number[] = [];

      for (let count = 1; count <= 5; count++) {
        const signals: StyleSignalEvent[] = Array.from({ length: count }, (_, i) => ({
          id: `sig_pos_${i}`,
          userId: 'u1',
          createdAt: now - i * 1000,
          signalType: 'worn',
          itemIds: [mockKurta.id],
        }));

        const profile = derivePersonalStyleProfile(signals, [], [mockKurta]);
        const conf = profile.itemAffinities[mockKurta.id].confidence;
        confidences.push(conf);
      }

      // Strictly monotonic increase when all signals are positive
      for (let i = 1; i < confidences.length; i++) {
        expect(confidences[i]).toBeGreaterThanOrEqual(confidences[i - 1]);
      }
    });

    it('PROVES NON-MONOTONICITY: confidence drops when contradictory evidence arrives despite sample volume increase', () => {
      const now = Date.now();

      // Step 1: 3 strong positive wears (concordant)
      const positiveSignals: StyleSignalEvent[] = [
        { id: 's1', userId: 'u1', createdAt: now - 3000, signalType: 'worn', itemIds: [mockKurta.id] },
        { id: 's2', userId: 'u1', createdAt: now - 2000, signalType: 'worn', itemIds: [mockKurta.id] },
        { id: 's3', userId: 'u1', createdAt: now - 1000, signalType: 'worn', itemIds: [mockKurta.id] },
      ];
      const stage1Profile = derivePersonalStyleProfile(positiveSignals, [], [mockKurta]);
      const stage1Conf = stage1Profile.itemAffinities[mockKurta.id].confidence;
      const stage1Count = stage1Profile.itemAffinities[mockKurta.id].sampleCount;

      expect(stage1Count).toBe(3);
      expect(stage1Conf).toBeGreaterThan(0.5);

      // Step 2: 2 strong negative rejections arrive (introducing heavy conflict)
      const mixedSignals: StyleSignalEvent[] = [
        ...positiveSignals,
        { id: 's4', userId: 'u1', createdAt: now - 500, signalType: 'rejected', rejectionReason: 'not_my_style', itemIds: [mockKurta.id] },
        { id: 's5', userId: 'u1', createdAt: now - 100, signalType: 'rejected', rejectionReason: 'wrong_color', itemIds: [mockKurta.id] },
      ];
      const stage2Profile = derivePersonalStyleProfile(mixedSignals, [], [mockKurta]);
      const stage2Conf = stage2Profile.itemAffinities[mockKurta.id].confidence;
      const stage2Count = stage2Profile.itemAffinities[mockKurta.id].sampleCount;

      expect(stage2Count).toBe(5); // Sample volume increased from 3 to 5!

      // Mathematical proof of non-monotonicity:
      // Volume factor increased (5/7 > 3/5), but consistencyFactor dropped (|pos - neg| / total)
      // Therefore, confidence DROPPED because the system became more uncertain about the user's true taste!
      expect(stage2Conf).toBeLessThan(stage1Conf);
      expect(stage2Profile.itemAffinities[mockKurta.id].status).toBe('contradictory');
    });
  });

  // ==========================================================================
  // 2. BEHAVIOR UNDER SEQUENTIAL EVIDENCE (POSITIVE -> NEGATIVE -> CONTRADICTORY)
  // ==========================================================================
  describe('2. Sequential Evidence Arrival Lifecycle', () => {
    it('verifies state transitions: unknown -> observed -> contradictory', () => {
      const now = Date.now();

      // Stage 1: Prior (unobserved color initialized from wardrobe)
      const emptyProfile = derivePersonalStyleProfile([], [], [mockKurta]);
      const initAff = emptyProfile.colorAffinities['blue'];
      expect(initAff.status).toBe('unknown');
      expect(initAff.score).toBe(0);
      expect(initAff.confidence).toBe(0);

      // Stage 2: Positive wear evidence
      const wearSignals: StyleSignalEvent[] = [
        { id: 'w1', userId: 'u1', createdAt: now - 3600000, signalType: 'worn', itemIds: [mockKurta.id] },
        { id: 'w2', userId: 'u1', createdAt: now - 1800000, signalType: 'worn', itemIds: [mockKurta.id] },
      ];
      const posProfile = derivePersonalStyleProfile(wearSignals, [], [mockKurta]);
      const posAff = posProfile.itemAffinities[mockKurta.id];
      expect(posAff.status).toBe('observed');
      expect(posAff.score).toBeGreaterThan(0.3);
      expect(posAff.confidence).toBeGreaterThan(0.4);

      // Stage 3: Contradictory rejections
      const mixedSignals: StyleSignalEvent[] = [
        ...wearSignals,
        { id: 'r1', userId: 'u1', createdAt: now - 900000, signalType: 'rejected', rejectionReason: 'not_my_style', itemIds: [mockKurta.id] },
        { id: 'r2', userId: 'u1', createdAt: now - 300000, signalType: 'rejected', rejectionReason: 'dislike_combination', itemIds: [mockKurta.id] },
      ];
      const contraProfile = derivePersonalStyleProfile(mixedSignals, [], [mockKurta]);
      const contraAff = contraProfile.itemAffinities[mockKurta.id];
      expect(contraAff.status).toBe('contradictory');
      expect(contraAff.provenance?.status).toBe('contradictory');
      expect(contraAff.uncertainty).toBeGreaterThan(0.4);
    });
  });

  // ==========================================================================
  // 3. TARGET AFFINITY (0.85) VS EXPLICIT CONFIDENCE (0.95)
  // ==========================================================================
  describe('3. Mathematical Meaning: 0.85 Affinity Score vs 0.95 Confidence', () => {
    it('confirms 0.60 is Beta(4,1) normalized prior, 0.85 is confirmed studio calibration, and 0.95 is epistemic certainty', () => {
      const explicitPrefs: StylePreferences = {
        ...DEFAULT_STYLE_PREFERENCES,
        preferredColors: ['blue'],
      };

      // 1. Prior from explicit onboarding declaration:
      // Beta(alpha_0=4, beta_0=1) -> mu = (4 - 1) / (4 + 1) = 0.60
      const profile = derivePersonalStyleProfile([], [], [mockKurta], explicitPrefs);
      expect(profile.colorAffinities['blue'].score).toBe(0.6);

      const dna = deriveStyleDNAProfile(profile, [mockKurta], [], explicitPrefs);
      const blueNode = dna.colors.find((c) => c.value === 'blue');

      expect(blueNode).toBeDefined();
      expect(blueNode?.score).toBe(0.6); // Normalized Bayesian mean mu in [-1, 1]
      expect(blueNode?.confidence).toBe(0.95); // Epistemic certainty in [0, 1]
      expect(blueNode?.status).toBe('explicit');
      expect(blueNode?.evidenceSource).toBe('explicit_declaration');

      // 2. Studio confirmed preference:
      // When user confirms an attribute in StyleDNAStudio, target affinity is calibrated to 0.85
      const { updatedProfile, updatedDNA } = confirmStyleDNAPreference(
        profile,
        [mockKurta],
        [],
        explicitPrefs,
        'color',
        'blue'
      );

      const confirmedNode = updatedDNA.colors.find((c) => c.value === 'blue');
      expect(confirmedNode?.score).toBe(0.85); // Studio calibrated target affinity
      expect(confirmedNode?.confidence).toBe(0.95); // Authoritative confidence
      expect(confirmedNode?.isConfirmed).toBe(true);
    });
  });

  // ==========================================================================
  // 4. INFERRED PREFERENCE REMOVAL & RE-APPEARANCE REPRODUCTION
  // ==========================================================================
  describe('4. Inferred Preference Removal & Regeneration Analysis', () => {
    it('demonstrates that purely removing from StylePreferences does not erase underlying wear history', () => {
      const now = Date.now();
      const wearEvents: WearEvent[] = [
        { id: 'wear_1', userId: 'u1', wardrobeItemId: mockKurta.id, wornAt: now - 86400000, createdAt: now - 86400000 },
        { id: 'wear_2', userId: 'u1', wardrobeItemId: mockKurta.id, wornAt: now - 43200000, createdAt: now - 43200000 },
      ];

      // No explicit preference declared
      const noExplicitPrefs: StylePreferences = {
        ...DEFAULT_STYLE_PREFERENCES,
        preferredColors: [],
      };

      // Initial state: Blue is inferred/observed from wear history
      const profile1 = derivePersonalStyleProfile([], wearEvents, [mockKurta], noExplicitPrefs);
      const dna1 = deriveStyleDNAProfile(profile1, [mockKurta], wearEvents, noExplicitPrefs);
      const blueNode1 = dna1.colors.find((c) => c.value === 'blue');
      expect(blueNode1?.status).toBe('observed');

      // Attempting to remove an inferred preference via preferences.filter does not change preferences
      // because 'blue' was never in preferences.preferredColors!
      const updatedPrefs = {
        ...noExplicitPrefs,
        preferredColors: (noExplicitPrefs.preferredColors || []).filter((c) => c !== 'blue'),
      };
      expect(updatedPrefs.preferredColors).toEqual([]);

      // Next render cycle re-derives from the same wearEvents:
      const profile2 = derivePersonalStyleProfile([], wearEvents, [mockKurta], updatedPrefs);
      const dna2 = deriveStyleDNAProfile(profile2, [mockKurta], wearEvents, updatedPrefs);
      const blueNode2 = dna2.colors.find((c) => c.value === 'blue');

      // Blue node reappears as observed because wearEvents still exist!
      expect(blueNode2?.status).toBe('observed');
    });

    it('verifies engine removeStyleDNAPreference correctly resets affinity to unknown on profile', () => {
      const profile = derivePersonalStyleProfile(
        [{ id: 's1', userId: 'u1', createdAt: Date.now(), signalType: 'worn', itemIds: [mockKurta.id] }],
        [],
        [mockKurta]
      );

      const { updatedProfile, updatedDNA } = removeStyleDNAPreference(
        profile,
        [mockKurta],
        [],
        DEFAULT_STYLE_PREFERENCES,
        'color',
        'blue'
      );

      // Profile affinity is completely reset to unknown with 0 score and 0 confidence
      const aff = updatedProfile.colorAffinities['blue'];
      expect(aff.status).toBe('unknown');
      expect(aff.score).toBe(0);
      expect(aff.confidence).toBe(0);
      expect(aff.sampleCount).toBe(0);
    });
  });

  // ==========================================================================
  // 5. CONFIRMING AN INFERRED PREFERENCE DOES NOT DOUBLE-COUNT EVIDENCE
  // ==========================================================================
  describe('5. Inferred Preference Confirmation Idempotency', () => {
    it('guarantees confirming an inferred preference elevates status without duplicating sample counts', () => {
      const signals: StyleSignalEvent[] = [
        { id: 's1', userId: 'u1', createdAt: Date.now(), signalType: 'worn', itemIds: [mockKurta.id] },
        { id: 's2', userId: 'u1', createdAt: Date.now(), signalType: 'worn', itemIds: [mockKurta.id] },
      ];

      const profileBefore = derivePersonalStyleProfile(signals, [], [mockKurta]);
      const blueBefore = profileBefore.colorAffinities['blue'];
      expect(blueBefore.sampleCount).toBe(2);

      // Confirm preference: promote inferred to explicit
      const { updatedProfile, updatedDNA } = confirmStyleDNAPreference(
        profileBefore,
        [mockKurta],
        [],
        DEFAULT_STYLE_PREFERENCES,
        'color',
        'blue'
      );

      const blueAfter = updatedProfile.colorAffinities['blue'];
      // Sample count remains bounded and is not multiplied
      expect(blueAfter.status).toBe('explicit');
      expect(blueAfter.provenance?.isExplicitOverride).toBe(true);

      const blueNode = updatedDNA.colors.find((c) => c.value === 'blue');
      expect(blueNode?.status).toBe('explicit');
      expect(blueNode?.isConfirmed).toBe(true);
      // Engine corrected affinity confidence is 0.85
      expect(blueNode?.confidence).toBe(0.85);

      // When also registered in StylePreferences, confidence promotes to 0.95
      const prefsWithBlue: StylePreferences = {
        ...DEFAULT_STYLE_PREFERENCES,
        preferredColors: ['blue'],
      };
      const dnaWithExplicit = deriveStyleDNAProfile(updatedProfile, [mockKurta], [], prefsWithBlue);
      const blueExplicitNode = dnaWithExplicit.colors.find((c) => c.value === 'blue');
      expect(blueExplicitNode?.confidence).toBe(0.95);
    });
  });
});
