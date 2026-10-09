import { describe, it, expect, beforeEach } from 'vitest';
import {
  WeatherService,
} from '../services/weather/weatherService';
import {
  LocalWeatherCache,
  FRESH_TTL_MS,
} from '../services/weather/weatherCache';
import { DeterministicFallbackWeatherProvider } from '../services/weather/fallbackProvider';
import {
  calculateOutfitScore,
  generateOutfits,
} from '../engine';
import { createContextSnapshot } from '../engine/contextEngine';
import { getContextWhyReasons } from '../engine/contextScoring';
import { derivePersonalStyleProfile } from '../engine/styleBrain';
import {
  WardrobeItem,
  WeatherSnapshot,
  WeatherProvider,
  WeatherLocation,
  PersonalStyleProfile,
} from '../types';

describe('Phase 4 Final Correction & Lock Gate: Verification Suite', () => {
  const sampleLocation: WeatherLocation = {
    city: 'Bengaluru',
    region: 'Karnataka',
    country: 'India',
    latitude: 12.97,
    longitude: 77.59,
    timezone: 'Asia/Kolkata',
    source: 'manual',
  };

  const samplePieces: WardrobeItem[] = [
    {
      id: 'gate-kurta-01',
      name: 'Khadi Cotton Kurta',
      category: 'Tops',
      subcategory: 'kurta',
      colors: ['white'],
      seasons: ['summer'],
      occasions: ['college', 'everyday'],
      formality: 2.0,
      status: 'clean',
      favorite: true,
      note: '',
      timesWorn: 0,
      fabric: 'cotton',
      fit: 'relaxed',
    },
    {
      id: 'gate-jeans-01',
      name: 'Slim Fit Blue Denim',
      category: 'Bottoms',
      subcategory: 'jeans',
      colors: ['blue'],
      seasons: ['summer'],
      occasions: ['college', 'everyday'],
      formality: 2.0,
      status: 'clean',
      favorite: false,
      note: '',
      timesWorn: 1,
      fabric: 'denim',
      fit: 'slim',
    },
    {
      id: 'gate-sandals-01',
      name: 'Casual Strap Sandals',
      category: 'Footwear',
      subcategory: 'sandals',
      colors: ['black'],
      seasons: ['summer'],
      occasions: ['college', 'everyday'],
      formality: 1.8,
      status: 'clean',
      favorite: false,
      note: '',
      timesWorn: 0,
    },
  ];

  const nowEpoch = Date.now();
  const sampleProfile: PersonalStyleProfile = derivePersonalStyleProfile(
    [
      { id: 'sig-1', userId: 'user-1', signalType: 'worn', itemIds: ['gate-kurta-01'], createdAt: nowEpoch },
      { id: 'sig-2', userId: 'user-1', signalType: 'saved', itemIds: ['gate-kurta-01'], createdAt: nowEpoch },
    ],
    [],
    samplePieces,
    undefined,
    nowEpoch
  );

  beforeEach(() => {
    LocalWeatherCache.clear();
  });

  // ==========================================================================
  // 1. WEATHER HONESTY & RESOLUTION HIERARCHY
  // ==========================================================================
  describe('1. Weather Honesty & Resolution Hierarchy', () => {
    it('1.1 Fresh verified live weather returns fresh status and live source', async () => {
      const mockLiveProvider: WeatherProvider = {
        id: 'mock_live',
        name: 'Mock Live Station',
        getCurrentWeather: async (loc) => ({
          temperature: 29.5,
          feelsLike: 31.0,
          humidity: 60,
          precipitationProbability: 10,
          windSpeed: 12,
          condition: 'partly_cloudy',
          conditionText: 'Pleasant Breeze',
          observedAt: Date.now(),
          expiresAt: Date.now() + 30 * 60 * 1000,
          source: 'live',
          location: loc,
        }),
      };

      const service = new WeatherService(mockLiveProvider);
      const result = await service.getCurrentWeather(sampleLocation);

      expect(result.snapshot).not.toBeNull();
      expect(result.snapshot?.temperature).toBe(29.5);
      expect(result.freshness).toBe('fresh');
      expect(result.snapshot?.source).toBe('live');
    });

    it('1.2 Cached weather returns cached status and cached source', async () => {
      const snapshot: WeatherSnapshot = {
        temperature: 28,
        feelsLike: 29,
        humidity: 50,
        precipitationProbability: 0,
        windSpeed: 8,
        condition: 'clear',
        conditionText: 'Clear Sky',
        observedAt: Date.now(),
        expiresAt: Date.now() + 30 * 60 * 1000,
        source: 'live',
        location: sampleLocation,
      };

      LocalWeatherCache.set(snapshot);

      // Failing live provider
      const failingProvider: WeatherProvider = {
        id: 'failing',
        name: 'Failing Provider',
        getCurrentWeather: async () => {
          throw new Error('Network error');
        },
      };

      const service = new WeatherService(failingProvider);
      const result = await service.getCurrentWeather(sampleLocation);

      expect(result.snapshot).not.toBeNull();
      expect(result.freshness).toBe('fresh');
      expect(result.snapshot?.source).toBe('cached');
      expect(result.snapshot?.temperature).toBe(28);
    });

    it('1.3 Stale cache returns stale status and is clearly marked stale', async () => {
      const baseTime = 1000000000000;
      const originalNow = Date.now;
      try {
        Date.now = () => baseTime;

        const snapshot: WeatherSnapshot = {
          temperature: 27,
          feelsLike: 27,
          humidity: 55,
          precipitationProbability: 0,
          windSpeed: 10,
          condition: 'partly_cloudy',
          conditionText: 'Partly Cloudy',
          observedAt: baseTime,
          expiresAt: baseTime + 30 * 60 * 1000,
          source: 'live',
          location: sampleLocation,
        };

        LocalWeatherCache.set(snapshot);

        // Advance time past fresh TTL (35 minutes later)
        Date.now = () => baseTime + FRESH_TTL_MS + 5 * 60 * 1000;

        const failingProvider: WeatherProvider = {
          id: 'failing',
          name: 'Failing Provider',
          getCurrentWeather: async () => {
            throw new Error('Offline timeout');
          },
        };

        const service = new WeatherService(failingProvider);
        const result = await service.getCurrentWeather(sampleLocation);

        expect(result.snapshot).not.toBeNull();
        expect(result.freshness).toBe('stale');
        expect(result.snapshot?.source).toBe('cached');
      } finally {
        Date.now = originalNow;
      }
    });

    it('1.4 Simulated fallback is NEVER presented as live current weather in production', async () => {
      const failingProvider: WeatherProvider = {
        id: 'failing',
        name: 'Failing Provider',
        getCurrentWeather: async () => {
          throw new Error('Total connectivity failure');
        },
      };

      const fallback = new DeterministicFallbackWeatherProvider();
      const service = new WeatherService(failingProvider, fallback);

      // Default production flow without explicit allowSimulation flag
      const result = await service.getCurrentWeather(sampleLocation);

      // Must return unavailable with NULL snapshot, NEVER fabricated fake current numbers
      expect(result.snapshot).toBeNull();
      expect(result.forecast).toBeNull();
      expect(result.freshness).toBe('unavailable');
    });

    it('1.5 DeterministicFallbackWeatherProvider explicitly labels itself as simulated', async () => {
      const fallback = new DeterministicFallbackWeatherProvider();
      expect(fallback.id).toBe('simulated_fallback');
      expect(fallback.name).toContain('Simulation');

      const snapshot = await fallback.getCurrentWeather(sampleLocation);
      expect(snapshot.source).toBe('simulated');
    });

    it('1.6 Weather explanations are NEVER generated from simulated or unavailable weather', () => {
      const unavailableContext = createContextSnapshot({
        location: sampleLocation,
        weather: null,
        freshness: 'unavailable',
        occasion: 'college',
      });
      expect(getContextWhyReasons(samplePieces, unavailableContext)).toEqual([]);

      const simulatedContext = createContextSnapshot({
        location: sampleLocation,
        weather: {
          temperature: 36,
          feelsLike: 40,
          humidity: 70,
          precipitationProbability: 0,
          windSpeed: 10,
          condition: 'hot',
          observedAt: Date.now(),
          expiresAt: Date.now() + 30000,
          source: 'simulated',
          location: sampleLocation,
        },
        occasion: 'college',
      });
      expect(getContextWhyReasons(samplePieces, simulatedContext)).toEqual([]);
    });
  });

  // ==========================================================================
  // 2. DETERMINISTIC SCORING & STABLE RANKING
  // ==========================================================================
  describe('2. Deterministic Domain Scoring & Stable Ranking', () => {
    it('2.1 calculateOutfitScore produces identical scores for identical inputs across multiple runs', () => {
      const context = createContextSnapshot({
        location: sampleLocation,
        weather: {
          temperature: 30,
          feelsLike: 32,
          humidity: 60,
          precipitationProbability: 0,
          windSpeed: 10,
          condition: 'partly_cloudy',
          observedAt: Date.now(),
          expiresAt: Date.now() + 30000,
          source: 'live',
          location: sampleLocation,
        },
        occasion: 'college',
      });

      const score1 = calculateOutfitScore(samplePieces, 'college', 0.1, undefined, sampleProfile, context);
      const score2 = calculateOutfitScore(samplePieces, 'college', 0.9, undefined, sampleProfile, context);
      const score3 = calculateOutfitScore(samplePieces, 'college', 0.5, undefined, sampleProfile, context);
      const score4 = calculateOutfitScore(samplePieces, 'college', 0, undefined, sampleProfile, context);

      // Zero unseeded jitter: score1 === score2 === score3 === score4
      expect(score1).toBe(score2);
      expect(score2).toBe(score3);
      expect(score3).toBe(score4);
    });

    it('2.2 generateOutfits produces identical ranking and identical signatures across consecutive runs', () => {
      const context = createContextSnapshot({
        location: sampleLocation,
        weather: null,
        occasion: 'college',
      });

      const run1 = generateOutfits(samplePieces, 'college', 'summer', 4, 0, undefined, sampleProfile, context);
      const run2 = generateOutfits(samplePieces, 'college', 'summer', 4, 0, undefined, sampleProfile, context);
      const run3 = generateOutfits(samplePieces, 'college', 'summer', 4, 0, undefined, sampleProfile, context);

      expect(run1.length).toBe(run2.length);
      expect(run2.length).toBe(run3.length);

      for (let i = 0; i < run1.length; i++) {
        expect(run1[i].score).toBe(run2[i].score);
        expect(run2[i].score).toBe(run3[i].score);
        expect(run1[i].template).toBe(run2[i].template);

        const ids1 = Object.values(run1[i].slots).flat().map((p) => p.id).sort().join('|');
        const ids2 = Object.values(run2[i].slots).flat().map((p) => p.id).sort().join('|');
        const ids3 = Object.values(run3[i].slots).flat().map((p) => p.id).sort().join('|');
        expect(ids1).toBe(ids2);
        expect(ids2).toBe(ids3);
      }
    });
  });

  // ==========================================================================
  // 3. OFFLINE BEHAVIOR & GRACEFUL DEGRADATION
  // ==========================================================================
  describe('3. Offline Behavior & Graceful Degradation', () => {
    it('3.1 Offline with zero weather continues to generate valid outfits using wardrobe, occasion, and style brain', () => {
      const offlineContext = createContextSnapshot({
        location: sampleLocation,
        weather: null,
        freshness: 'unavailable',
        occasion: 'college',
      });

      const outfits = generateOutfits(
        samplePieces,
        'college',
        'summer',
        4,
        0,
        undefined,
        sampleProfile,
        offlineContext
      );

      expect(outfits.length).toBeGreaterThan(0);
      expect(outfits[0].slots).toBeDefined();
      expect(outfits[0].score).toBeGreaterThan(0);
      // Explanations should exist for style harmony, not fabricated weather
      expect(outfits[0].why.length).toBeGreaterThan(0);
      expect(outfits[0].why.toLowerCase().includes('°c')).toBe(false);
    });
  });
});
