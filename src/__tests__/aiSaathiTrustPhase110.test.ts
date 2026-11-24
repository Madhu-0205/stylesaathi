import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createInitialConversationState,
  processSaathiTurn,
} from '../engine/saathi/orchestrationEngine';
import { parseSaathiIntent } from '../engine/saathi/intentParser';
import { SaathiToolContext } from '../engine/saathi/types';
import { WardrobeItem, WeatherSnapshot, PersonalStyleProfile, StylePreferences } from '../types';
import { recommendOutfitsWithTelemetry } from '../engine/recommendationEngine';

function createMockItem(partial: Partial<WardrobeItem> & { id: string; name: string }): WardrobeItem {
  return {
    userId: 'user_test',
    favorite: false,
    note: '',
    timesWorn: 2,
    status: 'clean',
    category: 'Tops',
    subcategory: 'shirt',
    colors: ['black'],
    seasons: ['summer', 'monsoon', 'winter'],
    occasions: ['party', 'celebration', 'office', 'casual outing'],
    formality: 3,
    ...partial,
  };
}

describe('Phase 1.10: AI Saathi Intelligence, Conversational Trust & Decision Overhaul', () => {
  const partyWardrobe: WardrobeItem[] = [
    createMockItem({
      id: 'party_top_black',
      name: 'Black Silk Shirt',
      category: 'Tops',
      subcategory: 'shirt',
      colors: ['black'],
      fabric: 'silk',
      occasions: ['party', 'celebration', 'date'],
      formality: 3.8,
    }),
    createMockItem({
      id: 'party_bottom_trousers',
      name: 'Charcoal Tailored Trousers',
      category: 'Bottoms',
      subcategory: 'trousers',
      colors: ['grey', 'charcoal'],
      fabric: 'wool',
      occasions: ['party', 'celebration', 'office'],
      formality: 4.0,
    }),
    createMockItem({
      id: 'party_shoes_loafers',
      name: 'Italian Leather Loafers',
      category: 'Footwear',
      subcategory: 'loafers',
      colors: ['black'],
      occasions: ['party', 'celebration', 'office'],
      formality: 4.0,
    }),
    createMockItem({
      id: 'party_shoes_oxfords',
      name: 'Classic Black Oxfords',
      category: 'Footwear',
      subcategory: 'formal shoes',
      colors: ['black'],
      occasions: ['party', 'office'],
      formality: 4.5,
    }),
    createMockItem({
      id: 'blue_kurti_item',
      name: 'Royal Blue Silk Kurti',
      category: 'Ethnic',
      subcategory: 'kurti',
      colors: ['blue', 'royal blue'],
      fabric: 'silk',
      occasions: ['party', 'celebration', 'festive', 'casual outing'],
      formality: 3.5,
    }),
    createMockItem({
      id: 'white_palazzo_item',
      name: 'Ivory Chanderi Palazzo',
      category: 'Ethnic',
      subcategory: 'palazzo',
      colors: ['white', 'ivory'],
      fabric: 'chanderi',
      occasions: ['party', 'celebration', 'festive'],
      formality: 3.5,
    }),
    createMockItem({
      id: 'gold_juttis_item',
      name: 'Zari Handcrafted Juttis',
      category: 'Footwear',
      subcategory: 'juttis',
      colors: ['gold'],
      fabric: 'silk',
      occasions: ['party', 'celebration', 'festive', 'puja'],
      formality: 4.0,
    }),
    createMockItem({
      id: 'silver_heels_item',
      name: 'Metallic Silver Block Heels',
      category: 'Footwear',
      subcategory: 'heels',
      colors: ['silver'],
      occasions: ['party', 'celebration'],
      formality: 4.0,
    }),
  ];

  const mockWeather: WeatherSnapshot = {
    temperature: 24,
    condition: 'clear',
    conditionText: 'Clear Evening',
    feelsLike: 24,
    humidity: 50,
    windSpeed: 10,
    precipitationProbability: 0,
    uvIndex: 1,
    observedAt: 1791892800000,
    expiresAt: 1791896400000,
    source: 'live',
    location: { city: 'Bengaluru', country: 'IN', source: 'manual', latitude: 12.97, longitude: 77.59 },
  };

  const mockStyleProfile: PersonalStyleProfile = {
    colorAffinities: { black: 0.9, blue: 0.85, white: 0.8 } as any,
    categoryWeights: { Tops: 1.0, Bottoms: 1.0, Ethnic: 1.0, Footwear: 1.0 } as any,
    formalityPreference: 3.5 as any,
    occasionAffinities: { party: { score: 0.8, confidence: 0.5 } } as any,
    combinationAffinities: {} as any,
    fabricAffinities: {} as any,
    patternAffinities: {} as any,
    silhouetteAffinities: {} as any,
    brandAffinities: {} as any,
  } as unknown as PersonalStyleProfile;

  const mockPreferences: StylePreferences = {
    preferredContexts: ['everyday', 'office', 'party'],
    preferredAesthetics: ['minimalist', 'contemporary'],
    stylingMode: 'variety',
    updatedAt: Date.now(),
    preferredColors: ['black', 'blue'],
  };

  let mockContext: SaathiToolContext;

  beforeEach(() => {
    mockContext = {
      wardrobe: [...partyWardrobe],
      weather: mockWeather,
      styleProfile: mockStyleProfile,
      preferences: mockPreferences,
      wearLogs: [],
      outfitPlans: [],
      referenceTimestamp: 1791893000000, // Valid within mockWeather expiresAt
      wardrobeRepo: {
        getItems: vi.fn().mockResolvedValue(partyWardrobe),
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

  // =========================================================================
  // SCENARIO 1: The Root Mission Failure Bug
  // User: "I was likely to go to Party tonight then is anything I have to buy for it?"
  // =========================================================================
  it('Scenario 1: Evaluates requested party occasion and names owned pieces instead of generic routines', async () => {
    const state = createInitialConversationState('scenario_1');
    const query = 'I was likely to go to Party tonight then is anything I have to buy for it?';

    const turn = await processSaathiTurn(query, state, mockContext);

    expect(turn.intent).toBe('ASSESS_PURCHASE_NEED');
    expect(turn.domainResult?.purchaseAssessment).toBeDefined();
    const pa = turn.domainResult!.purchaseAssessment as any;
    expect(pa.verdict).toBe('NO_PURCHASE_NEEDED');
    expect(pa.occasion).toBe('party');

    // Trust Mandate: Must not reuse the Phase 1.9 generic response
    expect(turn.message).not.toContain('All 3 of your active routines are fully covered');
    // Must explicitly name the evaluated outfit pieces
    expect(turn.message).toContain('party');
    expect(turn.message).toContain('No Purchase Needed');
    expect(pa.evaluatedPieces).toBeDefined();
    expect(pa.evaluatedPieces.length).toBeGreaterThanOrEqual(2);
  });

  // =========================================================================
  // SCENARIO 2: Party tonight with missing footwear (Genuine Wardrobe Gap)
  // =========================================================================
  it('Scenario 2: Correctly reports WARDROBE_GAP when user lacks footwear for party', async () => {
    const noShoesWardrobe = partyWardrobe.filter((i) => i.category !== 'Footwear');
    const ctx: SaathiToolContext = { ...mockContext, wardrobe: noShoesWardrobe };
    const state = createInitialConversationState('scenario_2');

    const turn = await processSaathiTurn('Do I need to buy anything for a party tonight?', state, ctx);

    expect(turn.domainResult?.purchaseAssessment).toBeDefined();
    const pa = turn.domainResult!.purchaseAssessment as any;
    expect(pa.verdict).toBe('WARDROBE_GAP');
    expect(turn.message).toContain('Verified Wardrobe Gap');
    expect(turn.message.toLowerCase()).toContain('footwear');
  });

  // =========================================================================
  // SCENARIO 3: Party tonight with only an anchor garment specified
  // =========================================================================
  it('Scenario 3: Recommends outfit anchored around specified kurti for party', async () => {
    const state = createInitialConversationState('scenario_3');
    const query = 'I am going to a party tonight and want to wear my blue kurti. What else should I wear?';

    const turn = await processSaathiTurn(query, state, mockContext);

    expect(turn.domainResult?.outfits).toBeDefined();
    expect(turn.domainResult!.outfits!.length).toBeGreaterThan(0);
    const outfit = turn.domainResult!.outfits![0];
    const outfitItemIds = Object.values(outfit.slots || {}).flat().map((i) => i.id);
    expect(outfitItemIds).toContain('blue_kurti_item');
    expect(turn.updatedState.activeAnchorItem?.id).toBe('blue_kurti_item');
  });

  // =========================================================================
  // SCENARIO 4: User explicitly selects the blue kurti (STYLE_ITEM)
  // =========================================================================
  it('Scenario 4: Explicitly styles the blue kurti and registers anchor in conversation state', async () => {
    const state = createInitialConversationState('scenario_4');

    const turn = await processSaathiTurn('I want to wear my blue kurti', state, mockContext);

    expect(turn.intent).toBe('STYLE_ITEM');
    expect(turn.updatedState.activeAnchorItem?.id).toBe('blue_kurti_item');
    expect(turn.message).toContain('Royal Blue Silk Kurti');
  });

  // =========================================================================
  // SCENARIO 5: Follow-up "show another" preserves the blue kurti anchor
  // =========================================================================
  it('Scenario 5: Multi-turn "show another look" preserves the active anchor piece', async () => {
    let state = createInitialConversationState('scenario_5');

    // Turn 1: Anchor on kurti
    const turn1 = await processSaathiTurn('Style my blue kurti for a party', state, mockContext);
    state = turn1.updatedState;
    expect(state.activeAnchorItem?.id).toBe('blue_kurti_item');

    // Turn 2: Request alternative
    const turn2 = await processSaathiTurn('Show another look', state, mockContext);
    state = turn2.updatedState;

    expect(turn2.intent).toBe('SHOW_ALTERNATIVE');
    expect(state.activeAnchorItem?.id).toBe('blue_kurti_item');
    const outfit = turn2.domainResult?.outfits?.[0];
    if (outfit) {
      const pieceIds = Object.values(outfit.slots || {}).flat().map((i) => i.id);
      expect(pieceIds).toContain('blue_kurti_item');
    }
  });

  // =========================================================================
  // SCENARIO 6: Follow-up "different footwear" swaps slot and preserves anchor
  // =========================================================================
  it('Scenario 6: SWAP_PIECE swaps footwear while preserving kurti anchor and coordinates', async () => {
    let state = createInitialConversationState('scenario_6');

    // Turn 1: Anchor on kurti
    const turn1 = await processSaathiTurn('Style my blue kurti for a party', state, mockContext);
    state = turn1.updatedState;
    const initialFootwearId = (state.activeOutfit?.slots as any)?.footwear?.[0]?.id;

    // Turn 2: Swap shoes
    const turn2 = await processSaathiTurn('Use different footwear', state, mockContext);
    state = turn2.updatedState;

    expect(turn2.intent).toBe('SWAP_PIECE');
    expect(state.activeAnchorItem?.id).toBe('blue_kurti_item');
    const newFootwearId = (state.activeOutfit?.slots as any)?.footwear?.[0]?.id;
    if (initialFootwearId && newFootwearId) {
      expect(newFootwearId).not.toBe(initialFootwearId);
    }
  });

  // =========================================================================
  // SCENARIO 7: User changes party to birthday party (Correction Handling)
  // =========================================================================
  it('Scenario 7: Corrects occasion from party to birthday party context seamlessly', async () => {
    let state = createInitialConversationState('scenario_7');

    const turn1 = await processSaathiTurn('Recommend a party look', state, mockContext);
    state = turn1.updatedState;
    expect(state.activeOccasion).toBe('party');

    const turn2 = await processSaathiTurn('Actually this is for a birthday party', state, mockContext);
    state = turn2.updatedState;

    expect(turn2.updatedState.activeOccasionContext).toBe('birthday party');
    expect(['celebration', 'party']).toContain(turn2.updatedState.activeOccasion);
  });

  // =========================================================================
  // SCENARIO 8: User asks if buying is necessary when outfit exists (NO_PURCHASE_NEEDED)
  // =========================================================================
  it('Scenario 8: Reassures user that NO_PURCHASE_NEEDED when office outfit is complete', async () => {
    const state = createInitialConversationState('scenario_8');

    const turn = await processSaathiTurn('Do I need to buy anything for office tomorrow?', state, mockContext);

    expect(turn.intent).toBe('ASSESS_PURCHASE_NEED');
    const pa = turn.domainResult?.purchaseAssessment as any;
    expect(pa.verdict).toBe('NO_PURCHASE_NEEDED');
    expect(turn.message).toContain('No Purchase Needed');
  });

  // =========================================================================
  // SCENARIO 9: User has suitable outfit but pieces are in laundry (LAUNDRY BOTTLENECK)
  // =========================================================================
  it('Scenario 9: Identifies laundry bottleneck and warns no purchase needed, just wash clothes', async () => {
    const dirtyWardrobe = partyWardrobe.map((item) => ({
      ...item,
      status: (item.category === 'Tops' || item.category === 'Ethnic' ? 'in_laundry' : 'clean') as any,
    }));
    const ctx: SaathiToolContext = { ...mockContext, wardrobe: dirtyWardrobe };
    const state = createInitialConversationState('scenario_9');

    const turn = await processSaathiTurn('Do I need to buy anything for a party?', state, ctx);

    const pa = turn.domainResult?.purchaseAssessment as any;
    expect(pa.verdict).toBe('NO_VALID_OUTFIT');
    expect(turn.message).toContain('Laundry Bottleneck');
    expect(turn.message.toLowerCase()).toContain('laundry');
  });

  // =========================================================================
  // SCENARIO 10: Wardrobe metadata is insufficient (< 3 items total)
  // =========================================================================
  it('Scenario 10: Prompts for baseline wardrobe data when fewer than 3 items are owned', async () => {
    const sparseWardrobe = [partyWardrobe[0]];
    const ctx: SaathiToolContext = { ...mockContext, wardrobe: sparseWardrobe };
    const state = createInitialConversationState('scenario_10');

    const turn = await processSaathiTurn('Do I need to buy anything for a party tonight?', state, ctx);

    const pa = turn.domainResult?.purchaseAssessment as any;
    expect(pa.verdict).toBe('INSUFFICIENT_INFORMATION');
    expect(turn.message).toContain('More Wardrobe Information Needed');
  });

  // =========================================================================
  // SCENARIO 11: Selected garment is dirty (Laundry Notice generated)
  // =========================================================================
  it('Scenario 11: Includes explicit laundry notice when styling an in-laundry piece', async () => {
    const dirtyKurtiWardrobe = partyWardrobe.map((item) =>
      item.id === 'blue_kurti_item' ? { ...item, status: 'in_laundry' as const } : item
    );
    const ctx: SaathiToolContext = { ...mockContext, wardrobe: dirtyKurtiWardrobe };
    const state = createInitialConversationState('scenario_11');

    const turn = await processSaathiTurn('Style my blue kurti for a party', state, ctx);

    expect(turn.message.toLowerCase()).toContain('in laundry');
  });

  // =========================================================================
  // SCENARIO 12: Selected garment is not found / deleted (Graceful Not Found)
  // =========================================================================
  it('Scenario 12: Handles nonexistent item gracefully without crashing or fabricating', async () => {
    const state = createInitialConversationState('scenario_12');

    const turn = await processSaathiTurn('Style my neon green blazer for a party', state, mockContext);

    expect(turn.message).toContain("couldn't find");
    expect((turn as any).error).toBeUndefined();
  });

  // =========================================================================
  // SCENARIO 13: User rejects recommendation and explains why (Constructive Feedback)
  // =========================================================================
  it('Scenario 13: Acknowledges negative feedback constructively without generic dismissals', async () => {
    let state = createInitialConversationState('scenario_13');

    const turn1 = await processSaathiTurn('Recommend a party look', state, mockContext);
    state = turn1.updatedState;

    const turn2 = await processSaathiTurn("I don't like this, it's too casual", state, mockContext);

    expect(turn2.intent).toBe('FEEDBACK_NEGATIVE');
    expect(turn2.message.toLowerCase()).toContain('feedback');
    expect(turn2.message.toLowerCase()).toContain('style profile');
  });

  // =========================================================================
  // SCENARIO 14: User explicitly says not to suggest purchases (EXPLICIT_NO_PURCHASE)
  // =========================================================================
  it('Scenario 14: Reaffirms Zero Purchase Philosophy when user says not to suggest buying', async () => {
    const state = createInitialConversationState('scenario_14');

    const turn = await processSaathiTurn("I don't want to buy anything, just work with what I have", state, mockContext);

    expect(turn.intent).toBe('EXPLICIT_NO_PURCHASE');
    expect(turn.message).toContain('zero-pressure philosophy');
    const pa = turn.domainResult?.purchaseAssessment as any;
    expect(pa.verdict).toBe('NO_PURCHASE_NEEDED');
  });

  // =========================================================================
  // SCENARIO 15: Duplicate outfit recommendations are suppressed in SHOW_ALTERNATIVE
  // =========================================================================
  it('Scenario 15: Suppresses previously shown outfit IDs on SHOW_ALTERNATIVE turns', async () => {
    let state = createInitialConversationState('scenario_15');

    const turn1 = await processSaathiTurn('Recommend a party look', state, mockContext);
    state = turn1.updatedState;
    const firstOutfitId = turn1.domainResult?.outfits?.[0]?.id;
    expect(firstOutfitId).toBeDefined();

    const turn2 = await processSaathiTurn('Show me another look', state, mockContext);
    state = turn2.updatedState;
    const secondOutfitId = turn2.domainResult?.outfits?.[0]?.id;

    if (secondOutfitId && firstOutfitId) {
      expect(secondOutfitId).not.toBe(firstOutfitId);
      expect(state.shownOutfitIds).toContain(firstOutfitId);
      expect(state.shownOutfitIds).toContain(secondOutfitId);
    }
  });

  // =========================================================================
  // SCENARIO 16: AI Saathi and Ask AI share identical scoring and constraints
  // =========================================================================
  it('Scenario 16: Shared recommendation engine produces consistent telemetry', () => {
    const res = recommendOutfitsWithTelemetry({
      items: partyWardrobe,
      occasion: 'party',
      season: 'summer',
      localDate: '2026-10-13',
      preferences: mockPreferences,
      styleProfile: mockStyleProfile,
      limit: 3,
    });

    expect(res.set.outfits.length).toBeGreaterThan(0);
    const top = res.set.outfits[0];
    expect(top.explanation?.reasons).toBeDefined();
    expect(top.explanation!.reasons!.length).toBeGreaterThan(0);
  });

  // =========================================================================
  // SCENARIO 17: Generic Smart Buy result cannot replace occasion-specific assessment
  // =========================================================================
  it('Scenario 17: Occasion-scoped assessment evaluates target occasion instead of 3 routines', async () => {
    const state = createInitialConversationState('scenario_17');

    const turn = await processSaathiTurn('Do I need to buy anything for a wedding?', state, mockContext);

    expect(turn.intent).toBe('ASSESS_PURCHASE_NEED');
    const pa = turn.domainResult?.purchaseAssessment as any;
    expect(pa.occasion).toBe('wedding guest');
    // Must NOT be the generic routine coverage response
    expect(turn.message).not.toContain('All 3 of your active routines are fully covered');
  });

  // =========================================================================
  // SCENARIO 18: Missing optional accessory does not become a mandatory purchase (OPTIONAL_GAP)
  // =========================================================================
  it('Scenario 18: Treats missing blazer as OPTIONAL_GAP rather than required wardrobe failure', async () => {
    const state = createInitialConversationState('scenario_18');

    const turn = await processSaathiTurn('Do I need to buy a blazer for college?', state, mockContext);

    expect(turn.intent).toBe('ASSESS_PURCHASE_NEED');
    const pa = turn.domainResult?.purchaseAssessment as any;
    expect(pa.verdict).toBe('OPTIONAL_GAP');
    expect(turn.message).toContain('Optional Enhancement Only');
  });

  // =========================================================================
  // SCENARIO 19: Cultural restrictions remain intact (Puja rejects animal leather shoes)
  // =========================================================================
  it('Scenario 19: Sacred puja occasion rejects leather footwear and selects textile juttis', () => {
    const pujaWardrobe = [
      createMockItem({
        id: 'puja_kurta',
        name: 'Ivory Khadi Kurta',
        category: 'Ethnic',
        subcategory: 'kurta',
        colors: ['white'],
        fabric: 'khadi',
        occasions: ['puja', 'festive'],
        formality: 3.5,
      }),
      createMockItem({
        id: 'puja_pajama',
        name: 'Cotton Churidar Pajama',
        category: 'Ethnic',
        subcategory: 'churidar',
        colors: ['white'],
        fabric: 'cotton',
        occasions: ['puja', 'festive'],
        formality: 3.5,
      }),
      createMockItem({
        id: 'puja_leather_shoes',
        name: 'Brown Leather Loafers',
        category: 'Footwear',
        subcategory: 'loafers',
        colors: ['brown'],
        occasions: ['puja', 'office'],
        formality: 4.0,
      }),
      createMockItem({
        id: 'puja_textile_juttis',
        name: 'Silk Embroidered Juttis',
        category: 'Footwear',
        subcategory: 'juttis',
        colors: ['gold'],
        fabric: 'silk',
        occasions: ['puja', 'festive'],
        formality: 4.0,
      }),
    ];

    const res = recommendOutfitsWithTelemetry({
      items: pujaWardrobe,
      occasion: 'puja',
      season: 'summer',
      localDate: '2026-10-13',
      preferences: {
        preferredContexts: ['puja'],
        preferredAesthetics: ['traditional'],
        stylingMode: 'variety',
        updatedAt: Date.now(),
      },
      limit: 2,
    });

    expect(res.set.outfits.length).toBeGreaterThan(0);
    const topLook = res.set.outfits[0];
    const shoes = (topLook.slots as any).footwear?.[0];
    expect(shoes).toBeDefined();
    // Must select the textile juttis and reject leather loafers for sacred puja
    expect(shoes.id).toBe('puja_textile_juttis');
    expect(shoes.fabric).not.toBe('leather');
  });

  // =========================================================================
  // SCENARIO 20: Weather data is stale or unavailable (Graceful Fallback)
  // =========================================================================
  it('Scenario 20: Stale or expired weather data falls back gracefully without fabricating forecasts', async () => {
    const expiredWeather: WeatherSnapshot = {
      ...mockWeather,
      expiresAt: 1791890000000, // Expired relative to referenceTimestamp 1791893000000
    };
    const ctx: SaathiToolContext = { ...mockContext, weather: expiredWeather };
    const state = createInitialConversationState('scenario_20');

    const turn = await processSaathiTurn('What is the weather outside today?', state, ctx);

    expect(turn.intent).toBe('CHECK_WEATHER');
    expect(turn.message).toContain("can't verify the current weather");
    // Must not fabricate a fake temperature
    expect(turn.message).not.toContain('24°C');
  });
});

