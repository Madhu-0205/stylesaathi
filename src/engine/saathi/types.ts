import {
  WardrobeItem,
  Category,
  Subcategory,
  Occasion,
  Season,
  StylePreferences,
  PersonalStyleProfile,
  OutfitPlan,
  WearEvent,
  ContextSnapshot,
  RecommendedOutfit,
  MissingOutfitRequirement,
  GeneratedOutfit,
  CulturalContextSignals,
} from '../../types';
import { WardrobeGapReport, PurchaseAssessment } from '../smartBuy/types';
import { WearAnalyticsReport } from '../analytics/types';
import { FashionKnowledgeSignal } from '../knowledge/types';

/**
 * Strongly typed intents supported by AI Saathi Orchestrator.
 */
export type SaathiIntent =
  | 'RECOMMEND_OUTFIT'          // "What should I wear today?", "Suggest a look"
  | 'STYLE_ITEM'               // "How do I style this blue shirt?", "Style my kurta"
  | 'STYLE_3_WAYS'             // "Style this shirt 3 ways", "Give me 3 styles"
  | 'COLLEGE_OUTFIT'          // "College outfit", "Campus look", "Uni clothes"
  | 'INTERVIEW_OUTFIT'        // "Interview outfit", "Placement interview look"
  | 'SAREE_STYLING'           // "How do I style a saree?", "Footwear for saree"
  | 'INDO_WESTERN'            // "Indo-Western look", "Kurta with jeans"
  | 'COLOR_PAIRING'           // "What colors go with these trousers?", "Trouser color combinations"
  | 'PREMIUM_UPGRADE'         // "Make this look elevated/premium", "Quiet luxury look"
  | 'MINIMALIST_OUTFIT'       // "Minimalist outfit", "Clean simple look"
  | 'RESTYLE_UNDERUSED'       // "Restyle underused", "What haven't I worn?", "Neglected items"
  | 'CHECK_WARDROBE'           // "Find my black trousers", "What tops do I have?"
  | 'CHECK_WEATHER'            // "What is the weather today?", "Is it raining outside?"
  | 'ANALYZE_WEAR'             // "What do I wear most often?", "Show my rotation health"
  | 'UNDERSTAND_STYLE'         // "What is my style aesthetic?", "Show my learned color preferences"
  | 'CHECK_WARDROBE_GAPS'      // "What gaps do I have in my wardrobe?"
  | 'ASSESS_PURCHASE_NEED'     // "Do I need to buy anything?", "Should I buy formal shoes?"
  | 'EXPLAIN_ITEM'             // "Tell me about this fabric", "Why is this versatile?"
  | 'EXPLAIN_RECOMMENDATION'   // "Why did you recommend this outfit?"
  | 'PLAN_OUTFIT'              // "Plan an outfit for tomorrow's office meeting"
  | 'RECORD_WEAR'              // "I wore this outfit today", "Log wear for white sneakers"
  | 'ANTI_REPETITION'          // "I don't want to repeat yesterday's outfit", "Don't repeat"
  | 'SHOW_ALTERNATIVE'         // "Show another look", "Different look", "Next look"
  | 'SWAP_PIECE'               // "Use the same kurti but different footwear", "Different footwear"
  | 'REFINE_OUTFIT'            // "Make it more formal", "Make it more casual", "Make it more minimal"
  | 'WARDROBE_ONLY_QUERY'      // "Only use clothes from my wardrobe", "Don't suggest anything I don't own"
  | 'PAIRING_CHECK'             // "Can I wear my blue kurti with jeans?"
  | 'EXPLICIT_NO_PURCHASE'     // "I don't want to buy anything", "No buying"
  | 'FEEDBACK_POSITIVE'        // "I love this outfit", "Looks great"
  | 'FEEDBACK_NEGATIVE'        // "I don't like this look", "Hate this"
  | 'GENERAL_FASHION_QUESTION' // "How do I pair a saree with footwear?"
  | 'CLARIFICATION_RESPONSE'   // User answering an option/field requested by Saathi
  | 'CONFIRMATION_RESPONSE'    // User confirming or declining a pending mutation
  | 'UNKNOWN';                 // Unrecognized intent

/**
 * Extracted and resolved entities from user input.
 */
