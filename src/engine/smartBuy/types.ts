import {
  Category,
  Subcategory,
  FabricType,
  SilhouetteFit,
  Occasion,
  WardrobeItem,
  OutfitSlotRole,
  OutfitPlan,
  PersonalStyleProfile,
  StylePreferences,
  ContextSnapshot,
} from '../../types';
import { WearAnalyticsReport } from '../analytics/types';

export type GapState =
  | 'INSUFFICIENT_DATA'
  | 'REDISCOVERY_SUGGESTED'
  | 'NO_GAP'
  | 'POSSIBLE_GAP'
  | 'OBSERVED_GAP'
  | 'CRITICAL_GAP';

export type PurchaseAssessment =
  | 'NO_PURCHASE_NEEDED'
  | 'PURCHASE_JUSTIFIED';

export type WardrobeGapType =
  | 'MISSING_CATEGORY'
  | 'UNDER_COVERED_CATEGORY'
  | 'FUNCTIONAL_GAP'
  | 'CONTEXT_GAP'
  | 'REPLACEMENT_GAP'
  | 'PREFERENCE_GAP';

export type EvidenceTier =
  | 'TIER_1_EXPLICIT_DEMAND'
  | 'TIER_2_UNRESOLVED_REQUIREMENTS'
  | 'TIER_3_WEAR_ROTATION'
  | 'TIER_4_WARDROBE_COMPOSITION'
  | 'TIER_5_ENVIRONMENTAL_CONTEXT'
  | 'TIER_6_GENERIC_HEURISTICS';

export interface EvidenceItem {
  tier: EvidenceTier;
  description: string;
  dataPoints?: Record<string, string | number | boolean>;
}

export interface GapAttributeGuidance {
  preferredFabrics: FabricType[];
  avoidedFabrics: FabricType[];
  preferredFits: SilhouetteFit[];
  formalityTarget?: number;
  preferredColors?: string[];
  avoidedColors?: string[];
}

export interface RediscoveryCandidate {
  item: WardrobeItem;
  targetRole: OutfitSlotRole;
  resolvedOccasions: Occasion[];
  action: 'STYLE_ITEM';
}

export interface WardrobeGap {
  id: string;
  type: WardrobeGapType;
  targetRole: OutfitSlotRole;
  expectedCategory: Category;
  compatibleSubcategories: Subcategory[];
  activeOccasions: Occasion[];
  gapState: GapState;
  purchaseAssessment: PurchaseAssessment;
  severityScore: number; // 0.0 to 1.0: strength of evidence for shortage
  confidence: number; // 0.0 to 1.0: certainty heuristic
  evidence: EvidenceItem[];
  rediscoveryCandidate?: RediscoveryCandidate;
  attributeGuidance?: GapAttributeGuidance;
  headline: string;
  explanation: string;
}

export interface DataSufficiencyMetrics {
  isSufficient: boolean;
  totalGarments: number;
  totalWearEvents: number;
  activeOccasionsCount: number;
  confidenceScore: number;
  ineligibilityReason?: string;
}

export interface OccasionReadiness {
  occasion: Occasion;
  isDeclaredActive: boolean;
  viableOutfitCount: number;
  readiness: 'fully_ready' | 'partially_ready' | 'unsupported';
  missingRoles: OutfitSlotRole[];
  summaryText: string;
}

export interface CoverageSummary {
  totalGarments: number;
  activeGarments: number;
  overallCoverageScore: number; // 0.0 to 1.0
  occasionReadiness: OccasionReadiness[];
  coveredOccasionsCount: number;
  unsupportedActiveOccasionsCount: number;
}

export interface NegativeEvidence {
  hasNoPurchaseNeeded: boolean;
  primaryReason: string;
  details: string[];
  rediscoveryOpportunitiesCount: number;
  concentrationAdvisory?: string;
}

export interface WardrobeGapReport {
  referenceTimestamp: number;
  dataSufficiency: DataSufficiencyMetrics;
  gaps: WardrobeGap[];
  purchaseAssessment: PurchaseAssessment;
  coverageSummary: CoverageSummary;
  negativeEvidence: NegativeEvidence;
}

export interface ComputeWardrobeGapsInput {
  wardrobe: readonly WardrobeItem[];
  wearAnalytics?: WearAnalyticsReport;
  outfitPlans?: readonly OutfitPlan[];
  styleProfile?: PersonalStyleProfile;
  stylePreferences?: StylePreferences;
  contextSnapshot?: ContextSnapshot;
  referenceTimestamp?: number;
}
