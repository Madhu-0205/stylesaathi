import {
  WardrobeItem,
  Occasion,
  Season,
  ContextSnapshot,
  StylePreferences,
  PersonalStyleProfile,
} from '../../types';

// ============================================================================
// 1. PAIR CLASSIFICATION TYPES
// ============================================================================

export type GarmentPairType =
  | 'top_bottom'
  | 'top_outerwear'
  | 'bottom_outerwear'
  | 'dress_outerwear'
  | 'bottom_footwear'
  | 'top_footwear'
  | 'ethnic_drape_base'
  | 'accessory_garment'
  | 'structural_duplicate_conflict'
  | 'unclassified_pair';

// ============================================================================
// 2. COMPATIBILITY DIMENSIONS
// ============================================================================

export type CompatibilityDimension =
  | 'category_relationship'
  | 'color_harmony'
  | 'silhouette_proportion'
  | 'fabric_texture'
  | 'pattern_interaction'
  | 'formality_alignment'
  | 'cultural_synergy'
  | 'weather_season_alignment';

export type DimensionEvidenceSource =
  | 'rule_engine'
  | 'cultural_ontology'
  | 'fabric_physics'
  | 'user_profile'
  | 'context_weather'
  | 'unknown';

export interface DimensionEvaluation {
  dimension: CompatibilityDimension;
  applied: boolean;
  score: number; // -1.0 to +1.0 normalized scale
  confidence: number; // 0.0 to 1.0 evidence certainty
  weight: number; // relative weight in overall aggregation
  reason: string;
  evidenceSource: DimensionEvidenceSource;
}

// ============================================================================
// 3. HARD INCOMPATIBILITY & CONSTRAINTS
// ============================================================================

export type HardViolationType =
  | 'duplicate_item'
  | 'conflicting_base_layer'
  | 'unwearable_status'
  | 'severe_weather_hazard'
  | 'user_fabric_sensitivity'
  | 'teen_safety_violation';

export interface HardIncompatibilityResult {
  isIncompatible: boolean;
  violationType?: HardViolationType;
  reason?: string;
}

// ============================================================================
// 4. OVERALL COMPATIBILITY RESULT & VERDICTS
// ============================================================================

export type CompatibilityClassification =
  | 'highly_compatible'
  | 'compatible'
  | 'neutral'
  | 'clashing'
  | 'hard_incompatible';

export interface CulturalSynergyContext {
  tradition?: string;
  synergyType:
    | 'traditional_ensemble'
    | 'indo_western_fusion'
    | 'cross_cultural_inspiration'
    | 'neutral_universal';
  explanation: string;
}

export interface PersonalizationAdjustment {
  delta: number; // Soft score adjustment between -1.5 and +1.5
  reasons: string[];
}

export interface PairwiseCompatibilityResult {
  itemAId: string;
  itemBId: string;
  pairType: GarmentPairType;
  isHardIncompatible: boolean;
  hardIncompatibilityReason?: string;
  overallScore: number; // 0.0 to 10.0 scale for intuitive user representation
  normalizedScore: number; // -1.0 to +1.0 for mathematical aggregations
  classification: CompatibilityClassification;
  confidence: number; // 0.0 to 1.0 aggregate confidence
  activeDimensions: DimensionEvaluation[];
  culturalContext?: CulturalSynergyContext;
  personalizationAdjustment?: PersonalizationAdjustment;
  explanations: string[];
  uncertaintyNotes: string[];
  needsUserConfirmation: boolean;
}

// ============================================================================
// 5. EVALUATION DATASET TYPES
// ============================================================================

export type PairwiseEvaluationCategory =
  | 'traditional_indian'
  | 'western'
  | 'korean_japanese'
  | 'indo_western'
  | 'color_harmony_clash'
  | 'pattern_interaction'
  | 'fabric_physics'
  | 'missing_metadata'
  | 'user_preference_conflict'
  | 'context_dependent';

export interface PairwiseEvaluationCase {
  id: string;
  name: string;
  itemA: WardrobeItem;
  itemB: WardrobeItem;
  occasion?: Occasion;
  season?: Season;
  context?: ContextSnapshot;
  preferences?: StylePreferences;
  styleProfile?: PersonalStyleProfile;
  expectedResult: 'compatible' | 'incompatible' | 'neutral';
  expectedPairType?: GarmentPairType;
  expectedHardIncompatible?: boolean;
  category: PairwiseEvaluationCategory;
  notes: string;
}
