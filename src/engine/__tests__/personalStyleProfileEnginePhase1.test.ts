import { describe, it, expect } from 'vitest';
import {
  derivePersonalStyleProfile,
  calculatePersonalStyleScore,
  getPersonalStyleExplanations,
  calculateRecencyWeight,
  correctPreference,
  migrateStyleProfile,
  STYLE_SIGNAL_WEIGHTS,
  RECENCY_HALF_LIFE_DAYS,
  STYLE_BRAIN_VERSION,
} from '../styleBrain';
import {
  WardrobeItem,
  StyleSignalEvent,
  WearEvent,
  StylePreferences,
  PersonalStyleProfile,
} from '../../types';
import { styleSignalsRepository } from '../../repositories/LocalStorageStyleSignalsRepository';

describe('StyleSaathi 3.0 — Phase 1: Personal Style Profile Engine', () => {
  const whiteCottonKurta: WardrobeItem = {
    id: 'item-white-kurta',
    name: 'White Khadi Cotton Kurta',
    category: 'Ethnic',
    subcategory: 'kurta',
    colors: ['white'],
    seasons: ['summer'],
    occasions: ['college', 'casual outing', 'puja'],
    formality: 2,
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 0,
    fabric: 'cotton',
    pattern: 'solid',
    fit: 'relaxed',
  };

  const blueSlimJeans: WardrobeItem = {
    id: 'item-blue-jeans',
    name: 'Blue Slim Denim Jeans',
    category: 'Bottoms',
    subcategory: 'jeans',
    colors: ['blue'],
    seasons: ['summer', 'monsoon'],
    occasions: ['college', 'casual outing'],
    formality: 2,
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 0,
    fabric: 'denim',
    pattern: 'solid',
    fit: 'slim',
  };

  const silkSherwani: WardrobeItem = {
    id: 'item-silk-sherwani',
    name: 'Opulent Silk Sherwani',
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

  const wardrobe = [whiteCottonKurta, blueSlimJeans, silkSherwani];

  // --------------------------------------------------------------------------
  // TEST 1: NEW USER WITH ZERO PREFERENCE HISTORY (COLD START)
  // --------------------------------------------------------------------------
  describe('1. New User with Zero Preference History (Cold Start)', () => {
    it('initializes a clean uninformative prior state with zero confidence and full uncertainty', () => {
      const profile = derivePersonalStyleProfile([], [], wardrobe);

      expect(profile.version).toBe(STYLE_BRAIN_VERSION);
      expect(profile.totalSignalsCount).toBe(0);
      expect(profile.overallConfidence).toBe(0);
      expect(profile.topColors).toEqual([]);
      expect(profile.topFabrics).toEqual([]);
      expect(profile.avoidedColors).toEqual([]);
      expect(profile.avoidedFabrics).toEqual([]);

      // Test attribute status on unobserved dimensions
      const whiteAff = profile.colorAffinities.white;
      expect(whiteAff).toBeDefined();
      expect(whiteAff.status).toBe('unknown');
      expect(whiteAff.score).toBe(0);
      expect(whiteAff.confidence).toBe(0);
      expect(whiteAff.uncertainty).toBe(1.0);
      expect(whiteAff.sampleCount).toBe(0);
      expect(whiteAff.provenance?.credibleInterval).toEqual([-0.95, 0.95]);

      // Cold start score contribution must strictly be 0
      const score = calculatePersonalStyleScore([whiteCottonKurta, blueSlimJeans], 'college', profile);
      expect(score).toBe(0);

      // Must never hallucinate editorial reasons
      const reasons = getPersonalStyleExplanations([whiteCottonKurta], 'college', profile);
      expect(reasons).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // TEST 2: ONE EXPLICIT PREFERENCE
  // --------------------------------------------------------------------------
  describe('2. One Explicit User Preference', () => {
    it('sets an informative prior for declared preference without fake behavioral inflation', () => {
      const declaredPrefs: StylePreferences = {
        preferredContexts: ['Everyday'],
        preferredAesthetics: ['Traditional'],
        preferredColors: ['blue'],
        preferredFits: ['relaxed'],
        fabricSensitivities: ['wool'],
        stylingMode: 'variety',
        updatedAt: Date.now(),
      };

      const profile = derivePersonalStyleProfile([], [], wardrobe, declaredPrefs);

      // Explicit preferred color 'blue'
      const blueAff = profile.colorAffinities.blue;
      expect(blueAff).toBeDefined();
      expect(blueAff.status).toBe('explicit');
      expect(blueAff.score).toBeGreaterThan(0.5); // Informative Beta(4, 1) -> (4-1)/5 = 0.6
      expect(blueAff.provenance?.alpha).toBeGreaterThanOrEqual(4.0);
      expect(blueAff.provenance?.beta).toBe(1.0);
      expect(blueAff.provenance?.isExplicitOverride).toBe(true);

      // Explicit fabric sensitivity 'wool'
      const woolAff = profile.fabricAffinities.wool;
      expect(woolAff).toBeDefined();
      expect(woolAff.status).toBe('explicit');
      expect(woolAff.score).toBeLessThan(-0.7); // Negative Beta(0.5, 6) -> (0.5-6)/6.5 ≈ -0.85
      expect(woolAff.provenance?.beta).toBeGreaterThanOrEqual(6.0);

      // Explicit preferred fit 'relaxed'
      const relaxedAff = profile.fitAffinities.relaxed;
      expect(relaxedAff.status).toBe('explicit');
      expect(relaxedAff.score).toBeGreaterThan(0.5);

      // Other unmentioned attributes remain unknown
      expect(profile.colorAffinities.yellow?.status ?? 'unknown').toBe('unknown');
    });
  });

  // --------------------------------------------------------------------------
  // TEST 3: REPEATED POSITIVE EVIDENCE
  // --------------------------------------------------------------------------
  describe('3. Repeated Positive Evidence', () => {
    it('asymptotically converges to high confidence and narrows Bayesian credible interval', () => {
      const now = Date.now();
      const signals: StyleSignalEvent[] = [
        { id: '1', userId: 'u1', signalType: 'worn', itemIds: ['item-white-kurta'], createdAt: now },
        { id: '2', userId: 'u1', signalType: 'worn', itemIds: ['item-white-kurta'], createdAt: now },
        { id: '3', userId: 'u1', signalType: 'favorited', itemIds: ['item-white-kurta'], createdAt: now },
        { id: '4', userId: 'u1', signalType: 'saved', itemIds: ['item-white-kurta'], createdAt: now },
      ];

      const profile = derivePersonalStyleProfile(signals, [], wardrobe, undefined, now);

      expect(profile.totalSignalsCount).toBe(4);
      expect(profile.overallConfidence).toBeGreaterThan(0.4);

      const cottonAff = profile.fabricAffinities.cotton;
      expect(cottonAff.status).toBe('observed');
      expect(cottonAff.score).toBe(1.0); // 100% positive evidence
      expect(cottonAff.confidence).toBeGreaterThanOrEqual(0.5);
      expect(cottonAff.uncertainty).toBeLessThanOrEqual(0.5);
      expect(cottonAff.provenance?.alpha).toBeGreaterThan(5.0);
      expect(cottonAff.provenance?.beta).toBe(1.0);

      // Credible interval must be tight and bounded near top
      const [lScore, uScore] = cottonAff.provenance?.credibleInterval || [0, 0];
      expect(lScore).toBeGreaterThan(0.3);
      expect(uScore).toBeLessThanOrEqual(1.0);
    });
  });

  // --------------------------------------------------------------------------
  // TEST 4: REPEATED NEGATIVE EVIDENCE
  // --------------------------------------------------------------------------
  describe('4. Repeated Negative Evidence', () => {
    it('learns high-confidence avoidance when pieces are explicitly rejected with reasons', () => {
      const now = Date.now();
      const signals: StyleSignalEvent[] = [
        {
          id: '1',
          userId: 'u1',
          signalType: 'rejected',
          rejectionReason: 'too_hot',
          itemIds: ['item-silk-sherwani'], // banarasi fabric
          createdAt: now,
        },
        {
          id: '2',
          userId: 'u1',
          signalType: 'rejected',
          rejectionReason: 'too_hot',
          itemIds: ['item-silk-sherwani'],
          createdAt: now,
        },
        {
          id: '3',
          userId: 'u1',
          signalType: 'rejected',
          rejectionReason: 'wrong_color',
          itemIds: ['item-silk-sherwani'], // gold, red
          createdAt: now,
        },
      ];

      const profile = derivePersonalStyleProfile(signals, [], wardrobe, undefined, now);

      // Banarasi fabric should be explicitly avoided
      expect(profile.fabricAffinities.banarasi.score).toBeLessThan(-0.5);
      expect(profile.avoidedFabrics).toContain('banarasi');
      expect(profile.fabricAffinities.banarasi.status).toBe('observed');

      // Red color should be penalized
      expect(profile.colorAffinities.red.score).toBeLessThan(-0.3);
      expect(profile.avoidedColors).toContain('red');
    });
  });

  // --------------------------------------------------------------------------
  // TEST 5: CONTRADICTORY FEEDBACK
  // --------------------------------------------------------------------------
  describe('5. Contradictory Feedback', () => {
    it('correctly classifies status as contradictory with wide variance and reduced confidence', () => {
      const now = Date.now();
      const signals: StyleSignalEvent[] = [
        // Two positive wear events
        { id: '1', userId: 'u1', signalType: 'worn', itemIds: ['item-blue-jeans'], createdAt: now },
        { id: '2', userId: 'u1', signalType: 'worn', itemIds: ['item-blue-jeans'], createdAt: now },
        // Two explicit negative rejections
        { id: '3', userId: 'u1', signalType: 'rejected', rejectionReason: 'not_my_style', itemIds: ['item-blue-jeans'], createdAt: now },
        { id: '4', userId: 'u1', signalType: 'rejected', rejectionReason: 'uncomfortable', itemIds: ['item-blue-jeans'], createdAt: now },
      ];

      const profile = derivePersonalStyleProfile(signals, [], wardrobe, undefined, now);
      const denimAff = profile.fabricAffinities.denim;

      expect(denimAff).toBeDefined();
      expect(denimAff.status).toBe('contradictory');
      // Balance is near 0, so score is close to 0
      expect(Math.abs(denimAff.score)).toBeLessThan(0.4);
      // Variance should be elevated due to competing pseudo-counts
      expect(denimAff.variance).toBeGreaterThan(0.01);
      // Credible interval spans across negative and positive territory
      const [lScore, uScore] = denimAff.provenance?.credibleInterval || [0, 0];
      expect(lScore).toBeLessThan(0);
      expect(uScore).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // TEST 6: OLD VERSUS RECENT FEEDBACK (EXPONENTIAL RECENCY DECAY)
  // --------------------------------------------------------------------------
  describe('6. Old Versus Recent Feedback (Decay Dynamics)', () => {
    it('downweights 60-day-old signals to ~25% while fresh signals retain 100% influence', () => {
      const now = Date.now();
      const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;

      // Old negative signal 60 days ago
      const oldNegative: StyleSignalEvent = {
        id: 'old-1',
        userId: 'u1',
        signalType: 'rejected',
        rejectionReason: 'wrong_color',
        itemIds: ['item-white-kurta'], // white
        createdAt: now - sixtyDaysMs,
      };

      // Fresh positive wear today
      const freshPositive: StyleSignalEvent = {
        id: 'fresh-1',
        userId: 'u1',
        signalType: 'worn',
        itemIds: ['item-white-kurta'], // white
        createdAt: now,
      };

      const profile = derivePersonalStyleProfile([oldNegative, freshPositive], [], wardrobe, undefined, now);
      const whiteAff = profile.colorAffinities.white;

      // Fresh wear (weight = 3.0 * 1.0 = 3.0) dominates decayed rejection (-2.5 * 0.25 ≈ -0.625)
      expect(whiteAff.score).toBeGreaterThan(0.5);
      expect(whiteAff.provenance?.alpha).toBeGreaterThan(whiteAff.provenance?.beta || 0);
    });
  });

  // --------------------------------------------------------------------------
  // TEST 7: CONTEXT-SPECIFIC PREFERENCES
  // --------------------------------------------------------------------------
  describe('7. Context-Specific Preferences', () => {
    it('isolates preference slices by occasion without leaking context-specific affinity', () => {
      const now = Date.now();
      const signals: StyleSignalEvent[] = [
        // User wears kurta for puja
        {
          id: '1',
          userId: 'u1',
          signalType: 'worn',
          occasion: 'puja',
          itemIds: ['item-white-kurta'],
          createdAt: now,
        },
        // User wears jeans for college
        {
          id: '2',
          userId: 'u1',
          signalType: 'worn',
          occasion: 'college',
          itemIds: ['item-blue-jeans'],
          createdAt: now,
        },
      ];

      const profile = derivePersonalStyleProfile(signals, [], wardrobe, undefined, now);
      expect(profile.contextualPreferences).toBeDefined();

      const pujaSlice = profile.contextualPreferences?.byOccasion?.puja;
      expect(pujaSlice).toBeDefined();
      expect(pujaSlice?.occasion).toBe('puja');
      expect(pujaSlice?.preferredFabrics).toContain('cotton');
      expect(pujaSlice?.preferredColors).toContain('white');

      const collegeSlice = profile.contextualPreferences?.byOccasion?.college;
      expect(collegeSlice).toBeDefined();
      expect(collegeSlice?.preferredFabrics).toContain('denim');
      expect(collegeSlice?.preferredColors).toContain('blue');
    });
  });

  // --------------------------------------------------------------------------
  // TEST 8: EXPLICIT PREFERENCE VERSUS INFERRED PREFERENCE
  // --------------------------------------------------------------------------
  describe('8. Explicit Preference Versus Inferred Preference', () => {
    it('prevents passive views and weak inferred signals from overriding explicit declarations', () => {
      const now = Date.now();
      const declaredPrefs: StylePreferences = {
        preferredContexts: ['College'],
        preferredAesthetics: ['Minimal'],
        preferredColors: ['white'], // Explicit user declared desire
        stylingMode: 'variety',
        updatedAt: now,
      };

      // Weak passive skips on white kurta
      const weakSignals: StyleSignalEvent[] = [
        { id: '1', userId: 'u1', signalType: 'skipped', itemIds: ['item-white-kurta'], createdAt: now },
        { id: '2', userId: 'u1', signalType: 'viewed', itemIds: ['item-white-kurta'], createdAt: now },
      ];

      const profile = derivePersonalStyleProfile(weakSignals, [], wardrobe, declaredPrefs, now);
      const whiteAff = profile.colorAffinities.white;

      // Status must remain explicit and positive
      expect(whiteAff.status).toBe('explicit');
      expect(whiteAff.score).toBeGreaterThan(0.3);
      expect(profile.avoidedColors).not.toContain('white');
    });
  });

  // --------------------------------------------------------------------------
  // TEST 9: USER CORRECTION MECHANISM
  // --------------------------------------------------------------------------
  describe('9. User Correction Mechanism (Rule 10)', () => {
    it('allows instant user correction to reset contradictory signals and establish explicit prior', () => {
      const now = Date.now();
      const signals: StyleSignalEvent[] = [
        { id: '1', userId: 'u1', signalType: 'rejected', rejectionReason: 'wrong_color', itemIds: ['item-white-kurta'], createdAt: now },
        { id: '2', userId: 'u1', signalType: 'rejected', rejectionReason: 'wrong_color', itemIds: ['item-white-kurta'], createdAt: now },
      ];

      const initialProfile = derivePersonalStyleProfile(signals, [], wardrobe, undefined, now);
      expect(initialProfile.avoidedColors).toContain('white');

      // User corrects: "Actually, I love white" -> targetAffinity = +0.8
      const corrected = correctPreference(initialProfile, 'color', 'white', 0.8, 'User override');

      expect(corrected.colorAffinities.white.score).toBe(0.8);
      expect(corrected.colorAffinities.white.status).toBe('explicit');
      expect(corrected.colorAffinities.white.provenance?.isExplicitOverride).toBe(true);
      expect(corrected.avoidedColors).not.toContain('white');
      expect(corrected.topColors).toContain('white');
    });
  });

  // --------------------------------------------------------------------------
  // TEST 10: MULTI-PIECE ENSEMBLE BUNDLE DISCOUNTING
  // --------------------------------------------------------------------------
  describe('10. Multi-Piece Bundle Discounting', () => {
    it('applies 1/sqrt(M) discount to avoid treating correlated ensemble items as independent evidence', () => {
      const now = Date.now();
      // Single item wear
      const singleWear: StyleSignalEvent[] = [
        { id: '1', userId: 'u1', signalType: 'worn', itemIds: ['item-white-kurta'], createdAt: now },
      ];
      const singleProfile = derivePersonalStyleProfile(singleWear, [], wardrobe, undefined, now);

      // 4-piece ensemble wear containing white kurta
      const fourPieceWear: StyleSignalEvent[] = [
        {
          id: '2',
          userId: 'u1',
          signalType: 'worn',
          itemIds: ['item-white-kurta', 'item-blue-jeans', 'item-silk-sherwani', 'item-4-dummy'],
          createdAt: now,
        },
      ];
      const fourPieceProfile = derivePersonalStyleProfile(fourPieceWear, [], wardrobe, undefined, now);

      const singleEffectivePos = singleProfile.colorAffinities.white.provenance?.alpha || 0;
      const fourPieceEffectivePos = fourPieceProfile.colorAffinities.white.provenance?.alpha || 0;

      // In the 4-piece ensemble, discount factor is 1/sqrt(4) = 0.5.
      // So effective evidence added is half of the single-item wear!
      const singleDelta = singleEffectivePos - 1.0; // Subtract prior alpha
      const fourPieceDelta = fourPieceEffectivePos - 1.0;
      expect(fourPieceDelta).toBeCloseTo(singleDelta * 0.5, 1);
    });
  });

  // --------------------------------------------------------------------------
  // TEST 11: PROFILE MIGRATION & BACKWARD COMPATIBILITY
  // --------------------------------------------------------------------------
  describe('11. Profile Migration and Backward Compatibility', () => {
    it('safely migrates a legacy v1/v2/v3 style profile to v4 without data loss', () => {
      const legacyV3 = {
        version: 3,
        userId: 'legacy-user',
        updatedAt: 1729000000000,
        overallConfidence: 0.6,
        totalSignalsCount: 8,
        colorAffinities: {
          blue: { score: 0.8, confidence: 0.7, sampleCount: 5, lastInteractedAt: 1729000000000 },
          black: { score: -0.5, confidence: 0.6, sampleCount: 3, lastInteractedAt: 1729000000000 },
        },
        fabricAffinities: {
          cotton: { score: 0.9, confidence: 0.8, sampleCount: 6, lastInteractedAt: 1729000000000 },
        },
        avoidedColors: ['black'],
        avoidedFabrics: [],
        avoidedPatterns: [],
        avoidedCombinations: [],
        neutralPreferenceRatio: 0.4,
        formalityBias: -0.2,
        noveltyTolerance: 0.6,
        topColors: ['blue'],
        topFabrics: ['cotton'],
        topFits: [],
        recentExplorations: [],
      };

      const migrated = migrateStyleProfile(legacyV3);

      expect(migrated.version).toBe(STYLE_BRAIN_VERSION);
      expect(migrated.userId).toBe('legacy-user');
      expect(migrated.colorAffinities.blue.score).toBe(0.8);
      expect(migrated.colorAffinities.blue.status).toBe('observed');
      expect(migrated.colorAffinities.blue.alpha).toBeDefined();
      expect(migrated.colorAffinities.blue.beta).toBeDefined();
      expect(migrated.colorAffinities.blue.variance).toBeDefined();

      // Extended collections initialized cleanly
      expect(migrated.categoryAffinities).toBeDefined();
      expect(migrated.styleFamilyAffinities).toBeDefined();
      expect(migrated.comfortAffinities).toBeDefined();
      expect(migrated.contextualPreferences).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // TEST 12: OFFLINE PROFILE UPDATES, PERSISTENCE & RESTORATION
  // --------------------------------------------------------------------------
  describe('12. Offline Profile Updates, Persistence and Restoration', () => {
    it('persists signals in local repository and restores deterministic profile offline', async () => {
      await styleSignalsRepository.clear();

      const signal: StyleSignalEvent = {
        id: 'offline-sig-1',
        userId: 'local-offline-user',
        signalType: 'worn',
        itemIds: ['item-white-kurta'],
        createdAt: Date.now(),
      };

      await styleSignalsRepository.addSignal(signal);
      const retrieved = await styleSignalsRepository.getSignals();
      expect(retrieved.length).toBe(1);
      expect(retrieved[0].id).toBe('offline-sig-1');

      // Offline profile derivation works with 0 network calls
      const offlineProfile = derivePersonalStyleProfile(retrieved, [], wardrobe);
      expect(offlineProfile.totalSignalsCount).toBe(1);
      expect(offlineProfile.fabricAffinities.cotton.status).toBe('observed');

      // Clean up repository
      await styleSignalsRepository.clear();
    });
  });
});
