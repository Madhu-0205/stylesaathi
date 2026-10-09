import {
  WeatherCondition,
  WeatherLocation,
  WeatherSnapshot,
  WeatherForecast,
  WeatherProvider,
} from '../../types';

export type { WeatherProvider };

/**
 * Standard WMO Weather Code to StyleSaathi Domain Condition mapper.
 */
export function mapWmoCodeToCondition(code: number): {
  condition: WeatherCondition;
  text: string;
} {
  switch (code) {
    case 0:
      return { condition: 'clear', text: 'Clear Sky' };
    case 1:
      return { condition: 'clear', text: 'Mainly Clear' };
    case 2:
      return { condition: 'partly_cloudy', text: 'Partly Cloudy' };
    case 3:
      return { condition: 'cloudy', text: 'Overcast' };
    case 45:
    case 48:
      return { condition: 'fog', text: 'Foggy / Hazy' };
    case 51:
    case 53:
    case 55:
      return { condition: 'drizzle', text: 'Light Drizzle' };
    case 56:
    case 57:
      return { condition: 'drizzle', text: 'Freezing Drizzle' };
    case 61:
      return { condition: 'rain', text: 'Light Showers' };
    case 63:
      return { condition: 'rain', text: 'Moderate Rain' };
    case 65:
      return { condition: 'heavy_rain', text: 'Heavy Downpour' };
    case 66:
    case 67:
      return { condition: 'heavy_rain', text: 'Freezing Rain' };
    case 71:
    case 73:
    case 75:
    case 77:
      return { condition: 'cold', text: 'Cold / Snow Flurries' };
    case 80:
      return { condition: 'rain', text: 'Passing Showers' };
    case 81:
      return { condition: 'rain', text: 'Moderate Showers' };
    case 82:
      return { condition: 'heavy_rain', text: 'Torrential Showers' };
    case 85:
    case 86:
      return { condition: 'cold', text: 'Cold Precipitation' };
    case 95:
      return { condition: 'thunderstorm', text: 'Thunderstorm' };
    case 96:
    case 99:
      return { condition: 'thunderstorm', text: 'Severe Thunderstorm' };
    default:
      return { condition: 'unknown', text: 'Weather Observed' };
  }
}

/**
 * Validates and safely normalizes a weather snapshot.
 * Rejects absurd or malformed external provider values before they touch domain logic.
 */
export function validateAndNormalizeWeatherSnapshot(
  raw: Partial<WeatherSnapshot>,
  fallbackLocation: WeatherLocation
): WeatherSnapshot {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid weather snapshot: payload is null or not an object');
  }

  const now = Date.now();

  // Validate temperature (-40°C to +60°C)
  const temp = typeof raw.temperature === 'number' && Number.isFinite(raw.temperature)
    ? Math.max(-40, Math.min(60, raw.temperature))
    : 28;

  // Validate feels-like (-45°C to +65°C)
  const feelsLike = typeof raw.feelsLike === 'number' && Number.isFinite(raw.feelsLike)
    ? Math.max(-45, Math.min(65, raw.feelsLike))
    : temp;

  // Validate humidity (0% to 100%)
  const humidity = typeof raw.humidity === 'number' && Number.isFinite(raw.humidity)
    ? Math.max(0, Math.min(100, Math.round(raw.humidity)))
    : 50;

  // Validate precipitation probability (0% to 100%)
  const precipProb = typeof raw.precipitationProbability === 'number' && Number.isFinite(raw.precipitationProbability)
    ? Math.max(0, Math.min(100, Math.round(raw.precipitationProbability)))
    : 0;

  // Validate precipitation amount (>= 0 mm)
  const precipAmount = typeof raw.precipitationAmount === 'number' && Number.isFinite(raw.precipitationAmount)
    ? Math.max(0, raw.precipitationAmount)
    : 0;

  // Validate wind speed (>= 0 km/h)
  const windSpeed = typeof raw.windSpeed === 'number' && Number.isFinite(raw.windSpeed)
    ? Math.max(0, raw.windSpeed)
    : 10;

  // Validate UV index (0 to 16)
  const uvIndex = typeof raw.uvIndex === 'number' && Number.isFinite(raw.uvIndex)
    ? Math.max(0, Math.min(16, raw.uvIndex))
    : undefined;

  // Validate cloud cover (0 to 100%)
  const cloudCover = typeof raw.cloudCover === 'number' && Number.isFinite(raw.cloudCover)
    ? Math.max(0, Math.min(100, raw.cloudCover))
    : undefined;

  // Validate condition
  const validConditions: WeatherCondition[] = [
    'clear',
    'partly_cloudy',
    'cloudy',
    'rain',
    'heavy_rain',
    'thunderstorm',
    'drizzle',
    'fog',
    'hot',
    'cold',
    'windy',
    'unknown',
  ];
  const condition: WeatherCondition = raw.condition && validConditions.includes(raw.condition)
    ? raw.condition
    : 'unknown';

  const location: WeatherLocation = raw.location && typeof raw.location.city === 'string'
    ? {
        city: raw.location.city,
        region: raw.location.region || fallbackLocation.region,
        country: raw.location.country || 'India',
        latitude: raw.location.latitude ?? fallbackLocation.latitude,
        longitude: raw.location.longitude ?? fallbackLocation.longitude,
        timezone: raw.location.timezone || 'Asia/Kolkata',
        source: raw.location.source || fallbackLocation.source,
      }
    : fallbackLocation;

  return {
    temperature: Math.round(temp * 10) / 10,
    feelsLike: Math.round(feelsLike * 10) / 10,
    humidity,
    precipitationProbability: precipProb,
    precipitationAmount: Math.round(precipAmount * 10) / 10,
    windSpeed: Math.round(windSpeed * 10) / 10,
    windDirection: typeof raw.windDirection === 'string' ? raw.windDirection : undefined,
    uvIndex: uvIndex !== undefined ? Math.round(uvIndex * 10) / 10 : undefined,
    visibility: typeof raw.visibility === 'number' && Number.isFinite(raw.visibility) ? raw.visibility : undefined,
    cloudCover,
    condition,
    conditionText: typeof raw.conditionText === 'string' ? raw.conditionText : 'Weather Observed',
    observedAt: typeof raw.observedAt === 'number' && raw.observedAt > 0 ? raw.observedAt : now,
    expiresAt: typeof raw.expiresAt === 'number' && raw.expiresAt > now ? raw.expiresAt : now + 30 * 60 * 1000,
    source: typeof raw.source === 'string' ? raw.source : 'unknown',
    location,
  };
}
