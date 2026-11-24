import { describe, it, expect } from 'vitest';
import {
  generateSaathiMessageId,
  processSaathiTurn,
  createInitialConversationState,
  SaathiToolContext,
} from '../engine/saathi';
import { sampleWardrobe } from '../data/sampleWardrobe';

describe('Task 1 (P1): Assistant and User Message Unique ID Generator', () => {
  it('generates strictly unique IDs for calls within the exact same millisecond', () => {
    const fixedTs = 1795434358791;
    const ids = new Set<string>();
    const count = 1000;

    for (let i = 0; i < count; i++) {
      const id = generateSaathiMessageId('a', fixedTs);
      expect(ids.has(id)).toBe(false);
      ids.add(id);
      expect(id).toMatch(/^msg_a_1795434358791_\d+_[a-z0-9]+$/);
    }

    expect(ids.size).toBe(count);
  });

  it('generates unique user and assistant IDs across rapid consecutive turns without timestamp progression', async () => {
    const fixedTs = 1795434358791;
    const mockContext: SaathiToolContext = {
      wardrobe: sampleWardrobe,
      preferences: {
        preferredAesthetics: ['western'],
      } as any,
      styleProfile: {
        dominantAesthetics: ['western'],
      } as any,
      plans: [],
      weatherSnapshot: null,
      referenceTimestamp: fixedTs,
      localDate: '2026-11-23',
      onSavePlan: async (plan: any) => plan,
      onRecordWear: async () => {},
    };

    let state = createInitialConversationState('test_rapid_thread');

    // Turn 1
    const res1 = await processSaathiTurn('Suggest an outfit for college', state, mockContext);
    state = res1.updatedState;

    // Turn 2 in the same millisecond with same referenceTimestamp
    const res2 = await processSaathiTurn('Make it more formal', state, mockContext);
    state = res2.updatedState;

    // Turn 3
    const res3 = await processSaathiTurn('Keep the same jeans and change the top', state, mockContext);
    state = res3.updatedState;

    // Turn 4
    const res4 = await processSaathiTurn('Show another combination', state, mockContext);
    state = res4.updatedState;

    expect(state.messages.length).toBe(8); // 4 user + 4 assistant

    const allIds = state.messages.map((m) => m.id);
    const uniqueIds = new Set(allIds);

    // Assert: Every single message has a unique ID, zero duplicates
    expect(uniqueIds.size).toBe(allIds.length);

    // Verify stable format
    state.messages.forEach((msg) => {
      if (msg.sender === 'user') {
        expect(msg.id).toMatch(/^msg_u_/);
      } else {
        expect(msg.id).toMatch(/^msg_a_/);
      }
    });
  });

  it('ensures IDs remain stable and immutable across conversation state transitions', async () => {
    const mockContext: SaathiToolContext = {
      wardrobe: sampleWardrobe,
      preferences: { preferredAesthetics: ['western'] } as any,
      styleProfile: { dominantAesthetics: ['western'] } as any,
      plans: [],
      weatherSnapshot: null,
      referenceTimestamp: 1716500000000,
      localDate: '2026-11-23',
      onSavePlan: async (plan: any) => plan,
      onRecordWear: async () => {},
    };

    let state = createInitialConversationState('immutable_id_test');
    const res1 = await processSaathiTurn('College look', state, mockContext);
    const initialAssistantId = res1.updatedState.messages[1].id;

    // Next turn
    const res2 = await processSaathiTurn('Another look', res1.updatedState, mockContext);
    const persistedFirstAssistantId = res2.updatedState.messages[1].id;

    // Must be completely stable (not recomputed from array index or state updates)
    expect(persistedFirstAssistantId).toBe(initialAssistantId);
  });
});
