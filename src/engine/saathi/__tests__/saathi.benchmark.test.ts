import { describe, it, expect, vi } from 'vitest';
import { parseSaathiIntent } from '../intentParser';
import {
  mergeConversationEntities,
  resolveTargetDate,
  resolveSeasonForDate,
  resolveWardrobeGarment,
} from '../contextResolver';
import { saathiToolRegistry } from '../toolRegistry';
import { processSaathiTurn, createInitialConversationState } from '../orchestrationEngine';
import { SaathiToolContext, SaathiEntities } from '../types';
import { WardrobeItem, WeatherSnapshot, PersonalStyleProfile } from '../../../types';

function createMockItem(partial: Partial<WardrobeItem> & { id: string; name: string }): WardrobeItem {
  return {
    userId: 'user_1',
    favorite: false,
    note: '',
    timesWorn: 2,
    status: 'clean',
    category: 'Tops',
    subcategory: 'shirt',
    colors: ['white'],
    seasons: ['summer'],
    occasions: ['office', 'casual outing'],
    formality: 3,
    ...partial,
  };
}

describe('Phase 10: AI Saathi Performance Benchmarks', () => {
  const mockWardrobe: WardrobeItem[] = [
    createMockItem({
      id: 'item_white_shirt',
      name: 'Classic White Shirt',
      category: 'Tops',
      subcategory: 'shirt',
      colors: ['white'],
    }),
    createMockItem({
      id: 'item_blue_jeans',
      name: 'Blue Denim Jeans',
      category: 'Bottoms',
      subcategory: 'jeans',
      colors: ['blue'],
    }),
    createMockItem({
      id: 'item_black_trousers',
      name: 'Black Formal Trousers',
      category: 'Bottoms',
      subcategory: 'trousers',
      colors: ['black'],
    }),
  ];

  const mockWeather: WeatherSnapshot = {
    temperature: 26,
    condition: 'clear',
    conditionText: 'Sunny',
    feelsLike: 27,
    humidity: 50,
    windSpeed: 8,
    precipitationProbability: 0,
    uvIndex: 5,
    observedAt: 1791892800000,
    expiresAt: 1791896400000,
    source: 'live',
    location: { city: 'Bengaluru', country: 'IN', source: 'manual', latitude: 12.97, longitude: 77.59 },
  };

  const mockStyleProfile: PersonalStyleProfile = {
    colorAffinities: { white: 0.8 } as any,
    categoryWeights: { Tops: 1.0, Bottoms: 1.0 } as any,
    formalityPreference: 3 as any,
    fabricAffinities: {} as any,
    patternAffinities: {} as any,
    silhouetteAffinities: {} as any,
    brandAffinities: {} as any,
  } as unknown as PersonalStyleProfile;

  const mockContext: SaathiToolContext = {
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

  describe('Target: Intent Parsing < 1 ms', () => {
    it('executes intent parsing within sub-millisecond budget across repeated calls', () => {
      const query = 'What should I wear to office tomorrow with my white shirt?';

      // Warm-up
      for (let i = 0; i < 20; i++) parseSaathiIntent(query);

      const iterations = 500;
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        parseSaathiIntent(query);
      }
      const elapsed = performance.now() - start;
      const avgMs = elapsed / iterations;

      expect(avgMs).toBeLessThan(1.0);
    });
  });

  describe('Target: Context Resolution < 1 ms', () => {
    it('executes entity merging, date resolving and item disambiguation in < 1 ms', () => {
      const prior: SaathiEntities = { occasion: 'wedding guest', date: 'today' };
      const incoming: SaathiEntities = { color: 'white', garmentType: 'shirt' };

      // Warm-up
      for (let i = 0; i < 20; i++) {
        mergeConversationEntities(prior, incoming);
        resolveTargetDate('tomorrow', 1791892800000);
        resolveSeasonForDate('2026-10-14');
        resolveWardrobeGarment(incoming, mockWardrobe);
      }

      const iterations = 500;
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        mergeConversationEntities(prior, incoming);
        resolveTargetDate('tomorrow', 1791892800000);
        resolveSeasonForDate('2026-10-14');
        resolveWardrobeGarment(incoming, mockWardrobe);
      }
      const elapsed = performance.now() - start;
      const avgMs = elapsed / iterations;

      expect(avgMs).toBeLessThan(1.0);
    });
  });

  describe('Target: Tool Routing < 1 ms', () => {
    it('routes and validates domain tools in < 1 ms', () => {
      const iterations = 1000;
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        const tool = saathiToolRegistry.get('recommendOutfits');
        expect(tool).toBeDefined();
        expect(tool?.name).toBe('recommendOutfits');
      }
      const elapsed = performance.now() - start;
      const avgMs = elapsed / iterations;

      expect(avgMs).toBeLessThan(1.0);
    });
  });

  describe('Target: Local Orchestration < 5 ms', () => {
    it('orchestrates complete non-recommendation turns (weather, wardrobe, wear) in < 5 ms', async () => {
      const state = createInitialConversationState('bench_orch');
      const query = "What's the weather today?";

      // Warm-up
      await processSaathiTurn(query, state, mockContext);

      const iterations = 100;
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        await processSaathiTurn(query, state, mockContext);
      }
      const elapsed = performance.now() - start;
      const avgMs = elapsed / iterations;

      expect(avgMs).toBeLessThan(5.0);
    });
  });
});
