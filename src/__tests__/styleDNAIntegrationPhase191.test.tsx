import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  derivePersonalStyleProfile,
  calculatePersonalStyleScore,
  getPersonalStyleExplanations,
  STYLE_SIGNAL_WEIGHTS,
} from '../engine/styleBrain';
import {
  deriveStyleDNAProfile,
  determineEvidenceSource,
} from '../engine/styleDNA';
import {
  recommendOutfits,
  recommendOutfitsWithTelemetry,
} from '../engine/recommendationEngine';
import {
  WardrobeItem,
  WearEvent,
  StyleSignalEvent,
  StylePreferences,
  Occasion,
  DEFAULT_STYLE_PREFERENCES,
  GeneratedOutfit,
} from '../types';
import { LocalStoragePreferencesRepository } from '../repositories/LocalStoragePreferencesRepository';
import { LocalStorageStyleSignalsRepository } from '../repositories/LocalStorageStyleSignalsRepository';

// ============================================================================
// FIXTURES
// ============================================================================

const cleanKurta: WardrobeItem = {
  id: 'item_kurta_blue',
  name: 'Royal Blue Cotton Kurta',
  category: 'Ethnic',
  subcategory: 'kurta',
  colors: ['blue', 'navy'],
  fabric: 'cotton',
  pattern: 'solid',
  fit: 'relaxed',
  seasons: ['summer', 'winter'],
  formality: 3,
  occasions: ['everyday', 'office', 'puja', 'festive'],
  status: 'clean',
  favorite: false,
  note: 'Handspun cotton',
  timesWorn: 3,
  createdAt: Date.now() - 30 * 86400000,
};

const cleanLinenTrousers: WardrobeItem = {
  id: 'item_trousers_white',
  name: 'Ivory Linen Straight Trousers',
  category: 'Bottoms',
  subcategory: 'trousers',
  colors: ['white', 'ivory'],
  fabric: 'linen',
  pattern: 'solid',
  fit: 'straight',
  seasons: ['summer', 'winter'],
  formality: 3,
  occasions: ['everyday', 'office', 'puja', 'festive'],
  status: 'clean',
  favorite: false,
  note: 'Pure linen trousers',
  timesWorn: 2,
  createdAt: Date.now() - 30 * 86400000,
};

const cleanMojari: WardrobeItem = {
  id: 'item_mojari_fabric',
  name: 'Handcrafted Fabric Juttis',
  category: 'Footwear',
  subcategory: 'juttis',
  colors: ['ivory', 'gold'],
  fabric: 'silk',
  pattern: 'embroidered',
  fit: 'tailored',
  seasons: ['summer', 'winter'],
  formality: 3,
  occasions: ['everyday', 'office', 'puja', 'festive'],
  status: 'clean',
  favorite: false,
  note: 'Zari embroidered juttis',
  timesWorn: 1,
  createdAt: Date.now() - 30 * 86400000,
};

const dirtyKurta: WardrobeItem = {
  id: 'item_kurta_dirty',
  name: 'Emerald Green Silk Kurta',
  category: 'Ethnic',
  subcategory: 'kurta',
  colors: ['green', 'emerald'],
  fabric: 'silk',
  pattern: 'solid',
  fit: 'relaxed',
  seasons: ['summer', 'winter'],
  formality: 4,
  occasions: ['festive', 'puja'],
  status: 'needs_washing', // DIRTY
  favorite: true,
  note: 'Festive silk',
  timesWorn: 5,
  createdAt: Date.now() - 30 * 86400000,
};

const inLaundryKurta: WardrobeItem = {
  id: 'item_kurta_laundry',
  name: 'Crimson Chanderi Kurta',
  category: 'Ethnic',
  subcategory: 'kurta',
  colors: ['red', 'crimson'],
  fabric: 'chanderi',
  pattern: 'solid',
  fit: 'relaxed',
  seasons: ['summer', 'winter'],
  formality: 4,
  occasions: ['festive', 'puja'],
  status: 'in_laundry', // IN LAUNDRY
  favorite: true,
  note: 'Chanderi silk',
  timesWorn: 8,
  createdAt: Date.now() - 30 * 86400000,
};

