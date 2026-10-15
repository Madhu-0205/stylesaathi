-- Migration 20261014000001: Delete User Data Records RPC
-- Description: Authoritative transactional cascade for user-owned database records.
-- Enforces strict authentication: only callable for the authenticated user (auth.uid() = target_user_id).
-- Deletes in strict foreign-key dependency order.

CREATE OR REPLACE FUNCTION public.delete_user_data_records(target_user_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Strict authorization check:
  -- 1. If executed by service_role (trusted server-side Edge Function), allow target_user_id derived from verified JWT
  -- 2. If executed by authenticated user, auth.uid() must strictly match target_user_id
  -- 3. All other callers (anon, mismatched user) are strictly rejected
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Target user ID must not be null';
  END IF;

  IF auth.role() = 'service_role' THEN
    -- Trusted server-side orchestration
    NULL;
  ELSIF auth.uid() IS NOT NULL AND auth.uid() = target_user_id THEN
    -- Authenticated user deleting own records
    NULL;
  ELSE
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
$$;

-- Restrict execution to authenticated users and service_role only
REVOKE EXECUTE ON FUNCTION public.delete_user_data_records(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.delete_user_data_records(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_data_records(UUID) TO service_role;
