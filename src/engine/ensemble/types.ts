import {
  WardrobeItem,
  Occasion,
  Season,
  ContextSnapshot,
  StylePreferences,
  PersonalStyleProfile,
  CulturalContextSignals,
  OutfitSlotRole,
  RecommendedOutfit,
  RecommendationPipelineTelemetry,
} from '../../types';
import { GarmentPairType, PairwiseCompatibilityResult } from '../pairwise/types';

// ============================================================================
// 1. ENSEMBLE GRAPH TYPES
// ============================================================================

export interface EnsembleNode {
  id: string;
  item: WardrobeItem;
  role: OutfitSlotRole;
  isAnchor: boolean;
  status: WardrobeItem['status'];
  formality: number;
  colors: string[];
  fabric?: string;
  pattern?: string;
  fit?: string;
  uncertaintyNotes: string[];
  needsUserConfirmation: boolean;
}

export interface EnsembleEdge {
  sourceId: string;
  targetId: string;
  pairType: GarmentPairType;
  roleWeight: number;
  pairwiseResult: PairwiseCompatibilityResult;
  score: number; // 0.0 - 10.0 scale
  isHardIncompatible: boolean;
  clashReason?: string;
  explanations: string[];
}

export interface EnsembleGraph {
  outfitId: string;
  nodes: EnsembleNode[];
  edges: EnsembleEdge[];
  nodeCount: number;
  edgeCount: number;
  density: number;
  averagePairwiseScore: number;
  weightedPairwiseScore: number;
  minimumPairwiseScore: number;
  hasHardIncompatibility: boolean;
  hardIncompatibilityReasons: string[];
  weakestEdge?: EnsembleEdge;
  strongestEdge?: EnsembleEdge;
}

// ============================================================================
// 2. WHOLE-OUTFIT EVALUATION DIMENSIONS (A through J)
// ============================================================================

export interface OutfitEvaluationBreakdown {
  individualSuitability: number;     // A. Weather/season comfort per garment
  pairwiseEdgeAggregation: number;   // B. Role-weighted edges & weakest link
  colorBalance: number;              // C. Whole-outfit color palette harmony & grounding
  patternTextureDistribution: number;// D. Rule of one statement & tactile contrast
  silhouetteProportionBalance: number;// E. Volume equilibrium & Korean relaxed exception
  formalityConsistency: number;      // F. Dispersion spread & occasion target alignment
  climateSeasonalFit: number;        // G. Seasonal breathability / thermal / precipitation
  culturalRegionalContext: number;   // H. Authentic traditional, puja decorum, fusion bridge
  personalStyleFit: number;          // I. Bayesian profile soft boost (dampened)
  wardrobeConditionRotation: number; // J. Recency wear penalty & novelty boost
  totalScore: number;                // Final calibrated score (0.0 - 10.0)
  penaltiesApplied: string[];
  bonusesApplied: string[];
}

export type EnsembleClassification =
  | 'highly_compatible'
  | 'compatible'
  | 'neutral'
  | 'clashing'
  | 'hard_incompatible';

export interface OutfitEvaluationResult {
  outfitId: string;
  isValid: boolean;
  classification: EnsembleClassification;
  score: number; // 0.0 to 10.0 scale
  breakdown: OutfitEvaluationBreakdown;
  graph: EnsembleGraph;
  explanations: string[];
  uncertaintyNotes: string[];
  needsUserConfirmation: boolean;
}

// ============================================================================
// 3. CANDIDATE GENERATION & ANCHOR MANAGEMENT
// ============================================================================

export interface AnchorState {
  item: WardrobeItem;
  role: OutfitSlotRole;
  isLocked: boolean;
  origin: 'user_selected' | 'auto_selected';
}

export interface CandidateGenerationOptions {
  anchor?: AnchorState;
  occasion: Occasion;
  season: Season;
  context?: ContextSnapshot;
  preferences?: StylePreferences;
  styleProfile?: PersonalStyleProfile;
  culturalSignals?: CulturalContextSignals;
  allowPlanningMode?: boolean;
  maxCandidates?: number;
  perTemplateBudget?: number;
}

// ============================================================================
// 4. RECOMMENDATION & COMPARISON
// ============================================================================

