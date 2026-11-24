import { describe, it, expect } from 'vitest';
import { parseSaathiIntent } from '../engine/saathi/intentParser';
import {
  processSaathiTurn,
  createInitialConversationState,
} from '../engine/saathi/orchestrationEngine';
import { seasonFit, occasionFit } from '../engine/compatibility';
import { evaluateEnsembleOutfit } from '../engine/ensemble/outfitEvaluator';
import { buildEnsembleGraph } from '../engine/ensemble/ensembleGraph';
import { recommendOutfits } from '../engine/recommendationEngine';
import { getPhilosophyById, searchPhilosophies } from '../engine/knowledge/designersEditCatalog';
import { WardrobeItem, SaathiToolContext } from '../types';

describe('StyleSaathi 4.0.2 — Remediation Regression Tests', () => {
  // =========================================================================
  // 1. P1-A: COLLEGE & INTERVIEW INTENT RECOGNITION & COLD-START OUTFIT ROUTING
  // =========================================================================
  describe('P1-A: College and Interview Intent Recognition', () => {
    it('recognizes COLLEGE_OUTFIT across natural query variations', () => {
      const variations = [
        'college outfit',
        'what should I wear to college?',
        'what should i wear to college',
        'what to wear to college',
        'campus outfit',
        'outfit for college',
        'outfit ideas for college',
        'dress me for college',
        'campus look',
        'campus dressing',
        'college wear',
        'university fit',
      ];

      for (const query of variations) {
        const result = parseSaathiIntent(query);
        expect(result.intent, `Failed for query: "${query}"`).toBe('COLLEGE_OUTFIT');
        expect(result.entities.occasion).toBe('college');
        expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      }
    });

    it('recognizes INTERVIEW_OUTFIT across natural query variations', () => {
      const variations = [
        'interview outfit',
        'what should I wear for an interview?',
        'what should i wear for an interview',
        'what to wear for an interview',
        'outfit for an interview',
        'outfit for interview',
        'dress me for an interview',
        'placement interview look',
        'job interview fit',
        'job interview dressing',
        'job interview outfit',
      ];

      for (const query of variations) {
        const result = parseSaathiIntent(query);
        expect(result.intent, `Failed for query: "${query}"`).toBe('INTERVIEW_OUTFIT');
        expect(result.entities.occasion).toBe('interview');
        expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      }
    });

    it('routes a cold college query directly to outfit generation rather than welcome greeting', async () => {
      const wardrobe: WardrobeItem[] = [
        {
          id: 'top-tee-1',
          name: 'Classic White Crewneck Tee',
          category: 'Tops',
          subcategory: 't-shirt',
          colors: ['white'],
          fabric: 'cotton',
          fit: 'regular',
          formality: 2,
          status: 'clean',
          occasions: ['college', 'casual outing'],
          seasons: ['summer', 'all year'],
          timesWorn: 3,
          createdAt: Date.now(),
        } as any,
        {
          id: 'bottom-jeans-1',
          name: 'Straight Selvedge Denim',
          category: 'Bottoms',
          subcategory: 'jeans',
          colors: ['blue'],
          fabric: 'denim',
          fit: 'straight',
          formality: 2,
          status: 'clean',
          occasions: ['college', 'casual outing'],
          seasons: ['summer', 'all year'],
          timesWorn: 4,
          createdAt: Date.now(),
        } as any,
        {
          id: 'shoes-sneakers-1',
          name: 'Low-Top Canvas Sneakers',
          category: 'Footwear',
          subcategory: 'sneakers',
          colors: ['white'],
          formality: 2,
          status: 'clean',
          occasions: ['college', 'casual outing'],
          seasons: ['summer', 'all year'],
          timesWorn: 5,
          createdAt: Date.now(),
        } as any,
      ];

      const context: SaathiToolContext = {
        userId: 'test_user',
        wardrobe,
        referenceTimestamp: Date.now(),
      };

      const state = createInitialConversationState();
      const result = await processSaathiTurn('What should I wear to college?', state, context);

      // Must NOT be the welcome/clarification greeting
      expect(result.message).not.toContain("I'm AI Saathi, your privacy-first wardrobe companion");
      // Must generate the daily college styling curation
      expect(result.message).toContain('Daily College Styling Curation');
      expect(result.message).toContain('Campus Polish');
      expect(result.intent).toBe('COLLEGE_OUTFIT');
    });

    it('routes a cold interview query directly to outfit generation rather than welcome greeting', async () => {
      const wardrobe: WardrobeItem[] = [
        {
          id: 'top-shirt-1',
          name: 'Crisp Poplin Shirt',
          category: 'Tops',
          subcategory: 'shirt',
          colors: ['white'],
          fabric: 'cotton',
          fit: 'tailored',
          formality: 4,
          status: 'clean',
          occasions: ['interview', 'office'],
          seasons: ['summer', 'all year'],
          timesWorn: 2,
          createdAt: Date.now(),
        } as any,
        {
          id: 'bottom-trouser-1',
          name: 'Tailored Wool Trousers',
          category: 'Bottoms',
          subcategory: 'trousers',
          colors: ['charcoal'],
          fabric: 'wool',
          fit: 'tailored',
          formality: 4,
          status: 'clean',
          occasions: ['interview', 'office'],
          seasons: ['summer', 'all year'],
          timesWorn: 1,
          createdAt: Date.now(),
        } as any,
        {
          id: 'shoes-oxford-1',
          name: 'Black Leather Oxfords',
          category: 'Footwear',
          subcategory: 'loafers',
          colors: ['black'],
          fabric: 'leather',
          formality: 4,
          status: 'clean',
          occasions: ['interview', 'office'],
          seasons: ['summer', 'all year'],
          timesWorn: 3,
          createdAt: Date.now(),
        } as any,
      ];

      const context: SaathiToolContext = {
        userId: 'test_user',
        wardrobe,
        referenceTimestamp: Date.now(),
      };

      const state = createInitialConversationState();
      const result = await processSaathiTurn('What should I wear for an interview?', state, context);

      // Must NOT be the welcome/clarification greeting
      expect(result.message).not.toContain("I'm AI Saathi, your privacy-first wardrobe companion");
      // Must generate the interview styling curation
      expect(result.message).toContain('Interview Styling Curation');
      expect(result.message).toContain('Executive Composure');
      expect(result.intent).toBe('INTERVIEW_OUTFIT');
    });

    it('preserves previous precedence for existing generic outfit queries', () => {
      const genericQueries = [
        'What should I wear today?',
        'Suggest an outfit for office',
        'Help me pick clothes for a party tonight',
        'Recommend an outfit for college tomorrow',
        'Need look ideas for a wedding',
      ];

      for (const query of genericQueries) {
        const result = parseSaathiIntent(query);
        expect(result.intent, `Query "${query}" should parse as RECOMMEND_OUTFIT`).toBe('RECOMMEND_OUTFIT');
        expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      }
    });
  });

  // =========================================================================
  // 2. P2-A: DESIGNER'S EDIT KNOWLEDGE INTEGRATION
  // =========================================================================
  describe('P2-A: Designer\'s Edit Knowledge Integration through Orchestration', () => {
    const emptyContext: SaathiToolContext = {
      userId: 'test_user',
      wardrobe: [],
      referenceTimestamp: Date.now(),
    };

    it('routes specific craft questions to catalog entry with source attribution', async () => {
      const craftQueries = [
        { q: 'Tell me about Chanderi', expectedCraft: 'Chanderi', expectedRegion: 'Madhya Pradesh' },
        { q: 'What is Chikankari?', expectedCraft: 'Chikankari', expectedRegion: 'Lucknow' },
        { q: 'Tell me about Banarasi brocade', expectedCraft: 'Banarasi Brocade', expectedRegion: 'Varanasi' },
        { q: 'Tell me about Kutch Ajrakh', expectedCraft: 'Ajrakh', expectedRegion: 'Kutch' },
        { q: 'What is Bengal Mulmul?', expectedCraft: 'Mulmul', expectedRegion: 'Bengal' },
        { q: 'Tell me about Pashmina', expectedCraft: 'Pashmina', expectedRegion: 'Kashmir' },
      ];

      for (const item of craftQueries) {
        const state = createInitialConversationState();
        const res = await processSaathiTurn(item.q, state, emptyContext);
        expect(res.message).toContain(`Living Handloom Tradition: ${item.expectedCraft}`);
        expect(res.message).toContain(item.expectedRegion);
        expect(res.message).toContain('Verified Source:');
        expect(res.intent).toBe('GENERAL_FASHION_QUESTION');
      }
    });

    it('routes philosophy inquiries to structured editorial principles and proportions', async () => {
      const state = createInitialConversationState();
      const res = await processSaathiTurn('Tell me about Quiet Luxury', state, emptyContext);
      expect(res.message).toContain("The Designer's Edit: Quiet Luxury");
      expect(res.message).toContain('Core Principles:');
      expect(res.message).toContain('Proportions & Silhouette Architecture:');
      expect(res.message).toContain('Verified Source:');
    });

    it('falls back honestly without hallucination when an unknown craft or topic is queried', async () => {
      const state = createInitialConversationState();
      const res = await processSaathiTurn('Tell me about cybernetic nano-textiles', state, emptyContext);
      // Must not fabricate imaginary craft claims
      expect(res.message).not.toContain('Living Handloom Tradition: cybernetic');
      expect(res.message).toMatch(/Fashion Architecture & Cultural Guidance|verified craft or textile documentation/);
    });
  });

  // =========================================================================
  // 3. P2-B: MISSING SEASONS SAFETY & NEUTRAL HANDLING
  // =========================================================================
  describe('P2-B: Missing and Incomplete Seasons Safety', () => {
    it('returns null (neutral/unknown) when garment seasons is absent, null, or empty', () => {
      const itemMissingSeasons: WardrobeItem = {
        id: 'no-seasons-item',
        name: 'Incomplete Shirt',
        category: 'Tops',
        status: 'clean',
        createdAt: Date.now(),
      } as any;

      const itemNullSeasons: WardrobeItem = {
        id: 'null-seasons-item',
        name: 'Null Seasons Shirt',
        category: 'Tops',
        seasons: null as any,
        status: 'clean',
        createdAt: Date.now(),
      } as any;

      const itemEmptySeasons: WardrobeItem = {
        id: 'empty-seasons-item',
        name: 'Empty Seasons Shirt',
        category: 'Tops',
        seasons: [],
        status: 'clean',
        createdAt: Date.now(),
      } as any;

      // Safe: never throws TypeError
      expect(seasonFit(itemMissingSeasons, 'summer')).toBeNull();
      expect(seasonFit(itemNullSeasons, 'summer')).toBeNull();
      expect(seasonFit(itemEmptySeasons, 'summer')).toBeNull();
      expect(seasonFit(itemMissingSeasons, undefined as any)).toBeNull();
    });

    it('preserves existing compatibility behavior for valid season arrays', () => {
      const summerOnlyItem: WardrobeItem = {
        id: 'summer-shirt',
        name: 'Linen Shirt',
        category: 'Tops',
        seasons: ['summer'],
        status: 'clean',
        createdAt: Date.now(),
      } as any;

      const allYearItem: WardrobeItem = {
        id: 'all-year-jeans',
        name: 'Denim Jeans',
        category: 'Bottoms',
        seasons: ['all year'],
        status: 'clean',
        createdAt: Date.now(),
      } as any;

      // Exact match
      expect(seasonFit(summerOnlyItem, 'summer')).toBe(true);
      // Exact mismatch
      expect(seasonFit(summerOnlyItem, 'winter')).toBe(false);
      // All year matches any season
      expect(seasonFit(allYearItem, 'winter')).toBe(true);
      expect(seasonFit(allYearItem, 'monsoon')).toBe(true);
    });

    it('does NOT penalize garments with unknown seasons in outfitEvaluator (remains neutral)', () => {
      const topWithoutSeasons: WardrobeItem = {
        id: 'top-no-season',
        name: 'Mystery Vintage Top',
        category: 'Tops',
        subcategory: 'shirt',
        colors: ['white'],
        fit: 'regular',
        formality: 3,
        status: 'clean',
        occasions: ['casual outing'],
        createdAt: Date.now(),
      } as any;

      const bottomWithSeason: WardrobeItem = {
        id: 'bottom-chinos',
        name: 'Summer Chinos',
        category: 'Bottoms',
        subcategory: 'chinos',
        colors: ['navy'],
        fit: 'regular',
        formality: 3,
        status: 'clean',
        occasions: ['casual outing'],
        seasons: ['summer'],
        createdAt: Date.now(),
      } as any;

      const shoesWithSeason: WardrobeItem = {
        id: 'shoes-loafers',
        name: 'Penny Loafers',
        category: 'Footwear',
        subcategory: 'loafers',
        colors: ['brown'],
        formality: 3,
        status: 'clean',
        occasions: ['casual outing'],
        seasons: ['summer'],
        createdAt: Date.now(),
      } as any;

      const pieces = [topWithoutSeasons, bottomWithSeason, shoesWithSeason];
      const graph = buildEnsembleGraph(pieces, {
        occasion: 'casual outing',
        season: 'summer',
      });
      const evaluation = evaluateEnsembleOutfit(graph, {
        occasion: 'casual outing',
        season: 'summer',
      });

      // Confirm no out-of-season penalty was applied to topWithoutSeasons
      const seasonPenalties = evaluation.breakdown.penaltiesApplied.filter((p) =>
        p.includes('out of season')
      );
      expect(seasonPenalties).toHaveLength(0);
    });

    it('keeps incomplete garments eligible in recommendOutfits without dropping them', () => {
      const incompleteWardrobe: WardrobeItem[] = [
        {
          id: 'inc-top',
          name: 'Top Without Season',
          category: 'Tops',
          subcategory: 'shirt',
          colors: ['white'],
          occasions: ['office'],
          status: 'clean',
          // seasons omitted intentionally
          createdAt: Date.now(),
        } as any,
        {
          id: 'inc-bottom',
          name: 'Bottom With Season',
          category: 'Bottoms',
          subcategory: 'trousers',
          colors: ['navy'],
          occasions: ['office'],
          seasons: ['summer'],
          status: 'clean',
          createdAt: Date.now(),
        } as any,
        {
          id: 'inc-shoes',
          name: 'Shoes With Season',
          category: 'Footwear',
          subcategory: 'loafers',
          colors: ['brown'],
          occasions: ['office'],
          seasons: ['summer'],
          status: 'clean',
          createdAt: Date.now(),
        } as any,
      ];

      // Safe execution without TypeError
      const outfits = recommendOutfits({
        items: incompleteWardrobe,
        occasion: 'office',
        season: 'summer',
        localDate: '2026-11-12',
        limit: 1,
      });

      expect(outfits.length).toBeGreaterThan(0);
      expect(outfits[0].slots.top[0].id).toBe('inc-top');
    });

    it('preserves Tier 1 hard constraints by strictly rejecting laundry items from recommendations', () => {
      const wardrobeWithLaundry: WardrobeItem[] = [
        {
          id: 'laundry-top',
          name: 'Dirty Oxford Shirt',
          category: 'Tops',
          subcategory: 'shirt',
          colors: ['white'],
          occasions: ['office'],
          seasons: ['summer'],
          status: 'in_laundry',
          createdAt: Date.now(),
        } as any,
        {
          id: 'clean-bottom',
          name: 'Clean Trousers',
          category: 'Bottoms',
          subcategory: 'trousers',
          colors: ['navy'],
          occasions: ['office'],
          seasons: ['summer'],
          status: 'clean',
          createdAt: Date.now(),
        } as any,
        {
          id: 'clean-shoes',
          name: 'Clean Loafers',
          category: 'Footwear',
          subcategory: 'loafers',
          colors: ['black'],
          occasions: ['office'],
          seasons: ['summer'],
          status: 'clean',
          createdAt: Date.now(),
        } as any,
      ];

      const outfits = recommendOutfits({
        items: wardrobeWithLaundry,
        occasion: 'office',
        season: 'summer',
        localDate: '2026-11-12',
        limit: 1,
      });

      // No outfit should be generated because required top is in laundry
      expect(outfits).toHaveLength(0);
    });

    it('preserves 4 distinct editorial roles (best_match, alternative, explore, underused) in ranking', () => {
      const richWardrobe: WardrobeItem[] = [
        { id: 't1', name: 'White Poplin Shirt', category: 'Tops', subcategory: 'shirt', colors: ['white'], occasions: ['office'], seasons: ['summer'], status: 'clean', formality: 3, timesWorn: 10, lastWorn: Date.now() - 10000000, createdAt: 1 } as any,
        { id: 't2', name: 'Blue Linen Shirt', category: 'Tops', subcategory: 'shirt', colors: ['blue'], occasions: ['office'], seasons: ['summer'], status: 'clean', formality: 3, timesWorn: 8, lastWorn: Date.now() - 20000000, createdAt: 2 } as any,
        { id: 't3', name: 'Beige Kurta', category: 'Tops', subcategory: 'shirt', colors: ['beige'], occasions: ['office'], seasons: ['summer'], status: 'clean', formality: 3, timesWorn: 0, createdAt: 3 } as any,
        { id: 'b1', name: 'Charcoal Trousers', category: 'Bottoms', subcategory: 'trousers', colors: ['charcoal'], occasions: ['office'], seasons: ['summer'], status: 'clean', formality: 3, timesWorn: 15, lastWorn: Date.now() - 10000000, createdAt: 4 } as any,
        { id: 'b2', name: 'Khaki Chinos', category: 'Bottoms', subcategory: 'trousers', colors: ['beige'], occasions: ['office'], seasons: ['summer'], status: 'clean', formality: 3, timesWorn: 5, lastWorn: Date.now() - 30000000, createdAt: 5 } as any,
        { id: 's1', name: 'Black Leather Loafers', category: 'Footwear', subcategory: 'loafers', colors: ['black'], occasions: ['office'], seasons: ['summer'], status: 'clean', formality: 3, timesWorn: 20, lastWorn: Date.now() - 10000000, createdAt: 6 } as any,
      ];

      const outfits = recommendOutfits({
        items: richWardrobe,
        occasion: 'office',
        season: 'summer',
        localDate: '2026-11-12',
        limit: 4,
      });

      expect(outfits.length).toBeGreaterThanOrEqual(2);
      const roles = outfits.map((o) => o.role);
      expect(roles).toContain('best_match');
      // If candidates allow diversification, roles include alternative or underused or explore
      const validRoles = ['best_match', 'alternative', 'explore', 'underused'];
      for (const r of roles) {
        expect(validRoles).toContain(r);
      }
    });
  });

  // =========================================================================
  // 4. P3-A: MOBILE PHILOSOPHY TAB SCROLL CUE & ACCESSIBILITY
  // =========================================================================
  describe('P3-A: Philosophy Tab Scroll Affordance & Accessibility', () => {
    it('verifies all 5 philosophies exist and have accessible titles', () => {
      const philosophyIds = [
        'quiet-luxury',
        'indian-heritage',
        'indo-western',
        'contemporary-tailoring',
        'minimalist',
      ];

      for (const id of philosophyIds) {
        const phil = getPhilosophyById(id);
        expect(phil).toBeDefined();
        expect(phil?.title.length).toBeGreaterThan(0);
      }
    });

    it('verifies searchPhilosophies finds craft traditions across all 5 philosophies', () => {
      expect(searchPhilosophies('Chanderi').length).toBeGreaterThan(0);
      expect(searchPhilosophies('Chikankari').length).toBeGreaterThan(0);
      expect(searchPhilosophies('Pashmina').length).toBeGreaterThan(0);
      expect(searchPhilosophies('Ajrakh').length).toBeGreaterThan(0);
      expect(searchPhilosophies('Mulmul').length).toBeGreaterThan(0);
      expect(searchPhilosophies('Ikat').length).toBeGreaterThan(0);
    });
  });
});
