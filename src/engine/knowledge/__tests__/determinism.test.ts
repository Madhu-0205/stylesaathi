import { describe, it, expect } from 'vitest';
import { WardrobeItem } from '../../../types';
import { fashionKnowledgeEngine } from '../fashionKnowledgeEngine';
import {
  GARMENT_CONCEPTS,
  ENSEMBLE_STRUCTURES,
  FABRIC_CONCEPTS,
  PATTERN_CONCEPTS,
  REGIONAL_TRADITIONS,
  FESTIVAL_CONTEXT_RULES,
} from '../knowledgeData';

function mockPiece(patch: Partial<WardrobeItem>): WardrobeItem {
  return {
    id: patch.id || 'item-1',
    name: patch.name || 'Mock Item',
    category: patch.category || 'Ethnic',
    subcategory: patch.subcategory || 'kurta',
    colors: patch.colors || ['yellow'],
    seasons: patch.seasons || ['summer'],
    occasions: patch.occasions || ['festive'],
    formality: patch.formality || 4,
    status: patch.status || 'clean',
    favorite: false,
    note: '',
    timesWorn: 0,
    fabric: patch.fabric || 'silk',
    pattern: patch.pattern || 'zari_brocade',
    fit: patch.fit || 'regular',
    ...patch,
  };
}

describe('IFKG Determinism & Immutability Verification', () => {
  it('guarantees 100% identical signals across 1,000 repeated invocations', () => {
    const kurta = mockPiece({ id: 'k1', subcategory: 'kurta', fabric: 'silk', pattern: 'zari_brocade' });
    const pajama = mockPiece({ id: 'p1', subcategory: 'pajama', fabric: 'silk', pattern: 'solid' });
    const juttis = mockPiece({ id: 'j1', category: 'Footwear', subcategory: 'juttis' });

    const context = {
      occasion: 'Diwali' as const,
      regionalPreference: 'north',
    };

    const baseline = fashionKnowledgeEngine.getSignals([kurta, pajama, juttis], context);
    const baselineSerialized = JSON.stringify(baseline);

    for (let i = 0; i < 1000; i++) {
      const current = fashionKnowledgeEngine.getSignals([kurta, pajama, juttis], context);
      expect(JSON.stringify(current)).toBe(baselineSerialized);
    }
  });

  it('proves that canonical knowledge datasets are strictly frozen and immutable at runtime', () => {
    expect(Object.isFrozen(GARMENT_CONCEPTS)).toBe(true);
    expect(Object.isFrozen(ENSEMBLE_STRUCTURES)).toBe(true);
    expect(Object.isFrozen(FABRIC_CONCEPTS)).toBe(true);
    expect(Object.isFrozen(PATTERN_CONCEPTS)).toBe(true);
    expect(Object.isFrozen(REGIONAL_TRADITIONS)).toBe(true);
    expect(Object.isFrozen(FESTIVAL_CONTEXT_RULES)).toBe(true);

    // Attempting to mutate in strict mode will throw or fail silently
    expect(() => {
      (GARMENT_CONCEPTS['kurta'] as any).category = 'Outerwear';
    }).toThrow();
  });

  it('guarantees that mutating input items does not contaminate engine internals', () => {
    const mutableItem = mockPiece({ id: 'mut-1', subcategory: 'kurta' });
    const sig1 = fashionKnowledgeEngine.getSignals([mutableItem]);

    // Mutate outside
    mutableItem.subcategory = 'shorts';
    mutableItem.category = 'Bottoms';

    const sig2 = fashionKnowledgeEngine.getSignals([mutableItem]);
    expect(sig1).not.toEqual(sig2); // Correctly evaluates mutated input without caching stale references
  });
});
