// ============================================================================
// STYLESAATHI 3.0 — SYNC INPUT VALIDATION & GUARDS
// Workstream 2 & Workstream 6: Strict ₹0 & Local Image Boundaries
// ============================================================================

import type { SyncEntityType, SyncPushMutationInput, SyncAction } from './types';

export const MAX_PAYLOAD_BYTES = 512 * 1024; // 512 KB
export const MAX_MUTATIONS_PER_BATCH = 100;

export const VALID_ENTITY_TYPES: Set<SyncEntityType> = new Set([
  'wardrobe_item',
  'saved_outfit',
  'calendar_plan',
  'style_preferences',
  'wear_event',
  'style_signal',
]);

export const VALID_CATEGORIES = new Set([
  'Tops',
  'Bottoms',
  'Ethnic',
  'Dresses',
  'Outerwear',
  'Footwear',
  'Accessories',
]);

export const VALID_ITEM_STATUSES = new Set(['clean', 'needs_washing', 'in_laundry']);
export const VALID_PLAN_STATUSES = new Set(['planned', 'worn', 'cancelled']);
export const VALID_STYLING_MODES = new Set(['simple', 'variety', 'experiment']);

export interface NormalizedMutation {
  mutationId: string;
  entityType: SyncEntityType;
  entityId: string;
  action: SyncAction;
  clientTimestamp: number;
  expectedRevision?: number;
  data: Record<string, any>;
}

/**
 * Normalizes and validates an individual mutation in a push request.
 */
export function normalizeAndValidateMutation(
  input: SyncPushMutationInput,
  index: number
): { mutation?: NormalizedMutation; error?: string } {
  if (!input || typeof input !== 'object') {
    return { error: `Mutation at index ${index} must be an object` };
  }

  const mutationId = input.mutationId || input.id;
  if (!mutationId || typeof mutationId !== 'string' || mutationId.trim().length === 0) {
    return { error: `Mutation at index ${index} missing required 'mutationId'` };
  }

  if (!input.entityType || !VALID_ENTITY_TYPES.has(input.entityType)) {
    return {
      error: `Mutation ${mutationId} has invalid or unsupported entityType '${input.entityType}'`,
    };
  }

  const entityId = input.entityId || (input.data && input.data.id) || (input.payload && input.payload.id);
  if (input.entityType !== 'style_preferences' && (!entityId || typeof entityId !== 'string')) {
    return { error: `Mutation ${mutationId} missing required 'entityId'` };
  }

  // Resolve action from action or legacy operation
  let action: SyncAction = 'upsert';
  const op = (input.operation || '').toUpperCase();
  const act = (input.action || '').toLowerCase();

  if (op === 'DELETE' || act === 'delete') {
    action = 'delete';
  } else if (op === 'RESTORE' || act === 'restore') {
    action = 'restore';
  } else if (op === 'APPEND_WEAR' || op === 'APPEND_SIGNAL' || act === 'append') {
    action = 'append';
  } else {
    action = 'upsert';
  }

  const clientTimestamp =
    typeof input.clientTimestamp === 'number' && !isNaN(input.clientTimestamp) && input.clientTimestamp > 0
      ? input.clientTimestamp
      : Date.now();

  const data = (input.data || input.payload || {}) as Record<string, any>;

  // Server-authoritative revision expectation (Phase 3C.4 & Phase 3C.6)
  const rawExpectedRev =
    input.expectedRevision ??
    (data && (data.expectedRevision ?? data.revision ?? data.version));
  let expectedRevision: number | undefined = undefined;
  if (rawExpectedRev !== undefined && rawExpectedRev !== null) {
    if (
      typeof rawExpectedRev !== 'number' ||
      isNaN(rawExpectedRev) ||
      !Number.isInteger(rawExpectedRev) ||
      rawExpectedRev < 0
    ) {
      return {
        error: `Mutation ${mutationId} has invalid expectedRevision '${rawExpectedRev}'. Must be a non-negative integer.`,
      };
    }
    expectedRevision = rawExpectedRev;
  }

  // WORKSTREAM 6: Check for forbidden image binaries or large base64 strings in metadata
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      if (value.startsWith('data:image/') || (value.length > 50000 && !key.includes('json'))) {
        return {
          error: `Mutation ${mutationId} contains forbidden image data in field '${key}'. Garment images must remain device-local in IndexedDB.`,
        };
      }
    }
  }

  // Entity-specific validation
  if (action === 'upsert') {
    if (input.entityType === 'wardrobe_item') {
      if (!data.name || typeof data.name !== 'string') {
        return { error: `Mutation ${mutationId}: wardrobe_item requires a valid string 'name'` };
      }
      if (data.category && !VALID_CATEGORIES.has(data.category)) {
        return { error: `Mutation ${mutationId}: wardrobe_item has invalid category '${data.category}'` };
      }
      if (data.status && !VALID_ITEM_STATUSES.has(data.status)) {
        return { error: `Mutation ${mutationId}: wardrobe_item has invalid status '${data.status}'` };
      }
      if (data.formality !== undefined && (typeof data.formality !== 'number' || data.formality < 1 || data.formality > 5)) {
        return { error: `Mutation ${mutationId}: wardrobe_item formality must be between 1 and 5` };
      }
    } else if (input.entityType === 'calendar_plan') {
      if (!data.date || !/^\d{4}-\d{2}-\d{2}$/.test(String(data.date))) {
        return { error: `Mutation ${mutationId}: calendar_plan requires 'date' in YYYY-MM-DD format` };
      }
      if (data.status && !VALID_PLAN_STATUSES.has(data.status)) {
        return { error: `Mutation ${mutationId}: calendar_plan has invalid status '${data.status}'` };
      }
    } else if (input.entityType === 'style_preferences') {
      if (data.stylingMode && !VALID_STYLING_MODES.has(data.stylingMode)) {
        return { error: `Mutation ${mutationId}: style_preferences has invalid stylingMode '${data.stylingMode}'` };
      }
    }
  } else if (action === 'append') {
    if (input.entityType === 'wear_event') {
      const wardrobeItemId = data.wardrobeItemId || data.wardrobe_item_id;
      if (!wardrobeItemId || typeof wardrobeItemId !== 'string') {
        return { error: `Mutation ${mutationId}: wear_event requires a valid 'wardrobeItemId'` };
      }
    } else if (input.entityType === 'style_signal') {
      const signalType = data.signalType || data.signal_type;
      if (!signalType || typeof signalType !== 'string') {
        return { error: `Mutation ${mutationId}: style_signal requires a valid 'signalType'` };
      }
    }
  }

  return {
    mutation: {
      mutationId,
      entityType: input.entityType,
      entityId: entityId || 'preferences',
      action,
      clientTimestamp,
      expectedRevision,
      data,
    },
  };
}