export interface SaathiEntities {
  wardrobeItemId?: string;
  wardrobeItemName?: string;
  occasion?: Occasion;
  date?: string;               // YYYY-MM-DD
  relativeDate?: 'today' | 'tomorrow' | 'this_weekend' | 'specific_date';
  season?: Season;
  category?: Category;
  subcategory?: Subcategory;
  garmentType?: string;
  garmentCategory?: Category;
  color?: string;
  fabric?: string;
  aesthetic?: string;
  targetLook?: string;
  confirmationStatus?: 'confirmed' | 'cancelled';
  clarificationValue?: string;
  status?: string;             // e.g. 'clean', 'in_laundry', 'needs_washing'
  constraints?: string[];
  // Ordinal and look reference
  lookIndex?: number;          // 0-based index of referenced look
  ordinalRef?: 'first' | 'second' | 'third' | 'last';
  selectedOutfitId?: string;   // Stable outfit ID referenced
  selectedGarmentId?: string;  // Specific garment ID referenced
  // Styling and refinement preferences
  refinementType?: 'more_elegant' | 'more_formal' | 'more_casual' | 'more_minimal' | 'warmer' | 'cooler';
  antiRepetition?: boolean;    // User requested not to repeat recent outfits
  avoidRecentDays?: number;    // How many days back to avoid (default: 1-2)
  isCorrection?: boolean;      // Indicates user is correcting a previous turn
  // Phase 1.10 Anchor, Swap, and Occasion Context
  anchorGarmentId?: string;
  anchorGarmentName?: string;
  swapRole?: 'top' | 'bottom' | 'footwear' | 'outerwear' | 'layer' | 'accessories';
  keptPieceRole?: 'top' | 'bottom' | 'footwear' | 'outerwear' | 'layer' | 'accessories';
  keptPieceName?: string;
  wardrobeOnly?: boolean;
  pairingItemNames?: string[];
  explicitNoPurchase?: boolean;
  occasionContext?: string;    // e.g. 'birthday party', 'house party', 'reception', 'puja'
  secondaryOccasion?: Occasion;
  removedRole?: 'top' | 'bottom' | 'footwear' | 'outerwear' | 'layer' | 'accessories';
  unlockedAnchor?: boolean;
  requestedGarmentName?: string;
  unownedGarmentDetected?: boolean;
}

/**
 * Missing information identified during intent detection.
 */
export interface MissingContext {
  field: keyof SaathiEntities;
  reason: string;
  critical: boolean;
}

/**
 * Structured intent detection output.
 */
export interface SaathiIntentResult {
  intent: SaathiIntent;
  confidence: number;
  entities: SaathiEntities;
  missingInformation: MissingContext[];
  rawQuery: string;
}

/**
 * Interactive option presented for user clarification.
 */
export interface ClarificationOption {
  label: string;
  value: string;
  description?: string;
}

/**
 * Clarification requested from user when intent or entities are ambiguous.
 */
export interface ClarificationRequest {
  id: string;
  question: string;
  field: keyof SaathiEntities;
  options?: ClarificationOption[];
  contextHint?: string;
}

/**
 * Mutation confirmation requested from user before persisting changes.
 */
export interface ConfirmationRequest {
  id: string;
  actionType:
    | 'PLAN_OUTFIT'
    | 'RECORD_WEAR'
    | 'ADD_ITEM'
    | 'UPDATE_ITEM'
    | 'DELETE_ITEM'
    | 'UPDATE_PREFERENCES';
  title: string;
  description: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'confirmed' | 'cancelled';
}

/**
 * Reference to a domain result computed by an authoritative underlying engine.
 */
export type DomainResultType =
  | 'RECOMMENDATION'
  | 'STYLE_ITEM'
  | 'WARDROBE_SEARCH'
  | 'WEATHER'
  | 'WEAR_ANALYTICS'
  | 'STYLE_PROFILE'
  | 'WARDROBE_GAPS'
  | 'PURCHASE_ASSESSMENT'
  | 'FASHION_KNOWLEDGE'
  | 'PLAN_CREATED'
  | 'WEAR_RECORDED'
  | 'TREND_INTELLIGENCE'
  | 'ERROR';

export interface SaathiPurchaseAssessmentDetail {
  verdict: PurchaseAssessment | 'OPTIONAL_GAP' | 'WARDROBE_GAP' | 'INSUFFICIENT_INFORMATION' | 'NO_VALID_OUTFIT';
  purchaseAssessment: PurchaseAssessment;
  headline: string;
  summary: string;
  rediscoveryOpportunitiesCount: number;
  primaryReason: string;
  details?: string[];
  occasionGaps?: any[];
  confidenceScore?: number;
  occasion?: Occasion;
  occasionSubtype?: string;
  evaluatedPieces?: WardrobeItem[];
  recommendedLook?: GeneratedOutfit;
  missingRoles?: string[];
  laundryNotice?: string;
}

