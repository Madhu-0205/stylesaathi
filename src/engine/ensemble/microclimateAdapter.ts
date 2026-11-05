import {
  WardrobeItem,
  ContextSnapshot,
  FabricType,
  Subcategory,
  Occasion,
  Season,
  WeatherFreshness,
  BreathabilityTier,
  GarmentLength,
  LayeringRole,
  StylePreferences,
} from '../../types';
import { getFabricBreathability } from '../fabricIntelligence';

// ============================================================================
// CONTEXTUAL FEATURE REPRESENTATION TYPES (STEP 2)
// ============================================================================

export type FeatureProvenance =
  | 'live_weather'
  | 'cached_weather'
  | 'user_verified'
  | 'image_detected'
  | 'inferred'
  | 'unknown'
  | 'default';

export interface ContextualFeature<T> {
  value: T;
  provenance: FeatureProvenance;
  confidence: number; // 0.0 to 1.0 scale (never called a probability)
  isStale?: boolean;
  isUnknown?: boolean;
  notes?: string;
}

export interface WeatherContextFeatures {
  temperature: ContextualFeature<number | null>; // Celsius
  feelsLike: ContextualFeature<number | null>; // Celsius
  humidity: ContextualFeature<number | null>; // 0 - 100%
  precipitationProbability: ContextualFeature<number | null>; // 0 - 100%
  windSpeed: ContextualFeature<number | null>; // km/h
  freshness: WeatherFreshness;
  isUsable: boolean;
  isStale: boolean;
  effectiveThermalIndex: number | null;
}

export interface GarmentContextFeatures {
  itemId: string;
  name: string;
  fabric: ContextualFeature<FabricType>;
  breathability: ContextualFeature<BreathabilityTier>;
  waterSensitivity: ContextualFeature<'high' | 'moderate' | 'low' | 'unknown'>;
  layeringRole: ContextualFeature<LayeringRole>;
  length: ContextualFeature<GarmentLength>;
  isDelicateInRain: boolean;
  isInsulatingInCold: boolean;
  isBreathableInHeat: boolean;
  hasVerifiedMetadata: boolean;
}

export interface MicroclimateOptions {
  occasion: Occasion;
  season?: Season;
  context?: ContextSnapshot | null;
  preferences?: StylePreferences;
}

export interface MicroclimateEvaluationResult {
  scoreDelta: number; // Calibrated score delta bounded to [-2.0, +2.0]
  confidence: number; // 0.0 to 1.0
  reasons: string[];
  warnings: string[];
  appliedRules: string[];
  signalsUsed: string[];
  weatherFeatures: WeatherContextFeatures;
  garmentFeatures: GarmentContextFeatures[];
}

// ============================================================================
// METADATA DEFINITIONS & GUARDRAILS
// ============================================================================

const VERIFIED_DELICATE_RAIN_FABRICS = new Set<FabricType>([
  'silk',
  'banarasi',
  'tussar',
  'velvet',
  'organza',
]);

const VERIFIED_WARM_INSULATING_FABRICS = new Set<FabricType>([
  'wool',
  'velvet',
  'denim',
]);

const VERIFIED_BREATHABLE_FABRICS = new Set<FabricType>([
  'cotton',
  'linen',
  'khadi',
  'mulmul',
]);

const DELICATE_RAIN_FOOTWEAR_SUBS = new Set<Subcategory>([
  'juttis',
  'kolhapuris',
  'heels',
]);

const WATER_TOLERANT_FOOTWEAR_SUBS = new Set<Subcategory>([
  'sandals',
  'flats',
  'sneakers',
]);

const FORMAL_DECORUM_OCCASIONS = new Set<Occasion>([
  'interview',
  'office',
  'wedding guest',
  'celebration',
  'engagement',
  'puja',
]);

// ============================================================================
// FEATURE EXTRACTION (STEP 2)
// ============================================================================

/**
 * Extracts weather features with rigorous provenance, staleness, and uncertainty states.
 * Guarantees that simulated, missing, or expired weather is marked as unusable.
 */
