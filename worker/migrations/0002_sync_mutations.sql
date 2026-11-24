-- ============================================================================
-- STYLESAATHI 3.0 — PRODUCTION CLOUDFLARE D1 (SQLITE) SCHEMA V2
-- Migration: 0002_sync_mutations.sql
-- Idempotency table for sync mutations with payload hash binding
-- ============================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sync_mutations (
    mutation_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    payload_hash TEXT NOT NULL DEFAULT '',
    applied_at TEXT NOT NULL,
    PRIMARY KEY (user_id, mutation_id)
);

CREATE INDEX IF NOT EXISTS idx_sync_mutations_applied ON sync_mutations(user_id, applied_at);
