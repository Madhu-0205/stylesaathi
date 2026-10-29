import {
  ContextSnapshot,
  WeatherLocation,
  WeatherSnapshot,
} from '../../../types';

/**
 * Deterministic weather fixtures for StyleSaathi Phase G evaluation.
 * STRICT ISOLATION: Zero live HTTP calls or external weather API invocations.
 */

const baseLocation = (city: string, lat: number, lon: number): WeatherLocation => ({
  city,
  country: 'India',
  latitude: lat,
  longitude: lon,
  source: 'manual',
});

const baseWeatherSnapshot = (
  location: WeatherLocation,
  overrides: Partial<WeatherSnapshot> = {}
): WeatherSnapshot => ({
  temperature: 30,
  feelsLike: 30,
  humidity: 50,
  precipitationProbability: 0,
  windSpeed: 10,
  condition: 'clear',
  observedAt: 1729000000000,
  expiresAt: 1729003600000,
  source: 'live',
  location,
  ...overrides,
});

// 1. Hot & Humid (Coastal Monsoon & Tropical Summer)
const locMumbai = baseLocation('Mumbai', 19.076, 72.8777);
export const WEATHER_HOT_HUMID_MUMBAI: ContextSnapshot = {
  source: 'live',
  freshness: 'fresh',
  confidence: 1.0,
  date: '2026-10-29',
  timeOfDay: 'afternoon',
  thermalContext: 'hot',
  rainContext: 'low_risk',
  occasion: 'everyday',
  location: locMumbai,
  weather: baseWeatherSnapshot(locMumbai, {
    temperature: 33,
    feelsLike: 44,
    humidity: 88,
    precipitationProbability: 30,
    windSpeed: 14,
    condition: 'hot',
  }),
};

const locChennai = baseLocation('Chennai', 13.0827, 80.2707);
export const WEATHER_HOT_HUMID_CHENNAI: ContextSnapshot = {
  source: 'live',
  freshness: 'fresh',
  confidence: 1.0,
  date: '2026-10-29',
  timeOfDay: 'afternoon',
  thermalContext: 'very_hot',
  rainContext: 'none',
  occasion: 'everyday',
  location: locChennai,
  weather: baseWeatherSnapshot(locChennai, {
    temperature: 38,
    feelsLike: 49,
    humidity: 82,
    precipitationProbability: 0,
    windSpeed: 10,
    condition: 'hot',
  }),
};

// 2. Hot & Dry (Arid Interior Summer)
const locJaipur = baseLocation('Jaipur', 26.9124, 75.7873);
export const WEATHER_HOT_DRY_JAIPUR: ContextSnapshot = {
  source: 'live',
  freshness: 'fresh',
  confidence: 1.0,
  date: '2026-10-29',
  timeOfDay: 'afternoon',
  thermalContext: 'very_hot',
  rainContext: 'none',
  occasion: 'everyday',
  location: locJaipur,
  weather: baseWeatherSnapshot(locJaipur, {
    temperature: 43,
    feelsLike: 42,
    humidity: 16,
    precipitationProbability: 0,
    windSpeed: 18,
    condition: 'hot',
  }),
};

// 3. Cold (Northern Plains & Himalayan Winter)
const locDelhi = baseLocation('New Delhi', 28.6139, 77.209);
export const WEATHER_COLD_DELHI_WINTER: ContextSnapshot = {
  source: 'live',
  freshness: 'fresh',
  confidence: 1.0,
  date: '2026-10-29',
  timeOfDay: 'morning',
  thermalContext: 'cold',
  rainContext: 'none',
  occasion: 'everyday',
  location: locDelhi,
  weather: baseWeatherSnapshot(locDelhi, {
    temperature: 7,
    feelsLike: 5,
    humidity: 84,
    precipitationProbability: 0,
    windSpeed: 8,
    condition: 'cold',
  }),
};