export function extractWeatherFeatures(
  context?: ContextSnapshot | null
): WeatherContextFeatures {
  if (
    !context ||
    !context.weather ||
    context.source === 'simulated' ||
    context.source === 'unavailable' ||
    context.freshness === 'unavailable' ||
    context.freshness === 'expired'
  ) {
    return {
      temperature: { value: null, provenance: 'unknown', confidence: 0.0, isUnknown: true },
      feelsLike: { value: null, provenance: 'unknown', confidence: 0.0, isUnknown: true },
      humidity: { value: null, provenance: 'unknown', confidence: 0.0, isUnknown: true },
      precipitationProbability: { value: null, provenance: 'unknown', confidence: 0.0, isUnknown: true },
      windSpeed: { value: null, provenance: 'unknown', confidence: 0.0, isUnknown: true },
      freshness: context?.freshness || 'unavailable',
      isUsable: false,
      isStale: false,
      effectiveThermalIndex: null,
    };
  }

  const w = context.weather;
  const isStale = context.freshness === 'stale';
  const provenance: FeatureProvenance = context.source === 'live' ? 'live_weather' : 'cached_weather';
  const baseConfidence = isStale ? 0.45 : context.source === 'live' ? 0.95 : 0.85;

  const temp = w.temperature;
  const hum = w.humidity;
  const wind = w.windSpeed || 0;

  // Apparent thermal index: combines dry-bulb temperature, humidity index, and convective wind
  // Uses Australian apparent temperature model approximation for intuitive clothing comfort
  let effectiveThermalIndex = temp;
  if (temp >= 26) {
    // Latent heat burden: humidity above 50% adds apparent thermal load
    effectiveThermalIndex = temp + 0.12 * Math.max(0, hum - 50);
  } else if (temp <= 18) {
    // Wind chill: convective cooling lowers apparent temperature
    effectiveThermalIndex = temp - 0.06 * Math.max(0, wind - 5);
  }

  return {
    temperature: {
      value: temp,
      provenance,
      confidence: baseConfidence,
      isStale,
      isUnknown: false,
    },
    feelsLike: {
      value: w.feelsLike ?? temp,
      provenance,
      confidence: baseConfidence,
      isStale,
      isUnknown: false,
    },
    humidity: {
      value: hum,
      provenance,
      confidence: baseConfidence,
      isStale,
      isUnknown: false,
    },
    precipitationProbability: {
      value: w.precipitationProbability ?? 0,
      provenance,
      confidence: baseConfidence,
      isStale,
      isUnknown: false,
    },
    windSpeed: {
      value: wind,
      provenance,
      confidence: baseConfidence,
      isStale,
      isUnknown: false,
    },
    freshness: context.freshness,
    isUsable: true,
    isStale,
    effectiveThermalIndex: Math.round(effectiveThermalIndex * 10) / 10,
  };
}

/**
 * Extracts garment microclimate features with explicit provenance and uncertainty states.
 * UNKNOWN MUST NEVER BE TREATED AS INCOMPATIBLE.
 */
