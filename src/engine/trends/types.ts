import {
  Category,
  Subcategory,
  FabricType,
  PatternType,
  SilhouetteFit,
  Occasion,
  Season,
  WardrobeItem,
  RecommendedOutfit,
  WeatherSnapshot,
  PersonalStyleProfile,
  StylePreferences,
  CulturalContextSignals,
} from '../../types';

// ============================================================================
// 1. PROVENANCE & SOURCE TYPES
// ============================================================================

export type TrendSourceType =
  | 'CURATED_EDITORIAL'          // Established fashion editorial publications
  | 'OFFICIAL_FASHION_SOURCE'    // Industry councils, fashion weeks, textile bodies
  | 'INDIAN_HERITAGE_CURATION'   // Traditional craft & handloom preservation sources
  | 'DESIGNER_ARCHIVE'           // Verified designer collections & retrospectives
  | 'PUBLIC_TREND_REPORT'        // General industry trend summaries
  | 'COMMUNITY_OBSERVATION'      // Documented regional street/community observations
  | 'UNVERIFIED_SOCIAL';         // Social media mentions without editorial corroboration

export interface TrendProvenance {
  sourceType: TrendSourceType;
  sourceReference: string;
  curatorOrReviewer?: string;
  observedAt: string; // YYYY-MM-DD
  confidence: number; // 0.0 - 1.0 (derived from sourceTrustPolicy * corroborationFactor)
  reviewed: boolean;  // Must be true to enter CuratedActiveTrend
  corroborationCount: number;
  notes?: string;
}

// ============================================================================
// 2. RAW SIGNAL (What external sources report)
// ============================================================================

export interface RawTrendSignal {
  id: string; // sig_<hash>
  sourceId: string;
  sourceType: TrendSourceType;
  sourceReference: string;
  curatorOrAuthor?: string;
  observedAt: string; // YYYY-MM-DD
  rawHeadline: string;
  rawExcerpt: string;
  extractedAttributes: {
    categories?: Category[];
    subcategories?: Subcategory[];
    fabrics?: FabricType[];
    patterns?: PatternType[];
    silhouettes?: SilhouetteFit[];
    colorPalette?: string[];
    occasions?: Occasion[];
    seasons?: Season[];
  };
}

// ============================================================================
// 3. LIFECYCLE STATES
// ============================================================================

export type TrendLifecycleState =
  | 'OBSERVED'
  | 'NORMALIZED'
  | 'CORROBORATED'
  | 'REVIEWED'
  | 'ACTIVE'
  | 'AGING'
  | 'UPCOMING'
  | 'EXPIRED';

// ============================================================================
// 4. NORMALIZED TREND CONCEPT (StyleSaathi taxonomy mapping)
// ============================================================================

export interface NormalizedTrendConcept {
  id: string; // trend_<slug>
  name: string;
  slug: string;
  summary: string;
  targetAttributes: {
    categories: Category[];
    subcategories: Subcategory[];
    fabrics: FabricType[];
    patterns: PatternType[];
    silhouettes: SilhouetteFit[];
    colorPalette: string[];
    occasions: Occasion[];
    seasons: Season[];
  };
  indianFashionContext?: {
    isIndianFusion: boolean;
    traditionalGarmentParallels?: Subcategory[];
    regionalHeritage?: string;
    culturalNotes?: string;
  };
  lifecycleState: TrendLifecycleState;
  validFrom: string; // YYYY-MM-DD
  validUntil: string; // YYYY-MM-DD
}

// ============================================================================
// 5. CURATED ACTIVE TREND (Approved for discovery)
// ============================================================================

export interface CuratedActiveTrend {
  concept: NormalizedTrendConcept;
  provenance: TrendProvenance;
  corroboratingSignalIds: string[];
  editorialNotes: string;
  reviewedBy: string;
  reviewedAt: string; // YYYY-MM-DD
}

// ============================================================================
// 6. DISCOVERY CLASSIFICATION & EVIDENCE
// ============================================================================

export type DiscoveryClassification =
  | 'NOT_RELEVANT'         // Explicitly avoided or contextually unsuitable
  | 'INFORMATIVE'          // Valid active trend, but zero matching owned pieces
  | 'WARDROBE_RELEVANT'    // Owned pieces match silhouette/fabric; neutral style affinity
  | 'STYLE_RELEVANT'       // Strong style affinity, but requires companion pieces
  | 'STRONG_DISCOVERY';     // Complete look possible from clean items + high style affinity

export type TrendFreshnessStatus =
  | 'FRESH'
  | 'ESTABLISHED'
  | 'SEASONAL_CLASSIC'
  | 'FRESH_ACTIVE'  // Within valid date window and cache valid
  | 'STALE_ACTIVE'  // Cache expired but within trend validUntil window
  | 'AGING'         // Approaching validity expiry (last 30 days)
  | 'EXPIRED'       // refDate > validUntil (excluded from discovery)
  | 'UPCOMING'
  | 'UNAVAILABLE';  // No catalog available

