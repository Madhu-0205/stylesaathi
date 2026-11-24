// ============================================================================
// STYLESAATHI 3.0 — DELTA SYNCHRONIZATION TEST SUITE
// Workstream 7: Comprehensive Adversarial Security & Invariant Tests
// ============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { app } from '../src/index';
import type { D1Database, D1PreparedStatement, WorkerEnv } from '../src/types';
import { sha256Hex, generateSecureToken } from '../src/auth/crypto';
import { encodeCursor } from '../src/sync/pull';

const MIGRATION_1_PATH = path.resolve(__dirname, '../migrations/0001_initial_schema.sql');
const MIGRATION_2_PATH = path.resolve(__dirname, '../migrations/0002_sync_mutations.sql');
const MIGRATION_3_PATH = path.resolve(__dirname, '../migrations/0003_entity_revisions.sql');

function createD1Adapter(db: DatabaseSync): D1Database {
  return {
    prepare(query: string): D1PreparedStatement {
      let boundValues: any[] = [];
      const stmt = {
        bind(...values: unknown[]) {
          boundValues = values as any[];
          return stmt;
        },
        async first<T = unknown>(colName?: string): Promise<T | null> {
          const row = db.prepare(query).get(...boundValues) as any;
          if (!row) return null;
          if (colName) return row[colName] ?? null;
          return row as T;
        },
        async run<T = unknown>() {
          const res = db.prepare(query).run(...boundValues);
          return {
            success: true,
            meta: {
              changes: Number(res.changes),
              last_row_id: Number(res.lastInsertRowid),
            },
          };
        },
        async all<T = unknown>() {
          const rows = db.prepare(query).all(...boundValues) as T[];
          return {
            results: rows,
            success: true,
            meta: { changes: 0 },
          };
        },
      };
      return stmt as unknown as D1PreparedStatement;
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]) {
      db.exec('BEGIN TRANSACTION;');
      try {
        const results = [];
        for (const s of statements) {
          results.push(await s.run<T>());
        }
        db.exec('COMMIT;');
        return results;
      } catch (err) {
        db.exec('ROLLBACK;');
        throw err;
      }
    },
    async exec(query: string) {
      db.exec(query);
      return { count: 1, duration: 1 };
    },
  };
}

