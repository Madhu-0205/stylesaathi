import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';

const MIGRATION_PATH = path.resolve(__dirname, '../migrations/0001_initial_schema.sql');

describe('Workstream 1: D1 SQLite Database Schema & Migration Tests (Native SQLite)', () => {
  let db: DatabaseSync;
  const migrationSql = fs.readFileSync(MIGRATION_PATH, 'utf-8');

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // Ignore if already closed
    }
  });

  it('executes 0001_initial_schema.sql cleanly on a fresh database', () => {
    expect(() => db.exec(migrationSql)).not.toThrow();

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;")
      .all() as { name: string }[];

    const expectedTables = [
      'account',
      'calendar_plans',
      'deletion_tombstones',
      'profiles',
      'saved_outfits',
      'session',
      'style_preferences',
      'style_signals',
      'user',
      'verification',
      'wardrobe_items',
      'wear_events',
    ];

    expect(tables.map((t) => t.name)).toEqual(expectedTables);
  });

  it('guarantees migration idempotency by succeeding on repeat execution', () => {
    // Run 1
    db.exec(migrationSql);

    // Run 2 (Idempotency check)
    expect(() => db.exec(migrationSql)).not.toThrow();

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;")
      .all() as { name: string }[];
    expect(tables.length).toBe(12);
  });

  it('initializes all 12 performance and sync indexes correctly', () => {
    db.exec(migrationSql);

    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name;")
      .all() as { name: string }[];

    const expectedIndexes = [
      'idx_account_user',
      'idx_calendar_plans_date',
      'idx_calendar_plans_sync',
      'idx_saved_outfits_sync',
      'idx_session_token',
      'idx_session_user',
      'idx_style_signals_user_created',
      'idx_tombstones_expires',
      'idx_verification_identifier',
      'idx_wardrobe_items_active',
      'idx_wardrobe_items_sync',
      'idx_wear_events_item',
    ];

    expect(indexes.map((i) => i.name)).toEqual(expectedIndexes);
  });

  it('enforces composite foreign key constraints on wear_events -> wardrobe_items', () => {
    db.exec(migrationSql);

    // Insert user
    db.exec(
      "INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES ('u1', 'Alice', 'alice@test.com', 1, '2026-11-06T00:00:00Z', '2026-11-06T00:00:00Z');"
    );

    // Insert wardrobe item
    db.exec(
      "INSERT INTO wardrobe_items (id, user_id, name, category, subcategory, formality, status, created_at, client_updated_at, server_updated_at) VALUES ('item1', 'u1', 'Silk Kurta', 'Ethnic', 'Kurta', 3, 'clean', '2026-11-06T00:00:00Z', '2026-11-06T00:00:00Z', '2026-11-06T00:00:00Z');"
    );

    // Valid wear event succeeds
    expect(() => {
      db.exec(
        "INSERT INTO wear_events (id, user_id, wardrobe_item_id, worn_at, created_at) VALUES ('wear1', 'u1', 'item1', '2026-11-06T10:00:00Z', '2026-11-06T10:00:00Z');"
      );
    }).not.toThrow();

    // Invalid wear event referencing non-existent item fails with FK constraint violation
    expect(() => {
      db.exec(
        "INSERT INTO wear_events (id, user_id, wardrobe_item_id, worn_at, created_at) VALUES ('wear_bad', 'u1', 'item_does_not_exist', '2026-11-06T10:00:00Z', '2026-11-06T10:00:00Z');"
      );
    }).toThrow(/FOREIGN KEY/i);
  });

  it('enforces ON DELETE RESTRICT on wardrobe_items when wear_events exist', () => {
    db.exec(migrationSql);

    db.exec(
      "INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES ('u1', 'Alice', 'alice@test.com', 1, '2026-11-06T00:00:00Z', '2026-11-06T00:00:00Z');"
    );
    db.exec(
      "INSERT INTO wardrobe_items (id, user_id, name, category, subcategory, formality, status, created_at, client_updated_at, server_updated_at) VALUES ('item1', 'u1', 'Silk Kurta', 'Ethnic', 'Kurta', 3, 'clean', '2026-11-06T00:00:00Z', '2026-11-06T00:00:00Z', '2026-11-06T00:00:00Z');"
    );
    db.exec(
      "INSERT INTO wear_events (id, user_id, wardrobe_item_id, worn_at, created_at) VALUES ('wear1', 'u1', 'item1', '2026-11-06T10:00:00Z', '2026-11-06T10:00:00Z');"
    );

    // Attempting to delete wardrobe item directly without deleting wear event must be restricted
    expect(() => {
      db.exec("DELETE FROM wardrobe_items WHERE id = 'item1' AND user_id = 'u1';");
    }).toThrow(/FOREIGN KEY/i);

    // Deleting wear event first then deleting item succeeds
    expect(() => {
      db.exec("DELETE FROM wear_events WHERE id = 'wear1';");
    }).not.toThrow();

    expect(() => {
      db.exec("DELETE FROM wardrobe_items WHERE id = 'item1' AND user_id = 'u1';");
    }).not.toThrow();
  });

  it('enforces monotonic calendar plan status invariant via trigger', () => {
    db.exec(migrationSql);

    db.exec(
      "INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES ('u1', 'Alice', 'alice@test.com', 1, '2026-11-06T00:00:00Z', '2026-11-06T00:00:00Z');"
    );
    db.exec(
      "INSERT INTO calendar_plans (id, user_id, date, occasion, status, outfit, created_at, client_updated_at, server_updated_at) VALUES ('plan1', 'u1', '2026-11-07', 'Wedding', 'worn', '{}', '2026-11-06T00:00:00Z', '2026-11-06T00:00:00Z', '2026-11-06T00:00:00Z');"
    );

    // Attempting to revert 'worn' to 'planned' must abort via trigger
    expect(() => {
      db.exec("UPDATE calendar_plans SET status = 'planned' WHERE id = 'plan1';");
    }).toThrow(/Monotonic calendar status invariant violation/i);

    // Attempting to revert 'worn' to 'cancelled' must abort via trigger
    expect(() => {
      db.exec("UPDATE calendar_plans SET status = 'cancelled' WHERE id = 'plan1';");
    }).toThrow(/Monotonic calendar status invariant violation/i);
  });

  it('executes additive migration 0002_sync_mutations.sql cleanly and enforces idempotency and FK', () => {
    db.exec(migrationSql);

    const migration2Path = path.resolve(__dirname, '../migrations/0002_sync_mutations.sql');
    const migration2Sql = fs.readFileSync(migration2Path, 'utf-8');

    expect(() => db.exec(migration2Sql)).not.toThrow();

    // Idempotency check
    expect(() => db.exec(migration2Sql)).not.toThrow();

    // Verify user FK on sync_mutations
    db.exec(
      "INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES ('u1', 'Alice', 'alice@test.com', 1, '2026-11-06T00:00:00Z', '2026-11-06T00:00:00Z');"
    );

    expect(() => {
      db.exec(
        "INSERT INTO sync_mutations (mutation_id, user_id, entity_type, entity_id, applied_at) VALUES ('m1', 'u1', 'wardrobe_item', 'item1', '2026-11-07T00:00:00Z');"
      );
    }).not.toThrow();

    // Primary key constraint violation on duplicate mutation for same user
    expect(() => {
      db.exec(
        "INSERT INTO sync_mutations (mutation_id, user_id, entity_type, entity_id, applied_at) VALUES ('m1', 'u1', 'wardrobe_item', 'item1', '2026-11-07T00:00:00Z');"
      );
    }).toThrow();

    // FK constraint violation for non-existent user
    expect(() => {
      db.exec(
        "INSERT INTO sync_mutations (mutation_id, user_id, entity_type, entity_id, applied_at) VALUES ('m2', 'bad_user', 'wardrobe_item', 'item2', '2026-11-07T00:00:00Z');"
      );
    }).toThrow(/FOREIGN KEY/i);
  });
});
