export type Category =
  | 'Tops'
  | 'Bottoms'
  | 'Ethnic'
  | 'Dresses'
  | 'Outerwear'
  | 'Footwear'
  | 'Accessories';

export type Subcategory =
  | 't-shirt'
  | 'shirt'
  | 'top'
  | 'crop top'
  | 'hoodie'
  | 'sweater'
  | 'jeans'
  | 'trousers'
  | 'shorts'
  | 'skirt'
  | 'leggings'
  | 'joggers'
  | 'salwar'
  | 'kurta'
  | 'kurti'
  | 'anarkali'
  | 'saree'
  | 'blouse'
  | 'lehenga'
  | 'salwar set'
  | 'sherwani'
  | 'palazzo'
  | 'churidar'
  | 'pajama'
  | 'dupatta'
  | 'nehru jacket'
  | 'dress'
  | 'western dress'
  | 'co-ord set'
  | 'jacket'
  | 'blazer'
  | 'shrug'
  | 'sneakers'
  | 'formal shoes'
  | 'loafers'
  | 'heels'
  | 'flats'
  | 'sandals'
  | 'juttis'
  | 'kolhapuris'
  | 'bag'
  | 'watch'
  | 'jewellery'
  | 'belt'
  | 'sunglasses'
  | 'scarf';

export type Season = 'summer' | 'monsoon' | 'winter';

export type Occasion =
  | 'college'
  | 'everyday'
  | 'office'
  | 'interview'
  | 'casual outing'
  | 'date'
  | 'party'
  | 'family function'
  | 'family gathering'
  | 'puja'
  | 'festive'
  | 'wedding guest'
  | 'celebration'
  | 'Diwali'
  | 'Holi'
  | 'Eid'
  | 'travel';

export type Status = 'clean' | 'needs_washing' | 'in_laundry';

// Phase 2: Wardrobe Intelligence 2.0 Fashion Domain Types
export type FabricType =
  | 'cotton'
  | 'linen'
  | 'khadi'
  | 'silk'
  | 'chiffon'
  | 'georgette'
  | 'denim'
  | 'wool'
  | 'rayon'
  | 'viscose'
  | 'organza'
  | 'velvet'
  | 'satin'
  | 'crepe'
  | 'chanderi'
  | 'banarasi'
  | 'mulmul'
  | 'tussar'
  | 'modal'
  | 'polyblend'
  | 'unknown';

export type PatternType =
  | 'solid'
  | 'striped'
  | 'checked'
  | 'floral'
  | 'ikat'
  | 'bandhani'
  | 'block_print'
  | 'kalamkari'
  | 'chikankari'
  | 'embroidered'
  | 'polka_dot'
  | 'geometric'
  | 'abstract'
  | 'zari_brocade'
  | 'unknown';

export type SilhouetteFit =
  | 'slim'
  | 'regular'
  | 'relaxed'
  | 'oversized'
  | 'straight'
  | 'a_line'
  | 'flared'
  | 'anarkali'
  | 'tailored';

export type CulturalContext =
  | 'traditional'
  | 'contemporary'
  | 'fusion'
  | 'ceremonial'
  | 'everyday_ethnic';

export type ConfidenceLevel = 'UNKNOWN' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERIFIED';

export interface AttributeProvenance {
  source: 'user' | 'ai' | 'system' | 'imported';
  confidence?: number;
  verifiedAt?: number;
}

export interface WardrobeItem {
  id: string;
  userId?: string;
  name: string;
  photo?: string | null;
  photoId?: string;
  activeImageVersionId?: string;
  storagePath?: string;
  photoUrl?: string;
  category: Category;
  subcategory: Subcategory;
  colors: string[];
  seasons: Season[];
  occasions: Occasion[];
  formality: number;
  brand?: string;
  status: Status;
  favorite: boolean;
  note: string;
  timesWorn: number;
  lastWorn?: number;
  createdAt?: number;
  isDeleted?: boolean;
  deletedAt?: number;
  clientUpdatedAt?: number;
  serverUpdatedAt?: string;

  // Phase 2: Wardrobe Intelligence 2.0 (Optional & backward-compatible)
  fabric?: FabricType;
  pattern?: PatternType;
  fit?: SilhouetteFit;
  purchasePrice?: number;
  purchaseDate?: string;
  culturalContext?: CulturalContext;
  aiConfidence?: number;
  userVerified?: boolean;
  provenance?: Record<string, AttributeProvenance>;
}

