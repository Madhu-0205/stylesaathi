import {
  Category,
  Subcategory,
  FabricType,
  PatternType,
  SilhouetteFit,
  Occasion,
  Season,
  WardrobeItem,
} from '../../types';

export const KNOWLEDGE_GRAPH_VERSION = '1.0.0';

export type KnowledgeClassification =
  | 'structural'
  | 'compatibility'
  | 'contextual'
  | 'curated';

export type KnowledgeSourceType =
  | 'repository'
  | 'primary_source'
  | 'secondary_source'
  | 'expert_review'
  | 'internal_curation'
  | 'unknown';

export interface KnowledgeProvenance {
  sourceType: KnowledgeSourceType | string;
  sourceReference?: string;
  confidence: number;
  reviewed: boolean;
  notes?: string;
}

export type FashionKnowledgeSignalType =
  | 'garment_compatibility'
  | 'fabric_compatibility'
  | 'pattern_compatibility'
  | 'silhouette_balance'
  | 'cultural_resonance'
  | 'regional_resonance'
  | 'occasion_fit'
  | 'layering_compatibility'
  | 'footwear_compatibility'
  | 'accessory_compatibility';

export interface FashionKnowledgeSignal {
  type: FashionKnowledgeSignalType;
  strength: number; // -1.0 to +1.0: domain evidence direction and magnitude
  confidence: number; // 0.0 to 1.0: certainty of the knowledge rule
  explanationKey?: string;
  provenance?: KnowledgeProvenance;
  metadata?: Record<string, string | number | boolean>;
}

export interface GarmentConcept {
  id: Subcategory;
  category: Category;
  subcategory: Subcategory;
  structuralRole:
    | 'primary_top'
    | 'primary_bottom'
    | 'single_piece'
    | 'layer'
    | 'drape'
    | 'footwear'
    | 'accessory';
  compatibleLayers?: (Subcategory | string)[];
  compatibleBottoms?: (Subcategory | string)[];
  compatibleFootwear?: (Subcategory | string)[];
  compatibleAccessories?: (Subcategory | string)[];
  silhouetteFit?: (SilhouetteFit | string)[];
  provenance: KnowledgeProvenance;
}

export interface EnsembleStructure {
  id: string;
  name: string;
  baseGarment: Subcategory | string;
  requiredComponents: (Subcategory | string)[];
  optionalComponents: (Subcategory | string)[];
  footwearRequirement?: 'required' | 'optional';
  layeringRules?: string[];
  silhouetteRelationships?: string[];
  provenance: KnowledgeProvenance;
}

export interface FabricConcept {
  id: FabricType;
  breathability: 'low' | 'medium' | 'high';
  insulation: 'low' | 'medium' | 'high';
  weight: 'light' | 'medium' | 'heavy';
  drape: 'structured' | 'fluid' | 'mixed';
  rainSensitivity: 'low' | 'medium' | 'high';
  careSensitivity: 'low' | 'medium' | 'high';
  craftAssociations?: string[];
  provenance: KnowledgeProvenance;
}

export interface PatternConcept {
  id: PatternType;
  visualWeight: 'subtle' | 'moderate' | 'statement';
  traditionalOrigin?: string;
  craftAssociations?: string[];
  harmoniousPatterns: (PatternType | string)[];
  competingPatterns: (PatternType | string)[];
  provenance: KnowledgeProvenance;
}

export type RegionalMacroZone =
  | 'north'
  | 'south'
  | 'east'
  | 'west'
  | 'northeast'
  | 'central';

export interface RegionalTradition {
  zone: RegionalMacroZone;
  traditionalCrafts: string[];
  representativeFabrics: (FabricType | string)[];
  representativePatterns: (PatternType | string)[];
  representativeGarments: (Subcategory | string)[];
  notes: string;
  provenance: KnowledgeProvenance;
}

export interface FestivalContextRule {
  name: string;
  suggestedFabrics: (FabricType | string)[];
  suggestedPatterns: (PatternType | string)[];
  suggestedColors: string[];
  movementType: 'high_movement' | 'moderate' | 'seated_ceremonial';
  formalityTarget: number;
  provenance: KnowledgeProvenance;
}

export interface FashionKnowledgeContext {
  occasion?: Occasion;
  season?: Season;
  regionalPreference?: string;
  festivalContext?: string;
  declaredModestyLevel?: 'standard' | 'high';
  userAesthetics?: string[];
}

export interface FashionKnowledgeEngine {
  readonly version: string;
  getSignals(
    items: WardrobeItem[],
    context?: FashionKnowledgeContext
  ): FashionKnowledgeSignal[];
}
