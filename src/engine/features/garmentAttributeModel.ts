import {
  Category,
  Subcategory,
  FabricType,
  PatternType,
  SilhouetteFit,
  CulturalContext,
  ColorFamily,
  ColorTone,
  SleeveType,
  NecklineType,
  GarmentLength,
  LayeringRole,
  FabricTexture,
  FabricWeight,
  BreathabilityTier,
  AttributeVerificationStatus,
  SilhouetteType,
  FitType,
  StyleFamily,
  AttributeProvenanceRecord,
} from '../../types';

// ============================================================================
// 1. COLOUR INTELLIGENCE & PALETTE CLASSIFICATION
// ============================================================================

export interface ColorIntelligenceResult {
  primaryColor: string;
  secondaryColor?: string;
  accentColors: string[];
  colorFamily: ColorFamily;
  colorTone: ColorTone;
  colorConfidence: number;
  patternRelatedColorAmbiguity: boolean;
}

const WARM_COLORS = new Set([
  'red', 'crimson', 'maroon', 'scarlet', 'coral', 'orange', 'tangerine',
  'peach', 'rust', 'yellow', 'mustard', 'gold', 'amber', 'terracotta',
]);

const COOL_COLORS = new Set([
  'blue', 'navy', 'indigo', 'sky_blue', 'teal', 'cyan', 'turquoise',
  'green', 'emerald', 'olive', 'mint', 'sage', 'purple', 'violet',
  'lavender', 'magenta',
]);

const NEUTRAL_COLORS_MAP = new Set([
  'white', 'black', 'grey', 'gray', 'charcoal', 'cream', 'ivory',
  'beige', 'tan', 'brown', 'khaki', 'silver',
]);

/**
 * Maps a single color string to its canonical ColorFamily.
 */
export function getColorFamily(color: string): ColorFamily {
  const c = color.toLowerCase().trim().replace(/[-\s]/g, '_');

  if (['white', 'black', 'grey', 'gray', 'charcoal', 'cream', 'ivory', 'beige', 'tan', 'khaki'].includes(c)) {
    return 'neutrals';
  }
  if (['blue', 'navy', 'indigo', 'sky_blue', 'royal_blue', 'powder_blue'].includes(c)) {
    return 'blues';
  }
  if (['red', 'crimson', 'maroon', 'scarlet', 'pink', 'rose', 'fuchsia', 'coral', 'magenta'].includes(c)) {
    return 'reds_pinks';
  }
  if (['yellow', 'mustard', 'orange', 'tangerine', 'peach', 'amber'].includes(c)) {
    return 'yellows_oranges';
  }
  if (['green', 'emerald', 'olive', 'mint', 'sage', 'forest_green', 'teal', 'turquoise'].includes(c)) {
    return 'greens';
  }
  if (['purple', 'violet', 'lavender', 'plum', 'mauve'].includes(c)) {
    return 'purples';
  }
  if (['brown', 'rust', 'terracotta', 'ochre', 'camel', 'copper'].includes(c)) {
    return 'earth_tones';
  }
  if (['gold', 'silver', 'bronze', 'zari', 'metallic'].includes(c)) {
    return 'metallics';
  }

  return 'neutrals';
}

/**
 * Classifies color tone into warm, cool, or neutral.
 */
export function getColorTone(color: string): ColorTone {
  const c = color.toLowerCase().trim().replace(/[-\s]/g, '_');
  if (NEUTRAL_COLORS_MAP.has(c)) return 'neutral';
  if (WARM_COLORS.has(c)) return 'warm';
  if (COOL_COLORS.has(c)) return 'cool';
  return 'neutral';
}

/**
 * Detects whether an outfit or garment has pattern-related color ambiguity.
 * True when multicolored pattern prints prevent single-color assignment.
 */
export function detectColorAmbiguity(colors: string[], pattern?: PatternType): boolean {
  if (colors.length >= 3) return true;
  if (!pattern || pattern === 'solid') return false;

  const complexPatterns: PatternType[] = [
    'floral', 'bandhani', 'ikat', 'kalamkari', 'block_print',
    'abstract', 'geometric', 'polka_dot',
  ];
  return complexPatterns.includes(pattern) && colors.length >= 2;
}

