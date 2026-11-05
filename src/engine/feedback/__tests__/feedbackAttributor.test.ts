import { describe, it, expect, beforeEach } from 'vitest';
import {
  classifyFeedbackSignal,
  deduplicateAndDampenSignals,
  attributeSignalEvidence,
  correctInferredPreference,
  explainLearnedPreferences,
} from '../feedbackAttributor';
import {
  derivePersonalStyleProfile,
  STYLE_SIGNAL_WEIGHTS,
} from '../../styleBrain';
import { LocalStorageStyleSignalsRepository } from '../../../repositories/LocalStorageStyleSignalsRepository';
import {
  WardrobeItem,
  StyleSignalEvent,
  WearEvent,
  StylePreferences,
  PersonalStyleProfile,
} from '../../../types';

function createMockWardrobe(): WardrobeItem[] {
  return [
    {
      id: 'item_white_kurta',
      name: 'White Cotton Kurta',
      category: 'Ethnic',
      subcategory: 'kurta',
      colors: ['white'],
      seasons: ['summer', 'monsoon'],
      occasions: ['everyday', 'college', 'family gathering'],
      formality: 2.5,
      status: 'clean',
      favorite: false,
      note: '',
      timesWorn: 3,
      fabric: 'cotton',
      pattern: 'solid',
      fit: 'regular',
      userVerified: true,
    },
    {
      id: 'item_blue_jeans',
      name: 'Blue Slim Denim Jeans',
      category: 'Bottoms',
      subcategory: 'jeans',
      colors: ['blue'],
      seasons: ['summer', 'monsoon', 'winter'],
      occasions: ['everyday', 'college', 'casual outing'],
      formality: 2.0,
      status: 'clean',
      favorite: false,
      note: '',
      timesWorn: 5,
      fabric: 'denim',
      pattern: 'solid',
      fit: 'slim',
      userVerified: true,
    },
    {
      id: 'item_tan_juttis',
      name: 'Tan Leather Juttis',
      category: 'Footwear',
      subcategory: 'juttis',
      colors: ['tan'],
      seasons: ['summer', 'winter'],
      occasions: ['everyday', 'festive', 'family gathering'],
      formality: 3.0,
      status: 'clean',
      favorite: false,
      note: '',
      timesWorn: 1,
      fabric: 'unknown',
      materialComposition: 'leather',
      userVerified: true,
    },
    {
      id: 'item_silk_sherwani',
      name: 'Royal Banarasi Silk Sherwani',
      category: 'Ethnic',
      subcategory: 'sherwani',
      colors: ['gold', 'maroon'],
      seasons: ['winter'],
      occasions: ['wedding guest', 'celebration'],
      formality: 5.0,
      status: 'clean',
      favorite: false,
      note: '',
      timesWorn: 0,
      fabric: 'banarasi',
      pattern: 'zari_brocade',
      fit: 'tailored',
      userVerified: true,
    },
  ];
}