const locSrinagar = baseLocation('Srinagar', 34.0837, 74.7973);
export const WEATHER_SUBZERO_KASHMIR: ContextSnapshot = {
  source: 'live',
  freshness: 'fresh',
  confidence: 1.0,
  date: '2026-10-29',
  timeOfDay: 'morning',
  thermalContext: 'very_cold',
  rainContext: 'none',
  occasion: 'everyday',
  location: locSrinagar,
  weather: baseWeatherSnapshot(locSrinagar, {
    temperature: -2,
    feelsLike: -6,
    humidity: 65,
    precipitationProbability: 10,
    windSpeed: 12,
    condition: 'cold',
  }),
};

// 4. Rainy & Severe Deluge (Hazardous to delicate fabrics like silk/suede)
export const WEATHER_DELUGE_MUMBAI: ContextSnapshot = {
  source: 'live',
  freshness: 'fresh',
  confidence: 1.0,
  date: '2026-10-29',
  timeOfDay: 'afternoon',
  thermalContext: 'warm',
  rainContext: 'active_rain',
  occasion: 'everyday',
  location: locMumbai,
  weather: baseWeatherSnapshot(locMumbai, {
    temperature: 26,
    feelsLike: 30,
    humidity: 96,
    precipitationProbability: 95,
    precipitationAmount: 28.5,
    windSpeed: 32,
    condition: 'heavy_rain',
  }),
};

const locBangalore = baseLocation('Bengaluru', 12.9716, 77.5946);
export const WEATHER_THUNDERSTORM_BANGALORE: ContextSnapshot = {
  source: 'live',
  freshness: 'fresh',
  confidence: 1.0,
  date: '2026-10-29',
  timeOfDay: 'afternoon',
  thermalContext: 'warm',
  rainContext: 'active_rain',
  occasion: 'everyday',
  location: locBangalore,
  weather: baseWeatherSnapshot(locBangalore, {
    temperature: 23,
    feelsLike: 25,
    humidity: 92,
    precipitationProbability: 90,
    precipitationAmount: 22.0,
    windSpeed: 28,
    condition: 'thunderstorm',
  }),
};

const locPune = baseLocation('Pune', 18.5204, 73.8567);
export const WEATHER_MILD_DRIZZLE: ContextSnapshot = {
  source: 'live',
  freshness: 'fresh',
  confidence: 1.0,
  date: '2026-10-29',
  timeOfDay: 'afternoon',
  thermalContext: 'warm',
  rainContext: 'low_risk',
  occasion: 'everyday',
  location: locPune,
  weather: baseWeatherSnapshot(locPune, {
    temperature: 25,
    feelsLike: 26,
    humidity: 80,
    precipitationProbability: 40,
    precipitationAmount: 1.2,
    windSpeed: 10,
    condition: 'drizzle',
  }),
};

// 5. Weather Unavailable & Stale Fallbacks (Objective 8: Missing Context)
const locKolkata = baseLocation('Kolkata', 22.5726, 88.3639);
export const WEATHER_UNAVAILABLE: ContextSnapshot = {
  source: 'unavailable',
  freshness: 'unavailable',
  confidence: 0.0,
  date: '2026-10-29',
  timeOfDay: 'afternoon',
  thermalContext: 'mild',
  rainContext: 'none',
  occasion: 'everyday',
  location: locKolkata,
  weather: null,
};

const locHyderabad = baseLocation('Hyderabad', 17.385, 78.4867);
export const WEATHER_STALE_CACHED: ContextSnapshot = {
  source: 'cached',
  freshness: 'stale',
  confidence: 0.6,
  date: '2026-10-29',
  timeOfDay: 'afternoon',
  thermalContext: 'warm',
  rainContext: 'none',
  occasion: 'everyday',
  location: locHyderabad,
  weather: baseWeatherSnapshot(locHyderabad, {
    temperature: 29,
    feelsLike: 32,
    humidity: 68,
    precipitationProbability: 5,
    windSpeed: 10,
    condition: 'clear',
    source: 'cached',
    observedAt: 1728900000000,
  }),
};