/**
 * Extracts structured Color Intelligence from garment color metadata.
 */
export function extractColorIntelligence(
  colors: string[],
  pattern?: PatternType
): ColorIntelligenceResult {
  const cleanColors = colors.map((c) => c.toLowerCase().trim()).filter(Boolean);
  const primary = cleanColors[0] || 'unknown';
  const secondary = cleanColors[1];
  const accentColors = cleanColors.slice(2);

  const colorFamily = getColorFamily(primary);
  const colorTone = getColorTone(primary);
  const ambiguity = detectColorAmbiguity(cleanColors, pattern);

  // Confidence is high for 1-2 distinct colors, lower when ambiguous multicolored prints exist
  let colorConfidence = 0.95;
  if (ambiguity) colorConfidence = 0.70;
  if (primary === 'unknown') colorConfidence = 0.0;

  return {
    primaryColor: primary,
    secondaryColor: secondary,
    accentColors,
    colorFamily,
    colorTone,
    colorConfidence,
    patternRelatedColorAmbiguity: ambiguity,
  };
}

// ============================================================================
// 2. GARMENT CLASSIFICATION & STRUCTURAL PROPERTIES
// ============================================================================

export interface GarmentClassificationResult {
  garmentType: string;
  sleeveType: SleeveType;
  neckline: NecklineType;
  length: GarmentLength;
  layeringRole: LayeringRole;
}

/**
 * Infers structural garment anatomy from subcategory and category defaults.
 * These are initial inferred baselines; user edits or verified metadata always override.
 */
