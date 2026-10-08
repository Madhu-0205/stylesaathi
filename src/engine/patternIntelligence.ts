import { PatternType } from '../types';

/**
 * Returns deterministic pattern compatibility score delta (-2 to +2).
 * Rule 1: Solid + Solid = timeless minimalism (+1.5).
 * Rule 2: Solid + Statement Print (Floral, Ikat, Bandhani, Kalamkari, Stripe) = accent harmony (+2.0).
 * Rule 3: Print + Same Family Print (e.g. geometric + striped or micro-print) = modern (+1.0).
 * Rule 4: Clashing heavy prints (e.g. bold floral + bold ikat) = visual noise (-1.5).
 */
export function getPatternCompatibilityScore(p1?: PatternType, p2?: PatternType): number {
  if (!p1 || !p2 || p1 === 'unknown' || p2 === 'unknown') return 0;

  // Rule 1: Solid + Solid
  if (p1 === 'solid' && p2 === 'solid') {
    return 1.5;
  }

  // Rule 2: Solid + Single Statement / Ethnic Pattern
  if (
    (p1 === 'solid' && p2 !== 'solid') ||
    (p2 === 'solid' && p1 !== 'solid')
  ) {
    return 2.0;
  }

  // Identical subtle patterns (e.g. matching set)
  if (p1 === p2) {
    if (['striped', 'checked', 'chikankari', 'embroidered'].includes(p1)) return 1.5;
    return 0.5;
  }

  // Zari / Brocade pairs harmoniously with embroidered or solid
  if (
    (p1 === 'zari_brocade' && ['embroidered', 'solid'].includes(p2)) ||
    (p2 === 'zari_brocade' && ['embroidered', 'solid'].includes(p1))
  ) {
    return 1.8;
  }

  // Competing busy traditional prints without a grounding solid anchor
  const busyPrints: PatternType[] = ['floral', 'ikat', 'bandhani', 'kalamkari', 'block_print', 'abstract'];
  if (busyPrints.includes(p1) && busyPrints.includes(p2)) {
    return -1.5;
  }

  return 0;
}
