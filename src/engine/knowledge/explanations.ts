import { FashionKnowledgeSignal } from './types';

/**
 * Canonical registry of deterministic, evidence-backed fashion explanations.
 * Free-form LLM claims and unsupported prose are strictly forbidden.
 */
export const EXPLANATION_REGISTRY: Readonly<Record<string, string>> = Object.freeze({
  // Silhouette
  fitted_top_flared_bottom: 'Balanced silhouette pairing fitted upper bodice with fluid flared volume',
  relaxed_top_tailored_bottom: 'Proportional balance pairing relaxed upper volume with tailored bottom lines',
  structured_tailored_balance: 'Sharp tailored silhouette with clean architectural lines',
  unanchored_volume_collision: 'Competing oversized volumes without a defined waist anchor',

  // Fabrics
  natural_breathable_harmony: 'Breathable natural handloom textures (cotton & khadi) offer balanced comfort',
  regal_ceremonial_fabrics: 'Regal ceremonial textile harmony suited for formal celebrations',
  delicate_heavy_fabric_clash: 'High contrast between ultra-delicate sheer and heavy rigid textiles',

  // Footwear & Accessories
  ethnic_footwear_harmony: 'Traditional handcrafted footwear complements the ethnic ensemble',
  formal_footwear_harmony: 'Classic tailored footwear grounds professional formalwear',
  casual_sneaker_balance: 'Contemporary sneaker pairing adds relaxed everyday versatility',
  traditional_dupatta_pairing: 'Classic dupatta drape completes graceful traditional silhouette',
  nehru_jacket_layering: 'Tailored Nehru jacket adds structured dignity over flowing kurta',

  // Structural Ensemble Complete / Missing
  saree_structural_complete: 'Complete traditional saree ensemble with matching blouse',
  saree_missing_blouse: 'Saree drape structurally requires a fitted upper blouse component',
  lehenga_structural_complete: 'Complete lehenga ensemble with complementary bodice',
  lehenga_missing_blouse: 'Lehenga skirt structurally requires a complementary blouse or fitted top',
  kurta_structural_complete: 'Balanced kurta ensemble with matching lower component',

  // Cultural & Festivals
  festive_textile_resonance: 'Traditional festive textile pairing suited for celebratory occasion',
  festive_cultural_resonance: 'Textiles and palette align with festive celebration decorum',
  auspicious_devotional_tones: 'Auspicious palette and modest drape suited for devotional decorum',
  devotional_informal_piece_mismatch: 'Informal casual piece carries occasion mismatch for traditional puja',
  high_movement_mobility_constraint: 'Heavy or rigid fabric restricts movement for active festive celebrations',
  modesty_preference_aligned: 'Modest drape aligned with declared modesty preference',
  modesty_preference_mismatch: 'Cropped or revealing piece conflicts with declared modesty preference',

  // Regional
  regional_craft_resonance: 'Celebrates authentic regional textile heritage and craft traditions',
});

/**
 * Returns a deterministic, verified explanation for a given knowledge signal.
 * If the signal has no registered explanation key, returns undefined.
 */
export function getExplanationForSignal(
  signal: FashionKnowledgeSignal
): string | undefined {
  if (!signal.explanationKey) return undefined;
  return EXPLANATION_REGISTRY[signal.explanationKey];
}
