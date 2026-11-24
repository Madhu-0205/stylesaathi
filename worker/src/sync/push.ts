// ============================================================================
// STYLESAATHI 3.0 — AUTHENTICATED SYNC PUSH ENGINE
// Workstream 2, 4, & Phase 3C.4 Critical Sync Integrity Remediation
// Remediations:
// 1. Server-authoritative monotonic entity revisions & optimistic concurrency
// 2. Strict restore and delete correctness (elimination of unconditional bypasses)
// 3. Uniqueness-enforcing idempotency with concurrent collision recovery
// 4. Complete relationship ownership (object and string slot format support)
// 5. Indefinite tombstone retention & safe offline reconciliation
// ============================================================================

import type { D1Database, D1PreparedStatement } from '../types';
import type { NormalizedMutation } from './validation';
import type { SyncMutationResult } from './types';
import { sha256Hex } from '../auth/crypto';

/**
 * Parses an ISO string or epoch number to epoch milliseconds safely.
 */
function toEpochMs(val: any): number {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  const parsed = new Date(val).getTime();
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Produces a deterministic canonical JSON string for hashing.
 */
export function canonicalStringify(obj: any): string {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalStringify).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalStringify(obj[k])).join(',') + '}';
}

/**
 * Computes a SHA-256 digest of the canonical mutation contents to bind the idempotency token.
 * Phase 3C.4: Binds expectedRevision to ensure revision-retried mutations have distinct digests.
 */
export async function computePayloadHash(mutation: NormalizedMutation): Promise<string> {
  const canonicalObj = {
    action: mutation.action,
    entityId: mutation.entityId,
    entityType: mutation.entityType,
    expectedRevision: mutation.expectedRevision ?? null,
    data: mutation.data,
  };
  return await sha256Hex(canonicalStringify(canonicalObj));
}

/**
 * Checks whether an array of item IDs contains any IDs belonging to another user.
 * Cross-user reference attempt must be rejected (SEC-07).
 */
export async function verifyNoCrossUserItemReferences(
  db: D1Database,
  userId: string,
  itemIds: string[]
): Promise<boolean> {
  if (!itemIds || itemIds.length === 0) return true;

  for (const itemId of itemIds) {
    if (!itemId) continue;
    const foreignItem = await db
      .prepare('SELECT user_id FROM wardrobe_items WHERE id = ? AND user_id != ? LIMIT 1')
      .bind(itemId, userId)
      .first<{ user_id: string }>();

    if (foreignItem) {
      return false; // Cross-user reference detected!
    }
  }
  return true;
}

/**
 * Checks whether an array of saved outfit IDs contains any IDs belonging to another user.
 * Remediation for SEC-SYNC-03.
 */
export async function verifyNoCrossUserOutfitReferences(
  db: D1Database,
  userId: string,
  outfitIds: string[]
): Promise<boolean> {
  if (!outfitIds || outfitIds.length === 0) return true;

  for (const outfitId of outfitIds) {
    if (!outfitId) continue;
    const foreignOutfit = await db
      .prepare('SELECT user_id FROM saved_outfits WHERE id = ? AND user_id != ? LIMIT 1')
      .bind(outfitId, userId)
      .first<{ user_id: string }>();

    if (foreignOutfit) {
      return false; // Cross-user outfit reference detected!
    }
  }
  return true;
}

interface EntityHandlerOutput {
  result: SyncMutationResult;
  writeStmt?: D1PreparedStatement;
}

/**
 * Processes a batch of normalized sync mutations within the authenticated user's boundary.
 * Provides per-mutation atomicity via D1 batch execution of entity write + idempotency record.
 */
