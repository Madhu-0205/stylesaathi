import { FabricType, Season } from '../types';

export type Breathability = 'high' | 'medium' | 'low';

const HIGH_BREATHABILITY: FabricType[] = ['cotton', 'linen', 'khadi', 'mulmul', 'modal'];
const MEDIUM_BREATHABILITY: FabricType[] = ['chiffon', 'georgette', 'rayon', 'viscose', 'crepe', 'chanderi'];
const LOW_BREATHABILITY: FabricType[] = ['silk', 'velvet', 'wool', 'denim', 'organza', 'satin', 'banarasi', 'tussar', 'polyblend'];

/**
 * Returns breathability rating for Indian climates.
 */
export function getFabricBreathability(fabric?: FabricType): Breathability {
  if (!fabric || fabric === 'unknown') return 'medium';
  if (HIGH_BREATHABILITY.includes(fabric)) return 'high';
  if (MEDIUM_BREATHABILITY.includes(fabric)) return 'medium';
  if (LOW_BREATHABILITY.includes(fabric)) return 'low';
  return 'medium';
}

/**
 * Computes deterministic climate suitability score delta (-3 to +3).
 */
export function getFabricClimateSuitability(fabric?: FabricType, season?: Season): number {
  if (!fabric || fabric === 'unknown' || !season) return 0;

  switch (season) {
    case 'summer':
      if (['cotton', 'linen', 'khadi', 'mulmul'].includes(fabric)) return 2.0;
      if (['modal', 'chiffon', 'georgette'].includes(fabric)) return 0.8;
      if (['velvet', 'wool'].includes(fabric)) return -3.0;
      if (['silk', 'banarasi', 'denim'].includes(fabric)) return -1.0;
      return 0;

    case 'monsoon':
      // High humidity: quick drying and breathable fabrics preferred; avoid heavy raw silk & dense velvet
      if (['cotton', 'linen', 'khadi', 'mulmul'].includes(fabric)) return 1.2;
      if (['chiffon', 'georgette'].includes(fabric)) return 1.0; // light & fast drying
      if (['velvet', 'wool', 'banarasi'].includes(fabric)) return -2.0;
      return 0;

    case 'winter':
      if (['wool', 'velvet'].includes(fabric)) return 2.5;
      if (['silk', 'banarasi', 'tussar', 'denim'].includes(fabric)) return 1.8;
      if (['linen', 'mulmul'].includes(fabric)) return -1.2;
      return 0.5;

    default:
      return 0;
  }
}

/**
 * Returns baseline formality tier associated with the textile craft (1.0 - 5.0).
 */
export function getFabricFormality(fabric?: FabricType): number {
  if (!fabric || fabric === 'unknown') return 2.5;

  switch (fabric) {
    case 'banarasi':
    case 'velvet':
      return 4.8;
    case 'silk':
    case 'tussar':
    case 'satin':
    case 'organza':
      return 4.2;
    case 'chanderi':
    case 'crepe':
      return 3.5;
    case 'linen':
    case 'khadi':
    case 'denim':
    case 'rayon':
    case 'viscose':
      return 2.8;
    case 'cotton':
    case 'mulmul':
    case 'modal':
      return 2.2;
    case 'polyblend':
      return 2.0;
    default:
      return 2.5;
  }
}
