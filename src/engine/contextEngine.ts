import {
  WeatherSnapshot,
  WeatherForecast,
  WeatherFreshness,
  WeatherLocation,
  ThermalContext,
  RainContext,
  TimeOfDay,
  ActivityContext,
  ContextSnapshot,
  Occasion,
  Season,
  WeatherCondition,
  WeatherDataSource,
} from '../types';

/**
 * Centralized thermal classification thresholds (in Celsius).
 */
export const THERMAL_THRESHOLDS = {
  VERY_HOT: 38,
  HOT: 32,
  WARM: 26,
  MILD: 20,
  COOL: 14,
  COLD: 8,
} as const;

/**
 * Calculates Steadman apparent temperature taking into account ambient temperature,
 * relative humidity, and wind speed.
 * Crucial for Indian coastal and high-humidity climates where sweat does not evaporate.
 */
export function calculateApparentTemperature(
  temp: number,
  humidity: number,
  windSpeedKmH: number
): number {
  // Water vapour pressure e in hPa
  const e = (humidity / 100) * 6.105 * Math.exp((17.27 * temp) / (237.7 + temp));
  const windMPerS = Math.max(0, windSpeedKmH) / 3.6;

  // Steadman apparent temperature formula (metric)
  const apparent = temp + 0.33 * e - 0.7 * windMPerS - 4.0;
  return Math.round(apparent * 10) / 10;
}

/**
 * Derives ThermalContext from temperature, feelsLike, humidity, and wind.
 */
export function calculateThermalContext(
  temperature: number,
  feelsLike: number,
  humidity: number,
  windSpeed: number
): ThermalContext {
  const effectiveTemp = Math.max(
    temperature,
    feelsLike,
    calculateApparentTemperature(temperature, humidity, windSpeed)
  );

  // For cooler regimes, wind chill can lower effective temperature
  const adjustedCold = Math.min(temperature, feelsLike);

  if (effectiveTemp >= THERMAL_THRESHOLDS.VERY_HOT) return 'very_hot';
  if (effectiveTemp >= THERMAL_THRESHOLDS.HOT) return 'hot';
  if (effectiveTemp >= THERMAL_THRESHOLDS.WARM) return 'warm';
  if (adjustedCold >= THERMAL_THRESHOLDS.MILD) return 'mild';
  if (adjustedCold >= THERMAL_THRESHOLDS.COOL) return 'cool';
  if (adjustedCold >= THERMAL_THRESHOLDS.COLD) return 'cold';
  return 'very_cold';
}

/**
 * Derives RainContext from condition, precipitation probability, and amount.
 */
export function calculateRainContext(
  condition: WeatherCondition,
  precipitationProbability: number,
  precipitationAmount = 0
): RainContext {
  const activeConditions: WeatherCondition[] = ['rain', 'heavy_rain', 'thunderstorm', 'drizzle'];

  if (activeConditions.includes(condition) || precipitationAmount >= 1.0) {
    return 'active_rain';
  }
  if (precipitationProbability >= 60) {
    return 'high_risk';
  }
  if (precipitationProbability >= 25) {
    return 'low_risk';
  }
  return 'none';
}

/**
 * Determines current TimeOfDay from local time.
 */
export function getTimeOfDay(date: Date = new Date()): TimeOfDay {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

/**
 * Derives Indian seasonal context from date and observed weather.
 * Dynamically replaces static calendar assumptions with real climate awareness.
 */
export function deriveSeasonalContext(
  date: Date = new Date(),
  weather?: WeatherSnapshot | null
): Season {
  // If active rain or heavy precipitation is observed, monsoon takes precedence
  if (weather) {
    if (['rain', 'heavy_rain', 'thunderstorm'].includes(weather.condition)) {
      return 'monsoon';
    }
    if (weather.temperature <= 16) {
      return 'winter';
    }
    if (weather.temperature >= 32) {
      return 'summer';
    }
  }

  const month = date.getMonth(); // 0 = Jan, 11 = Dec

  // Indian seasonal calendar:
  // Mar (2) - Jun (5): Summer
  // Jul (6) - Sep (8): Monsoon
  // Oct (9) - Feb (1): Winter / Festive Autumn
  if (month >= 2 && month <= 5) return 'summer';
  if (month >= 6 && month <= 8) return 'monsoon';
  return 'winter';
}

/**
 * Computes context certainty score (0.0 to 1.0).
 */
export function calculateContextConfidence(
  weather: WeatherSnapshot | null,
  freshness: WeatherFreshness
): number {
  if (!weather) return 0.2;
  switch (freshness) {
    case 'fresh':
      return 1.0;
    case 'stale':
      return 0.75;
    case 'expired':
      return 0.45;
    case 'unavailable':
    default:
      return 0.3;
  }
}

/**
 * Creates a unified, normalized ContextSnapshot.
 */
export function createContextSnapshot(params: {
  location: WeatherLocation;
  weather: WeatherSnapshot | null;
  forecast?: WeatherForecast | null;
  freshness?: WeatherFreshness;
  occasion: Occasion;
  activity?: ActivityContext;
  date?: Date;
}): ContextSnapshot {
  const dateObj = params.date || new Date();
  const dateStr = dateObj.toISOString().split('T')[0];
  const timeOfDay = getTimeOfDay(dateObj);
  const freshness = params.freshness || (params.weather ? 'fresh' : 'unavailable');

  const thermalContext: ThermalContext = params.weather
    ? calculateThermalContext(
        params.weather.temperature,
        params.weather.feelsLike,
        params.weather.humidity,
        params.weather.windSpeed
      )
    : 'warm'; // Default mild warmth in India

  const rainContext: RainContext = params.weather
    ? calculateRainContext(
        params.weather.condition,
        params.weather.precipitationProbability,
        params.weather.precipitationAmount
      )
    : 'none';

  const confidence = calculateContextConfidence(params.weather, freshness);

  let source: WeatherDataSource = 'unavailable';
  if (params.weather) {
    if (params.weather.source === 'simulated' || params.weather.source === 'fallback') {
      source = 'simulated';
    } else if (params.weather.source === 'cached' || freshness === 'stale' || freshness === 'expired') {
      source = 'cached';
    } else {
      source = 'live';
    }
  } else {
    source = 'unavailable';
  }

  return {
    weather: params.weather,
    forecast: params.forecast || null,
    freshness,
    location: params.location,
    date: dateStr,
    timeOfDay,
    thermalContext,
    rainContext,
    occasion: params.occasion,
    activity: params.activity,
    confidence,
    source,
  };
}
