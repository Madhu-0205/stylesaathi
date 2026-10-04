-- Migration 20261004000002: StyleSaathi Row Level Security (RLS) Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wardrobe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wardrobe_image_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_outfits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.style_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wear_events ENABLE ROW LEVEL SECURITY;

-- 1. Profiles
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE USING (auth.uid() = id);

-- 2. Wardrobe Items
DROP POLICY IF EXISTS "wardrobe_items_select_own" ON public.wardrobe_items;
CREATE POLICY "wardrobe_items_select_own" ON public.wardrobe_items FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "wardrobe_items_insert_own" ON public.wardrobe_items;
CREATE POLICY "wardrobe_items_insert_own" ON public.wardrobe_items FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "wardrobe_items_update_own" ON public.wardrobe_items;
CREATE POLICY "wardrobe_items_update_own" ON public.wardrobe_items FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "wardrobe_items_delete_own" ON public.wardrobe_items;
CREATE POLICY "wardrobe_items_delete_own" ON public.wardrobe_items FOR DELETE USING (auth.uid() = user_id);

-- 3. Wardrobe Image Versions
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

-- 4. Saved Outfits
DROP POLICY IF EXISTS "saved_outfits_select_own" ON public.saved_outfits;
CREATE POLICY "saved_outfits_select_own" ON public.saved_outfits FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "saved_outfits_insert_own" ON public.saved_outfits;
CREATE POLICY "saved_outfits_insert_own" ON public.saved_outfits FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "saved_outfits_update_own" ON public.saved_outfits;
CREATE POLICY "saved_outfits_update_own" ON public.saved_outfits FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "saved_outfits_delete_own" ON public.saved_outfits;
CREATE POLICY "saved_outfits_delete_own" ON public.saved_outfits FOR DELETE USING (auth.uid() = user_id);

-- 5. Calendar Plans
DROP POLICY IF EXISTS "calendar_plans_select_own" ON public.calendar_plans;
CREATE POLICY "calendar_plans_select_own" ON public.calendar_plans FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "calendar_plans_insert_own" ON public.calendar_plans;
CREATE POLICY "calendar_plans_insert_own" ON public.calendar_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "calendar_plans_update_own" ON public.calendar_plans;
CREATE POLICY "calendar_plans_update_own" ON public.calendar_plans FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "calendar_plans_delete_own" ON public.calendar_plans;
CREATE POLICY "calendar_plans_delete_own" ON public.calendar_plans FOR DELETE USING (auth.uid() = user_id);

-- 6. Style Preferences
DROP POLICY IF EXISTS "style_preferences_select_own" ON public.style_preferences;
CREATE POLICY "style_preferences_select_own" ON public.style_preferences FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "style_preferences_insert_own" ON public.style_preferences;
CREATE POLICY "style_preferences_insert_own" ON public.style_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "style_preferences_update_own" ON public.style_preferences;
CREATE POLICY "style_preferences_update_own" ON public.style_preferences FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "style_preferences_delete_own" ON public.style_preferences;
CREATE POLICY "style_preferences_delete_own" ON public.style_preferences FOR DELETE USING (auth.uid() = user_id);

-- 7. Wear Events
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
