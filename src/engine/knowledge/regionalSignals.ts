import { WardrobeItem } from '../../types';
import {
  FashionKnowledgeSignal,
  FashionKnowledgeContext,
  RegionalMacroZone,
} from './types';
import { REGIONAL_TRADITIONS } from './knowledgeData';

const ZONE_ALIASES: Record<string, RegionalMacroZone> = {
  north: 'north',
  punjab: 'north',
  delhi: 'north',
  kashmir: 'north',
  uttar_pradesh: 'north',
  south: 'south',
  tamil_nadu: 'south',
  kerala: 'south',
  karnataka: 'south',
  andhra_pradesh: 'south',
  telangana: 'south',
  east: 'east',
  bengal: 'east',
  odisha: 'east',
  bihar: 'east',
  assam: 'northeast',
  northeast: 'northeast',
  west: 'west',
  gujarat: 'west',
  rajasthan: 'west',
  maharashtra: 'west',
  central: 'central',
  madhya_pradesh: 'central',
};

/**
 * Evaluates regional resonance signals when a regional preference
 * or context is explicitly provided.
 *
 * NON-NEGOTIABLE SAFETY:
 * - Regional signals are strictly contextual suggestions.
 * - They NEVER impose mandatory garments or stereotypes on users.
 * - If no regional preference is specified, returns empty signals (zero bias).
 */
export function getRegionalSignals(
  pieces: WardrobeItem[],
  context?: FashionKnowledgeContext
): FashionKnowledgeSignal[] {
  const signals: FashionKnowledgeSignal[] = [];
  if (!context?.regionalPreference) return signals;

  const rawKey = context.regionalPreference.toLowerCase().trim().replace(/\s+/g, '_');
  const zoneKey = ZONE_ALIASES[rawKey];
  if (!zoneKey || !REGIONAL_TRADITIONS[zoneKey]) return signals;

  const tradition = REGIONAL_TRADITIONS[zoneKey];
  const piecesFabrics = pieces.map((p) => p.fabric).filter(Boolean);
  const piecesPatterns = pieces.map((p) => p.pattern).filter(Boolean);
  const piecesSubs = pieces.map((p) => p.subcategory?.toLowerCase() || '');

  // 1. Regional textile fabric match
  const matchedFabrics = piecesFabrics.filter((f) =>
    tradition.representativeFabrics.includes(f!)
  );

  // 2. Regional craft / pattern match
  const matchedPatterns = piecesPatterns.filter((p) =>
    tradition.representativePatterns.includes(p!)
  );

  // 3. Representative garment match
  const matchedGarments = piecesSubs.filter((g) =>
    tradition.representativeGarments.includes(g as any)
  );

  if (matchedPatterns.length > 0) {
    signals.push({
      type: 'regional_resonance',
      strength: 0.85,
      confidence: tradition.provenance.confidence,
      explanationKey: 'regional_craft_resonance',
      provenance: tradition.provenance,
      metadata: {
        zone: tradition.zone,
        matchedPatterns: matchedPatterns.join(', '),
      },
    });
  } else if (matchedFabrics.length > 0 && matchedGarments.length > 0) {
    signals.push({
      type: 'regional_resonance',
      strength: 0.7,
      confidence: tradition.provenance.confidence,
      explanationKey: 'regional_craft_resonance',
      provenance: tradition.provenance,
      metadata: {
        zone: tradition.zone,
        matchedFabrics: matchedFabrics.join(', '),
      },
    });
  }

  return signals;
}
