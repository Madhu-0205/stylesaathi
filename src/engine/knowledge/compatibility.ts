import { WardrobeItem, FabricType, Subcategory } from '../../types';
import { FashionKnowledgeSignal } from './types';
import {
  GARMENT_CONCEPTS,
  ENSEMBLE_STRUCTURES,
  FABRIC_CONCEPTS,
} from './knowledgeData';

/**
 * Evaluates structural ensemble integrity: checks if base garments
 * (such as sarees or lehengas) are paired with their structurally required components.
 */
export function getEnsembleIntegritySignals(
  pieces: WardrobeItem[]
): FashionKnowledgeSignal[] {
  const signals: FashionKnowledgeSignal[] = [];
  const subs = new Set(pieces.map((p) => p.subcategory?.toLowerCase() || ''));

  for (const ensemble of ENSEMBLE_STRUCTURES) {
    if (subs.has(ensemble.baseGarment)) {
      // Check if at least one required component is present
      const hasRequired = ensemble.requiredComponents.some((req) => subs.has(req));
      if (hasRequired) {
        signals.push({
          type: 'garment_compatibility',
          strength: 0.9,
          confidence: ensemble.provenance.confidence,
          explanationKey: `${ensemble.baseGarment}_structural_complete`,
          provenance: ensemble.provenance,
          metadata: { ensemble: ensemble.id, complete: true },
        });
      } else {
        signals.push({
          type: 'garment_compatibility',
          strength: -1.0,
          confidence: ensemble.provenance.confidence,
          explanationKey: `${ensemble.baseGarment}_missing_${ensemble.requiredComponents[0]}`,
          provenance: ensemble.provenance,
          metadata: { ensemble: ensemble.id, complete: false },
        });
      }
    }
  }

  return signals;
}

/**
 * Evaluates pairwise fabric compatibility:
 * - Natural breathable handlooms (cotton, khadi, mulmul, linen) -> high synergy (+0.8)
 * - Regal ceremonial textiles (silk, banarasi, velvet, chanderi, tussar) -> high synergy (+0.85)
 * - Clash: Ultra-delicate sheer (chiffon, organza) paired with rigid heavy utility denim/wool -> (-0.5)
 */
export function getFabricCompatibilitySignal(
  f1?: FabricType,
  f2?: FabricType
): FashionKnowledgeSignal | null {
  if (!f1 || !f2 || f1 === 'unknown' || f2 === 'unknown') return null;

  const concept1 = FABRIC_CONCEPTS[f1];
  const concept2 = FABRIC_CONCEPTS[f2];
  if (!concept1 || !concept2) return null;

  // 1. Natural handloom harmony
  const naturalHandlooms: FabricType[] = ['cotton', 'khadi', 'linen', 'mulmul'];
  if (naturalHandlooms.includes(f1) && naturalHandlooms.includes(f2)) {
    return {
      type: 'fabric_compatibility',
      strength: 0.8,
      confidence: 0.9,
      explanationKey: 'natural_breathable_harmony',
      provenance: { sourceType: 'internal_curation', confidence: 0.9, reviewed: true },
      metadata: { fabric1: f1, fabric2: f2 },
    };
  }

  // 2. Regal ceremonial harmony
  const ceremonialFabrics: FabricType[] = ['silk', 'banarasi', 'velvet', 'chanderi', 'tussar', 'organza', 'satin'];
  if (ceremonialFabrics.includes(f1) && ceremonialFabrics.includes(f2)) {
    return {
      type: 'fabric_compatibility',
      strength: 0.85,
      confidence: 0.9,
      explanationKey: 'regal_ceremonial_fabrics',
      provenance: { sourceType: 'internal_curation', confidence: 0.9, reviewed: true },
      metadata: { fabric1: f1, fabric2: f2 },
    };
  }

  // 3. Delicate sheer vs heavy rugged clash
  const delicateSheer: FabricType[] = ['chiffon', 'organza'];
  const heavyRugged: FabricType[] = ['denim', 'wool'];
  if (
    (delicateSheer.includes(f1) && heavyRugged.includes(f2)) ||
    (delicateSheer.includes(f2) && heavyRugged.includes(f1))
  ) {
    return {
      type: 'fabric_compatibility',
      strength: -0.5,
      confidence: 0.8,
      explanationKey: 'delicate_heavy_fabric_clash',
      provenance: { sourceType: 'internal_curation', confidence: 0.8, reviewed: true },
      metadata: { fabric1: f1, fabric2: f2 },
    };
  }

  return null;
}

