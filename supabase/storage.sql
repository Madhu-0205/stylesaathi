-- ============================================================================
-- STYLESAATHI — SUPABASE STORAGE BUCKET & RLS POLICIES
-- Free / Open-Source Production Foundation V1
-- ============================================================================

-- 1. Create or configure private 'wardrobe' bucket
-- Max file size: 5 MB (Canvas compression targets ~65 KB; 5 MB protects against edge cases)
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

-- 2. Storage RLS Policies: Strictly isolate by authenticated user directory
-- Object path structure: wardrobe/{user_id}/{wardrobe_item_id}/{image_version_id}.jpg

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
