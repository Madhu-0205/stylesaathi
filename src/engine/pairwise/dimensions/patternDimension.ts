import { WardrobeItem, PatternType } from '../../../types';
import { DimensionEvaluation } from '../types';
import { isFootwearGarment, isAccessoryGarment } from '../pairClassifier';

const BUSY_STATEMENT_PRINTS: PatternType[] = [
  'floral',
  'geometric',
  'ikat',
  'bandhani',
  'kalamkari',
  'block_print',
  'abstract',
  'polka_dot',
];

/**
 * Evaluates pairwise pattern compatibility and visual balance between two garments.
 * Unknown or missing patterns evaluate neutrally without penalty.
 */
export function evaluatePatternDimension(itemA: WardrobeItem, itemB: WardrobeItem): DimensionEvaluation {
  // Pattern interaction is not applicable to footwear or small accessories
  if (isFootwearGarment(itemA) || isFootwearGarment(itemB) || isAccessoryGarment(itemA) || isAccessoryGarment(itemB)) {
    return {
      dimension: 'pattern_interaction',
      applied: false,
      score: 0.0,
      confidence: 1.0,
      weight: 0.0,
      reason: 'Pattern interaction is not an active constraint for footwear/accessory pairings.',
      evidenceSource: 'rule_engine',
    };
  }

  const pA = itemA.pattern;
  const pB = itemB.pattern;

  // 1. Missing or Unknown Pattern Handling
  if (!pA || !pB || pA === 'unknown' || pB === 'unknown') {
    return {
      dimension: 'pattern_interaction',
      applied: true,
      score: 0.0,
      confidence: 0.0,
      weight: 1.0,
      reason: 'Pattern information unavailable for one or both garments; evaluated neutrally.',
      evidenceSource: 'unknown',
    };
  }

  // 2. Solid + Statement or Craft Print (Focal Anchor Harmony)
  if ((pA === 'solid' && pB !== 'solid') || (pB === 'solid' && pA !== 'solid')) {
    const printPattern = pA === 'solid' ? pB : pA;
    return {
      dimension: 'pattern_interaction',
      applied: true,
      score: 0.9,
      confidence: 0.95,
      weight: 1.0,
      reason: `Focal anchor harmony: solid ground lets the intricate ${printPattern.replace('_', ' ')} design take center stage without visual clutter.`,
      evidenceSource: 'rule_engine',
    };
  }

  // 3. Solid + Solid (Clean Minimalist Pairing)
  if (pA === 'solid' && pB === 'solid') {
    return {
      dimension: 'pattern_interaction',
      applied: true,
      score: 0.75,
      confidence: 0.9,
      weight: 1.0,
      reason: 'Understated elegance: clean solid-on-solid pairing creates serene, uninterrupted lines.',
      evidenceSource: 'rule_engine',
    };
  }

  // 4. Regal Zari Brocade with Embroidered / Tone-on-tone Textures
  if (
    (pA === 'zari_brocade' && (pB === 'embroidered' || pB === 'chikankari' || pB === 'solid')) ||
    (pB === 'zari_brocade' && (pA === 'embroidered' || pA === 'chikankari' || pA === 'solid'))
  ) {
    return {
      dimension: 'pattern_interaction',
      applied: true,
      score: 0.9,
      confidence: 0.95,
      weight: 1.0,
      reason: 'Regal craft resonance: woven zari brocade harmonizes beautifully with artisanal embroidery.',
      evidenceSource: 'cultural_ontology',
    };
  }

  // 5. Coordinated Set / Monolithic Print Matching
  if (pA === pB) {
    if (['striped', 'checked', 'chikankari', 'embroidered'].includes(pA)) {
      return {
        dimension: 'pattern_interaction',
        applied: true,
        score: 0.8,
        confidence: 0.9,
        weight: 1.0,
        reason: `Coordinated textural unity: matching ${pA} motif produces intentional ensemble cohesion.`,
        evidenceSource: 'rule_engine',
      };
    }
    return {
      dimension: 'pattern_interaction',
      applied: true,
      score: 0.5,
      confidence: 0.75,
      weight: 1.0,
      reason: `Matching ${pA} print across separates.`,
      evidenceSource: 'rule_engine',
    };
  }

  // 6. Conflicting Busy Statement Prints (Visual Clutter Clash)
  if (BUSY_STATEMENT_PRINTS.includes(pA) && BUSY_STATEMENT_PRINTS.includes(pB)) {
    return {
      dimension: 'pattern_interaction',
      applied: true,
      score: -0.6,
      confidence: 0.85,
      weight: 1.0,
      reason: `Visual pattern clash: competing motifs (${pA.replace('_', ' ')} and ${pB.replace('_', ' ')}) collide without a grounding neutral solid.`,
      evidenceSource: 'rule_engine',
    };
  }

  // 7. Controlled Geometric / Linear Mix (e.g. Striped + Geometric)
  if (
    (pA === 'striped' && pB === 'geometric') ||
    (pB === 'striped' && pA === 'geometric') ||
    (pA === 'checked' && pB === 'striped') ||
    (pB === 'checked' && pA === 'striped')
  ) {
    return {
      dimension: 'pattern_interaction',
      applied: true,
      score: 0.65,
      confidence: 0.8,
      weight: 1.0,
      reason: 'Modern pattern play: contrasting linear and geometric scales create thoughtful visual texture.',
      evidenceSource: 'rule_engine',
    };
  }

  return {
    dimension: 'pattern_interaction',
    applied: true,
    score: 0.4,
    confidence: 0.7,
    weight: 1.0,
    reason: `Complementary pattern interaction between ${pA} and ${pB}.`,
    evidenceSource: 'rule_engine',
  };
}
