import { WardrobeItem, ContextSnapshot, Occasion } from '../../types';

export interface EditorialOutfitComponents {
  top?: WardrobeItem;
  bottom?: WardrobeItem;
  layer?: WardrobeItem;
  footwear?: WardrobeItem;
  accessory?: WardrobeItem;
}

export interface EditorialReasoningInput {
  concept: string;
  occasion: Occasion | string;
  components: EditorialOutfitComponents;
  weather?: ContextSnapshot | null;
  customColorTheory?: string;
  customSilhouette?: string;
  customProTips?: string[];
}

export interface EditorialReasoningOutput {
  formattedEditorial: string;
  sections: {
    coreConcept: string;
    wardrobeAnchors: string;
    colorTheory: string;
    proportionSilhouette: string;
    fabricTexture: string;
    weatherComfort: string;
    occasionDecorum: string;
    stylingDirection: string;
  };
}

/**
 * Extracts structured editorial components from a generated outfit's slot map.
 */
export function extractEditorialComponents(slots?: Record<string, WardrobeItem[]>): EditorialOutfitComponents {
  const allPieces = Object.values(slots || {}).flat();
  return {
    top: allPieces.find(
      (p) =>
        p &&
        (p.category?.toLowerCase() === 'tops' ||
          (p.category?.toLowerCase() === 'ethnic' &&
            p.subcategory !== 'saree' &&
            p.subcategory !== 'lehenga' &&
            p.subcategory !== 'dupatta'))
    ),
    bottom: allPieces.find(
      (p) =>
        p &&
        (p.category?.toLowerCase() === 'bottoms' ||
          p.subcategory === 'saree' ||
          p.subcategory === 'lehenga')
    ),
    layer: allPieces.find(
      (p) =>
        p &&
        (p.category?.toLowerCase() === 'outerwear' ||
          p.subcategory === 'nehru jacket' ||
          p.subcategory === 'blazer')
    ),
    footwear: allPieces.find((p) => p && p.category?.toLowerCase() === 'footwear'),
    accessory: allPieces.find(
      (p) =>
        p &&
        (p.category?.toLowerCase() === 'accessories' || p.subcategory === 'dupatta')
    ),
  };
}

/**
 * Builds deterministic 8-part editorial reasoning grounded strictly in actual wardrobe items.
 */
