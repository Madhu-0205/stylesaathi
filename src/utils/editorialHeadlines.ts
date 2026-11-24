import { WeatherSnapshot, OutfitPlan, Occasion, Season } from '../types';
import { ShadowWeatherFreshness } from '../engine/ensemble/types';

export interface DailyEditorialHeaderContext {
  date: Date;
  weather?: WeatherSnapshot | null;
  weatherFreshness?: ShadowWeatherFreshness | string;
  city?: string;
  todayPlan?: OutfitPlan | null;
  activeOccasion: Occasion;
  cleanCount: number;
  userName?: string | null;
  season: Season;
}

export interface DailyEditorialHeaderData {
  greeting: string;
  indianDayName: string;
  formattedDate: string;
  kicker: string;
  headline: string;
  editorialMemo: string;
  weatherBadge: string;
  weatherFreshnessLabel: string;
  thermalAdvice: string;
}

const INDIAN_DAYS = [
  'Ravivaar',
  'Somvaar',
  'Mangalvaar',
  'Budhvaar',
  'Guruvaar',
  'Shukravaar',
  'Shanivaar',
];

export function generateDailyEditorialHeader(
  ctx: DailyEditorialHeaderContext
): DailyEditorialHeaderData {
  const { date, weather, weatherFreshness, city, todayPlan, activeOccasion, userName, season } = ctx;

  const dayIndex = date.getDay();
  const indianDayName = INDIAN_DAYS[dayIndex];

  const formattedDate = date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const hour = date.getHours();
  let timeGreeting = 'Good morning';
  if (hour >= 12 && hour < 17) {
    timeGreeting = 'Good afternoon';
  } else if (hour >= 17 && hour < 22) {
    timeGreeting = 'Good evening';
  } else if (hour >= 22 || hour < 5) {
    timeGreeting = 'Late night edit';
  }

  const namePart = userName ? `, ${userName}` : '';
  const greeting = `${timeGreeting}${namePart}`;

  const seasonUpper = season.toUpperCase();
  const kicker = `STYLESAATHI · ${seasonUpper} EDIT · ${indianDayName.toUpperCase()}`;

  // Weather badge & thermal advice
  let weatherBadge = 'Weather Context Available';
  let thermalAdvice = 'Balanced everyday climate · Versatile rotation across silhouettes';
  let weatherFreshnessLabel = '';

  if (weatherFreshness === 'simulated') {
    weatherFreshnessLabel = 'Simulated Context';
  } else if (weatherFreshness === 'stale') {
    weatherFreshnessLabel = 'Cached (~1h ago)';
  } else if (weatherFreshness === 'expired') {
    weatherFreshnessLabel = 'Expired Weather';
  } else if (weatherFreshness === 'fresh') {
    weatherFreshnessLabel = 'Live Microclimate';
  }

  if (weather && weatherFreshness !== 'missing' && weatherFreshness !== 'expired') {
    const temp = Math.round(weather.temperature);
    const cond = weather.condition || 'Clear';
    const citySuffix = city ? ` in ${city}` : '';
    weatherBadge = `${temp}°C · ${cond}${citySuffix}`;

    if (weather.precipitationProbability > 50 || cond.toLowerCase().includes('rain')) {
      thermalAdvice = 'Wet & humid climate · Water-tolerant footwear & durable cotton/modal layers recommended';
    } else if (weather.temperature > 32) {
      thermalAdvice = 'High heatwave · Breathable handloom cotton, mulmul, or linen recommended';
    } else if (weather.temperature > 27) {
      thermalAdvice = 'Warm tropical warmth · Breathable natural weaves & fluid drapes recommended';
    } else if (weather.temperature < 18) {
      thermalAdvice = 'Pleasant & cool · Structured tailoring, neat blazer, or modal layers recommended';
    } else {
      thermalAdvice = 'Temperate climate · High silhouette versatility from casual tees to structured kurtas';
    }
  }

  // Generate context-aware headline and narrative memo
  let headline = 'Curated Styling Edit for Your Day';
  let editorialMemo = 'Mindful harmony, balanced proportions, and effortless comfort selected from what you already own.';

  if (todayPlan) {
    headline = `Prepared for Today's ${todayPlan.occasion ? todayPlan.occasion.charAt(0).toUpperCase() + todayPlan.occasion.slice(1) : 'Scheduled Look'}`;
    editorialMemo = todayPlan.outfit.why
      ? `Scheduled look: "${todayPlan.outfit.why}"`
      : 'Your pre-planned ensemble is ready to wear today. Clean, composed, and styled for your schedule.';
  } else if (weather && (weather.precipitationProbability > 50 || weather.condition.toLowerCase().includes('rain'))) {
    headline = 'Monsoon Ease: Breathable Linens & Durable Silhouettes';
    editorialMemo = 'Wet streets call for ankle-clearing hems, breathable weaves that dry with ease, and dependable footwear.';
  } else if (weather && weather.temperature > 32) {
    headline = 'Sun-Drenched Respite: Light Mulmul & Open Weaves';
    editorialMemo = 'High heat requires minimal contact with the skin: flowing kurtis, relaxed trousers, and airy cotton textures.';
  } else if (weather && weather.temperature < 18) {
    headline = 'Architectural Polish: Structured Overlays & Tailored Warmth';
    editorialMemo = 'Crisp air is an invitation to layer: structured jackets, dense cottons, and rich tonal depth.';
  } else if (activeOccasion === 'college') {
    headline = 'Effortless Campus Polish: Contemporary Ease & Comfort';
    editorialMemo = 'Lightweight staples designed for movement between lectures and casual social hours.';
  } else if (activeOccasion === 'office' || (activeOccasion as string) === 'work') {
    headline = 'Executive Discernment: Sharp Lines & Measured Elegance';
    editorialMemo = 'Tailored structure and refined tones that project professional confidence without rigidity.';
  } else if (activeOccasion === 'festive' || activeOccasion === 'celebration' || activeOccasion === 'wedding guest') {
    headline = 'Ceremonial Radiance: Heritage Crafts & Statement Drapes';
    editorialMemo = 'Rich textiles, graceful proportions, and artisanal craft details suited for auspicious celebration.';
  } else if (activeOccasion === 'date' || activeOccasion === 'party') {
    headline = 'Evening Allure: Clean Silhouettes & Sophisticated Contrast';
    editorialMemo = 'Subtle drama, flattering drape, and tactile fabrics tuned for evening lights and social warmth.';
  } else {
    headline = 'Everyday Mindful Balance: Curated for How You Dress';
    editorialMemo = 'Timeless staples combined with intentional color harmony, grounded entirely in your personal archive.';
  }

  return {
    greeting,
    indianDayName,
    formattedDate,
    kicker,
    headline,
    editorialMemo,
    weatherBadge,
    weatherFreshnessLabel,
    thermalAdvice,
  };
}

