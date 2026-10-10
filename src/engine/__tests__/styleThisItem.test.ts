import { describe, it, expect } from 'vitest';
import { RecommendationEngine, MAX_RECOMMENDATION_CANDIDATES } from '../recommendationEngine';
import {
  WardrobeItem,
  ContextSnapshot,
  PersonalStyleProfile,
  Category,
  Subcategory,
  Season,
  Occasion,
} from '../../types';
import { derivePersonalStyleProfile } from '../styleBrain';

function createMockItem(partial: Partial<WardrobeItem> & {
  id: string;
  name: string;
  category: Category;
  subcategory: Subcategory;
  colors: string[];
  seasons: Season[];
  occasions: Occasion[];
  formality: number;
}): WardrobeItem {
  return {
    userId: 'user_1',
    favorite: false,
    note: '',
    timesWorn: 0,
    status: 'clean',
    ...partial,
  };
}

describe('Phase 7: Style This Item Engine Invariants & Anchor Constraints', () => {
  const engine = new RecommendationEngine();

  // Baseline standard wardrobe pieces
  const whiteShirt = createMockItem({
    id: 'item_white_shirt',
    name: 'Classic White Linen Shirt',
    category: 'Tops',
    subcategory: 'shirt',
    colors: ['white'],
    seasons: ['summer', 'monsoon'],
    occasions: ['college', 'office', 'casual outing'],
    formality: 3,
    timesWorn: 5,
    fabric: 'linen',
    pattern: 'solid',
    fit: 'regular',
  });

  const blueJeans = createMockItem({
    id: 'item_blue_jeans',
    name: 'Straight Dark Blue Jeans',
    category: 'Bottoms',
    subcategory: 'jeans',
    colors: ['blue'],
    seasons: ['summer', 'monsoon', 'winter'],
    occasions: ['college', 'office', 'casual outing'],
    formality: 2,
    timesWorn: 8,
    fabric: 'denim',
    pattern: 'solid',
    fit: 'straight',
  });

  const whiteSneakers = createMockItem({
    id: 'item_white_sneakers',
    name: 'Clean White Leather Sneakers',
    category: 'Footwear',
    subcategory: 'sneakers',
    colors: ['white'],
    seasons: ['summer', 'monsoon', 'winter'],
    occasions: ['college', 'casual outing', 'everyday'],
    formality: 2,
    timesWorn: 12,
  });

  const navyBlazer = createMockItem({
    id: 'item_navy_blazer',
    name: 'Structured Navy Wool Blazer',
    category: 'Outerwear',
    subcategory: 'blazer',
    colors: ['navy'],
    seasons: ['winter'],
    occasions: ['office', 'interview', 'date'],
    formality: 4,
    timesWorn: 3,
    fabric: 'wool',
  });

  const floralKurta = createMockItem({
    id: 'item_floral_kurta',
    name: 'Handloom Cotton Floral Kurta',
    category: 'Ethnic',
    subcategory: 'kurta',
    colors: ['yellow'],
    seasons: ['summer', 'monsoon'],
    occasions: ['puja', 'festive', 'college', 'family gathering'],
    formality: 3,
    timesWorn: 4,
    fabric: 'cotton',
  });

  const silkDupatta = createMockItem({
    id: 'item_silk_dupatta',
    name: 'Chanderi Silk Golden Dupatta',
    category: 'Ethnic',
    subcategory: 'dupatta',
    colors: ['gold'],
    seasons: ['summer', 'monsoon', 'winter'],
    occasions: ['festive', 'puja', 'wedding guest'],
    formality: 4,
    timesWorn: 2,
    fabric: 'silk',
  });

  const leatherWatch = createMockItem({
    id: 'item_leather_watch',
    name: 'Vintage Leather Strap Chronograph',
    category: 'Accessories',
    subcategory: 'watch',
    colors: ['brown'],
    seasons: ['summer', 'monsoon', 'winter'],
    occasions: ['office', 'college', 'everyday'],
    formality: 3,
    timesWorn: 20,
  });

  const standardWardrobe: WardrobeItem[] = [
    whiteShirt,
    blueJeans,
    whiteSneakers,
    navyBlazer,
    floralKurta,
    silkDupatta,
    leatherWatch,
  ];

  // ==========================================================================
  // 1. ANCHOR IMMUTABILITY
  // ==========================================================================
  describe('Anchor Invariants & Immutability', () => {
    it('test_anchor_preserved_in_all_outfits: 100% of generated outfits contain exact anchorItem.id', () => {
      const result = engine.recommend({
        items: standardWardrobe,
        occasion: 'college',
        season: 'summer',
        localDate: '2026-10-09',
        anchorItemId: whiteShirt.id,
      });

      expect(result.set.outfits.length).toBeGreaterThan(0);
      for (const outfit of result.set.outfits) {
        const itemIds = Object.values(outfit.slots).flat().map((i) => i.id);
        expect(itemIds).toContain(whiteShirt.id);
      }
    });

    it('test_anchor_cannot_be_substituted: twins of identical subcategory never substitute anchor', () => {
      const twinShirt = createMockItem({
        ...whiteShirt,
        id: 'item_white_shirt_twin',
        name: 'Twin White Linen Shirt',
      });
      const wardrobeWithTwin = [...standardWardrobe, twinShirt];

      const result = engine.recommend({
        items: wardrobeWithTwin,
        occasion: 'college',
        season: 'summer',
        localDate: '2026-10-09',
        anchorItemId: whiteShirt.id,
      });

      expect(result.set.outfits.length).toBeGreaterThan(0);
      for (const outfit of result.set.outfits) {
        const itemIds = Object.values(outfit.slots).flat().map((i) => i.id);
        expect(itemIds).toContain(whiteShirt.id);
        expect(itemIds).not.toContain(twinShirt.id);
      }
    });

    it('test_anchor_immutability_across_shuffles: cycling seed offsets retains exact anchor', () => {
      for (let offset = 0; offset <= 5; offset++) {
        const result = engine.recommend({
          items: standardWardrobe,
          occasion: 'college',
          season: 'summer',
          localDate: '2026-10-09',
          explorationSeedOffset: offset,
          anchorItemId: blueJeans.id,
        });

        if (result.set.outfits.length > 0) {
          for (const outfit of result.set.outfits) {
            const itemIds = Object.values(outfit.slots).flat().map((i) => i.id);
            expect(itemIds).toContain(blueJeans.id);
          }
        }
      }
    });
  });

  // ==========================================================================
  // 2. CATEGORY SEMANTICS
  // ==========================================================================
  describe('Category-Specific Anchor Semantics', () => {
    it('supports primary garment anchors (tops, bottoms, dresses)', () => {
      // Top anchor
      const topRes = engine.recommend({
        items: standardWardrobe,
        occasion: 'college',
        season: 'summer',
        localDate: '2026-10-09',
        anchorItemId: whiteShirt.id,
      });
      expect(topRes.set.outfits.length).toBeGreaterThan(0);
      expect(topRes.set.outfits[0].slots.top[0].id).toBe(whiteShirt.id);

      // Bottom anchor
      const bottomRes = engine.recommend({
        items: standardWardrobe,
        occasion: 'college',
        season: 'summer',
        localDate: '2026-10-09',
        anchorItemId: blueJeans.id,
      });
      expect(bottomRes.set.outfits.length).toBeGreaterThan(0);
      expect(bottomRes.set.outfits[0].slots.bottom[0].id).toBe(blueJeans.id);
    });

    it('promotes optional layer slot to required when anchoring on outerwear', () => {
      const winterShirt = createMockItem({
        ...whiteShirt,
        id: 'item_winter_shirt',
        seasons: ['winter'],
      });
      const formalShoes = createMockItem({
        id: 'item_oxfords',
        name: 'Black Leather Oxfords',
        category: 'Footwear',
        subcategory: 'formal shoes',
        colors: ['black'],
        seasons: ['winter'],
        occasions: ['office', 'interview'],
        formality: 4,
        timesWorn: 2,
      });

      const result = engine.recommend({
        items: [...standardWardrobe, winterShirt, formalShoes],
        occasion: 'office',
        season: 'winter',
        localDate: '2026-10-09',
        anchorItemId: navyBlazer.id,
      });

      expect(result.set.outfits.length).toBeGreaterThan(0);
      const topLook = result.set.outfits[0];
      expect(topLook.slots.outerwear).toBeDefined();
      expect(topLook.slots.outerwear[0].id).toBe(navyBlazer.id);
    });

    it('pins footwear slot and generates complementary ensemble around shoes', () => {
      const result = engine.recommend({
        items: standardWardrobe,
        occasion: 'college',
        season: 'summer',
        localDate: '2026-10-09',
        anchorItemId: whiteSneakers.id,
      });

      expect(result.set.outfits.length).toBeGreaterThan(0);
      const topLook = result.set.outfits[0];
      expect(topLook.slots.footwear[0].id).toBe(whiteSneakers.id);
      expect(topLook.slots.top).toBeDefined();
      expect(topLook.slots.bottom).toBeDefined();
    });

    it('anchors ethnic templates with draped accessories (dupatta)', () => {
      const ethnicPajama = createMockItem({
        id: 'item_white_pajama',
        name: 'Crisp White Cotton Pajama',
        category: 'Bottoms',
        subcategory: 'pajama',
        colors: ['white'],
        seasons: ['summer'],
        occasions: ['festive', 'puja'],
        formality: 3,
        timesWorn: 1,
      });

      const juttis = createMockItem({
        id: 'item_tan_juttis',
        name: 'Handcrafted Tan Leather Juttis',
        category: 'Footwear',
        subcategory: 'juttis',
        colors: ['tan'],
        seasons: ['summer'],
        occasions: ['festive', 'puja'],
        formality: 3,
        timesWorn: 1,
      });

      const result = engine.recommend({
        items: [...standardWardrobe, ethnicPajama, juttis],
        occasion: 'puja',
        season: 'summer',
        localDate: '2026-10-09',
        anchorItemId: silkDupatta.id,
      });

      expect(result.set.outfits.length).toBeGreaterThan(0);
      const outfit = result.set.outfits[0];
      expect(outfit.slots.dupatta[0].id).toBe(silkDupatta.id);
    });

    it('micro-accessories return graceful explanatory state without fabricating unnatural templates', () => {
      const result = engine.recommend({
        items: standardWardrobe,
        occasion: 'college',
        season: 'summer',
        localDate: '2026-10-09',
        anchorItemId: leatherWatch.id,
      });

      expect(result.set.outfits).toEqual([]);
      expect(result.set.missingRequirements).toBeDefined();
      expect(result.set.missingRequirements!.length).toBe(1);
      expect(result.set.missingRequirements![0].templateId).toBe('accessory_anchor_unsupported');
      expect(result.set.missingRequirements![0].explanation).toContain(
        'Pieces like watches, jewellery, and bags complement finished outfits'
      );
    });
  });

  // ==========================================================================
  // 3. LAUNDRY & AVAILABILITY POLICY
  // ==========================================================================
  describe('Laundry Policy (Style Idea != Ready to Wear)', () => {
    it('clean anchor generates ready-to-wear outfits', () => {
      const result = engine.recommend({
        items: standardWardrobe,
        occasion: 'college',
        season: 'summer',
        localDate: '2026-10-09',
        anchorItemId: whiteShirt.id,
      });
      expect(result.set.outfits.length).toBeGreaterThan(0);
      expect(result.set.outfits[0].slots.top[0].status).toBe('clean');
    });

    it('needs_washing anchor allows styling for planning but preserves status in outfit', () => {
      const dirtyShirt = createMockItem({
        ...whiteShirt,
        id: 'item_dirty_shirt',
        status: 'needs_washing',
      });
      const wardrobe = [dirtyShirt, blueJeans, whiteSneakers];

      const result = engine.recommend({
        items: wardrobe,
        occasion: 'college',
        season: 'summer',
        localDate: '2026-10-09',
        anchorItemId: dirtyShirt.id,
      });

      expect(result.set.outfits.length).toBeGreaterThan(0);
      const topLook = result.set.outfits[0];
      expect(topLook.slots.top[0].id).toBe(dirtyShirt.id);
      expect(topLook.slots.top[0].status).toBe('needs_washing');
      expect(topLook.slots.bottom[0].status).toBe('clean');
      expect(topLook.slots.footwear[0].status).toBe('clean');
    });

    it('in_laundry anchor allows planning styling while companions remain clean', () => {
      const laundryShirt = createMockItem({
        ...whiteShirt,
        id: 'item_laundry_shirt',
        status: 'in_laundry',
      });
      const wardrobe = [laundryShirt, blueJeans, whiteSneakers];

      const result = engine.recommend({
        items: wardrobe,
        occasion: 'college',
        season: 'summer',
        localDate: '2026-10-09',
        anchorItemId: laundryShirt.id,
      });

      expect(result.set.outfits.length).toBeGreaterThan(0);
      const topLook = result.set.outfits[0];
      expect(topLook.slots.top[0].id).toBe(laundryShirt.id);
      expect(topLook.slots.top[0].status).toBe('in_laundry');
      expect(topLook.slots.bottom[0].status).toBe('clean');
    });

    it('companion items must NEVER be dirty even if anchor is being styled', () => {
      const dirtyJeans = createMockItem({
        ...blueJeans,
        status: 'needs_washing',
      });
      const wardrobe = [whiteShirt, dirtyJeans, whiteSneakers];

      const result = engine.recommend({
        items: wardrobe,
        occasion: 'college',
        season: 'summer',
        localDate: '2026-10-09',
        anchorItemId: whiteShirt.id,
      });

      expect(result.set.outfits).toEqual([]);
      expect(result.set.missingRequirements).toBeDefined();
      expect(result.set.missingRequirements![0].missingRole).toBe('bottom');
    });

    it('standard Dress Me without anchorItemId remains strictly bound to clean clothes', () => {
      const dirtyJeans = createMockItem({
        ...blueJeans,
        status: 'needs_washing',
      });
      const wardrobe = [whiteShirt, dirtyJeans, whiteSneakers];

      const result = engine.recommend({
        items: wardrobe,
        occasion: 'college',
        season: 'summer',
        localDate: '2026-10-09',
      });

      expect(result.set.outfits).toEqual([]);
    });
  });

  // ==========================================================================
  // 4. SPARSE WARDROBE & TYPED MISSING ROLE CONTRACT
  // ==========================================================================
  describe('Sparse Wardrobe & Typed Missing Roles', () => {
    it('returns empty outfits and typed missing bottom requirement when bottom is absent', () => {
      const isolatedShirt = createMockItem({ ...whiteShirt });
      const sparseWardrobe = [isolatedShirt, whiteSneakers];

      const result = engine.recommend({
        items: sparseWardrobe,
        occasion: 'college',
        season: 'summer',
        localDate: '2026-10-09',
        anchorItemId: isolatedShirt.id,
      });

      expect(result.set.outfits).toEqual([]);
      expect(result.set.missingRequirements).toBeDefined();
      expect(result.set.missingRequirements!.length).toBeGreaterThan(0);
      const missing = result.set.missingRequirements![0];
      expect(missing.missingRole).toBe('bottom');
      expect(missing.expectedCategory).toBe('Bottoms');
      expect(missing.compatibleSubcategories).toContain('trousers');
      expect(missing.explanation).toContain('needs a compatible bottom');
    });

    it('returns typed missing top requirement when saree lacks a blouse', () => {
      const redSaree = createMockItem({
        id: 'item_red_saree',
        name: 'Crimson Kanjeevaram Saree',
        category: 'Ethnic',
        subcategory: 'saree',
        colors: ['red'],
        seasons: ['summer', 'winter'],
        occasions: ['wedding guest', 'festive'],
        formality: 5,
        timesWorn: 1,
      });

      const heels = createMockItem({
        id: 'item_gold_heels',
        name: 'Metallic Gold Block Heels',
        category: 'Footwear',
        subcategory: 'heels',
        colors: ['gold'],
        seasons: ['summer'],
        occasions: ['wedding guest'],
        formality: 5,
        timesWorn: 1,
      });

      const result = engine.recommend({
        items: [redSaree, heels],
        occasion: 'wedding guest',
        season: 'summer',
        localDate: '2026-10-09',
        anchorItemId: redSaree.id,
      });

      expect(result.set.outfits).toEqual([]);
      expect(result.set.missingRequirements).toBeDefined();
      const missing = result.set.missingRequirements![0];
      expect(missing.missingRole).toBe('top');
      expect(missing.expectedCategory).toBe('Ethnic');
      expect(missing.compatibleSubcategories).toContain('blouse');
      expect(missing.explanation).toContain('needs a compatible blouse');
    });

    it('returns typed missing footwear requirement when wardrobe has no shoes', () => {
      const result = engine.recommend({
        items: [whiteShirt, blueJeans],
        occasion: 'college',
        season: 'summer',
        localDate: '2026-10-09',
        anchorItemId: whiteShirt.id,
      });

      expect(result.set.outfits).toEqual([]);
      expect(result.set.missingRequirements).toBeDefined();
      const missing = result.set.missingRequirements![0];
      expect(missing.missingRole).toBe('footwear');
      expect(missing.expectedCategory).toBe('Footwear');
    });
  });

  // ==========================================================================
  // 5. METADATA DEGRADATION & ROBUSTNESS
  // ==========================================================================
  describe('Metadata Degradation & Graceful Fallbacks', () => {
    it('degrades gracefully when fabric, pattern, and fit are unknown', () => {
      const bareItem = createMockItem({
        id: 'item_bare_top',
        name: 'Unlabeled Black Tee',
        category: 'Tops',
        subcategory: 't-shirt',
        colors: ['black'],
        seasons: ['summer', 'monsoon', 'winter'],
        occasions: ['college', 'everyday'],
        formality: 2,
        fabric: undefined,
        pattern: undefined,
        fit: undefined,
      });

      const result = engine.recommend({
        items: [bareItem, blueJeans, whiteSneakers],
        occasion: 'college',
        season: 'summer',
        localDate: '2026-10-09',
        anchorItemId: bareItem.id,
      });

      expect(result.set.outfits.length).toBeGreaterThan(0);
      expect(result.set.outfits[0].slots.top[0].id).toBe(bareItem.id);
    });
  });

  // ==========================================================================
  // 6. PERSONALIZATION & EXPLORE HIERARCHY
  // ==========================================================================
  describe('Personal Style Brain & Explore Hierarchy', () => {
    it('explore role introduces safe novelty without violating user avoidances', () => {
      const yellowTrousers = createMockItem({
        id: 'item_yellow_trousers',
        name: 'Neon Yellow Trousers',
        category: 'Bottoms',
        subcategory: 'trousers',
        colors: ['yellow'],
        seasons: ['summer'],
        occasions: ['college'],
        formality: 2,
      });

      const blackTrousers = createMockItem({
        id: 'item_black_trousers',
        name: 'Tailored Black Trousers',
        category: 'Bottoms',
        subcategory: 'trousers',
        colors: ['black'],
        seasons: ['summer'],
        occasions: ['college'],
        formality: 3,
        timesWorn: 1,
      });

      const baseProfile = derivePersonalStyleProfile(
        [],
        [],
        [whiteShirt, blueJeans, blackTrousers, yellowTrousers, whiteSneakers]
      );
      const styleProfile: PersonalStyleProfile = {
        ...baseProfile,
        avoidedColors: ['yellow'],
      };

      const result = engine.recommend({
        items: [whiteShirt, blueJeans, blackTrousers, yellowTrousers, whiteSneakers],
        occasion: 'college',
        season: 'summer',
        localDate: '2026-10-09',
        styleProfile,
        anchorItemId: whiteShirt.id,
      });

      const exploreOutfit = result.set.outfits.find((o) => o.role === 'explore');
      if (exploreOutfit) {
        const itemIds = Object.values(exploreOutfit.slots).flat().map((i) => i.id);
        expect(itemIds).not.toContain(yellowTrousers.id);
      }
    });
  });

  // ==========================================================================
  // 7. WEATHER & CLIMATE SAFETY
  // ==========================================================================
  describe('Weather & Climate Integration', () => {
    it('suppresses delicate silk items in active heavy rain deluge', () => {
      const silkShirt = createMockItem({
        ...whiteShirt,
        id: 'item_delicate_silk_shirt',
        fabric: 'silk',
      });

      const delugeContext: ContextSnapshot = {
        date: '2026-10-09',
        occasion: 'college',
        thermalContext: 'warm',
        rainContext: 'active_rain',
        freshness: 'fresh',
        timeOfDay: 'afternoon',
        confidence: 1.0,
        source: 'live',
        location: { city: 'Mumbai', country: 'India', source: 'manual' },
        weather: {
          condition: 'heavy_rain',
          temperature: 26,
          feelsLike: 29,
          humidity: 92,
          precipitationProbability: 95,
          windSpeed: 24,
          observedAt: Date.now(),
          expiresAt: Date.now() + 3600000,
          source: 'live',
          location: { city: 'Mumbai', country: 'India', source: 'manual' },
        },
      };

      const result = engine.recommend({
        items: [silkShirt, blueJeans, whiteSneakers],
        occasion: 'college',
        season: 'monsoon',
        localDate: '2026-10-09',
        context: delugeContext,
        anchorItemId: silkShirt.id,
      });

      expect(result.set.outfits).toEqual([]);
    });
  });

  // ==========================================================================
  // 8. DETERMINISM & CANDIDATE BOUNDS
  // ==========================================================================
  describe('Determinism & Candidate Pool Bounds', () => {
    it('produces 100% deterministic results across repeated identical invocations', () => {
      const run1 = engine.recommend({
        items: standardWardrobe,
        occasion: 'college',
        season: 'summer',
        localDate: '2026-10-09',
        anchorItemId: whiteShirt.id,
      });

      const run2 = engine.recommend({
        items: standardWardrobe,
        occasion: 'college',
        season: 'summer',
        localDate: '2026-10-09',
        anchorItemId: whiteShirt.id,
      });

      expect(run1.set.outfits.length).toEqual(run2.set.outfits.length);
      for (let i = 0; i < run1.set.outfits.length; i++) {
        expect(run1.set.outfits[i].id).toEqual(run2.set.outfits[i].id);
        expect(run1.set.outfits[i].role).toEqual(run2.set.outfits[i].role);
        expect(run1.set.outfits[i].score).toEqual(run2.set.outfits[i].score);
      }
    });

    it('enforces MAX_RECOMMENDATION_CANDIDATES = 350 invariant', () => {
      const result = engine.recommend({
        items: standardWardrobe,
        occasion: 'college',
        season: 'summer',
        localDate: '2026-10-09',
        anchorItemId: whiteShirt.id,
      });

      expect(result.telemetry.candidateCount).toBeLessThanOrEqual(MAX_RECOMMENDATION_CANDIDATES);
    });
  });

  // ==========================================================================
  // 9. FINAL VERIFICATION GATE AUDITS
  // ==========================================================================
  describe('Phase 7 Final Verification Gate Audits', () => {
    it('SURROGATE SAFETY: dirty anchor proxy changes ONLY availability and preserves all original attributes in output', () => {
      const dirtyAnchor = createMockItem({
        id: 'item_vintage_linen_olive',
        name: 'Vintage Olive Linen Shirt',
        category: 'Tops',
        subcategory: 'shirt',
        colors: ['olive'],
        seasons: ['summer'],
        occasions: ['college', 'casual outing'],
        formality: 3,
        status: 'needs_washing',
        timesWorn: 7,
        favorite: true,
        note: 'Special vintage piece',
        fabric: 'linen',
        pattern: 'striped',
        fit: 'slim',
      });

      const wardrobe = [dirtyAnchor, blueJeans, whiteSneakers];

      const result = engine.recommend({
        items: wardrobe,
        occasion: 'college',
        season: 'summer',
        localDate: '2026-10-09',
        anchorItemId: dirtyAnchor.id,
      });

      expect(result.set.outfits.length).toBeGreaterThan(0);
      const outfit = result.set.outfits[0];
      const returnedAnchor = outfit.slots.top[0];

      // Exact ID match
      expect(returnedAnchor.id).toBe(dirtyAnchor.id);
      // Status strictly preserved as original dirty status
      expect(returnedAnchor.status).toBe('needs_washing');
      // Every other scoring and compatibility attribute strictly preserved
      expect(returnedAnchor.name).toBe('Vintage Olive Linen Shirt');
      expect(returnedAnchor.category).toBe('Tops');
      expect(returnedAnchor.subcategory).toBe('shirt');
      expect(returnedAnchor.colors).toEqual(['olive']);
      expect(returnedAnchor.fabric).toBe('linen');
      expect(returnedAnchor.pattern).toBe('striped');
      expect(returnedAnchor.fit).toBe('slim');
      expect(returnedAnchor.formality).toBe(3);
      expect(returnedAnchor.timesWorn).toBe(7);
      expect(returnedAnchor.favorite).toBe(true);
      expect(returnedAnchor.note).toBe('Special vintage piece');

      // Canonical referential equality
      expect(returnedAnchor).toBe(dirtyAnchor);
    });

    it('CANONICAL RESOLUTION: anchorItemId resolves exclusively from request.items with strict referential identity', () => {
      const canonicalItem = standardWardrobe.find((i) => i.id === whiteShirt.id)!;
      expect(canonicalItem).toBeDefined();

      const result = engine.recommend({
        items: standardWardrobe,
        occasion: 'college',
        season: 'summer',
        localDate: '2026-10-09',
        anchorItemId: canonicalItem.id,
      });

      expect(result.set.outfits.length).toBeGreaterThan(0);
      for (const outfit of result.set.outfits) {
        expect(outfit.slots.top[0]).toBe(canonicalItem);
      }
    });

    it('DIVERSITY AUDIT: verifies 68-candidate ceiling provides meaningful diversity across dimensions for 150, 500, 1000 items', () => {
      // Helper to generate wardrobe of given size
      const buildWardrobe = (count: number) => {
        const anchor = createMockItem({
          id: 'core_anchor_shirt',
          name: 'Core Anchor Shirt',
          category: 'Tops',
          subcategory: 'shirt',
          colors: ['white'],
          seasons: ['summer'],
          occasions: ['college', 'casual outing'],
          formality: 3,
        });

        const items: WardrobeItem[] = [anchor];
        const bottomSubcats = ['jeans', 'trousers', 'palazzo', 'churidar'] as const;
        const shoeSubcats = ['sneakers', 'loafers', 'flats', 'juttis'] as const;
        const colorPalette = ['blue', 'black', 'beige', 'grey', 'olive', 'brown', 'maroon', 'navy'];
        const fabrics = ['cotton', 'linen', 'denim', 'silk'] as const;

        for (let i = 1; i < count; i++) {
          if (i % 2 === 0) {
            items.push(
              createMockItem({
                id: `bottom_${i}`,
                name: `Synthetic Bottom ${i}`,
                category: 'Bottoms',
                subcategory: bottomSubcats[i % bottomSubcats.length],
                colors: [colorPalette[i % colorPalette.length]],
                fabric: fabrics[i % fabrics.length],
                seasons: ['summer'],
                occasions: ['college', 'casual outing'],
                formality: (i % 5) + 1,
              })
            );
          } else {
            items.push(
              createMockItem({
                id: `shoes_${i}`,
                name: `Synthetic Shoes ${i}`,
                category: 'Footwear',
                subcategory: shoeSubcats[i % shoeSubcats.length],
                colors: [colorPalette[i % colorPalette.length]],
                seasons: ['summer'],
                occasions: ['college', 'casual outing'],
                formality: (i % 5) + 1,
              })
            );
          }
        }
        return { items, anchor };
      };

      for (const size of [150, 500, 1000]) {
        const { items, anchor } = buildWardrobe(size);
        const res = engine.recommend({
          items,
          occasion: 'college',
          season: 'summer',
          localDate: '2026-10-09',
          anchorItemId: anchor.id,
        });

        // 1. Natural ceiling <= 350
        expect(res.telemetry.candidateCount).toBeLessThanOrEqual(350);
        // Candidate pool naturally ceilinged at exactly 68 candidates across stratified strata
        expect(res.telemetry.candidateCount).toBe(68);

        // 2. Diversity verification: curated looks have distinct companions
        expect(res.set.outfits.length).toBeGreaterThanOrEqual(2);
        const best = res.set.outfits.find((o) => o.role === 'best_match');
        const alt = res.set.outfits.find((o) => o.role === 'alternative');
        expect(best).toBeDefined();
        expect(alt).toBeDefined();

        // Best match and alternative must have distinct bottom or footwear
        const bestBottomId = best!.slots.bottom[0].id;
        const altBottomId = alt!.slots.bottom[0].id;
        const bestShoeId = best!.slots.footwear[0].id;
        const altShoeId = alt!.slots.footwear[0].id;

        expect(bestBottomId !== altBottomId || bestShoeId !== altShoeId).toBe(true);
      }
    });
  });
});