// Backward-compatible alias for existing code
export type Item = WardrobeItem;

export interface GeneratedOutfit {
  id?: string;
  template: string;
  slots: Record<string, WardrobeItem[]>;
  score: number;
  why: string;
}

// Backward-compatible alias for existing code
export type Outfit = GeneratedOutfit;

export interface SavedOutfit {
  id: string;
  userId?: string;
  name?: string;
  outfit: GeneratedOutfit;
  savedAt: number;
  isDeleted?: boolean;
  deletedAt?: number;
  clientUpdatedAt?: number;
  serverUpdatedAt?: string;
}

export interface CandidateItem extends WardrobeItem {
  priceRange?: string;
}

export interface SmartBuyRecommendation {
  candidate: CandidateItem;
  baselineOutfitCount: number;
  simulatedOutfitCount: number;
  newOutfitsUnlocked: number;
  compatibleExistingItems: WardrobeItem[];
  previewOutfits: GeneratedOutfit[];
  reason: string;
}

export type { AutoTagResult } from './services/autoTag';

export interface WardrobeRepository {
  getItems(): Promise<WardrobeItem[]>;
  getItem(id: string): Promise<WardrobeItem | null>;
  getAllItemsRaw?(): Promise<WardrobeItem[]>;
  upsertItemRaw?(item: WardrobeItem): Promise<void>;
  addItem(item: WardrobeItem): Promise<void>;
  updateItem(id: string, patch: Partial<WardrobeItem>): Promise<void>;
  deleteItem(id: string): Promise<void>;
  getSavedOutfits(): Promise<SavedOutfit[]>;
  getAllSavedOutfitsRaw?(): Promise<SavedOutfit[]>;
  upsertSavedOutfitRaw?(outfit: SavedOutfit): Promise<void>;
  saveOutfit(outfit: GeneratedOutfit, name?: string): Promise<SavedOutfit>;
  deleteSavedOutfit(id: string): Promise<void>;
  clear(): Promise<void>;
}

export interface WardrobePhotoStore {
  savePhoto(id: string, dataUrl: string): Promise<string>;
  getPhoto(id: string): Promise<string | null>;
  deletePhoto(id: string): Promise<void>;
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'guest';

export interface User {
  id: string;
  email?: string;
  name?: string;
  isGuest: boolean;
  createdAt: number;
}

export type StylingMode = 'simple' | 'variety' | 'experiment';

export interface StylePreferences {
  userId?: string;
  preferredContexts: string[];
  preferredAesthetics: string[];
  stylingMode: StylingMode;
  updatedAt: number;
  clientUpdatedAt?: number;
  serverUpdatedAt?: string;
}

export type PlanStatus = 'planned' | 'worn' | 'cancelled';

export interface OutfitPlan {
  id: string;
  userId?: string;
  date: string; // YYYY-MM-DD
  outfit: GeneratedOutfit;
  accessory?: WardrobeItem | null;
  occasion: Occasion;
  status: PlanStatus;
  createdAt: number;
  updatedAt: number;
  isDeleted?: boolean;
  deletedAt?: number;
  clientUpdatedAt?: number;
  serverUpdatedAt?: string;
}

export interface CalendarRepository {
  getPlans(): Promise<OutfitPlan[]>;
  getPlanByDate(date: string): Promise<OutfitPlan | null>;
  getAllPlansRaw?(): Promise<OutfitPlan[]>;
  upsertPlanRaw?(plan: OutfitPlan): Promise<void>;
  savePlan(plan: OutfitPlan): Promise<void>;
  deletePlan(id: string): Promise<void>;
  updatePlanStatus(id: string, status: PlanStatus): Promise<void>;
  clear(): Promise<void>;
}

export interface PreferencesRepository {
  getPreferences(): Promise<StylePreferences | null>;
  savePreferences(prefs: StylePreferences): Promise<void>;
  upsertPreferencesRaw?(prefs: StylePreferences): Promise<void>;
  clear(): Promise<void>;
}

export interface WearEventsRepository {
  getEvents(): Promise<WearEvent[]>;
  getEventsForItem(itemId: string): Promise<WearEvent[]>;
  addEvent(event: WearEvent): Promise<void>;
  addEvents(events: WearEvent[]): Promise<void>;
  clear(): Promise<void>;
}

// ============================================================================
// PHASE 3: PERSONAL STYLE BRAIN & BEHAVIORAL FEEDBACK ENGINE
// ============================================================================

export type StyleSignalType =
  | 'worn'
  | 'saved'
  | 'favorited'
  | 'planned'
  | 'liked'
  | 'skipped'
  | 'dismissed'
  | 'rejected'
  | 'viewed';

export type RejectionReason =
  | 'too_hot'
  | 'too_cold'
  | 'too_formal'
  | 'too_casual'
  | 'wrong_color'
  | 'wrong_pattern'
  | 'wrong_fit'
  | 'uncomfortable'
  | 'not_my_style'
  | 'occasion_mismatch'
  | 'too_repetitive'
  | 'too_bold'
  | 'too_plain'
  | 'dislike_combination'
  | 'item_unavailable'
  | 'other';

export interface StyleSignalEvent {
  id: string; // Stable client-generated UUIDv4
  userId: string;
  signalType: StyleSignalType;
  outfitId?: string;
  itemIds: string[];
  occasion?: Occasion;
  season?: Season;
  rejectionReason?: RejectionReason;
  note?: string;
  createdAt: number; // Epoch timestamp (ms)
}

export interface AttributeAffinity {
  score: number; // -1.0 to +1.0 normalized affinity
  confidence: number; // 0.0 to 1.0 confidence based on sample count & consistency
  sampleCount: number; // number of signals contributing
  lastInteractedAt: number; // Epoch timestamp (ms)
}

export interface PersonalStyleProfile {
  version: number;
  userId: string;
  updatedAt: number;
  overallConfidence: number; // 0.0 to 1.0
  totalSignalsCount: number;

