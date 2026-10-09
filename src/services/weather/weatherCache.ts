import {
  WeatherSnapshot,
  WeatherForecast,
  WeatherFreshness,
  WeatherLocation,
} from '../../types';
import { DEFAULT_INDIAN_LOCATION } from './indianCities';

export interface WeatherCacheEntry {
  snapshot: WeatherSnapshot;
  forecast?: WeatherForecast;
  cachedAt: number;
}

export const WEATHER_CACHE_KEY = 'stylesaathi-weather-cache-v1';
export const WEATHER_LOCATION_KEY = 'stylesaathi-weather-location-v1';

export const FRESH_TTL_MS = 30 * 60 * 1000; // 30 minutes
export const STALE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// In-memory fallback when localStorage is unavailable
let memoryCache: WeatherCacheEntry | null = null;
let memoryLocation: WeatherLocation | null = null;

export class LocalWeatherCache {
  /**
   * Evaluates freshness tier of a cached timestamp.
   */
  static getFreshness(cachedAt: number, now = Date.now()): WeatherFreshness {
    if (!cachedAt || cachedAt <= 0 || now < cachedAt) return 'unavailable';
    const age = now - cachedAt;
    if (age <= FRESH_TTL_MS) return 'fresh';
    if (age <= STALE_TTL_MS) return 'stale';
    return 'expired';
  }

  /**
   * Retrieves cached weather data with safe corruption handling.
   */
  static get(): { entry: WeatherCacheEntry; freshness: WeatherFreshness } | null {
    try {
      let raw: string | null = null;
      if (typeof window !== 'undefined' && window.localStorage) {
        raw = window.localStorage.getItem(WEATHER_CACHE_KEY);
      }

      let parsed: WeatherCacheEntry | null = null;
      if (raw) {
        parsed = JSON.parse(raw);
      } else if (memoryCache) {
        parsed = memoryCache;
      }

      if (!parsed || !parsed.snapshot || typeof parsed.cachedAt !== 'number') {
        return null;
      }

      // Check basic structural sanity of snapshot
      if (
        typeof parsed.snapshot.temperature !== 'number' ||
        typeof parsed.snapshot.humidity !== 'number' ||
        !parsed.snapshot.condition
      ) {
        this.clear();
        return null;
      }

      const freshness = this.getFreshness(parsed.cachedAt);
      return { entry: parsed, freshness };
    } catch {
      this.clear();
      return null;
    }
  }

  /**
   * Writes a weather snapshot and optional forecast to local cache.
   */
  static set(snapshot: WeatherSnapshot, forecast?: WeatherForecast): void {
    const entry: WeatherCacheEntry = {
      snapshot,
      forecast,
      cachedAt: Date.now(),
    };

    memoryCache = entry;

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(entry));
      }
    } catch (e) {
      console.warn('StyleSaathi: Unable to write to localStorage weather cache', e);
    }
  }

  /**
   * Clears the weather cache.
   */
  static clear(): void {
    memoryCache = null;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(WEATHER_CACHE_KEY);
      }
    } catch {}
  }

  /**
   * Retrieves the user's saved location preference, defaulting to Bengaluru.
   */
  static getLocation(): WeatherLocation {
    try {
      let raw: string | null = null;
      if (typeof window !== 'undefined' && window.localStorage) {
        raw = window.localStorage.getItem(WEATHER_LOCATION_KEY);
      }

      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.city === 'string') {
          return parsed;
        }
      }

      if (memoryLocation) {
        return memoryLocation;
      }
    } catch {}

    return DEFAULT_INDIAN_LOCATION;
  }

  /**
   * Persists the user's chosen location locally.
   */
  static setLocation(location: WeatherLocation): void {
    memoryLocation = location;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(WEATHER_LOCATION_KEY, JSON.stringify(location));
      }
    } catch (e) {
      console.warn('StyleSaathi: Unable to save weather location preference', e);
    }
  }
}