export function getGarmentClassification(
  subcategory: Subcategory,
  category: Category
): GarmentClassificationResult {
  const sub = (subcategory || '').toLowerCase().trim();

  // 1. Traditional Indian & Ethnic Garments
  if (sub === 'kurta') {
    return {
      garmentType: 'tunic',
      sleeveType: 'full_sleeve',
      neckline: 'mandarin_collar',
      length: 'knee_length',
      layeringRole: 'standalone',
    };
  }
  if (sub === 'kurti') {
    return {
      garmentType: 'short_tunic',
      sleeveType: 'three_quarter',
      neckline: 'round',
      length: 'hip_length',
      layeringRole: 'standalone',
    };
  }
  if (sub === 'saree') {
    return {
      garmentType: 'draped_unstitched',
      sleeveType: 'unknown',
      neckline: 'unknown',
      length: 'floor_length',
      layeringRole: 'drape',
    };
  }
  if (sub === 'blouse') {
    return {
      garmentType: 'fitted_crop',
      sleeveType: 'short_sleeve',
      neckline: 'sweetheart',
      length: 'cropped',
      layeringRole: 'base',
    };
  }
  if (sub === 'lehenga') {
    return {
      garmentType: 'flared_skirt',
      sleeveType: 'unknown',
      neckline: 'unknown',
      length: 'floor_length',
      layeringRole: 'standalone',
    };
  }
  if (sub === 'sherwani' || sub === 'achkan') {
    return {
      garmentType: 'structured_ceremonial_coat',
      sleeveType: 'full_sleeve',
      neckline: 'mandarin_collar',
      length: 'knee_length',
      layeringRole: 'outer',
    };
  }
  if (sub === 'nehru jacket') {
    return {
      garmentType: 'sleeveless_vest',
      sleeveType: 'sleeveless',
      neckline: 'mandarin_collar',
      length: 'hip_length',
      layeringRole: 'mid',
    };
  }
  if (sub === 'bandhgala') {
    return {
      garmentType: 'tailored_suit_jacket',
      sleeveType: 'full_sleeve',
      neckline: 'mandarin_collar',
      length: 'hip_length',
      layeringRole: 'outer',
    };
  }
  if (sub === 'dupatta') {
    return {
      garmentType: 'draped_scarf',
      sleeveType: 'unknown',
      neckline: 'unknown',
      length: 'maxi',
      layeringRole: 'drape',
    };
  }
  if (sub === 'anarkali') {
    return {
      garmentType: 'flared_frock_suit',
      sleeveType: 'full_sleeve',
      neckline: 'round',
      length: 'ankle_length',
      layeringRole: 'standalone',
    };
  }
  if (['palazzo', 'salwar', 'churidar', 'pajama', 'dhoti', 'lungi'].includes(sub)) {
    return {
      garmentType: 'trouser',
      sleeveType: 'unknown',
      neckline: 'unknown',
      length: 'ankle_length',
      layeringRole: 'standalone',
    };
  }

  // 2. Western Clothing
  if (sub === 't-shirt') {
    return {
      garmentType: 'tee',
      sleeveType: 'short_sleeve',
      neckline: 'round',
      length: 'hip_length',
      layeringRole: 'base',
    };
  }
  if (sub === 'shirt') {
    return {
      garmentType: 'button_up',
      sleeveType: 'full_sleeve',
      neckline: 'collared',
      length: 'hip_length',
      layeringRole: 'base',
    };
  }
  if (sub === 'crop top') {
    return {
      garmentType: 'crop',
      sleeveType: 'short_sleeve',
      neckline: 'round',
      length: 'cropped',
      layeringRole: 'base',
    };
  }
  if (sub === 'hoodie' || sub === 'sweater') {
    return {
      garmentType: 'pullover',
      sleeveType: 'full_sleeve',
      neckline: 'cowl',
      length: 'hip_length',
      layeringRole: 'mid',
    };
  }
  if (sub === 'blazer' || sub === 'jacket') {
    return {
      garmentType: 'jacket',
      sleeveType: 'full_sleeve',
      neckline: 'collared',
      length: 'hip_length',
      layeringRole: 'outer',
    };
  }
  if (sub === 'jeans' || sub === 'trousers' || sub === 'joggers') {
    return {
      garmentType: 'bottom',
      sleeveType: 'unknown',
      neckline: 'unknown',
      length: 'ankle_length',
      layeringRole: 'standalone',
    };
  }
  if (sub === 'shorts') {
    return {
      garmentType: 'shorts',
      sleeveType: 'unknown',
      neckline: 'unknown',
      length: 'knee_length',
      layeringRole: 'standalone',
    };
  }
  if (sub === 'skirt') {
    return {
      garmentType: 'skirt',
      sleeveType: 'unknown',
      neckline: 'unknown',
      length: 'midi',
      layeringRole: 'standalone',
    };
  }
  if (sub === 'dress' || sub === 'western dress') {
    return {
      garmentType: 'dress',
      sleeveType: 'short_sleeve',
      neckline: 'v_neck',
      length: 'knee_length',
      layeringRole: 'standalone',
    };
  }

  // 3. Footwear & Accessories
  if (category === 'Footwear') {
    return {
      garmentType: 'footwear',
      sleeveType: 'unknown',
      neckline: 'unknown',
      length: 'unknown',
      layeringRole: 'accessory',
    };
  }
  if (category === 'Accessories') {
    return {
      garmentType: 'accessory',
      sleeveType: 'unknown',
      neckline: 'unknown',
      length: 'unknown',
      layeringRole: 'accessory',
    };
  }

  // Default fallback
  return {
    garmentType: 'apparel',
    sleeveType: 'unknown',
    neckline: 'unknown',
    length: 'hip_length',
    layeringRole: 'standalone',
  };
}

// ============================================================================
// 3. FABRIC & MATERIAL PROPERTIES
// ============================================================================

export interface FabricPropertiesResult {
  texture: FabricTexture;
  weight: FabricWeight;
  breathability: BreathabilityTier;
  genericComposition: string;
}

/**
 * Returns empirical textile properties for known FabricTypes.
 * Important: genericComposition represents fiber taxonomy, NEVER a fake laboratory tag.
 */