/**
 * Evaluates pairwise fabric compatibility across all items in an ensemble.
 */
export function getOutfitFabricSignals(pieces: WardrobeItem[]): FashionKnowledgeSignal[] {
  const signals: FashionKnowledgeSignal[] = [];
  const fabricPieces = pieces.filter((p) => p.fabric && p.fabric !== 'unknown');

  for (let i = 0; i < fabricPieces.length; i++) {
    for (let j = i + 1; j < fabricPieces.length; j++) {
      const sig = getFabricCompatibilitySignal(fabricPieces[i].fabric, fabricPieces[j].fabric);
      if (sig) {
        signals.push(sig);
      }
    }
  }

  return signals;
}

/**
 * Evaluates silhouette volume balance between upper and lower body:
 * - Fitted upper + flared/relaxed lower -> Balanced (+0.8)
 * - Relaxed upper + tailored/slim lower -> Balanced (+0.75)
 * - Tailored upper + tailored lower -> Clean structured (+0.7)
 * - Oversized upper + oversized lower without structure -> Volume collision (-0.5)
 */
export function getSilhouetteBalanceSignals(
  pieces: WardrobeItem[]
): FashionKnowledgeSignal[] {
  const signals: FashionKnowledgeSignal[] = [];

  const tops = pieces.filter((p) => p.category === 'Tops' || (p.category === 'Ethnic' && ['kurta', 'kurti', 'blouse'].includes(p.subcategory)));
  const bottoms = pieces.filter((p) => p.category === 'Bottoms' || (p.category === 'Ethnic' && ['salwar', 'palazzo', 'churidar', 'pajama', 'lehenga'].includes(p.subcategory)));

  if (tops.length === 0 || bottoms.length === 0) return signals;

  const top = tops[0];
  const bottom = bottoms[0];

  const topFit = top.fit || 'regular';
  const bottomFit = bottom.fit || 'regular';

  const isTopFitted = topFit === 'slim' || topFit === 'tailored';
  const isTopRelaxed = topFit === 'relaxed' || topFit === 'oversized' || top.subcategory === 'anarkali';
  const isBottomFlared = bottomFit === 'flared' || bottomFit === 'a_line' || ['palazzo', 'lehenga', 'skirt'].includes(bottom.subcategory);
  const isBottomSlim = bottomFit === 'slim' || bottomFit === 'tailored' || bottomFit === 'straight' || ['churidar', 'leggings'].includes(bottom.subcategory);

  if (isTopFitted && isBottomFlared) {
    signals.push({
      type: 'silhouette_balance',
      strength: 0.8,
      confidence: 0.85,
      explanationKey: 'fitted_top_flared_bottom',
      provenance: { sourceType: 'internal_curation', confidence: 0.85, reviewed: true },
    });
  } else if (isTopRelaxed && isBottomSlim) {
    signals.push({
      type: 'silhouette_balance',
      strength: 0.75,
      confidence: 0.85,
      explanationKey: 'relaxed_top_tailored_bottom',
      provenance: { sourceType: 'internal_curation', confidence: 0.85, reviewed: true },
    });
  } else if (topFit === 'tailored' && bottomFit === 'tailored') {
    signals.push({
      type: 'silhouette_balance',
      strength: 0.7,
      confidence: 0.85,
      explanationKey: 'structured_tailored_balance',
      provenance: { sourceType: 'internal_curation', confidence: 0.85, reviewed: true },
    });
  } else if (topFit === 'oversized' && bottomFit === 'oversized') {
    signals.push({
      type: 'silhouette_balance',
      strength: -0.5,
      confidence: 0.75,
      explanationKey: 'unanchored_volume_collision',
      provenance: { sourceType: 'internal_curation', confidence: 0.75, reviewed: true },
    });
  }

  return signals;
}

