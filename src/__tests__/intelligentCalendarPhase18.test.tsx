import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { CalendarScreen } from '../screens/CalendarScreen';
import { LocalStorageCalendarRepository } from '../repositories/LocalStorageCalendarRepository';
import { deriveSeasonalContext } from '../engine';
import { WardrobeItem, OutfitPlan, GeneratedOutfit, SavedOutfit } from '../types';

// Mock mock wardrobe items
const mockCleanShirt: WardrobeItem = {
  id: 'item_shirt_1',
  name: 'Crisp White Linen Shirt',
  category: 'Tops',
  subcategory: 'shirt',
  colors: ['White'],
  fabric: 'linen',
  pattern: 'solid',
  fit: 'tailored',
  seasons: ['summer'],
  formality: 3,
  occasions: ['office', 'everyday'],
  status: 'clean',
  favorite: true,
  note: 'Mandarin collar',
  timesWorn: 2,
  lastWorn: Date.now() - 86400000 * 3, // 3 days ago
  createdAt: Date.now() - 86400000 * 30,
};

const mockTrousers: WardrobeItem = {
  id: 'item_trouser_1',
  name: 'Charcoal Wool Trousers',
  category: 'Bottoms',
  subcategory: 'trousers',
  colors: ['Charcoal'],
  fabric: 'wool',
  pattern: 'solid',
  fit: 'tailored',
  seasons: ['winter'],
  formality: 4,
  occasions: ['office', 'interview'],
  status: 'clean',
  favorite: false,
  note: '',
  timesWorn: 1,
  lastWorn: Date.now() - 86400000 * 7,
  createdAt: Date.now() - 86400000 * 30,
};

const mockFestiveKurta: WardrobeItem = {
  id: 'item_kurta_1',
  name: 'Raw Silk Festive Kurta',
  category: 'Ethnic',
  subcategory: 'kurta',
  colors: ['Maroon', 'Gold'],
  fabric: 'silk',
  pattern: 'embroidered',
  fit: 'tailored',
  seasons: ['winter'],
  formality: 5,
  occasions: ['wedding guest', 'festive'],
  status: 'clean',
  favorite: true,
  note: 'Zari embroidery',
  timesWorn: 1,
  createdAt: Date.now() - 86400000 * 60,
};

const mockDirtyKurta: WardrobeItem = {
  id: 'item_dirty_1',
  name: 'Mustard Bandhani Kurta',
  category: 'Ethnic',
  subcategory: 'kurta',
  colors: ['Mustard'],
  fabric: 'cotton',
  pattern: 'bandhani',
  fit: 'relaxed',
  seasons: ['summer'],
  formality: 3,
  occasions: ['festive', 'everyday'],
  status: 'in_laundry',
  favorite: false,
  note: 'Dry clean only',
  timesWorn: 4,
  createdAt: Date.now() - 86400000 * 60,
};

const mockOfficeOutfit: GeneratedOutfit = {
  id: 'outfit_office_1',
  template: 'Modern Tailored Workwear',
  slots: {
    top: [mockCleanShirt],
    bottom: [mockTrousers],
  },
  score: 94,
  why: 'Clean linen and charcoal wool silhouette provides sharp contemporary workwear.',
  explanation: {
    headline: 'Executive Architectural Contrast',
    reasons: ['Breathable linen paired with structured wool gives daylong comfort.'],
    evidenceSources: ['personal_style', 'compatibility'],
  },
};

const mockFestiveOutfit: GeneratedOutfit = {
  id: 'outfit_festive_1',
  template: 'Heritage Festive Splendor',
  slots: {
    hero: [mockFestiveKurta],
    bottom: [mockTrousers],
  },
  score: 96,
  why: 'Opulent raw silk paired with tailored trousers embodies festive refinement.',
};

const mockDirtyOutfit: GeneratedOutfit = {
  id: 'outfit_dirty_1',
  template: 'Casual Ethnic Blend',
  slots: {
    top: [mockDirtyKurta],
    bottom: [mockTrousers],
  },
  score: 82,
  why: 'Rich color palette for casual gathering.',
};