export function getFabricMaterialProperties(fabric?: FabricType): FabricPropertiesResult {
  if (!fabric || fabric === 'unknown') {
    return {
      texture: 'unknown',
      weight: 'unknown',
      breathability: 'unknown',
      genericComposition: 'Unspecified fabric composition',
    };
  }

  switch (fabric) {
    case 'cotton':
      return {
        texture: 'soft',
        weight: 'medium_weight',
        breathability: 'high',
        genericComposition: 'Natural cotton cellulose fibers',
      };
    case 'linen':
      return {
        texture: 'crisp',
        weight: 'lightweight',
        breathability: 'high',
        genericComposition: 'Natural flax fibers',
      };
    case 'khadi':
      return {
        texture: 'textured',
        weight: 'medium_weight',
        breathability: 'high',
        genericComposition: 'Hand-spun natural cotton or silk weave',
      };
    case 'mulmul':
      return {
        texture: 'soft',
        weight: 'lightweight',
        breathability: 'high',
        genericComposition: 'Fine lightweight cotton muslin',
      };
    case 'modal':
      return {
        texture: 'smooth',
        weight: 'lightweight',
        breathability: 'high',
        genericComposition: 'Regenerated semi-synthetic beechwood cellulose',
      };
    case 'silk':
      return {
        texture: 'smooth',
        weight: 'medium_weight',
        breathability: 'medium',
        genericComposition: 'Natural protein silk filaments',
      };
    case 'banarasi':
      return {
        texture: 'embossed',
        weight: 'heavyweight',
        breathability: 'low',
        genericComposition: 'Brocaded silk weave with metallic zari threads',
      };
    case 'chanderi':
      return {
        texture: 'sheer',
        weight: 'lightweight',
        breathability: 'medium',
        genericComposition: 'Handloom silk-cotton blend with sheer texture',
      };
    case 'tussar':
      return {
        texture: 'textured',
        weight: 'medium_weight',
        breathability: 'medium',
        genericComposition: 'Wild forest tussar silk',
      };
    case 'chiffon':
      return {
        texture: 'sheer',
        weight: 'lightweight',
        breathability: 'medium',
        genericComposition: 'Lightweight plain balanced sheer crepe weave',
      };
    case 'georgette':
      return {
        texture: 'rough',
        weight: 'lightweight',
        breathability: 'medium',
        genericComposition: 'Sheer dull-finished crinkled crepe fabric',
      };
    case 'denim':
      return {
        texture: 'rough',
        weight: 'heavyweight',
        breathability: 'low',
        genericComposition: 'Warp-faced twill cotton weave',
      };
    case 'velvet':
      return {
        texture: 'soft',
        weight: 'heavyweight',
        breathability: 'low',
        genericComposition: 'Dense cut-pile woven fabric',
      };
    case 'wool':
      return {
        texture: 'heavy',
        weight: 'heavyweight',
        breathability: 'low',
        genericComposition: 'Natural sheep/animal keratin fleece',
      };
    case 'polyblend':
      return {
        texture: 'smooth',
        weight: 'medium_weight',
        breathability: 'low',
        genericComposition: 'Synthetic polyester-cotton blended fibers',
      };
    default:
      return {
        texture: 'soft',
        weight: 'medium_weight',
        breathability: 'medium',
        genericComposition: 'Woven textile material',
      };
  }
}

// ============================================================================
// 4. STYLE ATTRIBUTES: SILHOUETTE, FIT & STYLE FAMILY SEPARATION
// ============================================================================

export interface StyleAttributesResult {
  silhouette: SilhouetteType;
  fitType: FitType;
  styleFamily: StyleFamily;
  regionalTradition?: string;
}

/**
 * Disentangles Silhouette (overall 2D/3D cut/shape) from Fit (body ease).
 * Disentangles Style Family and resolves authentic Regional Traditions.
 */
