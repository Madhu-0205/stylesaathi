import { WardrobeItem, OutfitPlan, StylePreferences, SavedOutfit, PlanStatus } from '../../types';

function parseServerTimestamp(ts?: string | number | null): number {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  const parsed = new Date(ts).getTime();
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Resolves conflict between local and remote WardrobeItem:
 * 1. Tombstone protection: if either is deleted, deleted state wins permanently.
 * 2. Clock-Skew-Safe Server Timeline:
 *    - client_updated_at is NEVER directly compared against server_updated_at.
 *    - Authoritative ordering uses database-controlled server_updated_at.
 *    - If both have server_updated_at, the newer server timestamp wins.
 *    - If server timestamps are equal, tie-break deterministically without clock bias.
 * 3. Image Authority:
 *    - active_image_version_id and storage_path are authoritative.
 *    - An obsolete/stale photo_url NEVER overrides activeImageVersionId or storagePath.
 */
export function resolveWardrobeItemConflict(
  local: WardrobeItem,
  remote: WardrobeItem
): WardrobeItem {
  // 1. TOMBSTONES - Deleted records always win to prevent zombie resurrection
  if (local.isDeleted && !remote.isDeleted) {
    return {
      ...local,
      deletedAt: local.deletedAt || Date.now(),
    };
  }
  if (!local.isDeleted && remote.isDeleted) {
    return {
      ...remote,
      deletedAt: remote.deletedAt || Date.now(),
    };
  }
  if (local.isDeleted && remote.isDeleted) {
    const localDel = local.deletedAt || 0;
    const remoteDel = remote.deletedAt || 0;
    return localDel >= remoteDel ? local : remote;
  }

  // 2. Server-Authoritative Timeline Comparison
  const localServerTime = parseServerTimestamp(local.serverUpdatedAt);
  const remoteServerTime = parseServerTimestamp(remote.serverUpdatedAt);

  let winner: WardrobeItem;

  if (remoteServerTime > localServerTime) {
    winner = remote;
  } else if (localServerTime > remoteServerTime) {
    winner = local;
  } else {
    // Both share the same server commit point or are uncommitted
    // Never compare clientUpdatedAt to serverUpdatedAt!
    // Deterministically compare clientUpdatedAt against clientUpdatedAt only
    const localClient = local.clientUpdatedAt || local.createdAt || 0;
    const remoteClient = remote.clientUpdatedAt || remote.createdAt || 0;
    if (localClient !== remoteClient) {
      winner = localClient > remoteClient ? local : remote;
    } else {
      // Deterministic tie-breaker based on ID/name
      winner = (local.id || '').localeCompare(remote.id || '') >= 0 ? local : remote;
    }
  }

  // 3. Authoritative Image Source of Truth:
  // The authoritative cloud image identity is:
  //   active_image_version_id -> wardrobe_image_versions.storage_path
  // photo_url is ephemeral display cache / legacy and must NEVER override the active image version.
  const activeImageId =
    winner.activeImageVersionId ||
    local.activeImageVersionId ||
    remote.activeImageVersionId ||
    winner.photoId;

  const storagePath =
    (activeImageId && activeImageId === winner.activeImageVersionId && winner.storagePath) ||
    (activeImageId && activeImageId === local.activeImageVersionId && local.storagePath) ||
    (activeImageId && activeImageId === remote.activeImageVersionId && remote.storagePath) ||
    winner.storagePath ||
    local.storagePath ||
    remote.storagePath;

  // Derive photoUrl safely: only match the active image version, never allow a stale photo_url to override
  let photoUrl: string | undefined;
  if (activeImageId) {
    if (winner.activeImageVersionId === activeImageId && winner.photoUrl) {
      photoUrl = winner.photoUrl;
    } else if (local.activeImageVersionId === activeImageId && local.photoUrl) {
      photoUrl = local.photoUrl;
    } else if (remote.activeImageVersionId === activeImageId && remote.photoUrl) {
      photoUrl = remote.photoUrl;
    }
  } else {
    photoUrl = winner.photoUrl || local.photoUrl || remote.photoUrl;
  }

  return {
    ...winner,
    activeImageVersionId: activeImageId,
    photoId: activeImageId,
    storagePath: storagePath,
    photoUrl: photoUrl,
  };
}

/**
 * Resolves conflict between local and remote CalendarPlan for the same date:
 * 1. Tombstone protection: deleted wins.
 * 2. Monotonic status invariant:
 *    - planned -> worn (ALLOWED)
 *    - planned -> cancelled (ALLOWED)
 *    - worn -> worn (ALLOWED)
 *    - Stale sync must NEVER cause:
 *        worn -> planned (FORBIDDEN)
 *        worn -> cancelled (FORBIDDEN)
 *        cancelled -> planned (FORBIDDEN)
 *        cancelled -> worn (FORBIDDEN)
 * 3. Server timestamp resolution for plan content (outfit, occasion, accessory).
 */
export function resolveCalendarPlanConflict(
  local: OutfitPlan,
  remote: OutfitPlan
): OutfitPlan {
  // 1. Tombstone protection
  if (local.isDeleted && !remote.isDeleted) return local;
  if (!local.isDeleted && remote.isDeleted) return remote;
  if (local.isDeleted && remote.isDeleted) {
    return (local.deletedAt || 0) >= (remote.deletedAt || 0) ? local : remote;
  }

  // 2. Monotonic Status Invariant:
  // - Local 'worn' is terminal against stale sync (cannot revert to planned or cancelled).
  // - Local 'cancelled' cannot be resurrected to planned or changed to worn by stale sync.
  // - Local 'planned' can transition to remote 'worn' or 'cancelled'.
  let effectiveStatus: PlanStatus = 'planned';
  if (local.status === 'worn') {
    effectiveStatus = 'worn';
  } else if (local.status === 'cancelled') {
    effectiveStatus = 'cancelled';
  } else if (remote.status === 'worn') {
    effectiveStatus = 'worn';
  } else if (remote.status === 'cancelled') {
    effectiveStatus = 'cancelled';
  } else {
    effectiveStatus = 'planned';
  }

  // 3. Server-Authoritative Timeline for plan content
  const localServerTime = parseServerTimestamp(local.serverUpdatedAt);
  const remoteServerTime = parseServerTimestamp(remote.serverUpdatedAt);

  let winner: OutfitPlan;
  if (remoteServerTime > localServerTime) {
    winner = remote;
  } else if (localServerTime > remoteServerTime) {
    winner = local;
  } else {
    const localClient = local.clientUpdatedAt || local.updatedAt || local.createdAt || 0;
    const remoteClient = remote.clientUpdatedAt || remote.updatedAt || remote.createdAt || 0;
    winner = localClient >= remoteClient ? local : remote;
  }

  return {
    ...winner,
    status: effectiveStatus,
  };
}

/**
 * Resolves conflict between local and remote StylePreferences:
 * Server-authoritative timeline comparison.
 */
export function resolvePreferencesConflict(
  local: StylePreferences,
  remote: StylePreferences
): StylePreferences {
  const localServerTime = parseServerTimestamp(local.serverUpdatedAt);
  const remoteServerTime = parseServerTimestamp(remote.serverUpdatedAt);

  if (remoteServerTime > localServerTime) return remote;
  if (localServerTime > remoteServerTime) return local;

  const localClient = local.clientUpdatedAt || local.updatedAt || 0;
  const remoteClient = remote.clientUpdatedAt || remote.updatedAt || 0;
  return localClient >= remoteClient ? local : remote;
}

/**
 * Resolves conflict between local and remote SavedOutfit:
 * Tombstone protection + Server-authoritative timeline.
 */
export function resolveSavedOutfitConflict(
  local: SavedOutfit,
  remote: SavedOutfit
): SavedOutfit {
  if (local.isDeleted && !remote.isDeleted) return local;
  if (!local.isDeleted && remote.isDeleted) return remote;
  if (local.isDeleted && remote.isDeleted) {
    return (local.deletedAt || 0) >= (remote.deletedAt || 0) ? local : remote;
  }

  const localServerTime = parseServerTimestamp(local.serverUpdatedAt);
  const remoteServerTime = parseServerTimestamp(remote.serverUpdatedAt);

  if (remoteServerTime > localServerTime) return remote;
  if (localServerTime > remoteServerTime) return local;

  const localClient = local.clientUpdatedAt || local.savedAt || 0;
  const remoteClient = remote.clientUpdatedAt || remote.savedAt || 0;
  return localClient >= remoteClient ? local : remote;
}