export interface TrendEvidence {
  trendId: string;
  classification: DiscoveryClassification;

  // 1. Provenance & Trust Evidence
  provenance: {
    sourceType: TrendSourceType;
    sourceTrustPolicyWeight: number; // 0.0 - 1.0 (policy-configured)
    confidence: number;              // 0.0 - 1.0
    corroborationCount: number;
    reviewed: boolean;
  };
  provenanceAndTrust: {
    trustWeight: number;
    sourceType: TrendSourceType;
    confidence: number;
    reviewed: boolean;
  };

  // 2. Temporal Freshness Evidence
  freshness: {
    observedAt: string;
    validUntil: string;
    referenceDate: string;
    status: TrendFreshnessStatus;
  };
  temporalFreshness: {
    status: TrendFreshnessStatus;
    corroboratingSignalsCount: number;
    daysSinceObservation?: number;
  };

  // 3. Wardrobe Coverage Evidence
  wardrobeCoverage: {
    matchingOwnedItemIds: string[];
    exactMatchCount: number;
    substituteMatchCount: number;
    canFormCompleteLook: boolean;
    missingSlotRoles: string[]; // Informational only; never a purchase trigger
    directMatchesCount: number;
    structuralSubstitutesCount: number;
    matchingItemNames: string[];
  };

  // 4. Personal Style Alignment Evidence
  personalStyleAlignment: {
    isExplicitlyAvoided: boolean;    // From explicit preferences / hard avoidance
    explicitAvoidanceConflict?: boolean;
    avoidanceReason?: string;
    learnedAffinityPenalty: boolean; // From behavioral rejections (soft penalty)
    positiveAffinityMatches: string[]; // Colors/fabrics user likes
    styleDeltaSummary: string;
    alignmentScore: number;
  };

  // 5. Cultural & Modesty Evidence (Phase 6 Authority)
  culturalContext: {
    hasIndianResonance: boolean;
    modestyStatus: 'ALIGNED' | 'MISMATCH' | 'NOT_SPECIFIED';
    modestyDetails?: string;
    festivalFit: 'ALIGNED' | 'NOT_APPLICABLE';
  };
  culturalModestyContext: {
    isIndianFusion: boolean;
    modestyAssessment: 'ALIGNED' | 'MISMATCH' | 'NOT_SPECIFIED';
    culturalResonanceNotes: string;
  };

  // 6. Context & Thermal Fit Evidence (Phase 4 Authority)
  contextualFit: {
    weatherVerified: boolean;
    thermalSuitability: 'OPTIMAL' | 'ACCEPTABLE' | 'UNSUITABLE' | 'UNVERIFIED';
    thermalReason?: string;
  };
  contextThermalFit: {
    thermalSuitability: 'OPTIMAL' | 'ACCEPTABLE' | 'UNSUITABLE' | 'UNVERIFIED';
    weatherNotes: string;
  };

  // 7. Rotation & Dormant Piece Opportunity (Phase 8 Authority)
  rotationOpportunity: {
    hasDormantPieces: boolean;
    dormantPieceIds: string[];
    dormantItemNames: string[];
    potentialUtilizationGain: string;
  };

  // Non-authoritative discovery score for UI filtering/sorting ONLY
  nonAuthoritativeDiscoveryScore: number; // 0.0 - 1.0 metadata
  telemetryExplanation: {
    headline: string;
    evidencePoints: string[];
    limitations: string[];
  };
  limitations: string[];
}

// ============================================================================
// 7. PHASE 5 EXPLORATION & DISCOVERY CONTRACTS
// ============================================================================

export interface TrendExplorationContext {
  trendId: string;
  trendName: string;
  targetOccasion: Occasion;
  targetSeason: Season;
  targetAttributes: NormalizedTrendConcept['targetAttributes'];
  revivalAnchorItemId?: string; // Optional Phase 8 dormant piece
}

export interface TrendDiscoveryOpportunity {
  id: string;
  trend: CuratedActiveTrend;
  evidence: TrendEvidence;
  candidateItemIds: string[];
  suggestedOccasions: Occasion[];
  revivalAnchorItem?: WardrobeItem;
  recommendedOutfitPlan?: RecommendedOutfit; // Generated by Phase 5 when requested
}

// ============================================================================
// 8. STORAGE & CACHE CONTRACT
// ============================================================================

export interface LocalTrendCache {
  version: string;
  fetchedAt: number; // epoch ms
  expiresAt: number; // epoch ms
  curatedSource: 'bundled' | 'remote';
  concepts: CuratedActiveTrend[];
}
