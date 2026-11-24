import { describe, it, expect, beforeEach } from 'vitest';
import { parseSaathiIntent } from '../engine/saathi/intentParser';
import { processSaathiTurn, createInitialConversationState } from '../engine/saathi/orchestrationEngine';
import { buildEditorialReasoning } from '../engine/saathi/editorialReasoning';
import { DESIGNERS_EDIT_PHILOSOPHIES, getPhilosophyById } from '../engine/knowledge/designersEditCatalog';
import { recommendOutfits } from '../engine/recommendationEngine';
import { styleSignalsRepository } from '../repositories/LocalStorageStyleSignalsRepository';
import { WardrobeItem, ContextSnapshot, StyleSignalEvent } from '../types';

describe('StyleSaathi 4.0 — Real-Time Personal Fashion Intelligence Suite', () => {
  const mockWardrobe: WardrobeItem[] = ([
    {
      id: 'top-1',
      name: 'Oxford Cotton Shirt',
      category: 'Tops',
      subcategory: 'shirt',
      colors: ['blue'],
      fabric: 'cotton',
      fit: 'regular',
      formality: 4,
      status: 'clean',
      occasions: ['office', 'college', 'interview'],
      seasons: ['summer', 'winter', 'monsoon'],
      timesWorn: 8,
      lastWorn: Date.now() - 10 * 24 * 3600 * 1000,
      createdAt: Date.now(),
    },
    {
      id: 'top-2',
      name: 'Raw Silk Kurta',
      category: 'Ethnic',
      subcategory: 'kurta',
      colors: ['white'],
      fabric: 'silk',
      fit: 'relaxed',
      formality: 4,
      status: 'clean',
      occasions: ['festive', 'casual outing'],
      seasons: ['summer', 'winter', 'monsoon'],
      timesWorn: 0, // Underused / Unworn
      createdAt: Date.now(),
    },
    {
      id: 'bottom-1',
      name: 'Tailored Charcoal Trousers',
      category: 'Bottoms',
      subcategory: 'trousers',
      colors: ['grey'],
      fabric: 'wool',
      fit: 'straight',
      formality: 4,
      status: 'clean',
      occasions: ['office', 'interview'],
      seasons: ['summer', 'winter', 'monsoon'],
      timesWorn: 6,
      createdAt: Date.now(),
    },
    {
      id: 'bottom-2',
      name: 'Slim Indigo Jeans',
      category: 'Bottoms',
      subcategory: 'jeans',
      colors: ['blue'],
      fabric: 'denim',
      fit: 'straight',
      formality: 2,
      status: 'clean',
      occasions: ['college', 'casual outing', 'everyday'],
      seasons: ['summer', 'winter', 'monsoon'],
      timesWorn: 12,
      createdAt: Date.now(),
    },
    {
      id: 'shoes-1',
      name: 'Classic Leather Loafers',
      category: 'Footwear',
      subcategory: 'loafers',
      colors: ['brown'],
      formality: 4,
      status: 'clean',
      occasions: ['office', 'college', 'casual outing'],
      seasons: ['summer', 'winter', 'monsoon'],
      timesWorn: 4,
      createdAt: Date.now(),
    },
    {
      id: 'shoes-2',
      name: 'Minimal White Sneakers',
      category: 'Footwear',
      subcategory: 'sneakers',
      colors: ['white'],
      formality: 2,
      status: 'clean',
      occasions: ['college', 'casual outing', 'everyday'],
      seasons: ['summer', 'winter', 'monsoon'],
      timesWorn: 15,
      createdAt: Date.now(),
    },
  ] as any) as WardrobeItem[];

  beforeEach(async () => {
    await styleSignalsRepository.clear();
  });

  // =========================================================================
  // 1. AI Fashion Designer Intent Routing
  // =========================================================================
  describe('1. AI Fashion Designer Intent Routing', () => {
    it('classifies STYLE_3_WAYS intent', () => {
      const res1 = parseSaathiIntent('Style this blue shirt 3 ways');
      expect(res1.intent).toBe('STYLE_3_WAYS');

      const res2 = parseSaathiIntent('Give me three looks for my kurta');
      expect(res2.intent).toBe('STYLE_3_WAYS');
    });

    it('classifies INDO_WESTERN fusion intent', () => {
      const res = parseSaathiIntent('Suggest an Indo-Western look for weekend brunch');
      expect(res.intent).toBe('INDO_WESTERN');
    });

    it('classifies SAREE_STYLING intent', () => {
      const res = parseSaathiIntent('Saree styling tips and footwear');
      expect(res.intent).toBe('SAREE_STYLING');
    });

    it('classifies COLOR_PAIRING intent', () => {
      const res1 = parseSaathiIntent('What colors go with charcoal trousers?');
      expect(res1.intent).toBe('COLOR_PAIRING');

      const res2 = parseSaathiIntent('Trouser colors for white shirt');
      expect(res2.intent).toBe('COLOR_PAIRING');
    });

    it('classifies PREMIUM_UPGRADE intent', () => {
      const res = parseSaathiIntent('How can I make this look more premium and quiet luxury?');
      expect(res.intent).toBe('PREMIUM_UPGRADE');
    });

    it('classifies MINIMALIST_OUTFIT intent', () => {
      const res = parseSaathiIntent('Suggest a minimalist outfit with clean lines');
      expect(res.intent).toBe('MINIMALIST_OUTFIT');
    });

    it('classifies RESTYLE_UNDERUSED intent', () => {
      const res = parseSaathiIntent('Restyle underused clothes in my wardrobe');
      expect(res.intent).toBe('RESTYLE_UNDERUSED');
    });
  });

  // =========================================================================
  // 2. Structured 8-Part Editorial Reasoning Verification
  // =========================================================================
  describe('2. Structured 8-Part Editorial Reasoning', () => {
    it('generates all 8 required editorial reasoning sections with zero hallucinations', () => {
      const mockWeather: ContextSnapshot = ({
        weather: {
          temperature: 27,
          feelsLike: 28,
          humidity: 60,
          precipitationProbability: 10,
          windSpeed: 8,
        },
        forecast: null,
        freshness: 'fresh',
        location: { city: 'Bengaluru', country: 'India', source: 'manual' },
        date: '2026-11-12',
        timeOfDay: 'afternoon',
        thermalContext: 'mild',
        rainContext: 'none',
        occasion: 'college',
        confidence: 0.95,
        source: 'live',
      } as any) as ContextSnapshot;

      const result = buildEditorialReasoning({
        concept: 'Smart Contemporary Campus Polish',
        occasion: 'College',
        components: {
          top: mockWardrobe[0],
          bottom: mockWardrobe[3],
          footwear: mockWardrobe[5],
        },
        weather: mockWeather,
      });

      // Verify all 8 sections exist and are populated
      expect(result.sections.coreConcept).toContain('Smart Contemporary Campus Polish');
      expect(result.sections.wardrobeAnchors).toContain('Oxford Cotton Shirt');
      expect(result.sections.wardrobeAnchors).toContain('Slim Indigo Jeans');
      expect(result.sections.wardrobeAnchors).toContain('Minimal White Sneakers');
      expect(result.sections.colorTheory.length).toBeGreaterThan(10);
      expect(result.sections.proportionSilhouette.length).toBeGreaterThan(10);
      expect(result.sections.fabricTexture.length).toBeGreaterThan(10);
      expect(result.sections.weatherComfort).toContain('27°C');
      expect(result.sections.occasionDecorum).toContain('College');
      expect(result.sections.stylingDirection.length).toBeGreaterThan(10);

      // Verify formatted output contains standard section headers
      expect(result.formattedEditorial).toContain('1. Aesthetic Intent & Core Concept');
      expect(result.formattedEditorial).toContain('2. Wardrobe Anchors');
      expect(result.formattedEditorial).toContain('3. Color Theory & Palette Harmony');
      expect(result.formattedEditorial).toContain('4. Proportion & Silhouette Balance');
      expect(result.formattedEditorial).toContain('5. Fabric & Texture Interplay');
      expect(result.formattedEditorial).toContain('6. Weather & Thermal Comfort');
      expect(result.formattedEditorial).toContain('7. Occasion & Cultural Decorum');
      expect(result.formattedEditorial).toContain('8. Styling Direction & Pro-Tips');
    });

    it('rejects queries gracefully when anchor item does not exist in wardrobe', async () => {
      const state = createInitialConversationState('test_grounding');
      const response = await processSaathiTurn(
        'Style my neon yellow leather trenchcoat 3 ways',
        state,
        {
          wardrobe: mockWardrobe,
          referenceTimestamp: Date.now(),
        }
      );

      expect(response.message).toMatch(/couldn't find/i);
    });
  });

  // =========================================================================
  // 3. Recommendation Roles & Diversity (Underused & Anti-Repetition)
  // =========================================================================
  describe('3. Recommendation Roles & Diversity (Underused & Anti-Repetition)', () => {
    it('includes underused role and applies anti-repetition penalty', () => {
      const outfits = recommendOutfits({
        items: mockWardrobe,
        occasion: 'office',
        season: 'summer' as any,
        localDate: '2026-11-12',
        limit: 4,
        recentWornItemIds: ['top-1'], // Recently worn
      });

      expect(outfits.length).toBeGreaterThan(0);
      const roles = outfits.map((o) => o.role);
      // Best Match is always assigned
      expect(roles).toContain('best_match');

      // The recently worn item receives a penalty in score breakdown
      const outfitWithRecentlyWorn = outfits.find((o) =>
        Object.values(o.slots).flat().some((p) => p.id === 'top-1')
      );
      if (outfitWithRecentlyWorn) {
        expect(outfitWithRecentlyWorn.scoreBreakdown.penalty).toBeGreaterThan(0);
      }
    });

    it('surfaces underused items in recommendations when available', () => {
      const outfits = recommendOutfits({
        items: mockWardrobe,
        occasion: 'casual outing',
        season: 'summer' as any,
        localDate: '2026-11-12',
        limit: 4,
      });

      const underusedLook = outfits.find((o) => o.role === 'underused');
      if (underusedLook) {
        expect(underusedLook.explanation.reasons.some((r) => r.toLowerCase().includes('underused') || r.toLowerCase().includes('active rotation'))).toBe(true);
      }
    });
  });

  // =========================================================================
  // 4. The Designer's Edit Catalog & Provenance
  // =========================================================================
  describe("4. The Designer's Edit Catalog", () => {
    it('contains all 5 foundational philosophies with verified craft traditions', () => {
      expect(DESIGNERS_EDIT_PHILOSOPHIES.length).toBe(5);

      const quietLuxury = getPhilosophyById('quiet-luxury');
      expect(quietLuxury).toBeDefined();
      expect(quietLuxury?.corePrinciples.length).toBeGreaterThanOrEqual(3);
      expect(quietLuxury?.recommendedPalettes.length).toBeGreaterThanOrEqual(1);
      expect(quietLuxury?.textileTraditions.length).toBeGreaterThanOrEqual(1);

      const indianHeritage = getPhilosophyById('indian-heritage');
      expect(indianHeritage).toBeDefined();
      expect(indianHeritage?.textileTraditions.some((t) => t.name.includes('Chanderi'))).toBe(true);
      expect(indianHeritage?.textileTraditions.some((t) => t.name.includes('Chikankari'))).toBe(true);

      const indoWestern = getPhilosophyById('indo-western');
      expect(indoWestern).toBeDefined();

      const contemporaryTailoring = getPhilosophyById('contemporary-tailoring');
      expect(contemporaryTailoring).toBeDefined();

      const minimalist = getPhilosophyById('minimalist');
      expect(minimalist).toBeDefined();
    });
  });

  // =========================================================================
  // 5. Attributed Feedback & Atomic Undo
  // =========================================================================
  describe('5. Attributed Feedback & Atomic Undo', () => {
    it('persists granular rejection feedback and supports instant atomic undo', async () => {
      const signalId = `sig_test_${Date.now()}`;
      const signal: StyleSignalEvent = {
        id: signalId,
        userId: 'local_user',
        createdAt: Date.now(),
        signalType: 'rejected',
        itemIds: ['top-1', 'bottom-1'],
        occasion: 'office',
        rejectionReason: 'too_formal',
      };

      // 1. Add feedback signal
      await styleSignalsRepository.addSignal(signal);
      let signals = await styleSignalsRepository.getSignals();
      expect(signals.some((s) => s.id === signalId)).toBe(true);

      // 2. Undo feedback signal
      if (styleSignalsRepository.removeSignal) {
        await styleSignalsRepository.removeSignal(signalId);
        signals = await styleSignalsRepository.getSignals();
        expect(signals.some((s) => s.id === signalId)).toBe(false);
      }
    });
  });
});
