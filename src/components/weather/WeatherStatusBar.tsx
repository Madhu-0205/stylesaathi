import React, { useState } from 'react';
import { CloudSun, CloudRain, Sun, Cloud, Snowflake, Wind, RefreshCw, ChevronDown } from 'lucide-react';
import { useWeather } from '../../context/WeatherContext';
import { WeatherCondition } from '../../types';
import { LocationModal } from './LocationModal';

function getWeatherIcon(condition: WeatherCondition, temp: number) {
  switch (condition) {
    case 'rain':
    case 'heavy_rain':
    case 'drizzle':
    case 'thunderstorm':
      return <CloudRain className="h-4 w-4 text-blue-500" />;
    case 'cloudy':
    case 'fog':
      return <Cloud className="h-4 w-4 text-slate-400" />;
    case 'cold':
      return <Snowflake className="h-4 w-4 text-cyan-500" />;
    case 'windy':
      return <Wind className="h-4 w-4 text-teal-500" />;
    case 'clear':
      return temp >= 32 ? <Sun className="h-4 w-4 text-amber-500" /> : <Sun className="h-4 w-4 text-amber-400" />;
    case 'partly_cloudy':
    default:
      return <CloudSun className="h-4 w-4 text-amber-500" />;
  }
}

function getClimateFabricTip(temp: number, humidity: number, condition: WeatherCondition): string {
  if (['rain', 'heavy_rain', 'thunderstorm'].includes(condition)) {
    return 'Rain expected · Practical footwear & water-tolerant pieces';
  }
  if (temp >= 32 && humidity >= 65) {
    return 'Humid heat · Breathable cottons & linens recommended';
  }
  if (temp >= 32) {
    return 'Hot & sunny · Lightweight breathable fabrics recommended';
  }
  if (temp <= 16) {
    return 'Cool weather · Cozy layers & insulating fabrics favored';
  }
  if (humidity >= 75) {
    return 'High humidity · Unlayered, fast-drying pieces recommended';
  }
  return 'Comfortable climate · Balanced everyday proportions';
}

export const WeatherStatusBar: React.FC = () => {
  const {
    location,
    weather,
    freshness,
    isLoading,
    refreshWeather,
    changeLocation,
    requestDeviceLocation,
  } = useWeather();

  const [isModalOpen, setIsModalOpen] = useState(false);

  const isUnavailable = !weather || freshness === 'unavailable';
  const isSimulated = weather?.source === 'simulated';

  const temp = weather ? Math.round(weather.temperature) : null;
  const feelsLike = weather ? Math.round(weather.feelsLike) : null;
  const condition = weather?.condition || 'partly_cloudy';
  const conditionText = weather?.conditionText || '';
  const humidity = weather?.humidity ?? 55;

  const fabricTip = isUnavailable
    ? 'Your wardrobe and personal style recommendations are active.'
    : isSimulated
    ? 'Simulated climate benchmark · Non-factual preview'
    : getClimateFabricTip(temp!, humidity, condition);

  const freshnessLabel = isUnavailable
    ? 'Unavailable'
    : isSimulated
    ? 'Simulated'
    : freshness === 'fresh'
    ? weather?.source === 'cached'
      ? 'Cached'
      : 'Live'
    : freshness === 'stale'
    ? 'Stale'
    : 'Offline';

  const freshnessColor = isUnavailable
    ? 'bg-muted'
    : isSimulated
    ? 'bg-purple-500'
    : freshness === 'fresh'
    ? 'bg-emerald-500'
    : freshness === 'stale'
    ? 'bg-amber-500'
    : 'bg-muted';

  return (
    <>
      <section
        aria-label="Today's weather and climate context"
        className="mb-3 rounded-xl border border-border bg-card p-3 shadow-2xs transition-all animate-fade-in"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Left: Weather condition + Temp + Location Selector */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--ivory) border border-border/60">
              {isUnavailable ? (
                <CloudSun className="h-4 w-4 text-muted" />
              ) : (
                getWeatherIcon(condition, temp!)
              )}
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                {isUnavailable ? (
                  <span className="font-serif text-sm font-semibold text-(--ink)">
                    Weather Unavailable
                  </span>
                ) : (
                  <>
                    <span className="font-serif text-sm font-semibold text-(--ink)">
                      {temp}°C
                    </span>
                    {feelsLike !== null && feelsLike !== temp && (
                      <span className="text-[10px] text-muted">
                        (Feels {feelsLike}°)
                      </span>
                    )}
                    {conditionText && (
                      <span className="text-[10px] font-medium text-muted">· {conditionText}</span>
                    )}
                  </>
                )}
              </div>

              {/* Clickable Location pill with >=44px tap area */}
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="inline-flex min-h-6 items-center gap-1 text-[11px] font-semibold text-(--ink) hover:text-(--kumkum) transition-colors py-0.5"
                title="Change wardrobe location"
                aria-label={`Current location: ${location.city}. Click to change city`}
              >
                <span>{location.city}</span>
                <ChevronDown className="h-3 w-3 text-muted" />
              </button>
            </div>
          </div>

          {/* Right: Freshness + Refresh Button */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full border border-border bg-(--ivory) px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-muted">
              <span className={`h-1.5 w-1.5 rounded-full ${freshnessColor}`} aria-hidden="true" />
              <span>{freshnessLabel}</span>
            </div>

            <button
              type="button"
              onClick={refreshWeather}
              disabled={isLoading}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted hover:text-(--ink) transition-colors"
              title="Refresh weather"
              aria-label="Refresh weather"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-(--burnished-gold)' : ''}`} />
            </button>
          </div>
        </div>

        {/* Fashion-forward climate tip bar */}
        <div className="mt-2 pt-2 border-t border-border/60 flex items-center justify-between text-[10.5px]">
          <span className="text-muted font-medium italic">
            {fabricTip}
          </span>
          <span className="text-[9.5px] uppercase font-bold tracking-wider text-(--burnished-gold) hidden sm:inline">
            Climate Intelligence
          </span>
        </div>
      </section>

      <LocationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentLocation={location}
        onSelectLocation={changeLocation}
        onRequestDeviceLocation={requestDeviceLocation}
      />
    </>
  );
};
