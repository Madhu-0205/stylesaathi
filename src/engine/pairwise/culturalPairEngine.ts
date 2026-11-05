import {
  WardrobeItem,
  Occasion,
  StylePreferences,
} from '../../types';
import {
  getDisentangledStyleAttributes,
} from '../features/garmentAttributeModel';
import { DimensionEvaluation, CulturalSynergyContext } from './types';

export interface CulturalPairEvaluationResult {
  evaluation: DimensionEvaluation;
  culturalContext: CulturalSynergyContext;
}

/**
 * Evaluates cultural synergy, regional textile traditions, Indo-Western fusion,
 * and international fashion inspirations between two garments.
 */
export function evaluateCulturalPairSynergy(
  itemA: WardrobeItem,
  itemB: WardrobeItem,
  occasion?: Occasion,
  preferences?: StylePreferences
): CulturalPairEvaluationResult {
  const subA = (itemA.subcategory || '').toLowerCase();
  const subB = (itemB.subcategory || '').toLowerCase();
  const catA = itemA.category;
  const catB = itemB.category;
  const colorsA = (itemA.colors || []).map((c) => c.toLowerCase());
  const colorsB = (itemB.colors || []).map((c) => c.toLowerCase());
  const allColors = [...colorsA, ...colorsB];

  const attrsA = getDisentangledStyleAttributes(itemA.subcategory, itemA.category, itemA.fit, itemA.fabric, itemA.pattern, itemA.name);
  const attrsB = getDisentangledStyleAttributes(itemB.subcategory, itemB.category, itemB.fit, itemB.fabric, itemB.pattern, itemB.name);

  const preferredAesthetics = (preferences?.preferredAesthetics || []).map((a) => a.toLowerCase());

  // 1. Devotional Puja Decorums Check (Highest context priority for sacred occasions)
  if (occasion === 'puja') {
    const isAuspicious = allColors.some((c) =>
      ['yellow', 'mustard', 'cream', 'gold', 'red', 'saffron', 'orange', 'white'].includes(c)
    );
    const isDarkBlack = allColors.includes('black');

    if (isAuspicious) {
      return {
        evaluation: {
          dimension: 'cultural_synergy',
          applied: true,
          score: 0.9,
          confidence: 0.95,
          weight: 1.2,
          reason: 'Devotional decorum: auspicious tones and modest cuts revered for prayer and puja rituals.',
          evidenceSource: 'cultural_ontology',
        },
        culturalContext: {
          tradition: 'vedic_devotional',
          synergyType: 'traditional_ensemble',
          explanation: 'Sacred decorum welcoming spiritual warmth.',
        },
      };
    }

    if (isDarkBlack && (catA === 'Ethnic' || catB === 'Ethnic')) {
      return {
        evaluation: {
          dimension: 'cultural_synergy',
          applied: true,
          score: -0.3,
          confidence: 0.85,
          weight: 1.2,
          reason: 'Cultural context note: dark black tones are traditionally avoided in auspicious devotional ceremonies.',
          evidenceSource: 'cultural_ontology',
        },
        culturalContext: {
          tradition: 'vedic_devotional',
          synergyType: 'traditional_ensemble',
          explanation: 'Contextual preference for lighter or auspicious jewel tones during prayer.',
        },
      };
    }
  }

  // 2. Traditional Indian Structural Ensembles
  // Saree + Blouse / Crop Top
  if (
    (subA === 'saree' && ['blouse', 'crop top'].includes(subB)) ||
    (subB === 'saree' && ['blouse', 'crop top'].includes(subA))
  ) {
    return {
      evaluation: {
        dimension: 'cultural_synergy',
        applied: true,
        score: 0.95,
        confidence: 0.95,
        weight: 1.2,
        reason: 'Master traditional pairing: tailored blouse provides the essential structural foundation for the fluid saree drape.',
        evidenceSource: 'cultural_ontology',
      },
      culturalContext: {
        tradition: attrsA.regionalTradition || attrsB.regionalTradition || 'indian_heritage',
        synergyType: 'traditional_ensemble',
        explanation: 'Canonical Indian drape ensemble respecting six-yard textile architecture.',
      },
    };
  }

  // Lehenga + Choli / Blouse / Dupatta
  if (
    (subA === 'lehenga' && ['blouse', 'crop top', 'dupatta'].includes(subB)) ||
    (subB === 'lehenga' && ['blouse', 'crop top', 'dupatta'].includes(subA))
  ) {
    return {
      evaluation: {
        dimension: 'cultural_synergy',
        applied: true,
        score: 0.95,
        confidence: 0.95,
        weight: 1.2,
        reason: 'Festive ceremonial ensemble: flared lehenga skirt harmonizes with structured choli.',
        evidenceSource: 'cultural_ontology',
      },
      culturalContext: {
        tradition: 'festive_indian',
        synergyType: 'traditional_ensemble',
        explanation: 'Timeless ceremonial celebration pairing.',
      },
    };
  }

  // Nehru Jacket + Kurta / Shirt
  if (
    (subA === 'nehru jacket' && ['kurta', 'shirt'].includes(subB)) ||
    (subB === 'nehru jacket' && ['kurta', 'shirt'].includes(subA))
  ) {
    return {
      evaluation: {
        dimension: 'cultural_synergy',
        applied: true,
        score: 0.95,
        confidence: 0.95,
        weight: 1.2,
        reason: 'Sartorial heritage layering: structured Nehru bandhgala vest adds dignified regal posture.',
        evidenceSource: 'cultural_ontology',
      },
      culturalContext: {
        tradition: 'pan_indian_formal',
        synergyType: 'traditional_ensemble',
        explanation: 'Classic formal layering suited for cultural gatherings and celebrations.',
      },
    };
  }

  // Sherwani / Achkan + Churidar / Dhoti
  if (
    (['sherwani', 'achkan'].includes(subA) && ['churidar', 'pajama', 'dhoti'].includes(subB)) ||
    (['sherwani', 'achkan'].includes(subB) && ['churidar', 'pajama', 'dhoti'].includes(subA))
  ) {
    return {
      evaluation: {
        dimension: 'cultural_synergy',
        applied: true,
        score: 0.95,
        confidence: 0.95,
        weight: 1.2,
        reason: 'Ceremonial grandeur: tailored regal sherwani coat grounded by traditional gathered lower drape.',
        evidenceSource: 'cultural_ontology',
      },
      culturalContext: {
        tradition: 'ceremonial_royal',
        synergyType: 'traditional_ensemble',
        explanation: 'Grand celebration and wedding host attire.',
      },
    };
  }

  // Kurta + Churidar / Pajama / Salwar / Palazzo
  if (
    (['kurta', 'kurti'].includes(subA) && ['churidar', 'pajama', 'salwar', 'palazzo', 'dhoti'].includes(subB)) ||
    (['kurta', 'kurti'].includes(subB) && ['churidar', 'pajama', 'salwar', 'palazzo', 'dhoti'].includes(subA))
  ) {
    return {
      evaluation: {
        dimension: 'cultural_synergy',
        applied: true,
        score: 0.9,
        confidence: 0.95,
        weight: 1.2,
        reason: 'Classic Indian coordinate: long tunic comfortably balanced with traditional lower silhouettes.',
        evidenceSource: 'cultural_ontology',
      },
      culturalContext: {
        tradition: 'pan_indian_everyday',
        synergyType: 'traditional_ensemble',
        explanation: 'Everyday to festive staple coordinate with climate-adaptive ease.',
      },
    };
  }

  // Ethnic Footwear (Juttis / Kolhapuris) + Ethnic Separates
  if (
    (['juttis', 'kolhapuris'].includes(subA) && (catB === 'Ethnic' || ['kurta', 'kurti', 'sherwani', 'churidar', 'saree'].includes(subB))) ||
    (['juttis', 'kolhapuris'].includes(subB) && (catA === 'Ethnic' || ['kurta', 'kurti', 'sherwani', 'churidar', 'saree'].includes(subA)))
  ) {
    return {
      evaluation: {
        dimension: 'cultural_synergy',
        applied: true,
        score: 0.9,
        confidence: 0.95,
        weight: 1.1,
        reason: 'Artisanal leathercraft harmony: handcrafted Indian footwear perfectly anchors ethnic silhouettes.',
        evidenceSource: 'cultural_ontology',
      },
      culturalContext: {
        tradition: 'handcrafted_footwear',
        synergyType: 'traditional_ensemble',
        explanation: 'Authentic leather mojari/kolhapuri craftsmanship completing ethnic attire.',
      },
    };
  }

  // 2. Regional Craft Textile Coherence
  if (attrsA.regionalTradition && attrsB.regionalTradition && attrsA.regionalTradition === attrsB.regionalTradition) {
    return {
      evaluation: {
        dimension: 'cultural_synergy',
        applied: true,
        score: 0.95,
        confidence: 0.95,
        weight: 1.2,
        reason: `Exquisite regional craft harmony: shared ${attrsA.regionalTradition.replace('_', ' ')} heritage across separates.`,
        evidenceSource: 'cultural_ontology',
      },
      culturalContext: {
        tradition: attrsA.regionalTradition,
        synergyType: 'traditional_ensemble',
        explanation: 'Unified regional weaving or printing tradition.',
      },
    };
  }

  // 3. Indo-Western Fusion Synergy
  // Kurti / Kurta + Denim Jeans
  if (
    (['kurti', 'kurta'].includes(subA) && subB === 'jeans') ||
    (['kurti', 'kurta'].includes(subB) && subA === 'jeans')
  ) {
    return {
      evaluation: {
        dimension: 'cultural_synergy',
        applied: true,
        score: 0.85,
        confidence: 0.9,
        weight: 1.2,
        reason: 'Celebrated Indo-Western fusion: artisanal ethnic tunic effortlessly styled with rugged denim.',
        evidenceSource: 'cultural_ontology',
      },
      culturalContext: {
        tradition: 'indo_western_fusion',
        synergyType: 'indo_western_fusion',
        explanation: 'Quintessential modern Indian collegiate and smart-casual staple.',
      },
    };
  }

  // Kurta + Tailored Chinos / Trousers
  if (
    (['kurti', 'kurta'].includes(subA) && subB === 'trousers') ||
    (['kurti', 'kurta'].includes(subB) && subA === 'trousers')
  ) {
    return {
      evaluation: {
        dimension: 'cultural_synergy',
        applied: true,
        score: 0.85,
        confidence: 0.9,
        weight: 1.2,
        reason: 'Contemporary fusion polish: clean straight-leg trousers streamline the relaxed drape of the kurta.',
        evidenceSource: 'cultural_ontology',
      },
      culturalContext: {
        tradition: 'indo_western_fusion',
        synergyType: 'indo_western_fusion',
        explanation: 'Urban smart-casual fusion suitable for creative workplaces.',
      },
    };
  }

  // Structured Western Blazer + Kurta
  if (
    (subA === 'blazer' && ['kurta', 'kurti'].includes(subB)) ||
    (subB === 'blazer' && ['kurta', 'kurti'].includes(subA))
  ) {
    return {
      evaluation: {
        dimension: 'cultural_synergy',
        applied: true,
        score: 0.85,
        confidence: 0.9,
        weight: 1.2,
        reason: 'Modern fusion layering: tailored European blazer lapels contrast handsomely with mandarin/bandh collar tunic.',
        evidenceSource: 'cultural_ontology',
      },
      culturalContext: {
        tradition: 'indo_western_fusion',
        synergyType: 'indo_western_fusion',
        explanation: 'Sophisticated cross-cultural tailoring balance.',
      },
    };
  }

  // 4. International Inspirations (Korean, Japanese, European)
  // Korean Relaxed / Oversized Pairing
  if (
    (attrsA.styleFamily === 'korean_relaxed' || attrsB.styleFamily === 'korean_relaxed') ||
    preferredAesthetics.includes('korean relaxed')
  ) {
    if (
      (subA === 'blazer' && ['trousers', 'jeans'].includes(subB) && (attrsA.fitType === 'oversized' || attrsB.fitType === 'relaxed')) ||
      (subB === 'blazer' && ['trousers', 'jeans'].includes(subA) && (attrsB.fitType === 'oversized' || attrsA.fitType === 'relaxed'))
    ) {
      return {
        evaluation: {
          dimension: 'cultural_synergy',
          applied: true,
          score: 0.85,
          confidence: 0.9,
          weight: 1.1,
          reason: 'Korean contemporary volume play: boxy tailored outerwear effortlessly balanced over fluid wide trousers.',
          evidenceSource: 'cultural_ontology',
        },
        culturalContext: {
          tradition: 'korean_contemporary',
          synergyType: 'cross_cultural_inspiration',
          explanation: 'Modern Seoul street tailoring with architectural ease.',
        },
      };
    }
  }

  // Japanese Relaxed Workwear & Textile Craft
  if (
    (attrsA.styleFamily === 'japanese_workwear' || attrsB.styleFamily === 'japanese_workwear') ||
    preferredAesthetics.includes('japanese workwear') ||
    itemA.name.toLowerCase().includes('chore') ||
    itemB.name.toLowerCase().includes('chore')
  ) {
    if (
      (itemA.fabric === 'denim' || itemA.fabric === 'khadi' || itemA.fabric === 'linen') &&
      (itemB.fabric === 'denim' || itemB.fabric === 'khadi' || itemB.fabric === 'linen')
    ) {
      return {
        evaluation: {
          dimension: 'cultural_synergy',
          applied: true,
          score: 0.85,
          confidence: 0.9,
          weight: 1.1,
          reason: 'Japanese wabi-sabi utility: artisanal textured natural fibers and workwear silhouettes in quiet harmony.',
          evidenceSource: 'cultural_ontology',
        },
        culturalContext: {
          tradition: 'japanese_workwear',
          synergyType: 'cross_cultural_inspiration',
          explanation: 'Textile-first functional aesthetics valuing natural handloom character.',
        },
      };
    }
  }

  // European Tailored Smart Casual
  if (
    (subA === 'shirt' && subB === 'trousers') ||
    (subB === 'shirt' && subA === 'trousers') ||
    (subA === 'blazer' && subB === 'trousers') ||
    (subB === 'blazer' && subA === 'trousers')
  ) {
    return {
      evaluation: {
        dimension: 'cultural_synergy',
        applied: true,
        score: 0.85,
        confidence: 0.9,
        weight: 1.1,
        reason: 'Classic European smart-casual: crisp structured lines, sharp collars, and tailored proportions.',
        evidenceSource: 'cultural_ontology',
      },
      culturalContext: {
        tradition: 'european_tailored',
        synergyType: 'cross_cultural_inspiration',
        explanation: 'Universal modern tailoring with understated polish.',
      },
    };
  }

  return {
    evaluation: {
      dimension: 'cultural_synergy',
      applied: true,
      score: 0.65,
      confidence: 0.8,
      weight: 1.0,
      reason: 'Versatile contemporary pairing with universal aesthetic coherence.',
      evidenceSource: 'rule_engine',
    },
    culturalContext: {
      synergyType: 'neutral_universal',
      explanation: 'Universal contemporary wardrobe pieces.',
    },
  };
}
