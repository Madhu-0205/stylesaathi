import { describe, it, expect } from 'vitest';
import { parseSaathiIntent } from '../engine/saathi/intentParser';
import {
  processSaathiTurn,
  createInitialConversationState,
} from '../engine/saathi/orchestrationEngine';
import {
  recommendOutfitsTool,
  styleItemTool,
  getCurrentWeatherTool,
  getWearAnalyticsTool,
  getStyleProfileTool,
  getWardrobeGapsTool,
  getPurchaseAssessmentTool,
  getWardrobeTool,
  createPlanTool,
  recordWearTool,
} from '../engine/saathi/toolRegistry';
import { resolveWardrobeGarment, resolveReferencedLook } from '../engine/saathi/contextResolver';
import { getPhilosophyById } from '../engine/knowledge/designersEditCatalog';
import { WardrobeItem, ContextSnapshot } from '../types';
import { SaathiToolContext } from '../engine/saathi/types';

describe('Phase 1.3 — AI Saathi Conversational Fashion Intelligence (60 Targeted Scenarios)', () => {
  const baseWardrobe: WardrobeItem[] = [
    {
      id: 'top-1',
      name: 'Oxford Cotton Shirt',
      category: 'Tops',
      subcategory: 'shirt',
      colors: ['white'],
      fabric: 'cotton',
      fit: 'regular',
      formality: 4,
      status: 'clean',
      occasions: ['office', 'interview', 'college'],
      seasons: ['summer', 'winter', 'monsoon'],
      timesWorn: 8,
      lastWorn: Date.now() - 10 * 86400000,
      createdAt: Date.now(),
      favorite: false,
      note: '',
    },
    {
      id: 'top-2',
      name: 'Olive Linen Shirt',
      category: 'Tops',
      subcategory: 'shirt',
      colors: ['olive', 'green'],
      fabric: 'linen',
      fit: 'relaxed',
      formality: 3,
      status: 'clean',
      occasions: ['casual outing', 'college', 'everyday'],
      seasons: ['summer', 'monsoon'],
      timesWorn: 5,
      lastWorn: Date.now() - 5 * 86400000,
      createdAt: Date.now(),
      favorite: false,
      note: '',
    },
    {
      id: 'top-3',
      name: 'Mulmul Chikankari Kurta',
      category: 'Ethnic',
      subcategory: 'kurta',
      colors: ['white'],
      fabric: 'cotton',
      fit: 'relaxed',
      formality: 3,
      status: 'clean',
      occasions: ['puja', 'festive', 'casual outing', 'wedding guest'],
      seasons: ['summer', 'monsoon'],
      timesWorn: 0, // Unworn piece for restyling
      createdAt: Date.now(),
      favorite: false,
      note: '',
    },
    {
      id: 'bottom-1',
      name: 'Tailored Charcoal Trousers',
      category: 'Bottoms',
      subcategory: 'trousers',
      colors: ['grey', 'charcoal'],
      fabric: 'wool',
      fit: 'straight',
      formality: 4,
      status: 'clean',
      occasions: ['office', 'interview'],
      seasons: ['summer', 'winter', 'monsoon'],
      timesWorn: 12,
      lastWorn: Date.now() - 86400000, // Worn yesterday!
      createdAt: Date.now(),
      favorite: false,
      note: '',
    },
    {
      id: 'bottom-2',
      name: 'Classic Indigo Denim Jeans',
      category: 'Bottoms',
      subcategory: 'jeans',
      colors: ['blue', 'navy'],
      fabric: 'denim',
      fit: 'straight',
      formality: 2,
      status: 'clean',
      occasions: ['college', 'casual outing', 'everyday'],
      seasons: ['summer', 'winter', 'monsoon'],
      timesWorn: 14,
      lastWorn: Date.now() - 8 * 86400000,
      createdAt: Date.now(),
      favorite: false,
      note: '',
    },
    {
      id: 'bottom-3',
      name: 'Off-White Linen Trousers',
      category: 'Bottoms',
      subcategory: 'trousers',
      colors: ['cream', 'beige'],
      fabric: 'linen',
      fit: 'straight',
      formality: 3,
      status: 'clean',
      occasions: ['casual outing', 'puja', 'office', 'wedding guest'],
      seasons: ['summer', 'monsoon'],
      timesWorn: 4,
      lastWorn: Date.now() - 15 * 86400000,
      createdAt: Date.now(),
      favorite: false,
      note: '',
    },
    {
      id: 'shoes-1',
      name: 'Handcrafted Leather Loafers',
      category: 'Footwear',
      subcategory: 'loafers',
      colors: ['brown'],
      formality: 4,
      status: 'clean',
      occasions: ['office', 'interview', 'wedding guest'],
      seasons: ['summer', 'winter', 'monsoon'],
      timesWorn: 9,
      lastWorn: Date.now() - 4 * 86400000,
      createdAt: Date.now(),
      favorite: false,
      note: '',
    },
    {
      id: 'shoes-2',
      name: 'Minimal White Leather Sneakers',
      category: 'Footwear',
      subcategory: 'sneakers',
      colors: ['white'],
      formality: 2,
      status: 'clean',
      occasions: ['college', 'casual outing', 'everyday'],
      seasons: ['summer', 'winter', 'monsoon'],
      timesWorn: 20,
      lastWorn: Date.now() - 86400000, // Worn yesterday!
      createdAt: Date.now(),
      favorite: false,
      note: '',
    },
    {
      id: 'ethnic-1',
      name: 'Banarasi Katan Silk Saree',
      category: 'Ethnic',
      subcategory: 'saree',
      colors: ['red', 'gold'],
      fabric: 'silk',
      fit: 'regular',
      formality: 5,
      status: 'clean',
      occasions: ['wedding guest', 'festive', 'puja'],
      seasons: ['winter', 'monsoon'],
      timesWorn: 1,
      createdAt: Date.now(),
      favorite: false,
      note: '',
    },
    {
      id: 'top-blouse',
      name: 'Raw Silk Gold Blouse',
      category: 'Ethnic',
      subcategory: 'crop top',
      colors: ['gold'],
      fabric: 'silk',
      fit: 'regular',
      formality: 5,
      status: 'clean',
      occasions: ['wedding guest', 'festive'],
      seasons: ['summer', 'winter', 'monsoon'],
      timesWorn: 1,
      createdAt: Date.now(),
      favorite: false,
      note: '',
    },
    {
      id: 'shoes-juttis',
      name: 'Embroidered Mojris / Juttis',
      category: 'Footwear',
      subcategory: 'juttis',
      colors: ['gold', 'tan'],
      formality: 4,
      status: 'clean',
      occasions: ['wedding guest', 'puja', 'festive'],
      seasons: ['summer', 'winter', 'monsoon'],
      timesWorn: 2,
      createdAt: Date.now(),
      favorite: false,
      note: '',
    },
  ];

  function createMockContext(overrides?: Partial<SaathiToolContext>): SaathiToolContext {
    return {
      wardrobe: baseWardrobe,
      referenceTimestamp: Date.UTC(2026, 9, 15, 10, 0, 0),
      localDate: '2026-10-15',
      weatherSnapshot: {
        weather: {
          temperature: 26,
          conditionText: 'Clear sky',
          condition: 'Clear',
          humidity: 45,
          windSpeed: 8,
        },
        thermalContext: 'comfortable',
        rainContext: 'none',
      } as any,
      styleProfile: {
        topColors: ['white', 'blue', 'olive'],
        avoidedFabrics: ['polyester'],
      } as any,
      preferences: {
        preferredAesthetics: ['minimalist', 'quiet luxury'],
      } as any,
      wearEvents: [
        {
          id: 'wear_yesterday_1',
          userId: 'user_1',
          wardrobeItemId: 'bottom-1',
          wornAt: Date.UTC(2026, 9, 14, 10, 0, 0),
          createdAt: Date.UTC(2026, 9, 14, 10, 0, 0),
        },
        {
          id: 'wear_yesterday_2',
          userId: 'user_1',
          wardrobeItemId: 'shoes-2',
          wornAt: Date.UTC(2026, 9, 14, 10, 0, 0),
          createdAt: Date.UTC(2026, 9, 14, 10, 0, 0),
        },
      ],
      ...overrides,
    };
  }

  // =========================================================================
  // SUITE 1: INTENT RECOGNITION (15 SCENARIOS)
  // =========================================================================
  describe('Suite 1: Intent Recognition (15 Scenarios)', () => {
    it('1. Routes "What is the weather outside today?" to CHECK_WEATHER', () => {
      const res = parseSaathiIntent('What is the weather outside today?');
      expect(res.intent).toBe('CHECK_WEATHER');
      expect(res.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('2. Routes "Is it raining outside?" to CHECK_WEATHER', () => {
      const res = parseSaathiIntent('Is it raining outside?');
      expect(res.intent).toBe('CHECK_WEATHER');
    });

    it('3. Routes "What is the temperature?" to CHECK_WEATHER', () => {
      const res = parseSaathiIntent('What is the temperature right now?');
      expect(res.intent).toBe('CHECK_WEATHER');
    });

    it('4. Routes "Tell me about Banarasi brocade" to GENERAL_FASHION_QUESTION without being shadowed by weather', () => {
      const res = parseSaathiIntent('Tell me about Banarasi brocade');
      expect(res.intent).toBe('GENERAL_FASHION_QUESTION');
    });

    it('5. Routes "History of chikankari" to GENERAL_FASHION_QUESTION', () => {
      const res = parseSaathiIntent('History of chikankari embroidery');
      expect(res.intent).toBe('GENERAL_FASHION_QUESTION');
    });

    it('6. Routes "I want a premium-looking casual outfit" to RECOMMEND_OUTFIT with casual occasion and premium aesthetic', () => {
      const res = parseSaathiIntent('I want a premium-looking casual outfit');
      expect(res.intent).toBe('RECOMMEND_OUTFIT');
      expect(res.entities.occasion).toBe('casual outing');
      expect(res.entities.aesthetic).toBe('premium');
    });

    it('7. Routes "I have a wedding next week" to RECOMMEND_OUTFIT with wedding guest occasion and relative date', () => {
      const res = parseSaathiIntent('I have a wedding next week');
      expect(res.intent).toBe('RECOMMEND_OUTFIT');
      expect(res.entities.occasion).toBe('wedding guest');
      expect(res.entities.date).toBe('next week');
    });

    it('8. Routes "What should I wear to college?" to COLLEGE_OUTFIT with college occasion', () => {
      const res = parseSaathiIntent('What should I wear to college?');
      expect(res.intent).toBe('COLLEGE_OUTFIT');
      expect(res.entities.occasion).toBe('college');
    });

    it('9. Routes "Interview outfit" to INTERVIEW_OUTFIT with interview occasion', () => {
      const res = parseSaathiIntent('Interview outfit for tomorrow');
      expect(res.intent).toBe('INTERVIEW_OUTFIT');
      expect(res.entities.occasion).toBe('interview');
      expect(res.entities.date).toBe('tomorrow');
    });

    it('10. Routes "Make my outfit more elegant" to PREMIUM_UPGRADE with more_elegant refinement', () => {
      const res = parseSaathiIntent('Make my outfit more elegant');
      expect(res.intent).toBe('PREMIUM_UPGRADE');
      expect(res.entities.refinementType).toBe('more_elegant');
      expect(res.entities.aesthetic).toBe('elegant');
    });

    it('11. Routes "Elevate my look" to PREMIUM_UPGRADE', () => {
      const res = parseSaathiIntent('Elevate my look');
      expect(res.intent).toBe('PREMIUM_UPGRADE');
    });

    it('12. Routes "Which colours pair well with olive green?" to COLOR_PAIRING with olive entity', () => {
      const res = parseSaathiIntent('Which colours pair well with olive green?');
      expect(res.intent).toBe('COLOR_PAIRING');
      expect(res.entities.color).toBe('olive');
    });

    it('13. Routes "What colours go with navy?" to COLOR_PAIRING with navy entity', () => {
      const res = parseSaathiIntent('What colours go with navy?');
      expect(res.intent).toBe('COLOR_PAIRING');
      expect(res.entities.color).toBe('navy');
    });

    it('14. Routes "I don\'t want to repeat yesterday\'s outfit" to ANTI_REPETITION with flag set', () => {
      const res = parseSaathiIntent("I don't want to repeat yesterday's outfit");
      expect(res.intent).toBe('ANTI_REPETITION');
      expect(res.entities.antiRepetition).toBe(true);
      expect(res.entities.avoidRecentDays).toBe(1);
    });

    it('15. Flags user correction "No, I meant for an interview" with isCorrection and routes to interview', () => {
      const res = parseSaathiIntent('No, I meant for an interview');
      expect(res.entities.isCorrection).toBe(true);
      expect(res.entities.occasion).toBe('interview');
      expect(res.intent).toBe('INTERVIEW_OUTFIT');
    });
  });

  // =========================================================================
  // SUITE 2: CONVERSATIONAL CONTINUITY & MULTI-TURN (15 SCENARIOS)
  // =========================================================================
  describe('Suite 2: Conversational Continuity & Multi-Turn (15 Scenarios)', () => {
    it('16. Resolves "the first look" to index 0 for calendar planning', async () => {
      const ctx = createMockContext();
      let state = createInitialConversationState();
      // Turn 1: recommend looks
      const t1 = await processSaathiTurn('Recommend outfits for college', state, ctx);
      expect(t1.domainResult?.outfits?.length).toBeGreaterThan(0);
      state = t1.updatedState;

      // Turn 2: plan the first look
      const t2 = await processSaathiTurn('Schedule the first look for tomorrow', state, ctx);
      expect(t2.confirmation).toBeDefined();
      expect(t2.confirmation?.actionType).toBe('PLAN_OUTFIT');
      expect((t2.confirmation?.payload as any).outfit.id).toBe(t1.domainResult?.outfits?.[0].id);
    });

    it('17. Resolves "the second look" to index 1 for calendar planning', async () => {
      const ctx = createMockContext();
      let state = createInitialConversationState();
      const t1 = await processSaathiTurn('Recommend outfits for college', state, ctx);
      state = t1.updatedState;

      const t2 = await processSaathiTurn('Schedule the second look for tomorrow', state, ctx);
      expect(t2.confirmation).toBeDefined();
      expect(t2.confirmation?.actionType).toBe('PLAN_OUTFIT');
      if (t1.domainResult?.outfits && t1.domainResult.outfits.length > 1) {
        expect((t2.confirmation?.payload as any).outfit.id).toBe(t1.domainResult.outfits[1].id);
      }
    });

    it('18. Resolves "the third look" to index 2 for calendar planning', async () => {
      const ctx = createMockContext();
      let state = createInitialConversationState();
      const t1 = await processSaathiTurn('Recommend outfits for college', state, ctx);
      state = t1.updatedState;

      const t2 = await processSaathiTurn('Schedule the third look for tomorrow', state, ctx);
      expect(t2.confirmation).toBeDefined();
      expect(t2.confirmation?.actionType).toBe('PLAN_OUTFIT');
      if (t1.domainResult?.outfits && t1.domainResult.outfits.length > 2) {
        expect((t2.confirmation?.payload as any).outfit.id).toBe(t1.domainResult.outfits[2].id);
      }
    });

    it('19. Resolves "the last look" to the final outfit in candidate set', async () => {
      const ctx = createMockContext();
      let state = createInitialConversationState();
      const t1 = await processSaathiTurn('Recommend outfits for college', state, ctx);
      state = t1.updatedState;

      const t2 = await processSaathiTurn('Schedule the last look for tomorrow', state, ctx);
      expect(t2.confirmation).toBeDefined();
      const outfits = t1.domainResult?.outfits || [];
      const lastOutfit = outfits[outfits.length - 1];
      expect((t2.confirmation?.payload as any).outfit.id).toBe(lastOutfit.id);
    });

    it('20. Performs anaphoric garment resolution ("that shirt") to the shirt featured in previous turn', async () => {
      const ctx = createMockContext();
      let state = createInitialConversationState();
      // Turn 1: recommend looks for office (Oxford Cotton Shirt top-1 will be featured)
      const t1 = await processSaathiTurn('What should I wear to office?', state, ctx);
      state = t1.updatedState;

      // Turn 2: "How do I style that shirt?"
      const t2 = await processSaathiTurn('How do I style that shirt?', state, ctx);
      // Must resolve directly to the shirt from previous turn without triggering ambiguity clarification
      expect(t2.clarification).toBeUndefined();
      expect(t2.message).toContain('Oxford Cotton Shirt');
    });

    it('21. Cancels pending occasion clarification when user switches topic to wear analytics', async () => {
      const ctx = createMockContext();
      let state = createInitialConversationState();
      // Turn 1: vague recommendation prompt triggers clarification
      const t1 = await processSaathiTurn('Recommend an outfit', state, ctx);
      expect(t1.clarification).toBeDefined();
      expect(t1.clarification?.field).toBe('occasion');
      state = t1.updatedState;

      // Turn 2: topic switch to wear analytics
      const t2 = await processSaathiTurn('What is my most worn item?', state, ctx);
      // Clarification must be cancelled, not treated as the occasion!
      expect(t2.intent).toBe('ANALYZE_WEAR');
      expect(t2.message).toContain('wear rotation insights');
      expect(t2.clarification).toBeUndefined();
    });

    it('22. Cancels pending occasion clarification when user switches topic to weather', async () => {
      const ctx = createMockContext();
      let state = createInitialConversationState();
      const t1 = await processSaathiTurn('Recommend an outfit', state, ctx);
      expect(t1.clarification).toBeDefined();
      state = t1.updatedState;

      // Turn 2: topic switch to weather
      const t2 = await processSaathiTurn('What is the weather outside?', state, ctx);
      expect(t2.intent).toBe('CHECK_WEATHER');
      expect(t2.message).toContain('26°C');
      expect(t2.clarification).toBeUndefined();
    });

    it('23. Handles user correction during pending confirmation ("No, I meant for an interview")', async () => {
      const ctx = createMockContext();
      let state = createInitialConversationState();
      // Turn 1: Plan an outfit for college
      const t1 = await processSaathiTurn('Plan this outfit for college tomorrow', state, ctx);
      expect(t1.confirmation).toBeDefined();
      state = t1.updatedState;

      // Turn 2: user corrects occasion
      const t2 = await processSaathiTurn('No, I meant for an interview', state, ctx);
      // Must cancel the college plan confirmation and generate interview recommendation
      expect(t2.message.toLowerCase()).toContain('interview');
      expect(t2.message).not.toContain('Action cancelled — no changes were made');
    });

    it('24. Confirmation accept ("Yes") executes createPlanTool and confirms calendar addition', async () => {
      let planSaved = false;
      const ctx = createMockContext({
        onSavePlan: async (plan) => {
          planSaved = true;
          return { id: 'plan-1', ...plan, createdAt: Date.now(), updatedAt: Date.now() } as any;
        },
      });
      let state = createInitialConversationState();
      const t1 = await processSaathiTurn('Plan this look for office tomorrow', state, ctx);
      expect(t1.confirmation).toBeDefined();
      state = t1.updatedState;

      const t2 = await processSaathiTurn('Yes', state, ctx);
      expect(t2.intent).toBe('CONFIRMATION_RESPONSE');
      expect(t2.message).toContain("Done! I've added your look to your calendar");
      expect(planSaved).toBe(true);
    });

    it('25. Confirmation reject ("No") cancels action cleanly without saving plan', async () => {
      let planSaved = false;
      const ctx = createMockContext({
        onSavePlan: async (plan) => {
          planSaved = true;
          return plan as any;
        },
      });
      let state = createInitialConversationState();
      const t1 = await processSaathiTurn('Plan this look for office tomorrow', state, ctx);
      expect(t1.confirmation).toBeDefined();
      state = t1.updatedState;

      const t2 = await processSaathiTurn('No', state, ctx);
      expect(t2.intent).toBe('CONFIRMATION_RESPONSE');
      expect(t2.message).toContain('Understood. Action cancelled');
      expect(planSaved).toBe(false);
    });

    it('26. Clarification resume: Responds to occasion clarification with "college" to generate looks', async () => {
      const ctx = createMockContext();
      let state = createInitialConversationState();
      const t1 = await processSaathiTurn('Suggest an outfit', state, ctx);
      expect(t1.clarification).toBeDefined();
      state = t1.updatedState;

      const t2 = await processSaathiTurn('college', state, ctx);
      expect(t2.intent).toBe('RECOMMEND_OUTFIT');
      expect(t2.message).toContain('college');
      expect(t2.domainResult?.outfits?.length).toBeGreaterThan(0);
    });

    it('27. Clarification option click: Responds with option value "office" to resume recommendation', async () => {
      const ctx = createMockContext();
      let state = createInitialConversationState();
      const t1 = await processSaathiTurn('Suggest an outfit', state, ctx);
      expect(t1.clarification?.options).toBeDefined();
      state = t1.updatedState;

      const t2 = await processSaathiTurn('office', state, ctx);
      expect(t2.message).toContain('office');
      expect(t2.domainResult?.outfits?.length).toBeGreaterThan(0);
    });

    it('28. Saves look selection in conversation state when user says "I like the second one"', async () => {
      const ctx = createMockContext();
      let state = createInitialConversationState();
      const t1 = await processSaathiTurn('What should I wear to college?', state, ctx);
      state = t1.updatedState;

      const t2 = await processSaathiTurn('I like the second one', state, ctx);
      expect(t2.updatedState.selectedLookIndex).toBe(1);
      expect(t2.message).toContain('Look 2');
    });

    it('29. Prompts concise clarification when user says "make my outfit more elegant" with multiple looks unselected', async () => {
      const ctx = createMockContext();
      let state = createInitialConversationState();
      // Turn 1 returns multiple outfits
      const t1 = await processSaathiTurn('Give me looks for college', state, ctx);
      expect(t1.domainResult?.outfits?.length).toBeGreaterThan(1);
      state = t1.updatedState;

      // Turn 2: "Make my outfit more elegant" without specifying which look
      const t2 = await processSaathiTurn('Make my outfit more elegant', state, ctx);
      expect(t2.clarification).toBeDefined();
      expect(t2.clarification?.question).toContain('Which look would you like to use');
    });

    it('30. Multi-turn wear logging: "Log the second look as worn" requests confirmation for Look 2', async () => {
      const ctx = createMockContext();
      let state = createInitialConversationState();
      const t1 = await processSaathiTurn('Recommend looks for office', state, ctx);
      state = t1.updatedState;

      const t2 = await processSaathiTurn('Log the second look as worn', state, ctx);
      expect(t2.confirmation).toBeDefined();
      expect(t2.confirmation?.actionType).toBe('RECORD_WEAR');
      if (t1.domainResult?.outfits && t1.domainResult.outfits.length > 1) {
        expect((t2.confirmation?.payload as any).outfit.id).toBe(t1.domainResult.outfits[1].id);
      }
    });
  });

  // =========================================================================
  // SUITE 3: TOOL EXECUTION & PHYSICAL GROUNDING (15 SCENARIOS)
  // =========================================================================
  describe('Suite 3: Tool Execution & Physical Grounding (15 Scenarios)', () => {
    it('31. recommendOutfitsTool produces valid clean looks grounded in wardrobe', async () => {
      const ctx = createMockContext();
      const res = await recommendOutfitsTool.execute(
        { occasion: 'office', season: 'monsoon' },
        ctx
      );
      expect(res.type).toBe('RECOMMENDATION');
      expect(res.outfits?.length).toBeGreaterThan(0);
      for (const outfit of res.outfits || []) {
        for (const item of Object.values(outfit.slots || {}).flat()) {
          expect(item.status).toBe('clean');
        }
      }
    });

    it('32. recommendOutfitsTool honors recentWornItemIds to prevent repeating worn pieces', async () => {
      const ctx = createMockContext();
      const res = await recommendOutfitsTool.execute(
        {
          occasion: 'office',
          season: 'monsoon',
          recentWornItemIds: ['bottom-1'], // Charcoal Trousers worn yesterday
        },
        ctx
      );
      // Outfit should not contain bottom-1
      for (const outfit of res.outfits || []) {
        const bottom = outfit.slots?.bottom?.[0];
        expect(bottom?.id).not.toBe('bottom-1');
      }
    });

    it('33. recommendOutfitsTool returns missing requirements when clean looks cannot form', async () => {
      // Empty wardrobe
      const ctx = createMockContext({ wardrobe: [] });
      const res = await recommendOutfitsTool.execute(
        { occasion: 'office', season: 'monsoon' },
        ctx
      );
      expect(res.outfits?.length).toBe(0);
      expect(res.missingRequirements).toBeDefined();
    });

    it('34. styleItemTool anchors recommendation strictly around specified garment', async () => {
      const ctx = createMockContext();
      const res = await styleItemTool.execute(
        { anchorItemId: 'top-2', occasion: 'casual outing', season: 'summer' },
        ctx
      );
      expect(res.type).toBe('STYLE_ITEM');
      expect(res.outfits?.length).toBeGreaterThan(0);
      for (const outfit of res.outfits || []) {
        const top = outfit.slots?.top?.[0];
        expect(top?.id).toBe('top-2');
      }
    });

    it('35. styleItemTool returns ERROR if anchor garment does not exist', async () => {
      const ctx = createMockContext();
      const res = await styleItemTool.execute(
        { anchorItemId: 'non_existent_item', occasion: 'office', season: 'summer' },
        ctx
      );
      expect(res.type).toBe('ERROR');
      expect(res.summary).toContain('not found');
    });

    it('36. getCurrentWeatherTool returns verified thermal feeling and rain risk', async () => {
      const ctx = createMockContext();
      const res = await getCurrentWeatherTool.execute({}, ctx);
      expect(res.type).toBe('WEATHER');
      expect(res.summary).toContain('26°C');
      expect(res.summary).toContain('Thermal feeling: comfortable');
      expect(res.summary).toContain('rain risk: none');
    });

    it('37. getCurrentWeatherTool reports graceful fallback when weather snapshot is null', async () => {
      const ctx = createMockContext({ weatherSnapshot: null, weather: null });
      const res = await getCurrentWeatherTool.execute({}, ctx);
      expect(res.summary).toContain("can't verify the current weather");
    });

    it('38. getWearAnalyticsTool accurately calculates lifetime wear logs and dormant pieces', async () => {
      const ctx = createMockContext();
      const res = await getWearAnalyticsTool.execute({}, ctx);
      expect(res.type).toBe('WEAR_ANALYTICS');
      expect(res.wearReport).toBeDefined();
      expect(res.wearReport?.totalLifetimeWears).toBeGreaterThanOrEqual(2);
    });

    it('39. getStyleProfileTool returns learned style preferences and fabric guidance', async () => {
      const ctx = createMockContext();
      const res = await getStyleProfileTool.execute({}, ctx);
      expect(res.type).toBe('STYLE_PROFILE');
      expect(res.summary).toContain('white');
      expect(res.summary).toContain('polyester');
    });

    it('40. getWardrobeGapsTool returns structured gap audit and rediscovery opportunities', async () => {
      const ctx = createMockContext();
      const res = await getWardrobeGapsTool.execute({}, ctx);
      expect(res.type).toBe('WARDROBE_GAPS');
      expect(res.gapReport).toBeDefined();
      expect(res.purchaseAssessment).toBeDefined();
    });

    it('41. getPurchaseAssessmentTool parameterized with { subcategory: "jeans" } detects owned jeans and returns NO_PURCHASE_NEEDED', async () => {
      const ctx = createMockContext();
      const res = await getPurchaseAssessmentTool.execute(
        { subcategory: 'jeans', search: 'blue jeans' },
        ctx
      );
      expect(res.type).toBe('PURCHASE_ASSESSMENT');
      expect((res.purchaseAssessment as any).verdict).toBe('NO_PURCHASE_NEEDED');
      expect(res.summary).toContain('You already own 1');
      expect(res.summary).toContain('No additional purchase is justified');
    });

    it('42. getPurchaseAssessmentTool identifies verified gap when category is genuinely missing and required', async () => {
      // Wardrobe with zero outerwear and zero shoes
      const strippedWardrobe = baseWardrobe.filter((i) => i.category === 'Tops');
      const ctx = createMockContext({ wardrobe: strippedWardrobe });
      const res = await getPurchaseAssessmentTool.execute({}, ctx);
      expect(res.type).toBe('PURCHASE_ASSESSMENT');
      expect((res.purchaseAssessment as any).verdict).toBe('PURCHASE_JUSTIFIED');
    });

    it('43. getWardrobeTool filters accurately by category, subcategory, and color', async () => {
      const ctx = createMockContext();
      const res = await getWardrobeTool.execute(
        { category: 'Bottoms', color: 'blue' },
        ctx
      );
      expect(res.items?.length).toBe(1);
      expect(res.items?.[0].id).toBe('bottom-2');
    });

    it('44. createPlanTool creates valid OutfitPlan with date and occasion', async () => {
      const ctx = createMockContext({
        onSavePlan: async (p) =>
          ({ id: 'plan-1', ...p, createdAt: Date.now(), updatedAt: Date.now() }) as any,
      });
      const outfit = {
        id: 'outfit_1',
        template: 'smart_casual',
        slots: { top: [baseWardrobe[0]] },
        score: 1.0,
        why: 'Office look',
      };
      const res = await createPlanTool.execute(
        { date: '2026-10-16', occasion: 'office', outfit },
        ctx
      );
      expect(res.type).toBe('PLAN_CREATED');
      expect(res.createdPlan?.date).toBe('2026-10-16');
      expect(res.createdPlan?.occasion).toBe('office');
    });

    it('45. recordWearTool invokes wear recording callback with target date', async () => {
      let recordedDate = '';
      const ctx = createMockContext({
        onRecordWear: async (_outfit, dateStr) => {
          recordedDate = dateStr;
        },
      });
      const outfit = {
        id: 'outfit_wear_1',
        template: 'casual',
        slots: { top: [baseWardrobe[0]] },
        score: 1.0,
        why: 'Logged look',
      };
      const res = await recordWearTool.execute(
        { outfit, dateStr: '2026-10-15' },
        ctx
      );
      expect(res.type).toBe('WEAR_RECORDED');
      expect(recordedDate).toBe('2026-10-15');
    });
  });

  // =========================================================================
  // SUITE 4: FASHION REASONING & CULTURAL CONSISTENCY (15 SCENARIOS)
  // =========================================================================
  describe('Suite 4: Fashion Reasoning & Cultural Consistency (15 Scenarios)', () => {
    it('46. Office styling recommends formal tailored silhouette and conservative footwear', async () => {
      const ctx = createMockContext();
      const state = createInitialConversationState();
      const turn = await processSaathiTurn('What should I wear to office?', state, ctx);
      expect(turn.message.toLowerCase()).toContain('office');
      expect(turn.message).toMatch(/Oxford Cotton Shirt|Banarasi Katan Silk Saree/);
    });

    it('47. College styling recommends comfortable mobile campus polish', async () => {
      const ctx = createMockContext();
      const state = createInitialConversationState();
      const turn = await processSaathiTurn('What should I wear to college?', state, ctx);
      expect(turn.message).toContain('Daily College Styling Curation');
      expect(turn.message).toContain('sneakers');
    });

    it('48. Interview styling emphasizes executive composure, sharp tailoring, and coordinated leather', async () => {
      const ctx = createMockContext();
      const state = createInitialConversationState();
      const turn = await processSaathiTurn('Interview outfit', state, ctx);
      expect(turn.message).toContain('Interview Styling Curation');
      expect(turn.message).toContain('Executive Composure');
      expect(turn.message).toContain('leather belt and footwear');
    });

    it('49. Puja styling respects cultural decorum with clean ethnic pieces', async () => {
      const ctx = createMockContext();
      const state = createInitialConversationState();
      const turn = await processSaathiTurn('What should I wear to puja?', state, ctx);
      expect(turn.message.toLowerCase()).toContain('puja');
      expect(turn.message).toMatch(/Kurta|Saree/);
    });

    it('50. Wedding guest styling recommends celebratory richness and silk drape', async () => {
      const ctx = createMockContext();
      const state = createInitialConversationState();
      const turn = await processSaathiTurn('Outfit for a wedding guest', state, ctx);
      expect(turn.message).toContain('wedding guest');
    });

    it('51. Casual outing styling achieves relaxed daily balance', async () => {
      const ctx = createMockContext();
      const state = createInitialConversationState();
      const turn = await processSaathiTurn('Recommend a casual outing look', state, ctx);
      expect(turn.message).toContain('casual outing');
      expect(turn.message).toContain('Classic Indigo Denim Jeans');
    });

    it('52. Saree styling masterclass includes footwear clearance and pleat security guidance', async () => {
      const ctx = createMockContext();
      const state = createInitialConversationState();
      const turn = await processSaathiTurn('How to style a saree', state, ctx);
      expect(turn.message).toContain('Saree Styling Masterclass');
      expect(turn.message).toContain('1-inch floor clearance');
      expect(turn.message).toContain('navel pleats');
      expect(turn.message).toContain('pallu');
    });

    it('53. Indo-Western fusion combines ethnic top with western bottom', async () => {
      const ctx = createMockContext();
      const state = createInitialConversationState();
      const turn = await processSaathiTurn('Style an Indo-Western look', state, ctx);
      expect(turn.message).toContain('Indo-Western Fusion Curation');
      expect(turn.message).toContain('Mulmul Chikankari Kurta');
      expect(turn.message).toMatch(/Denim Jeans|Charcoal Trousers/);
    });

    it('54. Color pairing for olive green provides tonal and neutral grounding', async () => {
      const ctx = createMockContext();
      const state = createInitialConversationState();
      const turn = await processSaathiTurn('Which colours pair well with olive green?', state, ctx);
      expect(turn.message).toContain('Color Pairing Guide for OLIVE');
      expect(turn.message).toContain('Tonal / Monochromatic');
      expect(turn.message).toContain('High-Trust Neutral Anchor');
    });

    it('55. Color pairing for navy provides crisp neutral grounding', async () => {
      const ctx = createMockContext();
      const state = createInitialConversationState();
      const turn = await processSaathiTurn('What colours go with navy?', state, ctx);
      expect(turn.message).toContain('Color Pairing Guide for NAVY');
      expect(turn.message).toContain('white, cream, or beige');
    });

    it('56. Premium upgrade applies quiet luxury principles (French tuck, crease elimination, leather tone)', async () => {
      const ctx = createMockContext();
      const state = createInitialConversationState();
      const turn = await processSaathiTurn('Make this look more expensive', state, ctx);
      expect(turn.message).toContain('Quiet Luxury');
      expect(turn.message).toContain('French half-tuck');
      expect(turn.message).toContain('Steam or press');
      expect(turn.message).toContain('Avoid loud visible logos');
    });

    it('57. Minimalist outfit emphasizes pure form and unbroken vertical lines', async () => {
      const ctx = createMockContext();
      const state = createInitialConversationState();
      const turn = await processSaathiTurn('Minimalist outfit', state, ctx);
      expect(turn.message).toContain('Minimalist Capsule Curation');
      expect(turn.message.toLowerCase()).toContain('clean unbroken lines');
    });

    it('58. Restyle underused revives dormant wardrobe pieces with core neutral staples', async () => {
      const ctx = createMockContext();
      const state = createInitialConversationState();
      const turn = await processSaathiTurn('What haven\'t I worn recently?', state, ctx);
      expect(turn.message).toContain('Restyling Underused Wardrobe Gem');
      expect(turn.message).toContain('Mulmul Chikankari Kurta');
    });

    it('59. Retrieves verified craft documentation for Banarasi brocade from Designer\'s Edit', async () => {
      const ctx = createMockContext();
      const state = createInitialConversationState();
      const turn = await processSaathiTurn('Tell me about Banarasi brocade', state, ctx);
      expect(turn.message).toContain('Banarasi Brocade');
      expect(turn.message).toContain('Varanasi');
      expect(turn.message).toContain('Kadhwa');
    });

    it('60. Retrieves verified craft documentation for Chikankari from Designer\'s Edit', async () => {
      const ctx = createMockContext();
      const state = createInitialConversationState();
      const turn = await processSaathiTurn('History of chikankari', state, ctx);
      expect(turn.message).toContain('Chikankari');
      expect(turn.message).toContain('Lucknow');
      expect(turn.message.toLowerCase()).toContain('tepchi');
    });
  });
});
