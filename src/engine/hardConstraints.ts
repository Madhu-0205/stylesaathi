import {
  WardrobeItem,
  Occasion,
  ContextSnapshot,
  StylePreferences,
  CulturalContextSignals,
} from '../types';
import { OutfitTemplate } from './outfitTemplates';

// ============================================================================
// TIER 1: PHYSICAL / STRUCTURAL IMPOSSIBILITY (HARD REJECT)
// ============================================================================

export interface HardConstraintResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validates that all pieces in the outfit are clean and ready to wear.
 * Items in laundry or needing wash are structurally impossible to wear.
 */
export function validateOutfitItemStatus(pieces: WardrobeItem[]): HardConstraintResult {
  for (const item of pieces) {
    if (item.status !== 'clean') {
      return {
        valid: false,
        reason: `Item "${item.name}" is currently in laundry or needs washing (${item.status}).`,
      };
    }
  }
  return { valid: true };
}

/**
 * Validates that no physical item is assigned to multiple slots simultaneously.
 */
export function validateOutfitPieceUniqueness(
  slots: Record<string, WardrobeItem[]>
): HardConstraintResult {
  const seenIds = new Set<string>();
  for (const items of Object.values(slots)) {
    for (const item of items) {
      if (seenIds.has(item.id)) {
        return {
          valid: false,
          reason: `Duplicate item detected: "${item.name}" (${item.id}) assigned to multiple slots.`,
        };
      }
      seenIds.add(item.id);
    }
  }
  return { valid: true };
}

/**
 * Validates that all required slots defined by the outfit template are filled.
 */
export function validateTemplateStructuralIntegrity(
  template: OutfitTemplate,
  slots: Record<string, WardrobeItem[]>
): HardConstraintResult {
  for (const reqKey of Object.keys(template.required)) {
    if (!slots[reqKey] || slots[reqKey].length === 0) {
      return {
        valid: false,
        reason: `Missing required slot "${reqKey}" for template "${template.name}".`,
      };
    }
  }
  return { valid: true };
}

/**
 * Extreme climate hazard check:
 * Delicate fabrics (silk, raw silk, velvet, suede) in active torrential downpours
 * or thunderstorms risk irreversible destruction.
 */
