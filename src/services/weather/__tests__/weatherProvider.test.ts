import { describe, it, expect } from 'vitest';
import {
  mapWmoCodeToCondition,
  validateAndNormalizeWeatherSnapshot,
} from '../weatherProvider';
import {
  findClosestIndianCity,
  DEFAULT_INDIAN_LOCATION,
} from '../indianCities';
import { DeterministicFallbackWeatherProvider } from '../fallbackProvider';
import { WeatherLocation, WeatherSnapshot } from '../../../types';

describe('Phase 4: Weather Provider & Normalization', () => {
  describe('1. WMO Weather Code Mapping', () => {
    it('correctly maps standard WMO codes to domain weather conditions', () => {
      expect(mapWmoCodeToCondition(0).condition).toBe('clear');
      expect(mapWmoCodeToCondition(1).condition).toBe('clear');
      expect(mapWmoCodeToCondition(2).condition).toBe('partly_cloudy');
      expect(mapWmoCodeToCondition(3).condition).toBe('cloudy');
      expect(mapWmoCodeToCondition(45).condition).toBe('fog');
      expect(mapWmoCodeToCondition(51).condition).toBe('drizzle');
      expect(mapWmoCodeToCondition(61).condition).toBe('rain');
      expect(mapWmoCodeToCondition(65).condition).toBe('heavy_rain');
      expect(mapWmoCodeToCondition(71).condition).toBe('cold');
      expect(mapWmoCodeToCondition(80).condition).toBe('rain');
      expect(mapWmoCodeToCondition(82).condition).toBe('heavy_rain');
      expect(mapWmoCodeToCondition(95).condition).toBe('thunderstorm');
      expect(mapWmoCodeToCondition(999).condition).toBe('unknown');
    });

    it('provides user-friendly descriptive condition texts', () => {
      expect(mapWmoCodeToCondition(0).text).toBe('Clear Sky');
      expect(mapWmoCodeToCondition(65).text).toBe('Heavy Downpour');
      expect(mapWmoCodeToCondition(95).text).toBe('Thunderstorm');
    });
  });

  describe('2. Weather Snapshot Validation & Safety Clamping', () => {
    it('safely clamps absurd temperatures into realistic bounds', () => {
      const crazyHigh: Partial<WeatherSnapshot> = {
        temperature: 999,
        feelsLike: 1200,
      };
      const normalizedHigh = validateAndNormalizeWeatherSnapshot(crazyHigh, DEFAULT_INDIAN_LOCATION);
      expect(normalizedHigh.temperature).toBe(60);
      expect(normalizedHigh.feelsLike).toBe(65);

      const crazyLow: Partial<WeatherSnapshot> = {
        temperature: -150,
        feelsLike: -200,
      };
      const normalizedLow = validateAndNormalizeWeatherSnapshot(crazyLow, DEFAULT_INDIAN_LOCATION);
      expect(normalizedLow.temperature).toBe(-40);
      expect(normalizedLow.feelsLike).toBe(-45);
    });

    it('safely clamps humidity and precipitation percentages between 0 and 100', () => {
      const badPercents: Partial<WeatherSnapshot> = {
        humidity: -20,
        precipitationProbability: 150,
      };
      const normalized = validateAndNormalizeWeatherSnapshot(badPercents, DEFAULT_INDIAN_LOCATION);
      expect(normalized.humidity).toBe(0);
      expect(normalized.precipitationProbability).toBe(100);
    });

    it('safely handles missing location using the provided fallback', () => {
      const normalized = validateAndNormalizeWeatherSnapshot({ temperature: 30 }, DEFAULT_INDIAN_LOCATION);
      expect(normalized.location.city).toBe('Bengaluru');
      expect(normalized.location.country).toBe('India');
      expect(normalized.temperature).toBe(30);
      expect(normalized.expiresAt).toBeGreaterThan(Date.now());
    });
  });

  describe('3. Indian Coordinate Snapping (Privacy-Preserving)', () => {
    it('snaps coordinates near Mumbai to Mumbai profile', () => {
      // Coarse coords near Navi Mumbai
      const city = findClosestIndianCity(19.03, 73.02);
      expect(city.city).toBe('Mumbai');
      expect(city.climateZone).toBe('coastal_humid');
    });

    it('snaps coordinates near Delhi to Delhi NCR profile', () => {
      // Coarse coords near Gurgaon / Noida
      const city = findClosestIndianCity(28.45, 77.02);
      expect(city.city).toBe('Delhi NCR');
      expect(city.climateZone).toBe('subtropical_extreme');
    });

    it('snaps coordinates near Bengaluru to Bengaluru profile', () => {
      // Coarse coords near Whitefield
      const city = findClosestIndianCity(12.96, 77.74);
      expect(city.city).toBe('Bengaluru');
      expect(city.climateZone).toBe('deccan_moderate');
    });
  });

  describe('4. Deterministic Fallback Weather Provider', () => {
    it('produces valid snapshot and forecast for offline environments', async () => {
      const provider = new DeterministicFallbackWeatherProvider();
      const location: WeatherLocation = {
        city: 'Mumbai',
        country: 'India',
        latitude: 19.07,
        longitude: 72.87,
        source: 'manual',
      };

      const snapshot = await provider.getCurrentWeather(location);
      expect(snapshot.temperature).toBeGreaterThan(15);
      expect(snapshot.temperature).toBeLessThan(45);
      expect(snapshot.humidity).toBeGreaterThan(20);
      expect(snapshot.source).toBe('simulated');
      expect(snapshot.location.city).toBe('Mumbai');

      const forecast = await provider.getForecast!(location);
      expect(forecast.periods.length).toBe(3);
      expect(forecast.periods[0].period).toBe('today');
      expect(forecast.periods[2].period).toBe('tomorrow');
    });
  });
});
