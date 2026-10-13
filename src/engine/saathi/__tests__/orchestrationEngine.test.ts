import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createInitialConversationState,
  processSaathiTurn,
} from '../orchestrationEngine';
import { SaathiToolContext } from '../types';
import { WardrobeItem, WeatherSnapshot, PersonalStyleProfile } from '../../../types';

function createMockItem(partial: Partial<WardrobeItem> & { id: string; name: string }): WardrobeItem {
  return {
    userId: 'user_1',
    favorite: false,
    note: '',
    timesWorn: 3,
    status: 'clean',
    category: 'Tops',
    subcategory: 'shirt',
    colors: ['white'],
    seasons: ['summer', 'monsoon', 'winter'],
    occasions: ['office', 'college', 'casual outing'],
    formality: 3,
    ...partial,
  };
}

describe('Phase 10: AI Saathi Orchestration Engine (Multi-Turn)', () => {
  const mockWardrobe: WardrobeItem[] = [
    createMockItem({
      id: 'item_white_shirt',
      name: 'Classic White Shirt',
      category: 'Tops',
      subcategory: 'shirt',
      colors: ['white'],
      fabric: 'cotton',
    }),
    createMockItem({
      id: 'item_blue_shirt_1',
      name: 'Navy Blue Linen Shirt',
      category: 'Tops',
      subcategory: 'shirt',
      colors: ['blue', 'navy'],
      fabric: 'linen',
    }),
    createMockItem({
      id: 'item_blue_shirt_2',
      name: 'Light Blue Formal Shirt',
      category: 'Tops',
      subcategory: 'shirt',
      colors: ['blue', 'light blue'],
      fabric: 'cotton',
    }),
    createMockItem({
      id: 'item_black_trousers',
      name: 'Slim Black Trousers',
      category: 'Bottoms',
      subcategory: 'trousers',
      colors: ['black'],
    }),
    createMockItem({
      id: 'item_loafers',
      name: 'Brown Leather Loafers',
      category: 'Footwear',
      subcategory: 'loafers',
      colors: ['brown'],
    }),
  ];

  const mockWeather: WeatherSnapshot = {
    temperature: 27,
    condition: 'clear',
    conditionText: 'Sunny',
    feelsLike: 29,
    humidity: 55,
    windSpeed: 12,
    precipitationProbability: 0,
    uvIndex: 5,
    observedAt: 1791892800000,
    expiresAt: 1791896400000,
    source: 'live',
    location: { city: 'Bengaluru', country: 'IN', source: 'manual', latitude: 12.97, longitude: 77.59 },
  };

  const mockStyleProfile: PersonalStyleProfile = {
    colorAffinities: { white: 0.9, black: 0.8 } as any,
    categoryWeights: { Tops: 1.0, Bottoms: 1.0 } as any,
    formalityPreference: 3 as any,
    fabricAffinities: {} as any,
    patternAffinities: {} as any,
    silhouetteAffinities: {} as any,
    brandAffinities: {} as any,
  } as unknown as PersonalStyleProfile;

  let mockContext: SaathiToolContext;

  beforeEach(() => {
    mockContext = {
      wardrobe: mockWardrobe,
      weather: mockWeather,
      styleProfile: mockStyleProfile,
      wearLogs: [],
      outfitPlans: [],
      referenceTimestamp: 1791892800000,
      wardrobeRepo: {
        getItems: vi.fn().mockResolvedValue(mockWardrobe),
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
    };
  });

  describe('Multi-Turn Clarification and Inheritance Flow', () => {
    it('executes a 3-turn conversation preserving context without re-prompting', async () => {
      let state = createInitialConversationState('conv_123');

      // -------------------------------------------------------------
      // Turn 1: "What should I wear tomorrow?"
      // Expected: Clarification required because occasion is not specified
      // -------------------------------------------------------------
      const turn1 = await processSaathiTurn('What should I wear tomorrow?', state, mockContext);
      state = turn1.updatedState;

      expect(turn1.clarification).toBeDefined();
      expect(turn1.clarification?.question).toContain('occasion');
      expect(state.resolvedEntities.date).toBe('tomorrow');

      // -------------------------------------------------------------
      // Turn 2: User responds with occasion: "College presentation"
      // Expected: Inherits date "tomorrow", resolves occasion, generates recommendation
      // -------------------------------------------------------------
      const turn2 = await processSaathiTurn('College presentation', state, mockContext);
      state = turn2.updatedState;

      expect(turn2.clarification).toBeUndefined();
      expect(state.resolvedEntities.date).toBe('tomorrow');
      expect(state.resolvedEntities.occasion).toBe('college');
      expect(turn2.domainResult?.outfits).toBeDefined();
      expect(turn2.domainResult!.outfits!.length).toBeGreaterThan(0);

      // -------------------------------------------------------------
      // Turn 3: "Can I wear my white shirt?"
      // Expected: Dispatches to STYLE_ITEM with white shirt anchor, inheriting occasion & date!
      // -------------------------------------------------------------
      const turn3 = await processSaathiTurn('Can I wear my white shirt?', state, mockContext);
      state = turn3.updatedState;

      expect(turn3.intent).toBe('STYLE_ITEM');
      expect(state.resolvedEntities.wardrobeItemId).toBe('item_white_shirt');
      expect(turn3.domainResult?.outfits).toBeDefined();
      expect(turn3.message).toContain('White Shirt');
    });

    it('requires clarification when user mentions an ambiguous item (2 blue shirts)', async () => {
      const state = createInitialConversationState('conv_ambiguous');

      const res = await processSaathiTurn('Style my blue shirt', state, mockContext);

      expect(res.clarification).toBeDefined();
      expect(res.clarification?.options).toBeDefined();
      expect(res.clarification?.options?.length).toBe(2);
      expect(res.clarification?.options?.map((o) => o.label)).toContain('Navy Blue Linen Shirt');
      expect(res.clarification?.options?.map((o) => o.label)).toContain('Light Blue Formal Shirt');
    });
  });

  describe('Mutation Confirmation Flow (Security Gate)', () => {
    it('demands confirmation before planning outfit and does not mutate repository prematurely', async () => {
      let state = createInitialConversationState('conv_plan');

      // Turn 1: Get recommendation
      const rec = await processSaathiTurn('What should I wear to office today?', state, mockContext);
      state = rec.updatedState;

      // Turn 2: Request planning
      const planRes = await processSaathiTurn('Plan this outfit for tomorrow', state, mockContext);
      state = planRes.updatedState;

      expect(planRes.confirmation).toBeDefined();
      expect(planRes.confirmation?.status).toBe('pending');
      expect(planRes.confirmation?.actionType).toBe('PLAN_OUTFIT');

      // Crucial: Repo must NOT have been called yet!
      expect(mockContext.outfitPlanRepo.addPlan).not.toHaveBeenCalled();
    });
  });

  describe('Smart Buy & Gap Intelligence Delegation', () => {
    it('delegates "Do I need to buy anything?" directly to Phase 9 and does not invent shopping links', async () => {
      const state = createInitialConversationState('conv_smart_buy');

      const res = await processSaathiTurn('Do I need to buy anything for my wardrobe?', state, mockContext);

      expect(res.intent).toBe('ASSESS_PURCHASE_NEED');
      expect(res.domainResult?.purchaseAssessment).toBeDefined();
      // Must not contain any ecommerce URL or commercial pricing
      expect(res.message).not.toContain('http');
      expect(res.message).not.toContain('amazon');
      expect(res.message).not.toContain('myntra');
      expect(res.message).not.toContain('affiliate');
    });
  });

  describe('Recommendation Explanation Delegation', () => {
    it('explains reasons using Phase 5 telemetry without fabricating reasons', async () => {
      let state = createInitialConversationState('conv_explain');

      // Generate recommendation first
      const rec = await processSaathiTurn('Recommend an office look', state, mockContext);
      state = rec.updatedState;

      const explainRes = await processSaathiTurn('Why did you recommend this?', state, mockContext);

      expect(explainRes.intent).toBe('EXPLAIN_RECOMMENDATION');
      expect(explainRes.message).toContain('why');
    });
  });
});
