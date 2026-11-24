import { describe, it, expect } from 'vitest';
import {
  createInitialConversationState,
  processSaathiTurn,
  SaathiConversationState,
  SaathiToolContext,
} from '../index';
import { WardrobeItem } from '../../../types';

const mockWardrobe: WardrobeItem[] = [
  {
    id: 'w_jeans_blue',
    name: 'Slim Fit Blue Jeans',
    category: 'Bottoms',
    subcategory: 'jeans',
    colors: ['blue'],
    formality: 2,
    status: 'clean',
    occasions: ['college', 'casual outing', 'everyday', 'office'],
    seasons: ['summer', 'monsoon', 'winter'],
    favorite: false,
    note: '',
    timesWorn: 0,
  },
  {
    id: 'w_trousers_charcoal',
    name: 'Charcoal Wool Trousers',
    category: 'Bottoms',
    subcategory: 'trousers',
    colors: ['charcoal', 'grey'],
    formality: 4,
    status: 'clean',
    occasions: ['office', 'interview', 'celebration'],
    seasons: ['summer', 'monsoon', 'winter'],
    favorite: false,
    note: '',
    timesWorn: 0,
  },
  {
    id: 'w_shirt_white',
    name: 'Crisp White Oxford Shirt',
    category: 'Tops',
    subcategory: 'shirt',
    colors: ['white'],
    formality: 4,
    status: 'clean',
    occasions: ['office', 'college', 'interview'],
    seasons: ['summer', 'monsoon', 'winter'],
    favorite: false,
    note: '',
    timesWorn: 0,
  },
  {
    id: 'w_tee_black',
    name: 'Classic Black Crewneck Tee',
    category: 'Tops',
    subcategory: 't-shirt',
    colors: ['black'],
    formality: 1.5,
    status: 'clean',
    occasions: ['college', 'casual outing', 'everyday'],
    seasons: ['summer', 'monsoon', 'winter'],
    favorite: false,
    note: '',
    timesWorn: 0,
  },
  {
    id: 'w_polo_navy',
    name: 'Navy Cotton Pique Polo',
    category: 'Tops',
    subcategory: 'shirt',
    colors: ['navy', 'blue'],
    formality: 2.5,
    status: 'clean',
    occasions: ['college', 'casual outing', 'office'],
    seasons: ['summer', 'monsoon', 'winter'],
    favorite: false,
    note: '',
    timesWorn: 0,
  },
  {
    id: 'w_blazer_navy',
    name: 'Tailored Navy Wool Blazer',
    category: 'Outerwear',
    subcategory: 'blazer',
    colors: ['navy'],
    formality: 4.5,
    status: 'clean',
    occasions: ['office', 'interview', 'wedding guest'],
    seasons: ['summer', 'monsoon', 'winter'],
    favorite: false,
    note: '',
    timesWorn: 0,
  },
  {
    id: 'w_loafers_brown',
    name: 'Brown Leather Penny Loafers',
    category: 'Footwear',
    subcategory: 'formal shoes',
    colors: ['brown'],
    formality: 4,
    status: 'clean',
    occasions: ['office', 'interview', 'college'],
    seasons: ['summer', 'monsoon', 'winter'],
    favorite: false,
    note: '',
    timesWorn: 0,
  },
  {
    id: 'w_sneakers_white',
    name: 'Minimal White Leather Sneakers',
    category: 'Footwear',
    subcategory: 'sneakers',
    colors: ['white'],
    formality: 2,
    status: 'clean',
    occasions: ['college', 'casual outing', 'everyday'],
    seasons: ['summer', 'monsoon', 'winter'],
    favorite: false,
    note: '',
    timesWorn: 0,
  },
  {
    id: 'w_saree_silk',
    name: 'Emerald Banarasi Silk Saree',
    category: 'Dresses',
    subcategory: 'saree',
    colors: ['emerald', 'green', 'gold'],
    formality: 5,
    status: 'clean',
    occasions: ['wedding guest', 'festive', 'Diwali'],
    seasons: ['summer', 'monsoon', 'winter'],
    favorite: false,
    note: '',
    timesWorn: 0,
  },
  {
    id: 'w_juttis_gold',
    name: 'Embroidered Gold Juttis',
    category: 'Footwear',
    subcategory: 'juttis',
    colors: ['gold'],
    formality: 4.5,
    status: 'clean',
    occasions: ['wedding guest', 'festive', 'puja'],
    seasons: ['summer', 'monsoon', 'winter'],
    favorite: false,
    note: '',
    timesWorn: 0,
  },
];

const mockToolContext: SaathiToolContext = {
  wardrobe: mockWardrobe,
  referenceTimestamp: 1791892800000, // 2026-10-13T12:00:00Z
  localDate: '2026-10-13',
  preferences: {
    favoriteColors: ['navy', 'white'],
    avoidedColors: [],
    formalityPreference: 'smart_casual',
    comfortPriority: 'balanced',
    preferredAesthetics: ['minimalist', 'classic'],
  } as any,
  styleProfile: {
    archetype: 'The Classic Connoisseur',
    contrastPreference: 'medium',
    formalityBaseline: 3.0,
    dominantColorFamilies: ['navy', 'white'],
  } as any,
  plans: [],
};

