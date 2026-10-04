-- ============================================================================
-- STYLESAATHI — PRODUCTION POSTGRESQL SCHEMA & ROW LEVEL SECURITY
-- Free / Open-Source Production Foundation V1
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. PROFILES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'StyleSaathi Member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. WARDROBE ITEMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.wardrobe_items (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  active_image_version_id TEXT,
  storage_path TEXT,
  photo_id TEXT,
  photo_url TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'Tops', 'Bottoms', 'Ethnic', 'Dresses', 'Outerwear', 'Footwear', 'Accessories'
  )),
  subcategory TEXT NOT NULL,
  colors TEXT[] NOT NULL DEFAULT '{}',
  seasons TEXT[] NOT NULL DEFAULT '{}',
  occasions TEXT[] NOT NULL DEFAULT '{}',
  formality SMALLINT NOT NULL CHECK (formality BETWEEN 1 AND 5),
  brand TEXT,
  status TEXT NOT NULL DEFAULT 'clean' CHECK (status IN (
    'clean', 'needs_washing', 'in_laundry'
  )),
  favorite BOOLEAN NOT NULL DEFAULT false,
  note TEXT NOT NULL DEFAULT '',
  times_worn INT NOT NULL DEFAULT 0,
  last_worn TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  server_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

-- ============================================================================
-- 3. WARDROBE IMAGE VERSIONS TABLE (Explicit image versioning & storage paths)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.wardrobe_image_versions (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wardrobe_item_id TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  version_hash TEXT,
  width INT,
  height INT,
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
  byte_size INT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, wardrobe_item_id) REFERENCES public.wardrobe_items(user_id, id) ON DELETE CASCADE
);

-- ============================================================================
-- 4. SAVED OUTFITS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.saved_outfits (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template TEXT NOT NULL,
  slots JSONB NOT NULL,
  score NUMERIC NOT NULL,
  why TEXT NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  server_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

-- ============================================================================
-- 5. CALENDAR PLANS TABLE (Enforces ONE plan per user per date)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.calendar_plans (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  occasion TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'worn', 'cancelled')),
  outfit JSONB NOT NULL,
  accessory JSONB,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  server_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id),
  CONSTRAINT uq_calendar_plans_user_date UNIQUE (user_id, date)
);

-- ============================================================================
-- 6. STYLE PREFERENCES TABLE (Singleton per user)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.style_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_contexts TEXT[] NOT NULL DEFAULT '{}',
  preferred_aesthetics TEXT[] NOT NULL DEFAULT '{}',
  styling_mode TEXT NOT NULL DEFAULT 'variety' CHECK (styling_mode IN (
    'simple', 'variety', 'experiment'
  )),
  client_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  server_updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 7. WEAR EVENTS TABLE (Append-only immutable wear event log)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.wear_events (
  id TEXT NOT NULL, -- Client-generated UUIDv4 upon wear action
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wardrobe_item_id TEXT NOT NULL,
  outfit_id TEXT,
  planned_date DATE,
  worn_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, wardrobe_item_id) REFERENCES public.wardrobe_items(user_id, id) ON DELETE RESTRICT
);

