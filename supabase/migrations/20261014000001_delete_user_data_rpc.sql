-- Migration 20261014000001: Delete User Data Records RPC
-- Description: Authoritative transactional cascade for user-owned database records.
-- Enforces strict authentication: only callable for the authenticated user (auth.uid() = target_user_id).
-- Deletes in strict foreign-key dependency order.

CREATE OR REPLACE FUNCTION public.delete_user_data_records(target_user_id UUID)
RETURNS boolean AS $$
BEGIN
  -- Strict authorization check: client cannot supply another user's UUID
  IF target_user_id IS NULL OR target_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Authorization failure: cannot delete data for another user or unauthenticated request';
  END IF;

  -- 1. Append-only wear events (must be deleted before wardrobe_items due to ON DELETE RESTRICT)
  DELETE FROM public.wear_events WHERE user_id = target_user_id;

  -- 2. Behavioral style signals (append-only)
  DELETE FROM public.style_signals WHERE user_id = target_user_id;

  -- 3. Calendar outfit plans
  DELETE FROM public.calendar_plans WHERE user_id = target_user_id;

  -- 4. Saved outfits
  DELETE FROM public.saved_outfits WHERE user_id = target_user_id;

  -- 5. Wardrobe image versions (references wardrobe_items)
  DELETE FROM public.wardrobe_image_versions WHERE user_id = target_user_id;

  -- 6. Core wardrobe items
  DELETE FROM public.wardrobe_items WHERE user_id = target_user_id;

  -- 7. Style preferences
  DELETE FROM public.style_preferences WHERE user_id = target_user_id;

  -- 8. User profile
  DELETE FROM public.profiles WHERE id = target_user_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Restrict execution to authenticated users only
REVOKE EXECUTE ON FUNCTION public.delete_user_data_records(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.delete_user_data_records(UUID) TO authenticated;
