import {
  Category,
  Subcategory,
  Occasion,
  FabricType,
  PatternType,
  SilhouetteFit,
  CulturalContext,
  ConfidenceLevel,
  SilhouetteType,
  FitType,
  StyleFamily,
  AttributeProvenanceRecord,
} from '../types';

import { extractGarmentFeaturesFromImage } from '../engine/features/imageFeatureExtractor';

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

  // StyleSaathi 3.0 Rich Feature Intelligence
  silhouette?: SilhouetteType;
  fitType?: FitType;
  styleFamily?: StyleFamily;
  regionalTradition?: string;
  materialComposition?: string;
  isMultiGarmentOrFlatlay?: boolean;
  needsUserConfirmation?: boolean;
  attributeProvenance?: Record<string, AttributeProvenanceRecord>;
}

/**
 * Honest, calibrated client-side feature detection seam.
 *
 * Rules:
 * 1. Zero hallucinations: Generic/ambiguous photos without keywords receive low confidence (< 0.25)
 *    and prompt user confirmation rather than inventing fabric types or silhouettes.
 * 2. High accuracy on verified domain keywords (e.g. Indian traditional garments, craft traditions).
 * 3. Never claims lab-certified fabric compositions.
 * 4. User verification is preserved: auto-detected attributes are presented as editable suggestions.
 */
export async function autoTagImage(file: File): Promise<AutoTagResult> {
  const result = await extractGarmentFeaturesFromImage(file);

  return {
    category: result.category,
    subcategory: result.subcategory,
    colors: result.colors,
    style: result.subcategory || result.garmentType,
    occasions: result.occasions,
    formality: result.formality,
    fabric: result.fabric,
    pattern: result.pattern,
    fit: result.fit,
    culturalContext: result.culturalContext,
    confidence: result.overallConfidence,
    confidenceLevel: result.confidenceLevel,
    note: result.note,

    // StyleSaathi 3.0 Rich Garment Attributes
    silhouette: result.silhouette,
    fitType: result.fitType,
    styleFamily: result.styleFamily,
    regionalTradition: result.regionalTradition,
    materialComposition: result.materialComposition,
    isMultiGarmentOrFlatlay: result.isMultiGarmentOrFlatlay,
    needsUserConfirmation: result.needsUserConfirmation,
    attributeProvenance: result.attributeProvenance,
  };
}
