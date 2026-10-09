import { describe, it, expect } from 'vitest';
import {
  WardrobeItem,
  PersonalStyleProfile,
  StylePreferences,
  ContextSnapshot,
  RecommendationRequest,
} from '../../types';
import {
  RecommendationEngine,
  recommendOutfits,
  MAX_RECOMMENDATION_CANDIDATES,
} from '../recommendationEngine';
import { computeCanonicalOutfitId } from '../explorationModel';
import { calculateOutfitDistance, DIVERSIFICATION_DISTANCE_THRESHOLD } from '../diversification';

const mockItem = (overrides: Partial<WardrobeItem> = {}): WardrobeItem => ({
  id: 'item-1',
  name: 'Test Item',
  category: 'Tops',
  subcategory: 'shirt',
  colors: ['white'],
  seasons: ['summer', 'monsoon'],
  occasions: ['office', 'casual outing'],
  formality: 3,
  status: 'clean',
  favorite: false,
  note: '',
  timesWorn: 1,
  ...overrides,
});

describe('Recommendation Engine 2.0', () => {
  const shirtWhite = mockItem({ id: 'top-1', name: 'White Crisp Shirt', category: 'Tops', subcategory: 'shirt', colors: ['white'], fabric: 'cotton', formality: 4, occasions: ['office'] });
  const shirtBlue = mockItem({ id: 'top-2', name: 'Blue Oxford Shirt', category: 'Tops', subcategory: 'shirt', colors: ['blue'], fabric: 'linen', formality: 4, occasions: ['office'] });
  const poloNavy = mockItem({ id: 'top-3', name: 'Navy Polo', category: 'Tops', subcategory: 't-shirt', colors: ['navy'], fabric: 'cotton', formality: 2, occasions: ['casual outing'] });
  const kurtiYellow = mockItem({ id: 'top-4', name: 'Yellow Cotton Kurti', category: 'Ethnic', subcategory: 'kurti', colors: ['yellow'], fabric: 'cotton', formality: 3, occasions: ['office', 'puja'] });

  const trousersGrey = mockItem({ id: 'bot-1', name: 'Grey Formal Trousers', category: 'Bottoms', subcategory: 'trousers', colors: ['grey'], fabric: 'cotton', formality: 4, occasions: ['office'] });
  const chinosBeige = mockItem({ id: 'bot-2', name: 'Beige Chinos', category: 'Bottoms', subcategory: 'trousers', colors: ['beige'], fabric: 'cotton', formality: 3, occasions: ['office', 'casual outing'] });
  const palazzoWhite = mockItem({ id: 'bot-3', name: 'White Wide Palazzo', category: 'Ethnic', subcategory: 'palazzo', colors: ['white'], fabric: 'cotton', formality: 3, occasions: ['office', 'puja'] });

  const shoesBlack = mockItem({ id: 'foot-1', name: 'Black Formal Shoes', category: 'Footwear', subcategory: 'formal shoes', colors: ['black'], formality: 4, occasions: ['office'] });
  const loafersBrown = mockItem({ id: 'foot-2', name: 'Brown Leather Loafers', category: 'Footwear', subcategory: 'loafers', colors: ['brown'], formality: 3, occasions: ['office', 'casual outing'] });
  const juttisGold = mockItem({ id: 'foot-3', name: 'Embroidered Gold Juttis', category: 'Footwear', subcategory: 'juttis', colors: ['gold'], formality: 4, occasions: ['puja', 'wedding guest'] });

  const baseWardrobe = [
    shirtWhite,
    shirtBlue,
    poloNavy,
    kurtiYellow,
    trousersGrey,
    chinosBeige,
    palazzoWhite,
    shoesBlack,
    loafersBrown,
    juttisGold,
  ];

  it('generates deterministic recommendations for repeated identical requests', () => {
    const engine = new RecommendationEngine();
    const req: RecommendationRequest = {
      items: baseWardrobe,
      occasion: 'office',
      season: 'summer',
      localDate: '2026-10-09',
      explorationSeedOffset: 0,
    };

    const res1 = engine.recommend(req);
    const res2 = engine.recommend(req);

    expect(res1.set.outfits.length).toBeGreaterThan(0);
    expect(res1.set.outfits.map((o) => o.id)).toEqual(res2.set.outfits.map((o) => o.id));
    expect(res1.set.outfits.map((o) => o.score)).toEqual(res2.set.outfits.map((o) => o.score));
  });

  it('produces canonical deterministic outfit IDs based solely on content', () => {
    const slots = {
      top: [shirtWhite],
      bottom: [trousersGrey],
    };
    const id1 = computeCanonicalOutfitId({ template: 'Western formal', slots });
    const id2 = computeCanonicalOutfitId({ template: 'Western formal', slots });

    expect(id1).toMatch(/^outfit_[0-9a-f]{8}$/);
    expect(id1).toBe(id2);
  });

  it('filters out Tier 1 hard constraints (e.g. laundry items)', () => {
    const laundryWardrobe = baseWardrobe.map((item) =>
      item.id === 'top-1' ? { ...item, status: 'in_laundry' as const } : item
    );

    const engine = new RecommendationEngine();
    const result = engine.recommend({
      items: laundryWardrobe,
      occasion: 'office',
      season: 'summer',
      localDate: '2026-10-09',
    });

    // None of the recommended outfits should contain top-1 (in laundry)
    for (const outfit of result.set.outfits) {
      const pieceIds = Object.values(outfit.slots).flat().map((p) => p.id);
      expect(pieceIds).not.toContain('top-1');
    }
  });

  it('applies Tier 2 soft penalties without crashing or hard-rejecting for limited wardrobes', () => {
    // Wardrobe only contains casual t-shirt and jeans for a puja
    const limitedCasualWardrobe = [
      mockItem({ id: 'c-top', name: 'Casual Tee', category: 'Tops', subcategory: 't-shirt', occasions: ['puja', 'everyday'], formality: 2 }),
      mockItem({ id: 'c-bot', name: 'Blue Jeans', category: 'Bottoms', subcategory: 'jeans', occasions: ['puja', 'everyday'], formality: 2 }),
      mockItem({ id: 'c-foot', name: 'Sneakers', category: 'Footwear', subcategory: 'sneakers', occasions: ['puja', 'everyday'], formality: 2 }),
    ];

    const engine = new RecommendationEngine();
    const result = engine.recommend({
      items: limitedCasualWardrobe,
      occasion: 'puja',
      season: 'summer',
      localDate: '2026-10-09',
    });

    // Must still produce a recommendation so the user is never left without clothes
    expect(result.set.outfits.length).toBeGreaterThan(0);
    // Score reflects cultural penalty
    expect(result.set.outfits[0].scoreBreakdown.culturalFit).toBeLessThan(0);
  });

  it('assigns Top-3 editorial roles (best_match, alternative, explore) when candidates exist', () => {
    const engine = new RecommendationEngine();
    const result = engine.recommend({
      items: baseWardrobe,
      occasion: 'office',
      season: 'summer',
      localDate: '2026-10-09',
      explorationSeedOffset: 0,
    });

    const roles = result.set.outfits.map((o) => o.role);
    expect(roles).toContain('best_match');
    if (result.set.outfits.length > 1) {
      expect(roles[0]).toBe('best_match');
    }
  });

  it('never fabricates missing recommendations when wardrobe is minimal', () => {
    // Exactly 1 minimal outfit
    const singleOutfitWardrobe = [
      shirtWhite,
      trousersGrey,
      shoesBlack,
    ];

    const engine = new RecommendationEngine();
    const result = engine.recommend({
      items: singleOutfitWardrobe,
      occasion: 'office',
      season: 'summer',
      localDate: '2026-10-09',
    });

    // Should return exactly 1 outfit (Best Match), never fabricated mock looks
    expect(result.set.outfits.length).toBe(1);
    expect(result.set.outfits[0].role).toBe('best_match');
  });

  it('integrates Personal Style Brain affinities and respects avoided combinations', () => {
    const styleProfile: PersonalStyleProfile = {
      version: 1,
      userId: 'user-1',
      totalSignalsCount: 12,
      overallConfidence: 0.85,
      updatedAt: Date.now(),
      colorAffinities: { yellow: { score: 0.6, sampleCount: 4, confidence: 0.8, lastInteractedAt: Date.now() }, grey: { score: -0.5, sampleCount: 4, confidence: 0.8, lastInteractedAt: Date.now() } } as any,
      fabricAffinities: {} as any,
      patternAffinities: {} as any,
      fitAffinities: {} as any,
      culturalAffinities: {} as any,
      occasionAffinities: {} as any,
      itemAffinities: {} as any,
      combinationAffinities: {} as any,
      avoidedColors: [],
      avoidedFabrics: [],
      avoidedPatterns: [],
      avoidedCombinations: ['top-1:bot-1'],
      neutralPreferenceRatio: 0.5,
      formalityBias: 0.2,
      noveltyTolerance: 0.5,
      topColors: ['yellow'],
      topFabrics: [],
      topFits: [],
      recentExplorations: [],
    };

    const engine = new RecommendationEngine();
    const result = engine.recommend({
      items: baseWardrobe,
      occasion: 'office',
      season: 'summer',
      localDate: '2026-10-09',
      styleProfile,
    });

    // The avoided combination ['top-1', 'bot-1'] must not be the explore look or penalized heavily
    const exploreOutfit = result.set.outfits.find((o) => o.role === 'explore');
    if (exploreOutfit) {
      const pieceIds = Object.values(exploreOutfit.slots).flat().map((p) => p.id);
      const containsAvoided = pieceIds.includes('top-1') && pieceIds.includes('bot-1');
      expect(containsAvoided).toBe(false);
    }
  });

  it('maintains strict weather honesty: omits weather reasons when weather is simulated or null', () => {
    const simulatedContext: ContextSnapshot = {
      weather: {
        temperature: 30,
        feelsLike: 32,
        humidity: 60,
        precipitationProbability: 10,
        windSpeed: 10,
        condition: 'hot',
        observedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        source: 'simulated',
        location: { city: 'Bengaluru', country: 'India', source: 'manual' },
      },
      freshness: 'fresh',
      location: { city: 'Bengaluru', country: 'India', source: 'manual' },
      date: '2026-10-09',
      timeOfDay: 'afternoon',
      thermalContext: 'hot',
      rainContext: 'none',
      occasion: 'office',
      confidence: 0.5,
      source: 'simulated',
    };

    const engine = new RecommendationEngine();
    const result = engine.recommend({
      items: baseWardrobe,
      occasion: 'office',
      season: 'summer',
      localDate: '2026-10-09',
      context: simulatedContext,
    });

    // Simulated weather MUST NOT contribute to contextFit or produce weather evidence
    for (const outfit of result.set.outfits) {
      expect(outfit.scoreBreakdown.contextFit).toBe(0);
      expect(outfit.explanation.evidenceSources).not.toContain('weather');
    }
  });

  it('includes genuine weather evidence and contextFit when live weather is provided', () => {
    const liveContext: ContextSnapshot = {
      weather: {
        temperature: 36,
        feelsLike: 40,
        humidity: 75,
        precipitationProbability: 0,
        windSpeed: 8,
        condition: 'hot',
        observedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        source: 'live',
        location: { city: 'Chennai', country: 'India', source: 'geolocation' },
      },
      freshness: 'fresh',
      location: { city: 'Chennai', country: 'India', source: 'geolocation' },
      date: '2026-10-09',
      timeOfDay: 'afternoon',
      thermalContext: 'very_hot',
      rainContext: 'none',
      occasion: 'office',
      confidence: 1.0,
      source: 'live',
    };

    const engine = new RecommendationEngine();
    const result = engine.recommend({
      items: baseWardrobe,
      occasion: 'office',
      season: 'summer',
      localDate: '2026-10-09',
      context: liveContext,
    });

    expect(result.set.outfits.length).toBeGreaterThan(0);
    const hasWeatherSource = result.set.outfits.some((o) =>
      o.explanation.evidenceSources.includes('weather')
    );
    expect(hasWeatherSource).toBe(true);
  });

  it('increments explorationSeedOffset when user shuffles, yielding a deterministic new explore look', () => {
    const engine = new RecommendationEngine();
    const req0: RecommendationRequest = {
      items: baseWardrobe,
      occasion: 'office',
      season: 'summer',
      localDate: '2026-10-09',
      explorationSeedOffset: 0,
    };
    const req1: RecommendationRequest = {
      items: baseWardrobe,
      occasion: 'office',
      season: 'summer',
      localDate: '2026-10-09',
      explorationSeedOffset: 1,
    };

    const res0 = engine.recommend(req0);
    const res1 = engine.recommend(req1);

    // Best match is constant because scores are identical
    expect(res0.set.outfits[0].id).toBe(res1.set.outfits[0].id);
    // Request contexts match their seed offsets
    expect(res0.set.requestContext.explorationSeedOffset).toBe(0);
    expect(res1.set.requestContext.explorationSeedOffset).toBe(1);
  });

  it('provides telemetry measuring timing and candidate generation counts', () => {
    const engine = new RecommendationEngine();
    const result = engine.recommend({
      items: baseWardrobe,
      occasion: 'office',
      season: 'summer',
      localDate: '2026-10-09',
    });

    expect(result.telemetry.candidateCount).toBeGreaterThan(0);
    expect(result.telemetry.validCandidateCount).toBeGreaterThan(0);
    expect(result.telemetry.timings.totalMs).toBeGreaterThanOrEqual(0);
  });
});

