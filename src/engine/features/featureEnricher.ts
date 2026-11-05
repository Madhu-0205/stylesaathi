import {
  WardrobeItem,
  AttributeAffinity,
  AttributeVerificationStatus,
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
// WARDROBE FEATURE ENRICHER
// ============================================================================

/**
 * Checks whether an attribute value is known and verified/valid.
 * Unknown, undefined, or empty values are treated as missing data.
 */
export function isAttributeKnown(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return false;
  if (typeof value === 'string' && value.toLowerCase() === 'unknown') return false;
  return true;
}

/**
 * Enriches a WardrobeItem with StyleSaathi 3.0 rich attribute intelligence.
 * Backward-compatible: Preserves all existing fields and honors user-verified data.
 *
 * Rules:
 * 1. User verification is inviolable: If userVerified is true, source is 'user_confirmed' (conf: 1.0).
 * 2. Missing data is never penalized or assigned fake values: unknown attributes get confidence 0.0.
 * 3. Disentangles silhouette cut from body ease/fit.
 */
export function enrichWardrobeItem(item: WardrobeItem): WardrobeItem {
  const isUserConfirmed = item.userVerified === true || item.provenance?.classification?.source === 'user';
  const baseAiConfidence = typeof item.aiConfidence === 'number' ? item.aiConfidence : 0.70;

  // 1. Color Intelligence
  const colors = item.colors && item.colors.length > 0 ? item.colors : ['unknown'];
  const colorIntel = extractColorIntelligence(colors, item.pattern);

  // 2. Garment Structural Anatomy
  const classification = getGarmentClassification(item.subcategory || '', item.category);

  // 3. Fabric Properties
  const isFabricKnown = isAttributeKnown(item.fabric);
  const fabricProps = getFabricMaterialProperties(item.fabric);
  const fabricVerificationStatus: AttributeVerificationStatus = isFabricKnown
    ? isUserConfirmed
      ? 'user_confirmed'
      : 'inferred'
    : 'unknown';

  // 4. Disentangled Style Attributes (Silhouette vs Fit)
  const styleAttrs = getDisentangledStyleAttributes(
    item.subcategory,
    item.category,
    item.fit,
    item.fabric,
    item.pattern,
    item.name
  );

  // 5. Construct Granular Attribute Provenance
  const attributeProvenance: Record<string, AttributeProvenanceRecord> = {
    ...(item.attributeProvenance || {}),
  };

  const getSource = (known: boolean): AttributeVerificationStatus => {
    if (!known) return 'unknown';
    if (isUserConfirmed) return 'user_confirmed';
    return 'inferred';
  };

  const getConf = (known: boolean): number => {
    if (!known) return 0.0;
    if (isUserConfirmed) return 1.0;
    return baseAiConfidence;
  };

  if (!attributeProvenance.category) {
    attributeProvenance.category = createAttributeProvenanceRecord(
      getSource(isAttributeKnown(item.category)),
      getConf(isAttributeKnown(item.category)),
      isUserConfirmed ? 'User confirmed category' : 'Initial assignment'
    );
  }

  if (!attributeProvenance.fabric) {
    attributeProvenance.fabric = createAttributeProvenanceRecord(
      getSource(isFabricKnown),
      getConf(isFabricKnown),
      isFabricKnown
        ? (isUserConfirmed ? 'User verified textile' : fabricProps.genericComposition)
        : 'Unverified / unknown fabric composition'
    );
  }

  if (!attributeProvenance.pattern) {
    const isPatternKnown = isAttributeKnown(item.pattern);
    attributeProvenance.pattern = createAttributeProvenanceRecord(
      getSource(isPatternKnown),
      getConf(isPatternKnown)
    );
  }

  if (!attributeProvenance.silhouette) {
    attributeProvenance.silhouette = createAttributeProvenanceRecord(
      getSource(isAttributeKnown(styleAttrs.silhouette)),
      getConf(isAttributeKnown(styleAttrs.silhouette))
    );
  }

  if (!attributeProvenance.fitType) {
    attributeProvenance.fitType = createAttributeProvenanceRecord(
      getSource(isAttributeKnown(styleAttrs.fitType)),
      getConf(isAttributeKnown(styleAttrs.fitType))
    );
  }

  return {
    ...item,

    // Color Intelligence
    primaryColor: item.primaryColor ?? colorIntel.primaryColor,
    secondaryColor: item.secondaryColor ?? colorIntel.secondaryColor,
    accentColors: item.accentColors ?? colorIntel.accentColors,
    colorFamily: item.colorFamily ?? colorIntel.colorFamily,
    colorTone: item.colorTone ?? colorIntel.colorTone,
    colorConfidence: item.colorConfidence ?? colorIntel.colorConfidence,
    patternRelatedColorAmbiguity:
      item.patternRelatedColorAmbiguity ?? colorIntel.patternRelatedColorAmbiguity,

    // Garment Classification
    garmentType: item.garmentType ?? classification.garmentType,
    sleeveType: item.sleeveType ?? classification.sleeveType,
    neckline: item.neckline ?? classification.neckline,
    length: item.length ?? classification.length,
    layeringRole: item.layeringRole ?? classification.layeringRole,

    // Fabric Properties
    materialComposition: item.materialComposition ?? fabricProps.genericComposition,
    texture: item.texture ?? fabricProps.texture,
    weight: item.weight ?? fabricProps.weight,
    breathability: item.breathability ?? fabricProps.breathability,
    fabricVerificationStatus: item.fabricVerificationStatus ?? fabricVerificationStatus,

    // Disentangled Style Attributes
    silhouette: item.silhouette ?? styleAttrs.silhouette,
    fitType: item.fitType ?? styleAttrs.fitType,
    styleFamily: item.styleFamily ?? styleAttrs.styleFamily,
    regionalTradition: item.regionalTradition ?? styleAttrs.regionalTradition,

    // Provenance Tracking
    attributeProvenance,
  };
}

/**
 * Batch-enriches a collection of wardrobe items.
 */
export function enrichWardrobe(items: WardrobeItem[]): WardrobeItem[] {
  return items.map((item) => enrichWardrobeItem(item));
}

/**
 * Computes attribute score contribution for recommendation scoring.
 * Strict neutral handling: If an attribute is unknown or missing, returns 0.0.
 * Missing data is NEVER penalized as incompatible.
 */
export function getEnrichedAttributeScoreDelta(
  item: WardrobeItem,
  dimension: 'color' | 'fabric' | 'pattern' | 'silhouette' | 'fitType' | 'styleFamily',
  affinity?: AttributeAffinity
): number {
  if (!affinity || affinity.status === 'unknown' || affinity.confidence <= 0.1) {
    return 0.0;
  }

  let value: unknown;
  switch (dimension) {
    case 'color':
      value = item.primaryColor;
      break;
    case 'fabric':
      value = item.fabric;
      break;
    case 'pattern':
      value = item.pattern;
      break;
    case 'silhouette':
      value = item.silhouette;
      break;
    case 'fitType':
      value = item.fitType;
      break;
    case 'styleFamily':
      value = item.styleFamily;
      break;
  }

  if (!isAttributeKnown(value)) {
    // Missing / unknown data receives perfectly neutral delta
    return 0.0;
  }

  return Math.round(affinity.score * affinity.confidence * 100) / 100;
}

