import { describe, it, expect, beforeEach } from 'vitest';
import { LocalWeatherCache, WEATHER_CACHE_KEY, FRESH_TTL_MS, STALE_TTL_MS } from '../weatherCache';
import { WeatherSnapshot, WeatherLocation } from '../../../types';

describe('Phase 4: Local Weather Cache', () => {
  beforeEach(() => {
    LocalWeatherCache.clear();
  });

  const dummyLocation: WeatherLocation = {
    city: 'Bengaluru',
    country: 'India',
    latitude: 12.97,
    longitude: 77.59,
    source: 'manual',
  };

  const dummySnapshot: WeatherSnapshot = {
    temperature: 28,
    feelsLike: 30,
    humidity: 60,
    precipitationProbability: 10,
    windSpeed: 12,
    condition: 'partly_cloudy',
    conditionText: 'Partly Cloudy',
    observedAt: Date.now(),
    expiresAt: Date.now() + 30 * 60 * 1000,
    source: 'test',
    location: dummyLocation,
  };

  it('correctly calculates freshness tiers based on age', () => {
    const now = Date.now();
    expect(LocalWeatherCache.getFreshness(now - 5 * 60 * 1000, now)).toBe('fresh'); // 5 mins ago
    expect(LocalWeatherCache.getFreshness(now - 45 * 60 * 1000, now)).toBe('stale'); // 45 mins ago
    expect(LocalWeatherCache.getFreshness(now - 7 * 60 * 60 * 1000, now)).toBe('expired'); // 7 hrs ago
    expect(LocalWeatherCache.getFreshness(0, now)).toBe('unavailable');
    expect(LocalWeatherCache.getFreshness(now + 1000, now)).toBe('unavailable');
  });

  it('stores and retrieves weather snapshot successfully', () => {
    LocalWeatherCache.set(dummySnapshot);
    const cached = LocalWeatherCache.get();

    expect(cached).not.toBeNull();
    expect(cached?.entry.snapshot.temperature).toBe(28);
    expect(cached?.entry.snapshot.location.city).toBe('Bengaluru');
    expect(cached?.freshness).toBe('fresh');
  });

  it('safely recovers and clears corrupted cache without throwing errors', () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(WEATHER_CACHE_KEY, 'corrupted{non-json');
    }

    const cached = LocalWeatherCache.get();
    expect(cached).toBeNull();
  });

  it('safely handles missing snapshot fields in cached record', () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(
        WEATHER_CACHE_KEY,
        JSON.stringify({ cachedAt: Date.now(), snapshot: { temperature: 'not-a-number' } })
      );
    }

    const cached = LocalWeatherCache.get();
    expect(cached).toBeNull();
  });

  it('persists and retrieves user location preference', () => {
    const loc: WeatherLocation = {
      city: 'Kolkata',
      region: 'West Bengal',
      country: 'India',
      source: 'manual',
    };
    LocalWeatherCache.setLocation(loc);

    const saved = LocalWeatherCache.getLocation();
    expect(saved.city).toBe('Kolkata');
    expect(saved.country).toBe('India');
  });
});
