-- ============================================================================
-- Migration: 20261008000001_wardrobe_intelligence_v2.sql
-- Description: Backward-compatible schema extension for Wardrobe Intelligence 2.0
-- (Fabric, Pattern, Fit/Silhouette, Purchase Information, AI Confidence & Provenance)
-- ============================================================================

ALTER TABLE wardrobe_items
  ADD COLUMN IF NOT EXISTS fabric text,
  ADD COLUMN IF NOT EXISTS pattern text,
  ADD COLUMN IF NOT EXISTS fit text,
  ADD COLUMN IF NOT EXISTS purchase_price numeric,
  ADD COLUMN IF NOT EXISTS purchase_date text,
  ADD COLUMN IF NOT EXISTS cultural_context text,
  ADD COLUMN IF NOT EXISTS ai_confidence numeric,
  ADD COLUMN IF NOT EXISTS user_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS provenance jsonb DEFAULT '{}'::jsonb;

-- Comment on columns for documentation
COMMENT ON COLUMN wardrobe_items.fabric IS 'Textile fabric classification (e.g. cotton, linen, silk, khadi, mulmul, etc.)';
COMMENT ON COLUMN wardrobe_items.pattern IS 'Garment surface pattern (e.g. solid, striped, floral, ikat, bandhani, chikankari, etc.)';
COMMENT ON COLUMN wardrobe_items.fit IS 'Silhouette and cut (e.g. relaxed, regular, slim, oversized, anarkali, tailored)';
COMMENT ON COLUMN wardrobe_items.purchase_price IS 'Original garment purchase price in local currency (INR) for Cost-Per-Wear analytics';
COMMENT ON COLUMN wardrobe_items.purchase_date IS 'Purchase date string (YYYY-MM-DD)';
COMMENT ON COLUMN wardrobe_items.cultural_context IS 'Cultural decorum tier (traditional, contemporary, fusion, ceremonial, everyday_ethnic)';
COMMENT ON COLUMN wardrobe_items.ai_confidence IS 'Confidence score (0.0 - 1.0) of AI-inferred attributes';
COMMENT ON COLUMN wardrobe_items.user_verified IS 'True if attributes have been explicitly verified/edited by the user';
COMMENT ON COLUMN wardrobe_items.provenance IS 'Attribute source tracking (user, ai, system, imported) and confidence logs';