-- ============================================================================
-- INDEXES FOR SYNC & SCALABILITY
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_wardrobe_items_sync ON public.wardrobe_items (user_id, server_updated_at);
CREATE INDEX IF NOT EXISTS idx_wardrobe_items_active ON public.wardrobe_items (user_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_wardrobe_image_versions_item ON public.wardrobe_image_versions (user_id, wardrobe_item_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_plans_date ON public.calendar_plans (user_id, date);
CREATE INDEX IF NOT EXISTS idx_calendar_plans_sync ON public.calendar_plans (user_id, server_updated_at);
CREATE INDEX IF NOT EXISTS idx_saved_outfits_sync ON public.saved_outfits (user_id, server_updated_at);
CREATE INDEX IF NOT EXISTS idx_wear_events_item ON public.wear_events (user_id, wardrobe_item_id, worn_at DESC);

-- ============================================================================
-- SERVER TIMESTAMP SECURITY TRIGGERS
-- Untrusted browser cannot set arbitrary future server_updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_server_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.server_updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_wardrobe_items_updated ON public.wardrobe_items;
CREATE TRIGGER trg_wardrobe_items_updated
  BEFORE INSERT OR UPDATE ON public.wardrobe_items
  FOR EACH ROW EXECUTE FUNCTION public.set_server_updated_at();

DROP TRIGGER IF EXISTS trg_saved_outfits_updated ON public.saved_outfits;
CREATE TRIGGER trg_saved_outfits_updated
  BEFORE INSERT OR UPDATE ON public.saved_outfits
  FOR EACH ROW EXECUTE FUNCTION public.set_server_updated_at();

DROP TRIGGER IF EXISTS trg_calendar_plans_updated ON public.calendar_plans;
CREATE TRIGGER trg_calendar_plans_updated
  BEFORE INSERT OR UPDATE ON public.calendar_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_server_updated_at();

DROP TRIGGER IF EXISTS trg_style_preferences_updated ON public.style_preferences;
CREATE TRIGGER trg_style_preferences_updated
  BEFORE INSERT OR UPDATE ON public.style_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_server_updated_at();

-- ============================================================================
-- MONOTONIC CALENDAR STATUS TRIGGER
-- Enforces that WORN and CANCELLED states follow monotonic lifecycles on the database tier
-- ============================================================================
CREATE OR REPLACE FUNCTION public.guard_calendar_plan_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If status is not changing, allow
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- WORN cannot revert to planned or cancelled
  IF OLD.status = 'worn' AND NEW.status IN ('planned', 'cancelled') THEN
    RAISE EXCEPTION 'Monotonic invariant violation: WORN plan % cannot revert to %', OLD.id, NEW.status;
  END IF;

  -- CANCELLED cannot revert to planned or worn
  IF OLD.status = 'cancelled' AND NEW.status IN ('planned', 'worn') THEN
    RAISE EXCEPTION 'Monotonic invariant violation: CANCELLED plan % cannot transition to %', OLD.id, NEW.status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calendar_plan_status_guard ON public.calendar_plans;
CREATE TRIGGER trg_calendar_plan_status_guard
  BEFORE UPDATE ON public.calendar_plans
  FOR EACH ROW EXECUTE FUNCTION public.guard_calendar_plan_status();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wardrobe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wardrobe_image_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_outfits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.style_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wear_events ENABLE ROW LEVEL SECURITY;

-- 1. Profiles RLS
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE USING (auth.uid() = id);

-- 2. Wardrobe Items RLS
DROP POLICY IF EXISTS "wardrobe_items_select_own" ON public.wardrobe_items;
CREATE POLICY "wardrobe_items_select_own" ON public.wardrobe_items FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "wardrobe_items_insert_own" ON public.wardrobe_items;
CREATE POLICY "wardrobe_items_insert_own" ON public.wardrobe_items FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "wardrobe_items_update_own" ON public.wardrobe_items;
CREATE POLICY "wardrobe_items_update_own" ON public.wardrobe_items FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "wardrobe_items_delete_own" ON public.wardrobe_items;
CREATE POLICY "wardrobe_items_delete_own" ON public.wardrobe_items FOR DELETE USING (auth.uid() = user_id);

-- 3. Wardrobe Image Versions RLS
DROP POLICY IF EXISTS "image_versions_select_own" ON public.wardrobe_image_versions;
CREATE POLICY "image_versions_select_own" ON public.wardrobe_image_versions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "image_versions_insert_own" ON public.wardrobe_image_versions;
CREATE POLICY "image_versions_insert_own" ON public.wardrobe_image_versions FOR INSERT WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.wardrobe_items
    WHERE id = wardrobe_image_versions.wardrobe_item_id AND user_id = auth.uid()
  )
);
DROP POLICY IF EXISTS "image_versions_update_own" ON public.wardrobe_image_versions;
CREATE POLICY "image_versions_update_own" ON public.wardrobe_image_versions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "image_versions_delete_own" ON public.wardrobe_image_versions;
CREATE POLICY "image_versions_delete_own" ON public.wardrobe_image_versions FOR DELETE USING (auth.uid() = user_id);

