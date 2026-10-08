import {
  Category,
  Subcategory,
  Occasion,
  FabricType,
  PatternType,
  SilhouetteFit,
  CulturalContext,
  ConfidenceLevel,
} from '../types';

export interface AutoTagResult {
  category: Category;
  subcategory?: Subcategory;
  colors: string[];
  style?: string;
  occasions: Occasion[];
  formality: number;
  fabric?: FabricType;
  pattern?: PatternType;
  fit?: SilhouetteFit;
  culturalContext?: CulturalContext;
  confidence?: number;
  confidenceLevel?: ConfidenceLevel;
  note?: string;
}

/**
 * Seam for integrating multimodal vision models (e.g. Google Cloud Vision, Gemini Vision, or on-device ViT).
 *
 * Extracts structured fashion candidate attributes with explicit confidence semantics.
 * USER VERIFICATION IS PRESERVED: Auto-detected attributes are presented as editable suggestions,
 * and user edits permanently override AI estimates.
 */
export async function autoTagImage(file: File): Promise<AutoTagResult> {
  const fn = file.name.toLowerCase();

  let category: Category = 'Tops';
  let subcategory: Subcategory = 't-shirt';
  let colors: string[] = ['white'];
  let occasions: Occasion[] = ['college', 'casual outing'];
  let formality = 2;
  let fabric: FabricType = 'cotton';
  let pattern: PatternType = 'solid';
  let fit: SilhouetteFit = 'regular';
  let culturalContext: CulturalContext = 'contemporary';
  let confidence = 0.65;
  let confidenceLevel: ConfidenceLevel = 'MEDIUM';

  // 1. Category and garment silhouette heuristics
  if (fn.includes('kurta') || fn.includes('kurti')) {
    category = 'Ethnic';
    subcategory = fn.includes('kurti') ? 'kurti' : 'kurta';
    occasions = ['college', 'family function', 'puja'];
    formality = 3;
    colors = ['white', 'cream'];
    fabric = fn.includes('silk') ? 'silk' : fn.includes('linen') ? 'linen' : 'cotton';
    fit = 'straight';
    culturalContext = 'traditional';
    confidence = 0.85;
  } else if (fn.includes('saree')) {
    category = 'Ethnic';
    subcategory = 'saree';
    occasions = ['wedding guest', 'Diwali', 'party'];
    formality = 5;
    colors = ['black', 'gold'];
    fabric = fn.includes('chiffon') ? 'chiffon' : fn.includes('banarasi') ? 'banarasi' : 'silk';
    pattern = fn.includes('zari') ? 'zari_brocade' : 'solid';
    culturalContext = 'ceremonial';
    confidence = 0.88;
  } else if (fn.includes('lehenga')) {
    category = 'Ethnic';
    subcategory = 'lehenga';
    occasions = ['wedding guest', 'Diwali'];
    formality = 5;
    colors = ['navy', 'pink'];
    fabric = 'silk';
    pattern = 'embroidered';
    fit = 'flared';
    culturalContext = 'ceremonial';
    confidence = 0.85;
  } else if (fn.includes('palazzo') || fn.includes('churidar')) {
    category = 'Ethnic';
    subcategory = fn.includes('palazzo') ? 'palazzo' : 'churidar';
    occasions = ['college', 'family function', 'puja'];
    formality = 3;
    colors = ['cream', 'beige'];
    fabric = 'cotton';
    fit = fn.includes('palazzo') ? 'flared' : 'slim';
    culturalContext = 'traditional';
    confidence = 0.82;
  } else if (fn.includes('jean') || fn.includes('denim')) {
    category = 'Bottoms';
    subcategory = 'jeans';
    occasions = ['college', 'casual outing', 'date', 'travel'];
    formality = 2;
    colors = ['blue'];
    fabric = 'denim';
    fit = 'straight';
    culturalContext = 'contemporary';
    confidence = 0.88;
  } else if (fn.includes('trouser') || fn.includes('pant')) {
    category = 'Bottoms';
    subcategory = 'trousers';
    occasions = ['office', 'college', 'date'];
    formality = 3;
    colors = ['black', 'beige'];
    fabric = 'cotton';
    fit = 'tailored';
    culturalContext = 'contemporary';
    confidence = 0.82;
  } else if (fn.includes('dress')) {
    category = 'Dresses';
    subcategory = 'western dress';
    occasions = ['date', 'party', 'casual outing'];
    formality = 3;
    colors = ['black'];
    fit = 'a_line';
    culturalContext = 'contemporary';
    confidence = 0.80;
  } else if (fn.includes('jacket') || fn.includes('blazer')) {
    category = 'Outerwear';
    subcategory = fn.includes('blazer') ? 'blazer' : 'jacket';
    occasions = ['office', 'party', 'date'];
    formality = 4;
    colors = ['black', 'blue'];
    fit = 'structured' as any;
    culturalContext = 'contemporary';
    confidence = 0.85;
  } else if (fn.includes('sneaker') || fn.includes('shoe')) {
    category = 'Footwear';
    subcategory = 'sneakers';
    occasions = ['college', 'casual outing', 'travel'];
    formality = 2;
    colors = ['white'];
    confidence = 0.85;
  } else if (fn.includes('jutti') || fn.includes('kolhapuri')) {
    category = 'Footwear';
    subcategory = 'juttis';
    occasions = ['wedding guest', 'Diwali', 'puja'];
    formality = 4;
    colors = ['mustard', 'gold'];
    culturalContext = 'traditional';
    confidence = 0.88;
  } else if (fn.includes('shirt')) {
    category = 'Tops';
    subcategory = 'shirt';
    occasions = ['college', 'office', 'date'];
    formality = 3;
    colors = ['blue', 'white'];
    fabric = fn.includes('linen') ? 'linen' : 'cotton';
    fit = 'regular';
    culturalContext = 'contemporary';
    confidence = 0.82;
  }

  // 2. Fabric detection refinements from filename
  if (fn.includes('linen')) fabric = 'linen';
  else if (fn.includes('khadi')) fabric = 'khadi';
  else if (fn.includes('mulmul')) fabric = 'mulmul';
  else if (fn.includes('silk')) fabric = 'silk';
  else if (fn.includes('chiffon')) fabric = 'chiffon';
  else if (fn.includes('georgette')) fabric = 'georgette';
  else if (fn.includes('velvet')) fabric = 'velvet';
  else if (fn.includes('wool')) fabric = 'wool';

  // 3. Pattern detection refinements
  if (fn.includes('stripe')) pattern = 'striped';
  else if (fn.includes('check')) pattern = 'checked';
  else if (fn.includes('floral')) pattern = 'floral';
  else if (fn.includes('ikat')) pattern = 'ikat';
  else if (fn.includes('bandhani')) pattern = 'bandhani';
  else if (fn.includes('chikankari')) pattern = 'chikankari';
  else if (fn.includes('embroider')) pattern = 'embroidered';
  else if (fn.includes('print')) pattern = 'block_print';

  // Confidence level banding
  if (confidence >= 0.8) {
    confidenceLevel = 'HIGH';
  } else if (confidence >= 0.6) {
    confidenceLevel = 'MEDIUM';
  } else {
    confidenceLevel = 'LOW';
  }

  return {
    category,
    subcategory,
    colors,
    style: subcategory,
    occasions,
    formality,
    fabric,
    pattern,
    fit,
    culturalContext,
    confidence,
    confidenceLevel,
    note: 'Suggested by AI. Tap any detail to verify or refine.',
  };
}
