import {
  WardrobeItem,
  ContextSnapshot,
  StylePreferences,
  Occasion,
} from '../../types';
import { GarmentPairType, HardIncompatibilityResult } from './types';

export interface HardIncompatibilityOptions {
  context?: ContextSnapshot;
  preferences?: StylePreferences;
  occasion?: Occasion;
  allowPlanningMode?: boolean; // When true, items needing wash are permitted for future outfit planning
}

/**
 * Evaluates deterministic Tier 1 hard incompatibility constraints between two garments.
 * Hard constraints represent physical, structural, safety, or severe climate barriers.
 */
export function evaluatePairHardIncompatibility(
  itemA: WardrobeItem,
  itemB: WardrobeItem,
  pairType: GarmentPairType,
  options: HardIncompatibilityOptions = {}
): HardIncompatibilityResult {
  const { context, preferences, occasion, allowPlanningMode } = options;

  // 1. Duplicate item check
  if (itemA.id === itemB.id) {
    return {
      isIncompatible: true,
      violationType: 'duplicate_item',
      reason: `Identical item cannot be paired with itself: "${itemA.name}" (${itemA.id}).`,
    };
  }

  // 2. Physical Cleanliness Status Check
  if (!allowPlanningMode) {
    if (itemA.status !== 'clean') {
      return {
        isIncompatible: true,
        violationType: 'unwearable_status',
        reason: `Item "${itemA.name}" is currently in laundry or needs washing (${itemA.status}).`,
      };
    }
    if (itemB.status !== 'clean') {
      return {
        isIncompatible: true,
        violationType: 'unwearable_status',
        reason: `Item "${itemB.name}" is currently in laundry or needs washing (${itemB.status}).`,
      };
    }
  }

  // 3. Structural Duplicate / Competing Layer Collision
  if (pairType === 'structural_duplicate_conflict') {
    return {
      isIncompatible: true,
      violationType: 'conflicting_base_layer',
      reason: `Structural collision: "${itemA.name}" (${itemA.subcategory || itemA.category}) and "${itemB.name}" (${itemB.subcategory || itemB.category}) compete for the same physical layer/slot.`,
    };
  }

  // 4. Extreme Climate Hazard Check (Severe Deluge / Torrential Rain vs Delicate Luxury Fabrics)
  if (context?.weather) {
    const isSevereDeluge =
      context.rainContext === 'active_rain' ||
      context.weather.condition === 'heavy_rain' ||
      context.weather.condition === 'thunderstorm';

    if (isSevereDeluge) {
      const delicateFabrics = ['silk', 'raw_silk', 'velvet', 'suede'];
      const fabricA = (itemA.fabric || '').toLowerCase();
      const fabricB = (itemB.fabric || '').toLowerCase();

      if (delicateFabrics.includes(fabricA)) {
        return {
          isIncompatible: true,
          violationType: 'severe_weather_hazard',
          reason: `Severe weather hazard: "${itemA.name}" contains delicate ${itemA.fabric}, which risks water damage in heavy rain.`,
        };
      }
      if (delicateFabrics.includes(fabricB)) {
        return {
          isIncompatible: true,
          violationType: 'severe_weather_hazard',
          reason: `Severe weather hazard: "${itemB.name}" contains delicate ${itemB.fabric}, which risks water damage in heavy rain.`,
        };
      }
    }
  }

  // 5. User Declared Fabric Sensitivity / Allergy
  if (preferences?.fabricSensitivities && preferences.fabricSensitivities.length > 0) {
    const fabricA = itemA.fabric;
    const fabricB = itemB.fabric;

    if (fabricA && preferences.fabricSensitivities.includes(fabricA as any)) {
      return {
        isIncompatible: true,
        violationType: 'user_fabric_sensitivity',
        reason: `Fabric sensitivity safeguard: "${itemA.name}" contains ${fabricA}, which is in declared fabric sensitivities.`,
      };
    }
    if (fabricB && preferences.fabricSensitivities.includes(fabricB as any)) {
      return {
        isIncompatible: true,
        violationType: 'user_fabric_sensitivity',
        reason: `Fabric sensitivity safeguard: "${itemB.name}" contains ${fabricB}, which is in declared fabric sensitivities.`,
      };
    }
  }

  // 6. Age-Appropriate Teen Safety Decorums
  if (preferences?.ageBand === 'teen_14_17') {
    const effOccasion = occasion || context?.occasion;
    if (effOccasion === 'school') {
      const subs = [(itemA.subcategory || '').toLowerCase(), (itemB.subcategory || '').toLowerCase()];
      if (subs.includes('crop top') || subs.includes('shorts')) {
        return {
          isIncompatible: true,
          violationType: 'teen_safety_violation',
          reason: 'Age-appropriate safeguard: Crop tops and shorts are not suited for school dress codes.',
        };
      }
    }
  }

  return { isIncompatible: false };
}

