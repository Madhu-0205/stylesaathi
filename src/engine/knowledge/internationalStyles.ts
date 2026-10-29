import {
  WardrobeItem,
  FabricType,
  PatternType,
  SilhouetteFit,
} from '../../types';
import { FashionKnowledgeSignal, KnowledgeProvenance } from './types';

export type InternationalStyleSystemId =
  | 'indian_first'
  | 'korean_contemporary_streetwear'
  | 'japanese_relaxed_workwear'
  | 'european_tailored_smart';

export interface InternationalStyleSystem {
  readonly id: InternationalStyleSystemId;
  readonly name: string;
  readonly origin: string;
  readonly designEthos: string;
  readonly characteristicSilhouettes: readonly SilhouetteFit[];
  readonly characteristicFabrics: readonly FabricType[];
  readonly characteristicPatterns: readonly PatternType[];
  readonly pairingWithIndianHeritage: string;
  readonly provenance: KnowledgeProvenance;
}

/**
 * Canonical International Style Systems with Indian-First Defaults.
 * Structured domain knowledge representing selectable styling inspirations,
 * NOT stereotypes, personality assumptions, or speculative trend feeds.
 */
export const INTERNATIONAL_STYLE_SYSTEMS: Readonly<
  Record<InternationalStyleSystemId, InternationalStyleSystem>
> = Object.freeze({
  indian_first: Object.freeze({
    id: 'indian_first',
    name: 'Indian Regional & Contemporary Heritage',
    origin: 'India',
    designEthos:
      'Rooted in centuries of master textile traditions, handcrafted weaves, climate-responsive natural fibers, and nuanced occasion decorum.',
    characteristicSilhouettes: ['straight', 'flared', 'anarkali', 'relaxed', 'tailored'] as const,
    characteristicFabrics: ['cotton', 'khadi', 'mulmul', 'silk', 'banarasi', 'chanderi', 'tussar'] as const,
    characteristicPatterns: ['bandhani', 'ikat', 'block_print', 'kalamkari', 'chikankari', 'zari_brocade', 'solid'] as const,
    pairingWithIndianHeritage:
      'The foundational core of StyleSaathi. Directly anchors all outfits in authentic regional crafts and climate-responsive ergonomics.',
    provenance: { sourceType: 'primary_source', confidence: 0.99, reviewed: true },
  }),

  korean_contemporary_streetwear: Object.freeze({
    id: 'korean_contemporary_streetwear',
    name: 'South Korean Contemporary & Streetwear',
    origin: 'South Korea',
    designEthos:
      'Focuses on relaxed and oversized volume play, clean tonal minimalism, dropped shoulders, understated branding, and modern sneaker accents.',
    characteristicSilhouettes: ['oversized', 'relaxed', 'straight', 'a_line'] as const,
    characteristicFabrics: ['cotton', 'denim', 'linen', 'modal'] as const,
    characteristicPatterns: ['solid', 'striped', 'geometric'] as const,
    pairingWithIndianHeritage:
      'Pairs clean-lined, solid cotton kurtas or kurtis with wide-leg trousers or relaxed denim and contemporary sneakers; layers oversized structured blazers over ethnic separates.',
    provenance: { sourceType: 'internal_curation', confidence: 0.92, reviewed: true },
  }),

  japanese_relaxed_workwear: Object.freeze({
    id: 'japanese_relaxed_workwear',
    name: 'Japanese Relaxed Workwear & Textile Minimalism',
    origin: 'Japan',
    designEthos:
      'Emphasizes wabi-sabi tactile depth, raw indigo denim, breathable utility layers, boxy tailored cuts, and organic natural handlooms.',
    characteristicSilhouettes: ['relaxed', 'straight', 'tailored'] as const,
    characteristicFabrics: ['denim', 'cotton', 'linen', 'khadi'] as const,
    characteristicPatterns: ['solid', 'striped', 'checked', 'abstract'] as const,
    pairingWithIndianHeritage:
      'Synergizes raw indigo denim and workwear chore coats with artisanal Indian khadi muslins, block prints, and natural vegetable-dyed kalamkari.',
    provenance: { sourceType: 'internal_curation', confidence: 0.90, reviewed: true },
  }),

  european_tailored_smart: Object.freeze({
    id: 'european_tailored_smart',
    name: 'European Tailored Smart & Modern Elegance',
    origin: 'Europe',
    designEthos:
      'Architectural shoulders, crisp collars, tailored trousers, tonal neutral elegance, and refined leather footwear.',
    characteristicSilhouettes: ['tailored', 'slim', 'straight'] as const,
    characteristicFabrics: ['wool', 'cotton', 'linen', 'silk'] as const,
    characteristicPatterns: ['solid', 'checked', 'striped'] as const,
    pairingWithIndianHeritage:
      'Harmonizes structured bandhgalas and Nehru jackets with tailored wool/cotton trousers and leather loafers; pairs crisp linen shirts with formal silk drapes.',
    provenance: { sourceType: 'internal_curation', confidence: 0.90, reviewed: true },
  }),
});

