-- ============================================================================
-- Migration: 20261008000002_style_brain_signals.sql
-- Description: Phase 3 Personal Style Brain & Behavioral Feedback Signals table
-- Enables append-only, idempotent synchronization with strict RLS user isolation.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.style_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_type text NOT NULL,
  outfit_id text,
  item_ids text[] NOT NULL DEFAULT '{}',
  occasion text,
  season text,
  rejection_reason text,
  note text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.style_signals ENABLE ROW LEVEL SECURITY;

-- Strict User Isolation Policies
DROP POLICY IF EXISTS "style_signals_select_own" ON public.style_signals;
CREATE POLICY "style_signals_select_own" ON public.style_signals
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "style_signals_insert_own" ON public.style_signals;
CREATE POLICY "style_signals_insert_own" ON public.style_signals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "style_signals_update_own" ON public.style_signals;
CREATE POLICY "style_signals_update_own" ON public.style_signals
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "style_signals_delete_own" ON public.style_signals;
CREATE POLICY "style_signals_delete_own" ON public.style_signals
  FOR DELETE USING (auth.uid() = user_id);

-- Performance and Deduplication Indexes
CREATE INDEX IF NOT EXISTS idx_style_signals_user_created ON public.style_signals(user_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_style_signals_user_id_unique ON public.style_signals(user_id, id);

-- Comments for documentation
COMMENT ON TABLE public.style_signals IS 'Append-only behavioral signals (wears, saves, favorites, skips, dismissals, structured rejections) feeding the Personal Style Brain';
COMMENT ON COLUMN public.style_signals.signal_type IS 'Signal type enum (worn, saved, favorited, planned, liked, skipped, dismissed, rejected, viewed)';
COMMENT ON COLUMN public.style_signals.rejection_reason IS 'Structured feedback reason (too_hot, too_cold, too_formal, too_casual, wrong_color, wrong_pattern, wrong_fit, uncomfortable, not_my_style, occasion_mismatch, too_repetitive, dislike_combination, other)';