export interface EnsembleRecommendationOptions extends CandidateGenerationOptions {
  items: WardrobeItem[];
  localDate: string;
  limit?: number;
  diversityThreshold?: number;
  explorationSeedOffset?: number;
  compareWithBaseline?: boolean;
}

export interface RecommendationComparisonTelemetry {
  baselineTopScore: number;
  ensembleTopScore: number;
  scoreDelta: number;
  hardConstraintViolationsPrevented: number;
  weakestEdgeClashesCaught: number;
  colorChaosPrevented: number;
  formalitySpreadViolationsPrevented: number;
  diversityDistance: number;
}

export interface EnsembleRecommendationResult {
  outfits: RecommendedOutfit[];
  evaluations: Record<string, OutfitEvaluationResult>;
  telemetry: RecommendationPipelineTelemetry;
  comparisonTelemetry?: RecommendationComparisonTelemetry;
  allRankedCandidates?: {
    candidate: any;
    evaluation: OutfitEvaluationResult;
    graph: EnsembleGraph;
  }[];
}

// ============================================================================
// 5. PHASE 5A: SHADOW COMPARISON TYPES
// ============================================================================

export interface ShadowCandidateOverlap {
  baselineCount: number;
  ensembleCount: number;
  sharedTopCandidateIds: string[];
  topPickJaccardOverlap: number; // 0.0 - 1.0 (garment-level intersection over union)
  baselineTopInEnsembleRank?: number; // 1-based rank or -1 if not in ensemble pool
  ensembleTopInBaselineRank?: number; // 1-based rank or -1 if not in baseline pool
}

export interface ShadowRankingDifferences {
  baselineTopScore: number;
  ensembleTopScore: number;
  scoreDelta: number; // ensembleTopScore - baselineTopScore
  rankInversionsCount: number;
  explanation: string;
}

export interface ShadowAnchorPreservation {
  anchorItemId?: string;
  baselinePreserved: boolean;
  ensemblePreserved: boolean;
  isConsistent: boolean;
}

export interface ShadowHardConstraintViolations {
  baselineViolationsDetectedByEnsemble: string[];
  ensembleViolationsDetected: string[];
  weakestEdgeClashesCaught: number;
  formalitySpreadViolationsPrevented: number;
}

export interface ShadowUnknownAttributeHandling {
  baselineUnconfirmedItemsCount: number;
  ensembleUnconfirmedItemsCount: number;
  uncertaintyShrinkageApplied: boolean;
}

export interface ShadowMissingMetadataIndicators {
  missingFabricCount: number;
  missingFitCount: number;
  missingSeasonsCount: number;
  missingColorCount: number;
  unconfirmedCount: number;
}

export interface ShadowCulturalContextualConsistency {
  culturalHarmonious: boolean;
  culturalSignalsDetected: number;
  culturalMismatchesCaught: string[];
  weatherAlignmentConsistent: boolean;
}

export interface ShadowExecutionLatency {
  baselineMs: number;
  ensembleMs: number;
  totalMs: number;
}

export type ShadowWeatherFreshness =
  | 'fresh'
  | 'stale'
  | 'expired'
  | 'missing'
  | 'simulated';

export interface ShadowComparisonReport {
  evaluationId: string;
  timestamp: number;
  engineVersions: {
    baseline: string;
    shadow: string;
  };
  evaluationSuccess: boolean;
  failureReason?: string;
  requestContext: {
    occasion: Occasion;
    season: Season;
    itemCount: number;
    anchorItemId?: string;
    hasGenuineWeather: boolean;
    weatherFreshness: ShadowWeatherFreshness;
    hasStyleProfile: boolean;
  };
  baselineRecommendationIds: string[];
  shadowRecommendationIds: string[];
  candidateOverlap: ShadowCandidateOverlap;
  rankingDifferences: ShadowRankingDifferences;
  anchorPreservation: ShadowAnchorPreservation;
  hardConstraintViolations: ShadowHardConstraintViolations;
  unknownAttributeHandling: ShadowUnknownAttributeHandling;
  missingMetadataIndicators: ShadowMissingMetadataIndicators;
  culturalContextualConsistency: ShadowCulturalContextualConsistency;
  executionLatency: ShadowExecutionLatency;
}

