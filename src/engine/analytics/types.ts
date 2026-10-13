import {
  WardrobeItem,
  Category,
  Subcategory,
  FabricType,
  PatternType,
  SilhouetteFit,
  WearEvent,
} from '../../types';

export type RotationState = 'active' | 'occasional' | 'dormant' | 'never_worn';

export type ReconciliationCase =
  | 'A_MATCH'
  | 'B_EVENT_STREAM_PRECEDENCE'
  | 'C_LEGACY_DELTA'
  | 'D_PURE_LEGACY';

export interface ReconciledItemWears {
  itemId: string;
  canonicalEventCount: number;
  counterTimesWorn: number;
  effectiveLifetimeWears: number;
  legacyWearsDelta: number;
  reconciliationCase: ReconciliationCase;
}

export interface CostPerWearAnalysis {
  purchasePrice?: number;
  effectiveWears: number;
  costPerWear?: number;
  unamortizedCost?: number;
  status: 'amortizing' | 'unworn' | 'unpriced';
  formattedCPW: string;
}

export type NormalizedFabricGroup =
  | 'breathable'
  | 'structured'
  | 'drape'
  | 'denim'
  | 'unknown';

export type NormalizedPatternGroup =
  | 'solid'
  | 'traditional_indian'
  | 'western_geometric'
  | 'unknown';

export type NormalizedSilhouetteGroup =
  | 'structured'
  | 'standard'
  | 'relaxed'
  | 'unknown';

export interface AttributeDistribution {
  counts: Record<string, number>;
  percentages: Record<string, number>;
  topAttribute?: string;
}

export type SnapshotWindowId =
  | 'weekly_7d'
  | 'recent_30d'
  | 'baseline_60d'
  | 'all_time';

export interface StyleSnapshot {
  windowId: SnapshotWindowId;
  windowStartMs: number;
  windowEndMs: number;
  totalWearEvents: number;
  uniqueGarmentsWorn: number;
  isEligible: boolean;

  color: AttributeDistribution;
  neutralColorRatio: number;

  fabric: AttributeDistribution;
  breathableFabricRatio: number;

  pattern: AttributeDistribution;
  solidPatternRatio: number;

  silhouette: AttributeDistribution;
  relaxedSilhouetteRatio: number;

  averageFormality: number;
  ethnicGarmentRatio: number;
}

export type EvolutionDimension =
  | 'palette'
  | 'textile'
  | 'pattern'
  | 'silhouette'
  | 'formality';

export interface EvolutionDimensionDelta {
  dimension: EvolutionDimension;
  baselineRatio: number;
  recentRatio: number;
  deltaRatio: number;
  isSignificant: boolean;
  headline: string;
  evidenceText: string;
}

export interface StyleEvolutionReport {
  isEligible: boolean;
  ineligibilityReason?: string;
  confidence: number;
  baselineSnapshot: StyleSnapshot;
  recentSnapshot: StyleSnapshot;
  dimensions: EvolutionDimensionDelta[];
  significantShifts: EvolutionDimensionDelta[];
}

export interface ItemRotationAnalysis {
  item: WardrobeItem;
  state: RotationState;
  effectiveWears: number;
  lastWornDaysAgo?: number;
  itemAgeDays: number;
  costPerWear: CostPerWearAnalysis;
}

export interface RotationHealthMetrics {
  isEligible: boolean;
  ineligibilityReason?: string;
  confidence: number;
  totalCleanItems: number;
  activeCount: number;
  occasionalCount: number;
  dormantCount: number;
  neverWornCount: number;
  rotationHealthPercentage?: number;
  itemsByState: Record<RotationState, ItemRotationAnalysis[]>;
}

export interface ParetoConcentrationMetrics {
  isEligible: boolean;
  ineligibilityReason?: string;
  confidence: number;
  kItemsCount: number;
  totalWardrobeCount: number;
  topKWears: number;
  totalLifetimeWears: number;
  concentrationRatio?: number;
  interpretation?: 'High Concentration' | 'Balanced Rotation' | 'High Variety';
  explanation?: string;
}

export interface OrphanWearMetrics {
  unresolvedOrphanCount: number;
  explanation?: string;
}

export interface WearAnalyticsReport {
  generatedAt: number;
  referenceTimestamp: number;
  totalLifetimeWears: number;
  uniqueWornItemsCount: number;
  reconciledWears: Record<string, ReconciledItemWears>;
  rotation: RotationHealthMetrics;
  concentration: ParetoConcentrationMetrics;
  evolution: StyleEvolutionReport;
  orphans: OrphanWearMetrics;
  snapshots: Record<SnapshotWindowId, StyleSnapshot>;
  mostWornItems: ItemRotationAnalysis[];
  dormantItems: ItemRotationAnalysis[];
}
