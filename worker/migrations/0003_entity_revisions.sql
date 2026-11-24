-- ============================================================================
-- STYLESAATHI 3.0 — PRODUCTION CLOUDFLARE D1 (SQLITE) SCHEMA V3
-- Migration: 0003_entity_revisions.sql
-- Server-authoritative monotonic entity revisions for optimistic concurrency
-- Phase 3C.4: Critical Sync Integrity Remediation
-- ============================================================================

PRAGMA foreign_keys = ON;

-- Add server-controlled monotonic revision column to synchronizable entities
ALTER TABLE wardrobe_items ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE saved_outfits ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE calendar_plans ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE style_preferences ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;