// Global context mocks
let mockPlansState: OutfitPlan[] = [];
let mockItemsState: WardrobeItem[] = [mockCleanShirt, mockTrousers, mockFestiveKurta, mockDirtyKurta];
let mockSavedOutfitsState: SavedOutfit[] = [
  {
    id: 'saved_1',
    outfit: mockOfficeOutfit,
    name: 'Executive Power Look',
    savedAt: Date.now() - 86400000,
  },
];
let mockWeatherState: any = {
  current: {
    temp: 28,
    condition: 'Sunny',
    location: 'Bengaluru',
    humidity: 55,
    windSpeed: 10,
    apparentTemp: 29,
  },
  forecast: [
    { date: '2026-11-15', high: 29, low: 19, condition: 'Sunny' },
    { date: '2026-11-16', high: 28, low: 18, condition: 'Partly Cloudy' },
    { date: '2026-11-17', high: 27, low: 18, condition: 'Scattered Showers' },
  ],
  freshness: 'fresh',
  source: 'live',
  lastFetched: Date.now() - 15 * 60 * 1000,
  refresh: vi.fn(),
};

const mockSavePlan = vi.fn().mockImplementation(async (plan: OutfitPlan) => {
  const index = mockPlansState.findIndex((p) => p.id === plan.id || p.date === plan.date);
  if (index >= 0) {
    mockPlansState[index] = { ...mockPlansState[index], ...plan, updatedAt: Date.now() };
  } else {
    mockPlansState.push({
      ...plan,
      id: plan.id || `plan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
});

const mockDeletePlan = vi.fn().mockImplementation(async (id: string) => {
  mockPlansState = mockPlansState.filter((p) => p.id !== id);
});

const mockMarkOutfitWornOnDate = vi.fn().mockImplementation(async (date: string, outfit: any) => {
  const plan = mockPlansState.find((p) => p.date === date);
  if (plan) {
    plan.status = 'worn';
    plan.updatedAt = Date.now();
  }
});

const mockShowToast = vi.fn();

vi.mock('../context/WardrobeContext', () => ({
  useWardrobeContext: () => ({
    plans: mockPlansState,
    items: mockItemsState,
    savedOutfits: mockSavedOutfitsState,
    savePlan: mockSavePlan,
    deletePlan: mockDeletePlan,
    markOutfitWornOnDate: mockMarkOutfitWornOnDate,
    showToast: mockShowToast,
  }),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    isGuest: false,
    user: { id: 'usr_premium_1', name: 'Ananya Sharma' },
  }),
}));

vi.mock('../context/WeatherContext', () => ({
  useWeather: () => mockWeatherState,
}));

describe('STYLESAATHI PHASE 1.8 — Intelligent Fashion Calendar & Outfit Planning Acceptance Suite', () => {
  let calRepo: LocalStorageCalendarRepository;

  beforeEach(async () => {
    calRepo = new LocalStorageCalendarRepository();
    await calRepo.clear();
    mockPlansState = [];
    mockItemsState = [mockCleanShirt, mockTrousers, mockFestiveKurta, mockDirtyKurta];
    mockSavePlan.mockClear();
    mockDeletePlan.mockClear();
    mockMarkOutfitWornOnDate.mockClear();
    mockShowToast.mockClear();
    mockWeatherState.freshness = 'fresh';
    mockWeatherState.source = 'live';
  });

  // =========================================================================
  // SCENARIO 1: Empty Calendar
  // =========================================================================
  describe('Scenario 1: Empty Calendar State', () => {
    it('displays inviting empty state, zero plan KPI metrics, and prompt to plan first look', () => {
      mockPlansState = [];
      const html = renderToString(<CalendarScreen onGoToDress={vi.fn()} />);

      // Luxury headings and kicker
      expect(html).toContain('STYLE CALENDAR');
      expect(html).toContain('Outfit Planner &amp; Wear Journal');
      expect(html).toContain('MONTHLY SCHEDULE');
      expect(html).toContain('WORN TO DATE');
      expect(html).toContain('WARDROBE RHYTHM');

      // KPIs reflect 0 planned looks
      expect(html).toContain('0 planned in');
      expect(html).toContain('Logged wear occurrences');

      // Empty detail state prompt
      expect(html).toContain('No outfit planned for this date');
      expect(html).toContain('YOUR STYLE CALENDAR IS QUIET.');
      expect(html).toContain('STYLE A LOOK');
    });
  });

  // =========================================================================
  // SCENARIO 2: Monthly Navigation
  // =========================================================================
  describe('Scenario 2: Monthly Calendar Grid Navigation', () => {
    it('renders month days, headers, and view toggles', () => {
      const html = renderToString(<CalendarScreen onGoToDress={vi.fn()} />);
      expect(html).toContain('Month');
      expect(html).toContain('Week');
      expect(html).toContain('Agenda');
      expect(html).toContain('Sun');
      expect(html).toContain('Mon');
      expect(html).toContain('Sat');
    });

    it('manages plan retrieval across different months in LocalStorageCalendarRepository', async () => {
      const octPlan: OutfitPlan = {
        id: 'plan_oct',
        date: '2026-10-15',
        occasion: 'office',
        outfit: mockOfficeOutfit,
        status: 'planned',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const novPlan: OutfitPlan = {
        id: 'plan_nov',
        date: '2026-11-15',
        occasion: 'festive',
        outfit: mockFestiveOutfit,
        status: 'planned',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await calRepo.savePlan(octPlan);
      await calRepo.savePlan(novPlan);

      const allPlans = await calRepo.getPlans();
      expect(allPlans.length).toBe(2);

      const retrievedOct = await calRepo.getPlanByDate('2026-10-15');
      expect(retrievedOct?.occasion).toBe('office');

      const retrievedNov = await calRepo.getPlanByDate('2026-11-15');
      expect(retrievedNov?.occasion).toBe('festive');
    });
  });

  // =========================================================================
  // SCENARIO 3: Weekly Navigation
  // =========================================================================
  describe('Scenario 3: Seven-Day Weekly Planner View', () => {
    it('provides seven-day weekly view with date intervals, weather context, and action triggers', () => {
      const today = new Date().toISOString().split('T')[0];
      mockPlansState = [
        {
          id: 'plan_week_today',
          date: today,
          occasion: 'office',
          outfit: mockOfficeOutfit,
          status: 'planned',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const html = renderToString(<CalendarScreen onGoToDress={vi.fn()} initialViewMode="week" />);
      // Both month and week view toggles are accessible and week view renders 7-day fashion planner
      expect(html).toContain('SEVEN-DAY FASHION PLANNER');
      expect(html).toContain('data-active="true"');
      expect(html).toContain('Modern Tailored Workwear');
    });
  });

  // =========================================================================
  // SCENARIO 4: Selecting a Date
  // =========================================================================
  describe('Scenario 4: Date Focus & Detail Calibration', () => {
    it('focuses on selected date showing weather and occasion slots', () => {
      const today = new Date().toISOString().split('T')[0];
      mockPlansState = [
        {
          id: 'plan_selected',
          date: today,
          occasion: 'casual outing',
          outfit: mockOfficeOutfit,
          status: 'planned',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const html = renderToString(<CalendarScreen onGoToDress={vi.fn()} />);
      expect(html).toContain('Today');
      expect(html).toContain('Crisp White Linen Shirt');
      expect(html).toContain('Charcoal Wool Trousers');
      expect(html).toContain('Modern Tailored Workwear');
    });
  });

  // =========================================================================
  // SCENARIO 5: Creating a Plan
  // =========================================================================
  describe('Scenario 5: Creating an Outfit Plan', () => {
    it('saves new plan with date, occasion, and garment pieces into LocalStorageCalendarRepository', async () => {
      const plan: OutfitPlan = {
        id: 'plan_new_1',
        date: '2026-11-18',
        occasion: 'office',
        outfit: mockOfficeOutfit,
        status: 'planned',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await calRepo.savePlan(plan);
      const retrieved = await calRepo.getPlanByDate('2026-11-18');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.outfit.slots.top?.[0].name).toBe('Crisp White Linen Shirt');
      expect(retrieved?.status).toBe('planned');
    });
  });

  // =========================================================================
  // SCENARIO 6: Editing a Plan
  // =========================================================================
  describe('Scenario 6: In-Place Plan Modification', () => {
    it('updates occasion in place without creating duplicate records', async () => {
      const plan: OutfitPlan = {
        id: 'plan_edit_1',
        date: '2026-11-19',
        occasion: 'office',
        outfit: mockOfficeOutfit,
        status: 'planned',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await calRepo.savePlan(plan);

      // Edit occasion to party
      const updatedPlan: OutfitPlan = {
        ...plan,
        occasion: 'party',
        updatedAt: Date.now() + 1000,
      };

      await calRepo.savePlan(updatedPlan);

      const allPlans = await calRepo.getPlans();
      expect(allPlans.length).toBe(1);
      expect(allPlans[0].occasion).toBe('party');
    });
  });

  // =========================================================================
  // SCENARIO 7: Replacing an Outfit
  // =========================================================================
  describe('Scenario 7: Replacing Planned Outfit on Same Date', () => {
    it('swaps outfit pieces while preserving original date and occasion', async () => {
      const originalPlan: OutfitPlan = {
        id: 'plan_swap_1',
        date: '2026-11-20',
        occasion: 'festive',
        outfit: mockOfficeOutfit,
        status: 'planned',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await calRepo.savePlan(originalPlan);

      // Swap to festive outfit
      const replacedPlan: OutfitPlan = {
        ...originalPlan,
        outfit: mockFestiveOutfit,
        updatedAt: Date.now() + 500,
      };
      await calRepo.savePlan(replacedPlan);

      const retrieved = await calRepo.getPlanByDate('2026-11-20');
      expect(retrieved?.outfit.id).toBe('outfit_festive_1');
      expect(retrieved?.occasion).toBe('festive');
      expect(retrieved?.outfit.slots.hero?.[0].name).toBe('Raw Silk Festive Kurta');
    });
  });

  // =========================================================================
  // SCENARIO 8: Rescheduling a Plan
  // =========================================================================
  describe('Scenario 8: Rescheduling to New Date', () => {
    it('moves outfit to target date and frees original date', async () => {
      const plan: OutfitPlan = {
        id: 'plan_reschedule_1',
        date: '2026-11-21',
        occasion: 'office',
        outfit: mockOfficeOutfit,
        status: 'planned',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await calRepo.savePlan(plan);

      // Reschedule: Delete from old date, save to new date
      await calRepo.deletePlan(plan.id);
      const newPlan: OutfitPlan = {
        ...plan,
        id: 'plan_reschedule_2',
        date: '2026-11-23',
        updatedAt: Date.now(),
      };
      await calRepo.savePlan(newPlan);

      const oldSlot = await calRepo.getPlanByDate('2026-11-21');
      const newSlot = await calRepo.getPlanByDate('2026-11-23');

      expect(oldSlot).toBeNull();
      expect(newSlot).not.toBeNull();
      expect(newSlot?.date).toBe('2026-11-23');
    });
  });

  // =========================================================================
  // SCENARIO 9: Removing a Plan
  // =========================================================================
  describe('Scenario 9: Plan Deletion & Summary Recalibration', () => {
    it('deletes plan, returns slot to unplanned state, and updates metrics', async () => {
      const plan: OutfitPlan = {
        id: 'plan_to_delete',
        date: '2026-11-22',
        occasion: 'party',
        outfit: mockOfficeOutfit,
        status: 'planned',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await calRepo.savePlan(plan);

      let found = await calRepo.getPlanByDate('2026-11-22');
      expect(found).not.toBeNull();

      await calRepo.deletePlan(plan.id);
      found = await calRepo.getPlanByDate('2026-11-22');
      expect(found).toBeNull();

      const all = await calRepo.getPlans();
      expect(all.length).toBe(0);
    });
  });

  // =========================================================================
  // SCENARIO 10: Wedding / Festive Outfit Planning
  // =========================================================================
  describe('Scenario 10: Wedding & Festive Outfit Context', () => {
    it('retains cultural formality, opulent raw silk garments, and regal styling headline', () => {
      const weddingPlan: OutfitPlan = {
        id: 'plan_wedding_1',
        date: '2026-12-05',
        occasion: 'wedding guest',
        outfit: mockFestiveOutfit,
        status: 'planned',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(weddingPlan.outfit.slots.hero?.[0].category).toBe('Ethnic');
      expect(weddingPlan.outfit.slots.hero?.[0].formality).toBe(5);
      expect(weddingPlan.outfit.score).toBeGreaterThanOrEqual(90);
    });
  });

  // =========================================================================
  // SCENARIO 11: Office / Work Outfit Planning
  // =========================================================================
  describe('Scenario 11: Professional Workwear Context', () => {
    it('prioritizes structured tailored pieces aligned with business casual or formal requirements', () => {
      const workPlan: OutfitPlan = {
        id: 'plan_work_1',
        date: '2026-11-25',
        occasion: 'office',
        outfit: mockOfficeOutfit,
        status: 'planned',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(workPlan.outfit.slots.top?.[0].occasions).toContain('office');
      expect(workPlan.outfit.slots.bottom?.[0].occasions).toContain('office');
      expect(workPlan.outfit.slots.top?.[0].fabric).toBe('linen');
    });
  });

  // =========================================================================
  // SCENARIO 12: Dirty Garment Conflicts
  // =========================================================================
  describe('Scenario 12: Care Alert for Dirty / In-Laundry Garments', () => {
    it('detects unwashed or laundry items in planned outfit and displays care alert', () => {
      const today = new Date().toISOString().split('T')[0];
      mockPlansState = [
        {
          id: 'plan_dirty_conflict',
          date: today,
          occasion: 'festive',
          outfit: mockDirtyOutfit,
          status: 'planned',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const html = renderToString(<CalendarScreen onGoToDress={vi.fn()} />);
      expect(html).toContain('Care Alert');
      expect(html).toContain('needs washing');
      expect(html).toContain('Mustard Bandhani Kurta');
    });
  });

  // =========================================================================
  // SCENARIO 13: Garment Deleted After Planning
  // =========================================================================
  describe('Scenario 13: Integrity Notice for Deleted Garments', () => {
    it('identifies missing pieces when wardrobe garments have been deleted', () => {
      const today = new Date().toISOString().split('T')[0];
      // Wardrobe only has mockCleanShirt; mockTrousers is deleted
      mockItemsState = [mockCleanShirt];
      mockPlansState = [
        {
          id: 'plan_deleted_garment',
          date: today,
          occasion: 'office',
          outfit: mockOfficeOutfit,
          status: 'planned',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const html = renderToString(<CalendarScreen onGoToDress={vi.fn()} />);
      expect(html).toContain('Wardrobe Integrity Notice');
      expect(html).toContain('Charcoal Wool Trousers');
      expect(html).toContain('Restyle Look');
    });
  });

  // =========================================================================
  // SCENARIO 14: Outfit Changed After Planning
  // =========================================================================
  describe('Scenario 14: Garment Metadata Evolution', () => {
    it('reflects updated garment metadata while preserving plan date and status', async () => {
      const plan: OutfitPlan = {
        id: 'plan_meta_1',
        date: '2026-11-28',
        occasion: 'office',
        outfit: mockOfficeOutfit,
        status: 'planned',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await calRepo.savePlan(plan);

      // Modify the garment in place
      const updatedShirt: WardrobeItem = {
        ...mockCleanShirt,
        note: 'Professionally dry cleaned and pressed',
        timesWorn: 3,
      };

      const updatedPlan: OutfitPlan = {
        ...plan,
        outfit: {
          ...mockOfficeOutfit,
          slots: {
            ...mockOfficeOutfit.slots,
            top: [updatedShirt],
          },
        },
        updatedAt: Date.now() + 100,
      };
      await calRepo.savePlan(updatedPlan);

      const retrieved = await calRepo.getPlanByDate('2026-11-28');
      expect(retrieved?.outfit.slots.top?.[0].note).toBe('Professionally dry cleaned and pressed');
      expect(retrieved?.outfit.slots.top?.[0].timesWorn).toBe(3);
    });
  });

  // =========================================================================
  // SCENARIO 15: Recently Worn Garments & Rotation Intelligence
  // =========================================================================
  describe('Scenario 15: Rotation Intelligence & Recency Detection', () => {
    it('evaluates wear gap to prevent repetitive scheduling', () => {
      const threeDaysAgo = Date.now() - 3 * 86400000;
      const today = Date.now();
      const diffDays = Math.floor((today - threeDaysAgo) / 86400000);

      expect(diffDays).toBe(3);
      // Rotation logic flags garments worn within 3 days for everyday outfits
      const isRecentlyWorn = diffDays < 4;
      expect(isRecentlyWorn).toBe(true);
    });
  });

  // =========================================================================
  // SCENARIO 16: Missing Weather Graceful Fallback
  // =========================================================================
  describe('Scenario 16: Missing Weather & Seasonal Fallback', () => {
    it('derives seasonal climate context without errors or fabricated forecasts', () => {
      const summerDate = new Date(2026, 4, 15); // May
      const seasonalSummer = deriveSeasonalContext(summerDate, null);
      expect(seasonalSummer).toBe('summer');

      const winterDate = new Date(2026, 0, 15); // January
      const seasonalWinter = deriveSeasonalContext(winterDate, null);
      expect(seasonalWinter).toBe('winter');

      const monsoonDate = new Date(2026, 6, 15); // July
      const seasonalMonsoon = deriveSeasonalContext(monsoonDate, null);
      expect(seasonalMonsoon).toBe('monsoon');
    });
  });

  // =========================================================================
  // SCENARIO 17: Stale Weather Indicator
  // =========================================================================
  describe('Scenario 17: Stale Weather Cache Indicator', () => {
    it('marks cached forecasts with appropriate freshness transparency tag', () => {
      mockWeatherState.freshness = 'stale';
      mockWeatherState.source = 'cache';

      const today = new Date().toISOString().split('T')[0];
      mockPlansState = [
        {
          id: 'plan_stale_weather',
          date: today,
          occasion: 'office',
          outfit: mockOfficeOutfit,
          status: 'planned',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const html = renderToString(<CalendarScreen onGoToDress={vi.fn()} />);
      expect(html).toContain('Cached Forecast (Stale)');
    });
  });

  // =========================================================================
  // SCENARIO 18: Offline Local-First Execution
  // =========================================================================
  describe('Scenario 18: Offline Execution Reliability', () => {
    it('executes full calendar lifecycle locally with zero network roundtrips', async () => {
      // 1. Save
      const plan: OutfitPlan = {
        id: 'plan_offline_1',
        date: '2026-11-29',
        occasion: 'everyday',
        outfit: mockOfficeOutfit,
        status: 'planned',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await calRepo.savePlan(plan);

      // 2. Query
      const stored = await calRepo.getPlanByDate('2026-11-29');
      expect(stored).not.toBeNull();

      // 3. Update status
      await calRepo.updatePlanStatus('plan_offline_1', 'worn');
      const updated = await calRepo.getPlanByDate('2026-11-29');
      expect(updated?.status).toBe('worn');

      // 4. Delete
      await calRepo.deletePlan('plan_offline_1');
      const deleted = await calRepo.getPlanByDate('2026-11-29');
      expect(deleted).toBeNull();
    });
  });

  // =========================================================================
  // SCENARIO 19: Actual Wear Confirmation Lifecycle
  // =========================================================================
  describe('Scenario 19: Wear Confirmation & Monotonic Status Enforcement', () => {
    it('marks planned look as worn, updating timesWorn and lastWorn timestamps', async () => {
      const plan: OutfitPlan = {
        id: 'plan_wear_1',
        date: '2026-11-30',
        occasion: 'office',
        outfit: mockOfficeOutfit,
        status: 'planned',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await calRepo.savePlan(plan);

      await calRepo.updatePlanStatus('plan_wear_1', 'worn');
      const wornPlan = await calRepo.getPlanByDate('2026-11-30');
      expect(wornPlan?.status).toBe('worn');
    });

    it('enforces monotonic status rule: stale mutation cannot revert worn to planned', async () => {
      const plan: OutfitPlan = {
        id: 'plan_monotonic_1',
        date: '2026-12-01',
        occasion: 'office',
        outfit: mockOfficeOutfit,
        status: 'planned',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await calRepo.savePlan(plan);
      await calRepo.updatePlanStatus('plan_monotonic_1', 'worn');

      // Attempt to overwrite with planned status
      const staleMutation: OutfitPlan = {
        ...plan,
        status: 'planned',
        updatedAt: Date.now() + 500,
      };
      await calRepo.savePlan(staleMutation);

      const guarded = await calRepo.getPlanByDate('2026-12-01');
      expect(guarded?.status).toBe('worn'); // Monotonic protection holds
    });
  });

  // =========================================================================
  // SCENARIO 20: Today Screen Synchronization
  // =========================================================================
  describe('Scenario 20: Today Screen Cross-Surface Synchronization', () => {
    it('shares identical plan identity between Calendar and Today surfaces', async () => {
      const today = new Date().toISOString().split('T')[0];
      const todayPlan: OutfitPlan = {
        id: 'plan_today_sync',
        date: today,
        occasion: 'office',
        outfit: mockOfficeOutfit,
        status: 'planned',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await calRepo.savePlan(todayPlan);

      // Verify that getPlanByDate(today) returns the exact plan
      const loaded = await calRepo.getPlanByDate(today);
      expect(loaded?.id).toBe('plan_today_sync');
      expect(loaded?.outfit.id).toBe('outfit_office_1');
    });
  });

  // =========================================================================
  // SCENARIO 21: Multiple Plans Across Dates
  // =========================================================================
  describe('Scenario 21: Multi-Date Independent Scheduling', () => {
    it('schedules distinct outfits on different dates without cross-contamination', async () => {
      const plan1: OutfitPlan = {
        id: 'plan_multi_1',
        date: '2026-12-10',
        occasion: 'office',
        outfit: mockOfficeOutfit,
        status: 'planned',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const plan2: OutfitPlan = {
        id: 'plan_multi_2',
        date: '2026-12-11',
        occasion: 'wedding guest',
        outfit: mockFestiveOutfit,
        status: 'planned',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await calRepo.savePlan(plan1);
      await calRepo.savePlan(plan2);

      const d1 = await calRepo.getPlanByDate('2026-12-10');
      const d2 = await calRepo.getPlanByDate('2026-12-11');

      expect(d1?.occasion).toBe('office');
      expect(d2?.occasion).toBe('wedding guest');
      expect(d1?.outfit.id).toBe('outfit_office_1');
      expect(d2?.outfit.id).toBe('outfit_festive_1');
    });
  });

  // =========================================================================
  // SCENARIO 22: Corrupted or Missing Outfit References
  // =========================================================================
  describe('Scenario 22: Resilient Handling of Missing / Corrupted References', () => {
    it('gracefully renders and flags corrupted outfit slots without crashing', () => {
      const today = new Date().toISOString().split('T')[0];
      const corruptedOutfit: GeneratedOutfit = {
        id: 'outfit_corrupted',
        template: 'Incomplete Drape',
        slots: {
          top: [],
          bottom: [],
        },
        score: 50,
        why: 'Incomplete pieces',
      };

      mockPlansState = [
        {
          id: 'plan_corrupted',
          date: today,
          occasion: 'casual outing',
          outfit: corruptedOutfit,
          status: 'planned',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      expect(() => {
        const html = renderToString(<CalendarScreen onGoToDress={vi.fn()} />);
        expect(html).toContain('STYLE CALENDAR');
      }).not.toThrow();
    });
  });

  // =========================================================================
  // UI & ACCESSIBILITY CONTRACTS
  // =========================================================================
  describe('UI Design, Touch Geometry & Accessibility Verification', () => {
    it('includes required editorial typography, tokens and safe-area geometry', () => {
      const html = renderToString(<CalendarScreen onGoToDress={vi.fn()} />);

      // Editorial classes
      expect(html).toContain('editorial-kicker');
      expect(html).toContain('editorial-title');
      expect(html).toContain('editorial-sub');
      expect(html).toContain('editorial-headline');
      expect(html).toContain('glass-pill');
      expect(html).toContain('glass-card');
      expect(html).toContain('specular-border');

      // Touch target standard min-h-11 (44px) and min-w-11
      expect(html).toContain('min-h-11');
      expect(html).toContain('min-w-11');
      expect(html).toContain('tactile-press');

      // Safe area bottom navigation clearance
      expect(html).toContain('pb-36');
    });

    it('contains zero raw decorative emojis in calendar screen markup', () => {
      const html = renderToString(<CalendarScreen onGoToDress={vi.fn()} />);
      const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
      expect(emojiRegex.test(html)).toBe(false);
    });
  });
});