export async function processPushMutations(
  db: D1Database,
  userId: string,
  mutations: NormalizedMutation[]
): Promise<SyncMutationResult[]> {
  const results: SyncMutationResult[] = [];
  const serverNowIso = new Date().toISOString();
  const serverNowMs = Date.now();

  // 0. Deletion Tombstone & User Integrity Check (Phase 3E.2)
  // Prevent stale mutations from offline devices from resurrecting deleted accounts
  const userIdHash = await sha256Hex(userId);
  const tombstone = await db
    .prepare('SELECT request_id FROM deletion_tombstones WHERE user_id_hash = ? LIMIT 1')
    .bind(userIdHash)
    .first<{ request_id: string }>();

  if (tombstone) {
    for (const m of mutations) {
      results.push({
        mutationId: m.mutationId,
        entityType: m.entityType,
        entityId: m.entityId,
        status: 'rejected',
        error: 'ACCOUNT_DELETED: Stale mutation rejected. Account has been deleted.',
      });
    }
    return results;
  }

  const userExists = await db
    .prepare('SELECT id FROM user WHERE id = ? LIMIT 1')
    .bind(userId)
    .first<{ id: string }>();

  if (!userExists) {
    for (const m of mutations) {
      results.push({
        mutationId: m.mutationId,
        entityType: m.entityType,
        entityId: m.entityId,
        status: 'rejected',
        error: 'ACCOUNT_NOT_FOUND: User does not exist.',
      });
    }
    return results;
  }

  for (const m of mutations) {
    try {
      // 1. Compute canonical payload hash (SEC-SYNC-01 & Phase 3C.4)
      const payloadHash = await computePayloadHash(m);

      // 2. Idempotency check via sync_mutations
      const existingMutation = await db
        .prepare(
          'SELECT entity_type, entity_id, payload_hash, applied_at FROM sync_mutations WHERE user_id = ? AND mutation_id = ?'
        )
        .bind(userId, m.mutationId)
        .first<{ entity_type: string; entity_id: string; payload_hash: string; applied_at: string }>();

      if (existingMutation) {
        if (
          existingMutation.entity_type === m.entityType &&
          existingMutation.entity_id === m.entityId &&
          existingMutation.payload_hash === payloadHash
        ) {
          // Identical retry: return original result
          results.push({
            mutationId: m.mutationId,
            entityType: m.entityType,
            entityId: m.entityId,
            status: 'already_applied',
            serverUpdatedAt: existingMutation.applied_at,
          });
          continue;
        }

        // Entity mismatch
        if (existingMutation.entity_id !== m.entityId || existingMutation.entity_type !== m.entityType) {
          results.push({
            mutationId: m.mutationId,
            entityType: m.entityType,
            entityId: m.entityId,
            status: 'rejected',
            error: `IDEMPOTENCY_CONFLICT: Mutation ID '${m.mutationId}' was already applied for ${existingMutation.entity_type} '${existingMutation.entity_id}', cannot reuse for ${m.entityType} '${m.entityId}'.`,
          });
          continue;
        }

        // Payload hash mismatch
        results.push({
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'rejected',
          error: `IDEMPOTENCY_CONFLICT: Mutation ID '${m.mutationId}' was already applied with a different payload. Idempotency keys cannot be reused with differing payloads.`,
        });
        continue;
      }

      // 3. Process by entity type with clock-skew clamped timestamp (ARCH-SYNC-05)
      const effectiveClientTimestamp = Math.min(m.clientTimestamp, serverNowMs);

      let handlerOutput: EntityHandlerOutput;

      switch (m.entityType) {
        case 'wardrobe_item':
          handlerOutput = await handleWardrobeItem(db, userId, m, effectiveClientTimestamp, serverNowIso);
          break;
        case 'saved_outfit':
          handlerOutput = await handleSavedOutfit(db, userId, m, effectiveClientTimestamp, serverNowIso);
          break;
        case 'calendar_plan':
          handlerOutput = await handleCalendarPlan(db, userId, m, effectiveClientTimestamp, serverNowIso);
          break;
        case 'style_preferences':
          handlerOutput = await handleStylePreferences(db, userId, m, effectiveClientTimestamp, serverNowIso);
          break;
        case 'wear_event':
          handlerOutput = await handleWearEvent(db, userId, m, effectiveClientTimestamp, serverNowIso);
          break;
        case 'style_signal':
          handlerOutput = await handleStyleSignal(db, userId, m, effectiveClientTimestamp, serverNowIso);
          break;
        default:
          handlerOutput = {
            result: {
              mutationId: m.mutationId,
              entityType: m.entityType,
              entityId: m.entityId,
              status: 'rejected',
              error: `Unsupported entity type '${m.entityType}'`,
            },
          };
      }

      // 4. Atomic batch execution: execute entity write and idempotency record together (DATA-SYNC-04 & Phase 3C.4)
      if (handlerOutput.result.status === 'applied' && handlerOutput.writeStmt) {
        // Enforce uniqueness with strict INSERT INTO (replaces INSERT OR REPLACE)
        const idempotencyStmt = db
          .prepare(
            'INSERT INTO sync_mutations (mutation_id, user_id, entity_type, entity_id, payload_hash, applied_at) VALUES (?, ?, ?, ?, ?, ?)'
          )
          .bind(m.mutationId, userId, m.entityType, m.entityId, payloadHash, serverNowIso);

        try {
          await db.batch([handlerOutput.writeStmt, idempotencyStmt]);
        } catch (batchErr: any) {
          const errMsg = batchErr?.message || '';
          const isUniqueConstraint =
            errMsg.includes('UNIQUE constraint failed') ||
            errMsg.includes('PRIMARY KEY constraint failed');

          if (isUniqueConstraint && errMsg.includes('sync_mutations')) {
            // Concurrent race condition occurred! A racing request inserted the mutation_id first.
            const racingMutation = await db
              .prepare(
                'SELECT entity_type, entity_id, payload_hash, applied_at FROM sync_mutations WHERE user_id = ? AND mutation_id = ?'
              )
              .bind(userId, m.mutationId)
              .first<{ entity_type: string; entity_id: string; payload_hash: string; applied_at: string }>();

            if (racingMutation) {
              if (
                racingMutation.entity_type === m.entityType &&
                racingMutation.entity_id === m.entityId &&
                racingMutation.payload_hash === payloadHash
              ) {
                // Racing duplicate with identical payload: safely return already_applied
                results.push({
                  mutationId: m.mutationId,
                  entityType: m.entityType,
                  entityId: m.entityId,
                  status: 'already_applied',
                  serverUpdatedAt: racingMutation.applied_at,
                  serverRevision: handlerOutput.result.serverRevision,
                });
                continue;
              } else {
                // Racing collision with different payload/entity: reject
                results.push({
                  mutationId: m.mutationId,
                  entityType: m.entityType,
                  entityId: m.entityId,
                  status: 'rejected',
                  error: `IDEMPOTENCY_CONFLICT: Mutation ID '${m.mutationId}' was already applied with a different payload or entity target.`,
                });
                continue;
              }
            }
          }

          // Generic masked error handling without leaking raw SQL / DB internals
          results.push({
            mutationId: m.mutationId,
            entityType: m.entityType,
            entityId: m.entityId,
            status: 'rejected',
            error: 'Internal mutation processing error',
          });
          continue;
        }
      }

      results.push(handlerOutput.result);
    } catch (err: any) {
      results.push({
        mutationId: m.mutationId,
        entityType: m.entityType,
        entityId: m.entityId,
        status: 'rejected',
        error: err.message || 'Internal mutation processing error',
      });
    }
  }

  return results;
}

// ----------------------------------------------------------------------------
// Entity Handlers with Server-Authoritative Revision Control
// ----------------------------------------------------------------------------