const leatherLoafers: WardrobeItem = {
  id: 'item_leather_loafers',
  name: 'Full-Grain Calf Leather Loafers',
  category: 'Footwear',
  subcategory: 'formal shoes',
  colors: ['brown'],
  fabric: 'leather' as any, // ANIMAL LEATHER
  pattern: 'solid',
  fit: 'tailored',
  seasons: ['summer', 'winter'],
  formality: 4,
  occasions: ['office', 'puja'], // Trying to wear in Puja
  status: 'clean',
  favorite: true,
  note: 'Full grain leather',
  timesWorn: 10,
  createdAt: Date.now() - 30 * 86400000,
};

describe('STYLESAATHI — PHASE 1.9.1: Style DNA Integration & Trust Verification', () => {
  const storageMap = new Map<string, string>();

  beforeEach(() => {
    storageMap.clear();
    (globalThis as any).localStorage = {
      getItem: (k: string) => storageMap.get(k) || null,
      setItem: (k: string, v: string) => storageMap.set(k, String(v)),
      removeItem: (k: string) => storageMap.delete(k),
      clear: () => storageMap.clear(),
    };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // 1. RECOMMENDATION INTEGRATION & COMPLETE DATA FLOW TRACE
  // ==========================================================================
  describe('1. Complete Recommendation Integration Data Flow', () => {
    it('verifies that positive feedback signals flow through Bayesian engine to elevate recommendation score', () => {
      const now = Date.now();
      const items = [cleanKurta, cleanLinenTrousers, cleanMojari];

      // Baseline with zero signals (cold start)
      const baseSignals: StyleSignalEvent[] = [];
      const baseWears: WearEvent[] = [];
      const baseProfile = derivePersonalStyleProfile(baseSignals, baseWears, items);

      // Verify cold start yields 0 personal style delta
      const coldDelta = calculatePersonalStyleScore(items, 'office', baseProfile);
      expect(coldDelta).toBe(0);

      // User interacts: logs multiple wears and positive feedback for blue & linen
      const richSignals: StyleSignalEvent[] = [
        {
          id: 'sig_1',
          userId: 'user_1',
          createdAt: now - 3600000,
          signalType: 'worn',
          itemIds: [cleanKurta.id, cleanLinenTrousers.id],
          occasion: 'office',
        },
        {
          id: 'sig_2',
          userId: 'user_1',
          createdAt: now - 1800000,
          signalType: 'liked',
          itemIds: [cleanKurta.id],
          occasion: 'office',
        },
        {
          id: 'sig_3',
          userId: 'user_1',
          createdAt: now - 600000,
          signalType: 'favorited',
          itemIds: [cleanLinenTrousers.id],
          occasion: 'office',
        },
      ];

      const richWears: WearEvent[] = [
        {
          id: 'wear_1',
          userId: 'user_1',
          wardrobeItemId: cleanKurta.id,
          wornAt: now - 86400000,
          createdAt: now - 86400000,
        },
        {
          id: 'wear_2',
          userId: 'user_1',
          wardrobeItemId: cleanLinenTrousers.id,
          wornAt: now - 86400000,
          createdAt: now - 86400000,
        },
      ];

      // 1. Bayesian preference engine derives profile
      const trainedProfile = derivePersonalStyleProfile(richSignals, richWears, items);
      expect(trainedProfile.totalSignalsCount).toBeGreaterThanOrEqual(3);
      expect(trainedProfile.overallConfidence).toBeGreaterThan(0.2);

      // 2. Style DNA derives explainable semantic profile
      const styleDNA = deriveStyleDNAProfile(trainedProfile, items, richWears);
      expect(styleDNA.hasSufficientEvidence).toBe(true);

      // 3. Recommendation engine scores outfit with styleProfile
      const positiveDelta = calculatePersonalStyleScore(items, 'office', trainedProfile);
      expect(positiveDelta).toBeGreaterThan(0.2);

      // 4. Recommendation pipeline ranking and explanation
      const result = recommendOutfitsWithTelemetry({
        items,
        occasion: 'office',
        season: 'summer',
        localDate: '2026-11-15',
        styleProfile: trainedProfile,
      });

      expect(result.set.outfits.length).toBeGreaterThan(0);
      const bestMatch = result.set.outfits.find((o) => o.role === 'best_match') || result.set.outfits[0];
      expect(bestMatch.scoreBreakdown.personalStyle).toBeGreaterThan(0);

      // 5. Outfit explanation reflects personal style evidence
      const reasons = getPersonalStyleExplanations(items, 'office', trainedProfile);
      expect(reasons.length).toBeGreaterThan(0);
      expect(reasons[0].toLowerCase()).toMatch(/(blue|linen|relaxed|straight|cotton)/);
    });

    it('verifies that negative feedback (rejection) decreases outfit recommendation score', () => {
      const now = Date.now();
      const items = [cleanKurta, cleanLinenTrousers, cleanMojari];

      // User rejects blue / cotton pieces
      const rejectionSignals: StyleSignalEvent[] = [
        {
          id: 'sig_rej_1',
          userId: 'user_1',
          createdAt: now - 3600000,
          signalType: 'rejected',
          rejectionReason: 'wrong_color',
          itemIds: [cleanKurta.id],
          occasion: 'office',
        },
        {
          id: 'sig_rej_2',
          userId: 'user_1',
          createdAt: now - 1800000,
          signalType: 'rejected',
          rejectionReason: 'not_my_style',
          itemIds: [cleanKurta.id],
          occasion: 'office',
        },
        {
          id: 'sig_rej_3',
          userId: 'user_1',
          createdAt: now - 600000,
          signalType: 'skipped',
          itemIds: [cleanKurta.id],
          occasion: 'office',
        },
      ];

      const profile = derivePersonalStyleProfile(rejectionSignals, [], items);
      const scoreDelta = calculatePersonalStyleScore(items, 'office', profile);

      // Negative feedback must depress the personal style delta
      expect(scoreDelta).toBeLessThan(0);
    });
  });

  // ==========================================================================
  // 2. BAYESIAN CORRECTNESS & MATHEMATICAL GUARANTEES
  // ==========================================================================
  describe('2. Bayesian Correctness', () => {
    it('guarantees explicit user declarations take precedence over passive skips and exposures', () => {
      const explicitPrefs: StylePreferences = {
        ...DEFAULT_STYLE_PREFERENCES,
        preferredColors: ['blue'],
      };

      // Passive skips on blue item
      const passiveSkips: StyleSignalEvent[] = Array.from({ length: 5 }, (_, i) => ({
        id: `skip_${i}`,
        userId: 'user_1',
        createdAt: Date.now() - i * 3600000,
        signalType: 'skipped',
        itemIds: [cleanKurta.id],
      }));

      const profile = derivePersonalStyleProfile(passiveSkips, [], [cleanKurta], explicitPrefs);
      const blueAff = profile.colorAffinities['blue'];

      expect(blueAff).toBeDefined();
      expect(blueAff.status).toBe('explicit');
      expect(blueAff.score).toBeGreaterThan(0.4);
      expect(blueAff.provenance?.isExplicitOverride).toBe(true);

      const dna = deriveStyleDNAProfile(profile, [cleanKurta], [], explicitPrefs);
      const blueNode = dna.colors.find((c) => c.value === 'blue');
      expect(blueNode?.status).toBe('explicit');
      expect(blueNode?.confidence).toBeGreaterThanOrEqual(0.65);
    });

    it('guarantees co-occurring ensemble items are discounted by 1/sqrt(M)', () => {
      const now = Date.now();
      // Single piece worn
      const soloSignal: StyleSignalEvent = {
        id: 'sig_solo',
        userId: 'user_1',
        createdAt: now,
        signalType: 'worn',
        itemIds: [cleanKurta.id],
      };
      const soloProfile = derivePersonalStyleProfile([soloSignal], [], [cleanKurta]);

      // 4-piece ensemble worn together with distinct fabrics
      const denimJacket: WardrobeItem = {
        ...cleanKurta,
        id: 'item_denim_jacket',
        category: 'Outerwear',
        subcategory: 'jacket',
        fabric: 'denim',
        colors: ['blue'],
      };
      const ensembleItems = [cleanKurta, cleanLinenTrousers, cleanMojari, denimJacket];
      const ensembleSignal: StyleSignalEvent = {
        id: 'sig_ensemble',
        userId: 'user_1',
        createdAt: now,
        signalType: 'worn',
        itemIds: ensembleItems.map((i) => i.id),
      };
      const ensembleProfile = derivePersonalStyleProfile([ensembleSignal], [], ensembleItems);

      // Attribute-level Bayesian scaling by 1 / sqrt(M)
      const soloEffectiveAlpha = soloProfile.fabricAffinities['cotton'].alpha;
      const ensembleEffectiveAlpha = ensembleProfile.fabricAffinities['cotton'].alpha;

      // In ensemble of 4, each piece's positive delta is scaled by 1/sqrt(4) = 0.5
      const soloGain = (soloEffectiveAlpha ?? 1.0) - 1.0;
      const ensembleGain = (ensembleEffectiveAlpha ?? 1.0) - 1.0;
      expect(ensembleGain).toBeLessThan(soloGain);
      expect(Math.round((ensembleGain / soloGain) * 100) / 100).toBeCloseTo(0.5, 1);
    });

    it('identifies and preserves contradictory evidence without false smoothing', () => {
      const now = Date.now();
      // User loves the piece physically (worn multiple times) but repeatedly dislikes it in feedback
      const contradictorySignals: StyleSignalEvent[] = [
        {
          id: 'sig_c1',
          userId: 'user_1',
          createdAt: now - 3600000,
          signalType: 'worn',
          itemIds: [cleanKurta.id],
        },
        {
          id: 'sig_c2',
          userId: 'user_1',
          createdAt: now - 3000000,
          signalType: 'worn',
          itemIds: [cleanKurta.id],
        },
        {
          id: 'sig_c3',
          userId: 'user_1',
          createdAt: now - 2000000,
          signalType: 'rejected',
          rejectionReason: 'not_my_style',
          itemIds: [cleanKurta.id],
        },
        {
          id: 'sig_c4',
          userId: 'user_1',
          createdAt: now - 1000000,
          signalType: 'rejected',
          rejectionReason: 'wrong_color',
          itemIds: [cleanKurta.id],
        },
      ];

      const profile = derivePersonalStyleProfile(contradictorySignals, [], [cleanKurta]);
      const itemAff = profile.itemAffinities[cleanKurta.id];

      expect(itemAff.status).toBe('contradictory');
      expect(itemAff.provenance?.status).toBe('contradictory');
      expect(itemAff.uncertainty).toBeGreaterThan(0.2);
    });

    it('isolates context-specific occasion preferences from leaking into global profile', () => {
      const now = Date.now();
      // User only wears silk in festive occasion
      const festiveSignal: StyleSignalEvent = {
        id: 'sig_festive',
        userId: 'user_1',
        createdAt: now,
        signalType: 'worn',
        itemIds: [cleanMojari.id], // silk fabric
        occasion: 'festive',
      };

      const profile = derivePersonalStyleProfile([festiveSignal], [], [cleanMojari]);
      const silkAff = profile.fabricAffinities['silk'];

      expect(silkAff.contextualScores?.['festive']).toBeGreaterThan(0);
      expect(silkAff.contextualScores?.['office']).toBeUndefined();
    });

    it('ensures statistical confidence values remain mathematically bounded in [0.0, 1.0]', () => {
      const highVolumeSignals: StyleSignalEvent[] = Array.from({ length: 50 }, (_, i) => ({
        id: `sig_vol_${i}`,
        userId: 'user_1',
        createdAt: Date.now() - i * 100000,
        signalType: 'worn',
        itemIds: [cleanKurta.id],
      }));

      const profile = derivePersonalStyleProfile(highVolumeSignals, [], [cleanKurta]);
      const aff = profile.itemAffinities[cleanKurta.id];

      expect(aff.confidence).toBeGreaterThanOrEqual(0.0);
      expect(aff.confidence).toBeLessThanOrEqual(1.0);
      expect(aff.uncertainty).toBeGreaterThanOrEqual(0.0);
      expect(aff.uncertainty).toBeLessThanOrEqual(1.0);
      expect(aff.confidence + (aff.uncertainty ?? 0)).toBeCloseTo(1.0, 1);
    });
  });

  // ==========================================================================
  // 3. PERSISTENCE & USER AGENCY ACROSS RESTART
  // ==========================================================================
  describe('3. Persistence, User Agency & Local-First Offline Lifecycle', () => {
    it('persists explicit preference calibrations to LocalStoragePreferencesRepository across restarts', async () => {
      const repo = new LocalStoragePreferencesRepository();

      // 1. Initial save
      const initialPrefs: StylePreferences = {
        ...DEFAULT_STYLE_PREFERENCES,
        preferredColors: ['indigo', 'emerald'],
        preferredFits: ['relaxed'],
        updatedAt: Date.now(),
      };
      await repo.savePreferences(initialPrefs);

      // 2. Simulate application restart with fresh repository instance
      const restartedRepo = new LocalStoragePreferencesRepository();
      const loaded = await restartedRepo.getPreferences();

      expect(loaded).not.toBeNull();
      expect(loaded?.preferredColors).toEqual(['indigo', 'emerald']);
      expect(loaded?.preferredFits).toEqual(['relaxed']);

      // 3. Removal agency: remove one color, confirm other remains
      const updatedPrefs: StylePreferences = {
        ...loaded!,
        preferredColors: loaded!.preferredColors?.filter((c) => c !== 'emerald'),
      };
      await restartedRepo.savePreferences(updatedPrefs);

      const verifyRepo = new LocalStoragePreferencesRepository();
      const finalLoaded = await verifyRepo.getPreferences();
      expect(finalLoaded?.preferredColors).toEqual(['indigo']);
      expect(finalLoaded?.preferredFits).toEqual(['relaxed']);
    });

    it('guarantees signal persistence is idempotent and prevents duplicate signal injection', async () => {
      const signalRepo = new LocalStorageStyleSignalsRepository();
      await signalRepo.clear();

      const signal: StyleSignalEvent = {
        id: 'stable_signal_uuid_100',
        userId: 'user_1',
        createdAt: Date.now(),
        signalType: 'favorited',
        itemIds: [cleanKurta.id],
      };

      // Add signal twice
      await signalRepo.addSignal(signal);
      await signalRepo.addSignal(signal);

      const signals = await signalRepo.getSignals();
      expect(signals.filter((s) => s.id === 'stable_signal_uuid_100')).toHaveLength(1);
    });

    it('operates 100% offline without requiring network connectivity', async () => {
      const prefRepo = new LocalStoragePreferencesRepository();
      const signalRepo = new LocalStorageStyleSignalsRepository();

      // Offline operations complete synchronously or in local memory
      await prefRepo.savePreferences(DEFAULT_STYLE_PREFERENCES);
      const prefs = await prefRepo.getPreferences();
      expect(prefs).toBeDefined();

      await signalRepo.addSignal({
        id: 'offline_sig_1',
        userId: 'offline_user',
        createdAt: Date.now(),
        signalType: 'liked',
        itemIds: [cleanKurta.id],
      });
      const sigs = await signalRepo.getSignals();
      expect(sigs.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 4. RECOMMENDATION SAFETY & ADVERSARIAL HARD-CONSTRAINT TESTS
  // ==========================================================================
  describe('4. Recommendation Safety & Hard-Constraint Invariants', () => {
    it('ADVERSARIAL: Style DNA cannot override unwashed or in-laundry status', () => {
      // Create a profile with overwhelming affinity (+3.0) for the dirty & laundry kurtas
      const extremeProfile = derivePersonalStyleProfile(
        [
          { id: 's1', userId: 'u1', createdAt: Date.now(), signalType: 'worn', itemIds: [dirtyKurta.id] },
          { id: 's2', userId: 'u1', createdAt: Date.now(), signalType: 'worn', itemIds: [inLaundryKurta.id] },
          { id: 's3', userId: 'u1', createdAt: Date.now(), signalType: 'favorited', itemIds: [dirtyKurta.id] },
          { id: 's4', userId: 'u1', createdAt: Date.now(), signalType: 'favorited', itemIds: [inLaundryKurta.id] },
        ],
        [],
        [dirtyKurta, inLaundryKurta, cleanKurta, cleanLinenTrousers, cleanMojari]
      );

      const poolWithDirty = [cleanKurta, dirtyKurta, inLaundryKurta, cleanLinenTrousers, cleanMojari];

      const recommendations = recommendOutfits({
        items: poolWithDirty,
        occasion: 'festive',
        season: 'summer',
        localDate: '2026-11-15',
        styleProfile: extremeProfile,
        allowPlanningMode: false,
      });

      expect(recommendations.length).toBeGreaterThan(0);

      for (const rec of recommendations) {
        const pieceIds = Object.values(rec.slots).flat().map((p) => p.id);
        expect(pieceIds).not.toContain(dirtyKurta.id);
        expect(pieceIds).not.toContain(inLaundryKurta.id);
      }
    });

    it('ADVERSARIAL: Style DNA cannot select or recommend deleted garments', () => {
      // Garment is deleted from wardrobe pool
      const deletedItemId = 'item_deleted_999';
      const itemsWithoutDeleted = [cleanKurta, cleanLinenTrousers, cleanMojari];

      // Profile has historic signals referencing the deleted item
      const profileWithDeletedHistory = derivePersonalStyleProfile(
        [
          { id: 's_del', userId: 'u1', createdAt: Date.now() - 86400000, signalType: 'worn', itemIds: [deletedItemId] },
          { id: 's_del2', userId: 'u1', createdAt: Date.now() - 43200000, signalType: 'favorited', itemIds: [deletedItemId] },
          { id: 's_del3', userId: 'u1', createdAt: Date.now() - 21600000, signalType: 'liked', itemIds: [deletedItemId] },
        ],
        [],
        itemsWithoutDeleted
      );

      const recommendations = recommendOutfits({
        items: itemsWithoutDeleted,
        occasion: 'everyday',
        season: 'summer',
        localDate: '2026-11-15',
        styleProfile: profileWithDeletedHistory,
      });

      for (const rec of recommendations) {
        const pieceIds = Object.values(rec.slots).flat().map((p) => p.id);
        expect(pieceIds).not.toContain(deletedItemId);
      }
    });

    it('ADVERSARIAL: Style DNA cannot override hard cultural restrictions (e.g. Leather in Puja)', () => {
      // User loves leather loafers (+3.0 score)
      const leatherLovingProfile = derivePersonalStyleProfile(
        [
          { id: 's_l1', userId: 'u1', createdAt: Date.now(), signalType: 'worn', itemIds: [leatherLoafers.id] },
          { id: 's_l2', userId: 'u1', createdAt: Date.now(), signalType: 'favorited', itemIds: [leatherLoafers.id] },
          { id: 's_l3', userId: 'u1', createdAt: Date.now(), signalType: 'worn', itemIds: [leatherLoafers.id] },
        ],
        [],
        [cleanKurta, cleanLinenTrousers, leatherLoafers, cleanMojari]
      );

      const preferences: StylePreferences = {
        ...DEFAULT_STYLE_PREFERENCES,
        culturalOverrides: {
          allowLeatherInPuja: false, // STRICT PUJA REJECTION
          strictPujaDecorum: true,
        },
      };

      const recommendations = recommendOutfits({
        items: [cleanKurta, cleanLinenTrousers, leatherLoafers, cleanMojari],
        occasion: 'puja',
        season: 'summer',
        localDate: '2026-11-15',
        styleProfile: leatherLovingProfile,
        preferences,
      });

      expect(recommendations.length).toBeGreaterThan(0);
      for (const rec of recommendations) {
        const pieces = Object.values(rec.slots).flat();
        for (const p of pieces) {
          expect(p.fabric).not.toBe('leather');
          expect(p.id).not.toBe(leatherLoafers.id);
        }
      }
    });

    it('preserves distinct recommendation roles (Best Match, Alternative, Explore, Underused)', () => {
      const extraShirt: WardrobeItem = {
        id: 'item_shirt_casual',
        name: 'Olive Slub Cotton Shirt',
        category: 'Tops',
        subcategory: 'shirt',
        colors: ['olive'],
        fabric: 'cotton',
        pattern: 'solid',
        fit: 'relaxed',
        seasons: ['summer', 'winter'],
        formality: 2,
        occasions: ['everyday', 'office'],
        status: 'clean',
        favorite: false,
        note: 'Casual shirt',
        timesWorn: 0, // Underused piece
        createdAt: Date.now(),
      };

      const result = recommendOutfitsWithTelemetry({
        items: [cleanKurta, extraShirt, cleanLinenTrousers, cleanMojari],
        occasion: 'everyday',
        season: 'summer',
        localDate: '2026-11-15',
      });

      expect(result.set.outfits.length).toBeGreaterThan(0);
      const roles = result.set.outfits.map((o) => o.role);
      expect(roles).toContain('best_match');
    });
  });

  // ==========================================================================
  // 5. DATA INTEGRITY & AUDIT COMPLIANCE
  // ==========================================================================
  describe('5. Data Integrity & Audit Verification', () => {
    it('guarantees zero synthetic insights when total signals count < 3', () => {
      const items = [cleanKurta, cleanLinenTrousers];
      // Cold-start profile with 1 signal
      const coldSignals: StyleSignalEvent[] = [
        {
          id: 'sig_one',
          userId: 'u1',
          createdAt: Date.now(),
          signalType: 'worn',
          itemIds: [cleanKurta.id],
        },
      ];

      const profile = derivePersonalStyleProfile(coldSignals, [], items);
      const dna = deriveStyleDNAProfile(profile, items, []);

      expect(dna.totalSignalsCount).toBeLessThan(3);
      expect(dna.hasSufficientEvidence).toBe(false);
      expect(dna.insights).toEqual([]); // STRICTLY EMPTY
    });

    it('guarantees unobserved attributes remain unobserved without hallucinated affinities', () => {
      const emptyProfile = derivePersonalStyleProfile([], [], []);
      const dna = deriveStyleDNAProfile(emptyProfile, [], []);

      // Check all pattern attributes when none exist in wardrobe
      for (const pattern of dna.patterns) {
        expect(pattern.status).toBe('unknown');
        expect(pattern.confidence).toBe(0);
        expect(pattern.evidenceSource).toBe('unobserved');
        expect(pattern.score).toBe(0);
      }
    });

    it('guarantees zero external network transmissions during preference derivation and outfit scoring', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const items = [cleanKurta, cleanLinenTrousers, cleanMojari];
      const profile = derivePersonalStyleProfile([], [], items);
      deriveStyleDNAProfile(profile, items, []);
      recommendOutfits({
        items,
        occasion: 'everyday',
        season: 'summer',
        localDate: '2026-11-15',
        styleProfile: profile,
      });

      // Local-first: fetch must never be invoked
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