describe('Multi-Turn Conversational Stabilization Audit', () => {
  it('executes the full 6-turn sequence with context continuity, anchor retention, and unowned piece handling', async () => {
    let state: SaathiConversationState = createInitialConversationState('audit_turn_test');

    // Turn 1: "Suggest an outfit for a college presentation"
    const t1 = await processSaathiTurn('Suggest an outfit for a college presentation', state, mockToolContext);
    state = t1.updatedState;
    expect(state.activeOccasion).toBe('office');
    expect(state.activeOccasionContext).toContain('college presentation');
    expect(t1.message).toMatch(/look for \*\*office\*\*/i);
    expect(state.activeOutfit).toBeDefined();

    // Turn 2: "Make it more formal"
    const t2 = await processSaathiTurn('Make it more formal', state, mockToolContext);
    state = t2.updatedState;
    expect(state.activeOccasion).toBe('office');
    expect(t2.message).toMatch(/Refined your look to be more formal and elevated for \*\*office\*\*/i);
    expect(state.activeOutfit).toBeDefined();

    // Turn 3: "Keep the same jeans and change the top" (or trousers if trousers were selected)
    const t3 = await processSaathiTurn('Keep the same jeans and change the top', state, mockToolContext);
    state = t3.updatedState;
    expect(state.activeOccasion).toBe('office');
    expect(state.activeAnchorItem?.name).toContain('Jeans');
    // Top must be slotted and bottom must be jeans
    const t3Slots = state.activeOutfit?.slots || {};
    expect(t3Slots.bottom?.[0]?.name).toContain('Jeans');
    expect(t3Slots.top?.[0]).toBeDefined();

    // Turn 4: "Show another combination with the same jeans"
    const t4 = await processSaathiTurn('Show another combination with the same jeans', state, mockToolContext);
    state = t4.updatedState;
    expect(state.activeOccasion).toBe('office');
    expect(state.activeAnchorItem?.name).toContain('Jeans');
    const t4Slots = state.activeOutfit?.slots || {};
    expect(t4Slots.bottom?.[0]?.name).toContain('Jeans');

    // Turn 5: "Explain why the combination works"
    const t5 = await processSaathiTurn('Explain why the combination works', state, mockToolContext);
    state = t5.updatedState;
    expect(t5.message).toMatch(/why/i);
    expect(t5.message).toMatch(/works well/i);

    // Turn 6: "Can you style a neon green velvet poncho with this?"
    const t6 = await processSaathiTurn('Can you style a neon green velvet poncho with this?', state, mockToolContext);
    expect(t6.message).toMatch(/I couldn't find a \*\*neon green velvet poncho\*\* in your wardrobe/i);
    expect(t6.message).toMatch(/alternative combination using your existing/i);
  });

  describe('Constraint Removals and Anchor Unlocking', () => {
    it('removes outer layer upon "without the jacket"', async () => {
      let state = createInitialConversationState('remove_layer_test');
      // Style blazer for interview
      const t1 = await processSaathiTurn('Style my tailored navy wool blazer for an interview', state, mockToolContext);
      state = t1.updatedState;
      expect(state.activeOutfit?.slots?.outerwear || state.activeOutfit?.slots?.layer).toBeDefined();

      // Remove layer
      const t2 = await processSaathiTurn('without the jacket', state, mockToolContext);
      state = t2.updatedState;
      expect(t2.message).toMatch(/Removed the layer from your look/i);
      expect(state.activeOutfit?.slots?.layer).toBeUndefined();
      expect(state.activeOutfit?.slots?.outerwear).toBeUndefined();
    });

    it('unlocks anchor upon "unlock anchor"', async () => {
      let state = createInitialConversationState('unlock_anchor_test');
      const t1 = await processSaathiTurn('Keep the same jeans and change the top', state, mockToolContext);
      state = t1.updatedState;
      expect(state.activeAnchorItem).toBeDefined();

      const t2 = await processSaathiTurn('unlock anchor', state, mockToolContext);
      state = t2.updatedState;
      expect(state.activeAnchorItem).toBeUndefined();
      expect(state.resolvedEntities.anchorGarmentName).toBeUndefined();
    });

    it('switching occasion clears old casual anchor', async () => {
      let state = createInitialConversationState('occasion_switch_test');
      const t1 = await processSaathiTurn('Style my blue jeans for college', state, mockToolContext);
      state = t1.updatedState;
      expect(state.activeAnchorItem?.name).toContain('Jeans');
      expect(state.activeOccasion).toBe('college');

      // Switch to wedding guest
      const t2 = await processSaathiTurn('Suggest an outfit for a wedding', state, mockToolContext);
      state = t2.updatedState;
      expect(state.activeOccasion).toBe('wedding guest');
      expect(state.activeAnchorItem).toBeUndefined();
      expect(t2.message).not.toContain('Jeans');
    });

    it('new conversation starts completely clean without previous context', async () => {
      const cleanState = createInitialConversationState('fresh_conversation');
      expect(cleanState.messages.length).toBe(0);
      expect(cleanState.activeAnchorItem).toBeUndefined();
      expect(cleanState.activeOccasion).toBeUndefined();
      expect(cleanState.resolvedEntities).toEqual({});
    });
  });
});