async function handleWardrobeItem(
  db: D1Database,
  userId: string,
  m: NormalizedMutation,
  effectiveClientTimestamp: number,
  serverNowIso: string
): Promise<EntityHandlerOutput> {
  const existing = await db
    .prepare('SELECT * FROM wardrobe_items WHERE user_id = ? AND id = ?')
    .bind(userId, m.entityId)
    .first<any>();

  const currentRevision = typeof existing?.revision === 'number' ? existing.revision : 1;
  const expectedRevision = m.expectedRevision ?? (m.data && (m.data.expectedRevision ?? m.data.revision));
  const clientUpdatedIso = new Date(effectiveClientTimestamp).toISOString();

  // ACTION: DELETE
  if (m.action === 'delete') {
    const deletedAtMs = m.data.deletedAt
      ? Math.min(toEpochMs(m.data.deletedAt), effectiveClientTimestamp)
      : effectiveClientTimestamp;
    const deletedAtIso = new Date(deletedAtMs).toISOString();

    if (!existing) {
      // Insert tombstone so other devices learn of deletion
      const writeStmt = db.prepare(
        `INSERT INTO wardrobe_items (
           id, user_id, name, category, subcategory, formality, status,
           is_deleted, deleted_at, created_at, client_updated_at, server_updated_at, revision
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, 1)`
      ).bind(
        m.entityId,
        userId,
        m.data.name || 'Deleted Item',
        m.data.category || 'Tops',
        m.data.subcategory || 'T-Shirt',
        m.data.formality || 3,
        m.data.status || 'clean',
        deletedAtIso,
        clientUpdatedIso,
        clientUpdatedIso,
        serverNowIso
      );
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'applied',
          serverUpdatedAt: serverNowIso,
          serverRevision: 1,
        },
        writeStmt,
      };
    }

    // Existing record exists
    if (existing.is_deleted === 1) {
      // Already deleted: idempotent return
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'already_applied',
          serverUpdatedAt: existing.server_updated_at,
          serverRevision: currentRevision,
        },
      };
    }

    // Stale delete checks:
    // 1) Server-authoritative revision check (Phase 3C.6: expectedRevision strictly required for existing delete)
    if (expectedRevision === undefined || expectedRevision === null) {
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'rejected',
          error: 'REVISION_REQUIRED: expectedRevision is required to delete an existing wardrobe_item',
        },
      };
    }

    if (expectedRevision !== currentRevision) {
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'conflict_server_wins',
          conflictData: existing,
          serverUpdatedAt: existing.server_updated_at,
          serverRevision: currentRevision,
          error: `STALE_REVISION: Expected revision ${expectedRevision} does not match current server revision ${currentRevision}`,
        },
      };
    }

    const nextRevision = currentRevision + 1;
    const writeStmt = db.prepare(
      `UPDATE wardrobe_items
       SET is_deleted = 1, deleted_at = ?, revision = ?, client_updated_at = ?, server_updated_at = ?
       WHERE user_id = ? AND id = ?`
    ).bind(deletedAtIso, nextRevision, clientUpdatedIso, serverNowIso, userId, m.entityId);

    return {
      result: {
        mutationId: m.mutationId,
        entityType: m.entityType,
        entityId: m.entityId,
        status: 'applied',
        serverUpdatedAt: serverNowIso,
        serverRevision: nextRevision,
      },
      writeStmt,
    };
  }

  // ACTION: RESTORE
  if (m.action === 'restore') {
    if (!existing) {
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'rejected',
          error: 'RESTORE_TARGET_NOT_FOUND: Cannot restore an entity that does not exist in the tombstone store',
        },
      };
    }

    if (existing.is_deleted === 0) {
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'already_applied',
          serverUpdatedAt: existing.server_updated_at,
          serverRevision: currentRevision,
        },
      };
    }

    // Phase 3C.6: expectedRevision strictly required to restore a deleted entity
    if (expectedRevision === undefined || expectedRevision === null) {
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'rejected',
          error: 'REVISION_REQUIRED: expectedRevision is required to restore a deleted wardrobe_item',
        },
      };
    }

    if (expectedRevision !== currentRevision) {
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'conflict_server_wins',
          conflictData: existing,
          serverUpdatedAt: existing.server_updated_at,
          serverRevision: currentRevision,
          error: `STALE_REVISION: Expected revision ${expectedRevision} does not match current tombstone revision ${currentRevision}`,
        },
      };
    }

    // Valid restoration (revision-authoritative: device clock skew cannot block legitimate restoration)
    const d = m.data;
    const isVerified = existing.user_verified === 1 || Boolean(d.userVerified);
    const fabric = existing.user_verified === 1 && !d.userVerified ? existing.fabric : d.fabric ?? existing.fabric;
    const pattern = existing.user_verified === 1 && !d.userVerified ? existing.pattern : d.pattern ?? existing.pattern;
    const fit = existing.user_verified === 1 && !d.userVerified ? existing.fit : d.fit ?? existing.fit;
    const purchasePrice =
      existing.user_verified === 1 && !d.userVerified ? existing.purchase_price : d.purchasePrice ?? existing.purchase_price;
    const culturalContext =
      existing.user_verified === 1 && !d.userVerified
        ? existing.cultural_context
        : d.culturalContext ?? existing.cultural_context;

    const nextRevision = currentRevision + 1;
    const writeStmt = db.prepare(
      `UPDATE wardrobe_items SET
         name = ?,
         active_image_version_id = ?,
         storage_path = ?,
         photo_id = ?,
         photo_url = ?,
         category = ?,
         subcategory = ?,
         colors = ?,
         seasons = ?,
         occasions = ?,
         formality = ?,
         brand = ?,
         status = ?,
         favorite = ?,
         note = ?,
         times_worn = ?,
         last_worn = ?,
         fabric = ?,
         pattern = ?,
         fit = ?,
         purchase_price = ?,
         purchase_date = ?,
         cultural_context = ?,
         ai_confidence = ?,
         user_verified = ?,
         provenance = ?,
         is_deleted = 0,
         deleted_at = NULL,
         revision = ?,
         client_updated_at = ?,
         server_updated_at = ?
       WHERE user_id = ? AND id = ?`
    ).bind(
      d.name || existing.name,
      d.activeImageVersionId ?? existing.active_image_version_id,
      d.storagePath ?? existing.storage_path,
      d.photoId ?? existing.photo_id,
      d.photoUrl ?? existing.photo_url,
      d.category || existing.category,
      d.subcategory || existing.subcategory,
      JSON.stringify(d.colors || JSON.parse(existing.colors || '[]')),
      JSON.stringify(d.seasons || JSON.parse(existing.seasons || '[]')),
      JSON.stringify(d.occasions || JSON.parse(existing.occasions || '[]')),
      d.formality ?? existing.formality,
      d.brand ?? existing.brand,
      d.status || existing.status,
      d.favorite ? 1 : 0,
      d.note ?? existing.note,
      d.timesWorn ?? existing.times_worn,
      d.lastWorn ?? existing.last_worn,
      fabric,
      pattern,
      fit,
      purchasePrice,
      d.purchaseDate ?? existing.purchase_date,
      culturalContext,
      d.aiConfidence ?? existing.ai_confidence,
      isVerified ? 1 : 0,
      JSON.stringify(d.provenance || JSON.parse(existing.provenance || '{}')),
      nextRevision,
      clientUpdatedIso,
      serverNowIso,
      userId,
      m.entityId
    );

    return {
      result: {
        mutationId: m.mutationId,
        entityType: m.entityType,
        entityId: m.entityId,
        status: 'applied',
        serverUpdatedAt: serverNowIso,
        serverRevision: nextRevision,
      },
      writeStmt,
    };
  }

  // ACTION: UPSERT
  if (existing) {
    if (existing.is_deleted === 1) {
      // Tombstone protection: standard upserts cannot resurrect deleted items!
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'conflict_server_wins',
          conflictData: existing,
          serverUpdatedAt: existing.server_updated_at,
          serverRevision: currentRevision,
          error: 'TOMBSTONE_CONFLICT: Cannot update a deleted record. To restore, submit an explicit "restore" action.',
        },
      };
    }

    // Existing is active: check expected revision (Phase 3C.6: strictly required for existing updates)
    if (expectedRevision === undefined || expectedRevision === null) {
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'rejected',
          error: 'REVISION_REQUIRED: expectedRevision is required for updating an existing wardrobe_item',
        },
      };
    }

    if (expectedRevision !== currentRevision) {
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'conflict_server_wins',
          conflictData: existing,
          serverUpdatedAt: existing.server_updated_at,
          serverRevision: currentRevision,
          error: `STALE_REVISION: Expected revision ${expectedRevision} does not match current server revision ${currentRevision}`,
        },
      };
    }

    // Apply active upsert
    const d = m.data;
    const isVerified = existing.user_verified === 1 || Boolean(d.userVerified);
    const fabric = existing.user_verified === 1 && !d.userVerified ? existing.fabric : d.fabric ?? existing.fabric;
    const pattern = existing.user_verified === 1 && !d.userVerified ? existing.pattern : d.pattern ?? existing.pattern;
    const fit = existing.user_verified === 1 && !d.userVerified ? existing.fit : d.fit ?? existing.fit;
    const purchasePrice =
      existing.user_verified === 1 && !d.userVerified ? existing.purchase_price : d.purchasePrice ?? existing.purchase_price;
    const culturalContext =
      existing.user_verified === 1 && !d.userVerified
        ? existing.cultural_context
        : d.culturalContext ?? existing.cultural_context;

    const isDeletedFinal = d.isDeleted ? 1 : 0;
    const deletedAtFinal = d.deletedAt ? new Date(d.deletedAt).toISOString() : null;
    const nextRevision = currentRevision + 1;

    const writeStmt = db.prepare(
      `UPDATE wardrobe_items SET
         name = ?,
         active_image_version_id = ?,
         storage_path = ?,
         photo_id = ?,
         photo_url = ?,
         category = ?,
         subcategory = ?,
         colors = ?,
         seasons = ?,
         occasions = ?,
         formality = ?,
         brand = ?,
         status = ?,
         favorite = ?,
         note = ?,
         times_worn = ?,
         last_worn = ?,
         fabric = ?,
         pattern = ?,
         fit = ?,
         purchase_price = ?,
         purchase_date = ?,
         cultural_context = ?,
         ai_confidence = ?,
         user_verified = ?,
         provenance = ?,
         is_deleted = ?,
         deleted_at = ?,
         revision = ?,
         client_updated_at = ?,
         server_updated_at = ?
       WHERE user_id = ? AND id = ?`
    ).bind(
      d.name || existing.name,
      d.activeImageVersionId ?? existing.active_image_version_id,
      d.storagePath ?? existing.storage_path,
      d.photoId ?? existing.photo_id,
      d.photoUrl ?? existing.photo_url,
      d.category || existing.category,
      d.subcategory || existing.subcategory,
      JSON.stringify(d.colors || JSON.parse(existing.colors || '[]')),
      JSON.stringify(d.seasons || JSON.parse(existing.seasons || '[]')),
      JSON.stringify(d.occasions || JSON.parse(existing.occasions || '[]')),
      d.formality ?? existing.formality,
      d.brand ?? existing.brand,
      d.status || existing.status,
      d.favorite ? 1 : 0,
      d.note ?? existing.note,
      d.timesWorn ?? existing.times_worn,
      d.lastWorn ?? existing.last_worn,
      fabric,
      pattern,
      fit,
      purchasePrice,
      d.purchaseDate ?? existing.purchase_date,
      culturalContext,
      d.aiConfidence ?? existing.ai_confidence,
      isVerified ? 1 : 0,
      JSON.stringify(d.provenance || JSON.parse(existing.provenance || '{}')),
      isDeletedFinal,
      deletedAtFinal,
      nextRevision,
      clientUpdatedIso,
      serverNowIso,
      userId,
      m.entityId
    );

    return {
      result: {
        mutationId: m.mutationId,
        entityType: m.entityType,
        entityId: m.entityId,
        status: 'applied',
        serverUpdatedAt: serverNowIso,
        serverRevision: nextRevision,
      },
      writeStmt,
    };
  }

  // New item insertion (revision = 1)
  const d = m.data;
  const createdAtIso = d.createdAt ? new Date(d.createdAt).toISOString() : clientUpdatedIso;

  const writeStmt = db.prepare(
    `INSERT INTO wardrobe_items (
       id, user_id, name, active_image_version_id, storage_path, photo_id, photo_url,
       category, subcategory, colors, seasons, occasions, formality, brand, status,
       favorite, note, times_worn, last_worn, fabric, pattern, fit, purchase_price,
       purchase_date, cultural_context, ai_confidence, user_verified, provenance,
       is_deleted, deleted_at, created_at, client_updated_at, server_updated_at, revision
     ) VALUES (
       ?, ?, ?, ?, ?, ?, ?,
       ?, ?, ?, ?, ?, ?, ?, ?,
       ?, ?, ?, ?, ?, ?, ?, ?,
       ?, ?, ?, ?, ?,
       ?, ?, ?, ?, ?, 1
     )`
  ).bind(
    m.entityId,
    userId,
    d.name,
    d.activeImageVersionId || null,
    d.storagePath || null,
    d.photoId || null,
    d.photoUrl || null,
    d.category || 'Tops',
    d.subcategory || 'Other',
    JSON.stringify(d.colors || []),
    JSON.stringify(d.seasons || []),
    JSON.stringify(d.occasions || []),
    d.formality || 3,
    d.brand || null,
    d.status || 'clean',
    d.favorite ? 1 : 0,
    d.note || '',
    d.timesWorn || 0,
    d.lastWorn || null,
    d.fabric || null,
    d.pattern || null,
    d.fit || null,
    d.purchasePrice || null,
    d.purchaseDate || null,
    d.culturalContext || null,
    d.aiConfidence || null,
    d.userVerified ? 1 : 0,
    JSON.stringify(d.provenance || {}),
    d.isDeleted ? 1 : 0,
    d.deletedAt ? new Date(d.deletedAt).toISOString() : null,
    createdAtIso,
    clientUpdatedIso,
    serverNowIso
  );

  return {
    result: {
      mutationId: m.mutationId,
      entityType: m.entityType,
      entityId: m.entityId,
      status: 'applied',
      serverUpdatedAt: serverNowIso,
      serverRevision: 1,
    },
    writeStmt,
  };
}

