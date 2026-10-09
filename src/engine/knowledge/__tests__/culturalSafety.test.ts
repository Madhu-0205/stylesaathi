import { describe, it, expect } from 'vitest';
import { WardrobeItem } from '../../../types';
import { getCulturalSignals } from '../culturalSignals';

function mockPiece(patch: Partial<WardrobeItem>): WardrobeItem {
  return {
    id: patch.id || 'item-1',
    name: patch.name || 'Mock Item',
    category: patch.category || 'Tops',
    subcategory: patch.subcategory || 'shirt',
    colors: patch.colors || ['blue'],
    seasons: patch.seasons || ['summer'],
    occasions: patch.occasions || ['everyday'],
    formality: patch.formality || 2,
    status: patch.status || 'clean',
    favorite: false,
    note: '',
    timesWorn: 0,
    ...patch,
  };
}

describe('IFKG Cultural Safety & Resonance Engine', () => {
  it('emits positive festive resonance signals for Diwali celebratory fabrics and colors', () => {
    const kurta = mockPiece({
      id: 'k1',
      category: 'Ethnic',
      subcategory: 'kurta',
      fabric: 'silk',
      colors: ['gold'],
    });
    const pajama = mockPiece({
      id: 'p1',
      category: 'Ethnic',
      subcategory: 'pajama',
      fabric: 'silk',
      colors: ['cream'],
    });

    const signals = getCulturalSignals([kurta, pajama], {
      occasion: 'Diwali',
    });

    expect(signals.some((s) => s.type === 'cultural_resonance')).toBe(true);
    const fabricSignal = signals.find((s) => s.explanationKey === 'festive_textile_resonance');
    expect(fabricSignal).toBeDefined();
    expect(fabricSignal?.strength).toBeGreaterThan(0.7);
  });

  it('emits positive cultural resonance for Eid pastel and chikankari textiles', () => {
    const kurti = mockPiece({
      id: 'k1',
      category: 'Ethnic',
      subcategory: 'kurti',
      fabric: 'mulmul',
      pattern: 'chikankari',
      colors: ['white', 'pastel blue'],
    });

    const signals = getCulturalSignals([kurti], {
      occasion: 'Eid',
    });

    expect(signals.some((s) => s.type === 'cultural_resonance')).toBe(true);
  });

  it('emits soft occasion mismatch for casual shorts/sneakers in devotional puja context', () => {
    const tee = mockPiece({ id: 't1', category: 'Tops', subcategory: 't-shirt' });
    const shorts = mockPiece({ id: 's1', category: 'Bottoms', subcategory: 'shorts' });

    const signals = getCulturalSignals([tee, shorts], {
      occasion: 'puja',
    });

    const mismatch = signals.find((s) => s.explanationKey === 'devotional_informal_piece_mismatch');
    expect(mismatch).toBeDefined();
    expect(mismatch?.type).toBe('occasion_fit');
    expect(mismatch?.strength).toBeLessThan(0);
  });

  it('dampens cultural mismatch penalties when user explicitly prefers modern western aesthetic', () => {
    const tee = mockPiece({ id: 't1', category: 'Tops', subcategory: 't-shirt' });
    const shorts = mockPiece({ id: 's1', category: 'Bottoms', subcategory: 'shorts' });

    const standardSignals = getCulturalSignals([tee, shorts], {
      occasion: 'puja',
      userAesthetics: [],
    });

    const overriddenSignals = getCulturalSignals([tee, shorts], {
      occasion: 'puja',
      userAesthetics: ['modern western'],
    });

    const standardMismatch = standardSignals.find((s) => s.explanationKey === 'devotional_informal_piece_mismatch');
    const overriddenMismatch = overriddenSignals.find((s) => s.explanationKey === 'devotional_informal_piece_mismatch');

    expect(standardMismatch).toBeDefined();
    expect(overriddenMismatch).toBeDefined();
    // Overridden penalty is damped by 50%
    expect(Math.abs(overriddenMismatch!.strength)).toBeLessThan(Math.abs(standardMismatch!.strength));
  });

  it('evaluates declared modesty preference without breaking limited wardrobes', () => {
    const cropTop = mockPiece({ id: 'ct1', category: 'Tops', subcategory: 'crop top' });
    const jeans = mockPiece({ id: 'j1', category: 'Bottoms', subcategory: 'jeans' });

    const signals = getCulturalSignals([cropTop, jeans], {
      declaredModestyLevel: 'high',
    });

    const modestySignal = signals.find((s) => s.explanationKey === 'modesty_preference_mismatch');
    expect(modestySignal).toBeDefined();
    expect(modestySignal?.strength).toBeLessThan(0);
  });
});
