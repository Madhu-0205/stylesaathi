import {
  WeatherLocation,
  WeatherSnapshot,
  WeatherForecast,
  WeatherFreshness,
  WeatherProvider,
} from '../../types';
import { LocalWeatherCache } from './weatherCache';
import { OpenMeteoWeatherProvider } from './openMeteoProvider';
import { DeterministicFallbackWeatherProvider } from './fallbackProvider';

export class WeatherService {
  private primaryProvider: WeatherProvider;
  private fallbackProvider: WeatherProvider;
  private isRevalidating = false;

  constructor(
    primaryProvider: WeatherProvider = new OpenMeteoWeatherProvider(),
    fallbackProvider: WeatherProvider = new DeterministicFallbackWeatherProvider()
  ) {
    this.primaryProvider = primaryProvider;
    this.fallbackProvider = fallbackProvider;
  }

  /**
   * Retrieves user location from cache/defaults.
   */
  getLocation(): WeatherLocation {
    return LocalWeatherCache.getLocation();
  }

  /**
   * Updates user location preference and clears outdated cache.
   */
  setLocation(location: WeatherLocation): void {
    LocalWeatherCache.setLocation(location);
    LocalWeatherCache.clear();
  }

  /**
   * Retrieves current weather using honest resolution hierarchy:
   * 1. Fresh verified live weather (or fresh verified cache)
   * 2. Stale verified cached weather
   * 3. Weather unavailable (returns null snapshot; never fabricates fake current weather)
   */
  async getCurrentWeather(
    location?: WeatherLocation,
    forceRefresh = false,
    allowSimulation = false
  ): Promise<{
    snapshot: WeatherSnapshot | null;
    forecast: WeatherForecast | null;
    freshness: WeatherFreshness;
  }> {
    const loc = location || this.getLocation();
    const cached = LocalWeatherCache.get();

    // 1. Fresh cache: return immediately without network access
    if (cached && cached.freshness === 'fresh' && !forceRefresh) {
      return {
        snapshot: { ...cached.entry.snapshot, source: 'cached' },
        forecast: cached.entry.forecast || null,
        freshness: 'fresh',
      };
    }

    // 2. Stale cache: return immediately and trigger background revalidation
    if (cached && cached.freshness === 'stale' && !forceRefresh) {
      this.revalidateInBackground(loc);
      return {
        snapshot: { ...cached.entry.snapshot, source: 'cached' },
        forecast: cached.entry.forecast || null,
        freshness: 'stale',
      };
    }

    // 3. Live network fetch
    try {
      const [snapshot, forecast] = await Promise.all([
        this.primaryProvider.getCurrentWeather(loc),
        this.primaryProvider.getForecast ? this.primaryProvider.getForecast(loc).catch(() => null) : Promise.resolve(null),
      ]);

      const liveSnapshot: WeatherSnapshot = {
        ...snapshot,
        source: 'live',
      };

      LocalWeatherCache.set(liveSnapshot, forecast || undefined);
      return {
        snapshot: liveSnapshot,
        forecast,
        freshness: 'fresh',
      };
    } catch (primaryError) {
      console.warn('StyleSaathi: Primary weather provider unavailable', primaryError);

      // If we had a verified cache (stale or expired), return it honestly marked
      if (cached) {
        return {
          snapshot: { ...cached.entry.snapshot, source: 'cached' },
          forecast: cached.entry.forecast || null,
          freshness: cached.freshness,
        };
      }

      // Explicit simulation mode (TEST / DEV ONLY)
      if (allowSimulation) {
        const [fallbackSnapshot, fallbackForecast] = await Promise.all([
          this.fallbackProvider.getCurrentWeather(loc),
          this.fallbackProvider.getForecast ? this.fallbackProvider.getForecast(loc).catch(() => null) : Promise.resolve(null),
        ]);

        return {
          snapshot: { ...fallbackSnapshot, source: 'simulated' },
          forecast: fallbackForecast,
          freshness: 'unavailable',
        };
      }

      // Production resolution: weather is unavailable. Never fabricate fake numbers.
      return {
        snapshot: null,
        forecast: null,
        freshness: 'unavailable',
      };
    }
  }

  /**
   * TEST / SIMULATION ONLY: Explicitly retrieves simulated climate weather.
   * Never exposed as current factual weather in production.
   */
  async getSimulatedWeather(location?: WeatherLocation): Promise<{
    snapshot: WeatherSnapshot;
    forecast: WeatherForecast | null;
    freshness: WeatherFreshness;
  }> {
    const loc = location || this.getLocation();
    const [snapshot, forecast] = await Promise.all([
      this.fallbackProvider.getCurrentWeather(loc),
      this.fallbackProvider.getForecast ? this.fallbackProvider.getForecast(loc).catch(() => null) : Promise.resolve(null),
    ]);
    return {
      snapshot: { ...snapshot, source: 'simulated' },
      forecast,
      freshness: 'unavailable',
    };
  }

  /**
   * Revalidates weather in background without delaying main thread.
   */
  private async revalidateInBackground(loc: WeatherLocation): Promise<void> {
    if (this.isRevalidating) return;
    this.isRevalidating = true;
    try {
      const [snapshot, forecast] = await Promise.all([
        this.primaryProvider.getCurrentWeather(loc),
        this.primaryProvider.getForecast ? this.primaryProvider.getForecast(loc).catch(() => null) : Promise.resolve(null),
      ]);
      const liveSnapshot: WeatherSnapshot = {
        ...snapshot,
        source: 'live',
      };
      LocalWeatherCache.set(liveSnapshot, forecast || undefined);
    } catch {
      // Quiet background failure; previous cache remains intact
    } finally {
      this.isRevalidating = false;
    }
  }
}

export const weatherService = new WeatherService();
