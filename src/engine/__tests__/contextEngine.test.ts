import { describe, it, expect } from 'vitest';
import {
  calculateApparentTemperature,
  calculateThermalContext,
  calculateRainContext,
  getTimeOfDay,
  deriveSeasonalContext,
  createContextSnapshot,
} from '../contextEngine';
import { WeatherLocation, WeatherSnapshot } from '../../types';

describe('Phase 4: Context Engine & Indian Climate Intelligence', () => {
  describe('1. Apparent Temperature (Steadman Indian Heat Index)', () => {
    it('amplifies perceived thermal heat when relative humidity is high', () => {
      // 32°C at 40% humidity vs 32°C at 85% humidity (Coastal Mumbai/Chennai)
      const dryApparent = calculateApparentTemperature(32, 40, 10);
      const humidApparent = calculateApparentTemperature(32, 85, 10);

      expect(humidApparent).toBeGreaterThan(dryApparent);
      expect(humidApparent).toBeGreaterThanOrEqual(37); // feels at least 5 degrees hotter
    });

    it('accounts for cooling wind in moderate conditions', () => {
      const calm = calculateApparentTemperature(20, 50, 5);
      const windy = calculateApparentTemperature(20, 50, 30);
      expect(windy).toBeLessThan(calm);
    });
  });

  describe('2. Thermal Context Derivation', () => {
    it('classifies temperature >= 38°C as very_hot', () => {
      expect(calculateThermalContext(39, 42, 50, 10)).toBe('very_hot');
    });

    it('classifies humid heat (33°C + 85% humidity) as very_hot or hot', () => {
      const context = calculateThermalContext(33, 39, 85, 10);
      expect(['hot', 'very_hot']).toContain(context);
    });

    it('classifies 28°C mild warmth as warm', () => {
      expect(calculateThermalContext(27, 28, 50, 10)).toBe('warm');
    });

    it('classifies 22°C as mild', () => {
      expect(calculateThermalContext(22, 22, 50, 10)).toBe('mild');
    });

    it('classifies 15°C as cool', () => {
      expect(calculateThermalContext(15, 14, 50, 10)).toBe('cool');
    });

    it('classifies 10°C as cold', () => {
      expect(calculateThermalContext(10, 9, 50, 10)).toBe('cold');
    });

    it('classifies < 8°C as very_cold', () => {
      expect(calculateThermalContext(6, 4, 50, 10)).toBe('very_cold');
    });
  });

  describe('3. Rain Context Derivation', () => {
    it('flags active_rain when condition is rain or drizzle', () => {
      expect(calculateRainContext('rain', 80)).toBe('active_rain');
      expect(calculateRainContext('heavy_rain', 90)).toBe('active_rain');
      expect(calculateRainContext('thunderstorm', 75)).toBe('active_rain');
      expect(calculateRainContext('drizzle', 50)).toBe('active_rain');
    });

    it('flags high_risk when precipitationProbability >= 60%', () => {
      expect(calculateRainContext('cloudy', 70)).toBe('high_risk');
    });

    it('flags low_risk when precipitationProbability between 25% and 59%', () => {
      expect(calculateRainContext('partly_cloudy', 35)).toBe('low_risk');
    });

    it('flags none when precipitationProbability < 25%', () => {
      expect(calculateRainContext('clear', 10)).toBe('none');
    });
  });

  describe('4. Time of Day', () => {
    it('correctly maps morning, afternoon, evening, and night', () => {
      const morning = new Date(2026, 9, 8, 9, 0, 0);
      const afternoon = new Date(2026, 9, 8, 14, 0, 0);
      const evening = new Date(2026, 9, 8, 19, 0, 0);
      const night = new Date(2026, 9, 8, 23, 0, 0);

      expect(getTimeOfDay(morning)).toBe('morning');
      expect(getTimeOfDay(afternoon)).toBe('afternoon');
      expect(getTimeOfDay(evening)).toBe('evening');
      expect(getTimeOfDay(night)).toBe('night');
    });
  });

  describe('5. Indian Seasonal Context Derivation', () => {
    it('overrides static calendar when active monsoon rain is observed', () => {
      const rainWeather: WeatherSnapshot = {
        temperature: 27,
        feelsLike: 29,
        humidity: 85,
        precipitationProbability: 90,
        windSpeed: 15,
        condition: 'rain',
        observedAt: Date.now(),
        expiresAt: Date.now() + 30000,
        source: 'test',
        location: { city: 'Mumbai', country: 'India', source: 'manual' },
      };
      // Even in October or May, active torrential rain maps to monsoon
      const derived = deriveSeasonalContext(new Date(2026, 4, 15), rainWeather);
      expect(derived).toBe('monsoon');
    });

    it('maps months to Indian meteorological seasons when weather is mild', () => {
      // April (month 3) -> summer
      expect(deriveSeasonalContext(new Date(2026, 3, 10))).toBe('summer');
      // August (month 7) -> monsoon
      expect(deriveSeasonalContext(new Date(2026, 7, 15))).toBe('monsoon');
      // December (month 11) -> winter
      expect(deriveSeasonalContext(new Date(2026, 11, 20))).toBe('winter');
    });
  });

  describe('6. Context Snapshot Creation', () => {
    it('assembles a full ContextSnapshot with appropriate confidence', () => {
      const location: WeatherLocation = {
        city: 'Bengaluru',
        country: 'India',
        source: 'manual',
      };
      const weather: WeatherSnapshot = {
        temperature: 30,
        feelsLike: 32,
        humidity: 65,
        precipitationProbability: 10,
        windSpeed: 12,
        condition: 'partly_cloudy',
        observedAt: Date.now(),
        expiresAt: Date.now() + 30000,
        source: 'open_meteo',
        location,
      };

      const snapshot = createContextSnapshot({
        location,
        weather,
        freshness: 'fresh',
        occasion: 'college',
      });

      expect(snapshot.location.city).toBe('Bengaluru');
      expect(snapshot.thermalContext).toBe('hot');
      expect(snapshot.rainContext).toBe('none');
      expect(snapshot.confidence).toBe(1.0);
      expect(snapshot.source).toBe('live');
    });
  });
});