/**
 * Evaluates footwear compatibility with the rest of the ensemble:
 * - Juttis/Kolhapuris with Ethnic garments -> high synergy (+0.85)
 * - Formal shoes with tailored trousers/suits -> high synergy (+0.8)
 * - Sneakers with casual bottoms/Indo-western -> versatile casual (+0.75)
 */
export function getFootwearCompatibilitySignals(
  pieces: WardrobeItem[]
): FashionKnowledgeSignal[] {
  const signals: FashionKnowledgeSignal[] = [];
  const footwearItem = pieces.find((p) => p.category === 'Footwear');
  if (!footwearItem) return signals;

  const footwearSub = footwearItem.subcategory;
  const nonFootwear = pieces.filter((p) => p.category !== 'Footwear');
  const hasEthnic = nonFootwear.some((p) => p.category === 'Ethnic');
  const hasTailoredFormal = nonFootwear.some(
    (p) => p.subcategory === 'trousers' || p.subcategory === 'blazer' || p.formality >= 4
  );
  const hasCasual = nonFootwear.some(
    (p) => ['jeans', 't-shirt', 'shorts', 'hoodie', 'joggers'].includes(p.subcategory)
  );

  if (footwearSub === 'juttis' || footwearSub === 'kolhapuris') {
    if (hasEthnic) {
      signals.push({
        type: 'footwear_compatibility',
        strength: 0.85,
        confidence: 0.9,
        explanationKey: 'ethnic_footwear_harmony',
        provenance: { sourceType: 'internal_curation', confidence: 0.9, reviewed: true },
        metadata: { footwear: footwearSub },
      });
    }
  } else if (footwearSub === 'formal shoes' || footwearSub === 'loafers') {
    if (hasTailoredFormal) {
      signals.push({
        type: 'footwear_compatibility',
        strength: 0.8,
        confidence: 0.9,
        explanationKey: 'formal_footwear_harmony',
        provenance: { sourceType: 'repository', confidence: 0.9, reviewed: true },
        metadata: { footwear: footwearSub },
      });
    }
  } else if (footwearSub === 'sneakers') {
    if (hasCasual) {
      signals.push({
        type: 'footwear_compatibility',
        strength: 0.75,
        confidence: 0.9,
        explanationKey: 'casual_sneaker_balance',
        provenance: { sourceType: 'repository', confidence: 0.9, reviewed: true },
        metadata: { footwear: footwearSub },
      });
    }
  }

  return signals;
}

/**
 * Evaluates accessory and layering combinations:
 * - Dupatta paired with Kurta/Anarkali/Lehenga
 * - Nehru jacket layered over Kurta
 */
export function getAccessoryAndLayeringSignals(
  pieces: WardrobeItem[]
): FashionKnowledgeSignal[] {
  const signals: FashionKnowledgeSignal[] = [];
  const subs = pieces.map((p) => p.subcategory);

  // Dupatta drape pairing
  if (subs.includes('dupatta')) {
    const drapeTargets: Subcategory[] = ['kurta', 'anarkali', 'lehenga', 'salwar set'];
    if (subs.some((s) => drapeTargets.includes(s))) {
      signals.push({
        type: 'accessory_compatibility',
        strength: 0.8,
        confidence: 0.9,
        explanationKey: 'traditional_dupatta_pairing',
        provenance: { sourceType: 'internal_curation', confidence: 0.9, reviewed: true },
      });
    }
  }

  // Nehru jacket layering
  if (subs.includes('nehru jacket')) {
    if (subs.includes('kurta') || subs.includes('shirt')) {
      signals.push({
        type: 'layering_compatibility',
        strength: 0.9,
        confidence: 0.95,
        explanationKey: 'nehru_jacket_layering',
        provenance: { sourceType: 'internal_curation', confidence: 0.95, reviewed: true },
      });
    }
  }

  return signals;
}
