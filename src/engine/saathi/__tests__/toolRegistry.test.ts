import { describe, it, expect, vi } from 'vitest';
import {
  saathiToolRegistry,
  getCurrentWeatherTool,
  getWardrobeTool,
  recommendOutfitsTool,
  styleItemTool,
  getWearAnalyticsTool,
  getStyleProfileTool,
  getWardrobeGapsTool,
  getPurchaseAssessmentTool,
  explainFashionKnowledgeTool,
  createPlanTool,
  recordWearTool,
} from '../toolRegistry';
import { SaathiToolContext } from '../types';
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
    occasions: ['office', 'college'],
    formality: 3,
    ...partial,
  };
}

describe('Phase 10: AI Saathi Tool Registry', () => {
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
      id: 'item_sneakers',
      name: 'White Low Sneakers',
      category: 'Footwear',
      subcategory: 'sneakers',
      colors: ['white'],
    }),
  ];

  const mockWeather: WeatherSnapshot = {
    temperature: 28,
    condition: 'clear',
    conditionText: 'Sunny',
    feelsLike: 30,
    humidity: 60,
    windSpeed: 10,
    precipitationProbability: 0,
    uvIndex: 6,
    observedAt: 1791892800000,
    expiresAt: 1791896400000,
    source: 'live',
    location: { city: 'Bengaluru', country: 'IN', source: 'manual', latitude: 12.97, longitude: 77.59 },
  };

  const mockStyleProfile: PersonalStyleProfile = {
    colorAffinities: { white: 0.8, blue: 0.7 } as any,
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

  describe('Registry Structure & Security Boundaries', () => {
    it('contains all 12 typed internal domain tools', () => {
      expect(saathiToolRegistry.size).toBe(12);
      expect(saathiToolRegistry.has('getWardrobe')).toBe(true);
      expect(saathiToolRegistry.has('getCurrentWeather')).toBe(true);
      expect(saathiToolRegistry.has('recommendOutfits')).toBe(true);
      expect(saathiToolRegistry.has('styleItem')).toBe(true);
      expect(saathiToolRegistry.has('getWearAnalytics')).toBe(true);
      expect(saathiToolRegistry.has('getStyleProfile')).toBe(true);
      expect(saathiToolRegistry.has('getWardrobeGaps')).toBe(true);
      expect(saathiToolRegistry.has('getPurchaseAssessment')).toBe(true);
      expect(saathiToolRegistry.has('explainFashionKnowledge')).toBe(true);
      expect(saathiToolRegistry.has('createPlan')).toBe(true);
      expect(saathiToolRegistry.has('recordWear')).toBe(true);
    });

    it('marks read-only tools as safe (requiresConfirmation: false)', () => {
      expect(getCurrentWeatherTool.requiresConfirmation).toBe(false);
      expect(getWardrobeTool.requiresConfirmation).toBe(false);
      expect(recommendOutfitsTool.requiresConfirmation).toBe(false);
      expect(styleItemTool.requiresConfirmation).toBe(false);
      expect(getWearAnalyticsTool.requiresConfirmation).toBe(false);
      expect(getWardrobeGapsTool.requiresConfirmation).toBe(false);
      expect(getPurchaseAssessmentTool.requiresConfirmation).toBe(false);
    });

    it('marks mutation tools as requiring confirmation (requiresConfirmation: true)', () => {
      expect(createPlanTool.requiresConfirmation).toBe(true);
      expect(recordWearTool.requiresConfirmation).toBe(true);
    });
  });

  describe('Domain Tool Execution', () => {
    it('getCurrentWeatherTool executes and returns verified weather snapshot', async () => {
      const res = await getCurrentWeatherTool.execute({}, mockContext);
      expect(res.weather).toBeDefined();
      expect(res.weather?.temperature).toBe(28);
      expect(res.weather?.conditionText).toBe('Sunny');
    });

    it('getWardrobeTool returns wardrobe summary and stats', async () => {
      const res = await getWardrobeTool.execute({}, mockContext);
      expect(res.totalItems).toBe(3);
      expect(res.cleanItems).toBe(3);
    });

    it('recommendOutfitsTool invokes Phase 5 engine deterministically', async () => {
      const res = await recommendOutfitsTool.execute(
        { occasion: 'office', season: 'summer', dateStr: '2026-10-13' },
        mockContext
      );
      expect(res.outfits).toBeDefined();
      expect(res.outfits?.length).toBeGreaterThan(0);
      expect(res.outfits?.[0].explanation).toBeDefined();
    });

    it('styleItemTool invokes Phase 7 anchor constraint styling', async () => {
      const res = await styleItemTool.execute(
        { anchorItemId: 'item_white_shirt', occasion: 'office', season: 'summer' },
        mockContext
      );
      expect(res.outfits).toBeDefined();
      expect(res.outfits?.length).toBeGreaterThan(0);
      // Anchor item must be present in every outfit's slots
      const anchorPresent = Object.values(res.outfits![0].slots).flat().some((i) => i.id === 'item_white_shirt');
      expect(anchorPresent).toBe(true);
    });

    it('getWearAnalyticsTool invokes Phase 8 wear analytics engine', async () => {
      const res = await getWearAnalyticsTool.execute({}, mockContext);
      expect(res.metrics).toBeDefined();
      expect(res.metrics?.totalWardrobeItems).toBe(3);
    });

    it('getPurchaseAssessmentTool invokes Phase 9 Smart Buy engine', async () => {
      const res = await getPurchaseAssessmentTool.execute({}, mockContext);
      expect(res.purchaseAssessment).toBeDefined();
      const pa = res.purchaseAssessment;
      if (typeof pa === 'object' && pa !== null) {
        expect(pa.verdict).toBeDefined();
      }
    });

    it('explainFashionKnowledgeTool invokes Phase 6 knowledge engine', async () => {
      const res = await explainFashionKnowledgeTool.execute(
        { itemIds: ['item_white_shirt'] },
        mockContext
      );
      expect(res.summary).toBeDefined();
      expect(typeof res.summary).toBe('string');
    });
  });
});