/**
 * Evaluates international style synergy and cross-cultural coherence.
 * Ensures international inspirations enrich the ensemble without overriding Indian relevance.
 */
export function evaluateInternationalStyleSignals(
  pieces: WardrobeItem[],
  selectedSystems?: string[]
): FashionKnowledgeSignal[] {
  const signals: FashionKnowledgeSignal[] = [];
  if (!pieces || pieces.length === 0) return signals;

  const activeSystems = selectedSystems && selectedSystems.length > 0
    ? selectedSystems
    : ['indian_first'];

  const subs = pieces.map((p) => p.subcategory?.toLowerCase() || '');
  const fits = pieces.map((p) => p.fit).filter(Boolean);
  const fabrics = pieces.map((p) => p.fabric).filter(Boolean);
  const colors = pieces.flatMap((p) => p.colors.map((c) => c.toLowerCase()));
  const hasEthnic = pieces.some((p) => p.category === 'Ethnic');

  // 1. South Korean Streetwear & Contemporary Silhouette Synergy
  if (activeSystems.includes('korean_contemporary_streetwear') || activeSystems.includes('Korean Streetwear')) {
    const hasRelaxedOrOversized = fits.some((f) => f === 'oversized' || f === 'relaxed');
    const hasSneakersOrLoafers = subs.some((s) => s === 'sneakers' || s === 'loafers');
    const hasMinimalTones = colors.some((c) =>
      ['black', 'white', 'grey', 'cream', 'navy', 'beige', 'olive'].includes(c)
    );

    if ((hasRelaxedOrOversized || hasSneakersOrLoafers) && hasMinimalTones) {
      signals.push({
        type: 'cultural_resonance',
        strength: hasEthnic ? 0.85 : 0.75, // Higher resonance when fused with Indian heritage
        confidence: 0.9,
        explanationKey: 'international_korean_streetwear_resonance',
        provenance: INTERNATIONAL_STYLE_SYSTEMS.korean_contemporary_streetwear.provenance,
        metadata: { system: 'korean_contemporary_streetwear', fusedWithEthnic: hasEthnic },
      });
    }
  }

  // 2. Japanese Relaxed Workwear & Textile Synergy
  if (activeSystems.includes('japanese_relaxed_workwear') || activeSystems.includes('Japanese Minimalism')) {
    const hasTactileNaturalFabric = fabrics.some((f) =>
      ['khadi', 'linen', 'cotton', 'denim', 'mulmul'].includes(f!)
    );
    const hasStraightOrRelaxed = fits.some((f) => f === 'straight' || f === 'relaxed');

    if (hasTactileNaturalFabric && hasStraightOrRelaxed) {
      signals.push({
        type: 'cultural_resonance',
        strength: hasEthnic ? 0.85 : 0.75,
        confidence: 0.9,
        explanationKey: 'international_japanese_workwear_resonance',
        provenance: INTERNATIONAL_STYLE_SYSTEMS.japanese_relaxed_workwear.provenance,
        metadata: { system: 'japanese_relaxed_workwear', fusedWithEthnic: hasEthnic },
      });
    }
  }

  // 3. European Tailored Smart Synergy
  if (activeSystems.includes('european_tailored_smart') || activeSystems.includes('European Smart')) {
    const hasTailoredFit = fits.some((f) => f === 'tailored' || f === 'slim');
    const hasTailoredPiece = subs.some((s) =>
      ['blazer', 'jacket', 'bandhgala', 'trousers', 'formal shoes', 'loafers'].includes(s)
    );

    if (hasTailoredFit || hasTailoredPiece) {
      signals.push({
        type: 'cultural_resonance',
        strength: hasEthnic ? 0.9 : 0.8,
        confidence: 0.9,
        explanationKey: 'international_european_tailored_resonance',
        provenance: INTERNATIONAL_STYLE_SYSTEMS.european_tailored_smart.provenance,
        metadata: { system: 'european_tailored_smart', fusedWithEthnic: hasEthnic },
      });
    }
  }

  return signals;
}
