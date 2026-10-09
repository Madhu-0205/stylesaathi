import { WardrobeItem, ContextSnapshot, FabricType, Subcategory } from '../types';
import { getFabricBreathability } from './fabricIntelligence';

export interface WeatherComfortResult {
  scoreDelta: number;
  reasons: string[];
  warnings: string[];
}

const DELICATE_RAIN_FABRICS: FabricType[] = [
  'silk',
  'banarasi',
  'tussar',
  'velvet',
  'organza',
];

const DELICATE_RAIN_FOOTWEAR: Subcategory[] = [
  'juttis',
  'kolhapuris',
  'heels',
];

const WATER_TOLERANT_FOOTWEAR: Subcategory[] = [
  'sandals',
  'flats',
  'sneakers',
];

const HEAVY_LAYERS: Subcategory[] = [
  'jacket',
  'blazer',
  'sweater',
  'hoodie',
  'shrug',
];

const FORMAL_OCCASIONS = ['interview', 'office', 'wedding guest', 'puja', 'celebration'];

/**
 * Computes deterministic weather and climate comfort score delta for an outfit.
 * Clamped strictly to [-3.5, +3.5] so climate guides ranking without breaking domain harmony.
 */
export function calculateWeatherComfortScore(
  pieces: WardrobeItem[],
  context?: ContextSnapshot | null
): WeatherComfortResult {
  if (!context || !context.weather) {
    return { scoreDelta: 0, reasons: [], warnings: [] };
  }

  let delta = 0;
  const reasons: string[] = [];
  const warnings: string[] = [];

  const { weather, thermalContext, rainContext, occasion } = context;
  const isHumidHeat = (thermalContext === 'hot' || thermalContext === 'very_hot') && weather.humidity >= 65;
  const isHighFormality = FORMAL_OCCASIONS.includes(occasion);

  const pieceFabrics = pieces.map((p) => p.fabric).filter(Boolean) as FabricType[];
  const pieceSubs = pieces.map((p) => p.subcategory || '');
  const hasOuterwear = pieces.some((p) => p.category === 'Outerwear' || HEAVY_LAYERS.includes(p.subcategory));

  // --------------------------------------------------------------------------
  // 1. THERMAL COMFORT & BREATHABILITY
  // --------------------------------------------------------------------------
  if (thermalContext === 'very_hot' || thermalContext === 'hot') {
    // A. Breathability evaluation
    const breathableCount = pieceFabrics.filter((f) => getFabricBreathability(f) === 'high').length;
    const lowBreathableCount = pieceFabrics.filter((f) => getFabricBreathability(f) === 'low').length;

    if (breathableCount > 0) {
      const breathBonus = Math.min(1.8, breathableCount * 0.7);
      delta += breathBonus;
      if (breathableCount >= 2 && !reasons.includes('breathable_heat')) {
        reasons.push(
          `Lightweight breathable fabrics suited for today's ${thermalContext === 'very_hot' ? 'intense heat' : 'warm weather'} (${Math.round(weather.temperature)}°C)`
        );
      }
    }

    if (lowBreathableCount > 0) {
      // In humid heat (e.g. coastal Mumbai/Chennai/Kolkata), sweat cannot evaporate
      const humidityMultiplier = isHumidHeat ? 1.35 : 1.0;
      let heatPenalty = lowBreathableCount * 1.0 * humidityMultiplier;

      // Dampen penalty slightly if high formality requires structured clothing
      if (isHighFormality) {
        heatPenalty *= 0.6;
      }

      delta -= heatPenalty;
      if (isHumidHeat) {
        warnings.push('High humidity makes heavier fabrics feel clammy and hot');
      }
    }

    // B. Layering penalty in high heat
    if (hasOuterwear) {
      if (isHighFormality && occasion === 'interview') {
        delta -= 0.8; // Formal requirement softens the heat penalty for an interview blazer
      } else {
        delta -= 2.2;
        warnings.push('Heavy outerwear traps heat in today’s temperature');
      }
    }

    // C. Loose relaxed fits vs tight fits
    const hasRelaxedFit = pieces.some((p) => p.fit === 'relaxed' || p.fit === 'oversized' || p.fit === 'a_line');
    if (hasRelaxedFit) {
      delta += 0.4;
    }
  } else if (thermalContext === 'warm') {
    const breathableCount = pieceFabrics.filter((f) => getFabricBreathability(f) === 'high').length;
    if (breathableCount > 0) {
      delta += 0.5;
    }
  } else if (thermalContext === 'cool' || thermalContext === 'cold' || thermalContext === 'very_cold') {
    // Insulating warmth in cool/cold weather
    const warmFabrics: FabricType[] = ['wool', 'velvet', 'denim', 'silk', 'tussar', 'banarasi'];
    const warmFabricCount = pieceFabrics.filter((f) => warmFabrics.includes(f)).length;

    if (warmFabricCount > 0) {
      delta += Math.min(2.0, warmFabricCount * 0.8);
      reasons.push(`Cozy insulating fabrics suited for cool conditions (${Math.round(weather.temperature)}°C)`);
    }

    if (hasOuterwear) {
      delta += 1.4;
    }

    // Penalty for ultra-sheer single layer without outerwear
    const sheerFabrics: FabricType[] = ['mulmul', 'chiffon', 'organza'];
    const sheerCount = pieceFabrics.filter((f) => sheerFabrics.includes(f)).length;
    if (sheerCount > 0 && !hasOuterwear) {
      delta -= 1.2;
      warnings.push('Light single layers may feel chilly in today’s cool air');
    }
  }

  // --------------------------------------------------------------------------
  // 2. RAIN & MONSOON PRACTICALITY
  // --------------------------------------------------------------------------
  if (rainContext === 'active_rain' || rainContext === 'high_risk') {
    // A. Delicate fabrics easily stained or spotted by water
    const delicateCount = pieceFabrics.filter((f) => DELICATE_RAIN_FABRICS.includes(f)).length;
    if (delicateCount > 0) {
      delta -= Math.min(2.5, delicateCount * 1.3);
      warnings.push('Delicate fabrics risk water spotting in today’s rain');
    }

    // B. Footwear practicality in puddles and rain
    const delicateFootwear = pieces.some((p) => DELICATE_RAIN_FOOTWEAR.includes(p.subcategory));
    const practicalFootwear = pieces.some((p) => WATER_TOLERANT_FOOTWEAR.includes(p.subcategory));

    if (delicateFootwear) {
      delta -= 2.0;
      warnings.push('Traditional leather footwear (juttis/kolhapuris) easily stains in wet streets');
    } else if (practicalFootwear) {
      delta += 0.8;
      reasons.push('Rain-tolerant footwear well suited for wet weather');
    }

    // C. Trailing silhouettes on wet ground
    const trailingSubs: Subcategory[] = ['lehenga', 'anarkali'];
    if (pieces.some((p) => trailingSubs.includes(p.subcategory))) {
      delta -= 1.5;
    }

    // D. Fast-drying fabrics
    const fastDrying: FabricType[] = ['cotton', 'chiffon', 'georgette'];
    if (pieceFabrics.some((f) => fastDrying.includes(f))) {
      delta += 0.5;
    }
  }

  // --------------------------------------------------------------------------
  // 3. BOUNDED NORMALIZATION
  // --------------------------------------------------------------------------
  const scoreDelta = Math.max(-3.5, Math.min(3.5, Math.round(delta * 10) / 10));

  return {
    scoreDelta,
    reasons,
    warnings,
  };
}

/**
 * Returns 1-2 concise, evidence-based context why reasons grounded in real weather data.
 */
export function getContextWhyReasons(
  pieces: WardrobeItem[],
  context?: ContextSnapshot | null
): string[] {
  // Weather explanations must ONLY be generated when verified live or cached weather evidence exists.
  // Never generate weather explanations for simulated fallback or unavailable weather.
  if (!context || !context.weather || context.source === 'simulated' || context.source === 'unavailable') {
    return [];
  }

  const comfort = calculateWeatherComfortScore(pieces, context);
  const outReasons: string[] = [];

  if (comfort.reasons.length > 0) {
    outReasons.push(comfort.reasons[0]);
  } else if (context.thermalContext === 'very_hot' || context.thermalContext === 'hot') {
    const hasCottonOrLinen = pieces.some((p) => p.fabric === 'cotton' || p.fabric === 'linen' || p.fabric === 'khadi');
    if (hasCottonOrLinen) {
      outReasons.push(`Breathable comfort for today’s heat (${Math.round(context.weather.temperature)}°C)`);
    }
  } else if (context.rainContext === 'active_rain' || context.rainContext === 'high_risk') {
    outReasons.push('Practical pieces suited for damp weather and rain showers');
  }

  return outReasons;
}