describe('Phase 3C: Delta Synchronization Engine — Adversarial Test Suite', () => {
  let sqliteDb: DatabaseSync;
  let d1: D1Database;
  let testEnv: WorkerEnv;

  // Test users
  const userA = { id: 'user-a', name: 'Alice', email: 'alice@stylesaathi.in' };
  const userB = { id: 'user-b', name: 'Bob', email: 'bob@stylesaathi.in' };

  let tokenA: string;
  let tokenB: string;

  beforeEach(async () => {
    sqliteDb = new DatabaseSync(':memory:');
    sqliteDb.exec('PRAGMA foreign_keys = ON;');

    const sql1 = fs.readFileSync(MIGRATION_1_PATH, 'utf-8');
    sqliteDb.exec(sql1);

    const sql2 = fs.readFileSync(MIGRATION_2_PATH, 'utf-8');
    sqliteDb.exec(sql2);

    const sql3 = fs.readFileSync(MIGRATION_3_PATH, 'utf-8');
    sqliteDb.exec(sql3);

    d1 = createD1Adapter(sqliteDb);
    testEnv = {
      DB: d1,
      APP_ENV: 'test',
      AUTH_SECRET: 'test-secret-32-chars-long-entropy-key!',
    };

    // Seed User A
    const nowIso = new Date().toISOString();
    sqliteDb.exec(
      `INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
       VALUES ('${userA.id}', '${userA.name}', '${userA.email}', 1, '${nowIso}', '${nowIso}')`
    );

    // Seed User B
    sqliteDb.exec(
      `INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
       VALUES ('${userB.id}', '${userB.name}', '${userB.email}', 1, '${nowIso}', '${nowIso}')`
    );

    // Seed Active Session for User A (SEC-01 hashed token)
    tokenA = generateSecureToken(32);
    const tokenHashA = await sha256Hex(tokenA);
    const futureIso = new Date(Date.now() + 86400000).toISOString();
    sqliteDb.exec(
      `INSERT INTO session (id, userId, token, expiresAt, createdAt, updatedAt)
       VALUES ('sess-a', '${userA.id}', '${tokenHashA}', '${futureIso}', '${nowIso}', '${nowIso}')`
    );

    // Seed Active Session for User B (SEC-01 hashed token)
    tokenB = generateSecureToken(32);
    const tokenHashB = await sha256Hex(tokenB);
    sqliteDb.exec(
      `INSERT INTO session (id, userId, token, expiresAt, createdAt, updatedAt)
       VALUES ('sess-b', '${userB.id}', '${tokenHashB}', '${futureIso}', '${nowIso}', '${nowIso}')`
    );
  });

  afterEach(() => {
    try {
      sqliteDb.close();
    } catch {}
  });

  // --------------------------------------------------------------------------
  // 1. Unauthenticated push and pull
  // --------------------------------------------------------------------------
  it('1. rejects unauthenticated push and pull with HTTP 401', async () => {
    // Push without token
    const pushRes = await app.request(
      '/api/sync/push',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mutations: [] }),
      },
      testEnv
    );
    expect(pushRes.status).toBe(401);

    // Pull without token
    const pullRes = await app.request('/api/sync/pull', { method: 'GET' }, testEnv);
    expect(pullRes.status).toBe(401);
  });

  // --------------------------------------------------------------------------
  // 2. Expired and revoked sessions
  // --------------------------------------------------------------------------
  it('2. rejects expired or revoked sessions with HTTP 401', async () => {
    // Expired session
    const expiredToken = generateSecureToken(32);
    const expiredHash = await sha256Hex(expiredToken);
    const pastIso = new Date(Date.now() - 3600000).toISOString();
    sqliteDb.exec(
      `INSERT INTO session (id, userId, token, expiresAt, createdAt, updatedAt)
       VALUES ('sess-exp', '${userA.id}', '${expiredHash}', '${pastIso}', '${pastIso}', '${pastIso}')`
    );

    const resExpired = await app.request(
      '/api/sync/pull',
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${expiredToken}` },
      },
      testEnv
    );
    expect(resExpired.status).toBe(401);

    // Revoked session (deleted from D1)
    sqliteDb.exec(`DELETE FROM session WHERE id = 'sess-a'`);
    const resRevoked = await app.request(
      '/api/sync/pull',
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${tokenA}` },
      },
      testEnv
    );
    expect(resRevoked.status).toBe(401);
  });

  // --------------------------------------------------------------------------
  // 3. User A attempting to access User B records
  // --------------------------------------------------------------------------
  it('3. strictly isolates User A and User B: User A cannot read or overwrite User B records', async () => {
    // Seed an item belonging to User B
    const nowIso = new Date().toISOString();
    sqliteDb.exec(
      `INSERT INTO wardrobe_items (id, user_id, name, category, subcategory, formality, status, created_at, client_updated_at, server_updated_at)
       VALUES ('item-bob-1', '${userB.id}', 'Bob Royal Sherwani', 'Ethnic', 'Sherwani', 5, 'clean', '${nowIso}', '${nowIso}', '${nowIso}')`
    );

    // User A calls pull -> should NOT see Bob's item
    const pullA = await app.request(
      '/api/sync/pull',
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${tokenA}` },
      },
      testEnv
    );
    expect(pullA.status).toBe(200);
    const pullData: any = await pullA.json();
    expect(pullData.changes.wardrobe_items).toHaveLength(0);

    // User A attempts to overwrite item-bob-1 via push
    const pushA = await app.request(
      '/api/sync/push',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          mutations: [
            {
              mutationId: 'mut-hack-1',
              entityType: 'wardrobe_item',
              entityId: 'item-bob-1',
              action: 'upsert',
              clientTimestamp: Date.now(),
              data: {
                name: 'Alice Hijacked Item',
                category: 'Tops',
                subcategory: 'T-Shirt',
                formality: 1,
              },
            },
          ],
        }),
      },
      testEnv
    );
    expect(pushA.status).toBe(200);

    // Verify Bob's item was NOT modified in the database
    const bobItem = sqliteDb
      .prepare(`SELECT name, user_id FROM wardrobe_items WHERE id = 'item-bob-1' AND user_id = '${userB.id}'`)
      .get() as any;
    expect(bobItem.name).toBe('Bob Royal Sherwani');
    expect(bobItem.user_id).toBe(userB.id);

    // Verify Alice has her own separate record with (user_id='user-a', id='item-bob-1')
    const aliceItem = sqliteDb
      .prepare(`SELECT name, user_id FROM wardrobe_items WHERE id = 'item-bob-1' AND user_id = '${userA.id}'`)
      .get() as any;
    expect(aliceItem.name).toBe('Alice Hijacked Item');
    expect(aliceItem.user_id).toBe(userA.id);
  });

  // --------------------------------------------------------------------------
  // 4. Child records referencing another user parent
  // --------------------------------------------------------------------------
  it('4. rejects child records referencing another user parent (wear_event on another user item)', async () => {
    // Bob has an item
    const nowIso = new Date().toISOString();
    sqliteDb.exec(
      `INSERT INTO wardrobe_items (id, user_id, name, category, subcategory, formality, status, created_at, client_updated_at, server_updated_at)
       VALUES ('item-bob-2', '${userB.id}', 'Bob Silk Kurta', 'Ethnic', 'Kurta', 4, 'clean', '${nowIso}', '${nowIso}', '${nowIso}')`
    );

    // Alice attempts to log a wear_event referencing Bob's item
    const res = await app.request(
      '/api/sync/push',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          mutations: [
            {
              mutationId: 'mut-cross-wear',
              entityType: 'wear_event',
              entityId: 'wear-alice-1',
              action: 'append',
              clientTimestamp: Date.now(),
              data: {
                wardrobeItemId: 'item-bob-2',
                wornAt: nowIso,
              },
            },
          ],
        }),
      },
      testEnv
    );

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.results[0].status).toBe('rejected');
    expect(body.results[0].error).toContain('REFERENTIAL_INTEGRITY_VIOLATION');

    // Confirm no wear event was created in D1
    const row = sqliteDb.prepare(`SELECT * FROM wear_events WHERE id = 'wear-alice-1'`).get();
    expect(row).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // 5. Embedded JSON references containing foreign IDs
  // --------------------------------------------------------------------------
  it('5. rejects outfit slots or plan accessories containing another user wardrobe item IDs', async () => {
    // Bob owns item-bob-3
    const nowIso = new Date().toISOString();
    sqliteDb.exec(
      `INSERT INTO wardrobe_items (id, user_id, name, category, subcategory, formality, status, created_at, client_updated_at, server_updated_at)
       VALUES ('item-bob-3', '${userB.id}', 'Bob Gold Watch', 'Accessories', 'Watch', 5, 'clean', '${nowIso}', '${nowIso}', '${nowIso}')`
    );

    // Alice tries to save an outfit embedding Bob's item in slots
    const outfitRes = await app.request(
      '/api/sync/push',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          mutations: [
            {
              mutationId: 'mut-cross-outfit',
              entityType: 'saved_outfit',
              entityId: 'outfit-alice-1',
              action: 'upsert',
              clientTimestamp: Date.now(),
              data: {
                name: 'Suspicious Outfit',
                outfit: {
                  slots: {
                    accessory: { id: 'item-bob-3', name: 'Bob Gold Watch' },
                  },
                },
              },
            },
          ],
        }),
      },
      testEnv
    );

    const outfitBody: any = await outfitRes.json();
    expect(outfitBody.results[0].status).toBe('rejected');
    expect(outfitBody.results[0].error).toContain('REFERENTIAL_INTEGRITY_VIOLATION');

    // Alice tries to create a calendar plan embedding Bob's item as accessory
    const planRes = await app.request(
      '/api/sync/push',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          mutations: [
            {
              mutationId: 'mut-cross-plan',
              entityType: 'calendar_plan',
              entityId: 'plan-alice-1',
              action: 'upsert',
              clientTimestamp: Date.now(),
              data: {
                date: '2026-11-15',
                occasion: 'Wedding',
                status: 'planned',
                accessory: { id: 'item-bob-3' },
              },
            },
          ],
        }),
      },
      testEnv
    );

    const planBody: any = await planRes.json();
    expect(planBody.results[0].status).toBe('rejected');
    expect(planBody.results[0].error).toContain('REFERENTIAL_INTEGRITY_VIOLATION');
  });

  // --------------------------------------------------------------------------
  // 6. Duplicate mutation requests (Idempotence)
  // --------------------------------------------------------------------------
  it('6. guarantees idempotent execution on duplicate mutation requests', async () => {
    const payload = {
      mutations: [
        {
          mutationId: 'mut-idempotent-1',
          entityType: 'wardrobe_item' as const,
          entityId: 'item-idem-1',
          action: 'upsert' as const,
          clientTimestamp: Date.now(),
          data: {
            name: 'Kashmiri Shawl',
            category: 'Ethnic',
            subcategory: 'Shawl',
            formality: 4,
          },
        },
      ],
    };

    // First attempt: applied
    const res1 = await app.request(
      '/api/sync/push',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify(payload),
      },
      testEnv
    );
    expect(res1.status).toBe(200);
    const body1: any = await res1.json();
    expect(body1.results[0].status).toBe('applied');

    // Second attempt (exact same mutationId): already_applied
    const res2 = await app.request(
      '/api/sync/push',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify(payload),
      },
      testEnv
    );
    expect(res2.status).toBe(200);
    const body2: any = await res2.json();
    expect(body2.results[0].status).toBe('already_applied');
    expect(body2.results[0].serverUpdatedAt).toBe(body1.results[0].serverUpdatedAt);
  });

  // --------------------------------------------------------------------------
  // 7. Replay of old mutations (Stale write protection)
  // --------------------------------------------------------------------------
  it('7. detects stale mutations and resolves with server_wins', async () => {
    // Alice applies a new mutation at T2
    const t2 = Date.now();
    await app.request(
      '/api/sync/push',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          mutations: [
            {
              mutationId: 'mut-t2',
              entityType: 'wardrobe_item',
              entityId: 'item-stale-1',
              action: 'upsert',
              clientTimestamp: t2,
              data: {
                name: 'Silk Kurta - Version 2',
                category: 'Ethnic',
                subcategory: 'Kurta',
                formality: 4,
              },
            },
          ],
        }),
      },
      testEnv
    );

    // Stale client replays an old mutation at T1 (where T1 < T2)
    const t1 = t2 - 60000;
    const staleRes = await app.request(
      '/api/sync/push',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          mutations: [
            {
              mutationId: 'mut-t1-stale',
              entityType: 'wardrobe_item',
              entityId: 'item-stale-1',
              action: 'upsert',
              expectedRevision: 0, // Stale revision (server is at revision 1)
              clientTimestamp: t1,
              data: {
                name: 'Silk Kurta - Stale Old Version',
                category: 'Ethnic',
                subcategory: 'Kurta',
                formality: 2,
              },
            },
          ],
        }),
      },
      testEnv
    );

    expect(staleRes.status).toBe(200);
    const staleBody: any = await staleRes.json();
    expect(staleBody.results[0].status).toBe('conflict_server_wins');
    expect(staleBody.results[0].conflictData.name).toBe('Silk Kurta - Version 2');

    // Ensure database remained at Version 2
    const item = sqliteDb
      .prepare(`SELECT name FROM wardrobe_items WHERE id = 'item-stale-1' AND user_id = '${userA.id}'`)
      .get() as any;
    expect(item.name).toBe('Silk Kurta - Version 2');
  });

  // --------------------------------------------------------------------------
  // 8. Malformed payloads and oversized requests
  // --------------------------------------------------------------------------
  it('8. rejects malformed payloads and oversized batches', async () => {
    // Malformed JSON
    const malformedRes = await app.request(
      '/api/sync/push',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: '{ malformed json, missing closing brace',
      },
      testEnv
    );
    expect(malformedRes.status).toBe(400);

    // Empty mutations array
    const emptyRes = await app.request(
      '/api/sync/push',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({ mutations: [] }),
      },
      testEnv
    );
    expect(emptyRes.status).toBe(400);

    // Oversized batch (> 100 items)
    const tooManyMutations = Array.from({ length: 101 }, (_, i) => ({
      mutationId: `mut-flood-${i}`,
      entityType: 'wardrobe_item' as const,
      entityId: `item-${i}`,
      action: 'upsert' as const,
      clientTimestamp: Date.now(),
      data: { name: `Item ${i}`, category: 'Tops', subcategory: 'T-Shirt', formality: 3 },
    }));

    const floodRes = await app.request(
      '/api/sync/push',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({ mutations: tooManyMutations }),
      },
      testEnv
    );
    expect(floodRes.status).toBe(400);
    const floodBody: any = await floodRes.json();
    expect(floodBody.error).toBe('BATCH_SIZE_EXCEEDED');
  });

  // --------------------------------------------------------------------------
  // 9. Pagination boundaries and equal timestamps
  // --------------------------------------------------------------------------
  it('9. handles pagination boundaries and equal timestamps safely without data loss or loops', async () => {
    // Insert 5 items with the EXACT same server_updated_at timestamp
    const equalTs = '2026-11-07T00:30:00.000Z';
    for (let i = 1; i <= 5; i++) {
      sqliteDb.exec(
        `INSERT INTO wardrobe_items (id, user_id, name, category, subcategory, formality, status, created_at, client_updated_at, server_updated_at)
         VALUES ('item-eq-${i}', '${userA.id}', 'Item ${i}', 'Tops', 'T-Shirt', 3, 'clean', '${equalTs}', '${equalTs}', '${equalTs}')`
      );
    }

    // Pull page 1 with limit = 2
    const page1Res = await app.request(
      '/api/sync/pull?limit=2',
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${tokenA}` },
      },
      testEnv
    );
    expect(page1Res.status).toBe(200);
    const p1: any = await page1Res.json();
    expect(p1.changes.wardrobe_items).toHaveLength(2);
    expect(p1.hasMore).toBe(true);
    expect(p1.nextCursor).toBeTruthy();
    expect(p1.changes.wardrobe_items.map((i: any) => i.id)).toEqual(['item-eq-1', 'item-eq-2']);

    // Pull page 2 using cursor
    const page2Res = await app.request(
      `/api/sync/pull?limit=2&cursor=${encodeURIComponent(p1.nextCursor)}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${tokenA}` },
      },
      testEnv
    );
    expect(page2Res.status).toBe(200);
    const p2: any = await page2Res.json();
    expect(p2.changes.wardrobe_items).toHaveLength(2);
    expect(p2.hasMore).toBe(true);
    expect(p2.changes.wardrobe_items.map((i: any) => i.id)).toEqual(['item-eq-3', 'item-eq-4']);

    // Pull page 3
    const page3Res = await app.request(
      `/api/sync/pull?limit=2&cursor=${encodeURIComponent(p2.nextCursor)}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${tokenA}` },
      },
      testEnv
    );
    expect(page3Res.status).toBe(200);
    const p3: any = await page3Res.json();
    expect(p3.changes.wardrobe_items).toHaveLength(1);
    expect(p3.hasMore).toBe(false);
    expect(p3.changes.wardrobe_items[0].id).toBe('item-eq-5');
  });

  // --------------------------------------------------------------------------
  // 10. Monotonic calendar plan invariant & concurrent edits
  // --------------------------------------------------------------------------
  it('10. enforces monotonic calendar plan status: worn and cancelled cannot revert to planned', async () => {
    // 1. Create a plan marked 'worn'
    const now = Date.now();
    await app.request(
      '/api/sync/push',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          mutations: [
            {
              mutationId: 'mut-plan-worn',
              entityType: 'calendar_plan',
              entityId: 'plan-mon-1',
              action: 'upsert',
              clientTimestamp: now,
              data: {
                date: '2026-11-20',
                occasion: 'Festival',
                status: 'worn',
                outfit: { slots: {} },
              },
            },
          ],
        }),
      },
      testEnv
    );

    // 2. Client attempts to revert 'worn' to 'planned'
    const revertRes = await app.request(
      '/api/sync/push',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          mutations: [
            {
              mutationId: 'mut-plan-revert',
              entityType: 'calendar_plan',
              entityId: 'plan-mon-1',
              action: 'upsert',
              expectedRevision: 1,
              clientTimestamp: now + 5000,
              data: {
                date: '2026-11-20',
                occasion: 'Festival',
                status: 'planned',
                outfit: { slots: {} },
              },
            },
          ],
        }),
      },
      testEnv
    );

    expect(revertRes.status).toBe(200);
    const revertBody: any = await revertRes.json();
    expect(revertBody.results[0].status).toBe('conflict_server_wins');
    expect(revertBody.results[0].conflictData.status).toBe('worn');

    // Verify DB still holds 'worn'
    const plan = sqliteDb
      .prepare(`SELECT status FROM calendar_plans WHERE id = 'plan-mon-1' AND user_id = '${userA.id}'`)
      .get() as any;
    expect(plan.status).toBe('worn');
  });

  // --------------------------------------------------------------------------
  // 11. Deletion tombstones win permanently over active edits
  // --------------------------------------------------------------------------
  it('11. deletion tombstones permanently win over older active updates', async () => {
    // 1. Insert active item
    const t0 = Date.now();
    await app.request(
      '/api/sync/push',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          mutations: [
            {
              mutationId: 'mut-tomb-create',
              entityType: 'wardrobe_item',
              entityId: 'item-tomb-1',
              action: 'upsert',
              clientTimestamp: t0,
              data: {
                name: 'Silk Scarf',
                category: 'Accessories',
                subcategory: 'Scarf',
                formality: 3,
              },
            },
          ],
        }),
      },
      testEnv
    );

    // 2. Delete item at T1
    const t1 = t0 + 10000;
    await app.request(
      '/api/sync/push',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          mutations: [
            {
              mutationId: 'mut-tomb-del',
              entityType: 'wardrobe_item',
              entityId: 'item-tomb-1',
              action: 'delete',
              expectedRevision: 1,
              clientTimestamp: t1,
              data: { deletedAt: t1 },
            },
          ],
        }),
      },
      testEnv
    );

    // 3. Stale client attempts to upsert at T0 + 5000 (before deletion)
    const tOlder = t0 + 5000;
    const staleRes = await app.request(
      '/api/sync/push',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          mutations: [
            {
              mutationId: 'mut-tomb-stale',
              entityType: 'wardrobe_item',
              entityId: 'item-tomb-1',
              action: 'upsert',
              clientTimestamp: tOlder,
              data: {
                name: 'Silk Scarf - Zombie Edit',
                category: 'Accessories',
                subcategory: 'Scarf',
                formality: 3,
              },
            },
          ],
        }),
      },
      testEnv
    );

    expect(staleRes.status).toBe(200);
    const staleBody: any = await staleRes.json();
    expect(staleBody.results[0].status).toBe('conflict_server_wins');
    expect(staleBody.results[0].conflictData.is_deleted).toBe(1);

    // 4. Verify pull includes deletion tombstone
    const pull = await app.request(
      '/api/sync/pull',
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${tokenA}` },
      },
      testEnv
    );
    const pullBody: any = await pull.json();
    const tombstoneItem = pullBody.changes.wardrobe_items.find((i: any) => i.id === 'item-tomb-1');
    expect(tombstoneItem).toBeDefined();
    expect(tombstoneItem.is_deleted).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 12. Invalid pagination cursor handling
  // --------------------------------------------------------------------------
  it('12. rejects malformed or invalid pagination cursors with HTTP 400', async () => {
    const res = await app.request(
      '/api/sync/pull?cursor=invalid-non-base64-garbage-!!!',
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${tokenA}` },
      },
      testEnv
    );
    expect(res.status).toBe(400);
    const body: any = await res.json();
    expect(body.error).toBe('INVALID_CURSOR');
  });

  // --------------------------------------------------------------------------
  // 13. Image boundary enforcement (No raw/base64 image uploads in metadata)
  // --------------------------------------------------------------------------
  it('13. rejects sync mutations containing base64 images to enforce device-local boundary', async () => {
    const fakeBase64 = 'data:image/jpeg;base64,' + 'A'.repeat(5000);
    const res = await app.request(
      '/api/sync/push',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          mutations: [
            {
              mutationId: 'mut-img-leak',
              entityType: 'wardrobe_item',
              entityId: 'item-img-1',
              action: 'upsert',
              clientTimestamp: Date.now(),
              data: {
                name: 'Silk Dupatta',
                category: 'Ethnic',
                subcategory: 'Dupatta',
                photo: fakeBase64, // FORBIDDEN!
              },
            },
          ],
        }),
      },
      testEnv
    );

    expect(res.status).toBe(400);
    const body: any = await res.json();
    expect(body.error).toBe('VALIDATION_FAILED');
    expect(body.message).toContain('forbidden image data');
  });

  // --------------------------------------------------------------------------
  // 14. User-verified attribute preservation against unverified AI overwrite
  // --------------------------------------------------------------------------
  it('14. preserves user-verified attributes when an unverified client mutation is synced', async () => {
    // 1. Alice creates verified item
    const t0 = Date.now();
    await app.request(
      '/api/sync/push',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          mutations: [
            {
              mutationId: 'mut-ver-1',
              entityType: 'wardrobe_item',
              entityId: 'item-ver-1',
              action: 'upsert',
              clientTimestamp: t0,
              data: {
                name: 'Handloom Kanjivaram',
                category: 'Ethnic',
                subcategory: 'Saree',
                fabric: 'Pure Mulberry Silk',
                userVerified: true,
                formality: 5,
              },
            },
          ],
        }),
      },
      testEnv
    );

    // 2. Client sends an update with userVerified = false and fabric = 'Synthetic Silk'
    const t1 = t0 + 5000;
    const updateRes = await app.request(
      '/api/sync/push',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          mutations: [
            {
              mutationId: 'mut-ver-2',
              entityType: 'wardrobe_item',
              entityId: 'item-ver-1',
              action: 'upsert',
              expectedRevision: 1,
              clientTimestamp: t1,
              data: {
                name: 'Handloom Kanjivaram (Updated)',
                category: 'Ethnic',
                subcategory: 'Saree',
                fabric: 'Synthetic Silk',
                userVerified: false, // Unverified update
                formality: 5,
              },
            },
          ],
        }),
      },
      testEnv
    );

    expect(updateRes.status).toBe(200);
    const item = sqliteDb
      .prepare(`SELECT name, fabric, user_verified FROM wardrobe_items WHERE id = 'item-ver-1' AND user_id = '${userA.id}'`)
      .get() as any;

    expect(item.name).toBe('Handloom Kanjivaram (Updated)');
    // Crucial: Verified fabric preserved!
    expect(item.fabric).toBe('Pure Mulberry Silk');
    expect(item.user_verified).toBe(1);
  });

  // --------------------------------------------------------------------------
  // 15. SEC-SYNC-01: Robust Idempotency Key Binding (Entity & Payload Hash)
  // --------------------------------------------------------------------------
  it('15. rejects idempotency key reuse with different entity ID or different payload with explicit conflict', async () => {
    // 1. Initial valid mutation
    const initialPayload = {
      mutations: [
        {
          mutationId: 'mut-binding-1',
          entityType: 'wardrobe_item' as const,
          entityId: 'item-bind-1',
          action: 'upsert' as const,
          clientTimestamp: Date.now(),
          data: {
            name: 'Original Blue Shirt',
            category: 'Tops',
            subcategory: 'Shirt',
            formality: 3,
            status: 'clean',
          },
        },
      ],
    };

    const res1 = await app.request(
      '/api/sync/push',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify(initialPayload),
      },
      testEnv
    );
    expect(res1.status).toBe(200);
    const body1: any = await res1.json();
    expect(body1.results[0].status).toBe('applied');

    // 2. Exact retry: returns already_applied
    const resRetry = await app.request(
      '/api/sync/push',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify(initialPayload),
      },
      testEnv
    );
    expect(resRetry.status).toBe(200);
    const bodyRetry: any = await resRetry.json();
    expect(bodyRetry.results[0].status).toBe('already_applied');

    // 3. Same mutationId with DIFFERENT entityId -> REJECTED with IDEMPOTENCY_CONFLICT
    const resDiffEntity = await app.request(
      '/api/sync/push',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          mutations: [
            {
              mutationId: 'mut-binding-1',
              entityType: 'wardrobe_item',
              entityId: 'item-bind-DIFFERENT',
              action: 'upsert',
              clientTimestamp: Date.now(),
              data: {
                name: 'Original Blue Shirt',
                category: 'Tops',
                subcategory: 'Shirt',
                formality: 3,
                status: 'clean',
              },
            },
          ],
        }),
      },
      testEnv
    );
    expect(resDiffEntity.status).toBe(200);
    const bodyDiffEntity: any = await resDiffEntity.json();
    expect(bodyDiffEntity.results[0].status).toBe('rejected');
    expect(bodyDiffEntity.results[0].error).toContain('IDEMPOTENCY_CONFLICT');

    // 4. Same mutationId and same entityId with DIFFERENT payload -> REJECTED with IDEMPOTENCY_CONFLICT
    const resDiffPayload = await app.request(
      '/api/sync/push',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          mutations: [
            {
              mutationId: 'mut-binding-1',
              entityType: 'wardrobe_item',
              entityId: 'item-bind-1',
              action: 'upsert',
              clientTimestamp: Date.now(),
              data: {
                name: 'Completely Changed Red Kurta',
                category: 'Ethnic',
                subcategory: 'Kurta',
                formality: 4,
                status: 'clean',
              },
            },
          ],
        }),
      },
      testEnv
    );
    expect(resDiffPayload.status).toBe(200);
    const bodyDiffPayload: any = await resDiffPayload.json();
    expect(bodyDiffPayload.results[0].status).toBe('rejected');
    expect(bodyDiffPayload.results[0].error).toContain('IDEMPOTENCY_CONFLICT');

    // 5. User B using the same mutation ID: independent namespace, succeeds for User B
    const resUserB = await app.request(
      '/api/sync/push',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenB}`,
        },
        body: JSON.stringify({
          mutations: [
            {
              mutationId: 'mut-binding-1',
              entityType: 'wardrobe_item',
              entityId: 'item-bob-bind-1',
              action: 'upsert',
              clientTimestamp: Date.now(),
              data: {
                name: 'Bob Linen Shirt',
                category: 'Tops',
                subcategory: 'Shirt',
                formality: 2,
                status: 'clean',
              },
            },
          ],
        }),
      },
      testEnv
    );
    expect(resUserB.status).toBe(200);
    const bodyUserB: any = await resUserB.json();
    expect(bodyUserB.results[0].status).toBe('applied');
  });

  // --------------------------------------------------------------------------
  // 16. SEC-SYNC-03: Complete Relationship Ownership Validation
  // --------------------------------------------------------------------------
  it('16. rejects foreign saved_outfits references in wear_events, style_signals, and calendar_plans', async () => {
    // Bob owns a private saved outfit
    const nowIso = new Date().toISOString();
    sqliteDb.exec(
      `INSERT INTO saved_outfits (id, user_id, name, template, slots, score, why, is_deleted, created_at, client_updated_at, server_updated_at)
       VALUES ('bob-private-outfit', '${userB.id}', 'Bob Private Outfit', 'classic', '{}', 9, 'Why', 0, '${nowIso}', '${nowIso}', '${nowIso}')`
    );

    // Alice owns an item
    sqliteDb.exec(
      `INSERT INTO wardrobe_items (id, user_id, name, category, subcategory, formality, status, is_deleted, created_at, client_updated_at, server_updated_at)
       VALUES ('alice-rel-item', '${userA.id}', 'Alice Top', 'Tops', 'Tee', 2, 'clean', 0, '${nowIso}', '${nowIso}', '${nowIso}')`
    );

    // 1. Alice tries to link Bob's outfit in wear_events
    const wearRes = await app.request(
      '/api/sync/push',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          mutations: [
            {
              mutationId: 'mut-rel-wear',
              entityType: 'wear_event',
              entityId: 'wear-rel-1',
              action: 'append',
              clientTimestamp: Date.now(),
              data: {
                wardrobeItemId: 'alice-rel-item',
                outfitId: 'bob-private-outfit', // FORBIDDEN: belongs to Bob!
                wornAt: nowIso,
              },
            },
          ],
        }),
      },
      testEnv
    );
    expect(wearRes.status).toBe(200);
    const wearBody: any = await wearRes.json();
    expect(wearBody.results[0].status).toBe('rejected');
    expect(wearBody.results[0].error).toContain('REFERENTIAL_INTEGRITY_VIOLATION');

    // 2. Alice tries to link Bob's outfit in style_signals
    const signalRes = await app.request(
      '/api/sync/push',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          mutations: [
            {
              mutationId: 'mut-rel-signal',
              entityType: 'style_signal',
              entityId: 'signal-rel-1',
              action: 'append',
              clientTimestamp: Date.now(),
              data: {
                signalType: 'like',
                outfitId: 'bob-private-outfit', // FORBIDDEN!
                itemIds: ['alice-rel-item'],
              },
            },
          ],
        }),
      },
      testEnv
    );
    expect(signalRes.status).toBe(200);
    const signalBody: any = await signalRes.json();
    expect(signalBody.results[0].status).toBe('rejected');
    expect(signalBody.results[0].error).toContain('REFERENTIAL_INTEGRITY_VIOLATION');

    // 3. Alice tries to link Bob's outfit in calendar_plans
    const planRes = await app.request(
      '/api/sync/push',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          mutations: [
            {
              mutationId: 'mut-rel-plan',
              entityType: 'calendar_plan',
              entityId: 'plan-rel-1',
              action: 'upsert',
              clientTimestamp: Date.now(),
              data: {
                date: '2026-11-25',
                occasion: 'Meeting',
                status: 'planned',
                outfitId: 'bob-private-outfit', // FORBIDDEN!
                outfit: { slots: {} },
              },
            },
          ],
        }),
      },
      testEnv
    );
    expect(planRes.status).toBe(200);
    const planBody: any = await planRes.json();
    expect(planBody.results[0].status).toBe('rejected');
    expect(planBody.results[0].error).toContain('REFERENTIAL_INTEGRITY_VIOLATION');
  });

  // --------------------------------------------------------------------------
  // 17. ARCH-SYNC-05: Clock Skew Clamping & Forward Skew Protection
  // --------------------------------------------------------------------------
  it('17. clamps forward client timestamps so skewed devices cannot stall real-time updates', async () => {
    const realNow = Date.now();
    const skewedTimestamp = realNow + 3600000; // 1 hour in the future

    // 1. Skewed device pushes an update claiming to be 1 hour ahead
    const res1 = await app.request(
      '/api/sync/push',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          mutations: [
            {
              mutationId: 'mut-skew-test-1',
              entityType: 'wardrobe_item',
              entityId: 'item-skew-test-1',
              action: 'upsert',
              clientTimestamp: skewedTimestamp,
              data: {
                name: 'Item Written In The Future',
                category: 'Tops',
                subcategory: 'Shirt',
                formality: 3,
                status: 'clean',
              },
            },
          ],
        }),
      },
      testEnv
    );
    expect(res1.status).toBe(200);

    // 2. Normal device with accurate clock pushes update 15ms later
    await new Promise((r) => setTimeout(r, 15));
    const normalTimestamp = Date.now();
    const res2 = await app.request(
      '/api/sync/push',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          mutations: [
            {
              mutationId: 'mut-skew-test-2',
              entityType: 'wardrobe_item',
              entityId: 'item-skew-test-1',
              action: 'upsert',
              expectedRevision: 1,
              clientTimestamp: normalTimestamp,
              data: {
                name: 'Normal Device Legitimate Update',
                category: 'Tops',
                subcategory: 'Shirt',
                formality: 4,
                status: 'clean',
              },
            },
          ],
        }),
      },
      testEnv
    );

    expect(res2.status).toBe(200);
    const body2: any = await res2.json();
    // Normal device update is successfully applied because the previous skewed timestamp was clamped!
    expect(body2.results[0].status).toBe('applied');

    const dbRow = sqliteDb
      .prepare(`SELECT name FROM wardrobe_items WHERE id = 'item-skew-test-1' AND user_id = '${userA.id}'`)
      .get() as any;
    expect(dbRow.name).toBe('Normal Device Legitimate Update');
  });

  // --------------------------------------------------------------------------
  // 18. DATA-SYNC-02: Explicit Restoration Semantics
  // --------------------------------------------------------------------------
  it('18. allows intentional restoration of deleted items while rejecting stale resurrection', async () => {
    // 1. Create item in past so future timestamp clamping does not collapse t1 and t2 into the same server ms
    const t0 = Date.now() - 10000;
    await app.request(
      '/api/sync/push',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          mutations: [
            {
              mutationId: 'mut-restore-t0',
              entityType: 'wardrobe_item',
              entityId: 'item-restore-1',
              action: 'upsert',
              clientTimestamp: t0,
              data: {
                name: 'Velvet Blazer',
                category: 'Outerwear',
                subcategory: 'Blazer',
                formality: 5,
                status: 'clean',
              },
            },
          ],
        }),
      },
      testEnv
    );

    // 2. Delete item at T1
    const t1 = t0 + 2000;
    await app.request(
      '/api/sync/push',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          mutations: [
            {
              mutationId: 'mut-restore-t1',
              entityType: 'wardrobe_item',
              entityId: 'item-restore-1',
              action: 'delete',
              expectedRevision: 1,
              clientTimestamp: t1,
              data: { deletedAt: t1 },
            },
          ],
        }),
      },
      testEnv
    );

    // Verify deleted
    const delRow = sqliteDb
      .prepare(`SELECT is_deleted FROM wardrobe_items WHERE id = 'item-restore-1' AND user_id = '${userA.id}'`)
      .get() as any;
    expect(delRow.is_deleted).toBe(1);

    // 3. Stale update at T0 + 1000 (before deletion) -> REJECTED (zombie resurrection prevented)
    const staleRes = await app.request(
      '/api/sync/push',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          mutations: [
            {
              mutationId: 'mut-restore-stale',
              entityType: 'wardrobe_item',
              entityId: 'item-restore-1',
              action: 'upsert',
              clientTimestamp: t0 + 1000,
              data: {
                name: 'Velvet Blazer (Stale)',
                category: 'Outerwear',
                subcategory: 'Blazer',
                formality: 5,
              },
            },
          ],
        }),
      },
      testEnv
    );
    const staleBody: any = await staleRes.json();
    expect(staleBody.results[0].status).toBe('conflict_server_wins');

    // 4. Explicit restore at T2 (where T2 > T1 deletion) -> APPLIED!
    const t2 = t1 + 2000;
    const restoreRes = await app.request(
      '/api/sync/push',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          mutations: [
            {
              mutationId: 'mut-restore-t2',
              entityType: 'wardrobe_item',
              entityId: 'item-restore-1',
              action: 'restore',
              expectedRevision: 2,
              clientTimestamp: t2,
              data: {
                name: 'Velvet Blazer (Restored)',
                category: 'Outerwear',
                subcategory: 'Blazer',
                formality: 5,
                isRestore: true,
              },
            },
          ],
        }),
      },
      testEnv
    );
    expect(restoreRes.status).toBe(200);
    const restoreBody: any = await restoreRes.json();
    expect(restoreBody.results[0].status).toBe('applied');

    // Verify item is restored to active (is_deleted = 0) in D1
    const restoredRow = sqliteDb
      .prepare(`SELECT is_deleted, name FROM wardrobe_items WHERE id = 'item-restore-1' AND user_id = '${userA.id}'`)
      .get() as any;
    expect(restoredRow.is_deleted).toBe(0);
    expect(restoredRow.name).toBe('Velvet Blazer (Restored)');
  });

  // --------------------------------------------------------------------------
  // 19. DATA-SYNC-04: Transactional Atomicity of Entity & Idempotency Write
  // --------------------------------------------------------------------------
  it('19. ensures entity mutation and idempotency token are committed atomically in D1 batch', async () => {
    // If a mutation succeeds, both the entity row and sync_mutations row exist
    const res = await app.request(
      '/api/sync/push',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          mutations: [
            {
              mutationId: 'mut-atomic-1',
              entityType: 'wardrobe_item',
              entityId: 'item-atomic-1',
              action: 'upsert',
              clientTimestamp: Date.now(),
              data: {
                name: 'Atomic Kurta',
                category: 'Ethnic',
                subcategory: 'Kurta',
                formality: 3,
                status: 'clean',
              },
            },
          ],
        }),
      },
      testEnv
    );
    expect(res.status).toBe(200);

    const itemRow = sqliteDb
      .prepare(`SELECT * FROM wardrobe_items WHERE id = 'item-atomic-1' AND user_id = '${userA.id}'`)
      .get() as any;
    expect(itemRow).toBeDefined();

    const mutRow = sqliteDb
      .prepare(`SELECT * FROM sync_mutations WHERE mutation_id = 'mut-atomic-1' AND user_id = '${userA.id}'`)
      .get() as any;
    expect(mutRow).toBeDefined();
    expect(mutRow.entity_id).toBe('item-atomic-1');
    expect(mutRow.payload_hash).toBeTruthy();
  });

  // ==========================================================================
  // Phase 3C.4: Dedicated Data-Integrity Remediation Test Suite
  // ==========================================================================
  describe('Phase 3C.4: Critical Sync Integrity Remediation Verifications', () => {
    it('20. enforces server-authoritative monotonic revisions and optimistic concurrency', async () => {
      // Step A: Device 1 creates an item (starts at revision 1)
      const t0 = Date.now() - 50000;
      const createRes = await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenA}`,
          },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: 'mut-rev-create-1',
                entityType: 'wardrobe_item',
                entityId: 'item-rev-1',
                action: 'upsert',
                clientTimestamp: t0,
                data: {
                  name: 'Initial Silk Kurta',
                  category: 'Ethnic',
                  subcategory: 'Kurta',
                  formality: 4,
                  status: 'clean',
                },
              },
            ],
          }),
        },
        testEnv
      );
      expect(createRes.status).toBe(200);
      const createBody: any = await createRes.json();
      expect(createBody.results[0].status).toBe('applied');
      expect(createBody.results[0].serverRevision).toBe(1);

      // Verify D1 revision is 1
      const row1 = sqliteDb
        .prepare(`SELECT revision FROM wardrobe_items WHERE id = 'item-rev-1' AND user_id = '${userA.id}'`)
        .get() as any;
      expect(row1.revision).toBe(1);

      // Step B: Device 1 updates item with expectedRevision: 1 -> advances to revision 2
      const t1 = t0 + 10000;
      const updateRes1 = await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenA}`,
          },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: 'mut-rev-update-1',
                entityType: 'wardrobe_item',
                entityId: 'item-rev-1',
                action: 'upsert',
                expectedRevision: 1,
                clientTimestamp: t1,
                data: {
                  name: 'Edited Silk Kurta (Device 1)',
                  formality: 5,
                },
              },
            ],
          }),
        },
        testEnv
      );
      expect(updateRes1.status).toBe(200);
      const updateBody1: any = await updateRes1.json();
      expect(updateBody1.results[0].status).toBe('applied');
      expect(updateBody1.results[0].serverRevision).toBe(2);

      const row2 = sqliteDb
        .prepare(`SELECT revision, name FROM wardrobe_items WHERE id = 'item-rev-1' AND user_id = '${userA.id}'`)
        .get() as any;
      expect(row2.revision).toBe(2);
      expect(row2.name).toBe('Edited Silk Kurta (Device 1)');

      // Step C: Device 2 was offline and sends update based on stale expectedRevision: 1
      // Even if Device 2 claims a NEWER client timestamp (t1 + 5000), revision mismatch MUST reject it!
      const t2 = t1 + 5000;
      const updateRes2 = await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenA}`,
          },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: 'mut-rev-update-2-stale',
                entityType: 'wardrobe_item',
                entityId: 'item-rev-1',
                action: 'upsert',
                expectedRevision: 1, // Stale! Current server revision is 2
                clientTimestamp: t2, // Even with newer client timestamp!
                data: {
                  name: 'Conflicting Stale Kurta (Device 2)',
                  formality: 1,
                },
              },
            ],
          }),
        },
        testEnv
      );
      expect(updateRes2.status).toBe(200);
      const updateBody2: any = await updateRes2.json();
      expect(updateBody2.results[0].status).toBe('conflict_server_wins');
      expect(updateBody2.results[0].serverRevision).toBe(2);
      expect(updateBody2.results[0].error).toContain('STALE_REVISION');
      expect(updateBody2.results[0].conflictData.name).toBe('Edited Silk Kurta (Device 1)');

      // Verify D1 was NOT overwritten by the stale update
      const rowAfterConflict = sqliteDb
        .prepare(`SELECT revision, name FROM wardrobe_items WHERE id = 'item-rev-1' AND user_id = '${userA.id}'`)
        .get() as any;
      expect(rowAfterConflict.revision).toBe(2);
      expect(rowAfterConflict.name).toBe('Edited Silk Kurta (Device 1)');
    });

    it('21. rejects stale deletes when an edit has occurred at a later timestamp or higher revision', async () => {
      // 1. Create an item at T0
      const t0 = Date.now() - 30000;
      await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenA}`,
          },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: 'mut-staledel-create',
                entityType: 'wardrobe_item',
                entityId: 'item-staledel-1',
                action: 'upsert',
                clientTimestamp: t0,
                data: { name: 'Linen Shirt', category: 'Tops', subcategory: 'Shirt', formality: 3 },
              },
            ],
          }),
        },
        testEnv
      );

      // 2. Active edit at T2 (T2 = T0 + 20000) -> advances to revision 2
      const t2 = t0 + 20000;
      const editRes = await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenA}`,
          },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: 'mut-staledel-edit',
                entityType: 'wardrobe_item',
                entityId: 'item-staledel-1',
                action: 'upsert',
                expectedRevision: 1,
                clientTimestamp: t2,
                data: { name: 'Linen Shirt (Updated at T2)' },
              },
            ],
          }),
        },
        testEnv
      );
      expect(editRes.status).toBe(200);

      // 3. Stale delete from an offline device that deleted at T1 (T1 = T0 + 5000 < T2)
      // and has expectedRevision: 1
      const t1 = t0 + 5000;
      const staleDeleteRes = await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenA}`,
          },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: 'mut-staledel-delete-stale',
                entityType: 'wardrobe_item',
                entityId: 'item-staledel-1',
                action: 'delete',
                expectedRevision: 1, // Stale! Server is at revision 2
                clientTimestamp: t1, // Stale! Earlier than edit at T2
                data: { deletedAt: t1 },
              },
            ],
          }),
        },
        testEnv
      );
      expect(staleDeleteRes.status).toBe(200);
      const staleDeleteBody: any = await staleDeleteRes.json();
      expect(staleDeleteBody.results[0].status).toBe('conflict_server_wins');
      expect(staleDeleteBody.results[0].serverRevision).toBe(2);

      // Verify item remains active and NOT deleted
      const checkRow = sqliteDb
        .prepare(`SELECT is_deleted, revision, name FROM wardrobe_items WHERE id = 'item-staledel-1' AND user_id = '${userA.id}'`)
        .get() as any;
      expect(checkRow.is_deleted).toBe(0);
      expect(checkRow.revision).toBe(2);
      expect(checkRow.name).toBe('Linen Shirt (Updated at T2)');
    });

    it('22. rejects stale restores when timestamp is older than deletion or expected revision mismatches', async () => {
      // 1. Create item at T0
      const t0 = Date.now() - 40000;
      await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: 'mut-stalerestore-create',
                entityType: 'wardrobe_item',
                entityId: 'item-stalerestore-1',
                action: 'upsert',
                clientTimestamp: t0,
                data: { name: 'Chino Pants', category: 'Bottoms', subcategory: 'Pants', formality: 3 },
              },
            ],
          }),
        },
        testEnv
      );

      // 2. Delete item at T2 -> enters tombstone state with revision 2
      const t2 = t0 + 20000;
      const delRes = await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: 'mut-stalerestore-del',
                entityType: 'wardrobe_item',
                entityId: 'item-stalerestore-1',
                action: 'delete',
                expectedRevision: 1,
                clientTimestamp: t2,
                data: { deletedAt: t2 },
              },
            ],
          }),
        },
        testEnv
      );
      expect(delRes.status).toBe(200);

      // 3. Phase 3C.6: Legitimate restore with backward device clock (T1 < T2) succeeds because expectedRevision: 2 matches!
      const t1 = t0 + 10000; // 10s earlier than deletion at t2
      const backwardRestoreRes = await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: 'mut-restore-backward-clock',
                entityType: 'wardrobe_item',
                entityId: 'item-stalerestore-1',
                action: 'restore',
                expectedRevision: 2,
                clientTimestamp: t1,
                data: { name: 'Chino Pants (Restored with Backward Clock)' },
              },
            ],
          }),
        },
        testEnv
      );
      expect(backwardRestoreRes.status).toBe(200);
      const backwardRestoreBody: any = await backwardRestoreRes.json();
      expect(backwardRestoreBody.results[0].status).toBe('applied');
      expect(backwardRestoreBody.results[0].serverRevision).toBe(3);

      // Verify item was un-deleted in D1
      const restoredRow = sqliteDb
        .prepare(`SELECT is_deleted, revision, name FROM wardrobe_items WHERE id = 'item-stalerestore-1' AND user_id = '${userA.id}'`)
        .get() as any;
      expect(restoredRow.is_deleted).toBe(0);
      expect(restoredRow.revision).toBe(3);

      // Re-delete item at revision 3 -> advances server revision to 4
      const t3 = t2 + 10000;
      const reDelRes = await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: 'mut-redel-1',
                entityType: 'wardrobe_item',
                entityId: 'item-stalerestore-1',
                action: 'delete',
                expectedRevision: 3,
                clientTimestamp: t3,
                data: { deletedAt: t3 },
              },
            ],
          }),
        },
        testEnv
      );
      expect(reDelRes.status).toBe(200);

      // 4. Stale restore attempt with revision mismatch (expectedRevision: 2 when server tombstone is at 4)
      const staleRevRestoreRes = await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: 'mut-stalerestore-oldrev',
                entityType: 'wardrobe_item',
                entityId: 'item-stalerestore-1',
                action: 'restore',
                expectedRevision: 2, // Stale! Server tombstone is at revision 4
                clientTimestamp: t3 + 5000,
                data: { name: 'Chino Pants (Stale Rev Restore)' },
              },
            ],
          }),
        },
        testEnv
      );
      expect(staleRevRestoreRes.status).toBe(200);
      const staleRevBody: any = await staleRevRestoreRes.json();
      expect(staleRevBody.results[0].status).toBe('conflict_server_wins');
      expect(staleRevBody.results[0].error).toContain('STALE_REVISION');

      // Verify item remains tombstoned
      const row = sqliteDb
        .prepare(`SELECT is_deleted, revision FROM wardrobe_items WHERE id = 'item-stalerestore-1' AND user_id = '${userA.id}'`)
        .get() as any;
      expect(row.is_deleted).toBe(1);
      expect(row.revision).toBe(4);
    });

    it('23. handles idempotency key conflicts and payload mismatches deterministically', async () => {
      const mutKey = 'mut-idem-strict-1';
      const t0 = Date.now();

      // Step 1: Initial mutation succeeds
      const initialRes = await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: mutKey,
                entityType: 'wardrobe_item',
                entityId: 'item-idem-1',
                action: 'upsert',
                clientTimestamp: t0,
                data: { name: 'Original Blazer', category: 'Outerwear', subcategory: 'Blazer', formality: 5 },
              },
            ],
          }),
        },
        testEnv
      );
      expect(initialRes.status).toBe(200);
      const initialBody: any = await initialRes.json();
      expect(initialBody.results[0].status).toBe('applied');

      // Step 2: Identical retry succeeds idempotently with already_applied
      const retryRes = await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: mutKey,
                entityType: 'wardrobe_item',
                entityId: 'item-idem-1',
                action: 'upsert',
                clientTimestamp: t0,
                data: { name: 'Original Blazer', category: 'Outerwear', subcategory: 'Blazer', formality: 5 },
              },
            ],
          }),
        },
        testEnv
      );
      expect(retryRes.status).toBe(200);
      const retryBody: any = await retryRes.json();
      expect(retryBody.results[0].status).toBe('already_applied');

      // Step 3: Reuse same mutation ID with different payload -> rejected with IDEMPOTENCY_CONFLICT
      const payloadMismatchRes = await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: mutKey,
                entityType: 'wardrobe_item',
                entityId: 'item-idem-1',
                action: 'upsert',
                clientTimestamp: t0,
                data: { name: 'Tampered Blazer Payload', category: 'Outerwear', subcategory: 'Blazer', formality: 1 },
              },
            ],
          }),
        },
        testEnv
      );
      expect(payloadMismatchRes.status).toBe(200);
      const mismatchBody: any = await payloadMismatchRes.json();
      expect(mismatchBody.results[0].status).toBe('rejected');
      expect(mismatchBody.results[0].error).toContain('IDEMPOTENCY_CONFLICT');

      // Step 4: Reuse same mutation ID with different entity ID -> rejected with IDEMPOTENCY_CONFLICT
      const entityMismatchRes = await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: mutKey,
                entityType: 'wardrobe_item',
                entityId: 'item-completely-different-id',
                action: 'upsert',
                clientTimestamp: t0,
                data: { name: 'Original Blazer', category: 'Outerwear', subcategory: 'Blazer', formality: 5 },
              },
            ],
          }),
        },
        testEnv
      );
      expect(entityMismatchRes.status).toBe(200);
      const entityMismatchBody: any = await entityMismatchRes.json();
      expect(entityMismatchBody.results[0].status).toBe('rejected');
      expect(entityMismatchBody.results[0].error).toContain('IDEMPOTENCY_CONFLICT');
    });

    it('24. validates relationship ownership across both string and object slot formats', async () => {
      // 1. Create User A item and User B item
      await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: 'mut-item-a-slot',
                entityType: 'wardrobe_item',
                entityId: 'item-a-for-slot',
                action: 'upsert',
                clientTimestamp: Date.now(),
                data: { name: 'User A Top', category: 'Tops', subcategory: 'Shirt', formality: 3 },
              },
            ],
          }),
        },
        testEnv
      );

      await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: 'mut-item-b-slot',
                entityType: 'wardrobe_item',
                entityId: 'item-b-for-slot',
                action: 'upsert',
                clientTimestamp: Date.now(),
                data: { name: 'User B Top', category: 'Tops', subcategory: 'Shirt', formality: 3 },
              },
            ],
          }),
        },
        testEnv
      );

      // Case A: User A creates outfit with STRING slot referencing User B's item -> REJECTED
      const crossStringSlotRes = await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: 'mut-outfit-cross-string',
                entityType: 'saved_outfit',
                entityId: 'outfit-cross-string-1',
                action: 'upsert',
                clientTimestamp: Date.now(),
                data: {
                  name: 'Cross User String Slot Outfit',
                  slots: {
                    top: 'item-b-for-slot', // String form of foreign item ID!
                  },
                },
              },
            ],
          }),
        },
        testEnv
      );
      expect(crossStringSlotRes.status).toBe(200);
      const crossStringBody: any = await crossStringSlotRes.json();
      expect(crossStringBody.results[0].status).toBe('rejected');
      expect(crossStringBody.results[0].error).toContain('REFERENTIAL_INTEGRITY_VIOLATION');

      // Case B: User A creates outfit with OBJECT slot referencing User B's item -> REJECTED
      const crossObjSlotRes = await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: 'mut-outfit-cross-obj',
                entityType: 'saved_outfit',
                entityId: 'outfit-cross-obj-1',
                action: 'upsert',
                clientTimestamp: Date.now(),
                data: {
                  name: 'Cross User Object Slot Outfit',
                  slots: {
                    top: { id: 'item-b-for-slot' }, // Object form of foreign item ID!
                  },
                },
              },
            ],
          }),
        },
        testEnv
      );
      expect(crossObjSlotRes.status).toBe(200);
      const crossObjBody: any = await crossObjSlotRes.json();
      expect(crossObjBody.results[0].status).toBe('rejected');
      expect(crossObjBody.results[0].error).toContain('REFERENTIAL_INTEGRITY_VIOLATION');

      // Case C: User A creates outfit with legitimate STRING slot -> APPLIED
      const validStringSlotRes = await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: 'mut-outfit-valid-string',
                entityType: 'saved_outfit',
                entityId: 'outfit-valid-string-1',
                action: 'upsert',
                clientTimestamp: Date.now(),
                data: {
                  name: 'Valid String Slot Outfit',
                  slots: {
                    top: 'item-a-for-slot',
                  },
                },
              },
            ],
          }),
        },
        testEnv
      );
      expect(validStringSlotRes.status).toBe(200);
      const validStringBody: any = await validStringSlotRes.json();
      expect(validStringBody.results[0].status).toBe('applied');

      // Case D: User A creates outfit with legitimate OBJECT slot -> APPLIED
      const validObjSlotRes = await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: 'mut-outfit-valid-obj',
                entityType: 'saved_outfit',
                entityId: 'outfit-valid-obj-1',
                action: 'upsert',
                clientTimestamp: Date.now(),
                data: {
                  name: 'Valid Object Slot Outfit',
                  slots: {
                    top: { id: 'item-a-for-slot' },
                  },
                },
              },
            ],
          }),
        },
        testEnv
      );
      expect(validObjSlotRes.status).toBe(200);
      const validObjBody: any = await validObjSlotRes.json();
      expect(validObjBody.results[0].status).toBe('applied');
    });

    it('25. preserves tombstones indefinitely so long-disconnected devices (91, 180 days) cannot resurrect records', async () => {
      // Step 1: Create an item 200 days ago
      const days200Ago = Date.now() - 200 * 24 * 60 * 60 * 1000;
      await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: 'mut-old-tombstone-create',
                entityType: 'wardrobe_item',
                entityId: 'item-ancient-1',
                action: 'upsert',
                clientTimestamp: days200Ago,
                data: { name: 'Vintage Vest', category: 'Tops', subcategory: 'Vest', formality: 3 },
              },
            ],
          }),
        },
        testEnv
      );

      // Step 2: Delete the item 150 days ago (more than 90 days ago!)
      const days150Ago = Date.now() - 150 * 24 * 60 * 60 * 1000;
      await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: 'mut-old-tombstone-del',
                entityType: 'wardrobe_item',
                entityId: 'item-ancient-1',
                action: 'delete',
                expectedRevision: 1,
                clientTimestamp: days150Ago,
                data: { deletedAt: days150Ago },
              },
            ],
          }),
        },
        testEnv
      );

      // Verify tombstone is preserved in D1 (NOT purged by any 90-day timer)
      const tombstoneRow = sqliteDb
        .prepare(`SELECT is_deleted, deleted_at FROM wardrobe_items WHERE id = 'item-ancient-1' AND user_id = '${userA.id}'`)
        .get() as any;
      expect(tombstoneRow.is_deleted).toBe(1);
      expect(tombstoneRow.deleted_at).toBeTruthy();

      // Step 3: A device that was offline for 180 days (or even currently reconnecting)
      // tries to sync an edit from 180 days ago (older than deletion)
      const days180Ago = Date.now() - 180 * 24 * 60 * 60 * 1000;
      const offlineEditRes = await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: 'mut-offline-device-resurrect',
                entityType: 'wardrobe_item',
                entityId: 'item-ancient-1',
                action: 'upsert',
                expectedRevision: 1,
                clientTimestamp: days180Ago,
                data: { name: 'Vintage Vest (Old Offline Edit)' },
              },
            ],
          }),
        },
        testEnv
      );
      expect(offlineEditRes.status).toBe(200);
      const offlineEditBody: any = await offlineEditRes.json();

      // Tombstone MUST win permanently over the stale active update
      expect(offlineEditBody.results[0].status).toBe('conflict_server_wins');
      expect(offlineEditBody.results[0].error).toContain('TOMBSTONE_CONFLICT');

      // Verify the item is STILL tombstoned in D1
      const finalRow = sqliteDb
        .prepare(`SELECT is_deleted FROM wardrobe_items WHERE id = 'item-ancient-1' AND user_id = '${userA.id}'`)
        .get() as any;
      expect(finalRow.is_deleted).toBe(1);
    });
  });

  // ==========================================================================
  // Phase 3C.6: Restore Revision Enforcement & Legacy Compatibility Closure
  // ==========================================================================
  describe('Phase 3C.6: Revision Enforcement & Legacy Compatibility Closure', () => {
    it('26. allows legitimate restore with exact revision even when device clock is backward (clock skew immunity)', async () => {
      // 1. Create item at T0 (revision = 1)
      const t0 = Date.now() - 60000;
      await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: 'mut-3c6-create',
                entityType: 'wardrobe_item',
                entityId: 'item-3c6-skew',
                action: 'upsert',
                clientTimestamp: t0,
                data: { name: 'Bandhgala Jacket', category: 'Outerwear', subcategory: 'Jacket', formality: 5 },
              },
            ],
          }),
        },
        testEnv
      );

      // 2. Delete item at T1 (T1 = T0 + 20000) -> enters tombstone state with revision 2
      const t1 = t0 + 20000;
      await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: 'mut-3c6-del',
                entityType: 'wardrobe_item',
                entityId: 'item-3c6-skew',
                action: 'delete',
                expectedRevision: 1,
                clientTimestamp: t1,
                data: { deletedAt: t1 },
              },
            ],
          }),
        },
        testEnv
      );

      // 3. User device clock is skewed backward by 10 minutes (T_skew < T1 deletion)
      const tBackward = t1 - 600000;
      const restoreRes = await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: 'mut-3c6-restore-backward',
                entityType: 'wardrobe_item',
                entityId: 'item-3c6-skew',
                action: 'restore',
                expectedRevision: 2, // Exact tombstone revision!
                clientTimestamp: tBackward, // Severely backward client clock!
                data: { name: 'Bandhgala Jacket (Restored with Skewed Clock)' },
              },
            ],
          }),
        },
        testEnv
      );

      expect(restoreRes.status).toBe(200);
      const restoreBody: any = await restoreRes.json();
      expect(restoreBody.results[0].status).toBe('applied');
      expect(restoreBody.results[0].serverRevision).toBe(3);

      // Verify un-deleted in D1
      const restored = sqliteDb
        .prepare(`SELECT is_deleted, revision, name FROM wardrobe_items WHERE id = 'item-3c6-skew' AND user_id = '${userA.id}'`)
        .get() as any;
      expect(restored.is_deleted).toBe(0);
      expect(restored.revision).toBe(3);
      expect(restored.name).toBe('Bandhgala Jacket (Restored with Skewed Clock)');
    });

    it('27. rejects restore, delete, and update without expectedRevision with REVISION_REQUIRED across all 4 mutable entities', async () => {
      const now = Date.now();

      // Seed all 4 mutable entities initially (each starts at revision 1)
      await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: 'mut-seed-item',
                entityType: 'wardrobe_item',
                entityId: 'item-req-1',
                action: 'upsert',
                clientTimestamp: now,
                data: { name: 'Seed Kurta', category: 'Ethnic', subcategory: 'Kurta', formality: 4 },
              },
              {
                mutationId: 'mut-seed-outfit',
                entityType: 'saved_outfit',
                entityId: 'outfit-req-1',
                action: 'upsert',
                clientTimestamp: now,
                data: { name: 'Seed Outfit', slots: { top: 'item-req-1' } },
              },
              {
                mutationId: 'mut-seed-plan',
                entityType: 'calendar_plan',
                entityId: 'plan-req-1',
                action: 'upsert',
                clientTimestamp: now,
                data: { date: '2026-12-01', occasion: 'Gala', status: 'planned', outfit: { slots: { top: 'item-req-1' } } },
              },
              {
                mutationId: 'mut-seed-pref',
                entityType: 'style_preferences',
                entityId: 'preferences',
                action: 'upsert',
                clientTimestamp: now,
                data: { stylingMode: 'variety' },
              },
            ],
          }),
        },
        testEnv
      );

      // A. UPDATE without expectedRevision on existing records -> REVISION_REQUIRED
      const unversionedUpdates = await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: 'mut-unver-item',
                entityType: 'wardrobe_item',
                entityId: 'item-req-1',
                action: 'upsert',
                clientTimestamp: now + 1000,
                data: { name: 'Attempted Unversioned Item Update' },
              },
              {
                mutationId: 'mut-unver-outfit',
                entityType: 'saved_outfit',
                entityId: 'outfit-req-1',
                action: 'upsert',
                clientTimestamp: now + 1000,
                data: { name: 'Attempted Unversioned Outfit Update' },
              },
              {
                mutationId: 'mut-unver-plan',
                entityType: 'calendar_plan',
                entityId: 'plan-req-1',
                action: 'upsert',
                clientTimestamp: now + 1000,
                data: { date: '2026-12-01', occasion: 'Updated Gala' },
              },
              {
                mutationId: 'mut-unver-pref',
                entityType: 'style_preferences',
                entityId: 'preferences',
                action: 'upsert',
                clientTimestamp: now + 1000,
                data: { stylingMode: 'experiment' },
              },
            ],
          }),
        },
        testEnv
      );
      expect(unversionedUpdates.status).toBe(200);
      const updateBody: any = await unversionedUpdates.json();
      expect(updateBody.results[0].status).toBe('rejected');
      expect(updateBody.results[0].error).toContain('REVISION_REQUIRED');
      expect(updateBody.results[1].status).toBe('rejected');
      expect(updateBody.results[1].error).toContain('REVISION_REQUIRED');
      expect(updateBody.results[2].status).toBe('rejected');
      expect(updateBody.results[2].error).toContain('REVISION_REQUIRED');
      expect(updateBody.results[3].status).toBe('rejected');
      expect(updateBody.results[3].error).toContain('REVISION_REQUIRED');

      // B. DELETE without expectedRevision on existing records -> REVISION_REQUIRED
      const unversionedDeletes = await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: 'mut-del-no-rev-item',
                entityType: 'wardrobe_item',
                entityId: 'item-req-1',
                action: 'delete',
                clientTimestamp: now + 2000,
                data: { deletedAt: now + 2000 },
              },
              {
                mutationId: 'mut-del-no-rev-outfit',
                entityType: 'saved_outfit',
                entityId: 'outfit-req-1',
                action: 'delete',
                clientTimestamp: now + 2000,
                data: { deletedAt: now + 2000 },
              },
              {
                mutationId: 'mut-del-no-rev-plan',
                entityType: 'calendar_plan',
                entityId: 'plan-req-1',
                action: 'delete',
                clientTimestamp: now + 2000,
                data: { deletedAt: now + 2000 },
              },
            ],
          }),
        },
        testEnv
      );
      expect(unversionedDeletes.status).toBe(200);
      const deleteBody: any = await unversionedDeletes.json();
      expect(deleteBody.results[0].status).toBe('rejected');
      expect(deleteBody.results[0].error).toContain('REVISION_REQUIRED');
      expect(deleteBody.results[1].status).toBe('rejected');
      expect(deleteBody.results[1].error).toContain('REVISION_REQUIRED');
      expect(deleteBody.results[2].status).toBe('rejected');
      expect(deleteBody.results[2].error).toContain('REVISION_REQUIRED');

      // Now legitimately delete the item with expectedRevision: 1 -> advances to revision 2
      await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: 'mut-legit-del-item',
                entityType: 'wardrobe_item',
                entityId: 'item-req-1',
                action: 'delete',
                expectedRevision: 1,
                clientTimestamp: now + 3000,
                data: { deletedAt: now + 3000 },
              },
            ],
          }),
        },
        testEnv
      );

      // C. RESTORE without expectedRevision -> REVISION_REQUIRED
      const unversionedRestore = await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: 'mut-restore-no-rev',
                entityType: 'wardrobe_item',
                entityId: 'item-req-1',
                action: 'restore',
                clientTimestamp: now + 4000,
                data: { name: 'Attempted Unversioned Restore' },
              },
            ],
          }),
        },
        testEnv
      );
      expect(unversionedRestore.status).toBe(200);
      const restoreBody: any = await unversionedRestore.json();
      expect(restoreBody.results[0].status).toBe('rejected');
      expect(restoreBody.results[0].error).toContain('REVISION_REQUIRED');
    });

    it('28. rejects negative, NaN, or non-integer expectedRevision during input validation with HTTP 400', async () => {
      // 1. Negative revision
      const negRes = await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: 'mut-neg-rev',
                entityType: 'wardrobe_item',
                entityId: 'item-val-1',
                action: 'upsert',
                expectedRevision: -1,
                clientTimestamp: Date.now(),
                data: { name: 'Negative Rev' },
              },
            ],
          }),
        },
        testEnv
      );
      expect(negRes.status).toBe(400);
      const negBody: any = await negRes.json();
      expect(negBody.error).toBe('VALIDATION_FAILED');
      expect(negBody.message).toContain('invalid expectedRevision');

      // 2. Float / non-integer revision
      const floatRes = await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: 'mut-float-rev',
                entityType: 'wardrobe_item',
                entityId: 'item-val-1',
                action: 'upsert',
                expectedRevision: 1.5,
                clientTimestamp: Date.now(),
                data: { name: 'Float Rev' },
              },
            ],
          }),
        },
        testEnv
      );
      expect(floatRes.status).toBe(400);
      const floatBody: any = await floatRes.json();
      expect(floatBody.error).toBe('VALIDATION_FAILED');
      expect(floatBody.message).toContain('invalid expectedRevision');
    });

    it('29. handles concurrent delete and restore safely with optimistic locking', async () => {
      // 1. Create item (starts at revision 1)
      await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: 'mut-conc-create',
                entityType: 'wardrobe_item',
                entityId: 'item-conc-1',
                action: 'upsert',
                clientTimestamp: Date.now() - 10000,
                data: { name: 'Concurrent Test Kurta', category: 'Ethnic', subcategory: 'Kurta', formality: 4 },
              },
            ],
          }),
        },
        testEnv
      );

      // 2. Device 1 successfully deletes item (advances revision to 2)
      const delRes = await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: 'mut-conc-del-1',
                entityType: 'wardrobe_item',
                entityId: 'item-conc-1',
                action: 'delete',
                expectedRevision: 1,
                clientTimestamp: Date.now(),
                data: { deletedAt: Date.now() },
              },
            ],
          }),
        },
        testEnv
      );
      expect(delRes.status).toBe(200);
      const delBody: any = await delRes.json();
      expect(delBody.results[0].status).toBe('applied');
      expect(delBody.results[0].serverRevision).toBe(2);

      // 3. Device 2 was offline and sends an update based on stale revision 1 -> rejected
      const staleUpdateRes = await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: 'mut-conc-update-stale',
                entityType: 'wardrobe_item',
                entityId: 'item-conc-1',
                action: 'upsert',
                expectedRevision: 1, // Stale! Server is at tombstone revision 2
                clientTimestamp: Date.now(),
                data: { name: 'Stale Edit from Device 2' },
              },
            ],
          }),
        },
        testEnv
      );
      expect(staleUpdateRes.status).toBe(200);
      const staleUpdateBody: any = await staleUpdateRes.json();
      expect(staleUpdateBody.results[0].status).toBe('conflict_server_wins');

      // 4. Device 2 tries to restore based on revision 1 -> rejected with STALE_REVISION
      const staleRestoreRes = await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: 'mut-conc-restore-stale',
                entityType: 'wardrobe_item',
                entityId: 'item-conc-1',
                action: 'restore',
                expectedRevision: 1, // Stale! Server tombstone is at revision 2
                clientTimestamp: Date.now(),
                data: { name: 'Stale Restore Attempt' },
              },
            ],
          }),
        },
        testEnv
      );
      expect(staleRestoreRes.status).toBe(200);
      const staleRestoreBody: any = await staleRestoreRes.json();
      expect(staleRestoreBody.results[0].status).toBe('conflict_server_wins');
      expect(staleRestoreBody.results[0].error).toContain('STALE_REVISION');

      // 5. Valid restore with exact revision 2 -> applied, advances to revision 3
      const validRestoreRes = await app.request(
        '/api/sync/push',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
          body: JSON.stringify({
            mutations: [
              {
                mutationId: 'mut-conc-restore-valid',
                entityType: 'wardrobe_item',
                entityId: 'item-conc-1',
                action: 'restore',
                expectedRevision: 2, // Exact matching revision!
                clientTimestamp: Date.now(),
                data: { name: 'Valid Restored Kurta' },
              },
            ],
          }),
        },
        testEnv
      );
      expect(validRestoreRes.status).toBe(200);
      const validRestoreBody: any = await validRestoreRes.json();
      expect(validRestoreBody.results[0].status).toBe('applied');
      expect(validRestoreBody.results[0].serverRevision).toBe(3);
    });
  });
});


