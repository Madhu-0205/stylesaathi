// ============================================================================
// STYLESAATHI 3.0 — AUTHENTICATED SYNC PULL ENGINE
// Workstream 3: Deterministic Cursor-Based Delta Retrieval
// ============================================================================

import type { D1Database } from '../types';
import type { SyncPullChanges, SyncPullResponse } from './types';

const SYNC_TABLES = [
  'wardrobe_items',
  'saved_outfits',
  'calendar_plans',
  'style_preferences',
  'wear_events',
  'style_signals',
] as const;

type SyncTable = (typeof SYNC_TABLES)[number];

interface InternalCursor {
  tableIndex: number;
  ts: string;
  id: string;
}

/**
 * Encodes an internal pagination cursor to a URL-safe Base64 string.
 */
export function encodeCursor(cursor: InternalCursor): string {
  const json = JSON.stringify(cursor);
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decodes a URL-safe Base64 pagination cursor. Throws if invalid.
 */
export function decodeCursor(cursorStr: string): InternalCursor {
  try {
    let base64 = cursorStr.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const json = atob(base64);
    const parsed = JSON.parse(json);
    if (
      typeof parsed.tableIndex !== 'number' ||
      parsed.tableIndex < 0 ||
      parsed.tableIndex >= SYNC_TABLES.length ||
      typeof parsed.ts !== 'string' ||
      typeof parsed.id !== 'string'
    ) {
      throw new Error('Malformed cursor structure');
    }
    return parsed;
  } catch {
    throw new Error('INVALID_CURSOR');
  }
}

/**
 * Safely parses a JSON string or returns fallback.
 */
function parseJsonSafe<T>(val: any, fallback: T): T {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

/**
 * Pulls delta changes for the authenticated user since a given timestamp or cursor.
 */
export async function pullDeltas(
  db: D1Database,
  userId: string,
  options: {
    since?: string | null;
    cursor?: string | null;
    limit?: number;
  }
): Promise<SyncPullResponse> {
  const limit = Math.min(Math.max(options.limit || 100, 1), 250);
  const since = options.since || '1970-01-01T00:00:00.000Z';
  const serverNowIso = new Date().toISOString();

  let startCursor: InternalCursor = {
    tableIndex: 0,
    ts: since,
    id: '',
  };

  if (options.cursor) {
    startCursor = decodeCursor(options.cursor);
  }

  const changes: SyncPullChanges = {
    wardrobe_items: [],
    saved_outfits: [],
    calendar_plans: [],
    style_preferences: null,
    wear_events: [],
    style_signals: [],
  };

  let remainingLimit = limit;
  let currentCursor: InternalCursor | null = null;
  let hasMore = false;

  for (let idx = startCursor.tableIndex; idx < SYNC_TABLES.length; idx++) {
    if (remainingLimit <= 0) {
      hasMore = true;
      break;
    }

    const tableName = SYNC_TABLES[idx];
    const isFirstTable = idx === startCursor.tableIndex;
    const filterTs = isFirstTable ? startCursor.ts : since;
    const filterId = isFirstTable ? startCursor.id : '';

    if (tableName === 'wardrobe_items') {
      const rows = await fetchTableDeltas(
        db,
        'wardrobe_items',
        'server_updated_at',
        userId,
        filterTs,
        filterId,
        remainingLimit + 1
      );

      const pageRows = rows.slice(0, remainingLimit);
      for (const r of pageRows) {
        changes.wardrobe_items.push({
          ...r,
          colors: parseJsonSafe(r.colors, []),
          seasons: parseJsonSafe(r.seasons, []),
          occasions: parseJsonSafe(r.occasions, []),
          provenance: parseJsonSafe(r.provenance, {}),
          favorite: Boolean(r.favorite),
          user_verified: Boolean(r.user_verified),
          is_deleted: Boolean(r.is_deleted),
        });
      }

      remainingLimit -= pageRows.length;
      if (rows.length > pageRows.length) {
        const last = pageRows[pageRows.length - 1];
        currentCursor = { tableIndex: idx, ts: last.server_updated_at, id: last.id };
        hasMore = true;
        break;
      }
    } else if (tableName === 'saved_outfits') {
      const rows = await fetchTableDeltas(
        db,
        'saved_outfits',
        'server_updated_at',
        userId,
        filterTs,
        filterId,
        remainingLimit + 1
      );

      const pageRows = rows.slice(0, remainingLimit);
      for (const r of pageRows) {
        changes.saved_outfits.push({
          ...r,
          slots: parseJsonSafe(r.slots, {}),
          is_deleted: Boolean(r.is_deleted),
        });
      }

      remainingLimit -= pageRows.length;
      if (rows.length > pageRows.length) {
        const last = pageRows[pageRows.length - 1];
        currentCursor = { tableIndex: idx, ts: last.server_updated_at, id: last.id };
        hasMore = true;
        break;
      }
    } else if (tableName === 'calendar_plans') {
      const rows = await fetchTableDeltas(
        db,
        'calendar_plans',
        'server_updated_at',
        userId,
        filterTs,
        filterId,
        remainingLimit + 1
      );

      const pageRows = rows.slice(0, remainingLimit);
      for (const r of pageRows) {
        changes.calendar_plans.push({
          ...r,
          outfit: parseJsonSafe(r.outfit, {}),
          accessory: parseJsonSafe(r.accessory, null),
          is_deleted: Boolean(r.is_deleted),
        });
      }

      remainingLimit -= pageRows.length;
      if (rows.length > pageRows.length) {
        const last = pageRows[pageRows.length - 1];
        currentCursor = { tableIndex: idx, ts: last.server_updated_at, id: last.id };
        hasMore = true;
        break;
      }
    } else if (tableName === 'style_preferences') {
      // Singleton preferences per user
      const pref = await db
        .prepare('SELECT * FROM style_preferences WHERE user_id = ? AND server_updated_at > ?')
        .bind(userId, filterTs)
        .first<any>();

      if (pref) {
        changes.style_preferences = {
          ...pref,
          preferred_contexts: parseJsonSafe(pref.preferred_contexts, []),
          preferred_aesthetics: parseJsonSafe(pref.preferred_aesthetics, []),
        };
        remainingLimit -= 1;
      }
    } else if (tableName === 'wear_events') {
      const rows = await fetchTableDeltas(
        db,
        'wear_events',
        'created_at',
        userId,
        filterTs,
        filterId,
        remainingLimit + 1
      );

      const pageRows = rows.slice(0, remainingLimit);
      for (const r of pageRows) {
        changes.wear_events.push(r);
      }

      remainingLimit -= pageRows.length;
      if (rows.length > pageRows.length) {
        const last = pageRows[pageRows.length - 1];
        currentCursor = { tableIndex: idx, ts: last.created_at, id: last.id };
        hasMore = true;
        break;
      }
    } else if (tableName === 'style_signals') {
      const rows = await fetchTableDeltas(
        db,
        'style_signals',
        'created_at',
        userId,
        filterTs,
        filterId,
        remainingLimit + 1
      );

      const pageRows = rows.slice(0, remainingLimit);
      for (const r of pageRows) {
        changes.style_signals.push({
          ...r,
          item_ids: parseJsonSafe(r.item_ids, []),
        });
      }

      remainingLimit -= pageRows.length;
      if (rows.length > pageRows.length) {
        const last = pageRows[pageRows.length - 1];
        currentCursor = { tableIndex: idx, ts: last.created_at, id: last.id };
        hasMore = true;
        break;
      }
    }
  }

  return {
    success: true,
    changes,
    nextCursor: currentCursor ? encodeCursor(currentCursor) : null,
    hasMore,
    serverTime: serverNowIso,
  };
}

/**
 * Queries a table for rows updated after a specific timestamp, or after (timestamp, id) for equal timestamps.
 */
async function fetchTableDeltas(
  db: D1Database,
  tableName: string,
  timestampCol: string,
  userId: string,
  filterTs: string,
  filterId: string,
  limitCount: number
): Promise<any[]> {
  let query: string;
  let params: any[];

  if (filterId) {
    query = `SELECT * FROM ${tableName}
             WHERE user_id = ? AND (${timestampCol} > ? OR (${timestampCol} = ? AND id > ?))
             ORDER BY ${timestampCol} ASC, id ASC
             LIMIT ?`;
    params = [userId, filterTs, filterTs, filterId, limitCount];
  } else {
    query = `SELECT * FROM ${tableName}
             WHERE user_id = ? AND ${timestampCol} > ?
             ORDER BY ${timestampCol} ASC, id ASC
             LIMIT ?`;
    params = [userId, filterTs, limitCount];
  }

  const result = await db.prepare(query).bind(...params).all<any>();
  return result.results || [];
}

