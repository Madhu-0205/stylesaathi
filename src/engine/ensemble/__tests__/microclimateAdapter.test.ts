import { describe, it, expect } from 'vitest';
import {
  extractWeatherFeatures,
  extractGarmentContextFeatures,
  evaluateMicroclimateAdaptation,
} from '../microclimateAdapter';
import { WardrobeItem, ContextSnapshot, WeatherSnapshot } from '../../../types';

function createMockGarments(): Record<string, WardrobeItem> {
  return {
    cottonKurta: {
      id: 'g_cotton_kurta',
      name: 'White Handloom Cotton Kurta',
      category: 'Ethnic',
      subcategory: 'kurta',
      colors: ['white'],
      seasons: ['summer', 'monsoon'],
      occasions: ['everyday', 'college', 'family gathering'],
      formality: 2.5,
      status: 'clean',
      favorite: true,
      note: 'Pure cotton khadi',
      timesWorn: 4,
      fabric: 'cotton',
      pattern: 'solid',
      fit: 'regular',
      userVerified: true,
    },
    silkSaree: {
      id: 'g_silk_saree',
      name: 'Kanjeevaram Pure Silk Saree',
      category: 'Ethnic',
      subcategory: 'saree',
      colors: ['red', 'gold'],
      seasons: ['winter'],
      occasions: ['wedding guest', 'festive', 'celebration'],
      formality: 4.8,
      status: 'clean',
      favorite: true,
      note: 'Pure mulberry silk with zari',
      timesWorn: 2,
      fabric: 'silk',
      pattern: 'embroidered',
      userVerified: true,
    },
    woolSweater: {
      id: 'g_wool_sweater',
      name: 'Merino Wool Crewneck Sweater',
      category: 'Outerwear',
      subcategory: 'sweater',
      colors: ['charcoal'],
      seasons: ['winter'],
      occasions: ['everyday', 'office', 'casual outing'],
      formality: 3.0,
      status: 'clean',
      favorite: false,
      note: 'Warm merino wool',
      timesWorn: 5,
      fabric: 'wool',
      pattern: 'solid',
      userVerified: true,
    },
    formalBlazer: {
      id: 'g_formal_blazer',
      name: 'Navy Structured Wool-Blend Blazer',
      category: 'Outerwear',
      subcategory: 'blazer',
      colors: ['navy'],
      seasons: ['summer', 'monsoon', 'winter'],
      occasions: ['interview', 'office'],
      formality: 4.5,
      status: 'clean',
      favorite: true,
      note: 'Tailored two-button blazer',
      timesWorn: 8,
      fabric: 'wool',
      pattern: 'solid',
      userVerified: true,
    },
    leatherJuttis: {
      id: 'g_leather_juttis',
      name: 'Handcrafted Tan Leather Juttis',
      category: 'Footwear',
      subcategory: 'juttis',
      colors: ['tan'],
      seasons: ['summer', 'winter'],
      occasions: ['everyday', 'festive', 'family gathering'],
      formality: 3.2,
      status: 'clean',
      favorite: true,
      note: 'Untreated camel leather',
      timesWorn: 3,
      fabric: 'unknown',
      materialComposition: 'leather',
      userVerified: true,
    },
    rubberSandals: {
      id: 'g_rubber_sandals',
      name: 'Waterproof Strap Sandals',
      category: 'Footwear',
      subcategory: 'sandals',
      colors: ['black'],
      seasons: ['monsoon', 'summer'],
      occasions: ['everyday', 'casual outing'],
      formality: 1.5,
      status: 'clean',
      favorite: false,
      note: 'Water-resistant synthetic straps',
      timesWorn: 10,
      fabric: 'polyblend',
      userVerified: true,
    },
    sheerChiffonTop: {
      id: 'g_chiffon_top',
      name: 'Sheer Floral Chiffon Blouse',
      category: 'Tops',
      subcategory: 'top',
      colors: ['pink'],
      seasons: ['summer'],
      occasions: ['casual outing', 'date'],
      formality: 2.2,
      status: 'clean',
      favorite: false,
      note: '',
      timesWorn: 1,
      fabric: 'chiffon',
      userVerified: true,
    },
    unknownFabricPants: {
      id: 'g_unknown_pants',
      name: 'Camera Scan Casual Trousers',
      category: 'Bottoms',
      subcategory: 'trousers',
      colors: ['beige'],
      seasons: ['summer', 'winter'],
      occasions: ['everyday'],
      formality: 2.0,
      status: 'clean',
      favorite: false,
      note: 'Unlabelled item',
      timesWorn: 0,
      userVerified: false,
      fabric: 'unknown',
    },
  };
}

