import { describe, it, expect } from 'vitest';
import { autoTagImage } from '../../services/autoTag';
import { calculateOutfitScore } from '../scoring';
import { WardrobeItem } from '../../types';

describe('Wardrobe Intelligence 2.0 & AutoTagging', () => {
  it('extracts fabric, pattern, and confidence levels from garment images', async () => {
    const silkKurtaFile = new File(['mock content'], 'raw-silk-chikankari-kurta.jpg', { type: 'image/jpeg' });
    const tagResult = await autoTagImage(silkKurtaFile);

    expect(tagResult.category).toBe('Ethnic');
    expect(tagResult.subcategory).toBe('kurta');
    expect(tagResult.fabric).toBe('silk');
    expect(tagResult.pattern).toBe('chikankari');
    expect(tagResult.confidence).toBeGreaterThanOrEqual(0.8);
    expect(tagResult.confidenceLevel).toBe('HIGH');
  });

  it('marks unverified suggestions with low/medium confidence when filename is generic', async () => {
    const genericFile = new File(['mock content'], 'IMG_20261008_991823.jpg', { type: 'image/jpeg' });
    const tagResult = await autoTagImage(genericFile);

    expect(tagResult.confidence).toBeLessThan(0.8);
    expect(['LOW', 'MEDIUM']).toContain(tagResult.confidenceLevel);
    expect(tagResult.note).toContain('Suggested by AI');
  });

  it('calculates outfit score safely for legacy items with no fabric or pattern defined', () => {
    const legacyItem1: WardrobeItem = {
      id: 'legacy-top',
      name: 'White Top',
      category: 'Tops',
      subcategory: 't-shirt',
      colors: ['white'],
      seasons: ['summer'],
      occasions: ['college'],
      formality: 2,
      status: 'clean',
      favorite: false,
      note: '',
      timesWorn: 1,
    };

    const legacyItem2: WardrobeItem = {
      id: 'legacy-bottom',
      name: 'Blue Jeans',
      category: 'Bottoms',
      subcategory: 'jeans',
      colors: ['blue'],
      seasons: ['summer'],
      occasions: ['college'],
      formality: 2,
      status: 'clean',
      favorite: false,
      note: '',
      timesWorn: 1,
    };

    const score = calculateOutfitScore([legacyItem1, legacyItem2], 'college');
    expect(typeof score).toBe('number');
    expect(isNaN(score)).toBe(false);
  });

  it('awards higher score to outfits with harmonious pattern pairing (solid + print)', () => {
    const solidTop: WardrobeItem = {
      id: 'solid-top',
      name: 'Solid White Kurta',
      category: 'Ethnic',
      subcategory: 'kurta',
      colors: ['white'],
      seasons: ['summer'],
      occasions: ['festive'],
      formality: 4,
      status: 'clean',
      favorite: false,
      note: '',
      timesWorn: 0,
      fabric: 'cotton',
      pattern: 'solid',
    };

    const bandhaniBottom: WardrobeItem = {
      id: 'bandhani-bottom',
      name: 'Bandhani Palazzo',
      category: 'Ethnic',
      subcategory: 'palazzo',
      colors: ['red'],
      seasons: ['summer'],
      occasions: ['festive'],
      formality: 4,
      status: 'clean',
      favorite: false,
      note: '',
      timesWorn: 0,
      fabric: 'cotton',
      pattern: 'bandhani',
    };

    const clashingPrintBottom: WardrobeItem = {
      id: 'clashing-bottom',
      name: 'Ikat Palazzo',
      category: 'Ethnic',
      subcategory: 'palazzo',
      colors: ['red'],
      seasons: ['summer'],
      occasions: ['festive'],
      formality: 4,
      status: 'clean',
      favorite: false,
      note: '',
      timesWorn: 0,
      fabric: 'cotton',
      pattern: 'ikat',
    };

    // Solid + Bandhani should score higher than two competing prints
    const scoreHarmonious = calculateOutfitScore([solidTop, bandhaniBottom], 'festive', 0.5);

    const printTop: WardrobeItem = {
      ...solidTop,
      pattern: 'floral',
    };
    const scoreClashing = calculateOutfitScore([printTop, clashingPrintBottom], 'festive', 0.5);

    expect(scoreHarmonious).toBeGreaterThan(scoreClashing);
  });
});
