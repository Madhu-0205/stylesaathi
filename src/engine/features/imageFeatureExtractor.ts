import {
  Category,
  Subcategory,
  Occasion,
  FabricType,
  PatternType,
  SilhouetteFit,
  CulturalContext,
  ConfidenceLevel,
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

import {
  extractColorIntelligence,
  getGarmentClassification,
  getFabricMaterialProperties,
  getDisentangledStyleAttributes,
  createAttributeProvenanceRecord,
} from './garmentAttributeModel';

// ============================================================================
// IMAGE FEATURE EXTRACTION TYPES & CONTRACTS
// ============================================================================

export interface ImageFeatureExtractionResult {
  category: Category;
  subcategory?: Subcategory;
  colors: string[];
  primaryColor?: string;
  secondaryColor?: string;
  accentColors: string[];
  colorFamily?: ColorFamily;
  colorTone?: ColorTone;
  colorConfidence: number;
  patternRelatedColorAmbiguity: boolean;

  garmentType: string;
  sleeveType: SleeveType;
  neckline: NecklineType;
  length: GarmentLength;
  layeringRole: LayeringRole;

  fabric?: FabricType;
  fabricTexture: FabricTexture;
  fabricWeight: FabricWeight;
  breathability: BreathabilityTier;
  materialComposition: string;
  fabricVerificationStatus: AttributeVerificationStatus;

  pattern?: PatternType;
  fit?: SilhouetteFit;
  silhouette: SilhouetteType;
  fitType: FitType;
  culturalContext: CulturalContext;
  styleFamily: StyleFamily;
  regionalTradition?: string;

  occasions: Occasion[];
  formality: number;

  overallConfidence: number;
  confidenceLevel: ConfidenceLevel;
  isMultiGarmentOrFlatlay: boolean;
  needsUserConfirmation: boolean;
  ambiguityReasons: string[];
  note: string;

  attributeProvenance: Record<string, AttributeProvenanceRecord>;
}

// ============================================================================
// KEYWORD REGEX DICTIONARIES FOR CLIENT-SIDE INFERENCE
// ============================================================================

const GENERIC_CAMERA_FILE_REGEX = /^(img|dsc|photo|image|pxl|pic|screenshot|scan|upload|temp|file)[-_]?[0-9a-z_.]*$/i;

const MULTI_GARMENT_KEYWORDS = [
  'flatlay',
  'suit set',
  'suit_set',
  'outfit',
  'ensemble',
  'combo',
  'co-ord',
  'coord',
  'and',
  'with',
  'pair',
  'duo',
];

interface GarmentRule {
  keywords: string[];
  category: Category;
  subcategory: Subcategory;
  occasions: Occasion[];
  formality: number;
  culturalContext: CulturalContext;
  defaultColors?: string[];
  defaultFabric?: FabricType;
  defaultPattern?: PatternType;
  confidence: number;
}

const GARMENT_RULES: GarmentRule[] = [
  // Ethnic Garments
  {
    keywords: ['anarkali'],
    category: 'Ethnic',
    subcategory: 'anarkali',
    occasions: ['wedding guest', 'family function', 'festive', 'celebration'],
    formality: 4,
    culturalContext: 'traditional',
    defaultColors: ['maroon', 'gold'],
    confidence: 0.90,
  },
  {
    keywords: ['lehenga', 'chaniya choli', 'ghagra'],
    category: 'Ethnic',
    subcategory: 'lehenga',
    occasions: ['wedding guest', 'Diwali', 'celebration'],
    formality: 5,
    culturalContext: 'ceremonial',
    defaultColors: ['pink', 'gold'],
    defaultFabric: 'silk',
    defaultPattern: 'embroidered',
    confidence: 0.88,
  },
  {
    keywords: ['saree', 'sari'],
    category: 'Ethnic',
    subcategory: 'saree',
    occasions: ['wedding guest', 'Diwali', 'party', 'puja'],
    formality: 5,
    culturalContext: 'ceremonial',
    defaultColors: ['red', 'gold'],
    defaultFabric: 'silk',
    confidence: 0.88,
  },
  {
    keywords: ['kurti'],
    category: 'Ethnic',
    subcategory: 'kurti',
    occasions: ['college', 'casual outing', 'everyday'],
    formality: 2,
    culturalContext: 'contemporary',
    defaultColors: ['yellow', 'white'],
    confidence: 0.85,
  },
  {
    keywords: ['kurta'],
    category: 'Ethnic',
    subcategory: 'kurta',
    occasions: ['college', 'family function', 'puja', 'everyday'],
    formality: 3,
    culturalContext: 'traditional',
    defaultColors: ['white', 'navy'],
    confidence: 0.86,
  },
  {
    keywords: ['sherwani', 'achkan'],
    category: 'Ethnic',
    subcategory: 'sherwani',
    occasions: ['wedding guest', 'celebration', 'festive'],
    formality: 5,
    culturalContext: 'ceremonial',
    defaultColors: ['cream', 'gold'],
    defaultFabric: 'silk',
    defaultPattern: 'embroidered',
    confidence: 0.92,
  },
  {
    keywords: ['bandhgala', 'jodhpuri'],
    category: 'Ethnic',
    subcategory: 'bandhgala',
    occasions: ['office', 'wedding guest', 'celebration', 'party'],
    formality: 5,
    culturalContext: 'fusion',
    defaultColors: ['black', 'navy'],
    confidence: 0.90,
  },
  {
    keywords: ['nehru jacket', 'modi jacket', 'bandi'],
    category: 'Ethnic',
    subcategory: 'nehru jacket',
    occasions: ['office', 'family function', 'puja'],
    formality: 4,
    culturalContext: 'traditional',
    defaultColors: ['grey', 'black'],
    confidence: 0.88,
  },
  {
    keywords: ['palazzo'],
    category: 'Ethnic',
    subcategory: 'palazzo',
    occasions: ['college', 'casual outing', 'family function'],
    formality: 3,
    culturalContext: 'contemporary',
    defaultColors: ['cream', 'black'],
    confidence: 0.84,
  },
  {
    keywords: ['salwar', 'churidar', 'pajama', 'pyjama'],
    category: 'Ethnic',
    subcategory: 'churidar',
    occasions: ['college', 'family function', 'puja'],
    formality: 3,
    culturalContext: 'traditional',
    defaultColors: ['white', 'cream'],
    confidence: 0.84,
  },
  {
    keywords: ['dhoti', 'lungi', 'mundu', 'veshti'],
    category: 'Ethnic',
    subcategory: 'dhoti',
    occasions: ['puja', 'family function', 'wedding guest'],
    formality: 4,
    culturalContext: 'traditional',
    defaultColors: ['cream', 'gold'],
    confidence: 0.90,
  },
  {
    keywords: ['dupatta', 'chunni', 'odhni'],
    category: 'Ethnic',
    subcategory: 'dupatta',
    occasions: ['puja', 'family function', 'wedding guest'],
    formality: 4,
    culturalContext: 'traditional',
    defaultColors: ['red', 'gold'],
    confidence: 0.88,
  },
  {
    keywords: ['blouse'],
    category: 'Ethnic',
    subcategory: 'blouse',
    occasions: ['wedding guest', 'family function', 'festive'],
    formality: 4,
    culturalContext: 'traditional',
    defaultColors: ['gold', 'red'],
    confidence: 0.82,
  },

  // Western Garments
  {
    keywords: ['jeans', 'denim', 'jeans pant'],
    category: 'Bottoms',
    subcategory: 'jeans',
    occasions: ['college', 'casual outing', 'travel', 'date'],
    formality: 2,
    culturalContext: 'contemporary',
    defaultColors: ['blue'],
    defaultFabric: 'denim',
    confidence: 0.88,
  },
  {
    keywords: ['trouser', 'trousers', 'chinos', 'pant', 'pants', 'slacks'],
    category: 'Bottoms',
    subcategory: 'trousers',
    occasions: ['office', 'college', 'date'],
    formality: 3,
    culturalContext: 'contemporary',
    defaultColors: ['black', 'beige'],
    confidence: 0.82,
  },
  {
    keywords: ['blazer', 'suit jacket', 'sports jacket'],
    category: 'Outerwear',
    subcategory: 'blazer',
    occasions: ['office', 'party', 'interview', 'date'],
    formality: 4,
    culturalContext: 'contemporary',
    defaultColors: ['navy', 'black'],
    confidence: 0.86,
  },
  {
    keywords: ['jacket', 'bomber', 'overshirt', 'windbreaker'],
    category: 'Outerwear',
    subcategory: 'jacket',
    occasions: ['casual outing', 'travel', 'college'],
    formality: 3,
    culturalContext: 'contemporary',
    defaultColors: ['black', 'olive'],
    confidence: 0.82,
  },
  {
    keywords: ['t-shirt', 't shirt', 'tshirt', 'tee', 'polo'],
    category: 'Tops',
    subcategory: 't-shirt',
    occasions: ['college', 'casual outing', 'everyday'],
    formality: 2,
    culturalContext: 'contemporary',
    defaultColors: ['white'],
    confidence: 0.84,
  },
  {
    keywords: ['shirt', 'button down', 'button up', 'oxford'],
    category: 'Tops',
    subcategory: 'shirt',
    occasions: ['college', 'office', 'date'],
    formality: 3,
    culturalContext: 'contemporary',
    defaultColors: ['white', 'blue'],
    confidence: 0.84,
  },
  {
    keywords: ['crop top', 'croptop'],
    category: 'Tops',
    subcategory: 'crop top',
    occasions: ['casual outing', 'party', 'college'],
    formality: 2,
    culturalContext: 'contemporary',
    defaultColors: ['black'],
    confidence: 0.85,
  },
  {
    keywords: ['dress', 'gown', 'frock'],
    category: 'Dresses',
    subcategory: 'western dress',
    occasions: ['date', 'party', 'casual outing'],
    formality: 3,
    culturalContext: 'contemporary',
    defaultColors: ['black'],
    confidence: 0.82,
  },
  {
    keywords: ['skirt'],
    category: 'Bottoms',
    subcategory: 'skirt',
    occasions: ['college', 'casual outing', 'date'],
    formality: 3,
    culturalContext: 'contemporary',
    defaultColors: ['black'],
    confidence: 0.84,
  },
  {
    keywords: ['shorts'],
    category: 'Bottoms',
    subcategory: 'shorts',
    occasions: ['casual outing', 'travel', 'everyday'],
    formality: 1,
    culturalContext: 'contemporary',
    defaultColors: ['beige'],
    confidence: 0.85,
  },
  {
    keywords: ['hoodie', 'sweatshirt'],
    category: 'Tops',
    subcategory: 'hoodie',
    occasions: ['college', 'casual outing', 'travel'],
    formality: 2,
    culturalContext: 'contemporary',
    defaultColors: ['grey'],
    confidence: 0.86,
  },
  {
    keywords: ['sweater', 'pullover', 'cardigan'],
    category: 'Tops',
    subcategory: 'sweater',
    occasions: ['office', 'college', 'casual outing'],
    formality: 3,
    culturalContext: 'contemporary',
    defaultColors: ['cream'],
    confidence: 0.84,
  },

  // Footwear
  {
    keywords: ['sneakers', 'sneaker', 'kicks', 'trainers'],
    category: 'Footwear',
    subcategory: 'sneakers',
    occasions: ['college', 'casual outing', 'travel'],
    formality: 2,
    culturalContext: 'contemporary',
    defaultColors: ['white'],
    confidence: 0.86,
  },
  {
    keywords: ['jutti', 'juttis', 'mojari', 'kolhapuri'],
    category: 'Footwear',
    subcategory: 'juttis',
    occasions: ['wedding guest', 'Diwali', 'puja', 'festive'],
    formality: 4,
    culturalContext: 'traditional',
    defaultColors: ['gold', 'tan'],
    confidence: 0.88,
  },
  {
    keywords: ['loafers', 'loafer'],
    category: 'Footwear',
    subcategory: 'loafers',
    occasions: ['office', 'date', 'party'],
    formality: 3,
    culturalContext: 'contemporary',
    defaultColors: ['brown'],
    confidence: 0.85,
  },
  {
    keywords: ['heels', 'stilettos', 'pumps'],
    category: 'Footwear',
    subcategory: 'heels',
    occasions: ['party', 'wedding guest', 'date'],
    formality: 4,
    culturalContext: 'contemporary',
    defaultColors: ['black'],
    confidence: 0.86,
  },
  {
    keywords: ['sandals', 'flats', 'slippers'],
    category: 'Footwear',
    subcategory: 'sandals',
    occasions: ['casual outing', 'everyday'],
    formality: 2,
    culturalContext: 'contemporary',
    defaultColors: ['tan'],
    confidence: 0.82,
  },
];

// Fabric detection keywords
const FABRIC_KEYWORDS: { fabric: FabricType; keywords: string[] }[] = [
  { fabric: 'banarasi', keywords: ['banarasi', 'varanasi', 'zari brocade'] },
  { fabric: 'chanderi', keywords: ['chanderi'] },
  { fabric: 'tussar', keywords: ['tussar', 'tassar', 'wild silk'] },
  { fabric: 'mulmul', keywords: ['mulmul', 'muslin', 'malmal'] },
  { fabric: 'khadi', keywords: ['khadi', 'khaddar'] },
  { fabric: 'chiffon', keywords: ['chiffon'] },
  { fabric: 'georgette', keywords: ['georgette'] },
  { fabric: 'velvet', keywords: ['velvet'] },
  { fabric: 'denim', keywords: ['denim', 'jeans cloth'] },
  { fabric: 'silk', keywords: ['silk', 'raw silk', 'pure silk', 'art silk', 'crepe silk'] },
  { fabric: 'linen', keywords: ['linen', 'pure linen', 'irish linen'] },
  { fabric: 'wool', keywords: ['wool', 'woolen', 'cashmere', 'merino'] },
  { fabric: 'cotton', keywords: ['cotton', 'pure cotton', 'cambric'] },
  { fabric: 'modal', keywords: ['modal', 'rayon', 'viscose'] },
  { fabric: 'polyblend', keywords: ['polyblend', 'polyester', 'synthetic'] },
];

// Pattern detection keywords
const PATTERN_KEYWORDS: { pattern: PatternType; keywords: string[] }[] = [
  { pattern: 'chikankari', keywords: ['chikankari', 'chikan', 'lucknowi'] },
  { pattern: 'bandhani', keywords: ['bandhani', 'bandhej', 'tie dye', 'tie-dye'] },
  { pattern: 'ikat', keywords: ['ikat', 'ikkat', 'pochampally', 'patola'] },
  { pattern: 'kalamkari', keywords: ['kalamkari'] },
  { pattern: 'zari_brocade', keywords: ['zari', 'brocade', 'gota patti', 'gota'] },
  { pattern: 'embroidered', keywords: ['embroidered', 'embroidery', 'zardozi', 'aari', 'phulkari'] },
  { pattern: 'block_print', keywords: ['block print', 'ajrakh', 'bagru', 'sanganeri', 'dabu', 'print'] },
  { pattern: 'floral', keywords: ['floral', 'flower', 'botanical'] },
  { pattern: 'striped', keywords: ['striped', 'stripes', 'pinstripe'] },
  { pattern: 'checked', keywords: ['checked', 'check', 'plaid', 'tartan', 'gingham'] },
  { pattern: 'polka_dot', keywords: ['polka dot', 'polka', 'dots'] },
  { pattern: 'geometric', keywords: ['geometric', 'chevron', 'houndstooth'] },
  { pattern: 'abstract', keywords: ['abstract'] },
  { pattern: 'solid', keywords: ['solid', 'plain', 'monochrome'] },
];

// Color keywords
const KNOWN_COLORS = [
  'black', 'white', 'grey', 'gray', 'charcoal', 'cream', 'ivory', 'beige',
  'tan', 'khaki', 'brown', 'rust', 'terracotta', 'ochre', 'camel', 'copper',
  'navy', 'blue', 'indigo', 'sky_blue', 'teal', 'cyan', 'turquoise',
  'emerald', 'green', 'olive', 'mint', 'sage', 'forest_green',
  'red', 'crimson', 'maroon', 'scarlet', 'coral', 'pink', 'rose', 'fuchsia', 'magenta',
  'yellow', 'mustard', 'orange', 'tangerine', 'peach', 'amber',
  'purple', 'violet', 'lavender', 'plum', 'mauve',
  'gold', 'silver', 'bronze',
];

// ============================================================================
// CLIENT-SIDE IMAGE FEATURE EXTRACTOR
// ============================================================================

/**
 * Extracts structured features honestly from client-side inputs.
 *
 * Rules:
 * 1. ZERO hallucination: If image name/path is generic and no label is provided,
 *    assign low confidence (< 0.25), mark needsUserConfirmation: true, and
 *    status: 'unknown'.
 * 2. Never invent material percentages (e.g. 100% Cotton).
 * 3. Never assign fake viewing angles.
 * 4. Separate silhouette from body ease/fit.
 * 5. Track comprehensive attribute-level provenance.
 */
export async function extractGarmentFeaturesFromImage(
  input: File | Blob | string | { name?: string; path?: string }
): Promise<ImageFeatureExtractionResult> {
  let fileName = '';
  if (typeof input === 'string') {
    fileName = input.split('/').pop()?.split('\\').pop() || input;
  } else if ('name' in input && typeof input.name === 'string') {
    fileName = input.name;
  } else if ('path' in input && typeof input.path === 'string') {
    fileName = input.path.split('/').pop()?.split('\\').pop() || input.path;
  }

  const cleanName = fileName.toLowerCase().replace(/[_-]/g, ' ');
  const ambiguityReasons: string[] = [];

  // Check 1: Multi-garment / flatlay detection
  let isMultiGarment = false;
  for (const kw of MULTI_GARMENT_KEYWORDS) {
    if (new RegExp(`\\b${kw}\\b`, 'i').test(cleanName)) {
      isMultiGarment = true;
      ambiguityReasons.push(`Multiple coordinating garments or flatlay ensemble detected ("${kw}")`);
      break;
    }
  }

  // Check 2: Color extraction from text
  const detectedColors: string[] = [];
  for (const color of KNOWN_COLORS) {
    const formatted = color.replace(/_/g, ' ');
    if (new RegExp(`\\b${formatted}\\b`, 'i').test(cleanName)) {
      detectedColors.push(color);
    }
  }

  // Check 3: Fabric detection
  let detectedFabric: FabricType | undefined;
  for (const { fabric, keywords } of FABRIC_KEYWORDS) {
    if (keywords.some((kw) => new RegExp(`\\b${kw}\\b`, 'i').test(cleanName))) {
      detectedFabric = fabric;
      break;
    }
  }

  // Check 4: Pattern detection
  let detectedPattern: PatternType | undefined;
  for (const { pattern, keywords } of PATTERN_KEYWORDS) {
    if (keywords.some((kw) => new RegExp(`\\b${kw}\\b`, 'i').test(cleanName))) {
      detectedPattern = pattern;
      break;
    }
  }

  // Check 5: Garment classification
  let matchedRule: GarmentRule | undefined;
  for (const rule of GARMENT_RULES) {
    if (
      rule.keywords.some((kw) => {
        if (kw === 'shirt' && /\bt\s+shirt\b/i.test(cleanName)) return false;
        return new RegExp(`\\b${kw}\\b`, 'i').test(cleanName);
      })
    ) {
      matchedRule = rule;
      break;
    }
  }

  // Check 6: Generic camera file check
  const baseFile = fileName.replace(/\.[^/.]+$/, '').trim();
  const isGeneric = GENERIC_CAMERA_FILE_REGEX.test(baseFile) || baseFile.length < 3;

  if (isGeneric && !matchedRule) {
    ambiguityReasons.push('Generic camera filename with no identifiable fashion keywords');
  }

  // Fallback defaults when ambiguous
  const category: Category = matchedRule ? matchedRule.category : 'Tops';
  const subcategory: Subcategory | undefined = matchedRule ? matchedRule.subcategory : (isGeneric ? 't-shirt' : undefined);
  const occasions: Occasion[] = matchedRule ? matchedRule.occasions : ['casual outing'];
  const formality = matchedRule ? matchedRule.formality : 2;
  const culturalContext: CulturalContext = matchedRule ? matchedRule.culturalContext : 'contemporary';

  // Resolved Colors
  const colors = detectedColors.length > 0
    ? detectedColors
    : (matchedRule?.defaultColors || ['white']);

  const colorIntel = extractColorIntelligence(colors, detectedPattern);

  // Structural & Fabric Properties
  const classification = getGarmentClassification(subcategory || 't-shirt', category);
  const fabricProps = getFabricMaterialProperties(detectedFabric);

  // Disentangled Style Attributes
  const styleAttrs = getDisentangledStyleAttributes(
    subcategory,
    category,
    'regular',
    detectedFabric,
    detectedPattern,
    cleanName
  );

  // Confidence & Verification Calibration
  let overallConfidence: number;
  let confidenceLevel: ConfidenceLevel;
  let needsUserConfirmation = false;
  let fabricVerificationStatus: AttributeVerificationStatus;

  if (isGeneric && !matchedRule && detectedColors.length === 0 && !detectedFabric) {
    // True unlabelled ambiguous photo
    overallConfidence = 0.20;
    confidenceLevel = 'LOW';
    needsUserConfirmation = true;
    fabricVerificationStatus = 'unknown';
  } else if (!matchedRule) {
    overallConfidence = 0.50;
    confidenceLevel = 'MEDIUM';
    needsUserConfirmation = true;
    fabricVerificationStatus = detectedFabric ? 'inferred' : 'unknown';
  } else {
    // Matched identifiable fashion keywords
    let conf = matchedRule.confidence;
    if (detectedFabric) conf = Math.min(0.95, conf + 0.05);
    if (detectedPattern) conf = Math.min(0.95, conf + 0.04);
    if (isMultiGarment) conf = Math.max(0.60, conf - 0.20);

    overallConfidence = Math.round(conf * 100) / 100;
    confidenceLevel = overallConfidence >= 0.8 ? 'HIGH' : overallConfidence >= 0.6 ? 'MEDIUM' : 'LOW';
    fabricVerificationStatus = detectedFabric ? 'inferred' : 'unknown';
    if (isMultiGarment) {
      needsUserConfirmation = true;
    }
  }

  // Construct Attribute Provenance Records
  const attributeProvenance: Record<string, AttributeProvenanceRecord> = {
    category: createAttributeProvenanceRecord(
      matchedRule ? 'inferred' : 'unknown',
      matchedRule ? matchedRule.confidence : 0.20,
      matchedRule ? `Inferred from keyword match` : 'Ambiguous input fallback'
    ),
    subcategory: createAttributeProvenanceRecord(
      matchedRule ? 'inferred' : 'unknown',
      matchedRule ? matchedRule.confidence : 0.20
    ),
    colors: createAttributeProvenanceRecord(
      detectedColors.length > 0 ? 'image_detected' : 'unknown',
      detectedColors.length > 0 ? 0.85 : 0.20
    ),
    fabric: createAttributeProvenanceRecord(
      detectedFabric ? 'inferred' : 'unknown',
      detectedFabric ? 0.85 : 0.0,
      detectedFabric ? `Textile match from label/name` : 'Unverified fabric'
    ),
    pattern: createAttributeProvenanceRecord(
      detectedPattern ? 'inferred' : 'unknown',
      detectedPattern ? 0.80 : 0.0
    ),
    silhouette: createAttributeProvenanceRecord(
      matchedRule ? 'inferred' : 'unknown',
      matchedRule ? 0.80 : 0.20
    ),
  };

  const note = needsUserConfirmation
    ? 'Suggested by AI. Tap any detail to verify or refine.'
    : 'Identified with high confidence. Tap to adjust if needed.';

  return {
    category,
    subcategory,
    colors,
    primaryColor: colorIntel.primaryColor,
    secondaryColor: colorIntel.secondaryColor,
    accentColors: colorIntel.accentColors,
    colorFamily: colorIntel.colorFamily,
    colorTone: colorIntel.colorTone,
    colorConfidence: colorIntel.colorConfidence,
    patternRelatedColorAmbiguity: colorIntel.patternRelatedColorAmbiguity,

    garmentType: classification.garmentType,
    sleeveType: classification.sleeveType,
    neckline: classification.neckline,
    length: classification.length,
    layeringRole: classification.layeringRole,

    fabric: detectedFabric,
    fabricTexture: fabricProps.texture,
    fabricWeight: fabricProps.weight,
    breathability: fabricProps.breathability,
    materialComposition: fabricProps.genericComposition,
    fabricVerificationStatus,

    pattern: detectedPattern,
    fit: 'regular',
    silhouette: styleAttrs.silhouette,
    fitType: styleAttrs.fitType,
    culturalContext,
    styleFamily: styleAttrs.styleFamily,
    regionalTradition: styleAttrs.regionalTradition,

    occasions,
    formality,

    overallConfidence,
    confidenceLevel,
    isMultiGarmentOrFlatlay: isMultiGarment,
    needsUserConfirmation,
    ambiguityReasons,
    note,

    attributeProvenance,
  };
}
