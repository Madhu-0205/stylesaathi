import { WardrobeItem, FabricType } from '../../../types';
import {
  getFabricMaterialProperties,
} from '../../features/garmentAttributeModel';
import { GarmentPairType, DimensionEvaluation } from '../types';
import { isOuterwearGarment, isFootwearGarment, isAccessoryGarment } from '../pairClassifier';

const NATURAL_HANDLOOMS: FabricType[] = ['cotton', 'khadi', 'linen', 'mulmul'];

const CEREMONIAL_FABRICS: FabricType[] = [
  'silk',
  'banarasi',
  'chanderi',
  'tussar',
  'velvet',
  'satin',
  'organza',
];

const DELICATE_SHEER: FabricType[] = ['chiffon', 'organza'];
const HEAVY_RUGGED: FabricType[] = ['denim', 'wool'];

/**
 * Evaluates pairwise fabric compatibility, weight balance, and tactile synergy.
 * Unknown or missing fabrics evaluate strictly to neutral 0.0 with 0.0 confidence.
 */
export function evaluateFabricDimension(
  itemA: WardrobeItem,
  itemB: WardrobeItem,
  pairType: GarmentPairType
): DimensionEvaluation {
  // Fabric drape physics is not an active constraint for footwear or small accessories
  if (isFootwearGarment(itemA) || isFootwearGarment(itemB) || isAccessoryGarment(itemA) || isAccessoryGarment(itemB)) {
    return {
      dimension: 'fabric_texture',
      applied: false,
      score: 0.0,
      confidence: 1.0,
      weight: 0.0,
      reason: 'Fabric drape physics is not an active constraint for footwear/accessory pairings.',
      evidenceSource: 'fabric_physics',
    };
  }

  const fA = itemA.fabric;
  const fB = itemB.fabric;

  // 1. Missing or Unknown Fabric Handling
  if (!fA || !fB || fA === 'unknown' || fB === 'unknown') {
    return {
      dimension: 'fabric_texture',
      applied: true,
      score: 0.0,
      confidence: 0.0,
      weight: 1.0,
      reason: 'Fabric composition unavailable for one or both garments; evaluated neutrally without penalty.',
      evidenceSource: 'unknown',
    };
  }

  const propsA = getFabricMaterialProperties(fA);
  const propsB = getFabricMaterialProperties(fB);

  // 2. Natural Breathable Handlooms Harmony
  if (NATURAL_HANDLOOMS.includes(fA) && NATURAL_HANDLOOMS.includes(fB)) {
    return {
      dimension: 'fabric_texture',
      applied: true,
      score: 0.85,
      confidence: 0.95,
      weight: 1.0,
      reason: `Natural fiber harmony: breathable ${fA} and ${fB} offer organic tactile coherence and climate comfort.`,
      evidenceSource: 'fabric_physics',
    };
  }

  // 3. Regal Ceremonial Textiles Harmony
  if (CEREMONIAL_FABRICS.includes(fA) && CEREMONIAL_FABRICS.includes(fB)) {
    return {
      dimension: 'fabric_texture',
      applied: true,
      score: 0.9,
      confidence: 0.95,
      weight: 1.0,
      reason: `Festive textile resonance: opulent ${fA} and ${fB} share celebratory luster and structured drape.`,
      evidenceSource: 'cultural_ontology',
    };
  }

  // 4. Delicate Sheer vs Heavy Rugged Utility Clash
  if (
    (DELICATE_SHEER.includes(fA) && HEAVY_RUGGED.includes(fB)) ||
    (DELICATE_SHEER.includes(fB) && HEAVY_RUGGED.includes(fA))
  ) {
    const sheer = DELICATE_SHEER.includes(fA) ? fA : fB;
    const heavy = HEAVY_RUGGED.includes(fA) ? fA : fB;
    return {
      dimension: 'fabric_texture',
      applied: true,
      score: -0.5,
      confidence: 0.85,
      weight: 1.0,
      reason: `Tactile texture clash: ethereal sheer ${sheer} conflicts directly with rigid, heavy utility ${heavy}.`,
      evidenceSource: 'fabric_physics',
    };
  }

  // 5. Layering Fabric Weight Balance (Outerwear over Base)
  if (pairType === 'top_outerwear' || pairType === 'dress_outerwear') {
    const outer = isOuterwearGarment(itemA) ? itemA : itemB;
    const base = outer === itemA ? itemB : itemA;
    const outerProps = outer === itemA ? propsA : propsB;
    const baseProps = outer === itemA ? propsB : propsA;

    // Outerwear should ideally be equal or heavier in weight than base
    if (outerProps.weight === 'heavyweight' && (baseProps.weight === 'lightweight' || baseProps.weight === 'medium_weight')) {
      return {
        dimension: 'fabric_texture',
        applied: true,
        score: 0.85,
        confidence: 0.9,
        weight: 1.0,
        reason: `Engineered layering weight: structured ${outer.fabric} outer protects and cleanly drapes over ${base.fabric} underlayer.`,
        evidenceSource: 'fabric_physics',
      };
    }

    if (outerProps.weight === 'lightweight' && baseProps.weight === 'heavyweight') {
      return {
        dimension: 'fabric_texture',
        applied: true,
        score: -0.35,
        confidence: 0.8,
        weight: 1.0,
        reason: `Inverted layering weight: lightweight ${outer.fabric} outer layer pulls awkwardly over dense ${base.fabric} base.`,
        evidenceSource: 'fabric_physics',
      };
    }
  }

  // 6. Balanced Everyday Contrast (Denim + Cotton / Linen, Wool + Cotton)
  if (
    (fA === 'denim' && (fB === 'cotton' || fB === 'linen' || fB === 'modal')) ||
    (fB === 'denim' && (fA === 'cotton' || fA === 'linen' || fA === 'modal')) ||
    (fA === 'wool' && (fB === 'cotton' || fB === 'silk')) ||
    (fB === 'wool' && (fA === 'cotton' || fA === 'silk'))
  ) {
    return {
      dimension: 'fabric_texture',
      applied: true,
      score: 0.8,
      confidence: 0.9,
      weight: 1.0,
      reason: `Complementary tactile balance: structured ${fA} pairs seamlessly with breathable ${fB}.`,
      evidenceSource: 'fabric_physics',
    };
  }

  return {
    dimension: 'fabric_texture',
    applied: true,
    score: 0.65,
    confidence: 0.8,
    weight: 1.0,
    reason: `Compatible textile pair: ${fA} and ${fB} maintain balanced hand-feel and drape.`,
    evidenceSource: 'fabric_physics',
  };
}