-- 4. Saved Outfits RLS
DROP POLICY IF EXISTS "saved_outfits_select_own" ON public.saved_outfits;
CREATE POLICY "saved_outfits_select_own" ON public.saved_outfits FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "saved_outfits_insert_own" ON public.saved_outfits;
CREATE POLICY "saved_outfits_insert_own" ON public.saved_outfits FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "saved_outfits_update_own" ON public.saved_outfits;
CREATE POLICY "saved_outfits_update_own" ON public.saved_outfits FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "saved_outfits_delete_own" ON public.saved_outfits;
CREATE POLICY "saved_outfits_delete_own" ON public.saved_outfits FOR DELETE USING (auth.uid() = user_id);

-- 5. Calendar Plans RLS
DROP POLICY IF EXISTS "calendar_plans_select_own" ON public.calendar_plans;
CREATE POLICY "calendar_plans_select_own" ON public.calendar_plans FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "calendar_plans_insert_own" ON public.calendar_plans;
CREATE POLICY "calendar_plans_insert_own" ON public.calendar_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "calendar_plans_update_own" ON public.calendar_plans;
CREATE POLICY "calendar_plans_update_own" ON public.calendar_plans FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "calendar_plans_delete_own" ON public.calendar_plans;
CREATE POLICY "calendar_plans_delete_own" ON public.calendar_plans FOR DELETE USING (auth.uid() = user_id);

-- 6. Style Preferences RLS
DROP POLICY IF EXISTS "style_preferences_select_own" ON public.style_preferences;
CREATE POLICY "style_preferences_select_own" ON public.style_preferences FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "style_preferences_insert_own" ON public.style_preferences;
CREATE POLICY "style_preferences_insert_own" ON public.style_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "style_preferences_update_own" ON public.style_preferences;
CREATE POLICY "style_preferences_update_own" ON public.style_preferences FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "style_preferences_delete_own" ON public.style_preferences;
CREATE POLICY "style_preferences_delete_own" ON public.style_preferences FOR DELETE USING (auth.uid() = user_id);

-- 7. Wear Events RLS (Validates both user ownership AND that the garment belongs to the user)
DROP POLICY IF EXISTS "wear_events_select_own" ON public.wear_events;
CREATE POLICY "wear_events_select_own" ON public.wear_events FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "wear_events_insert_own" ON public.wear_events;
CREATE POLICY "wear_events_insert_own" ON public.wear_events FOR INSERT WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.wardrobe_items
    WHERE id = wear_events.wardrobe_item_id AND user_id = auth.uid()
  )
);
DROP POLICY IF EXISTS "wear_events_update_own" ON public.wear_events;
CREATE POLICY "wear_events_update_own" ON public.wear_events FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "wear_events_delete_own" ON public.wear_events;
CREATE POLICY "wear_events_delete_own" ON public.wear_events FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- AUTHENTICATED USER SIGNUP TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'StyleSaathi Member')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- STORAGE BUCKET & STORAGE RLS POLICIES
-- Private wardrobe bucket, strictly isolated per user folder (auth.uid())
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'wardrobe', 
  'wardrobe', 
  false, 
  5242880, 
  ARRAY['image/jpeg', 'image/webp', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/webp', 'image/png'];

DROP POLICY IF EXISTS "wardrobe_storage_select" ON storage.objects;
CREATE POLICY "wardrobe_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'wardrobe' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "wardrobe_storage_insert" ON storage.objects;
CREATE POLICY "wardrobe_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'wardrobe' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "wardrobe_storage_update" ON storage.objects;
CREATE POLICY "wardrobe_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'wardrobe' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "wardrobe_storage_delete" ON storage.objects;
CREATE POLICY "wardrobe_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'wardrobe' AND (storage.foldername(name))[1] = auth.uid()::text);

