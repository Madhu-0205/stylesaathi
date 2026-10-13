import { describe, it, expect, vi } from 'vitest';
import { processSaathiTurn, createInitialConversationState } from '../orchestrationEngine';
import { SaathiToolContext } from '../types';
import { WardrobeItem, PersonalStyleProfile } from '../../../types';

function createMockItem(partial: Partial<WardrobeItem> & { id: string; name: string }): WardrobeItem {
  return {
    userId: 'user_1',
    favorite: false,
    note: '',
    timesWorn: 1,
    status: 'clean',
    category: 'Tops',
    subcategory: 'shirt',
    colors: ['white'],
    seasons: ['summer'],
    occasions: ['office'],
    formality: 3,
    ...partial,
  };
}

describe('Phase 10: AI Saathi Safety, Privacy & Security Invariants', () => {
  const baseWardrobe: WardrobeItem[] = [
    createMockItem({
      id: 'item_1',
      name: 'White Cotton Shirt',
      category: 'Tops',
      subcategory: 'shirt',
      colors: ['white'],
    }),
    createMockItem({
      id: 'item_2',
      name: 'Black Chino Trousers',
      category: 'Bottoms',
      subcategory: 'trousers',
      colors: ['black'],
    }),
  ];

  const baseStyleProfile: PersonalStyleProfile = {
    colorAffinities: {} as any,
    categoryWeights: {} as any,
    formalityPreference: 3 as any,
    fabricAffinities: {} as any,
    patternAffinities: {} as any,
    silhouetteAffinities: {} as any,
    brandAffinities: {} as any,
  } as unknown as PersonalStyleProfile;

  const createSafeContext = (overrides?: Partial<SaathiToolContext>): SaathiToolContext => ({
    wardrobe: baseWardrobe,
    weather: null, // Weather unavailable by default to test safety
    styleProfile: baseStyleProfile,
    wearLogs: [],
    outfitPlans: [],
    referenceTimestamp: 1791892800000,
    wardrobeRepo: {
      getItems: vi.fn().mockResolvedValue(baseWardrobe),
      getItem: vi.fn(),
      addItem: vi.fn(),
      updateItem: vi.fn(),
      deleteItem: vi.fn(),
      getSavedOutfits: vi.fn().mockResolvedValue([]),
      saveOutfit: vi.fn(),
      deleteSavedOutfit: vi.fn(),
      clear: vi.fn(),
    },
    outfitPlanRepo: {
      getPlans: vi.fn().mockResolvedValue([]),
      getPlanByDate: vi.fn().mockResolvedValue(null),
      addPlan: vi.fn(),
      updatePlan: vi.fn(),
      deletePlan: vi.fn(),
    },
    wearLogRepo: {
      getLogs: vi.fn().mockResolvedValue([]),
      getLogsForItem: vi.fn().mockResolvedValue([]),
      addLog: vi.fn(),
      deleteLog: vi.fn(),
    },
    ...overrides,
  });

  describe('Section 18 & 3: Weather Safety Invariant (Never Fabricate Weather)', () => {
    it('reports weather unavailable when weather snapshot is null and never fabricates numbers', async () => {
      const context = createSafeContext({ weather: null });
      const state = createInitialConversationState('weather_test');

      const res = await processSaathiTurn("What's the weather today?", state, context);

      expect(res.intent).toBe('CHECK_WEATHER');
      expect(res.message).toContain("can't verify the current weather");
      // Must not invent temperature degrees or conditions
      expect(res.message).not.toMatch(/\d+°C/);
      expect(res.message).not.toContain('Sunny');
      expect(res.message).not.toContain('Rainy');
    });
  });

  describe('Section 3: Wardrobe Safety Invariant (Never Invent Clothes)', () => {
    it('reports item not found when user asks to style non-existent garment and never invents clothes', async () => {
      const context = createSafeContext();
      const state = createInitialConversationState('missing_item_test');

      const res = await processSaathiTurn('Style my purple tuxedo for wedding', state, context);

      expect(res.intent).toBe('STYLE_ITEM');
      expect(res.message).toContain("couldn't find");
      expect(res.domainResult?.outfits).toBeUndefined();
    });
  });

  describe('Section 4: No Shopping Agent Boundary', () => {
    it('never contains commercial shopping links, affiliate tags, or product URLs', async () => {
      const context = createSafeContext();
      const state = createInitialConversationState('no_shopping_test');

      const queries = [
        'Do I need to buy anything?',
        'Where can I buy a cheap blazer?',
        'Show me products to purchase',
        'Recommend items on Amazon or Myntra',
      ];

      for (const query of queries) {
        const res = await processSaathiTurn(query, state, context);
        expect(res.message).not.toMatch(/https?:\/\//i);
        expect(res.message).not.toMatch(/amazon|myntra|flipkart|ajio|zara/i);
        expect(res.message).not.toMatch(/buy now|shop here|add to cart/i);
      }
    });
  });

  describe('Section 17: Zero-Demand Safety Invariant', () => {
    it('never manufactures demand or occasion gaps when user has zero declared plans', async () => {
      const context = createSafeContext({
        outfitPlans: [],
        styleProfile: baseStyleProfile,
      });
      const state = createInitialConversationState('zero_demand_test');

      const res = await processSaathiTurn('Do I need to buy anything for my wardrobe?', state, context);

      expect(res.intent).toBe('ASSESS_PURCHASE_NEED');
      const assessment = res.domainResult?.purchaseAssessment;
      expect(assessment).toBeDefined();
      // Without declared demand, Smart Buy engine does NOT invent occasion gaps
      if (typeof assessment === 'object' && assessment !== null) {
        expect(assessment.occasionGaps).toHaveLength(0);
      }
    });
  });

  describe('Section 21: Determinism Invariant', () => {
    it('produces identical structured responses for identical inputs and context state', async () => {
      const context = createSafeContext({
        weather: {
          temperature: 25,
          condition: 'clear',
          conditionText: 'Clear',
          feelsLike: 25,
          humidity: 50,
          windSpeed: 5,
          precipitationProbability: 0,
          isRainy: false,
          uvIndex: 4,
          recordedAt: '2026-10-13T10:00:00Z',
        },
      });

      const state1 = createInitialConversationState('det_1');
      const state2 = createInitialConversationState('det_2');

      const res1 = await processSaathiTurn('What should I wear to office today?', state1, context);
      const res2 = await processSaathiTurn('What should I wear to office today?', state2, context);

      expect(res1.message).toBe(res2.message);
      expect(res1.intent).toBe(res2.intent);
      expect(res1.domainResult?.outfits?.length).toBe(res2.domainResult?.outfits?.length);
    });
  });

  describe('Section 13 & 28: Security & Mutation Authority Boundary', () => {
    it('read queries never trigger repository mutations', async () => {
      const context = createSafeContext();
      const state = createInitialConversationState('read_safety_test');

      const readQueries = [
        'What should I wear?',
        'Show my wardrobe',
        'Show my wear analytics',
        'What are my wardrobe gaps?',
        'Explain fashion pairing',
      ];

      for (const query of readQueries) {
        await processSaathiTurn(query, state, context);
        expect(context.wardrobeRepo.addItem).not.toHaveBeenCalled();
        expect(context.wardrobeRepo.updateItem).not.toHaveBeenCalled();
        expect(context.wardrobeRepo.deleteItem).not.toHaveBeenCalled();
        expect(context.outfitPlanRepo.addPlan).not.toHaveBeenCalled();
        expect(context.wearLogRepo.addLog).not.toHaveBeenCalled();
      }
    });
  });
});
