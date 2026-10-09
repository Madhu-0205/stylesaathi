import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import {
  WeatherLocation,
  WeatherSnapshot,
  WeatherForecast,
  WeatherFreshness,
  ContextSnapshot,
  Occasion,
  ActivityContext,
} from '../types';
import { weatherService } from '../services/weather/weatherService';
import { LocalWeatherCache } from '../services/weather/weatherCache';
import { findClosestIndianCity } from '../services/weather/indianCities';
import { createContextSnapshot } from '../engine/contextEngine';

interface WeatherContextValue {
  location: WeatherLocation;
  weather: WeatherSnapshot | null;
  forecast: WeatherForecast | null;
  freshness: WeatherFreshness;
  isLoading: boolean;
  error: string | null;
  changeLocation: (loc: WeatherLocation) => Promise<void>;
  requestDeviceLocation: () => Promise<boolean>;
  refreshWeather: () => Promise<void>;
  getContextForOccasion: (occasion: Occasion, activity?: ActivityContext) => ContextSnapshot;
}

const WeatherContext = createContext<WeatherContextValue | null>(null);

export const WeatherProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [location, setLocationState] = useState<WeatherLocation>(() => weatherService.getLocation());
  
  // Initialize synchronously with cached weather if available so initial render is instant
  const [cachedInitial] = useState(() => LocalWeatherCache.get());
  const [weather, setWeather] = useState<WeatherSnapshot | null>(() => cachedInitial?.entry.snapshot || null);
  const [forecast, setForecast] = useState<WeatherForecast | null>(() => cachedInitial?.entry.forecast || null);
  const [freshness, setFreshness] = useState<WeatherFreshness>(() => cachedInitial?.freshness || 'unavailable');
  
  const [isLoading, setIsLoading] = useState<boolean>(!cachedInitial || cachedInitial.freshness !== 'fresh');
  const [error, setError] = useState<string | null>(null);

  // Core fetch function
  const loadWeather = useCallback(async (loc: WeatherLocation, force = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await weatherService.getCurrentWeather(loc, force);
      setWeather(result.snapshot);
      setForecast(result.forecast);
      setFreshness(result.freshness);
    } catch (err: any) {
      console.warn('WeatherContext: weather fetch encountered error', err);
      setError(err?.message || 'Unable to update weather');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load on mount or when location changes
  useEffect(() => {
    loadWeather(location, false);
  }, [location, loadWeather]);

  // Manually change location (e.g. user selects city from list)
  const changeLocation = useCallback(async (newLocation: WeatherLocation) => {
    weatherService.setLocation(newLocation);
    setLocationState(newLocation);
    await loadWeather(newLocation, true);
  }, [loadWeather]);

  // Request browser/device GPS permission only on deliberate user tap
  const requestDeviceLocation = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setError('Geolocation is not supported by your device');
      return false;
    }

    return new Promise<boolean>((resolve) => {
      setIsLoading(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            // Privacy-preserving snap: Snap to closest recognized Indian city
            // Never persist or broadcast exact household latitude/longitude coordinates
            const closestCity = findClosestIndianCity(latitude, longitude);

            const snappedLocation: WeatherLocation = {
              city: closestCity.city,
              region: closestCity.region,
              country: 'India',
              latitude: closestCity.latitude,
              longitude: closestCity.longitude,
              timezone: 'Asia/Kolkata',
              source: 'geolocation',
            };

            await changeLocation(snappedLocation);
            resolve(true);
          } catch {
            setError('Failed to resolve nearest city from location');
            setIsLoading(false);
            resolve(false);
          }
        },
        (geoError) => {
          setIsLoading(false);
          let msg = 'Location access not granted';
          if (geoError.code === geoError.PERMISSION_DENIED) {
            msg = 'Location permission was denied. You can still pick your city manually.';
          }
          setError(msg);
          resolve(false);
        },
        { timeout: 8000, enableHighAccuracy: false, maximumAge: 300000 }
      );
    });
  }, [changeLocation]);

  // Force re-fetch current weather
  const refreshWeather = useCallback(async () => {
    await loadWeather(location, true);
  }, [location, loadWeather]);

  // Helper to construct a ContextSnapshot for any occasion and optional activity
  const getContextForOccasion = useCallback(
    (occasion: Occasion, activity?: ActivityContext): ContextSnapshot => {
      return createContextSnapshot({
        location,
        weather,
        forecast,
        freshness,
        occasion,
        activity,
      });
    },
    [location, weather, forecast, freshness]
  );

  const value = useMemo(
    () => ({
      location,
      weather,
      forecast,
      freshness,
      isLoading,
      error,
      changeLocation,
      requestDeviceLocation,
      refreshWeather,
      getContextForOccasion,
    }),
    [
      location,
      weather,
      forecast,
      freshness,
      isLoading,
      error,
      changeLocation,
      requestDeviceLocation,
      refreshWeather,
      getContextForOccasion,
    ]
  );

  return <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>;
};

export function useWeather(): WeatherContextValue {
  const context = useContext(WeatherContext);
  if (!context) {
    throw new Error('useWeather must be used within a WeatherProvider');
  }
  return context;
}
