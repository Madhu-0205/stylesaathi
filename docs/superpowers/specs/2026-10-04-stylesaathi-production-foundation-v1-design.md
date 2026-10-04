# StyleSaathi — Free / Open-Source Production Foundation V1 Design Spec

- **Date:** 2026-10-04
- **Status:** In Review
- **Architecture Approach:** Local-First + Background Sync Queue + Eager UI
- **Infrastructure:** React + TypeScript + Vite + Supabase (Auth, PostgreSQL, Storage, RLS) + IndexedDB (Local-First Cache)
- **Target Cost:** ₹0 (Free tiers only, deterministic client-side recommendation engine, no paid AI APIs)

---

## 1. Executive Summary & Core Principles

StyleSaathi is a digital wardrobe and personal styling platform tailored specifically for Indian users and garments (sarees, blouses, kurtas, dupattas, lehengas, Nehru jackets, Western wear, and Indo-Western fusions).

This specification moves StyleSaathi from a local-only prototype to a **multi-user production foundation** that maintains:
1. **₹0 Early-Stage Service Cost:** Relies exclusively on free-tier Supabase (Auth, Database, Storage) and client-side processing. No paid AI APIs, no separate Node server.
2. **Local-First + Cloud Sync:** Instant UI responsiveness, 100% offline capability, and zero latency on app launch. Local IndexedDB + localStorage serve as the authoritative client cache.
3. **Strict Data Ownership & PostgreSQL RLS:** All cloud records are protected by database-level Row Level Security (`auth.uid() = user_id`). No service-role keys are exposed in client code.
4. **Data-Specific Conflict Resolution:** Metadata uses `updated_at` last-write-wins; calendar plans enforce monotonic status progression (`planned` cannot overwrite `worn`); wear tracking is append-only and idempotent.
5. **Zero Data Loss on Guest Migration:** Guest data (items, photos, plans, preferences, wear counts) is seamlessly associated with the authenticated identity upon login.

---

## 2. PostgreSQL Relational Database Schema