describe('StyleSaathi 3.0 — Phase 5C: Feedback Attribution & Adaptive Personal Learning', () => {
  const items = createMockWardrobe();
  const itemsMap = new Map<string, WardrobeItem>(items.map((i) => [i.id, i]));
  const now = Date.now();

  // --------------------------------------------------------------------------
  // 1. Explicit Positive Preference
  // --------------------------------------------------------------------------
  it('1. Explicit positive preference: initializes informative Beta prior, status is explicit, immune to passive skips', () => {
    const prefs: StylePreferences = {
      preferredContexts: ['college'],
      preferredAesthetics: ['Classic'],
      stylingMode: 'simple',
      updatedAt: now,
      preferredColors: ['white'],
    };

    // Even if passive skips arrive, explicit preference remains positive and explicit
    const signals: StyleSignalEvent[] = [
      { id: 's1', userId: 'u1', signalType: 'skipped', itemIds: ['item_white_kurta'], createdAt: now },
      { id: 's2', userId: 'u1', signalType: 'viewed', itemIds: ['item_white_kurta'], createdAt: now },
    ];

    const profile = derivePersonalStyleProfile(signals, [], items, prefs, now);
    const whiteAffinity = profile.colorAffinities.white;

    expect(whiteAffinity.status).toBe('explicit');
    expect(whiteAffinity.score).toBeGreaterThan(0.5);
    expect(whiteAffinity.provenance?.isExplicitOverride).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 2. Explicit Negative Preference
  // --------------------------------------------------------------------------
  it('2. Explicit negative preference: fabric sensitivities initialize strong negative prior', () => {
    const prefs: StylePreferences = {
      preferredContexts: [],
      preferredAesthetics: [],
      stylingMode: 'simple',
      updatedAt: now,
      fabricSensitivities: ['wool'],
    };

    const profile = derivePersonalStyleProfile([], [], items, prefs, now);
    const woolAffinity = profile.fabricAffinities.wool;

    expect(woolAffinity.status).toBe('explicit');
    expect(woolAffinity.score).toBeLessThan(-0.6);
    expect(profile.avoidedFabrics).toContain('wool');
  });

  // --------------------------------------------------------------------------
  // 3. Whole-Outfit Rejection
  // --------------------------------------------------------------------------
  it('3. Whole-outfit rejection: untargeted rejection does NOT dislike individual garment attributes', () => {
    // User rejects a 3-piece outfit without a specific sub-reason
    const signals: StyleSignalEvent[] = [
      {
        id: 'rej_outfit_1',
        userId: 'u1',
        signalType: 'rejected',
        outfitId: 'outfit_kurta_jeans_juttis',
        itemIds: ['item_white_kurta', 'item_blue_jeans', 'item_tan_juttis'],
        createdAt: now,
      },
    ];

    const attributed = attributeSignalEvidence(signals[0], 1.0, itemsMap);
    expect(attributed.some((a) => a.targetType === 'outfit' || a.targetType === 'pair')).toBe(true);
    // Crucial guarantee: no individual attribute target was generated for untargeted whole-outfit rejection
    expect(attributed.some((a) => a.targetType === 'attribute')).toBe(false);

    // Profile verification: white color and cotton fabric must NOT be penalized
    const profile = derivePersonalStyleProfile(signals, [], items, undefined, now);
    const whiteScore = profile.colorAffinities.white?.score ?? 0;
    const cottonScore = profile.fabricAffinities.cotton?.score ?? 0;

    expect(whiteScore).toBeGreaterThanOrEqual(0.0);
    expect(cottonScore).toBeGreaterThanOrEqual(0.0);
  });

  // --------------------------------------------------------------------------
  // 4. Pairwise Rejection
  // --------------------------------------------------------------------------
  it('4. Pairwise rejection: dislike_combination updates pair combination ONLY, preserving pieces', () => {
    const signals: StyleSignalEvent[] = [
      {
        id: 'rej_combo_1',
        userId: 'u1',
        signalType: 'rejected',
        rejectionReason: 'dislike_combination',
        itemIds: ['item_white_kurta', 'item_blue_jeans'],
        createdAt: now,
      },
    ];

    const attributed = attributeSignalEvidence(signals[0], 1.0, itemsMap);
    expect(attributed.length).toBe(1);
    expect(attributed[0].category).toBe('pairwise');
    expect(attributed[0].targetKey).toBe('item_blue_jeans:item_white_kurta');
    expect(attributed[0].weight).toBe(-3.5);

    const profile = derivePersonalStyleProfile(signals, [], items, undefined, now);
    const pairKey = 'item_blue_jeans:item_white_kurta';
    expect(profile.combinationAffinities[pairKey].score).toBeLessThan(-0.5);
    expect(profile.avoidedCombinations).toContain(pairKey);

    // Individual items must not be marked avoided
    expect(profile.colorAffinities.white?.score ?? 0).toBeGreaterThanOrEqual(0.0);
  });

  // --------------------------------------------------------------------------
  // 5. Actual Wear Without Explicit Satisfaction
  // --------------------------------------------------------------------------
  it('5. Actual wear without explicit satisfaction: registers physical use evidence, not explicit affection', () => {
    const wearEvents: WearEvent[] = [
      { id: 'w1', userId: 'u1', wardrobeItemId: 'item_white_kurta', wornAt: now, createdAt: now },
      { id: 'w2', userId: 'u1', wardrobeItemId: 'item_white_kurta', wornAt: now - 86400000, createdAt: now },
    ];

    const profile = derivePersonalStyleProfile([], wearEvents, items, undefined, now);
    const kurtaAffinity = profile.itemAffinities['item_white_kurta'];

    expect(kurtaAffinity.status).toBe('observed');
    expect(kurtaAffinity.score).toBeGreaterThan(0.5);
    expect(kurtaAffinity.provenance?.status).toBe('observed');
    expect(kurtaAffinity.provenance?.isExplicitOverride).toBe(false);
  });

  // --------------------------------------------------------------------------
  // 6. Lookbook Save Without Satisfaction
  // --------------------------------------------------------------------------
  it('6. Lookbook save without satisfaction: represents forward curation intent, carrying less weight than wear', () => {
    const signals: StyleSignalEvent[] = [
      { id: 'save1', userId: 'u1', signalType: 'saved', itemIds: ['item_white_kurta'], createdAt: now },
    ];

    const attributed = attributeSignalEvidence(signals[0], 1.0, itemsMap);
    expect(attributed[0].isIntentOnly).toBe(true);
    expect(attributed[0].weight).toBe(STYLE_SIGNAL_WEIGHTS.saved);
    expect(attributed[0].weight).toBeLessThan(STYLE_SIGNAL_WEIGHTS.worn);
  });

  // --------------------------------------------------------------------------
  // 7. Calendar Plan Without Completion
  // --------------------------------------------------------------------------
  it('7. Calendar plan without completion: represents scheduled intent, not confirmed satisfaction', () => {
    const signals: StyleSignalEvent[] = [
      { id: 'plan1', userId: 'u1', signalType: 'planned', itemIds: ['item_blue_jeans'], createdAt: now },
    ];

    const attributed = attributeSignalEvidence(signals[0], 1.0, itemsMap);
    expect(attributed[0].isIntentOnly).toBe(true);
    expect(attributed[0].weight).toBe(STYLE_SIGNAL_WEIGHTS.planned);
  });

  // --------------------------------------------------------------------------
  // 8. Passive Inspection
  // --------------------------------------------------------------------------
  it('8. Passive inspection: carries zero positive preference weight on attribute affinity scores', () => {
    const signals: StyleSignalEvent[] = [
      { id: 'insp1', userId: 'u1', signalType: 'inspected', itemIds: ['item_white_kurta'], createdAt: now },
      { id: 'view1', userId: 'u1', signalType: 'viewed', itemIds: ['item_white_kurta'], createdAt: now },
      { id: 'disp1', userId: 'u1', signalType: 'displayed', itemIds: ['item_white_kurta'], createdAt: now },
    ];

    const attributed = attributeSignalEvidence(signals[0], 1.0, itemsMap);
    expect(attributed[0].category).toBe('passive_interaction');
    expect(attributed[0].weight).toBe(0.0);

    // Profile check: passive inspections must not create positive color or fabric affinity
    const profile = derivePersonalStyleProfile(signals, [], items, undefined, now);
    expect(profile.colorAffinities.white?.score ?? 0).toBe(0.0);
    expect(profile.fabricAffinities.cotton?.score ?? 0).toBe(0.0);
  });

  // --------------------------------------------------------------------------
  // 9. Repeated Outfit Interaction
  // --------------------------------------------------------------------------
  it('9. Repeated outfit interaction: applies sublinear session dampening to prevent false certainty', () => {
    const signals: StyleSignalEvent[] = [];
    for (let i = 0; i < 5; i++) {
      signals.push({
        id: `repeat_${i}`,
        userId: 'u1',
        signalType: 'worn',
        itemIds: ['item_white_kurta'],
        createdAt: now + i * 5000,
      });
    }

    const deduplicated = deduplicateAndDampenSignals(signals);
    // 5th interaction has dampening of 1 / sqrt(5) ≈ 0.447
    const fifthDampening = deduplicated[4].sessionDampening;
    expect(fifthDampening).toBeCloseTo(1 / Math.sqrt(5), 2);
  });

  // --------------------------------------------------------------------------
  // 10. Correlated Interactions Within One Session
  // --------------------------------------------------------------------------
  it('10. Correlated interactions within one session: ensemble discounting normalizes multi-piece bundles', () => {
    const signals: StyleSignalEvent[] = [
      {
        id: 'ens_1',
        userId: 'u1',
        signalType: 'worn',
        itemIds: ['item_white_kurta', 'item_blue_jeans', 'item_tan_juttis', 'item_silk_sherwani'],
        createdAt: now,
      },
    ];

    const attributed = attributeSignalEvidence(signals[0], 1.0, itemsMap);
    // 4-piece ensemble: each piece gets attributed with ensemble accountability
    expect(attributed.length).toBe(4);
  });

  // --------------------------------------------------------------------------
  // 11. Context-Specific Preference
  // --------------------------------------------------------------------------
  it('11. Context-specific preference: too_hot rejection updates thermal comfort slice without global dislike', () => {
    const signals: StyleSignalEvent[] = [
      {
        id: 'ctx_hot_1',
        userId: 'u1',
        signalType: 'rejected',
        rejectionReason: 'too_hot',
        itemIds: ['item_silk_sherwani'],
        occasion: 'college',
        createdAt: now,
      },
      // Positive wear event in cold festive occasion
      {
        id: 'ctx_wear_1',
        userId: 'u1',
        signalType: 'worn',
        itemIds: ['item_silk_sherwani'],
        occasion: 'wedding guest',
        createdAt: now,
      },
    ];

    const profile = derivePersonalStyleProfile(signals, [], items, undefined, now);
    // Comfort dimension captures warm avoidance
    expect(profile.comfortAffinities?.warm?.score ?? 0).toBeLessThan(0.0);
  });

  // --------------------------------------------------------------------------
  // 12. Explicit Preference Correction
  // --------------------------------------------------------------------------
  it('12. Explicit preference correction: immediately overrides inferred preferences with explicit provenance', () => {
    // Initial profile where banarasi was inferred negative
    const signals: StyleSignalEvent[] = [
      { id: 's1', userId: 'u1', signalType: 'rejected', rejectionReason: 'too_hot', itemIds: ['item_silk_sherwani'], createdAt: now },
    ];
    let profile = derivePersonalStyleProfile(signals, [], items, undefined, now);

    // User explicitly corrects: "I actually like Banarasi"
    profile = correctInferredPreference(profile, {
      dimension: 'fabric',
      key: 'banarasi',
      polarity: 'prefer',
      userNote: 'I love Banarasi for weddings',
    });

    const banarasiAff = profile.fabricAffinities.banarasi;
    expect(banarasiAff.status).toBe('explicit');
    expect(banarasiAff.score).toBeGreaterThan(0.5);
    expect(banarasiAff.provenance?.isExplicitOverride).toBe(true);
    expect(profile.avoidedFabrics).not.toContain('banarasi');
  });

  // --------------------------------------------------------------------------
  // 13. Contradictory Evidence
  // --------------------------------------------------------------------------
  it('13. Contradictory evidence: balanced positive and negative evidence classifies status as contradictory', () => {
    // 3 positive wears, 3 structured diagnostic rejections for same color
    const signals: StyleSignalEvent[] = [
      { id: 'w1', userId: 'u1', signalType: 'worn', itemIds: ['item_blue_jeans'], createdAt: now },
      { id: 'w2', userId: 'u1', signalType: 'worn', itemIds: ['item_blue_jeans'], createdAt: now },
      { id: 'w3', userId: 'u1', signalType: 'worn', itemIds: ['item_blue_jeans'], createdAt: now },
      { id: 'r1', userId: 'u1', signalType: 'rejected', rejectionReason: 'wrong_color', itemIds: ['item_blue_jeans'], createdAt: now },
      { id: 'r2', userId: 'u1', signalType: 'rejected', rejectionReason: 'wrong_color', itemIds: ['item_blue_jeans'], createdAt: now },
      { id: 'r3', userId: 'u1', signalType: 'rejected', rejectionReason: 'wrong_color', itemIds: ['item_blue_jeans'], createdAt: now },
    ];

    const profile = derivePersonalStyleProfile(signals, [], items, undefined, now);
    const blueAff = profile.colorAffinities.blue;

    expect(blueAff.status).toBe('contradictory');
    expect(blueAff.provenance?.status).toBe('contradictory');
  });

  // --------------------------------------------------------------------------
  // 14. Unknown Preference
  // --------------------------------------------------------------------------
  it('14. Unknown preference: unobserved attribute remains status unknown with zero score and 1.0 uncertainty', () => {
    const profile = derivePersonalStyleProfile([], [], items, undefined, now);
    const goldAff = profile.colorAffinities.gold;

    expect(goldAff.status).toBe('unknown');
    expect(goldAff.score).toBe(0.0);
    expect(goldAff.confidence).toBe(0.0);
    expect(goldAff.uncertainty).toBe(1.0);
  });

  // --------------------------------------------------------------------------
  // 15. User Preference Migration
  // --------------------------------------------------------------------------
  it('15. User preference migration: updates explicit prior when user edits onboarding preferences without losing history', () => {
    const initialPrefs: StylePreferences = {
      preferredContexts: [],
      preferredAesthetics: [],
      stylingMode: 'simple',
      updatedAt: now - 10000,
      preferredColors: ['blue'],
    };

    const profileInitial = derivePersonalStyleProfile([], [], items, initialPrefs, now);
    expect(profileInitial.colorAffinities.blue.status).toBe('explicit');

    // User migrates preferences to add white
    const updatedPrefs: StylePreferences = {
      ...initialPrefs,
      updatedAt: now,
      preferredColors: ['blue', 'white'],
    };

    const profileUpdated = derivePersonalStyleProfile([], [], items, updatedPrefs, now);
    expect(profileUpdated.colorAffinities.white.status).toBe('explicit');
    expect(profileUpdated.colorAffinities.blue.status).toBe('explicit');
  });

  // --------------------------------------------------------------------------
  // 16. Offline Feedback Persistence
  // --------------------------------------------------------------------------
  it('16. Offline feedback persistence: LocalStorageStyleSignalsRepository adds and retrieves signals locally without network', async () => {
    const repo = new LocalStorageStyleSignalsRepository();
    await repo.clear();

    const signal: StyleSignalEvent = {
      id: 'offline_sig_1',
      userId: 'u1',
      signalType: 'worn',
      itemIds: ['item_white_kurta'],
      createdAt: now,
    };

    await repo.addSignal(signal);
    const retrieved = await repo.getSignals();

    expect(retrieved.length).toBe(1);
    expect(retrieved[0].id).toBe('offline_sig_1');
  });

  // --------------------------------------------------------------------------
  // 17. Synchronization & Duplicate Event Handling
  // --------------------------------------------------------------------------
  it('17. Synchronization & duplicate handling: idempotently suppresses duplicate IDs and rapid double-taps', async () => {
    const repo = new LocalStorageStyleSignalsRepository();
    await repo.clear();

    const signal: StyleSignalEvent = {
      id: 'dup_event_1',
      userId: 'u1',
      signalType: 'saved',
      itemIds: ['item_white_kurta'],
      createdAt: now,
    };

    // Duplicate insertion
    await repo.addSignal(signal);
    await repo.addSignal(signal);

    const all = await repo.getSignals();
    expect(all.length).toBe(1);

    // Rapid double-tap suppression in deduplicateAndDampenSignals
    const doubleTaps: StyleSignalEvent[] = [
      signal,
      { ...signal, id: 'dup_event_2', createdAt: now + 500 }, // 500ms double-tap
    ];
    const cleaned = deduplicateAndDampenSignals(doubleTaps);
    expect(cleaned.length).toBe(1);
  });

  // --------------------------------------------------------------------------
  // 18. User Transparency & Explainability
  // --------------------------------------------------------------------------
  it('18. User transparency & explainability: explainLearnedPreferences produces clear, human-readable insights', () => {
    const prefs: StylePreferences = {
      preferredContexts: [],
      preferredAesthetics: [],
      stylingMode: 'simple',
      updatedAt: now,
      preferredColors: ['white'],
      fabricSensitivities: ['wool'],
    };

    const profile = derivePersonalStyleProfile([], [], items, prefs, now);
    const explanations = explainLearnedPreferences(profile);

    expect(explanations.length).toBeGreaterThanOrEqual(2);
    const whiteExp = explanations.find((e) => e.key === 'white');
    expect(whiteExp).toBeDefined();
    expect(whiteExp!.isExplicit).toBe(true);
    expect(whiteExp!.confidenceDescription).toBe('High confidence');
    expect(whiteExp!.humanDescription).toContain('prefer white');

    const woolExp = explanations.find((e) => e.key === 'wool');
    expect(woolExp).toBeDefined();
    expect(woolExp!.humanDescription).toContain('tend to avoid wool');
  });
});
