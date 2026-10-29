import {
  WardrobeItem,
  Occasion,
  Season,
  StylePreferences,
  PersonalStyleProfile,
  ContextSnapshot,
  CulturalContextSignals,
  RecommendedOutfit,
  ConfidenceLevel,
  FabricType,
} from '../../types';

export type EvaluationCategory =
  | 'traditional_indian'
  | 'contemporary_indo_western'
  | 'professional_interview'
  | 'campus_teen_safety'
  | 'festivals_ceremonies'
  | 'regional_traditions'
  | 'climate_extremes'
  | 'international_cross_cultural'
  | 'uncertainty_edge_cases'
  | 'preference_feedback_learning';

export interface ExplicitConstraints {
  readonly mustIncludeItemIds?: readonly string[];
  readonly mustExcludeItemIds?: readonly string[];
  readonly forbidSubcategories?: readonly string[];
  readonly maxFormality?: number;
  readonly minFormality?: number;
  readonly noFabricSensitivities?: boolean;
  readonly noClimateHazards?: boolean;
  readonly teenSafeguardActive?: boolean;
}

export interface ExpectedCompatibility {
  readonly minimumCandidates?: number;
  readonly acceptableTemplates?: readonly string[];
  readonly expectedCraftsOrPatterns?: readonly string[];
  readonly expectedFabrics?: readonly FabricType[];
  readonly expectedEvidenceSources?: readonly string[];
  readonly expectedConfidenceLevel?: ConfidenceLevel;
}

export interface HumanReviewCriteria {
  readonly culturalNuanceDescription: string;
  readonly regionalSpecificity: string;
  readonly openQuestionsOrGaps?: readonly string[];
  readonly expertReviewStatus: 'approved' | 'provisional_consensus' | 'unresolved_knowledge_gap';
}

export interface EvaluationCase {
  readonly id: string;
  readonly name: string;
  readonly category: EvaluationCategory;
  readonly ageBand: 'teen_14_17' | 'adult_18_plus';
  readonly presentationPreference?: 'masculine' | 'feminine' | 'androgynous' | 'all';
  readonly userPreferences: Partial<StylePreferences> & {
    stylingMode: StylePreferences['stylingMode'];
  };
  readonly styleProfile?: PersonalStyleProfile;
  readonly wardrobe: readonly WardrobeItem[];
  readonly occasion: Occasion;
  readonly season?: Season;
  readonly weatherFixture?: ContextSnapshot;
  readonly culturalSignals?: CulturalContextSignals;
  readonly explicitConstraints?: ExplicitConstraints;
  readonly expectedCompatibility?: ExpectedCompatibility;
  readonly knownUnacceptableOutcomes: readonly string[];
  readonly humanReviewCriteria: HumanReviewCriteria;
}

export interface CaseEvaluationResult {
  readonly caseId: string;
  readonly caseName: string;
  readonly category: EvaluationCategory;
  readonly passed: boolean;
  readonly totalOutfitsGenerated: number;
  readonly topOutfit?: RecommendedOutfit;
  readonly violations: readonly string[];
  readonly wardrobeItemValidityRate: number; // 1.0 = 100% of pieces in outfits belong to input wardrobe
  readonly hardConstraintPassed: boolean;
  readonly culturalPlausibilityPassed: boolean;
  readonly uncertaintyHandledCorrectly: boolean;
  readonly confidenceCalibrated: boolean;
  readonly executionTimeMs: number;
}

export interface CategoryEvaluationSummary {
  readonly total: number;
  readonly passed: number;
  readonly passRate: number;
  readonly hardConstraintViolations: number;
}

export interface EvaluationReport {
  readonly timestamp: string;
  readonly totalCases: number;
  readonly passedCases: number;
  readonly failedCases: number;
  readonly overallPassRate: number;
  readonly hardConstraintViolationRate: number;
  readonly wardrobeValidityRate: number;
  readonly categoryBreakdown: Record<EvaluationCategory, CategoryEvaluationSummary>;
  readonly caseResults: readonly CaseEvaluationResult[];
  readonly unresolvedKnowledgeGaps: readonly string[];
}
