import { describe, it, expect } from 'vitest';
import { generateOutfits, calculateOutfitScore, generateOutfitWhy } from '../engine';
import { createContextSnapshot } from '../engine/contextEngine';
import { WardrobeItem, ContextSnapshot, PersonalStyleProfile } from '../types';

describe('Phase 4: Weather & Context Engine End-to-End Integration', () => {
  // Wardrobe containing a spectrum of Indian climate clothing
  const summerTee: WardrobeItem = {
    id: 'piece-tee-01',
    name: 'Airy Cotton Crewneck',
    category: 'Tops',
    subcategory: 't-shirt',
    colors: ['white'],
    seasons: ['summer'],
    occasions: ['college', 'casual outing'],
    formality: 1.8,
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 0,
    fabric: 'cotton',
    fit: 'regular',
  };

  const linenPants: WardrobeItem = {
    id: 'piece-pants-01',
    name: 'Relaxed Linen Trousers',
    category: 'Bottoms',
    subcategory: 'trousers',
    colors: ['beige'],
    seasons: ['summer'],
    occasions: ['college', 'casual outing'],
    formality: 2.2,
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 0,
    fabric: 'linen',
    fit: 'relaxed',
  };

  const woolSweater: WardrobeItem = {
    id: 'piece-sweater-01',
    name: 'Heavy Wool Cardigan',
    category: 'Tops',
    subcategory: 'sweater',
    colors: ['navy'],
    seasons: ['summer', 'winter'], // tagged for summer to test algorithmic filtering
    occasions: ['college', 'casual outing'],
    formality: 2.2,
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 0,
    fabric: 'wool',
    fit: 'regular',
  };

  const denimJeans: WardrobeItem = {
    id: 'piece-jeans-01',
    name: 'Heavy Raw Denim Jeans',
    category: 'Bottoms',
    subcategory: 'jeans',
    colors: ['blue'],
    seasons: ['summer', 'winter'],
    occasions: ['college', 'casual outing'],
    formality: 2.0,
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 0,
    fabric: 'denim',
    fit: 'slim',
  };

  const practicalSandals: WardrobeItem = {
    id: 'piece-sandals-01',
    name: 'Everyday Strap Sandals',
    category: 'Footwear',
    subcategory: 'sandals',
    colors: ['black'],
    seasons: ['summer', 'monsoon'],
    occasions: ['college', 'casual outing'],
    formality: 1.6,
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 0,
  };

  const delicateJuttis: WardrobeItem = {
    id: 'piece-juttis-01',
    name: 'Raw Leather Handcrafted Juttis',
    category: 'Footwear',
    subcategory: 'juttis',
    colors: ['tan'],
    seasons: ['summer', 'monsoon'],
    occasions: ['college', 'casual outing'],
    formality: 2.8,
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 0,
  };

  const allItems = [
    summerTee,
    linenPants,
    woolSweater,
    denimJeans,
    practicalSandals,
    delicateJuttis,
  ];

  it('ranks breathable cotton + linen higher on a 36°C hot summer day', () => {
    const hotContext: ContextSnapshot = createContextSnapshot({
      location: { city: 'Ahmedabad', country: 'India', source: 'manual' },
      weather: {
        temperature: 36,
        feelsLike: 40,
        humidity: 65,
        precipitationProbability: 0,
        windSpeed: 10,
        condition: 'hot',
        observedAt: Date.now(),
        expiresAt: Date.now() + 30000,
        source: 'open_meteo',
        location: { city: 'Ahmedabad', country: 'India', source: 'manual' },
      },
      occasion: 'college',
    });

    const outfits = generateOutfits(
      allItems,
      'college',
      'summer',
      4,
      0.5,
      undefined,
      undefined,
      hotContext
    );

    expect(outfits.length).toBeGreaterThan(0);
    const topLookPieces = Object.values(outfits[0].slots).flat();

    // Top recommended outfit in 36°C heat should favor the airy cotton tee
    expect(topLookPieces.some((p) => p.id === 'piece-tee-01')).toBe(true);

    // Score comparison between breathable look vs heavy wool look
    const breathableScore = calculateOutfitScore(
      [summerTee, linenPants, practicalSandals],
      'college',
      0.5,
      undefined,
      undefined,
      hotContext
    );

    const heavyScore = calculateOutfitScore(
      [woolSweater, denimJeans, practicalSandals],
      'college',
      0.5,
      undefined,
      undefined,
      hotContext
    );

    expect(breathableScore).toBeGreaterThan(heavyScore);
  });

  it('ranks water-tolerant footwear above delicate leather in active monsoon rain', () => {
    const rainyContext: ContextSnapshot = createContextSnapshot({
      location: { city: 'Mumbai', country: 'India', source: 'manual' },
      weather: {
        temperature: 28,
        feelsLike: 31,
        humidity: 88,
        precipitationProbability: 90,
        windSpeed: 18,
        condition: 'rain',
        observedAt: Date.now(),
        expiresAt: Date.now() + 30000,
        source: 'open_meteo',
        location: { city: 'Mumbai', country: 'India', source: 'manual' },
      },
      occasion: 'casual outing',
    });

    const sandalScore = calculateOutfitScore(
      [summerTee, linenPants, practicalSandals],
      'casual outing',
      0.5,
      undefined,
      undefined,
      rainyContext
    );

    const juttiScore = calculateOutfitScore(
      [summerTee, linenPants, delicateJuttis],
      'casual outing',
      0.5,
      undefined,
      undefined,
      rainyContext
    );

    expect(sandalScore).toBeGreaterThan(juttiScore);
  });

  it('harmoniously combines PersonalStyleProfile and ContextSnapshot', () => {
    // User learned profile has strong affinity for linen
    const mockProfile: PersonalStyleProfile = {
      version: 1,
      userId: 'user-test',
      updatedAt: Date.now(),
      overallConfidence: 0.8,
      totalSignalsCount: 15,
      colorAffinities: {},
      fabricAffinities: {
        linen: { score: 0.9, confidence: 0.85, sampleCount: 10, lastInteractedAt: Date.now() },
        cotton: { score: 0.5, confidence: 0.7, sampleCount: 8, lastInteractedAt: Date.now() },
        wool: { score: -0.8, confidence: 0.8, sampleCount: 5, lastInteractedAt: Date.now() },
      } as any,
      patternAffinities: {} as any,
      fitAffinities: {} as any,
      culturalAffinities: {} as any,
      occasionAffinities: {} as any,
      itemAffinities: {},
      combinationAffinities: {},
      avoidedColors: [],
      avoidedFabrics: ['wool'],
      avoidedPatterns: [],
      avoidedCombinations: [],
      neutralPreferenceRatio: 0.7,
      formalityBias: -0.2,
      noveltyTolerance: 0.5,
      topColors: ['beige', 'white'],
      topFabrics: ['linen', 'cotton'],
      topFits: ['relaxed'],
      recentExplorations: [],
    };

    const warmContext: ContextSnapshot = createContextSnapshot({
      location: { city: 'Bengaluru', country: 'India', source: 'manual' },
      weather: {
        temperature: 29,
        feelsLike: 30,
        humidity: 60,
        precipitationProbability: 10,
        windSpeed: 10,
        condition: 'partly_cloudy',
        observedAt: Date.now(),
        expiresAt: Date.now() + 30000,
        source: 'open_meteo',
        location: { city: 'Bengaluru', country: 'India', source: 'manual' },
      },
      occasion: 'college',
    });

    const combinedScore = calculateOutfitScore(
      [summerTee, linenPants, practicalSandals],
      'college',
      0.5,
      undefined,
      mockProfile,
      warmContext
    );

    const baseScore = calculateOutfitScore(
      [summerTee, linenPants, practicalSandals],
      'college',
      0.5
    );

    // Combined score reflects both personal style boost and climate comfort
    expect(combinedScore).toBeGreaterThan(baseScore);
  });

  it('includes climate context in generated why explanations when weather exists', () => {
    const hotContext: ContextSnapshot = createContextSnapshot({
      location: { city: 'Delhi NCR', country: 'India', source: 'manual' },
      weather: {
        temperature: 34,
        feelsLike: 37,
        humidity: 65,
        precipitationProbability: 0,
        windSpeed: 10,
        condition: 'hot',
        observedAt: Date.now(),
        expiresAt: Date.now() + 30000,
        source: 'open_meteo',
        location: { city: 'Delhi NCR', country: 'India', source: 'manual' },
      },
      occasion: 'college',
    });

    const whyText = generateOutfitWhy(
      [summerTee, linenPants, practicalSandals],
      'college',
      3.5,
      undefined,
      undefined,
      hotContext
    );

    expect(whyText.toLowerCase()).toMatch(/breathable|warm|heat|34°c/);
  });

  it('gracefully degrades when context or weather is null (offline/cold start)', () => {
    const outfitsWithoutContext = generateOutfits(allItems, 'college', 'summer', 4, 0.5);
    expect(outfitsWithoutContext.length).toBeGreaterThan(0);

    const emptyContext: ContextSnapshot = createContextSnapshot({
      location: { city: 'Bengaluru', country: 'India', source: 'manual' },
      weather: null,
      occasion: 'college',
    });

    const outfitsWithEmptyContext = generateOutfits(
      allItems,
      'college',
      'summer',
      4,
      0.5,
      undefined,
      undefined,
      emptyContext
    );

    expect(outfitsWithEmptyContext.length).toBe(outfitsWithoutContext.length);
  });
});