async function handleSavedOutfit(
  db: D1Database,
  userId: string,
  m: NormalizedMutation,
  effectiveClientTimestamp: number,
  serverNowIso: string
): Promise<EntityHandlerOutput> {
  const d = m.data;
  const clientUpdatedIso = new Date(effectiveClientTimestamp).toISOString();

  // SEC-07 & Phase 3C.4: Extract all item IDs supporting both object and string shapes
  const slotsObj = d.outfit?.slots || d.slots || {};
  const referencedItemIds: string[] = Object.values(slotsObj)
    .flatMap((item: any) => {
      if (!item) return [];
      if (typeof item === 'string') return [item];
      if (Array.isArray(item)) {
        return item.map((i: any) => (typeof i === 'string' ? i : i?.id)).filter(Boolean);
      }
      if (item && typeof item === 'object' && typeof item.id === 'string') return [item.id];
      return [];
    })
    .filter(Boolean);

  const isValidOwnership = await verifyNoCrossUserItemReferences(db, userId, referencedItemIds);
  if (!isValidOwnership) {
    return {
      result: {
        mutationId: m.mutationId,
        entityType: m.entityType,
        entityId: m.entityId,
        status: 'rejected',
        error: 'REFERENTIAL_INTEGRITY_VIOLATION: Outfit slots reference wardrobe items belonging to another user.',
      },
    };
  }

  const existing = await db
    .prepare('SELECT * FROM saved_outfits WHERE user_id = ? AND id = ?')
    .bind(userId, m.entityId)
    .first<any>();

  const currentRevision = typeof existing?.revision === 'number' ? existing.revision : 1;
  const expectedRevision = m.expectedRevision ?? (d && (d.expectedRevision ?? d.revision));

  if (m.action === 'delete') {
    const deletedAtMs = d.deletedAt
      ? Math.min(toEpochMs(d.deletedAt), effectiveClientTimestamp)
      : effectiveClientTimestamp;
    const deletedAtIso = new Date(deletedAtMs).toISOString();

    if (!existing) {
      const writeStmt = db.prepare(
        `INSERT INTO saved_outfits (
           id, user_id, name, template, slots, score, why, is_deleted, deleted_at, created_at, client_updated_at, server_updated_at, revision
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, 1)`
      ).bind(
        m.entityId,
        userId,
        d.name || 'Deleted Outfit',
        'classic',
        '{}',
        0,
        '',
        deletedAtIso,
        clientUpdatedIso,
        clientUpdatedIso,
        serverNowIso
      );
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'applied',
          serverUpdatedAt: serverNowIso,
          serverRevision: 1,
        },
        writeStmt,
      };
    }

    if (existing.is_deleted === 1) {
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'already_applied',
          serverUpdatedAt: existing.server_updated_at,
          serverRevision: currentRevision,
        },
      };
    }

    if (expectedRevision === undefined || expectedRevision === null) {
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'rejected',
          error: 'REVISION_REQUIRED: expectedRevision is required to delete an existing saved_outfit',
        },
      };
    }

    if (expectedRevision !== currentRevision) {
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'conflict_server_wins',
          conflictData: existing,
          serverUpdatedAt: existing.server_updated_at,
          serverRevision: currentRevision,
          error: `STALE_REVISION: Expected revision ${expectedRevision} does not match current server revision ${currentRevision}`,
        },
      };
    }

    const nextRevision = currentRevision + 1;
    const writeStmt = db.prepare(
      'UPDATE saved_outfits SET is_deleted = 1, deleted_at = ?, revision = ?, client_updated_at = ?, server_updated_at = ? WHERE user_id = ? AND id = ?'
    ).bind(deletedAtIso, nextRevision, clientUpdatedIso, serverNowIso, userId, m.entityId);

    return {
      result: {
        mutationId: m.mutationId,
        entityType: m.entityType,
        entityId: m.entityId,
        status: 'applied',
        serverUpdatedAt: serverNowIso,
        serverRevision: nextRevision,
      },
      writeStmt,
    };
  }

  // ACTION: RESTORE
  if (m.action === 'restore') {
    if (!existing) {
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'rejected',
          error: 'RESTORE_TARGET_NOT_FOUND: Cannot restore non-existent outfit',
        },
      };
    }

    if (existing.is_deleted === 0) {
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'already_applied',
          serverUpdatedAt: existing.server_updated_at,
          serverRevision: currentRevision,
        },
      };
    }

    if (expectedRevision === undefined || expectedRevision === null) {
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'rejected',
          error: 'REVISION_REQUIRED: expectedRevision is required to restore a deleted saved_outfit',
        },
      };
    }

    if (expectedRevision !== currentRevision) {
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'conflict_server_wins',
          conflictData: existing,
          serverUpdatedAt: existing.server_updated_at,
          serverRevision: currentRevision,
          error: `STALE_REVISION: Expected revision ${expectedRevision} does not match current tombstone revision ${currentRevision}`,
        },
      };
    }

    const outfitName = d.name || d.outfit?.name || existing.name;
    const template =
      typeof d.outfit?.template === 'string'
        ? d.outfit.template
        : d.outfit?.template?.id || d.template || existing.template;
    const slots = JSON.stringify(d.outfit?.slots || d.slots || JSON.parse(existing.slots || '{}'));
    const score = d.outfit?.score ?? d.score ?? existing.score;
    const why = d.outfit?.why ?? d.why ?? existing.why;
    const nextRevision = currentRevision + 1;

    const writeStmt = db.prepare(
      `UPDATE saved_outfits SET
         name = ?, template = ?, slots = ?, score = ?, why = ?,
         is_deleted = 0, deleted_at = NULL, revision = ?, client_updated_at = ?, server_updated_at = ?
       WHERE user_id = ? AND id = ?`
    ).bind(
      outfitName,
      template,
      slots,
      score,
      why,
      nextRevision,
      clientUpdatedIso,
      serverNowIso,
      userId,
      m.entityId
    );

    return {
      result: {
        mutationId: m.mutationId,
        entityType: m.entityType,
        entityId: m.entityId,
        status: 'applied',
        serverUpdatedAt: serverNowIso,
        serverRevision: nextRevision,
      },
      writeStmt,
    };
  }

  // ACTION: UPSERT
  if (existing) {
    if (existing.is_deleted === 1) {
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'conflict_server_wins',
          conflictData: existing,
          serverUpdatedAt: existing.server_updated_at,
          serverRevision: currentRevision,
          error: 'TOMBSTONE_CONFLICT: Cannot update a deleted outfit. To restore, submit an explicit "restore" action.',
        },
      };
    }

    if (expectedRevision === undefined || expectedRevision === null) {
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'rejected',
          error: 'REVISION_REQUIRED: expectedRevision is required for updating an existing saved_outfit',
        },
      };
    }

    if (expectedRevision !== currentRevision) {
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'conflict_server_wins',
          conflictData: existing,
          serverUpdatedAt: existing.server_updated_at,
          serverRevision: currentRevision,
          error: `STALE_REVISION: Expected revision ${expectedRevision} does not match current server revision ${currentRevision}`,
        },
      };
    }

    const outfitName = d.name || d.outfit?.name || existing.name;
    const template =
      typeof d.outfit?.template === 'string'
        ? d.outfit.template
        : d.outfit?.template?.id || d.template || existing.template;
    const slots = JSON.stringify(d.outfit?.slots || d.slots || JSON.parse(existing.slots || '{}'));
    const score = d.outfit?.score ?? d.score ?? existing.score;
    const why = d.outfit?.why ?? d.why ?? existing.why;
    const isDeletedFinal = d.isDeleted ? 1 : 0;
    const deletedAtFinal = d.deletedAt ? new Date(d.deletedAt).toISOString() : null;
    const nextRevision = currentRevision + 1;

    const writeStmt = db.prepare(
      `UPDATE saved_outfits SET
         name = ?, template = ?, slots = ?, score = ?, why = ?,
         is_deleted = ?, deleted_at = ?, revision = ?, client_updated_at = ?, server_updated_at = ?
       WHERE user_id = ? AND id = ?`
    ).bind(
      outfitName,
      template,
      slots,
      score,
      why,
      isDeletedFinal,
      deletedAtFinal,
      nextRevision,
      clientUpdatedIso,
      serverNowIso,
      userId,
      m.entityId
    );

    return {
      result: {
        mutationId: m.mutationId,
        entityType: m.entityType,
        entityId: m.entityId,
        status: 'applied',
        serverUpdatedAt: serverNowIso,
        serverRevision: nextRevision,
      },
      writeStmt,
    };
  }

  // New outfit insertion (revision = 1)
  const outfitName = d.name || d.outfit?.name || 'Saved Outfit';
  const template =
    typeof d.outfit?.template === 'string'
      ? d.outfit.template
      : d.outfit?.template?.id || d.template || 'classic';
  const slots = JSON.stringify(d.outfit?.slots || d.slots || {});
  const score = d.outfit?.score ?? d.score ?? 0;
  const why = d.outfit?.why ?? d.why ?? '';
  const createdAtIso = d.savedAt ? new Date(d.savedAt).toISOString() : clientUpdatedIso;

  const writeStmt = db.prepare(
    `INSERT INTO saved_outfits (
       id, user_id, name, template, slots, score, why,
       is_deleted, deleted_at, created_at, client_updated_at, server_updated_at, revision
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
  ).bind(
    m.entityId,
    userId,
    outfitName,
    template,
    slots,
    score,
    why,
    d.isDeleted ? 1 : 0,
    d.deletedAt ? new Date(d.deletedAt).toISOString() : null,
    createdAtIso,
    clientUpdatedIso,
    serverNowIso
  );

  return {
    result: {
      mutationId: m.mutationId,
      entityType: m.entityType,
      entityId: m.entityId,
      status: 'applied',
      serverUpdatedAt: serverNowIso,
      serverRevision: 1,
    },
    writeStmt,
  };
}

async function handleCalendarPlan(
  db: D1Database,
  userId: string,
  m: NormalizedMutation,
  effectiveClientTimestamp: number,
  serverNowIso: string
): Promise<EntityHandlerOutput> {
  const d = m.data;
  const clientUpdatedIso = new Date(effectiveClientTimestamp).toISOString();

  // SEC-07 & Phase 3C.4: Verify wardrobe item references (supporting string or object shape)
  const referencedItemIds: string[] = [];
  if (typeof d.accessory === 'string') referencedItemIds.push(d.accessory);
  else if (d.accessory?.id) referencedItemIds.push(d.accessory.id);
  if (d.accessoryItemId) referencedItemIds.push(d.accessoryItemId);
  if (d.outfit?.slots) {
    Object.values(d.outfit.slots).forEach((item: any) => {
      if (typeof item === 'string') referencedItemIds.push(item);
      else if (Array.isArray(item)) {
        item.forEach((i: any) => {
          if (typeof i === 'string') referencedItemIds.push(i);
          else if (i?.id) referencedItemIds.push(i.id);
        });
      } else if (item?.id) referencedItemIds.push(item.id);
    });
  }

  const isValidOwnership = await verifyNoCrossUserItemReferences(db, userId, referencedItemIds);
  if (!isValidOwnership) {
    return {
      result: {
        mutationId: m.mutationId,
        entityType: m.entityType,
        entityId: m.entityId,
        status: 'rejected',
        error: 'REFERENTIAL_INTEGRITY_VIOLATION: Calendar plan references wardrobe items belonging to another user.',
      },
    };
  }

  // SEC-SYNC-03: Verify referenced outfit does not belong to another user
  const outfitId = typeof d.outfit === 'string' ? d.outfit : d.outfitId || d.outfit_id || d.outfit?.id;
  if (outfitId) {
    const isValidOutfit = await verifyNoCrossUserOutfitReferences(db, userId, [outfitId]);
    if (!isValidOutfit) {
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'rejected',
          error: `REFERENTIAL_INTEGRITY_VIOLATION: Calendar plan references outfit '${outfitId}' belonging to another user.`,
        },
      };
    }
  }

  const existing = await db
    .prepare('SELECT * FROM calendar_plans WHERE user_id = ? AND (id = ? OR date = ?)')
    .bind(userId, m.entityId, d.date || '')
    .first<any>();

  const currentRevision = typeof existing?.revision === 'number' ? existing.revision : 1;
  const expectedRevision = m.expectedRevision ?? (d && (d.expectedRevision ?? d.revision));

  if (m.action === 'delete') {
    const deletedAtMs = d.deletedAt
      ? Math.min(toEpochMs(d.deletedAt), effectiveClientTimestamp)
      : effectiveClientTimestamp;
    const deletedAtIso = new Date(deletedAtMs).toISOString();

    if (!existing) {
      const writeStmt = db.prepare(
        'INSERT INTO calendar_plans (id, user_id, date, occasion, status, outfit, accessory, is_deleted, deleted_at, created_at, client_updated_at, server_updated_at, revision) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, 1)'
      ).bind(
        m.entityId,
        userId,
        d.date || '1970-01-01',
        d.occasion || 'General',
        'planned',
        '{}',
        null,
        deletedAtIso,
        clientUpdatedIso,
        clientUpdatedIso,
        serverNowIso
      );
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'applied',
          serverUpdatedAt: serverNowIso,
          serverRevision: 1,
        },
        writeStmt,
      };
    }

    if (existing.is_deleted === 1) {
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'already_applied',
          serverUpdatedAt: existing.server_updated_at,
          serverRevision: currentRevision,
        },
      };
    }

    if (expectedRevision === undefined || expectedRevision === null) {
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'rejected',
          error: 'REVISION_REQUIRED: expectedRevision is required to delete an existing calendar_plan',
        },
      };
    }

    if (expectedRevision !== currentRevision) {
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'conflict_server_wins',
          conflictData: existing,
          serverUpdatedAt: existing.server_updated_at,
          serverRevision: currentRevision,
          error: `STALE_REVISION: Expected revision ${expectedRevision} does not match current server revision ${currentRevision}`,
        },
      };
    }

    const nextRevision = currentRevision + 1;
    const writeStmt = db.prepare(
      'UPDATE calendar_plans SET is_deleted = 1, deleted_at = ?, revision = ?, client_updated_at = ?, server_updated_at = ? WHERE user_id = ? AND id = ?'
    ).bind(deletedAtIso, nextRevision, clientUpdatedIso, serverNowIso, userId, existing.id);

    return {
      result: {
        mutationId: m.mutationId,
        entityType: m.entityType,
        entityId: m.entityId,
        status: 'applied',
        serverUpdatedAt: serverNowIso,
        serverRevision: nextRevision,
      },
      writeStmt,
    };
  }

  // ACTION: RESTORE
  if (m.action === 'restore') {
    if (!existing) {
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'rejected',
          error: 'RESTORE_TARGET_NOT_FOUND: Cannot restore non-existent calendar plan',
        },
      };
    }

    if (existing.is_deleted === 0) {
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'already_applied',
          serverUpdatedAt: existing.server_updated_at,
          serverRevision: currentRevision,
        },
      };
    }

    if (expectedRevision === undefined || expectedRevision === null) {
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'rejected',
          error: 'REVISION_REQUIRED: expectedRevision is required to restore a deleted calendar_plan',
        },
      };
    }

    if (expectedRevision !== currentRevision) {
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'conflict_server_wins',
          conflictData: existing,
          serverUpdatedAt: existing.server_updated_at,
          serverRevision: currentRevision,
          error: `STALE_REVISION: Expected revision ${expectedRevision} does not match current tombstone revision ${currentRevision}`,
        },
      };
    }

    const outfit = JSON.stringify(d.outfit || JSON.parse(existing.outfit || '{}'));
    const accessory = d.accessory ? JSON.stringify(d.accessory) : existing.accessory;
    const occasion = d.occasion || existing.occasion;
    const planStatus = d.status || existing.status;
    const nextRevision = currentRevision + 1;

    const writeStmt = db.prepare(
      `UPDATE calendar_plans SET
         outfit = ?, accessory = ?, occasion = ?, status = ?,
         is_deleted = 0, deleted_at = NULL, revision = ?, client_updated_at = ?, server_updated_at = ?
       WHERE user_id = ? AND id = ?`
    ).bind(
      outfit,
      accessory,
      occasion,
      planStatus,
      nextRevision,
      clientUpdatedIso,
      serverNowIso,
      userId,
      existing.id
    );

    return {
      result: {
        mutationId: m.mutationId,
        entityType: m.entityType,
        entityId: m.entityId,
        status: 'applied',
        serverUpdatedAt: serverNowIso,
        serverRevision: nextRevision,
      },
      writeStmt,
    };
  }

  // ACTION: UPSERT
  if (existing) {
    if (existing.is_deleted === 1) {
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'conflict_server_wins',
          conflictData: existing,
          serverUpdatedAt: existing.server_updated_at,
          serverRevision: currentRevision,
          error: 'TOMBSTONE_CONFLICT: Cannot update a deleted calendar plan. To restore, submit an explicit "restore" action.',
        },
      };
    }

    if (expectedRevision === undefined || expectedRevision === null) {
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'rejected',
          error: 'REVISION_REQUIRED: expectedRevision is required for updating an existing calendar_plan',
        },
      };
    }

    if (expectedRevision !== currentRevision) {
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'conflict_server_wins',
          conflictData: existing,
          serverUpdatedAt: existing.server_updated_at,
          serverRevision: currentRevision,
          error: `STALE_REVISION: Expected revision ${expectedRevision} does not match current server revision ${currentRevision}`,
        },
      };
    }

    const outfit = JSON.stringify(d.outfit || JSON.parse(existing.outfit || '{}'));
    const accessory = d.accessory ? JSON.stringify(d.accessory) : existing.accessory;
    const occasion = d.occasion || existing.occasion;
    const planStatus = d.status || existing.status;

    if ((existing.status === 'worn' || existing.status === 'cancelled') && planStatus === 'planned') {
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'conflict_server_wins',
          conflictData: existing,
          serverUpdatedAt: existing.server_updated_at,
          serverRevision: currentRevision,
          error: 'MONOTONIC_STATUS_CONFLICT: cannot revert worn/cancelled plan to planned',
        },
      };
    }

    const isDeletedFinal = d.isDeleted ? 1 : 0;
    const deletedAtFinal = d.deletedAt ? new Date(d.deletedAt).toISOString() : null;
    const nextRevision = currentRevision + 1;

    const writeStmt = db.prepare(
      `UPDATE calendar_plans SET
         outfit = ?, accessory = ?, occasion = ?, status = ?,
         is_deleted = ?, deleted_at = ?, revision = ?, client_updated_at = ?, server_updated_at = ?
       WHERE user_id = ? AND id = ?`
    ).bind(
      outfit,
      accessory,
      occasion,
      planStatus,
      isDeletedFinal,
      deletedAtFinal,
      nextRevision,
      clientUpdatedIso,
      serverNowIso,
      userId,
      existing.id
    );

    return {
      result: {
        mutationId: m.mutationId,
        entityType: m.entityType,
        entityId: m.entityId,
        status: 'applied',
        serverUpdatedAt: serverNowIso,
        serverRevision: nextRevision,
      },
      writeStmt,
    };
  }

  // New calendar plan insertion (revision = 1)
  const outfit = JSON.stringify(d.outfit || {});
  const accessory = d.accessory ? JSON.stringify(d.accessory) : null;
  const createdAtIso = d.createdAt ? new Date(d.createdAt).toISOString() : clientUpdatedIso;

  const writeStmt = db.prepare(
    `INSERT INTO calendar_plans (
       id, user_id, date, occasion, status, outfit, accessory,
       is_deleted, deleted_at, created_at, client_updated_at, server_updated_at, revision
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
  ).bind(
    m.entityId,
    userId,
    d.date,
    d.occasion || 'General',
    d.status || 'planned',
    outfit,
    accessory,
    d.isDeleted ? 1 : 0,
    d.deletedAt ? new Date(d.deletedAt).toISOString() : null,
    createdAtIso,
    clientUpdatedIso,
    serverNowIso
  );

  return {
    result: {
      mutationId: m.mutationId,
      entityType: m.entityType,
      entityId: m.entityId,
      status: 'applied',
      serverUpdatedAt: serverNowIso,
      serverRevision: 1,
    },
    writeStmt,
  };
}

