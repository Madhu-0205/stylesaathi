import { describe, it, expect } from 'vitest';
import { WardrobeItem } from '../../../types';
import { getRegionalSignals } from '../regionalSignals';

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

describe('IFKG Regional Safety Engine', () => {
  it('emits ZERO regional signals when no regional preference is specified (zero stereotyping/bias)', () => {
    const kurta = mockPiece({ id: 'k1', category: 'Ethnic', subcategory: 'kurta', fabric: 'cotton' });
    const signals = getRegionalSignals([kurta], undefined);

    expect(signals).toEqual([]);
  });

  it('detects Southern artisanal resonance for Kalamkari motif or handloom cottons when requested', () => {
    const kurti = mockPiece({
      id: 'k1',
      category: 'Ethnic',
      subcategory: 'kurti',
      fabric: 'cotton',
      pattern: 'kalamkari',
    });

    const signals = getRegionalSignals([kurti], {
      regionalPreference: 'south',
    });

    expect(signals.length).toBe(1);
    expect(signals[0].type).toBe('regional_resonance');
    expect(signals[0].strength).toBeGreaterThan(0.7);
    expect(signals[0].metadata?.zone).toBe('south');
  });

  it('detects Western artisanal resonance for Bandhani tie-dye or Ajrakh craft when requested', () => {
    const dupatta = mockPiece({
      id: 'd1',
      category: 'Ethnic',
      subcategory: 'dupatta',
      pattern: 'bandhani',
    });

    const signals = getRegionalSignals([dupatta], {
      regionalPreference: 'west',
    });

    expect(signals.length).toBe(1);
    expect(signals[0].type).toBe('regional_resonance');
    expect(signals[0].metadata?.zone).toBe('west');
  });

  it('resolves state aliases (e.g. "tamil_nadu", "gujarat", "bengal") to corresponding macro-zones', () => {
    const saree = mockPiece({
      id: 's1',
      category: 'Ethnic',
      subcategory: 'saree',
      fabric: 'silk',
      pattern: 'zari_brocade',
    });

    const signalsTamilNadu = getRegionalSignals([saree], { regionalPreference: 'tamil_nadu' });
    const signalsGujarat = getRegionalSignals([saree], { regionalPreference: 'gujarat' });

    expect(signalsTamilNadu[0].metadata?.zone).toBe('south');
    expect(signalsGujarat[0].metadata?.zone).toBe('west');
  });

  it('never throws or forces identity when unknown region is passed', () => {
    const saree = mockPiece({ id: 's1', category: 'Ethnic', subcategory: 'saree' });
    const signals = getRegionalSignals([saree], { regionalPreference: 'atlantis' });

    expect(signals).toEqual([]);
  });
});
