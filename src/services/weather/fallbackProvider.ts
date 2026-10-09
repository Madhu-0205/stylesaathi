import {
  WeatherLocation,
  WeatherSnapshot,
  WeatherForecast,
  WeatherProvider,
  WeatherCondition,
} from '../../types';
import { findClosestIndianCity } from './indianCities';
import { validateAndNormalizeWeatherSnapshot } from './weatherProvider';

/**
 * TEST / DEVELOPMENT / SIMULATION ONLY.
 * NEVER TO BE USED AS CURRENT FACTUAL WEATHER IN PRODUCTION.
 *
 * Deterministic Climate Simulation Provider for testing, offline simulation,
 * and deterministic scenario benchmarks. Uses month-based Indian climate profiles.
 */
export class DeterministicFallbackWeatherProvider implements WeatherProvider {
  readonly id = 'simulated_fallback';
  readonly name = 'Deterministic Climate Simulation (Test/Dev Only)';

  async getCurrentWeather(location: WeatherLocation): Promise<WeatherSnapshot> {
    const cityProfile = findClosestIndianCity(
      location.latitude ?? 12.97,
      location.longitude ?? 77.59
    );

    const now = new Date();
    const month = now.getMonth(); // 0 = Jan, 11 = Dec
    const hour = now.getHours();

    let temp = 28;
    let humidity = 60;
    let condition: WeatherCondition = 'partly_cloudy';
    let conditionText = 'Pleasant Conditions';
    let precipProb = 10;
    let windSpeed = 12;

    switch (cityProfile.climateZone) {
      case 'coastal_humid': // Mumbai, Chennai, Kochi, Goa
        if (month >= 2 && month <= 5) {
          // Pre-monsoon Summer: Hot & Very Humid
          temp = 33;
          humidity = 78;
          condition = 'partly_cloudy';
          conditionText = 'Hot & Humid Coastal Heat';
        } else if (month >= 6 && month <= 8) {
          // Monsoon: Heavy Rain
          temp = 29;
          humidity = 88;
          precipProb = 75;
          condition = 'rain';
          conditionText = 'Monsoon Rain & High Moisture';
        } else {
          // Winter/Moderate
          temp = 28;
          humidity = 68;
          condition = 'clear';
          conditionText = 'Balmy Coastal Breeze';
        }
        break;

      case 'subtropical_extreme': // Delhi NCR, Jaipur, Lucknow, Chandigarh
        if (month >= 3 && month <= 5) {
          // Dry Blistering Summer
          temp = 38;
          humidity = 35;
          condition = 'clear';
          conditionText = 'Dry Inland Heat';
        } else if (month >= 6 && month <= 8) {
          // Monsoon
          temp = 33;
          humidity = 75;
          precipProb = 60;
          condition = 'rain';
          conditionText = 'Humid Monsoon Showers';
        } else if (month >= 11 || month <= 1) {
          // Chilly Winter
          temp = hour < 10 || hour > 20 ? 12 : 19;
          humidity = 55;
          condition = 'fog';
          conditionText = 'Cool Winter Breeze';
        } else {
          temp = 26;
          humidity = 45;
          condition = 'clear';
          conditionText = 'Pleasant Sunny Day';
        }
        break;

      case 'tropical_humid': // Kolkata, Guwahati
        if (month >= 2 && month <= 5) {
          temp = 35;
          humidity = 80;
          condition = 'hot';
          conditionText = 'Oppressive Humid Heat';
        } else if (month >= 6 && month <= 8) {
          temp = 30;
          humidity = 88;
          precipProb = 70;
          condition = 'rain';
          conditionText = 'Tropical Monsoon Rain';
        } else {
          temp = 24;
          humidity = 65;
          condition = 'clear';
          conditionText = 'Mild Tropical Weather';
        }
        break;

      case 'hot_semiarid': // Ahmedabad
        if (month >= 3 && month <= 5) {
          temp = 39;
          humidity = 30;
          condition = 'clear';
          conditionText = 'Intense Dry Sunshine';
        } else if (month >= 6 && month <= 8) {
          temp = 32;
          humidity = 70;
          precipProb = 50;
          condition = 'partly_cloudy';
          conditionText = 'Warm Monsoon Clouds';
        } else {
          temp = 25;
          humidity = 40;
          condition = 'clear';
          conditionText = 'Warm Sunny Day';
        }
        break;

      case 'temperate_valley': // Srinagar
        if (month >= 4 && month <= 8) {
          temp = 22;
          humidity = 50;
          condition = 'clear';
          conditionText = 'Cool Mountain Valley';
        } else {
          temp = 8;
          humidity = 65;
          condition = 'cold';
          conditionText = 'Alpine Cold';
        }
        break;

      case 'deccan_moderate': // Bengaluru, Pune, Hyderabad
      default:
        if (month >= 2 && month <= 4) {
          temp = 32;
          humidity = 50;
          condition = 'partly_cloudy';
          conditionText = 'Warm Deccan Sunshine';
        } else if (month >= 5 && month <= 9) {
          temp = 27;
          humidity = 72;
          precipProb = 45;
          condition = 'partly_cloudy';
          conditionText = 'Breezy Monsoon Overcast';
        } else {
          temp = 24;
          humidity = 55;
          condition = 'clear';
          conditionText = 'Pleasant Plateau Weather';
        }
        break;
    }

    // Daytime diurnal shift
    if (hour < 7 || hour > 21) {
      temp -= 3;
    }

    const nowEpoch = Date.now();
    const raw: Partial<WeatherSnapshot> = {
      temperature: temp,
      feelsLike: temp + (humidity > 70 ? 3 : 0),
      humidity,
      precipitationProbability: precipProb,
      precipitationAmount: precipProb > 50 ? 2.5 : 0,
      windSpeed,
      condition,
      conditionText,
      observedAt: nowEpoch,
      expiresAt: nowEpoch + 60 * 60 * 1000,
      source: 'simulated',
      location: {
        ...location,
        city: location.city || cityProfile.city,
      },
    };

    return validateAndNormalizeWeatherSnapshot(raw, location);
  }

  async getForecast(location: WeatherLocation): Promise<WeatherForecast> {
    const current = await this.getCurrentWeather(location);
    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    return {
      location,
      periods: [
        {
          period: 'today',
          date: todayStr,
          temperatureMin: Math.round(current.temperature - 4),
          temperatureMax: Math.round(current.temperature + 2),
          condition: current.condition,
          precipitationProbability: current.precipitationProbability,
          summary: `${current.conditionText} · ${Math.round(current.temperature)}°C`,
        },
        {
          period: 'tonight',
          date: todayStr,
          temperatureMin: Math.round(current.temperature - 5),
          temperatureMax: Math.round(current.temperature - 2),
          condition: current.condition === 'rain' ? 'rain' : 'clear',
          precipitationProbability: Math.max(0, current.precipitationProbability - 10),
          summary: `Cooler evening breeze · ${Math.round(current.temperature - 4)}°C`,
        },
        {
          period: 'tomorrow',
          date: tomorrowStr,
          temperatureMin: Math.round(current.temperature - 4),
          temperatureMax: Math.round(current.temperature + 2),
          condition: current.condition,
          precipitationProbability: current.precipitationProbability,
          summary: `Consistent conditions expected · ${Math.round(current.temperature)}°C`,
        },
      ],
      generatedAt: Date.now(),
    };
  }
}
