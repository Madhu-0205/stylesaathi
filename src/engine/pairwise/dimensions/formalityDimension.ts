import { WardrobeItem, Occasion } from '../../../types';
import { DimensionEvaluation } from '../types';

/**
 * Evaluates formality alignment, formality bridging, and occasion appropriateness between two garments.
 */
export function evaluateFormalityDimension(
  itemA: WardrobeItem,
  itemB: WardrobeItem,
  occasion?: Occasion
): DimensionEvaluation {
  const fA = itemA.formality || 3;
  const fB = itemB.formality || 3;
  const diff = Math.abs(fA - fB);

  const subA = (itemA.subcategory || '').toLowerCase();
  const subB = (itemB.subcategory || '').toLowerCase();

  // 1. Extreme Formality Dissonance (Delta >= 3.0)
  if (diff >= 3.0) {
    return {
      dimension: 'formality_alignment',
      applied: true,
      score: -0.75,
      confidence: 0.9,
      weight: 1.1,
      reason: `Severe formality mismatch: formal tier (${Math.max(fA, fB)}/5) on "${fA > fB ? itemA.name : itemB.name}" clashes jarringly with casual tier (${Math.min(fA, fB)}/5) on "${fA < fB ? itemA.name : itemB.name}".`,
      evidenceSource: 'rule_engine',
    };
  }

  // 2. Intentional Modern Formality Bridges (Delta = 1.5 to 2.0)
  // Bridge A: Kurti/Kurta (3-4) + Clean Denim Jeans (2)
  if (
    (['kurti', 'kurta'].includes(subA) && subB === 'jeans') ||
    (['kurti', 'kurta'].includes(subB) && subA === 'jeans')
  ) {
    return {
      dimension: 'formality_alignment',
      applied: true,
      score: 0.85,
      confidence: 0.9,
      weight: 1.1,
      reason: 'Effortless Indo-Western bridge: casual denim balances the crafted refinement of the ethnic tunic.',
      evidenceSource: 'cultural_ontology',
    };
  }

  // Bridge B: Structured Blazer (4) + Clean Base T-Shirt (2)
  if (
    (subA === 'blazer' && ['t-shirt', 'top'].includes(subB)) ||
    (subB === 'blazer' && ['t-shirt', 'top'].includes(subA))
  ) {
    return {
      dimension: 'formality_alignment',
      applied: true,
      score: 0.8,
      confidence: 0.9,
      weight: 1.1,
      reason: 'Contemporary smart-casual bridge: tailored tailoring elevated over an understated casual base.',
      evidenceSource: 'rule_engine',
    };
  }

  // Bridge C: Nehru Jacket (4) + Crisp Shirt or Kurta (3)
  if (
    (subA === 'nehru jacket' && ['kurta', 'shirt'].includes(subB)) ||
    (subB === 'nehru jacket' && ['kurta', 'shirt'].includes(subA))
  ) {
    return {
      dimension: 'formality_alignment',
      applied: true,
      score: 0.9,
      confidence: 0.95,
      weight: 1.1,
      reason: 'Sophisticated festive bridge: structured Nehru sleeveless layer elevates collared separates.',
      evidenceSource: 'cultural_ontology',
    };
  }

  // Bridge D: Tailored Trousers (3.5 - 4) + Minimal Sneakers (2)
  if (
    (subA === 'trousers' && subB === 'sneakers') ||
    (subB === 'trousers' && subA === 'sneakers')
  ) {
    return {
      dimension: 'formality_alignment',
      applied: true,
      score: 0.7,
      confidence: 0.85,
      weight: 1.1,
      reason: 'Urban high-low pairing: clean minimal sneakers ground tailored trousers with relaxed polish.',
      evidenceSource: 'rule_engine',
    };
  }

  // 3. Close Formality Alignment (Delta <= 1.0)
  if (diff <= 1.0) {
    const avg = (fA + fB) / 2;
    let label = 'smart-casual';
    if (avg >= 4.0) label = 'formal/festive';
    else if (avg <= 2.0) label = 'relaxed casual';

    return {
      dimension: 'formality_alignment',
      applied: true,
      score: 0.85,
      confidence: 0.9,
      weight: 1.1,
      reason: `Coherent formality tier: both pieces share harmonious ${label} polish (${fA}/5 and ${fB}/5).`,
      evidenceSource: 'rule_engine',
    };
  }

  // 4. Moderate Formality Difference without Defined Bridge
  return {
    dimension: 'formality_alignment',
    applied: true,
    score: 0.45,
    confidence: 0.8,
    weight: 1.1,
    reason: `Moderate formality difference (${fA}/5 vs ${fB}/5); serviceable with complementary accessories.`,
    evidenceSource: 'rule_engine',
  };
}