export function getDisentangledStyleAttributes(
  subcategory: Subcategory | string | undefined,
  category: Category,
  legacyFit?: SilhouetteFit,
  fabric?: FabricType,
  pattern?: PatternType,
  name?: string
): StyleAttributesResult {
  const sub = (subcategory || '').toLowerCase();
  const n = (name || '').toLowerCase();

  // 1. Separate Silhouette vs Fit
  let silhouette: SilhouetteType = 'straight';
  let fitType: FitType = 'regular';

  // Map legacy SilhouetteFit cleanly into silhouette vs fit
  if (legacyFit) {
    switch (legacyFit) {
      case 'slim':
        silhouette = 'fitted';
        fitType = 'slim';
        break;
      case 'regular':
        silhouette = 'straight';
        fitType = 'regular';
        break;
      case 'relaxed':
        silhouette = 'boxy';
        fitType = 'relaxed';
        break;
      case 'oversized':
        silhouette = 'boxy';
        fitType = 'oversized';
        break;
      case 'straight':
        silhouette = 'straight';
        fitType = 'regular';
        break;
      case 'a_line':
        silhouette = 'a_line';
        fitType = 'regular';
        break;
      case 'flared':
        silhouette = 'flared';
        fitType = 'regular';
        break;
      case 'anarkali':
        silhouette = 'anarkali';
        fitType = 'regular';
        break;
      case 'tailored':
        silhouette = 'fitted';
        fitType = 'tailored';
        break;
    }
  }

  // Refine silhouette by garment subcategory
  if (sub === 'anarkali') silhouette = 'anarkali';
  else if (sub === 'lehenga' || sub === 'palazzo') silhouette = 'flared';
  else if (sub === 'saree' || sub === 'dhoti' || sub === 'lungi' || sub === 'dupatta') silhouette = 'draped';
  else if (sub === 'kurti' || sub === 'skirt') silhouette = 'a_line';

  // 2. Derive Style Family
  let styleFamily: StyleFamily = 'contemporary_casual';

  if (['kurta', 'kurti'].includes(sub) && (n.includes('indo') || n.includes('fusion') || n.includes('denim'))) {
    styleFamily = 'indo_western_fusion';
  } else if (category === 'Ethnic') {
    if (['sherwani', 'achkan', 'bandhgala', 'saree', 'lehenga'].includes(sub)) {
      styleFamily = 'festive_ceremonial';
    } else {
      styleFamily = 'traditional_indian';
    }
  } else if (sub === 'blazer' || sub === 'trousers' || legacyFit === 'tailored') {
    styleFamily = 'smart_tailored';
  } else if (legacyFit === 'oversized' || sub === 'hoodie') {
    styleFamily = 'streetwear';
  }

  // Korean & Japanese cross-cultural markers
  if (n.includes('korean') || (legacyFit === 'oversized' && ['blazer', 'trousers', 'shirt'].includes(sub))) {
    styleFamily = 'korean_relaxed';
  } else if (n.includes('japanese') || (fabric === 'linen' && legacyFit === 'relaxed' && sub === 'trousers')) {
    styleFamily = 'japanese_workwear';
  }

  // 3. Resolve Indian Regional Tradition
  let regionalTradition: string | undefined;

  if (fabric === 'banarasi' || n.includes('banarasi')) regionalTradition = 'banarasi';
  else if (fabric === 'chanderi' || n.includes('chanderi')) regionalTradition = 'chanderi';
  else if (fabric === 'tussar' || n.includes('tussar')) regionalTradition = 'tussar';
  else if (pattern === 'bandhani' || n.includes('bandhani')) regionalTradition = 'bandhani';
  else if (pattern === 'chikankari' || n.includes('chikankari')) regionalTradition = 'lucknowi_chikankari';
  else if (pattern === 'kalamkari' || n.includes('kalamkari')) regionalTradition = 'kalamkari';
  else if (pattern === 'ikat' || n.includes('ikat')) regionalTradition = 'ikat';
  else if (n.includes('kanjivaram')) regionalTradition = 'kanjivaram';
  else if (n.includes('phulkari')) regionalTradition = 'phulkari';
  else if (n.includes('pochampally')) regionalTradition = 'pochampally';

  return {
    silhouette,
    fitType,
    styleFamily,
    regionalTradition,
  };
}

// ============================================================================
// 5. ATTRIBUTE PROVENANCE & UNCERTAINTY BUILDER
// ============================================================================

export function createAttributeProvenanceRecord(
  source: AttributeVerificationStatus,
  confidence: number,
  notes?: string
): AttributeProvenanceRecord {
  return {
    source,
    confidence: Math.max(0, Math.min(1.0, Math.round(confidence * 100) / 100)),
    verifiedAt: source === 'user_confirmed' ? Date.now() : undefined,
    notes,
  };
}