All tables reside in the `public` schema and link to `auth.users(id)`:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. WARDROBE ITEMS
CREATE TABLE public.wardrobe_items (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  photo_id TEXT,
  photo_url TEXT,
  category TEXT NOT NULL CHECK (category IN ('Tops', 'Bottoms', 'Ethnic', 'Dresses', 'Outerwear', 'Footwear', 'Accessories')),
  subcategory TEXT NOT NULL,
  colors TEXT[] NOT NULL DEFAULT '{}',
  seasons TEXT[] NOT NULL DEFAULT '{}',
  occasions TEXT[] NOT NULL DEFAULT '{}',
  formality SMALLINT NOT NULL CHECK (formality BETWEEN 1 AND 5),
  brand TEXT,
  status TEXT NOT NULL DEFAULT 'clean' CHECK (status IN ('clean', 'needs_washing', 'in_laundry')),
  favorite BOOLEAN NOT NULL DEFAULT false,
  note TEXT NOT NULL DEFAULT '',
  times_worn INT NOT NULL DEFAULT 0,
  last_worn TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

-- 3. SAVED OUTFITS
CREATE TABLE public.saved_outfits (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template TEXT NOT NULL,
  slots JSONB NOT NULL,
  score NUMERIC NOT NULL,
  why TEXT NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

-- 4. CALENDAR PLANS
CREATE TABLE public.calendar_plans (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  occasion TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'worn')),
  outfit JSONB NOT NULL,
  accessory JSONB,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

-- 5. STYLE PREFERENCES (1:1 with user)
CREATE TABLE public.style_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_contexts TEXT[] NOT NULL DEFAULT '{}',
  preferred_aesthetics TEXT[] NOT NULL DEFAULT '{}',
  styling_mode TEXT NOT NULL DEFAULT 'variety' CHECK (styling_mode IN ('simple', 'variety', 'experiment')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. WEAR EVENTS (Append-only wear history)
CREATE TABLE public.wear_events (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wardrobe_item_id TEXT NOT NULL,
  outfit_id TEXT,
  planned_date DATE,
  worn_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
```

---

## 3. Relationships & Primary / Foreign Keys

- `profiles.id` $\rightarrow$ `auth.users.id` (1:1, Primary/Foreign Key, Cascading Delete).
- `wardrobe_items.(user_id, id)`: Composite primary key guaranteeing user partition isolation. Foreign key `user_id` $\rightarrow$ `auth.users.id`.
- `saved_outfits.(user_id, id)`: Composite primary key. Foreign key `user_id` $\rightarrow$ `auth.users.id`.
- `calendar_plans.(user_id, id)`: Composite primary key. Foreign key `user_id` $\rightarrow$ `auth.users.id`.
- `style_preferences.user_id`: 1:1 primary key with `auth.users.id`.
- `wear_events.(user_id, id)`: Composite primary key. Soft reference to `wardrobe_item_id` to maintain historical wear analytics even if a physical item is retired.

---

## 4. Database Indexing

```sql
CREATE INDEX idx_wardrobe_items_sync ON public.wardrobe_items (user_id, updated_at);
CREATE INDEX idx_wardrobe_items_active ON public.wardrobe_items (user_id) WHERE is_deleted = false;
CREATE INDEX idx_calendar_plans_date ON public.calendar_plans (user_id, date);
CREATE INDEX idx_calendar_plans_sync ON public.calendar_plans (user_id, updated_at);
CREATE INDEX idx_saved_outfits_sync ON public.saved_outfits (user_id, updated_at);
CREATE INDEX idx_wear_events_item ON public.wear_events (user_id, wardrobe_item_id, worn_at DESC);
```

---

## 5. PostgreSQL Row Level Security (RLS) Policies

Every table strictly enforces `auth.uid() = user_id`:

```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wardrobe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_outfits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.style_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wear_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_user_all" ON public.profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "wardrobe_items_user_all" ON public.wardrobe_items
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_outfits_user_all" ON public.saved_outfits
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "calendar_plans_user_all" ON public.calendar_plans
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "style_preferences_user_all" ON public.style_preferences
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "wear_events_user_all" ON public.wear_events
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'StyleSaathi Member')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## 6. Supabase Storage Architecture & 7. Storage RLS Policies

- **Bucket Name:** `wardrobe` (Private, non-public).
- **Storage Namespace Hierarchy:**
  `wardrobe/{user_id}/{item_id}/{version_hash}.jpg`
- **Policies on `storage.objects`:**

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('wardrobe', 'wardrobe', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "wardrobe_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'wardrobe' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "wardrobe_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'wardrobe' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "wardrobe_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'wardrobe' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "wardrobe_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'wardrobe' AND (storage.foldername(name))[1] = auth.uid()::text);
```

- **Bandwidth & Cache Strategy:** Primary image rendering reads from local IndexedDB `imageStore`. Cloud storage acts as the persistent cloud backup/multi-device sync tier, conserving Supabase free-tier egress limits.

---

## 8. Authentication Architecture & Flows

### 9. Google OAuth Flow
1. User clicks "Continue with Google".
2. `SupabaseAuthRepository.signInWithGoogle()` calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })`.
3. Browser navigates to Google consent $\rightarrow$ redirects back to StyleSaathi origin with tokens in URL hash.
4. Supabase JS client parses hash, establishes session, and emits `SIGNED_IN` event.
5. AuthContext detects transition $\rightarrow$ initiates **Guest $\rightarrow$ Account Migration**.

### 10. Email OTP Passwordless Flow
1. User enters email (and optional display name).
2. User taps "Send Login Code".
3. `SupabaseAuthRepository.sendEmailOtp(email)` triggers `supabase.auth.signInWithOtp({ email, options: { data: { name } } })`.
4. UI transitions to dedicated 6-digit OTP code entry with countdown and "Resend Code" option.
5. User enters code $\rightarrow$ `verifyEmailOtp(email, token)` calls `supabase.auth.verifyOtp({ email, token, type: 'email' })`.
6. Invalid/expired OTP throws a clean, user-friendly error (never exposing raw error objects).
7. On verification success, session is created $\rightarrow$ initiates **Guest $\rightarrow$ Account Migration**.

---

## 11. Guest $\rightarrow$ Account Migration Architecture

When a guest user logs in or registers:
1. **Preserve Local Data:** Local items, IndexedDB photos, preferences, calendar plans, and wear counts are read from local storage and IndexedDB.
2. **Identity Association:** All local entities are reassigned the new `user.id`.
3. **Queue Ingestion:** Each entity is placed into the persistent `SyncQueue` with operation `UPSERT`.
4. **Photo Pipeline:** Local IndexedDB image blobs are queued for background upload to the user's private storage bucket (`wardrobe/{user_id}/{item_id}/{version}.jpg`).
5. **No Deletions:** Local IndexedDB blobs remain untouched.
6. **Background Ingestion:** As the sync queue drains to Supabase, cloud records are established without blocking the UI.

---

## 12. Persistent Sync Queue Data Model

Stored in IndexedDB (`stylesaathi_sync_store`, table `mutations`):

```ts
export interface SyncMutation {
  id: string; // Unique mutation UUID (idempotency key)
  entityType: 'wardrobe_item' | 'calendar_plan' | 'style_preferences' | 'saved_outfit' | 'wear_event' | 'wardrobe_photo';
  entityId: string;
  operation: 'UPSERT' | 'DELETE' | 'UPLOAD_PHOTO' | 'DELETE_PHOTO';
  payload: any;
  version?: string;
  createdAt: number;
  attemptCount: number;
  lastError?: string;
  status: 'pending' | 'processing' | 'failed';
}
```

---

## 13. Data-Specific Conflict Resolution Semantics

| Entity | Conflict Strategy | Rationale & Rules |
| :--- | :--- | :--- |
| **Wardrobe Items** | `updated_at` Last-Write-Wins | Attributes (formality, occasion, laundry state, notes) resolve to the newest valid edit timestamp. |
| **Style Preferences** | `updated_at` Last-Write-Wins | User profile styling DNA represents current lifestyle preference. |
| **Calendar Plans** | Monotonic Status Guard + LWW | Plans on the same date resolve by `updated_at`. **Crucial exception:** A status of `worn` cannot be reverted to `planned` by an older out-of-order sync event. |
| **Wear History** | Append-Only Idempotent Log | Every wear action writes a unique `wear_events` row with deterministic ID `wear_{userId}_{itemId}_{date}_{timestamp}`. Upserts are idempotent; duplicates are ignored. `timesWorn` is derived. |
| **Favorites** | `updated_at` Last-Write-Wins | Boolean toggle updates with the most recent user action. |
| **Images** | Version-Identified 2-Phase Swap | New image uploaded to storage $\rightarrow$ cloud item record updated $\rightarrow$ previous image version safely purged. |
| **Deletions** | Soft Tombstones (`is_deleted`) | Soft deletion with `deleted_at` ensures an offline device syncing later learns of deletions instead of resurrecting records. |

---

## 14. Offline / Reconnect Behavior & Invariant

- **Instant Boot:**
  `Open App` $\rightarrow$ `Load Local Cache (IDB/LocalStorage)` $\rightarrow$ `Render Full Wardrobe (0ms)` $\rightarrow$ `Verify Session (Background)` $\rightarrow$ `Sync Queue (Background)`.
- **Offline Writes:** User adds/edits/deletes items or plans $\rightarrow$ local database updates immediately $\rightarrow$ mutation enqueued with `status: 'pending'` $\rightarrow$ UI updates instantly.
- **Online Transition:** When `window.addEventListener('online')` triggers, the sync queue resumes with exponential backoff (2s, 5s, 15s, max 3 retries).
- **Subtle Status UX:**
  - In sync: No banner (clean editorial experience).
  - Offline changes pending: Subtle pill: *"Saved on this device · Syncing when you're back online"*.
  - Persistent failure: *"Some changes couldn't sync yet · [Retry]"*.

---

## 15. Deletion & Tombstone Strategy

1. When a user deletes an item/plan, the local record is marked `is_deleted: true, deleted_at: Date.now()`.
2. Eager UI filters out `is_deleted: true` records immediately.
3. A `DELETE` mutation is enqueued.
4. When synced, Supabase sets `is_deleted = true, updated_at = now()`.
5. Other devices pulling updates receive `is_deleted = true` and hide/remove their local cache, preventing zombie resurrection.
6. A 30-day purge cycle cleans up tombstones.

---

## 16. Image Synchronization Lifecycle

1. **User adds/updates garment photo:** Canvas compresses to max 800px at 0.8 JPEG quality (`compressImageToBlob`).
2. **Assign stable identifier:** Generate `photoId = "photo_" + itemId + "_" + Date.now()`.
3. **Local Store:** Save blob to IndexedDB `imageStore`. Local item metadata is updated immediately; UI cards render with zero latency.
4. **Queue Cloud Sync:** Enqueue `UPLOAD_PHOTO` mutation with payload `{ itemId, photoId, blob }`.
5. **Background Cloud Upload:** When online, upload blob to `wardrobe/{user_id}/{item_id}/{photoId}.jpg`.
6. **Confirmation & Cleanup:** Once upload is verified, update cloud `wardrobe_items.photo_url`. Any previous storage object for this item is safely deleted.
7. **Offline Delete:** Deleting an item enqueues `DELETE_PHOTO`, executing cloud cleanup when reconnected.

---

## 17. Local / Cloud Repository Boundaries

- **UI Components** $\rightarrow$ React Contexts (`WardrobeContext`, `AuthContext`) $\rightarrow$ Repositories.
- **Repositories:**
  - `LocalStorageWardrobeRepository`, `LocalStoragePreferencesRepository`, `LocalStorageCalendarRepository` handle local storage / IndexedDB.
  - `SupabaseClient` (`src/lib/supabase.ts`) handles raw Supabase communication.
  - `SyncService` coordinates between local repositories and Supabase remote endpoints.
  - `WardrobeVisionService` (`src/services/vision/`) provides the abstraction seam for garment recognition.
- UI components never touch `supabase.ts` directly; all cloud sync flows through `SyncService` and `AuthRepository`.

---

## 18. Exact Codebase Additions & Modifications

### Files to Add:
1. `src/lib/supabase.ts`: Supabase client singleton, `isSupabaseConfigured()` check, safe environment variable loading.
2. `src/lib/sync/syncTypes.ts`: Interfaces for `SyncMutation`, `SyncStatus`, `WearEvent`.
3. `src/lib/sync/syncQueue.ts`: IndexedDB-backed persistent FIFO mutation queue.
4. `src/lib/sync/syncService.ts`: Core synchronization coordinator, conflict handlers, guest-to-account elevation.
5. `src/repositories/SupabaseAuthRepository.ts`: Production implementation supporting Google OAuth, Email OTP, guest sessions, and session listener.
6. `src/services/vision/WardrobeVisionService.ts`: Open-source/local-friendly computer vision abstraction seam.
7. `supabase/schema.sql`: Complete PostgreSQL schema with DDL, triggers, and RLS policies.
8. `supabase/storage.sql`: Storage bucket provisioning and RLS policies.
9. `src/__tests__/supabaseAuth.test.ts`: Auth repository tests (OAuth initiation, OTP validation, guest handling).
10. `src/__tests__/syncEngine.test.ts`: Sync queue, conflict resolution, tombstone, and wear event tests.
11. `src/__tests__/guestMigration.test.ts`: Guest $\rightarrow$ account migration data preservation tests.

### Files to Modify:
1. `package.json`: Add `@supabase/supabase-js`.
2. `.env.example`: Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. `src/types.ts`: Extend `AuthRepository` with OTP methods, add `WearEvent` and `SyncStatus`.
4. `src/context/AuthContext.tsx`: Wire to `SupabaseAuthRepository` with loading states and session listener.
5. `src/context/WardrobeContext.tsx`: Connect to `SyncService` for background sync events and sync status indicators.
6. `src/components/auth/AuthView.tsx`: Real Google OAuth redirect and 2-step Email OTP flow (enter email $\rightarrow$ enter OTP), with clear unconfigured state banner if env vars are missing.
7. `src/screens/ProfileScreen.tsx`: Real Member status, authenticated email display, real sign-out, JSON data export, and account deletion confirmation flow.

---

## 19. Migration Strategy from Existing V4 Local Data

- Existing local keys (`stylesaathi-v1`, `stylesaathi-saved-outfits-v1`, `stylesaathi-preferences-v1`, `stylesaathi-calendar-plans-v1`, and `stylesaathi-images-db`) remain the primary local read sources.
- On initialization, `SyncService` checks for un-synced local data.
- Idempotent migration upgrades local items with missing `is_deleted` flags to `false`.
- Existing IndexedDB image blobs remain untouched.
- When the user authenticates, all existing local data seamlessly migrates into their personal cloud partition.

---

## 20. Security Audit & Quota Protections

- **Zero Secret Exposure:** Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are used in client code. No `service_role` key and no Google client secrets are included in client bundles.
- **Database RLS:** Guaranteed isolation via `auth.uid() = user_id` across all tables.
- **Storage Protection:** Path traversal blocked; folder RLS strictly enforces `(storage.foldername(name))[1] = auth.uid()::text`.
- **₹0-Cost Quota Guardrails:**
  - Realtime subscriptions disabled (not needed for personal wardrobe v1; eliminates connection limits).
  - Deterministic outfit computation stays 100% on the client.
  - Image compression runs in-browser (Canvas 800px, JPEG 0.8) prior to upload.
  - Egress minimized by serving images from local IndexedDB cache after initial download.
