import {
  Occasion,
  Season,
  Category,
  Subcategory,
  Status,
  StylePreferences,
  GeneratedOutfit,
  OutfitPlan,
  WardrobeItem,
} from '../../types';

export const NEEDLE_TOOL_NAMES = [
  'recommend_outfit',
  'search_wardrobe',
  'record_wear',
  'create_style_plan',
  'search_style_preferences',
] as const;

export type NeedleToolName = (typeof NEEDLE_TOOL_NAMES)[number];

export function isNeedleToolName(value: unknown): value is NeedleToolName {
  return typeof value === 'string' && (NEEDLE_TOOL_NAMES as readonly string[]).includes(value);
}

export type NeedleConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export function getConfidenceTier(score: number): NeedleConfidenceLevel {
  if (score >= 0.8) return 'HIGH';
  if (score >= 0.5) return 'MEDIUM';
  return 'LOW';
}

export interface RecommendOutfitArgs {
  occasion: Occasion;
  style?: string;
  season?: Season;
}

export interface SearchWardrobeArgs {
  category?: Category;
  subcategory?: Subcategory;
  color?: string;
  status?: Status;
}

export interface RecordWearArgs {
  itemName: string;
  date?: string; // YYYY-MM-DD
}

export interface CreateStylePlanArgs {
  date: string; // YYYY-MM-DD
  occasion: Occasion;
  notes?: string;
}

export interface SearchStylePreferencesArgs {
  preferenceType?: 'contexts' | 'aesthetics' | 'stylingMode' | 'all';
}

export type NeedleToolArgsMap = {
  recommend_outfit: RecommendOutfitArgs;
  search_wardrobe: SearchWardrobeArgs;
  record_wear: RecordWearArgs;
  create_style_plan: CreateStylePlanArgs;
  search_style_preferences: SearchStylePreferencesArgs;
};

export interface RawNeedleToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export type NeedleEngineSource = 'needle_wasm' | 'semantic_fallback';

export interface ValidatedToolCall<T = Record<string, unknown>> {
  id: string;
  name: NeedleToolName;
  arguments: T;
  confidence: number;
  confidenceLevel: NeedleConfidenceLevel;
  isDestructive: boolean;
  requiresConfirmation: boolean;
  explanation: string;
  engine?: NeedleEngineSource;
  reasoning?: string;
}

export type NeedleModelStatus =
  | 'uninitialized'
  | 'checking_cache'
  | 'downloading'
  | 'loading_wasm'
  | 'ready'
  | 'error';

export type NeedleServiceStatus =
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'inferring'
  | 'executing'
  | 'awaiting_confirmation'
  | 'error';

export type NeedleWorkerInboundMessage =
  | { type: 'INIT_MODEL'; payload?: { modelUrl?: string; forceReload?: boolean } }
  | { type: 'INFER'; payload: { id: string; query: string; toolsJson: string } }
  | { type: 'GET_STATUS' };

export type NeedleWorkerOutboundMessage =
  | { type: 'STATUS_UPDATE'; payload: { status: NeedleModelStatus; progress?: number; error?: string } }
  | {
      type: 'INFER_RESULT';
      payload: {
        id: string;
        success: boolean;
        toolCall?: RawNeedleToolCall;
        confidence: number;
        reasoning?: string;
        engine?: NeedleEngineSource;
        error?: string;
      };
    };

export interface PendingAction {
  id: string;
  toolCall: ValidatedToolCall;
  query: string;
  explanation: string;
  createdAt: number;
}

export interface NeedleExecutionResult {
  query: string;
  toolCall?: ValidatedToolCall;
  executionStatus: 'executed' | 'pending_confirmation' | 'rejected' | 'failed';
  engine?: NeedleEngineSource;
  reasoning?: string;
  data?: {
    outfits?: GeneratedOutfit[];
    items?: WardrobeItem[];
    plan?: OutfitPlan;
    preferences?: StylePreferences;
    message?: string;
  };
  message: string;
}

export interface NeedleState {
  modelStatus: NeedleModelStatus;
  serviceStatus: NeedleServiceStatus;
  downloadProgress: number; // 0 - 100
  lastQuery: string | null;
  lastResult: NeedleExecutionResult | null;
  pendingConfirmation: PendingAction | null;
  error: string | null;
}
