-- ============================================================================
-- STYLESAATHI 3.0 — PRODUCTION CLOUDFLARE D1 (SQLITE) SCHEMA V2
-- Initial Schema Migration: 0001_initial_schema.sql
-- Strict ₹0 Operating Foundation: 12 Tables, Idempotent DDL, Foreign Keys Enabled
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------------------
-- 1. BETTER AUTH AUTHENTICATION TABLES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    emailVerified INTEGER NOT NULL DEFAULT 0,
    image TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expiresAt TEXT NOT NULL,
    ipAddress TEXT,
    userAgent TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS account (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    accountId TEXT NOT NULL,
    providerId TEXT NOT NULL,
    accessToken TEXT,
    refreshToken TEXT,
    idToken TEXT,
    accessTokenExpiresAt TEXT,
    refreshTokenExpiresAt TEXT,
    scope TEXT,
    password TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS verification (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    createdAt TEXT,
    updatedAt TEXT
);

CREATE INDEX IF NOT EXISTS idx_session_token ON session(token);
CREATE INDEX IF NOT EXISTS idx_session_user ON session(userId);
CREATE INDEX IF NOT EXISTS idx_account_user ON account(userId);
CREATE INDEX IF NOT EXISTS idx_verification_identifier ON verification(identifier);

-- ----------------------------------------------------------------------------
-- 2. APPLICATION PROFILES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL DEFAULT 'StyleSaathi Member',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- ----------------------------------------------------------------------------
-- 3. WARDROBE ITEMS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wardrobe_items (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    active_image_version_id TEXT,
    storage_path TEXT,
    photo_id TEXT,
    photo_url TEXT,
    category TEXT NOT NULL CHECK (category IN (
        'Tops', 'Bottoms', 'Ethnic', 'Dresses', 'Outerwear', 'Footwear', 'Accessories'
    )),
    subcategory TEXT NOT NULL,
    colors TEXT NOT NULL DEFAULT '[]', -- JSON array of strings
    seasons TEXT NOT NULL DEFAULT '[]', -- JSON array of strings
    occasions TEXT NOT NULL DEFAULT '[]', -- JSON array of strings
    formality INTEGER NOT NULL CHECK (formality BETWEEN 1 AND 5),
    brand TEXT,
    status TEXT NOT NULL DEFAULT 'clean' CHECK (status IN (
        'clean', 'needs_washing', 'in_laundry'
    )),
    favorite INTEGER NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    times_worn INTEGER NOT NULL DEFAULT 0,
    last_worn TEXT,
    fabric TEXT,
    pattern TEXT,
    fit TEXT,
    purchase_price REAL,
    purchase_date TEXT,
    cultural_context TEXT,
    ai_confidence REAL,
    user_verified INTEGER DEFAULT 0,
    provenance TEXT DEFAULT '{}',
    is_deleted INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT,
    created_at TEXT NOT NULL,
    client_updated_at TEXT NOT NULL,
    server_updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_wardrobe_items_sync ON wardrobe_items(user_id, server_updated_at);
CREATE INDEX IF NOT EXISTS idx_wardrobe_items_active ON wardrobe_items(user_id) WHERE is_deleted = 0;

-- ----------------------------------------------------------------------------
-- 4. SAVED OUTFITS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS saved_outfits (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    template TEXT NOT NULL,
    slots TEXT NOT NULL, -- JSON string
    score REAL NOT NULL,
    why TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT,
    created_at TEXT NOT NULL,
    client_updated_at TEXT NOT NULL,
    server_updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_saved_outfits_sync ON saved_outfits(user_id, server_updated_at);

-- ----------------------------------------------------------------------------
-- 5. CALENDAR PLANS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calendar_plans (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    date TEXT NOT NULL, -- YYYY-MM-DD
    occasion TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'worn', 'cancelled')),
    outfit TEXT NOT NULL, -- JSON string
    accessory TEXT, -- JSON string
    is_deleted INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT,
    created_at TEXT NOT NULL,
    client_updated_at TEXT NOT NULL,
    server_updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, id),
    CONSTRAINT uq_calendar_plans_user_date UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_calendar_plans_date ON calendar_plans(user_id, date);
CREATE INDEX IF NOT EXISTS idx_calendar_plans_sync ON calendar_plans(user_id, server_updated_at);

-- ----------------------------------------------------------------------------
-- 6. STYLE PREFERENCES TABLE (Singleton per user)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS style_preferences (
    user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
    preferred_contexts TEXT NOT NULL DEFAULT '[]',
    preferred_aesthetics TEXT NOT NULL DEFAULT '[]',
    styling_mode TEXT NOT NULL DEFAULT 'variety' CHECK (styling_mode IN (
        'simple', 'variety', 'experiment'
    )),
    client_updated_at TEXT NOT NULL,
    server_updated_at TEXT NOT NULL
);

-- ----------------------------------------------------------------------------
-- 7. WEAR EVENTS TABLE (Append-Only Event Log)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wear_events (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    wardrobe_item_id TEXT NOT NULL,
    outfit_id TEXT,
    planned_date TEXT,
    worn_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, id),
    FOREIGN KEY (user_id, wardrobe_item_id) REFERENCES wardrobe_items(user_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_wear_events_item ON wear_events(user_id, wardrobe_item_id, worn_at DESC);

-- ----------------------------------------------------------------------------
-- 8. STYLE SIGNALS TABLE (Behavioral Telemetry Log)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS style_signals (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    signal_type TEXT NOT NULL,
    outfit_id TEXT,
    item_ids TEXT NOT NULL DEFAULT '[]',
    occasion TEXT,
    season TEXT,
    rejection_reason TEXT,
    note TEXT,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_style_signals_user_created ON style_signals(user_id, created_at);

-- ----------------------------------------------------------------------------
-- 9. DELETION TOMBSTONES TABLE (Secure Idempotent Account Deletion)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deletion_tombstones (
    request_id TEXT PRIMARY KEY,
    secret_hash TEXT NOT NULL,
    user_id_hash TEXT NOT NULL,
    deleted_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    reconciled INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_tombstones_expires ON deletion_tombstones(expires_at);

-- ----------------------------------------------------------------------------
-- 10. TRIGGERS: MONOTONIC CALENDAR STATUS
-- ----------------------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_calendar_plan_status_guard
BEFORE UPDATE ON calendar_plans
FOR EACH ROW
WHEN (OLD.status = 'worn' AND NEW.status IN ('planned', 'cancelled'))
   OR (OLD.status = 'cancelled' AND NEW.status IN ('planned', 'worn'))
BEGIN
    SELECT RAISE(ABORT, 'Monotonic calendar status invariant violation');
END;

