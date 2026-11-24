import { WardrobeItem, OutfitPlan, StylePreferences, SavedOutfit, PlanStatus } from '../../types';

function parseServerTimestamp(ts?: string | number | null): number {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  const parsed = new Date(ts).getTime();
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Resolves conflict between deleted (tombstone) and active states:
 * - If both are deleted: the newer deletion wins.
 * - If one is deleted and one is active:
 *   - If the active record was updated STRICTLY AFTER the deletion time,
 *     the active record represents an intentional restoration -> active record wins.
 *   - Otherwise, the active record is a stale write attempting zombie resurrection -> tombstone wins.
 */
function resolveTombstoneConflict<
  T extends {
    isDeleted?: boolean;
    deletedAt?: number;
    serverUpdatedAt?: string;
    clientUpdatedAt?: number;
    createdAt?: number;
    revision?: number;
    serverRevision?: number;
  }
>(local: T, remote: T): { resolved: boolean; winner?: T } {
  const localDeleted = Boolean(local.isDeleted);
  const remoteDeleted = Boolean(remote.isDeleted);

  if (!localDeleted && !remoteDeleted) {
    return { resolved: false };
  }

  const localRev = typeof (local as any).revision === 'number' ? (local as any).revision : (local as any).serverRevision;
  const remoteRev = typeof (remote as any).revision === 'number' ? (remote as any).revision : (remote as any).serverRevision;
  const hasRevisions = typeof localRev === 'number' && typeof remoteRev === 'number';

  if (localDeleted && remoteDeleted) {
    if (hasRevisions && localRev !== remoteRev) {
      return { resolved: true, winner: localRev > remoteRev ? local : remote };
    }
    const localDel = Math.max(local.deletedAt || 0, parseServerTimestamp(local.serverUpdatedAt));
    const remoteDel = Math.max(remote.deletedAt || 0, parseServerTimestamp(remote.serverUpdatedAt));
    return { resolved: true, winner: localDel >= remoteDel ? local : remote };
  }

  // Local is deleted, remote is active
  if (localDeleted && !remoteDeleted) {
    const localDelTime = Math.max(local.deletedAt || 0, parseServerTimestamp(local.serverUpdatedAt));
    const remoteClientTime = remote.clientUpdatedAt || remote.createdAt || 0;

    // Phase 3C.6: An active record is an intentional restoration if:
    // It has a strictly higher server revision (remoteRev > localRev) OR, for legacy unversioned data,
    // its edit timestamp is strictly greater than the local deletion timestamp (remoteClientTime > localDelTime).
    const isRemoteRestoration =
      (hasRevisions && remoteRev > localRev) ||
      (!hasRevisions && remoteClientTime > localDelTime);

    if (isRemoteRestoration) {
      return { resolved: true, winner: { ...remote, isDeleted: false, deletedAt: undefined } };
    }
    // Remote is stale, tombstone wins to prevent zombie resurrection
    return {
      resolved: true,
      winner: { ...local, isDeleted: true, deletedAt: local.deletedAt || Date.now() },
    };
  }

  // Local is active, remote is deleted
  const remoteDelTime = Math.max(remote.deletedAt || 0, parseServerTimestamp(remote.serverUpdatedAt));
  const localClientTime = local.clientUpdatedAt || local.createdAt || 0;

  const isLocalRestoration =
    (hasRevisions && localRev > remoteRev) ||
    (!hasRevisions && localClientTime > remoteDelTime);

  if (isLocalRestoration) {
    return { resolved: true, winner: { ...local, isDeleted: false, deletedAt: undefined } };
  }
  // Local is stale, remote tombstone wins
  return {
    resolved: true,
    winner: { ...remote, isDeleted: true, deletedAt: remote.deletedAt || Date.now() },
  };
}

/**
 * Resolves conflict between local and remote WardrobeItem:
 * 1. Tombstone & Restoration:
 *    - Deleted wins unless active record has newer timestamp/version indicating explicit restoration.
 * 2. Clock-Skew-Safe Server Timeline:
 *    - client_updated_at is NEVER directly compared against server_updated_at.
 *    - Authoritative ordering uses database-controlled server_updated_at.
 *    - If both have server_updated_at, the newer server timestamp wins.
 *    - If server timestamps are equal, tie-break deterministically without clock bias.
 * 3. Image Authority:
 *    - active_image_version_id and storage_path are authoritative.
 *    - An obsolete/stale photo_url NEVER overrides activeImageVersionId or storagePath.
 * 4. Attribute Provenance & Verification Authority:
 *    - User-verified attributes must NEVER be overwritten by unverified AI guesses.
 */
export function resolveWardrobeItemConflict(
  local: WardrobeItem,
  remote: WardrobeItem
): WardrobeItem {
  // 1. Tombstone & Restoration Resolution
  const tombstoneDecision = resolveTombstoneConflict(local, remote);
  if (tombstoneDecision.resolved && tombstoneDecision.winner?.isDeleted) {
    return {
      ...tombstoneDecision.winner,
      photo: local.photo || tombstoneDecision.winner.photo,
    };
  }

  // If one was restored, the restored active record is the starting base
  let winner: WardrobeItem;
  if (tombstoneDecision.resolved && !tombstoneDecision.winner?.isDeleted) {
    winner = tombstoneDecision.winner!;
  } else {
    // 2. Server-Authoritative Revision & Timeline Comparison
    const localRev = typeof (local as any).revision === 'number' ? (local as any).revision : (local as any).serverRevision;
    const remoteRev = typeof (remote as any).revision === 'number' ? (remote as any).revision : (remote as any).serverRevision;

    if (typeof localRev === 'number' && typeof remoteRev === 'number' && localRev !== remoteRev) {
      winner = remoteRev > localRev ? remote : local;
    } else {
      const localServerTime = parseServerTimestamp(local.serverUpdatedAt);
      const remoteServerTime = parseServerTimestamp(remote.serverUpdatedAt);

      if (remoteServerTime > localServerTime) {
        winner = remote;
      } else if (localServerTime > remoteServerTime) {
        winner = local;
      } else {
        // Both share the same server commit point or are uncommitted
        // Deterministically compare clientUpdatedAt against clientUpdatedAt only
        const localClient = local.clientUpdatedAt || local.createdAt || 0;
        const remoteClient = remote.clientUpdatedAt || remote.createdAt || 0;
        if (localClient !== remoteClient) {
          winner = localClient > remoteClient ? local : remote;
        } else {
          // Deterministic tie-breaker based on ID
          winner = (local.id || '').localeCompare(remote.id || '') >= 0 ? local : remote;
        }
      }
    }
  }

  // 3. Authoritative Image Source of Truth:
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

  // Derive photoUrl safely
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

  // 4. Attribute Provenance & Verification Authority:
  const isWinnerVerified = Boolean(winner.userVerified);
  const isLocalVerified = Boolean(local.userVerified);
  const isRemoteVerified = Boolean(remote.userVerified);

  let fabric = winner.fabric;
  let pattern = winner.pattern;
  let fit = winner.fit;
  let purchasePrice = winner.purchasePrice;
  let culturalContext = winner.culturalContext;
  let userVerified = isWinnerVerified;

  if (!isWinnerVerified) {
    if (isLocalVerified) {
      fabric = local.fabric ?? fabric;
      pattern = local.pattern ?? pattern;
      fit = local.fit ?? fit;
      purchasePrice = local.purchasePrice ?? purchasePrice;
      culturalContext = local.culturalContext ?? culturalContext;
      userVerified = true;
    } else if (isRemoteVerified) {
      fabric = remote.fabric ?? fabric;
      pattern = remote.pattern ?? pattern;
      fit = remote.fit ?? fit;
      purchasePrice = remote.purchasePrice ?? purchasePrice;
      culturalContext = remote.culturalContext ?? culturalContext;
      userVerified = true;
    }
  }

  return {
    ...winner,
    photo: local.photo || winner.photo,
    activeImageVersionId: activeImageId,
    photoId: activeImageId,
    storagePath: storagePath,
    photoUrl: photoUrl,
    fabric,
    pattern,
    fit,
    purchasePrice,
    culturalContext,
    userVerified,
  };
}

/**
 * Resolves conflict between local and remote CalendarPlan for the same date:
 * 1. Tombstone & Restoration.
 * 2. Monotonic status invariant:
 *    - planned -> worn (ALLOWED)
 *    - planned -> cancelled (ALLOWED)
 *    - worn -> worn (ALLOWED)
 *    - Stale sync must NEVER cause:
 *        worn -> planned (FORBIDDEN)
 *        worn -> cancelled (FORBIDDEN)
 *        cancelled -> planned (FORBIDDEN)
 *        cancelled -> worn (FORBIDDEN)
 * 3. Server timestamp resolution for plan content.
 */
export function resolveCalendarPlanConflict(
  local: OutfitPlan,
  remote: OutfitPlan
): OutfitPlan {
  // 1. Tombstone & Restoration
  const tombstoneDecision = resolveTombstoneConflict(local, remote);
  if (tombstoneDecision.resolved && tombstoneDecision.winner?.isDeleted) {
    return tombstoneDecision.winner;
  }

  // 2. Monotonic Status Invariant:
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

  // 3. Server-Authoritative Revision & Timeline for plan content
  let winner: OutfitPlan;
  if (tombstoneDecision.resolved && !tombstoneDecision.winner?.isDeleted) {
    winner = tombstoneDecision.winner!;
  } else {
    const localRev = typeof (local as any).revision === 'number' ? (local as any).revision : (local as any).serverRevision;
    const remoteRev = typeof (remote as any).revision === 'number' ? (remote as any).revision : (remote as any).serverRevision;

    if (typeof localRev === 'number' && typeof remoteRev === 'number' && localRev !== remoteRev) {
      winner = remoteRev > localRev ? remote : local;
    } else {
      const localServerTime = parseServerTimestamp(local.serverUpdatedAt);
      const remoteServerTime = parseServerTimestamp(remote.serverUpdatedAt);

      if (remoteServerTime > localServerTime) {
        winner = remote;
      } else if (localServerTime > remoteServerTime) {
        winner = local;
      } else {
        const localClient = local.clientUpdatedAt || local.updatedAt || local.createdAt || 0;
        const remoteClient = remote.clientUpdatedAt || remote.updatedAt || remote.createdAt || 0;
        winner = localClient >= remoteClient ? local : remote;
      }
    }
  }

  return {
    ...winner,
    status: effectiveStatus,
  };
}

/**
 * Resolves conflict between local and remote StylePreferences:
 * Server-authoritative revision & timeline comparison.
 */
export function resolvePreferencesConflict(
  local: StylePreferences,
  remote: StylePreferences
): StylePreferences {
  const localRev = typeof (local as any).revision === 'number' ? (local as any).revision : (local as any).serverRevision;
  const remoteRev = typeof (remote as any).revision === 'number' ? (remote as any).revision : (remote as any).serverRevision;

  if (typeof localRev === 'number' && typeof remoteRev === 'number' && localRev !== remoteRev) {
    return remoteRev > localRev ? remote : local;
  }

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
 * 1. Tombstone & Restoration.
 * 2. Server-authoritative revision & timeline.
 */
export function resolveSavedOutfitConflict(
  local: SavedOutfit,
  remote: SavedOutfit
): SavedOutfit {
  // 1. Tombstone & Restoration
  const tombstoneDecision = resolveTombstoneConflict(local, remote);
  if (tombstoneDecision.resolved && tombstoneDecision.winner?.isDeleted) {
    return tombstoneDecision.winner;
  }

  if (tombstoneDecision.resolved && !tombstoneDecision.winner?.isDeleted) {
    return tombstoneDecision.winner!;
  }

  const localRev = typeof (local as any).revision === 'number' ? (local as any).revision : (local as any).serverRevision;
  const remoteRev = typeof (remote as any).revision === 'number' ? (remote as any).revision : (remote as any).serverRevision;

  if (typeof localRev === 'number' && typeof remoteRev === 'number' && localRev !== remoteRev) {
    return remoteRev > localRev ? remote : local;
  }

  const localServerTime = parseServerTimestamp(local.serverUpdatedAt);
  const remoteServerTime = parseServerTimestamp(remote.serverUpdatedAt);

  if (remoteServerTime > localServerTime) return remote;
  if (localServerTime > remoteServerTime) return local;

  const localClient = local.clientUpdatedAt || local.savedAt || 0;
  const remoteClient = remote.clientUpdatedAt || remote.savedAt || 0;
  return localClient >= remoteClient ? local : remote;
}