  // Granular preference dimensions:
  colorAffinities: Record<string, AttributeAffinity>;
  fabricAffinities: Record<FabricType, AttributeAffinity>;
  patternAffinities: Record<PatternType, AttributeAffinity>;
  fitAffinities: Record<SilhouetteFit, AttributeAffinity>;
  culturalAffinities: Record<CulturalContext, AttributeAffinity>;
  occasionAffinities: Record<Occasion, AttributeAffinity>;

  // Item & Pairwise combination affinities:
  itemAffinities: Record<string, AttributeAffinity>; // itemId -> affinity
  combinationAffinities: Record<string, AttributeAffinity>; // 'itemA:itemB' sorted pair -> affinity

  // Avoidance model:
  avoidedColors: string[];
  avoidedFabrics: FabricType[];
  avoidedPatterns: PatternType[];
  avoidedCombinations: string[]; // 'itemA:itemB'

  // Style characteristics:
  neutralPreferenceRatio: number; // 0 (bold colors) to 1 (all neutrals)
  formalityBias: number; // -1 (casual preference) to +1 (formal preference)
  noveltyTolerance: number; // 0 (repetition) to 1 (variety)

  // Explainable insights (derived high-confidence points):
  topColors: string[];
  topFabrics: FabricType[];
  topFits: SilhouetteFit[];
  recentExplorations: string[];
}

export interface StyleSignalsRepository {
  getSignals(): Promise<StyleSignalEvent[]>;
  getSignalsForItem(itemId: string): Promise<StyleSignalEvent[]>;
  addSignal(signal: StyleSignalEvent): Promise<void>;
  addSignals(signals: StyleSignalEvent[]): Promise<void>;
  clear(): Promise<void>;
}

export interface AuthRepository {
  getUser(): Promise<User | null>;
  signInWithGoogle(): Promise<User | { url?: string }>;
  signInWithEmail(email: string, name?: string): Promise<User>;
  sendEmailOtp?(email: string, name?: string): Promise<void>;
  verifyEmailOtp?(email: string, token: string): Promise<User>;
  continueAsGuest(): Promise<User>;
  signOut(): Promise<void>;
  clear(): Promise<void>;
  onAuthStateChange?(callback: (user: User | null) => void): () => void;
}

export interface WardrobeImageVersion {
  id: string; // imageVersionId / photoId
  userId: string;
  wardrobeItemId: string;
  storagePath: string;
  versionHash?: string;
  width?: number;
  height?: number;
  mimeType?: string;
  byteSize?: number;
  createdAt: number;
  isActive: boolean;
  deletedAt?: number;
}

export interface WearEvent {
  id: string; // Stable client-generated UUIDv4
  userId: string;
  wardrobeItemId: string;
  outfitId?: string;
  plannedDate?: string; // YYYY-MM-DD
  wornAt: number; // Epoch timestamp (ms)
  createdAt: number; // Epoch timestamp (ms)
}

// ============================================================================
// TYPED SYNC QUEUE MUTATION DISCRIMINATED UNIONS
// ============================================================================
export type SyncOperation =
  | 'UPSERT'
  | 'DELETE'
  | 'UPLOAD_IMAGE'
  | 'ACTIVATE_IMAGE'
  | 'DELETE_IMAGE'
  | 'APPEND_WEAR'
  | 'APPEND_SIGNAL';

export interface BaseSyncMutation {
  id: string;
  mutationId?: string; // Optional alias for id
  createdAt?: number; // Epoch timestamp (ms)
  clientTimestamp: number; // Timestamp of mutation creation
  attemptCount: number;
  maxAttempts: number;
  nextRetryAt: number;
  lastError: string | null;
  status: 'pending' | 'in_flight' | 'failed' | 'dead_letter';
  dependencies?: string[];
}

export interface ItemUpsertMutation extends BaseSyncMutation {
  entityType: 'wardrobe_item';
  entityId: string;
  operation: 'UPSERT';
  payload: WardrobeItem;
}

export interface ItemDeleteMutation extends BaseSyncMutation {
  entityType: 'wardrobe_item';
  entityId: string;
  operation: 'DELETE';
  payload: { id: string; deletedAt: number };
}

export interface SavedOutfitUpsertMutation extends BaseSyncMutation {
  entityType: 'saved_outfit';
  entityId: string;
  operation: 'UPSERT';
  payload: SavedOutfit;
}

export interface SavedOutfitDeleteMutation extends BaseSyncMutation {
  entityType: 'saved_outfit';
  entityId: string;
  operation: 'DELETE';
  payload: { id: string; deletedAt: number };
}

export interface PlanUpsertMutation extends BaseSyncMutation {
  entityType: 'calendar_plan';
  entityId: string;
  operation: 'UPSERT';
  payload: OutfitPlan;
}

export interface PlanDeleteMutation extends BaseSyncMutation {
  entityType: 'calendar_plan';
  entityId: string;
  operation: 'DELETE';
  payload: { id: string; date: string; deletedAt: number };
}

export interface PreferencesMutation extends BaseSyncMutation {
  entityType: 'style_preferences';
  entityId: string;
  operation: 'UPSERT';
  payload: StylePreferences;
}

export interface WearEventMutation extends BaseSyncMutation {
  entityType: 'wear_event';
  entityId: string;
  operation: 'APPEND_WEAR';
  payload: WearEvent;
}

export interface StyleSignalMutation extends BaseSyncMutation {
  entityType: 'style_signal';
  entityId: string;
  operation: 'APPEND_SIGNAL';
  payload: StyleSignalEvent;
}

export interface ImageUploadMutation extends BaseSyncMutation {
  entityType: 'wardrobe_image';
  entityId: string; // photoId / imageVersionId
  operation: 'UPLOAD_IMAGE';
  payload: { itemId: string; photoId: string; storagePath: string; imageVersionId?: string };
}

export interface ImageActivationMutation extends BaseSyncMutation {
  entityType: 'wardrobe_image';
  entityId: string; // photoId / imageVersionId
  operation: 'ACTIVATE_IMAGE';
  payload: { itemId: string; imageVersionId: string; storagePath: string; previousImageVersionId?: string };
}

export interface ImageDeleteMutation extends BaseSyncMutation {
  entityType: 'wardrobe_image';
  entityId: string; // photoId / imageVersionId
  operation: 'DELETE_IMAGE';
  payload: { itemId: string; photoId?: string; imageVersionId?: string; storagePath: string };
}

export type SyncMutation =
  | ItemUpsertMutation
  | ItemDeleteMutation
  | SavedOutfitUpsertMutation
  | SavedOutfitDeleteMutation
  | PlanUpsertMutation
  | PlanDeleteMutation
  | PreferencesMutation
  | WearEventMutation
  | StyleSignalMutation
  | ImageUploadMutation
  | ImageActivationMutation
  | ImageDeleteMutation;
