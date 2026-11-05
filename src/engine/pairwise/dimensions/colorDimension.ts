import { WardrobeItem } from '../../../types';
import {
  getColorFamily,
  getColorTone,
} from '../../features/garmentAttributeModel';
import { DimensionEvaluation } from '../types';

const NEUTRALS = new Set([
  'black',
  'white',
  'cream',
  'beige',
  'navy',
  'brown',
  'tan',
  'grey',
  'gray',
  'charcoal',
  'silver',
  'gold',
  'khaki',
  'ivory',
]);

const TESTED_HARMONIC_PAIRS: [string, string][] = [
  ['blue', 'orange'],
  ['blue', 'yellow'],
  ['blue', 'green'],
  ['pink', 'green'],
  ['pink', 'yellow'],
  ['pink', 'orange'],
  ['pink', 'purple'],
  ['pink', 'teal'],
  ['purple', 'yellow'],
  ['purple', 'gold'],
  ['red', 'green'],
  ['red', 'gold'],
  ['red', 'yellow'],
  ['mustard', 'navy'],
  ['mustard', 'pink'],
  ['mustard', 'olive'],
  ['mustard', 'teal'],
  ['mustard', 'rust'],
  ['olive', 'rust'],
  ['olive', 'mustard'],
  ['teal', 'coral'],
  ['teal', 'peach'],
  ['teal', 'gold'],
  ['emerald', 'gold'],
  ['maroon', 'gold'],
  ['crimson', 'gold'],
];

const HARMONIC_SET = new Set<string>();
for (const [a, b] of TESTED_HARMONIC_PAIRS) {
  HARMONIC_SET.add(`${a}|${b}`);
  HARMONIC_SET.add(`${b}|${a}`);
}

const METALLICS = new Set(['gold', 'silver', 'bronze', 'zari', 'copper']);

const JEWEL_TONES = new Set([
  'emerald',
  'green',
  'ruby',
  'sapphire',
  'crimson',
  'maroon',
  'royal_blue',
  'deep_purple',
  'wine',
  'plum',
  'mustard',
  'magenta',
]);

/**
 * Evaluates pairwise color harmony between two garments.
 * Missing or unknown colors evaluate strictly to neutral 0.0 with 0.0 confidence.
 */
export function evaluateColorDimension(itemA: WardrobeItem, itemB: WardrobeItem): DimensionEvaluation {
  const colorsA = (itemA.colors || []).map((c) => c.toLowerCase().trim());
  const colorsB = (itemB.colors || []).map((c) => c.toLowerCase().trim());

  // 1. Missing or unverified color information
  const validColorsA = colorsA.filter((c) => c && c !== 'unknown');
  const validColorsB = colorsB.filter((c) => c && c !== 'unknown');

  if (validColorsA.length === 0 || validColorsB.length === 0) {
    return {
      dimension: 'color_harmony',
      applied: true,
      score: 0.0,
      confidence: 0.0,
      weight: 1.2,
      reason: 'Color attributes unavailable for one or both garments; evaluated neutrally.',
      evidenceSource: 'unknown',
    };
  }

  const primaryA = validColorsA[0];
  const primaryB = validColorsB[0];
  const famA = getColorFamily(primaryA);
  const famB = getColorFamily(primaryB);
  const toneA = getColorTone(primaryA);
  const toneB = getColorTone(primaryB);

  // 2. Metallic / Zari Border Harmony with Regal Jewel Tones
  const hasMetallic = validColorsA.some((c) => METALLICS.has(c)) || validColorsB.some((c) => METALLICS.has(c));
  const hasJewel =
    validColorsA.some((c) => JEWEL_TONES.has(c) || famA === 'greens' || famA === 'reds_pinks') ||
    validColorsB.some((c) => JEWEL_TONES.has(c) || famB === 'greens' || famB === 'reds_pinks');

  if (hasMetallic && (hasJewel || toneA === 'warm' || toneB === 'warm')) {
    return {
      dimension: 'color_harmony',
      applied: true,
      score: 0.95,
      confidence: 0.95,
      weight: 1.2,
      reason: `Regal ceremonial harmony: metallic accents (${validColorsA.includes('gold') || validColorsB.includes('gold') ? 'gold/zari' : 'metallic'}) complement rich festive tones.`,
      evidenceSource: 'cultural_ontology',
    };
  }

  // 3. Tested Harmonic Complementary Pairs
  for (const ca of validColorsA) {
    for (const cb of validColorsB) {
      if (HARMONIC_SET.has(`${ca}|${cb}`)) {
        return {
          dimension: 'color_harmony',
          applied: true,
          score: 0.9,
          confidence: 0.95,
          weight: 1.2,
          reason: `High harmonic synergy: classic complementary pairing of ${ca} and ${cb}.`,
          evidenceSource: 'rule_engine',
        };
      }
    }
  }

  // 4. Universal Neutral Anchor
  const aIsNeutral = validColorsA.some((c) => NEUTRALS.has(c) || famA === 'neutrals');
  const bIsNeutral = validColorsB.some((c) => NEUTRALS.has(c) || famB === 'neutrals');

  if (aIsNeutral && bIsNeutral) {
    return {
      dimension: 'color_harmony',
      applied: true,
      score: 0.85,
      confidence: 0.9,
      weight: 1.2,
      reason: `Neutral palette: ${primaryA} and ${primaryB} provide understated, versatile elegance.`,
      evidenceSource: 'rule_engine',
    };
  }

  if (aIsNeutral || bIsNeutral) {
    const neutralName = aIsNeutral ? primaryA : primaryB;
    const accentName = aIsNeutral ? primaryB : primaryA;
    return {
      dimension: 'color_harmony',
      applied: true,
      score: 0.8,
      confidence: 0.9,
      weight: 1.2,
      reason: `Neutral grounding: ${neutralName} cleanly anchors vibrant ${accentName}.`,
      evidenceSource: 'rule_engine',
    };
  }

  // 5. Monochromatic / Shared Palette Family
  if (famA === famB && famA !== 'neutrals') {
    return {
      dimension: 'color_harmony',
      applied: true,
      score: 0.85,
      confidence: 0.85,
      weight: 1.2,
      reason: `Sophisticated tonal coordination: cohesive ${famA.replace('_', ' ')} palette across both garments.`,
      evidenceSource: 'rule_engine',
    };
  }

  // 6. Analogous Color Harmony (Warm with warm, cool with cool)
  if (toneA === toneB && toneA !== 'neutral') {
    return {
      dimension: 'color_harmony',
      applied: true,
      score: 0.65,
      confidence: 0.8,
      weight: 1.2,
      reason: `Harmonious ${toneA} color temperature creates cohesive aesthetic balance.`,
      evidenceSource: 'rule_engine',
    };
  }

  // 7. Unanchored Saturated Clash Check
  if (toneA !== toneB && toneA !== 'neutral' && toneB !== 'neutral') {
    return {
      dimension: 'color_harmony',
      applied: true,
      score: -0.4,
      confidence: 0.75,
      weight: 1.2,
      reason: `Potential chromatic friction: saturated ${toneA} (${primaryA}) and ${toneB} (${primaryB}) lack a neutral grounding element.`,
      evidenceSource: 'rule_engine',
    };
  }

  return {
    dimension: 'color_harmony',
    applied: true,
    score: 0.5,
    confidence: 0.7,
    weight: 1.2,
    reason: `Balanced color coordination between ${primaryA} and ${primaryB}.`,
    evidenceSource: 'rule_engine',
  };
}