function createMockContext(overrides: Partial<WeatherSnapshot> = {}, contextOverrides: Partial<ContextSnapshot> = {}): ContextSnapshot {
  const baseWeather: WeatherSnapshot = {
    temperature: 28,
    feelsLike: 29,
    humidity: 50,
    precipitationProbability: 10,
    windSpeed: 10,
    condition: 'sunny',
    observedAt: Date.now() - 5 * 60 * 1000,
    expiresAt: Date.now() + 25 * 60 * 1000,
    source: 'live',
    location: { city: 'Mumbai', state: 'Maharashtra', country: 'India', latitude: 19.076, longitude: 72.8777 },
    ...overrides,
  };

  return {
    weather: baseWeather,
    freshness: 'fresh',
    location: baseWeather.location,
    date: '2026-11-06',
    timeOfDay: 'afternoon',
    thermalContext: 'warm',
    rainContext: 'none',
    occasion: 'everyday',
    confidence: 0.95,
    source: 'live',
    ...contextOverrides,
  };
}

describe('StyleSaathi 3.0 — Phase 5B: Contextual Microclimate Adaptation', () => {
  const garments = createMockGarments();

  it('1. Hot & Humid Indian Conditions: rewards verified breathable cotton and flags unbreathable heat distress', () => {
    // Mumbai / Chennai coastal pre-monsoon heat: 34°C, 82% humidity
    const context = createMockContext({
      temperature: 34,
      feelsLike: 42,
      humidity: 82,
      precipitationProbability: 15,
      windSpeed: 8,
    });

    const outfit = [garments.cottonKurta, garments.unknownFabricPants, garments.rubberSandals];
    const res = evaluateMicroclimateAdaptation(outfit, {
      occasion: 'everyday',
      context,
    });

    expect(res.scoreDelta).toBeGreaterThan(0.0);
    expect(res.appliedRules).toContain('breathable_fabric_heat_bonus');
    expect(res.reasons.some((r) => r.toLowerCase().includes('humid heat') || r.toLowerCase().includes('breathable'))).toBe(true);
    expect(res.weatherFeatures.effectiveThermalIndex).toBeGreaterThan(34);
  });

  it('2. Heavy Monsoon Rainfall: penalizes delicate silk and leather juttis, rewards water-tolerant sandals', () => {
    // Heavy monsoon rain: 26°C, 92% humidity, 85% precipitation probability
    const context = createMockContext({
      temperature: 26,
      feelsLike: 27,
      humidity: 92,
      precipitationProbability: 85,
    }, {
      rainContext: 'active_rain',
    });

    // Outfit with delicate silk and leather juttis
    const delicateOutfit = [garments.silkSaree, garments.leatherJuttis];
    const delRes = evaluateMicroclimateAdaptation(delicateOutfit, {
      occasion: 'family gathering',
      context,
    });

    expect(delRes.scoreDelta).toBeLessThan(0.0);
    expect(delRes.appliedRules).toContain('delicate_fabric_rain_penalty');
    expect(delRes.appliedRules).toContain('delicate_footwear_rain_penalty');
    expect(delRes.warnings.some((w) => w.toLowerCase().includes('water-spotting') || w.toLowerCase().includes('water damage'))).toBe(true);

    // Practical outfit with water-tolerant sandals
    const practicalOutfit = [garments.cottonKurta, garments.rubberSandals];
    const pracRes = evaluateMicroclimateAdaptation(practicalOutfit, {
      occasion: 'everyday',
      context,
    });

    expect(pracRes.appliedRules).toContain('practical_footwear_rain_bonus');
    expect(pracRes.reasons.some((r) => r.toLowerCase().includes('rain-tolerant'))).toBe(true);
  });

  it('3. Cool Weather & Layering: rewards insulating wool knit and outerwear, penalizes single sheer layer', () => {
    // Delhi / North Indian winter morning: 14°C, 45% humidity, calm
    const context = createMockContext({
      temperature: 14,
      feelsLike: 13,
      humidity: 45,
      precipitationProbability: 5,
      windSpeed: 12,
    }, {
      thermalContext: 'cool',
    });

    // Outfit with wool sweater
    const warmOutfit = [garments.woolSweater, garments.unknownFabricPants];
    const warmRes = evaluateMicroclimateAdaptation(warmOutfit, {
      occasion: 'casual outing',
      context,
    });

    expect(warmRes.scoreDelta).toBeGreaterThan(0.0);
    expect(warmRes.appliedRules).toContain('insulating_fabric_cold_bonus');
    expect(warmRes.appliedRules).toContain('outerwear_layering_cold_bonus');

    // Outfit with sheer chiffon without outer layer
    const sheerOutfit = [garments.sheerChiffonTop, garments.unknownFabricPants];
    const sheerRes = evaluateMicroclimateAdaptation(sheerOutfit, {
      occasion: 'casual outing',
      context,
    });

    expect(sheerRes.scoreDelta).toBeLessThan(0.0);
    expect(sheerRes.appliedRules).toContain('sheer_single_layer_cold_penalty');
  });

  it('4. Windy Conditions: rewards structured windbreak layers and notes wind chill convective cooling', () => {
    // Breezy cool day: 16°C, wind speed 35 km/h
    const context = createMockContext({
      temperature: 16,
      feelsLike: 14,
      humidity: 40,
      windSpeed: 35,
    }, {
      thermalContext: 'cool',
    });

    const structuredOutfit = [garments.formalBlazer, garments.unknownFabricPants];
    const res = evaluateMicroclimateAdaptation(structuredOutfit, {
      occasion: 'office',
      context,
    });

    expect(res.appliedRules).toContain('structured_windbreak_bonus');
    expect(res.appliedRules).toContain('wind_chill_convective_cooling');
    expect(res.reasons.some((r) => r.toLowerCase().includes('wind resistance'))).toBe(true);
  });

  it('5. Missing Weather Data: provides graceful fallback with scoreDelta = 0.0 and zero fabric penalties', () => {
    const context: ContextSnapshot = {
      weather: null,
      freshness: 'unavailable',
      location: { city: 'Pune', country: 'India' },
      date: '2026-11-06',
      timeOfDay: 'morning',
      thermalContext: 'mild',
      rainContext: 'none',
      occasion: 'college',
      confidence: 0.0,
      source: 'unavailable',
    };

    const outfit = [garments.cottonKurta, garments.leatherJuttis];
    const res = evaluateMicroclimateAdaptation(outfit, {
      occasion: 'college',
      context,
    });

    expect(res.scoreDelta).toBe(0.0);
    expect(res.confidence).toBe(0.0);
    expect(res.appliedRules).toContain('weather_unavailable_graceful_fallback');
    expect(res.reasons.length).toBe(0);
    expect(res.warnings.length).toBe(0);
  });

  it('6. Stale Weather Data: dampens score influence by 50% and explicitly annotates earlier cache', () => {
    const context = createMockContext({
      temperature: 35,
      humidity: 75,
    }, {
      freshness: 'stale',
      source: 'cached',
    });

    const outfit = [garments.cottonKurta, garments.rubberSandals];
    const res = evaluateMicroclimateAdaptation(outfit, {
      occasion: 'casual outing',
      context,
    });

    expect(res.appliedRules).toContain('stale_weather_dampening_50pct');
    expect(res.weatherFeatures.isStale).toBe(true);
    expect(res.confidence).toBe(0.45);
    expect(res.reasons[0]).toContain('(Earlier weather cache)');
  });

  it('7. Unknown Fabric: unknown metadata remains strictly neutral (never treated as incompatible)', () => {
    const context = createMockContext({
      temperature: 34,
      humidity: 80,
    });

    // Outfit consisting purely of an unlabelled item with fabric: 'unknown'
    const unknownOutfit = [garments.unknownFabricPants];
    const res = evaluateMicroclimateAdaptation(unknownOutfit, {
      occasion: 'everyday',
      context,
    });

    // Crucial guarantee: unknown fabric is NOT penalized for lacking breathability
    expect(res.scoreDelta).toBe(0.0);
    expect(res.warnings.length).toBe(0);
  });

  it('8. Incomplete / Unconfirmed Garment Metadata: maintains honest uncertainty provenance', () => {
    const unconfirmedItem = garments.unknownFabricPants;
    const feat = extractGarmentContextFeatures(unconfirmedItem);

    expect(feat.fabric.provenance).toBe('unknown');
    expect(feat.fabric.confidence).toBe(0.0);
    expect(feat.breathability.isUnknown).toBe(true);
    expect(feat.waterSensitivity.isUnknown).toBe(true);
    expect(feat.hasVerifiedMetadata).toBe(false);
  });

  it('9. Explicit User Comfort Preference: warmth sensitivity modulates thermal response without overriding user', () => {
    const context = createMockContext({
      temperature: 33,
      humidity: 78,
    });

    // Outfit with wool blazer in warm weather
    const outfit = [garments.formalBlazer];

    // User A: Runs warm (easily overheated)
    const resWarm = evaluateMicroclimateAdaptation(outfit, {
      occasion: 'casual outing',
      context,
      preferences: {
        preferredContexts: [],
        preferredAesthetics: [],
        stylingMode: 'simple',
        updatedAt: Date.now(),
        comfortPreferences: { warmthSensitivity: 'runs_warm' },
      },
    });

    // User B: Runs cold (tolerates / seeks warmth)
    const resCold = evaluateMicroclimateAdaptation(outfit, {
      occasion: 'casual outing',
      context,
      preferences: {
        preferredContexts: [],
        preferredAesthetics: [],
        stylingMode: 'simple',
        updatedAt: Date.now(),
        comfortPreferences: { warmthSensitivity: 'runs_cold' },
      },
    });

    // The user who runs warm receives a strictly larger heat penalty for heavy wool than the user who runs cold
    expect(resWarm.scoreDelta).toBeLessThan(resCold.scoreDelta);
  });

  it('10. Cultural & Formal Occasion Constraints: interview blazer in heat is softened for professional decorum', () => {
    const context = createMockContext({
      temperature: 32,
      humidity: 60,
    });

    const outfit = [garments.formalBlazer, garments.unknownFabricPants];

    // Casual context: blazer is heavily penalized for being hot
    const casualRes = evaluateMicroclimateAdaptation(outfit, {
      occasion: 'casual outing',
      context,
    });

    // Interview context: formal decorum requirement softens heat penalty
    const interviewRes = evaluateMicroclimateAdaptation(outfit, {
      occasion: 'interview',
      context,
    });

    expect(interviewRes.scoreDelta).toBeGreaterThan(casualRes.scoreDelta);
    expect(interviewRes.appliedRules).toContain('formal_heat_softening');
  });

  it('11. Offline Operation: cached weather is used when fresh or stale, never fabricates fake numbers', () => {
    const cachedWeather: WeatherSnapshot = {
      temperature: 24,
      feelsLike: 24,
      humidity: 55,
      precipitationProbability: 0,
      windSpeed: 8,
      condition: 'partly_cloudy',
      observedAt: Date.now() - 15 * 60 * 1000,
      expiresAt: Date.now() + 15 * 60 * 1000,
      source: 'cached',
      location: { city: 'Bengaluru', country: 'India' },
    };

    const context: ContextSnapshot = {
      weather: cachedWeather,
      freshness: 'fresh',
      location: cachedWeather.location,
      date: '2026-11-06',
      timeOfDay: 'afternoon',
      thermalContext: 'mild',
      rainContext: 'none',
      occasion: 'office',
      confidence: 0.85,
      source: 'cached',
    };

    const res = evaluateMicroclimateAdaptation([garments.cottonKurta], {
      occasion: 'office',
      context,
    });

    expect(res.weatherFeatures.isUsable).toBe(true);
    expect(res.weatherFeatures.temperature.provenance).toBe('cached_weather');
  });

  it('12. Neutral Weather Context: mild 22°C room-temp day produces 0.0 delta without changing recommendations', () => {
    const context = createMockContext({
      temperature: 22,
      feelsLike: 22,
      humidity: 50,
      precipitationProbability: 5,
      windSpeed: 5,
    }, {
      thermalContext: 'mild',
      rainContext: 'none',
    });

    const outfit = [garments.cottonKurta, garments.unknownFabricPants];
    const res = evaluateMicroclimateAdaptation(outfit, {
      occasion: 'everyday',
      context,
    });

    expect(res.scoreDelta).toBe(0.0);
    expect(res.reasons.length).toBe(0);
    expect(res.warnings.length).toBe(0);
  });

  it('13. Immutability & Determinism Guarantee: inputs remain unmutated and 100 repeated runs are bit-for-bit identical', () => {
    const context = Object.freeze(createMockContext({
      temperature: 33,
      humidity: 75,
      precipitationProbability: 60,
    }));

    const outfit = Object.freeze([
      Object.freeze(garments.cottonKurta),
      Object.freeze(garments.rubberSandals),
    ]);

    const firstRun = evaluateMicroclimateAdaptation(outfit as WardrobeItem[], {
      occasion: 'casual outing',
      context,
    });

    for (let i = 0; i < 100; i++) {
      const subsequentRun = evaluateMicroclimateAdaptation(outfit as WardrobeItem[], {
        occasion: 'casual outing',
        context,
      });
      expect(subsequentRun.scoreDelta).toBe(firstRun.scoreDelta);
      expect(subsequentRun.appliedRules).toEqual(firstRun.appliedRules);
      expect(subsequentRun.reasons).toEqual(firstRun.reasons);
    }
  });
});
