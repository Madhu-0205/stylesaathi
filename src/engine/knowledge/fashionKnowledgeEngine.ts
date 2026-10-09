import { WardrobeItem } from '../../types';
import {
  FashionKnowledgeEngine,
  FashionKnowledgeSignal,
  FashionKnowledgeContext,
  KNOWLEDGE_GRAPH_VERSION,
} from './types';
import {
  getEnsembleIntegritySignals,
  getOutfitFabricSignals,
  getSilhouetteBalanceSignals,
  getFootwearCompatibilitySignals,
  getAccessoryAndLayeringSignals,
} from './compatibility';
import { getCulturalSignals } from './culturalSignals';
import { getRegionalSignals } from './regionalSignals';

export class DefaultFashionKnowledgeEngine implements FashionKnowledgeEngine {
  readonly version = KNOWLEDGE_GRAPH_VERSION;

  /**
   * Evaluates an outfit candidate against the canonical Indian Fashion Knowledge Graph.
   * Returns structured domain evidence (signals).
   *
   * CRITICAL ARCHITECTURAL BOUNDARY:
   * - This method DOES NOT compute a final recommendation score.
   * - This method DOES NOT rank outfits or pick top matches.
   * - It only returns structured domain knowledge signals for Phase 5 to consume.
   */
  public getSignals(
    items: WardrobeItem[],
    context?: FashionKnowledgeContext
  ): FashionKnowledgeSignal[] {
    if (!items || items.length === 0) return [];

    const signals: FashionKnowledgeSignal[] = [];

    // 1. Structural Ensemble Integrity
    signals.push(...getEnsembleIntegritySignals(items));

    // 2. Fabric Compatibility
    signals.push(...getOutfitFabricSignals(items));

    // 3. Silhouette Volume Balance
    signals.push(...getSilhouetteBalanceSignals(items));

    // 4. Footwear Harmony
    signals.push(...getFootwearCompatibilitySignals(items));

    // 5. Layering & Accessories
    signals.push(...getAccessoryAndLayeringSignals(items));

    // 6. Cultural & Occasion Resonance
    signals.push(...getCulturalSignals(items, context));

    // 7. Contextual Regional Resonance
    signals.push(...getRegionalSignals(items, context));

    return signals;
  }
}

export const fashionKnowledgeEngine: FashionKnowledgeEngine =
  new DefaultFashionKnowledgeEngine();

export function getFashionKnowledgeSignals(
  items: WardrobeItem[],
  context?: FashionKnowledgeContext
): FashionKnowledgeSignal[] {
  return fashionKnowledgeEngine.getSignals(items, context);
}
