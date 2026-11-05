import { WardrobeItem, StylePreferences } from '../../../types';
import {
  getDisentangledStyleAttributes,
} from '../../features/garmentAttributeModel';
import { GarmentPairType, DimensionEvaluation } from '../types';
import { isTopGarment, isBottomGarment, isOuterwearGarment } from '../pairClassifier';

/**
 * Evaluates silhouette volume balance, cut, and proportions between two garments.
 */
export function evaluateSilhouetteDimension(
  itemA: WardrobeItem,
  itemB: WardrobeItem,
  pairType: GarmentPairType,
  preferences?: StylePreferences
): DimensionEvaluation {
  // Silhouette balance applies primarily to structural body pairings
  const isStructuralPair =
    pairType === 'top_bottom' ||
    pairType === 'top_outerwear' ||
    pairType === 'bottom_outerwear' ||
    pairType === 'dress_outerwear' ||
    pairType === 'ethnic_drape_base';

  if (!isStructuralPair) {
    return {
      dimension: 'silhouette_proportion',
      applied: false,
      score: 0.0,
      confidence: 1.0,
      weight: 0.0,
      reason: 'Silhouette volume balance is not an active constraint for this pair relationship.',
      evidenceSource: 'rule_engine',
    };
  }

  const attrsA = getDisentangledStyleAttributes(
    itemA.subcategory,
    itemA.category,
    itemA.fit,
    itemA.fabric,
    itemA.pattern,
    itemA.name
  );
  const attrsB = getDisentangledStyleAttributes(
    itemB.subcategory,
    itemB.category,
    itemB.fit,
    itemB.fabric,
    itemB.pattern,
    itemB.name
  );

  const subA = (itemA.subcategory || '').toLowerCase();
  const subB = (itemB.subcategory || '').toLowerCase();

  // 1. Saree or Lehenga with Blouse / Choli
  if (subA === 'saree' || subB === 'saree') {
    const blouse = subA === 'saree' ? itemB : itemA;
    const blouseAttrs = subA === 'saree' ? attrsB : attrsA;
    if (blouseAttrs.fitType === 'slim' || blouseAttrs.fitType === 'tailored' || blouse.subcategory === 'blouse' || blouse.subcategory === 'crop top') {
      return {
        dimension: 'silhouette_proportion',
        applied: true,
        score: 0.95,
        confidence: 0.95,
        weight: 1.0,
        reason: 'Architectural drape balance: tailored fitted blouse anchors full flowing saree drape.',
        evidenceSource: 'cultural_ontology',
      };
    }
  }

  if (subA === 'lehenga' || subB === 'lehenga') {
    return {
      dimension: 'silhouette_proportion',
      applied: true,
      score: 0.9,
      confidence: 0.9,
      weight: 1.0,
      reason: 'Classic volume architecture: flared sweeping lehenga paired with cropped structured bodice.',
      evidenceSource: 'cultural_ontology',
    };
  }

  // 2. Identify Upper vs Lower Pieces
  const isUpperA = isTopGarment(itemA) || isOuterwearGarment(itemA);
  const isLowerA = isBottomGarment(itemA);
  const isUpperB = isTopGarment(itemB) || isOuterwearGarment(itemB);
  const isLowerB = isBottomGarment(itemB);

  const upper = isUpperA ? itemA : isUpperB ? itemB : undefined;
  const lower = isLowerA ? itemA : isLowerB ? itemB : undefined;
  const upperAttrs = upper ? (upper === itemA ? attrsA : attrsB) : undefined;
  const lowerAttrs = lower ? (lower === itemA ? attrsA : attrsB) : undefined;

  // 3. Upper + Lower Volume Proportions (Tops/Outerwear with Bottoms)
  if (upper && lower && upperAttrs && lowerAttrs) {
    const topFit = upperAttrs.fitType;
    const bottomFit = lowerAttrs.fitType;
    const topSil = upperAttrs.silhouette;
    const bottomSil = lowerAttrs.silhouette;

    // Rule A: Fitted / Tailored Upper + Flared / Relaxed Lower
    const isTopFitted = topFit === 'slim' || topFit === 'tailored' || topSil === 'fitted';
    const isBottomFlared =
      bottomSil === 'flared' ||
      bottomSil === 'a_line' ||
      bottomFit === 'relaxed' ||
      ['palazzo', 'lehenga', 'skirt', 'dhoti'].includes(lower.subcategory || '');

    if (isTopFitted && isBottomFlared) {
      return {
        dimension: 'silhouette_proportion',
        applied: true,
        score: 0.85,
        confidence: 0.9,
        weight: 1.0,
        reason: 'Optimal volume balance: fitted upper body balances generous volume below.',
        evidenceSource: 'rule_engine',
      };
    }

    // Rule B: Relaxed / Oversized / Boxy Upper + Slim / Straight Lower
    const isTopVoluminous = topFit === 'relaxed' || topFit === 'oversized' || topSil === 'boxy' || topSil === 'anarkali';
    const isBottomSlim =
      bottomFit === 'slim' ||
      bottomFit === 'tailored' ||
      bottomSil === 'straight' ||
      ['churidar', 'pajama', 'leggings'].includes(lower.subcategory || '');

    if (isTopVoluminous && isBottomSlim) {
      return {
        dimension: 'silhouette_proportion',
        applied: true,
        score: 0.85,
        confidence: 0.9,
        weight: 1.0,
        reason: 'Sculptural silhouette balance: relaxed upper volume anchored by sleek, tapered lower silhouette.',
        evidenceSource: 'rule_engine',
      };
    }

    // Rule C: Oversized + Oversized Volume Collision vs Korean Streetwear Aesthetic
    if (
      (topFit === 'oversized' && bottomFit === 'oversized') ||
      (topSil === 'boxy' && bottomSil === 'flared' && topFit === 'oversized')
    ) {
      const preferredAesthetics = (preferences?.preferredAesthetics || []).map((a) => a.toLowerCase());
      const isVoluminousAesthetic =
        preferredAesthetics.includes('korean relaxed') ||
        preferredAesthetics.includes('korean_aesthetic') ||
        preferredAesthetics.includes('korean aesthetic') ||
        preferredAesthetics.includes('streetwear') ||
        preferredAesthetics.includes('japanese workwear') ||
        preferredAesthetics.includes('relaxed');

      if (isVoluminousAesthetic) {
        return {
          dimension: 'silhouette_proportion',
          applied: true,
          score: 0.8,
          confidence: 0.9,
          weight: 1.0,
          reason: 'Intentional oversized silhouette: effortless draped volume favored in contemporary street and workwear tailoring.',
          evidenceSource: 'cultural_ontology',
        };
      }

      return {
        dimension: 'silhouette_proportion',
        applied: true,
        score: -0.4,
        confidence: 0.8,
        weight: 1.0,
        reason: 'Unanchored volume collision: oversized top and oversized bottom create shape-obscuring bulk.',
        evidenceSource: 'rule_engine',
      };
    }

    // Rule D: Relaxed + Relaxed Everyday Ease
    if (topFit === 'relaxed' && bottomFit === 'relaxed') {
      return {
        dimension: 'silhouette_proportion',
        applied: true,
        score: 0.75,
        confidence: 0.85,
        weight: 1.0,
        reason: 'Effortless relaxed silhouette: comfortable body ease across upper and lower separates.',
        evidenceSource: 'rule_engine',
      };
    }

    // Rule E: Structured / Tailored on both upper and lower
    if (topFit === 'tailored' && (bottomFit === 'tailored' || bottomFit === 'regular')) {
      return {
        dimension: 'silhouette_proportion',
        applied: true,
        score: 0.8,
        confidence: 0.85,
        weight: 1.0,
        reason: 'Clean architectural alignment: structured tailoring top and bottom.',
        evidenceSource: 'rule_engine',
      };
    }
  }

  // 4. Outerwear Layering Proportions
  if (pairType === 'top_outerwear' || pairType === 'dress_outerwear') {
    const outer = isOuterwearGarment(itemA) ? itemA : itemB;
    const base = outer === itemA ? itemB : itemA;
    const outerAttrs = outer === itemA ? attrsA : attrsB;
    const baseAttrs = outer === itemA ? attrsB : attrsA;

    // Outerwear should have equal or greater ease than base garment
    if (outerAttrs.fitType === 'slim' && (baseAttrs.fitType === 'oversized' || baseAttrs.fitType === 'relaxed')) {
      return {
        dimension: 'silhouette_proportion',
        applied: true,
        score: -0.35,
        confidence: 0.8,
        weight: 1.0,
        reason: 'Layering restriction: slim outerwear over relaxed base garment causes fabric bunching.',
        evidenceSource: 'rule_engine',
      };
    }

    return {
      dimension: 'silhouette_proportion',
      applied: true,
      score: 0.75,
      confidence: 0.85,
      weight: 1.0,
      reason: 'Proportional layering: outerwear comfortably frames inner garment silhouette.',
      evidenceSource: 'rule_engine',
    };
  }

  return {
    dimension: 'silhouette_proportion',
    applied: true,
    score: 0.6,
    confidence: 0.75,
    weight: 1.0,
    reason: 'Proportional volume and cut between garments.',
    evidenceSource: 'rule_engine',
  };
}