async function handleStylePreferences(
  db: D1Database,
  userId: string,
  m: NormalizedMutation,
  effectiveClientTimestamp: number,
  serverNowIso: string
): Promise<EntityHandlerOutput> {
  const d = m.data;
  const clientUpdatedIso = new Date(effectiveClientTimestamp).toISOString();

  const existing = await db
    .prepare('SELECT * FROM style_preferences WHERE user_id = ?')
    .bind(userId)
    .first<any>();

  const currentRevision = typeof existing?.revision === 'number' ? existing.revision : 1;
  const expectedRevision = m.expectedRevision ?? (d && (d.expectedRevision ?? d.revision));

  if (existing) {
    if (expectedRevision === undefined || expectedRevision === null) {
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'rejected',
          error: 'REVISION_REQUIRED: expectedRevision is required for updating existing style_preferences',
        },
      };
    }

    if (expectedRevision !== currentRevision) {
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'conflict_server_wins',
          conflictData: existing,
          serverUpdatedAt: existing.server_updated_at,
          serverRevision: currentRevision,
          error: `STALE_REVISION: Expected revision ${expectedRevision} does not match current server revision ${currentRevision}`,
        },
      };
    }

    const preferredContexts = JSON.stringify(
      d.preferredContexts || JSON.parse(existing.preferred_contexts || '[]')
    );
    const preferredAesthetics = JSON.stringify(
      d.preferredAesthetics || JSON.parse(existing.preferred_aesthetics || '[]')
    );
    const stylingMode = d.stylingMode || existing.styling_mode || 'variety';
    const nextRevision = currentRevision + 1;

    const writeStmt = db.prepare(
      `UPDATE style_preferences SET
         preferred_contexts = ?, preferred_aesthetics = ?, styling_mode = ?, revision = ?,
         client_updated_at = ?, server_updated_at = ?
       WHERE user_id = ?`
    ).bind(preferredContexts, preferredAesthetics, stylingMode, nextRevision, clientUpdatedIso, serverNowIso, userId);

    return {
      result: {
        mutationId: m.mutationId,
        entityType: m.entityType,
        entityId: m.entityId,
        status: 'applied',
        serverUpdatedAt: serverNowIso,
        serverRevision: nextRevision,
      },
      writeStmt,
    };
  }

  const preferredContexts = JSON.stringify(d.preferredContexts || []);
  const preferredAesthetics = JSON.stringify(d.preferredAesthetics || []);
  const stylingMode = d.stylingMode || 'variety';

  const writeStmt = db.prepare(
    `INSERT INTO style_preferences (
       user_id, preferred_contexts, preferred_aesthetics, styling_mode,
       client_updated_at, server_updated_at, revision
     ) VALUES (?, ?, ?, ?, ?, ?, 1)`
  ).bind(userId, preferredContexts, preferredAesthetics, stylingMode, clientUpdatedIso, serverNowIso);

  return {
    result: {
      mutationId: m.mutationId,
      entityType: m.entityType,
      entityId: m.entityId,
      status: 'applied',
      serverUpdatedAt: serverNowIso,
      serverRevision: 1,
    },
    writeStmt,
  };
}

