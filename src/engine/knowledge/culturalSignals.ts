import { WardrobeItem } from '../../types';
import { FashionKnowledgeSignal, FashionKnowledgeContext } from './types';
import { FESTIVAL_CONTEXT_RULES } from './knowledgeData';

/**
 * Evaluates cultural resonance and occasion fit signals based on
 * occasion, festival context, colors, and textile crafts.
 *
 * NON-NEGOTIABLE SAFETY:
 * - Cultural signals are strictly contextual evidence (soft signals).
 * - They NEVER act as hard constraints or universal truths.
 * - User aesthetic preferences soften/override cultural penalties.
 */
export function getCulturalSignals(
  pieces: WardrobeItem[],
  context?: FashionKnowledgeContext
): FashionKnowledgeSignal[] {
  const signals: FashionKnowledgeSignal[] = [];
  if (!context) return signals;

  const occasion = context.occasion;
  const festival = context.festivalContext;
  const piecesColors = pieces.flatMap((p) => p.colors.map((c) => c.toLowerCase()));
  const piecesFabrics = pieces.map((p) => p.fabric).filter(Boolean);
  const piecesPatterns = pieces.map((p) => p.pattern).filter(Boolean);
  const piecesSubs = pieces.map((p) => p.subcategory?.toLowerCase() || '');

  // Check user aesthetic override
  const userAesthetics = (context.userAesthetics || []).map((a) => a.toLowerCase());
  const userPermissiveWestern =
    userAesthetics.includes('modern western') ||
    userAesthetics.includes('casual') ||
    userAesthetics.includes('minimal');

  // 1. Festival Context Matching
  const targetFestivalKey = festival || (occasion && FESTIVAL_CONTEXT_RULES[occasion] ? occasion : undefined);
  if (targetFestivalKey && FESTIVAL_CONTEXT_RULES[targetFestivalKey]) {
    const festRule = FESTIVAL_CONTEXT_RULES[targetFestivalKey];

    // Positive fabric resonance
    const hasSuggestedFabric = piecesFabrics.some((f) => festRule.suggestedFabrics.includes(f!));
    if (hasSuggestedFabric) {
      signals.push({
        type: 'cultural_resonance',
        strength: 0.8,
        confidence: festRule.provenance.confidence,
        explanationKey: 'festive_textile_resonance',
        provenance: festRule.provenance,
        metadata: { festival: festRule.name, ruleType: 'fabric' },
      });
    }

    // Positive color palette resonance
    const hasSuggestedColor = piecesColors.some((c) => festRule.suggestedColors.includes(c));
    if (hasSuggestedColor) {
      signals.push({
        type: 'cultural_resonance',
        strength: 0.75,
        confidence: festRule.provenance.confidence,
        explanationKey: 'festive_cultural_resonance',
        provenance: festRule.provenance,
        metadata: { festival: festRule.name, ruleType: 'palette' },
      });
    }

    // High movement requirement check (e.g. Navratri Dandiya / Sangeet dance)
    if (festRule.movementType === 'high_movement') {
      const rigidHeavyPieces = pieces.filter((p) => p.fabric === 'denim' || p.fabric === 'wool' || p.fabric === 'velvet');
      if (rigidHeavyPieces.length > 0) {
        signals.push({
          type: 'occasion_fit',
          strength: -0.4,
          confidence: 0.75,
          explanationKey: 'high_movement_mobility_constraint',
          provenance: festRule.provenance,
          metadata: { festival: festRule.name, movement: festRule.movementType },
        });
      }
    }
  }

  // 2. Puja / Devotional Decorum
  if (occasion === 'puja') {
    const casualSubs = ['shorts', 't-shirt', 'hoodie', 'sneakers'];
    const hasCasual = piecesSubs.some((s) => casualSubs.includes(s));

    if (hasCasual) {
      const penaltyStrength = userPermissiveWestern ? -0.4 : -0.8;
      signals.push({
        type: 'occasion_fit',
        strength: penaltyStrength,
        confidence: 0.9,
        explanationKey: 'devotional_informal_piece_mismatch',
        provenance: { sourceType: 'internal_curation', confidence: 0.9, reviewed: true },
        metadata: { userOverridden: userPermissiveWestern },
      });
    }

    const auspiciousColors = ['yellow', 'mustard', 'cream', 'white', 'gold', 'red', 'orange', 'pink'];
    if (piecesColors.some((c) => auspiciousColors.includes(c))) {
      signals.push({
        type: 'cultural_resonance',
        strength: 0.85,
        confidence: 0.9,
        explanationKey: 'auspicious_devotional_tones',
        provenance: { sourceType: 'internal_curation', confidence: 0.9, reviewed: true },
      });
    }
  }

  // 3. Wedding Guest / Formal Celebrations
  if (occasion === 'wedding guest' || occasion === 'celebration') {
    const hasRichTextile = piecesFabrics.some((f) =>
      ['silk', 'banarasi', 'velvet', 'tussar', 'chanderi', 'raw_silk'].includes(f!)
    );
    const hasRichCraft = piecesPatterns.some((p) =>
      ['zari_brocade', 'embroidered', 'bandhani'].includes(p!)
    );

    if (hasRichTextile || hasRichCraft) {
      signals.push({
        type: 'cultural_resonance',
        strength: 0.9,
        confidence: 0.95,
        explanationKey: 'regal_ceremonial_fabrics',
        provenance: { sourceType: 'internal_curation', confidence: 0.95, reviewed: true },
      });
    }
  }

  // 4. Declared Modesty Preference Resonance
  if (context.declaredModestyLevel === 'high') {
    const revealingOrCrop = piecesSubs.some((s) => ['shorts', 'crop top'].includes(s));
    if (revealingOrCrop) {
      signals.push({
        type: 'cultural_resonance',
        strength: -0.7,
        confidence: 0.9,
        explanationKey: 'modesty_preference_mismatch',
        provenance: { sourceType: 'internal_curation', confidence: 0.9, reviewed: true },
      });
    } else {
      signals.push({
        type: 'cultural_resonance',
        strength: 0.5,
        confidence: 0.85,
        explanationKey: 'modesty_preference_aligned',
        provenance: { sourceType: 'internal_curation', confidence: 0.85, reviewed: true },
      });
    }
  }

  return signals;
}