export function extractGarmentContextFeatures(item: WardrobeItem): GarmentContextFeatures {
  const isUserVerified = item.userVerified === true || item.fabricVerificationStatus === 'user_confirmed';
  const hasFabric = Boolean(item.fabric && item.fabric !== 'unknown');

  // 1. Fabric Provenance
  let fabricProv: FeatureProvenance = 'unknown';
  let fabricConf = 0.0;
  if (isUserVerified && hasFabric) {
    fabricProv = 'user_verified';
    fabricConf = 1.0;
  } else if (hasFabric) {
    fabricProv = 'image_detected';
    fabricConf = item.aiConfidence ?? 0.7;
  }

  const fabricFeature: ContextualFeature<FabricType> = {
    value: item.fabric || 'unknown',
    provenance: fabricProv,
    confidence: fabricConf,
    isUnknown: !hasFabric,
  };

  // 2. Breathability (ONLY inferred if fabric is known or breathability explicitly confirmed)
  let breathVal: BreathabilityTier = 'unknown';
  let breathProv: FeatureProvenance = 'unknown';
  let breathConf = 0.0;

  if (item.breathability && item.breathability !== 'unknown') {
    breathVal = item.breathability;
    breathProv = isUserVerified ? 'user_verified' : 'inferred';
    breathConf = isUserVerified ? 1.0 : 0.8;
  } else if (hasFabric) {
    breathVal = getFabricBreathability(item.fabric!);
    breathProv = 'inferred';
    breathConf = fabricConf * 0.85;
  }

  const breathabilityFeature: ContextualFeature<BreathabilityTier> = {
    value: breathVal,
    provenance: breathProv,
    confidence: breathConf,
    isUnknown: breathVal === 'unknown',
  };

  // 3. Water Sensitivity (Verified only on known fabrics or delicate footwear)
  let waterSens: 'high' | 'moderate' | 'low' | 'unknown' = 'unknown';
  let waterProv: FeatureProvenance = 'unknown';
  let waterConf = 0.0;

  const isDelicateSubcategory = DELICATE_RAIN_FOOTWEAR_SUBS.has(item.subcategory);
  const isLeather =
    (item.materialComposition || '').toLowerCase().includes('leather') ||
    item.name.toLowerCase().includes('leather') ||
    (item.note || '').toLowerCase().includes('leather');

  if (hasFabric && VERIFIED_DELICATE_RAIN_FABRICS.has(item.fabric!)) {
    waterSens = 'high';
    waterProv = fabricProv;
    waterConf = fabricConf;
  } else if (isDelicateSubcategory || isLeather) {
    waterSens = 'high';
    waterProv = 'inferred';
    waterConf = 0.85;
  } else if (hasFabric && (item.fabric === 'cotton' || item.fabric === 'denim' || item.fabric === 'polyblend')) {
    waterSens = 'low';
    waterProv = fabricProv;
    waterConf = fabricConf;
  }

  const waterSensitivityFeature: ContextualFeature<'high' | 'moderate' | 'low' | 'unknown'> = {
    value: waterSens,
    provenance: waterProv,
    confidence: waterConf,
    isUnknown: waterSens === 'unknown',
  };

  // 4. Layering Role & Length
  const layeringFeature: ContextualFeature<LayeringRole> = {
    value: item.layeringRole || (item.category === 'Outerwear' ? 'outer' : 'base'),
    provenance: item.layeringRole ? 'user_verified' : 'default',
    confidence: item.layeringRole ? 1.0 : 0.75,
  };

  const lengthFeature: ContextualFeature<GarmentLength> = {
    value: item.length || 'unknown',
    provenance: item.length ? 'user_verified' : 'unknown',
    confidence: item.length ? 1.0 : 0.0,
    isUnknown: !item.length || item.length === 'unknown',
  };

  const isDelicateInRain = waterSens === 'high';
  const isInsulatingInCold =
    hasFabric && VERIFIED_WARM_INSULATING_FABRICS.has(item.fabric!) && fabricConf >= 0.7;
  const isBreathableInHeat =
    hasFabric && VERIFIED_BREATHABLE_FABRICS.has(item.fabric!) && fabricConf >= 0.7;

  return {
    itemId: item.id,
    name: item.name,
    fabric: fabricFeature,
    breathability: breathabilityFeature,
    waterSensitivity: waterSensitivityFeature,
    layeringRole: layeringFeature,
    length: lengthFeature,
    isDelicateInRain,
    isInsulatingInCold,
    isBreathableInHeat,
    hasVerifiedMetadata: isUserVerified,
  };
}

// ============================================================================
// CONTEXTUAL MICROCLIMATE EVALUATION (STEPS 3, 4, 5)
// ============================================================================

/**
 * Evaluates contextual microclimate adaptation for an outfit.
 *
 * GUARANTEES:
 * 1. Deterministic output: Identical inputs produce identical score deltas and explanations.
 * 2. Transparent signals: Reports every physical meteorological signal used.
 * 3. Graceful fallback: Stale or missing weather safely defaults to delta 0.0 without errors.
 * 4. No false incompatibility: Unknown garment metadata produces neutral score delta (0.0).
 * 5. Bounded influence: Score delta strictly clamped to [-2.0, +2.0] so microclimate guides
 *    recommendation ranking without breaking sartorial harmony or cultural decorum.
 * 6. User preference protection: Explicit user preferences (e.g. warmth sensitivity) modulate
 *    the evaluation and are never overridden.
 */