export interface DomainResultReference {
  type: DomainResultType;
  summary: string;
  outfits?: RecommendedOutfit[];
  missingRequirements?: MissingOutfitRequirement[];
  items?: WardrobeItem[];
  totalItems?: number;
  cleanItems?: number;
  weather?: any;
  wearReport?: WearAnalyticsReport;
  metrics?: Record<string, unknown>;
  gapReport?: WardrobeGapReport;
  purchaseAssessment?: PurchaseAssessment | SaathiPurchaseAssessmentDetail;
  knowledgeSignals?: FashionKnowledgeSignal[];
  createdPlan?: OutfitPlan;
  trends?: any[];
  data?: Record<string, unknown>;
}

/**
 * Single conversational message in AI Saathi thread.
 */
export interface SaathiMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: number;
  intent?: SaathiIntent;
  domainResult?: DomainResultReference;
  clarification?: ClarificationRequest;
  confirmation?: ConfirmationRequest;
  error?: string;
}

/**
 * Bounded, serializable, deterministic multi-turn conversation state.
 */
export interface SaathiConversationState {
  conversationId: string;
  messages: SaathiMessage[];
  activeIntent?: SaathiIntent;
  resolvedEntities: SaathiEntities;
  pendingClarification?: ClarificationRequest;
  pendingConfirmation?: ConfirmationRequest;
  lastDomainResult?: DomainResultReference;
  selectedOutfitId?: string;
  selectedLookIndex?: number;
  // Phase 1.10 Session Continuity
  activeAnchorItem?: WardrobeItem;
  activeOccasion?: Occasion;
  activeOccasionContext?: string;
  shownOutfitIds?: string[];
  activeOutfit?: GeneratedOutfit;
  activePurchaseAssessment?: SaathiPurchaseAssessmentDetail;
}

/**
 * Read-only context and verified mutation callbacks passed to domain tools.
 */
export interface SaathiToolContext {
  wardrobe: WardrobeItem[];
  preferences?: StylePreferences;
  styleProfile?: PersonalStyleProfile;
  plans?: OutfitPlan[];
  outfitPlans?: OutfitPlan[];
  wearEvents?: WearEvent[];
  wearLogs?: WearEvent[];
  weatherSnapshot?: ContextSnapshot | null;
  weather?: any;
  forecast?: any;
  freshness?: any;
  culturalSignals?: CulturalContextSignals;
  userId?: string;
  referenceTimestamp: number;
  localDate?: string; // YYYY-MM-DD
  wardrobeRepo?: any;
  outfitPlanRepo?: any;
  wearLogRepo?: any;
  // Domain mutation callbacks (invoked strictly upon user confirmation)
  onSavePlan?: (
    plan: Omit<OutfitPlan, 'id' | 'createdAt' | 'updatedAt'> | OutfitPlan
  ) => Promise<OutfitPlan>;
  onRecordWear?: (
    outfit: GeneratedOutfit,
    dateStr: string,
    accessory?: WardrobeItem | null
  ) => Promise<void>;
}

/**
 * Typed internal tool contract.
 */
export interface SaathiTool<TInput = Record<string, unknown>, TOutput = unknown> {
  readonly name: string;
  readonly description: string;
  readonly isMutation: boolean;
  readonly requiresConfirmation: boolean;
  execute(input: TInput, context: SaathiToolContext): Promise<TOutput>;
}

/**
 * Standard structured response model returned by AI Saathi orchestrator.
 */
export interface SaathiResponse {
  message: string;
  intent: SaathiIntent;
  domainResult?: DomainResultReference;
  clarification?: ClarificationRequest;
  confirmation?: ConfirmationRequest;
  updatedState: SaathiConversationState;
}

/**
 * Strongly typed domain errors in AI Saathi orchestration.
 */
export type SaathiErrorType =
  | 'INSUFFICIENT_CONTEXT'
  | 'ITEM_NOT_FOUND'
  | 'AMBIGUOUS_ITEM'
  | 'WEATHER_UNAVAILABLE'
  | 'RECOMMENDATION_UNAVAILABLE'
  | 'DOMAIN_ERROR'
  | 'CONFIRMATION_REQUIRED'
  | 'UNSUPPORTED_REQUEST';

export interface SaathiError {
  type: SaathiErrorType;
  message: string;
  details?: Record<string, unknown>;
}