export function validateClimateHazard(
  pieces: WardrobeItem[],
  context?: ContextSnapshot
): HardConstraintResult {
  if (!context || !context.weather) {
    return { valid: true };
  }

  const isSevereDeluge =
    context.rainContext === 'active_rain' ||
    context.weather.condition === 'heavy_rain' ||
    context.weather.condition === 'thunderstorm';

  if (!isSevereDeluge) {
    return { valid: true };
  }

  const delicateFabrics = ['silk', 'raw_silk', 'velvet', 'suede'];
  for (const item of pieces) {
    if (item.fabric && delicateFabrics.includes(item.fabric.toLowerCase())) {
      return {
        valid: false,
        reason: `Severe rain hazard: delicate fabric (${item.fabric}) on "${item.name}" risks water damage in heavy rain.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Evaluates all Tier 1 Hard Constraints for a candidate outfit.
 * If any check fails, the candidate is discarded before multi-dimensional scoring.
 */
export function evaluateTier1HardConstraints(
  candidate: { template: OutfitTemplate; slots: Record<string, WardrobeItem[]> },
  context?: ContextSnapshot
): { passed: boolean; failureReason?: string } {
  const pieces = Object.values(candidate.slots).flat();

  const statusCheck = validateOutfitItemStatus(pieces);
  if (!statusCheck.valid) {
    return { passed: false, failureReason: statusCheck.reason };
  }

  const uniquenessCheck = validateOutfitPieceUniqueness(candidate.slots);
  if (!uniquenessCheck.valid) {
    return { passed: false, failureReason: uniquenessCheck.reason };
  }

  const templateCheck = validateTemplateStructuralIntegrity(candidate.template, candidate.slots);
  if (!templateCheck.valid) {
    return { passed: false, failureReason: templateCheck.reason };
  }

  const climateCheck = validateClimateHazard(pieces, context);
  if (!climateCheck.valid) {
    return { passed: false, failureReason: climateCheck.reason };
  }

  return { passed: true };
}

// ============================================================================
// CULTURAL HIERARCHY: TIER 2 & TIER 3 (SOFT SIGNALS & PENALTIES)
// ============================================================================

export interface CulturalEvaluationResult {
  tier: 1 | 2 | 3;
  hardRejected: false; // Cultural model NEVER hard-rejects; keeps limited wardrobes functional
  penalty: number; // Non-negative soft penalty subtracted from score
  bonus: number; // Non-negative soft bonus added to score
  reasons: string[];
}

/**
 * Evaluates Tier 2 (strong occasion mismatch) and Tier 3 (cultural context/preferences)
 * in accordance with the Approved Cultural Model:
 *
 * Tier 2: Strong Occasion Mismatch -> High Soft Penalty (e.g. -3.5), NOT hard reject.
 * Tier 3: Cultural Preference / Context -> Soft Signal (+0.5 to +1.5).
 * User declared preferences always soften/override cultural penalties.
 */
export function evaluateCulturalTierScore(
  pieces: WardrobeItem[],
  occasion: Occasion,
  preferences?: StylePreferences,
  culturalSignals?: CulturalContextSignals
): CulturalEvaluationResult {
  let penalty = 0;
  let bonus = 0;
  const reasons: string[] = [];
  const subs = pieces.map((p) => p.subcategory?.toLowerCase() || '');
  const colors = pieces.flatMap((p) => p.colors.map((c) => c.toLowerCase()));
  const hasEthnic = pieces.some((p) => p.category === 'Ethnic');

  // Check declared user preference overrides
  const userAesthetics = (preferences?.preferredAesthetics || []).map((a) => a.toLowerCase());
  const userPermissiveWestern =
    userAesthetics.includes('modern western') ||
    userAesthetics.includes('casual') ||
    userAesthetics.includes('minimal');

  let tier: 1 | 2 | 3 = 3;

  // 1. Devotional / Puja
  if (occasion === 'puja') {
    const casualSubs = ['shorts', 't-shirt', 'hoodie', 'sneakers'];
    const hasCasualMismatch = subs.some((s) => casualSubs.includes(s));

    if (hasCasualMismatch) {
      tier = 2;
      const basePenalty = 3.5;
      penalty += userPermissiveWestern ? basePenalty * 0.5 : basePenalty;
      reasons.push('Informal piece carries occasion penalty for traditional puja');
    }

    // Tier 3 Auspicious signals
    const auspiciousColors = ['yellow', 'mustard', 'cream', 'white', 'gold', 'red', 'orange', 'pink'];
    if (colors.some((c) => auspiciousColors.includes(c))) {
      bonus += 1.0;
      reasons.push('Auspicious tones suited for devotional decorum');
    }
    if (hasEthnic) {
      bonus += 1.0;
    }
    if (subs.includes('dupatta')) {
      bonus += 0.8;
      reasons.push('Modest drape respected in devotional puja');
    }
    if (colors.includes('black')) {
      penalty += 1.5;
      reasons.push('Dark tones traditionally avoided for devotional rites');
    }
  }
  // 2. Wedding Guest / Grand Celebration
  else if (occasion === 'wedding guest' || occasion === 'celebration') {
    const casualSubs = ['shorts', 't-shirt', 'hoodie', 'joggers', 'sneakers'];
    const hasCasualMismatch = subs.some((s) => casualSubs.includes(s));

    if (hasCasualMismatch) {
      tier = 2;
      const basePenalty = 3.5;
      penalty += userPermissiveWestern ? basePenalty * 0.5 : basePenalty;
      reasons.push('Casual garments heavily penalized for wedding guest formality');
    }

    if (hasEthnic) {
      bonus += 1.5;
    }
    const festiveSubs = ['saree', 'lehenga', 'nehru jacket', 'sherwani', 'anarkali', 'dupatta'];
    if (subs.some((s) => festiveSubs.includes(s))) {
      bonus += 1.2;
      reasons.push('Elevated festive craftsmanship suited for wedding celebrations');
    }
  }
  // 3. Corporate / Interview
  else if (occasion === 'interview' || occasion === 'office') {
    const informalSubs = ['shorts', 'sneakers', 'hoodie', 'lehenga', 'sherwani'];
    if (subs.some((s) => informalSubs.includes(s))) {
      tier = 2;
      penalty += 2.5;
      reasons.push('Silhouette does not align with structured professional setting');
    }
    const formalSubs = ['blazer', 'shirt', 'trousers', 'formal shoes', 'saree', 'kurta'];
    if (subs.some((s) => formalSubs.includes(s))) {
      bonus += 1.0;
      reasons.push('Clean tailored presentation for professional context');
    }
  }
  // 4. Festive (Diwali, Eid, Family Functions)
  else if (['festive', 'Diwali', 'Eid', 'family function'].includes(occasion)) {
    if (hasEthnic) {
      bonus += 1.2;
      reasons.push('Authentic ethnic silhouette for festive gathering');
    }
  }

  // Extension point for CulturalContextSignals
  if (culturalSignals?.declaredModestyLevel === 'high') {
    if (subs.includes('dupatta') || subs.includes('kurta') || subs.includes('saree')) {
      bonus += 0.6;
    }
  }

  return {
    tier,
    hardRejected: false, // Never hard reject
    penalty,
    bonus,
    reasons,
  };
}