async function handleWearEvent(
  db: D1Database,
  userId: string,
  m: NormalizedMutation,
  effectiveClientTimestamp: number,
  serverNowIso: string
): Promise<EntityHandlerOutput> {
  const d = m.data;
  const wardrobeItemId = d.wardrobeItemId || d.wardrobe_item_id;
  const outfitId = d.outfitId || d.outfit_id;

  // 1. Verify parent wardrobe item belongs to this user
  const parentItem = await db
    .prepare('SELECT id FROM wardrobe_items WHERE user_id = ? AND id = ?')
    .bind(userId, wardrobeItemId)
    .first<any>();

  if (!parentItem) {
    return {
      result: {
        mutationId: m.mutationId,
        entityType: m.entityType,
        entityId: m.entityId,
        status: 'rejected',
        error: `REFERENTIAL_INTEGRITY_VIOLATION: Wardrobe item '${wardrobeItemId}' does not exist or belongs to another user.`,
      },
    };
  }

  // 2. SEC-SYNC-03: Verify outfitId does not belong to another user
  if (outfitId) {
    const isValidOutfit = await verifyNoCrossUserOutfitReferences(db, userId, [outfitId]);
    if (!isValidOutfit) {
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'rejected',
          error: `REFERENTIAL_INTEGRITY_VIOLATION: Wear event references outfit '${outfitId}' belonging to another user.`,
        },
      };
    }
  }

  const existing = await db
    .prepare('SELECT id FROM wear_events WHERE user_id = ? AND id = ?')
    .bind(userId, m.entityId)
    .first<any>();

  if (existing) {
    return {
      result: {
        mutationId: m.mutationId,
        entityType: m.entityType,
        entityId: m.entityId,
        status: 'already_applied',
        serverUpdatedAt: serverNowIso,
      },
    };
  }

  const wornAt = d.wornAt || d.worn_at || serverNowIso;
  const createdAt = d.createdAt ? new Date(d.createdAt).toISOString() : serverNowIso;

  const writeStmt = db.prepare(
    `INSERT INTO wear_events (id, user_id, wardrobe_item_id, outfit_id, planned_date, worn_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    m.entityId,
    userId,
    wardrobeItemId,
    outfitId || null,
    d.plannedDate || d.planned_date || null,
    wornAt,
    createdAt
  );

  return {
    result: {
      mutationId: m.mutationId,
      entityType: m.entityType,
      entityId: m.entityId,
      status: 'applied',
      serverUpdatedAt: serverNowIso,
    },
    writeStmt,
  };
}

async function handleStyleSignal(
  db: D1Database,
  userId: string,
  m: NormalizedMutation,
  effectiveClientTimestamp: number,
  serverNowIso: string
): Promise<EntityHandlerOutput> {
  const d = m.data;
  const rawItemIds = d.itemIds || d.item_ids || [];
  const itemIds: string[] = Array.isArray(rawItemIds)
    ? rawItemIds.map((item: any) => (typeof item === 'string' ? item : item?.id)).filter(Boolean)
    : [];
  const outfitId = d.outfitId || d.outfit_id;

  // 1. Verify wardrobe items do not belong to another user
  const isValidItems = await verifyNoCrossUserItemReferences(db, userId, itemIds);
  if (!isValidItems) {
    return {
      result: {
        mutationId: m.mutationId,
        entityType: m.entityType,
        entityId: m.entityId,
        status: 'rejected',
        error: 'REFERENTIAL_INTEGRITY_VIOLATION: Style signal references wardrobe items belonging to another user.',
      },
    };
  }

  // 2. SEC-SYNC-03: Verify outfitId does not belong to another user
  if (outfitId) {
    const isValidOutfit = await verifyNoCrossUserOutfitReferences(db, userId, [outfitId]);
    if (!isValidOutfit) {
      return {
        result: {
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'rejected',
          error: `REFERENTIAL_INTEGRITY_VIOLATION: Style signal references outfit '${outfitId}' belonging to another user.`,
        },
      };
    }
  }

  const existing = await db
    .prepare('SELECT id FROM style_signals WHERE user_id = ? AND id = ?')
    .bind(userId, m.entityId)
    .first<any>();

  if (existing) {
    return {
      result: {
        mutationId: m.mutationId,
        entityType: m.entityType,
        entityId: m.entityId,
        status: 'already_applied',
        serverUpdatedAt: serverNowIso,
      },
    };
  }

  const signalType = d.signalType || d.signal_type;
  const createdAt = d.createdAt ? new Date(d.createdAt).toISOString() : serverNowIso;

  const writeStmt = db.prepare(
    `INSERT INTO style_signals (id, user_id, signal_type, outfit_id, item_ids, occasion, season, rejection_reason, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    m.entityId,
    userId,
    signalType,
    outfitId || null,
    JSON.stringify(itemIds),
    d.occasion || null,
    d.season || null,
    d.rejectionReason || d.rejection_reason || null,
    d.note || null,
    createdAt
  );

  return {
    result: {
      mutationId: m.mutationId,
      entityType: m.entityType,
      entityId: m.entityId,
      status: 'applied',
      serverUpdatedAt: serverNowIso,
    },
    writeStmt,
  };
}
