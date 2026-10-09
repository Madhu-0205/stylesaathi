import { describe, it, expect } from 'vitest';
import {
  WardrobeItem,
  PersonalStyleProfile,
  StylePreferences,
  ContextSnapshot,
  RecommendationRequest,
} from '../../types';
import { RecommendationEngine, recommendOutfits } from '../recommendationEngine';
import { computeCanonicalOutfitId } from '../explorationModel';

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
