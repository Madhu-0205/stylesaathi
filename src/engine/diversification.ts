import { GeneratedOutfit } from '../types';

export const DIVERSIFICATION_DISTANCE_THRESHOLD = 0.35;

const DARK_NEUTRALS = new Set(['black', 'navy', 'charcoal', 'dark grey', 'grey']);
const LIGHT_NEUTRALS = new Set(['white', 'off-white', 'cream', 'beige', 'ivory', 'tan']);
const WARM_EARTH_TONES = new Set(['brown', 'tan', 'olive', 'rust', 'mustard']);

/**
 * Calculates tonal similarity between two colors:
 * - 1.0 if identical
 * - 0.75 if belonging to the same tonal family (e.g. black vs navy)
 * - 0.0 otherwise
 */
function getColorTonalSimilarity(c1: string, c2: string): number {
  const col1 = c1.toLowerCase().trim();
  const col2 = c2.toLowerCase().trim();
  if (col1 === col2) return 1.0;

  if (DARK_NEUTRALS.has(col1) && DARK_NEUTRALS.has(col2)) return 0.75;
  if (LIGHT_NEUTRALS.has(col1) && LIGHT_NEUTRALS.has(col2)) return 0.75;
  if (WARM_EARTH_TONES.has(col1) && WARM_EARTH_TONES.has(col2)) return 0.75;

  return 0.0;
}

/**
 * Calculates the multi-dimensional distance between two outfits:
 * D(A, B) = 0.45 * d_garments + 0.30 * d_silhouette + 0.25 * d_palette
 *
 * Output range: [0.0, 1.0]
 * - 0.0: Identical outfits
 * - < 0.35: Near-clones (suppressed from alternative selection)
 * - >= 0.35: Distinct, meaningfully diversified look
 */
export function calculateOutfitDistance(a: GeneratedOutfit, b: GeneratedOutfit): number {
  const piecesA = Object.values(a.slots).flat();
  const piecesB = Object.values(b.slots).flat();

  if (piecesA.length === 0 && piecesB.length === 0) return 0;
  if (piecesA.length === 0 || piecesB.length === 0) return 1.0;

  // 1. Garment Overlap Distance (Weight: 0.45)
  const idsA = new Set(piecesA.map((p) => p.id));
  const idsB = new Set(piecesB.map((p) => p.id));

  let sharedGarments = 0;
  for (const id of idsA) {
    if (idsB.has(id)) sharedGarments++;
  }
  const maxPieces = Math.max(piecesA.length, piecesB.length);
  const dGarments = maxPieces > 0 ? 1 - sharedGarments / maxPieces : 0;

  // 2. Silhouette Distance (Weight: 0.30)
  let dSilhouette = 0;
  if (a.template !== b.template) {
    dSilhouette = 1.0;
  } else {
    // If same template, evaluate subcategory silhouette divergence per slot
    const allSlots = Array.from(new Set([...Object.keys(a.slots), ...Object.keys(b.slots)]));
    let matchingSlots = 0;

    for (const slotKey of allSlots) {
      const subA = (a.slots[slotKey] || []).map((p) => p.subcategory || '').sort().join(',');
      const subB = (b.slots[slotKey] || []).map((p) => p.subcategory || '').sort().join(',');
      if (subA && subB && subA === subB) {
        matchingSlots++;
      }
    }

    dSilhouette = allSlots.length > 0 ? 1 - matchingSlots / allSlots.length : 0;
  }

  // 3. Palette Distance with Tonal Cohesion (Weight: 0.25)
  const colorsA = Array.from(new Set(piecesA.flatMap((p) => p.colors)));
  const colorsB = Array.from(new Set(piecesB.flatMap((p) => p.colors)));

  let colorMatchSum = 0;
  for (const cA of colorsA) {
    let maxSim = 0;
    for (const cB of colorsB) {
      const sim = getColorTonalSimilarity(cA, cB);
      if (sim > maxSim) maxSim = sim;
    }
    colorMatchSum += maxSim;
  }
  const maxColors = Math.max(colorsA.length, colorsB.length);
  const dPalette = maxColors > 0 ? 1 - colorMatchSum / maxColors : 0;

  const totalDist = 0.45 * dGarments + 0.30 * dSilhouette + 0.25 * dPalette;
  return Math.min(1.0, Math.max(0.0, totalDist));
}

/**
 * Checks whether outfit B is a near-clone of outfit A.
 */
export function isNearClone(
  a: GeneratedOutfit,
  b: GeneratedOutfit,
  threshold = DIVERSIFICATION_DISTANCE_THRESHOLD
): boolean {
  return calculateOutfitDistance(a, b) < threshold;
}

/**
 * Suppresses near-clones from a list of candidate outfits.
 * Maintains input order (ranking precedence) and ensures every accepted candidate
 * maintains pairwise distance >= threshold against all previously accepted candidates.
 */
export function suppressNearClones<T extends GeneratedOutfit>(
  candidates: T[],
  threshold = DIVERSIFICATION_DISTANCE_THRESHOLD
): T[] {
  const result: T[] = [];

  for (const candidate of candidates) {
    const isTooClose = result.some((accepted) => calculateOutfitDistance(accepted, candidate) < threshold);
    if (!isTooClose) {
      result.push(candidate);
    }
  }

  return result;
}
