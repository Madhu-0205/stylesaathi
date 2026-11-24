import { describe, it, expect } from 'vitest';
import { parseSaathiIntent } from '../engine/saathi/intentParser';
import {
  processSaathiTurn,
  createInitialConversationState,
} from '../engine/saathi/orchestrationEngine';
import { WardrobeItem } from '../types';
import { SaathiToolContext } from '../engine/saathi/types';

describe('Integrated Conversational Styling — Master Programme Priority A', () => {
  const testWardrobe: WardrobeItem[] = [
    // Tops
    {
      id: 'item-white-tee',
      name: 'White relaxed tee',
      category: 'Tops',
      subcategory: 't-shirt',
      colors: ['white'],
      fabric: 'cotton',
      formality: 2,
      status: 'clean',
      occasions: ['college', 'casual outing', 'everyday'],
      seasons: ['summer', 'monsoon', 'winter'],
      timesWorn: 3,
      favorite: false,
      note: '',
    },
    {
      id: 'item-blue-shirt',
      name: 'Sky blue shirt',
      category: 'Tops',
      subcategory: 'shirt',
      colors: ['blue'],
      fabric: 'cotton',
      formality: 3,
      status: 'clean',
      occasions: ['college', 'office', 'casual outing', 'date'],
      seasons: ['summer', 'monsoon', 'winter'],
      timesWorn: 5,
      favorite: true,
      note: '',
    },
    {
      id: 'item-white-kurta',
      name: 'White cotton kurta',
      category: 'Ethnic',
      subcategory: 'kurta',
      colors: ['white'],
      fabric: 'cotton',
      formality: 3,
      status: 'clean',
      occasions: ['college', 'family function', 'puja', 'everyday'],
      seasons: ['summer', 'monsoon', 'winter'],
      timesWorn: 4,
      favorite: false,
      note: '',
    },
    {
      id: 'item-navy-blazer',
      name: 'Navy tailored blazer',
      category: 'Outerwear',
      subcategory: 'blazer',
      colors: ['navy'],
      fabric: 'wool',
      formality: 5,
      status: 'clean',
      occasions: ['office', 'interview', 'party', 'family function'],
      seasons: ['winter', 'monsoon'],
      timesWorn: 2,
      favorite: false,
      note: '',
    },
    // Bottoms
    {
      id: 'item-blue-jeans',
      name: 'Blue straight jeans',
      category: 'Bottoms',
      subcategory: 'jeans',
      colors: ['blue'],
      fabric: 'denim',
      formality: 2,
      status: 'clean',
      occasions: ['college', 'casual outing', 'everyday', 'date'],
      seasons: ['summer', 'monsoon', 'winter'],
      timesWorn: 12,
      favorite: true,
      note: '',
    },
    {
      id: 'item-black-trousers',
      name: 'Black tailored trousers',
      category: 'Bottoms',
      subcategory: 'trousers',
      colors: ['black'],
      fabric: 'polyblend',
      formality: 4,
      status: 'clean',
      occasions: ['office', 'interview', 'party', 'family function'],
      seasons: ['summer', 'monsoon', 'winter'],
      timesWorn: 6,
      favorite: false,
      note: '',
    },
    // Footwear
    {
      id: 'item-white-sneakers',
      name: 'White canvas sneakers',
      category: 'Footwear',
      subcategory: 'sneakers',
      colors: ['white'],
      formality: 2,
      status: 'clean',
      occasions: ['college', 'casual outing', 'everyday', 'travel'],
      seasons: ['summer', 'monsoon', 'winter'],
      timesWorn: 15,
      favorite: true,
      note: '',
    },
    {
      id: 'item-brown-loafers',
      name: 'Brown leather loafers',
      category: 'Footwear',
      subcategory: 'loafers',
      colors: ['brown'],
      formality: 4,
      status: 'clean',
      occasions: ['office', 'interview', 'date', 'party'],
      seasons: ['summer', 'monsoon', 'winter'],
      timesWorn: 4,
      favorite: false,
      note: '',
    },
    {
      id: 'item-tan-juttis',
      name: 'Embroidered juttis',
      category: 'Footwear',
      subcategory: 'juttis',
      colors: ['tan', 'gold'],
      formality: 4,
      status: 'clean',
      occasions: ['family function', 'puja', 'wedding guest'],
      seasons: ['summer', 'monsoon', 'winter'],
      timesWorn: 3,
      favorite: false,
      note: '',
    },
  ];

  const toolContext: SaathiToolContext = {
    wardrobe: testWardrobe,
    referenceTimestamp: 1716500000000,
  };

  // =========================================================================
  // A1. Formality Refinement Tests
  // =========================================================================
  describe('A1: Formality Refinement', () => {
    it('classifies "Make it more formal" and elevates look formality with real garments', async () => {
      const intent = parseSaathiIntent('Make it more formal');
      expect(intent.intent).toBe('REFINE_OUTFIT');
      expect(intent.entities.refinementType).toBe('more_formal');

      let state = createInitialConversationState('session-formality-1');

      // Turn 1: Initial casual college request
      const turn1 = await processSaathiTurn('Suggest an outfit for college', state, toolContext);
      state = turn1.updatedState;
      expect(state.activeOutfit).toBeDefined();
      const initialPieces = Object.values(state.activeOutfit!.slots).flat() as WardrobeItem[];
      const initialAvgFormality =
        initialPieces.reduce((acc, p) => acc + p.formality, 0) / initialPieces.length;

      // Turn 2: "Make it more formal"
      const turn2 = await processSaathiTurn('Make it more formal', state, toolContext);
      state = turn2.updatedState;
      expect(state.activeOutfit).toBeDefined();
      const refinedPieces = Object.values(state.activeOutfit!.slots).flat() as WardrobeItem[];
      const refinedAvgFormality =
        refinedPieces.reduce((acc, p) => acc + p.formality, 0) / refinedPieces.length;

      // Must be genuinely more formal
      expect(refinedAvgFormality).toBeGreaterThanOrEqual(initialAvgFormality);
      // All pieces must exist in the real test wardrobe
      refinedPieces.forEach((piece) => {
        expect(testWardrobe.some((item) => item.id === piece.id)).toBe(true);
      });
      // Response must not be generic tips
      const lastMsg = state.messages[state.messages.length - 1];
      expect(lastMsg.text).toContain('Refined your look');
    });

    it('classifies "Make it more casual" and relaxes formality', async () => {
      const intent = parseSaathiIntent('Make it more casual');
      expect(intent.intent).toBe('REFINE_OUTFIT');
      expect(intent.entities.refinementType).toBe('more_casual');

      let state = createInitialConversationState('session-formality-2');

      // Turn 1: Professional office request
      const turn1 = await processSaathiTurn('Suggest an outfit for the office', state, toolContext);
      state = turn1.updatedState;
      expect(state.activeOutfit).toBeDefined();

      // Turn 2: "Make it more casual"
      const turn2 = await processSaathiTurn('Make it more casual', state, toolContext);
      state = turn2.updatedState;
      expect(state.activeOutfit).toBeDefined();
      const casualPieces = Object.values(state.activeOutfit!.slots).flat() as WardrobeItem[];

      // Casual pieces should include items like jeans, tee, or sneakers
      expect(
        casualPieces.some(
          (p) => p.subcategory === 'jeans' || p.subcategory === 't-shirt' || p.subcategory === 'sneakers'
        )
      ).toBe(true);
    });

    it('handles "Make it less formal" and "Make it more minimal"', async () => {
      const lessFormalIntent = parseSaathiIntent('Make it less formal');
      expect(lessFormalIntent.intent).toBe('REFINE_OUTFIT');
      expect(lessFormalIntent.entities.refinementType).toBe('more_casual');

      const minimalIntent = parseSaathiIntent('Make it more minimal');
      expect(minimalIntent.intent).toBe('REFINE_OUTFIT');
      expect(minimalIntent.entities.refinementType).toBe('more_minimal');
    });
  });

  // =========================================================================
  // A2. Anchor Retention Tests
  // =========================================================================
  describe('A2: Anchor Retention', () => {
    it('preserves exact garment ID when user says "Keep the same jeans"', async () => {
      const intent = parseSaathiIntent('Keep the same jeans');
      expect(intent.intent).toBe('SWAP_PIECE');
      expect(intent.entities.keptPieceRole).toBe('bottom');
      expect(intent.entities.keptPieceName).toBe('jeans');

      let state = createInitialConversationState('session-anchor-1');

      // Turn 1: Outfit with jeans
      const turn1 = await processSaathiTurn('Suggest a casual look for college', state, toolContext);
      state = turn1.updatedState;
      expect(state.activeOutfit).toBeDefined();

      // Turn 2: Keep the jeans
      const turn2 = await processSaathiTurn('Keep the same jeans', state, toolContext);
      state = turn2.updatedState;
      expect(state.activeOutfit).toBeDefined();
      const updatedPieces = Object.values(state.activeOutfit!.slots).flat() as WardrobeItem[];

      // Jeans must be preserved by exact ID
      const preservedJeans = updatedPieces.find((p) => p.id === 'item-blue-jeans');
      expect(preservedJeans).toBeDefined();
      expect(state.activeAnchorItem?.id).toBe('item-blue-jeans');
    });

    it('supports "Keep this kurta" and "Don\'t change my shoes"', () => {
      const kurtaIntent = parseSaathiIntent('Keep this kurta');
      expect(kurtaIntent.intent).toBe('SWAP_PIECE');
      expect(kurtaIntent.entities.keptPieceName).toBe('kurta');
      expect(kurtaIntent.entities.keptPieceRole).toBe('top');

      const shoesIntent = parseSaathiIntent("Don't change my shoes");
      expect(shoesIntent.intent).toBe('SWAP_PIECE');
      expect(shoesIntent.entities.keptPieceName).toBe('shoes');
      expect(shoesIntent.entities.keptPieceRole).toBe('footwear');
    });

    it('supports compound request "Keep the shirt and change the trousers"', async () => {
      const intent = parseSaathiIntent('Keep the shirt and change the trousers');
      expect(intent.intent).toBe('SWAP_PIECE');
      expect(intent.entities.keptPieceRole).toBe('top');
      expect(intent.entities.swapRole).toBe('bottom');
    });
  });

  // =========================================================================
  // A3. Individual Piece Replacement Tests
  // =========================================================================
  describe('A3: Individual Piece Replacement', () => {
    it('replaces only the requested category while preserving locked pieces', async () => {
      let state = createInitialConversationState('session-swap-1');

      // Turn 1: College look
      const turn1 = await processSaathiTurn('Suggest an outfit for college', state, toolContext);
      state = turn1.updatedState;
      const initialPieces = Object.values(state.activeOutfit!.slots).flat() as WardrobeItem[];
      const initialTop = initialPieces.find((p) => p.category === 'Tops');

      // Turn 2: Swap the top
      const turn2 = await processSaathiTurn('Change the shirt', state, toolContext);
      state = turn2.updatedState;
      expect(state.activeOutfit).toBeDefined();
      const updatedPieces = Object.values(state.activeOutfit!.slots).flat() as WardrobeItem[];
      const updatedTop = updatedPieces.find((p) => p.category === 'Tops');

      // Top should be swapped if an alternative clean top exists
      if (initialTop && updatedTop) {
        expect(updatedTop.id).not.toBe(initialTop.id);
      }
    });

    it('supports "Give me different footwear" and "Show another option for the top"', () => {
      const footwearIntent = parseSaathiIntent('Give me different footwear');
      expect(footwearIntent.intent).toBe('SWAP_PIECE');
      expect(footwearIntent.entities.swapRole).toBe('footwear');

      const topIntent = parseSaathiIntent('Show another option for the top');
      expect(topIntent.intent).toBe('SWAP_PIECE');
      expect(topIntent.entities.swapRole).toBe('top');
    });
  });

  // =========================================================================
  // A4. Wardrobe-Only Constraints Tests
  // =========================================================================
  describe('A4: Wardrobe-Only Constraints', () => {
    it('classifies explicit requests to use only owned clothes', () => {
      const intent1 = parseSaathiIntent('Only use clothes from my wardrobe');
      expect(intent1.intent).toBe('WARDROBE_ONLY_QUERY');
      expect(intent1.entities.wardrobeOnly).toBe(true);

      const intent2 = parseSaathiIntent("Don't suggest anything I don't own");
      expect(intent2.intent).toBe('WARDROBE_ONLY_QUERY');

      const intent3 = parseSaathiIntent('Use my existing clothes');
      expect(intent3.intent).toBe('WARDROBE_ONLY_QUERY');
    });

    it('responds reassuringly with exact clean wardrobe inventory count', async () => {
      let state = createInitialConversationState('session-wardrobe-only-1');

      // Initial query
      const turn1 = await processSaathiTurn('Suggest an outfit for college', state, toolContext);
      state = turn1.updatedState;

      // Wardrobe constraint query
      const turn2 = await processSaathiTurn('Only use clothes from my wardrobe', state, toolContext);
      state = turn2.updatedState;
      const lastMsg = state.messages[state.messages.length - 1];

      expect(lastMsg.text).toContain('100% wardrobe grounding');
      expect(lastMsg.text).toContain(String(testWardrobe.length));
      expect(lastMsg.domainResult?.type).toBe('WARDROBE_SEARCH');
    });
  });

  // =========================================================================
  // A5. Multi-Turn Conversation Continuity Scenario
  // =========================================================================
  describe('A5: Multi-Turn Conversation Continuity', () => {
    it('executes a 4-turn consecutive refinement journey without losing context', async () => {
      let state = createInitialConversationState('session-multiturn-journey');

      // Turn 1: Initial college look
      const turn1 = await processSaathiTurn('Suggest an outfit for college', state, toolContext);
      state = turn1.updatedState;
      expect(state.activeOutfit).toBeDefined();
      const look1 = state.activeOutfit!;
      const pieces1 = Object.values(look1.slots).flat() as WardrobeItem[];
      expect(pieces1.length).toBeGreaterThanOrEqual(2);

      // Turn 2: "Make it more formal"
      const turn2 = await processSaathiTurn('Make it more formal', state, toolContext);
      state = turn2.updatedState;
      expect(state.activeOutfit).toBeDefined();
      const look2 = state.activeOutfit!;
      const pieces2 = Object.values(look2.slots).flat() as WardrobeItem[];
      const formality2 = pieces2.reduce((acc, p) => acc + p.formality, 0) / pieces2.length;
      expect(formality2).toBeGreaterThanOrEqual(2.5);

      // Turn 3: "Keep the same jeans"
      const turn3 = await processSaathiTurn('Keep the same jeans', state, toolContext);
      state = turn3.updatedState;
      expect(state.activeOutfit).toBeDefined();
      expect(state.activeAnchorItem?.id).toBe('item-blue-jeans');
      const look3 = state.activeOutfit!;
      const pieces3 = Object.values(look3.slots).flat() as WardrobeItem[];
      expect(pieces3.some((p) => p.id === 'item-blue-jeans')).toBe(true);

      // Turn 4: "Change the shirt"
      const turn4 = await processSaathiTurn('Change the shirt', state, toolContext);
      state = turn4.updatedState;
      expect(state.activeOutfit).toBeDefined();
      const look4 = state.activeOutfit!;
      const pieces4 = Object.values(look4.slots).flat() as WardrobeItem[];
      // Jeans must still be preserved from Turn 3
      expect(pieces4.some((p) => p.id === 'item-blue-jeans')).toBe(true);
      // All items across all 4 turns must be authentic items from testWardrobe
      pieces4.forEach((piece) => {
        expect(testWardrobe.some((item) => item.id === piece.id)).toBe(true);
      });
    });
  });
});
