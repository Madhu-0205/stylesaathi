import {
  WeatherLocation,
  WeatherSnapshot,
  WeatherForecast,
  WeatherForecastPeriod,
  WeatherProvider,
} from '../../types';
import {
  mapWmoCodeToCondition,
  validateAndNormalizeWeatherSnapshot,
} from './weatherProvider';

export class OpenMeteoWeatherProvider implements WeatherProvider {
  readonly id = 'open_meteo';
  readonly name = 'Open-Meteo (Privacy-First Meteorological)';

  private timeoutMs: number;

  constructor(timeoutMs = 5000) {
    this.timeoutMs = timeoutMs;
  }

  async getCurrentWeather(location: WeatherLocation): Promise<WeatherSnapshot> {
    const lat = location.latitude ?? 12.97;
    const lon = location.longitude ?? 77.59;

    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', lat.toFixed(4));
    url.searchParams.set('longitude', lon.toFixed(4));
    url.searchParams.set(
      'current',
      'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m,wind_direction_10m'
    );
    url.searchParams.set('timezone', 'auto');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Open-Meteo API HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const current = data?.current;

      if (!current) {
        throw new Error('Malformed Open-Meteo response: missing current weather block');
      }

      const weatherCode = typeof current.weather_code === 'number' ? current.weather_code : 0;
      const { condition, text: conditionText } = mapWmoCodeToCondition(weatherCode);

      const now = Date.now();
      const rawSnapshot: Partial<WeatherSnapshot> = {
        temperature: current.temperature_2m,
        feelsLike: current.apparent_temperature ?? current.temperature_2m,
        humidity: current.relative_humidity_2m,
        precipitationProbability: current.precipitation > 0 ? 80 : 0,
        precipitationAmount: current.precipitation ?? 0,
        windSpeed: current.wind_speed_10m ?? 0,
        windDirection: current.wind_direction_10m !== undefined ? `${current.wind_direction_10m}°` : undefined,
        condition,
        conditionText,
        observedAt: now,
        expiresAt: now + 30 * 60 * 1000, // 30-minute freshness TTL
        source: 'live',
        location,
      };

      return validateAndNormalizeWeatherSnapshot(rawSnapshot, location);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async getForecast(location: WeatherLocation): Promise<WeatherForecast> {
    const lat = location.latitude ?? 12.97;
    const lon = location.longitude ?? 77.59;

    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', lat.toFixed(4));
    url.searchParams.set('longitude', lon.toFixed(4));
    url.searchParams.set(
      'daily',
      'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
    );
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('forecast_days', '3');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Open-Meteo Forecast HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const daily = data?.daily;

      const periods: WeatherForecastPeriod[] = [];
      const now = Date.now();

      if (daily?.time && Array.isArray(daily.time)) {
        const labels: Array<'today' | 'tonight' | 'tomorrow'> = ['today', 'tonight', 'tomorrow'];

        for (let i = 0; i < Math.min(3, daily.time.length); i++) {
          const date = daily.time[i];
          const code = daily.weather_code?.[i] ?? 0;
          const { condition, text } = mapWmoCodeToCondition(code);
          const tMax = daily.temperature_2m_max?.[i] ?? 30;
          const tMin = daily.temperature_2m_min?.[i] ?? 22;
          const precipProb = daily.precipitation_probability_max?.[i] ?? 0;

          periods.push({
            period: labels[i] ?? 'today',
            date,
            temperatureMin: Math.round(tMin),
            temperatureMax: Math.round(tMax),
            condition,
            precipitationProbability: Math.round(precipProb),
            summary: `${text} · ${Math.round(tMin)}°C to ${Math.round(tMax)}°C`,
          });
        }
      }

      return {
        location,
        periods,
        generatedAt: now,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
