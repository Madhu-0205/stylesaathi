-- Migration 20261004000001: StyleSaathi Production Foundation Schema & Triggers
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'StyleSaathi Member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Wardrobe Items
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

-- 3. Wardrobe Image Versions
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

-- 4. Saved Outfits
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

-- 5. Calendar Plans (One plan per user per date enforced via UNIQUE constraint)
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

-- 6. Style Preferences
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

-- 7. Wear Events (Append-only wear history)
CREATE TABLE IF NOT EXISTS public.wear_events (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wardrobe_item_id TEXT NOT NULL,
  outfit_id TEXT,
  planned_date DATE,
  worn_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, wardrobe_item_id) REFERENCES public.wardrobe_items(user_id, id) ON DELETE RESTRICT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wardrobe_items_sync ON public.wardrobe_items (user_id, server_updated_at);
CREATE INDEX IF NOT EXISTS idx_wardrobe_items_active ON public.wardrobe_items (user_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_wardrobe_image_versions_item ON public.wardrobe_image_versions (user_id, wardrobe_item_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_plans_date ON public.calendar_plans (user_id, date);
CREATE INDEX IF NOT EXISTS idx_calendar_plans_sync ON public.calendar_plans (user_id, server_updated_at);
CREATE INDEX IF NOT EXISTS idx_saved_outfits_sync ON public.saved_outfits (user_id, server_updated_at);
CREATE INDEX IF NOT EXISTS idx_wear_events_item ON public.wear_events (user_id, wardrobe_item_id, worn_at DESC);

-- Server Authoritative Timestamp Triggers
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

-- Monotonic Calendar Guard Trigger
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

-- New User Profile Provisioning Trigger
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