export function buildEditorialReasoning(
  input: EditorialReasoningInput
): EditorialReasoningOutput {
  const { concept, occasion, components, weather, customColorTheory, customSilhouette, customProTips } = input;

  // 1. Core Concept
  const coreConcept = concept;

  // 2. Wardrobe Anchors
  const anchorPieces: string[] = [];
  if (components.top) anchorPieces.push(`Top: **${components.top.name}**`);
  if (components.bottom) anchorPieces.push(`Bottom: **${components.bottom.name}**`);
  if (components.layer) anchorPieces.push(`Layer: **${components.layer.name}**`);
  if (components.footwear) anchorPieces.push(`Footwear: **${components.footwear.name}**`);
  if (components.accessory) anchorPieces.push(`Accessory: **${components.accessory.name}**`);
  const wardrobeAnchors = anchorPieces.length > 0 ? anchorPieces.join(' · ') : 'Grounded in owned wardrobe essentials';

  // 3. Color Theory & Palette
  const allColors = [
    ...(components.top?.colors || []),
    ...(components.bottom?.colors || []),
    ...(components.layer?.colors || []),
    ...(components.footwear?.colors || []),
  ].filter(Boolean);
  const uniqueColors = Array.from(new Set(allColors.map((c) => c.toLowerCase())));

  let colorTheory = customColorTheory;
  if (!colorTheory) {
    if (uniqueColors.length <= 2) {
      colorTheory = `Tonal harmony anchored in ${uniqueColors.join(' and ')}, creating an elongated, clean visual line.`;
    } else {
      colorTheory = `Balanced contrast pairing ${uniqueColors[0]} and ${uniqueColors[1]} with neutral grounding in ${uniqueColors.slice(2).join(', ')}.`;
    }
  }

  // 4. Proportion & Silhouette Balance
  let proportionSilhouette = customSilhouette;
  if (!proportionSilhouette) {
    const topFit = components.top?.fit || 'regular';
    const bottomFit = components.bottom?.fit || 'straight';
    if (topFit === 'relaxed' || topFit === 'oversized') {
      proportionSilhouette = `Relaxed upper volume balanced by structured ${bottomFit} bottoms to maintain intentional proportion.`;
    } else if (bottomFit === 'flared' || bottomFit === 'oversized' || String(bottomFit).includes('wide')) {
      proportionSilhouette = `Fitted upper torso paired with fluid ${bottomFit} bottom drape for graceful architectural balance.`;
    } else {
      proportionSilhouette = `Tailored proportions with clean vertical lines aligned with contemporary silhouette standards.`;
    }
  }

  // 5. Fabric & Texture Interplay
  const fabrics = [
    components.top?.fabric,
    components.bottom?.fabric,
    components.layer?.fabric,
    components.footwear?.fabric,
  ].filter(Boolean) as string[];

  const fabricTexture =
    fabrics.length > 1
      ? `Tactile juxtaposition of ${fabrics[0]} against ${fabrics[1]}${fabrics[2] ? ` and ${fabrics[2]}` : ''}, preventing visual flatness.`
      : fabrics.length === 1
      ? `Cohesive tactile flow emphasizing breathable ${fabrics[0]} texture.`
      : 'Natural texture pairing with comfortable drape and structured resilience.';

  // 6. Weather & Thermal Comfort
  let weatherComfort = '';
  const temp = weather?.weather?.temperature;
  if (temp !== undefined) {
    if (temp >= 30) {
      weatherComfort = `Calibrated for hot climate (${temp}°C): maximizes airflow, open-weave breathability, and heat reflection.`;
    } else if (temp <= 18) {
      weatherComfort = `Calibrated for cool climate (${temp}°C): provides effective thermal insulation with structured layering.`;
    } else {
      weatherComfort = `Optimized for moderate climate (${temp}°C): balanced thermal comfort for all-day indoor and outdoor wear.`;
    }
  } else {
    weatherComfort = 'Versatile thermal comfort suitable for indoor climate-controlled environments and daily commuting.';
  }

  // 7. Occasion & Cultural Decorum
  const occasionDecorum = `Respects ${occasion} dress codes with dignified coverage, effortless polish, and contemporary decorum.`;

  // 8. Styling Direction & Pro-Tips
  const tips = customProTips && customProTips.length > 0 ? customProTips : [
    'Execute a clean half-tuck or cuff sleeves twice to add effortless intentionality.',
    'Keep accessories refined: unembellished watch, clean belt matching footwear leather tone.',
  ];
  const stylingDirection = tips.map((t) => `• ${t}`).join('\n');

  const formattedEditorial = [
    `### 1. Aesthetic Intent & Core Concept`,
    coreConcept,
    '',
    `### 2. Wardrobe Anchors`,
    wardrobeAnchors,
    '',
    `### 3. Color Theory & Palette Harmony`,
    colorTheory,
    '',
    `### 4. Proportion & Silhouette Balance`,
    proportionSilhouette,
    '',
    `### 5. Fabric & Texture Interplay`,
    fabricTexture,
    '',
    `### 6. Weather & Thermal Comfort`,
    weatherComfort,
    '',
    `### 7. Occasion & Cultural Decorum`,
    occasionDecorum,
    '',
    `### 8. Styling Direction & Pro-Tips`,
    stylingDirection,
  ].join('\n');

  return {
    formattedEditorial,
    sections: {
      coreConcept,
      wardrobeAnchors,
      colorTheory,
      proportionSilhouette,
      fabricTexture,
      weatherComfort,
      occasionDecorum,
      stylingDirection,
    },
  };
}
