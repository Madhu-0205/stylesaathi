// ============================================================================
// STYLESAATHI 3.0 — DELTA SYNCHRONIZATION ENGINE TYPES
// Phase 3C: Workstreams 1, 2, 3, 4
// ============================================================================

export type SyncEntityType =
  | 'wardrobe_item'
  | 'saved_outfit'
  | 'calendar_plan'
  | 'style_preferences'
  | 'wear_event'
  | 'style_signal';

export type SyncAction = 'upsert' | 'delete' | 'append' | 'restore';

export type SyncMutationStatus =
  | 'applied'
  | 'already_applied'
  | 'conflict_server_wins'
  | 'rejected';

export interface SyncPushMutationInput {
  mutationId?: string;
  id?: string; // Client alias for mutationId
  entityType: SyncEntityType;
  entityId: string;
  action?: SyncAction;
  operation?: string; // Client alias: 'UPSERT' | 'DELETE' | 'APPEND_WEAR' | 'APPEND_SIGNAL'
  clientTimestamp: number;
  expectedRevision?: number; // Server-authoritative optimistic concurrency revision
  data?: Record<string, any>;
  payload?: Record<string, any>; // Client alias for data
  dependencies?: string[];
}

export interface SyncPushRequest {
  mutations: SyncPushMutationInput[];
}

export interface SyncMutationResult {
  mutationId: string;
  entityType: SyncEntityType;
  entityId: string;
  status: SyncMutationStatus;
  serverUpdatedAt?: string;
  serverRevision?: number;
  conflictData?: Record<string, any>;
  error?: string;
}

export interface SyncPushResponse {
  success: boolean;
  processed: number;
  results: SyncMutationResult[];
  serverTime: string;
}

export interface SyncPullChanges {
  wardrobe_items: Record<string, any>[];
  saved_outfits: Record<string, any>[];
  calendar_plans: Record<string, any>[];
  style_preferences: Record<string, any> | null;
  wear_events: Record<string, any>[];
  style_signals: Record<string, any>[];
}

export interface SyncPullResponse {
  success: boolean;
  changes: SyncPullChanges;
  nextCursor: string | null;
  hasMore: boolean;
  serverTime: string;
}

export interface PaginationCursor {
  table: string;
  ts: string;
  id: string;
}