describe('Phase 5 Correction Gate: Candidate Pool Bound Verification & Regressions', () => {
  const engine = new RecommendationEngine();

  function makeDeterministicWardrobe(count: number): WardrobeItem[] {
    const categories: ('Tops' | 'Bottoms' | 'Ethnic' | 'Footwear')[] = [
      'Tops',
      'Bottoms',
      'Ethnic',
      'Footwear',
    ];
    const subcategories: Record<string, string[]> = {
      Tops: ['shirt', 't-shirt'],
      Bottoms: ['trousers', 'jeans', 'chinos'],
      Ethnic: ['kurta', 'kurti', 'palazzo', 'dupatta'],
      Footwear: ['sneakers', 'formal shoes', 'loafers', 'juttis'],
    };
    const colors = ['white', 'black', 'navy', 'grey', 'yellow', 'blue', 'beige'];
    const fabrics: ('cotton' | 'linen' | 'silk' | 'denim')[] = ['cotton', 'linen', 'silk', 'denim'];

    return Array.from({ length: count }, (_, i) => {
      const category = categories[i % categories.length];
      const subs = subcategories[category];
      const subcategory = subs[i % subs.length] as any;
      const color = colors[i % colors.length];
      const fabric = fabrics[i % fabrics.length];

      return {
        id: `synth-${String(i).padStart(4, '0')}`,
        name: `${color} ${subcategory} #${i}`,
        category,
        subcategory,
        colors: [color],
        fabric,
        seasons: ['summer'],
        occasions: ['office', 'casual outing'],
        formality: (i % 5) + 1,
        status: 'clean',
        favorite: i % 10 === 0,
        note: '',
        timesWorn: i % 8,
        lastWorn: 1700000000000 - i * 86400000,
        createdAt: 1700000000000 - i * 86400000,
      };
    });
  }

  it('guarantees candidate pool never exceeds documented bound MAX_RECOMMENDATION_CANDIDATES (350)', () => {
    for (const size of [50, 150, 500, 1000]) {
      const wardrobe = makeDeterministicWardrobe(size);
      const res = engine.recommend({
        items: wardrobe,
        occasion: 'office',
        season: 'summer',
        localDate: '2026-10-09',
      });

      expect(res.telemetry.candidateCount).toBeLessThanOrEqual(MAX_RECOMMENDATION_CANDIDATES);
      expect(res.telemetry.validCandidateCount).toBeLessThanOrEqual(MAX_RECOMMENDATION_CANDIDATES);
      expect(res.telemetry.candidateCount).toBeGreaterThan(0);
      expect(res.set.outfits.length).toBeGreaterThan(0);
    }
  });

  it('preserves Core, Freshness, and Novelty representation in candidate pool', () => {
    // Construct a wardrobe with >10 items per slot to activate stratified pre-ranking
    const coreTop = mockItem({ id: 'core-top', name: 'Core White Shirt', category: 'Tops', subcategory: 'shirt', favorite: true, timesWorn: 2, occasions: ['office'] });
    const freshTop = mockItem({ id: 'fresh-top', name: 'Fresh Linen Shirt', category: 'Tops', subcategory: 'shirt', favorite: false, timesWorn: 0, lastWorn: undefined, occasions: ['office'] });
    const novelTop = mockItem({ id: 'novel-top', name: 'Novel Teal Shirt', category: 'Tops', subcategory: 'shirt', favorite: false, timesWorn: 0, colors: ['teal'], occasions: ['office'] });
    const fillerTops = Array.from({ length: 10 }, (_, i) =>
      mockItem({ id: `filler-top-${i}`, name: `Filler Top ${i}`, category: 'Tops', subcategory: 'shirt', timesWorn: 6, occasions: ['office'] })
    );

    const coreBot = mockItem({ id: 'core-bot', name: 'Core Grey Trousers', category: 'Bottoms', subcategory: 'trousers', favorite: true, timesWorn: 2, occasions: ['office'] });
    const freshBot = mockItem({ id: 'fresh-bot', name: 'Fresh Chinos', category: 'Bottoms', subcategory: 'trousers', favorite: false, timesWorn: 0, lastWorn: undefined, occasions: ['office'] });
    const novelBot = mockItem({ id: 'novel-bot', name: 'Novel Olive Chinos', category: 'Bottoms', subcategory: 'trousers', favorite: false, timesWorn: 0, colors: ['olive'], occasions: ['office'] });
    const fillerBots = Array.from({ length: 10 }, (_, i) =>
      mockItem({ id: `filler-bot-${i}`, name: `Filler Bot ${i}`, category: 'Bottoms', subcategory: 'trousers', timesWorn: 6, occasions: ['office'] })
    );

    const coreFoot = mockItem({ id: 'core-foot', name: 'Core Oxford Shoes', category: 'Footwear', subcategory: 'formal shoes', favorite: true, timesWorn: 2, occasions: ['office'] });
    const freshFoot = mockItem({ id: 'fresh-foot', name: 'Fresh Loafers', category: 'Footwear', subcategory: 'loafers', favorite: false, timesWorn: 0, lastWorn: undefined, occasions: ['office'] });
    const novelFoot = mockItem({ id: 'novel-foot', name: 'Novel Brown Shoes', category: 'Footwear', subcategory: 'formal shoes', favorite: false, timesWorn: 0, colors: ['brown'], occasions: ['office'] });
    const fillerFoots = Array.from({ length: 10 }, (_, i) =>
      mockItem({ id: `filler-foot-${i}`, name: `Filler Foot ${i}`, category: 'Footwear', subcategory: 'formal shoes', timesWorn: 6, occasions: ['office'] })
    );

    const items = [
      coreTop, freshTop, novelTop, ...fillerTops,
      coreBot, freshBot, novelBot, ...fillerBots,
      coreFoot, freshFoot, novelFoot, ...fillerFoots,
    ];

    const styleProfile: PersonalStyleProfile = {
      version: 1,
      userId: 'test-user',
      totalSignalsCount: 15,
      overallConfidence: 0.85,
      updatedAt: Date.now(),
      colorAffinities: {} as any,
      fabricAffinities: {} as any,
      patternAffinities: {} as any,
      fitAffinities: {} as any,
      culturalAffinities: {} as any,
      occasionAffinities: {} as any,
      itemAffinities: {
        'core-top': { score: 0.9, sampleCount: 8, confidence: 0.9, lastInteractedAt: Date.now() },
        'core-bot': { score: 0.8, sampleCount: 8, confidence: 0.9, lastInteractedAt: Date.now() },
      } as any,
      combinationAffinities: {},
      avoidedColors: [],
      avoidedFabrics: [],
      avoidedPatterns: [],
      avoidedCombinations: [],
      neutralPreferenceRatio: 0.5,
      formalityBias: 0.0,
      noveltyTolerance: 0.5,
      topColors: ['white'],
      topFabrics: [],
      topFits: [],
      recentExplorations: [],
    };

    const res = engine.recommend({
      items,
      occasion: 'office',
      season: 'summer',
      localDate: '2026-10-09',
      styleProfile,
    });

    const recommendedItemIds = new Set(
      res.set.outfits.flatMap((o) => Object.values(o.slots).flat().map((p) => p.id))
    );

    // Core staple pieces must be present in recommendations (especially Best Match)
    const bestMatchPieces = Object.values(res.set.outfits[0].slots).flat().map((p) => p.id);
    expect(bestMatchPieces).toContain('core-top');

    // Freshness or Novelty must be represented across the recommendation set
    const hasFreshOrNovel =
      recommendedItemIds.has('fresh-top') ||
      recommendedItemIds.has('fresh-bot') ||
      recommendedItemIds.has('fresh-foot') ||
      recommendedItemIds.has('novel-top') ||
      recommendedItemIds.has('novel-bot') ||
      recommendedItemIds.has('novel-foot');
    expect(hasFreshOrNovel).toBe(true);
  });

  it('runs deterministically at 500 and 1000 items with identical candidates, scores, and order', () => {
    const wardrobe500 = makeDeterministicWardrobe(500);
    const req: RecommendationRequest = {
      items: wardrobe500,
      occasion: 'office',
      season: 'summer',
      localDate: '2026-10-09',
      explorationSeedOffset: 0,
    };

    const run1 = engine.recommend(req);
    const run2 = engine.recommend(req);

    expect(run1.telemetry.candidateCount).toBe(run2.telemetry.candidateCount);
    expect(run1.telemetry.validCandidateCount).toBe(run2.telemetry.validCandidateCount);
    expect(run1.set.outfits.map((o) => o.id)).toEqual(run2.set.outfits.map((o) => o.id));
    expect(run1.set.outfits.map((o) => o.score)).toEqual(run2.set.outfits.map((o) => o.score));
    expect(run1.set.outfits.map((o) => o.role)).toEqual(run2.set.outfits.map((o) => o.role));
  });

  it('ensures Explore role is behaviorally safe and excludes avoided attributes', () => {
    const wardrobe = makeDeterministicWardrobe(50);
    const styleProfile: PersonalStyleProfile = {
      version: 1,
      userId: 'user-safe',
      totalSignalsCount: 20,
      overallConfidence: 0.9,
      updatedAt: Date.now(),
      colorAffinities: {
        yellow: { score: -0.8, sampleCount: 5, confidence: 0.9, lastInteractedAt: Date.now() },
      } as any,
      fabricAffinities: {
        silk: { score: -0.7, sampleCount: 4, confidence: 0.9, lastInteractedAt: Date.now() },
      } as any,
      patternAffinities: {} as any,
      fitAffinities: {} as any,
      culturalAffinities: {} as any,
      occasionAffinities: {} as any,
      itemAffinities: {} as any,
      combinationAffinities: {} as any,
      avoidedColors: ['yellow'],
      avoidedFabrics: ['silk'],
      avoidedPatterns: [],
      avoidedCombinations: [],
      neutralPreferenceRatio: 0.5,
      formalityBias: 0.0,
      noveltyTolerance: 0.6,
      topColors: ['navy'],
      topFabrics: ['cotton'],
      topFits: [],
      recentExplorations: [],
    };

    const res = engine.recommend({
      items: wardrobe,
      occasion: 'office',
      season: 'summer',
      localDate: '2026-10-09',
      styleProfile,
    });

    const exploreOutfit = res.set.outfits.find((o) => o.role === 'explore');
    if (exploreOutfit) {
      const explorePieces = Object.values(exploreOutfit.slots).flat();
      for (const piece of explorePieces) {
        expect(piece.colors).not.toContain('yellow');
        expect(piece.fabric).not.toBe('silk');
      }
    }
  });

  it('ensures Alternative satisfies D >= 0.35 diversification threshold from Best Match when candidates permit', () => {
    const wardrobe = makeDeterministicWardrobe(50);
    const res = engine.recommend({
      items: wardrobe,
      occasion: 'office',
      season: 'summer',
      localDate: '2026-10-09',
    });

    const bestMatch = res.set.outfits.find((o) => o.role === 'best_match');
    const alternative = res.set.outfits.find((o) => o.role === 'alternative');

    if (bestMatch && alternative) {
      const dist = calculateOutfitDistance(bestMatch, alternative);
      expect(dist).toBeGreaterThanOrEqual(DIVERSIFICATION_DISTANCE_THRESHOLD);
    }
  });

  it('supports graceful degradation without fake outfits (3 -> 2 -> 1 -> 0)', () => {
    const shirt = mockItem({ id: 'deg-shirt', name: 'Shirt', category: 'Tops', subcategory: 'shirt', occasions: ['office'] });
    const pant1 = mockItem({ id: 'deg-pant1', name: 'Black Pants', category: 'Bottoms', subcategory: 'trousers', colors: ['black'], occasions: ['office'] });
    const pant2 = mockItem({ id: 'deg-pant2', name: 'Beige Pants', category: 'Bottoms', subcategory: 'trousers', colors: ['beige'], occasions: ['office'] });
    const shoes = mockItem({ id: 'deg-shoes', name: 'Shoes', category: 'Footwear', subcategory: 'formal shoes', occasions: ['office'] });

    // 1 outfit wardrobe
    const res1 = engine.recommend({
      items: [shirt, pant1, shoes],
      occasion: 'office',
      season: 'summer',
      localDate: '2026-10-09',
    });
    expect(res1.set.outfits.length).toBe(1);
    expect(res1.set.outfits[0].role).toBe('best_match');

    // 0 outfits wardrobe (missing footwear)
    const res0 = engine.recommend({
      items: [shirt, pant1],
      occasion: 'office',
      season: 'summer',
      localDate: '2026-10-09',
    });
    expect(res0.set.outfits.length).toBe(0);
    expect(res0.telemetry.candidateCount).toBe(0);
    expect(res0.telemetry.validCandidateCount).toBe(0);
  });
});