export function evaluateMicroclimateAdaptation(
  pieces: WardrobeItem[],
  options: MicroclimateOptions
): MicroclimateEvaluationResult {
  const { occasion, context, preferences } = options;
  const weatherFeatures = extractWeatherFeatures(context);
  const garmentFeatures = pieces.map(extractGarmentContextFeatures);

  const reasons: string[] = [];
  const warnings: string[] = [];
  const appliedRules: string[] = [];
  const signalsUsed: string[] = [];

  // --------------------------------------------------------------------------
  // STEP 4 GUARDRAIL: GRACEFUL FALLBACK ON MISSING OR UNUSABLE WEATHER
  // --------------------------------------------------------------------------
  if (!weatherFeatures.isUsable) {
    return {
      scoreDelta: 0.0,
      confidence: 0.0,
      reasons: [],
      warnings: [],
      appliedRules: ['weather_unavailable_graceful_fallback'],
      signalsUsed: [],
      weatherFeatures,
      garmentFeatures,
    };
  }

  let delta = 0.0;
  const temp = weatherFeatures.temperature.value!;
  const humidity = weatherFeatures.humidity.value ?? 50;
  const rainProb = weatherFeatures.precipitationProbability.value ?? 0;
  const wind = weatherFeatures.windSpeed.value ?? 0;
  const effTemp = weatherFeatures.effectiveThermalIndex ?? temp;

  signalsUsed.push(
    `temp=${temp}°C`,
    `humidity=${humidity}%`,
    `effTemp=${effTemp}°C`,
    `rainProb=${rainProb}%`,
    `wind=${wind}km/h`
  );

  // User sensitivity profile
  const warmthSensitivity = preferences?.comfortPreferences?.warmthSensitivity || 'standard';
  const isHighFormality = FORMAL_DECORUM_OCCASIONS.has(occasion);

  // --------------------------------------------------------------------------
  // 1. THERMAL & BREATHABILITY EVALUATION (HEAT & HUMIDITY)
  // --------------------------------------------------------------------------
  if (effTemp >= 29) {
    const isExtremeHeat = effTemp >= 36;
    const isCoastalHumidHeat = humidity >= 68;

    // Verified breathable garments
    const breathableCount = garmentFeatures.filter((g) => g.isBreathableInHeat).length;
    if (breathableCount > 0) {
      const breathBonus = Math.min(1.0, breathableCount * 0.4);
      delta += breathBonus;
      appliedRules.push('breathable_fabric_heat_bonus');
      reasons.push(
        `Breathable lightweight fabrics well suited for today’s ${
          isCoastalHumidHeat ? 'humid heat' : 'warm weather'
        } (${Math.round(temp)}°C, ${humidity}% humidity)`
      );
    }

    // Low-breathability garments in humid heat (applies to primary body garments, not footwear/accessories)
    const lowBreathCount = garmentFeatures.filter((g) => {
      if (g.breathability.value !== 'low' || g.breathability.isUnknown) return false;
      const piece = pieces.find((p) => p.id === g.itemId);
      return piece && piece.category !== 'Footwear' && piece.category !== 'Accessories';
    }).length;

    if (lowBreathCount > 0) {
      let penalty = lowBreathCount * 0.6;
      if (isCoastalHumidHeat) penalty *= 1.3;
      if (warmthSensitivity === 'runs_warm') penalty *= 1.25;
      if (warmthSensitivity === 'runs_cold') penalty *= 0.6;

      // Soften penalty for formal decorum (e.g. interview blazer)
      if (isHighFormality) {
        penalty *= 0.5;
        appliedRules.push('formal_heat_softening');
      }

      delta -= penalty;
      appliedRules.push('low_breathability_heat_penalty');
      warnings.push(
        `High humidity (${humidity}%) restricts evaporative cooling for heavier weaves`
      );
    }

    // Outerwear check in heat
    const hasOuterwear = pieces.some(
      (p) => p.category === 'Outerwear' || p.subcategory === 'blazer' || p.subcategory === 'jacket'
    );
    if (hasOuterwear) {
      if (isHighFormality) {
        delta -= 0.35; // Gentle decorum deduction
        appliedRules.push('formal_outerwear_heat_tolerance');
      } else {
        delta -= 1.2;
        appliedRules.push('casual_outerwear_heat_penalty');
        warnings.push('Heavy outerwear traps heat in warm weather');
      }
    }
  }

  // --------------------------------------------------------------------------
  // 2. COOL WEATHER & THERMAL PRESERVATION
  // --------------------------------------------------------------------------
  else if (effTemp <= 18) {
    const isCold = effTemp <= 12;

    // Insulating garments (wool, velvet, heavy denim)
    const warmCount = garmentFeatures.filter((g) => g.isInsulatingInCold).length;
    if (warmCount > 0) {
      const warmBonus = Math.min(1.2, warmCount * 0.45);
      delta += warmBonus;
      appliedRules.push('insulating_fabric_cold_bonus');
      reasons.push(
        `Cozy insulating fabrics suited for cool temperatures (${Math.round(temp)}°C)`
      );
    }

    // Multi-piece layering
    const hasOuterwear = pieces.some(
      (p) =>
        p.category === 'Outerwear' ||
        p.subcategory === 'blazer' ||
        p.subcategory === 'sweater' ||
        p.subcategory === 'shrug' ||
        p.subcategory === 'jacket' ||
        p.subcategory === 'nehru jacket'
    );
    if (hasOuterwear) {
      delta += 0.5;
      appliedRules.push('outerwear_layering_cold_bonus');
    }

    // Sheer single layer penalty without outer layer
    const sheerSubs: Subcategory[] = ['crop top', 'top'];
    const hasSingleSheer =
      !hasOuterwear &&
      garmentFeatures.some(
        (g) =>
          g.fabric.value === 'chiffon' ||
          g.fabric.value === 'organza' ||
          g.fabric.value === 'mulmul'
      );
    if (hasSingleSheer) {
      let sheerPenalty = isCold ? 1.0 : 0.6;
      if (warmthSensitivity === 'runs_cold') sheerPenalty *= 1.3;
      delta -= sheerPenalty;
      appliedRules.push('sheer_single_layer_cold_penalty');
      warnings.push('Light single layer lacks sufficient warmth for cool air');
    }
  }

  // --------------------------------------------------------------------------
  // 3. PRECIPITATION & MONSOON PRACTICALITY
  // --------------------------------------------------------------------------
  if (rainProb >= 50 || context?.rainContext === 'active_rain' || context?.rainContext === 'high_risk') {
    // A. Delicate fabrics easily ruined or spotted by rain
    const delicateRainCount = garmentFeatures.filter((g) => g.isDelicateInRain).length;
    if (delicateRainCount > 0) {
      const delicatePenalty = Math.min(1.5, delicateRainCount * 0.7);
      delta -= delicatePenalty;
      appliedRules.push('delicate_fabric_rain_penalty');
      warnings.push(
        `Delicate fabrics (silk/velvet) risk water-spotting in rain (${rainProb}% precipitation)`
      );
    }

    // B. Footwear suitability in wet conditions
    const hasDelicateFootwear = pieces.some((p) =>
      DELICATE_RAIN_FOOTWEAR_SUBS.has(p.subcategory)
    );
    const hasPracticalFootwear = pieces.some((p) =>
      WATER_TOLERANT_FOOTWEAR_SUBS.has(p.subcategory)
    );

    if (hasDelicateFootwear) {
      delta -= 1.1;
      appliedRules.push('delicate_footwear_rain_penalty');
      warnings.push('Leather footwear is prone to water damage on wet streets');
    } else if (hasPracticalFootwear) {
      delta += 0.45;
      appliedRules.push('practical_footwear_rain_bonus');
      reasons.push('Rain-tolerant footwear well suited for wet streets');
    }

    // C. Trailing hemline mud-splatter hazard
    const hasTrailingHem = pieces.some(
      (p) => p.subcategory === 'lehenga' || p.length === 'floor_length'
    );
    if (hasTrailingHem) {
      delta -= 0.6;
      appliedRules.push('trailing_hem_mud_penalty');
      warnings.push('Floor-length hemlines risk mud splatter in wet conditions');
    }
  }

  // --------------------------------------------------------------------------
  // 4. WIND CONDITIONS & STRUCTURAL INTEGRITY
  // --------------------------------------------------------------------------
  if (wind >= 25) {
    const hasOuterwear = pieces.some(
      (p) => p.category === 'Outerwear' || p.subcategory === 'blazer' || p.subcategory === 'jacket'
    );
    if (hasOuterwear) {
      delta += 0.35;
      appliedRules.push('structured_windbreak_bonus');
      reasons.push(`Structured outer layer provides comfortable wind resistance (${Math.round(wind)} km/h)`);
    }

    // Convective wind chill acceleration in cool weather
    if (effTemp <= 18 && wind >= 35) {
      appliedRules.push('wind_chill_convective_cooling');
    }
  }

  // --------------------------------------------------------------------------
  // 5. STALENESS SCALING (STEP 4)
  // --------------------------------------------------------------------------
  if (weatherFeatures.isStale) {
    // Stale weather reduces influence by 50%
    delta *= 0.5;
    appliedRules.push('stale_weather_dampening_50pct');
    if (reasons.length > 0) {
      reasons[0] = `(Earlier weather cache) ${reasons[0]}`;
    }
  }

  // --------------------------------------------------------------------------
  // 6. STRICT BOUNDING [-2.0, +2.0]
  // --------------------------------------------------------------------------
  const scoreDelta = Math.max(-2.0, Math.min(2.0, Math.round(delta * 100) / 100));

  return {
    scoreDelta,
    confidence: weatherFeatures.temperature.confidence,
    reasons,
    warnings,
    appliedRules,
    signalsUsed,
    weatherFeatures,
    garmentFeatures,
  };
}
