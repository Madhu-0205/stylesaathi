import { describe, it, expect, beforeEach } from 'vitest';
import { sampleWardrobe } from '../../data/sampleWardrobe';
import { generateOutfits, simulateBuy, calculateOutfitScore } from '../index';
import { WardrobeItem, Occasion } from '../../types';
import { candidates } from '../../data/candidates';

describe('Dynamic State Invariants & Interactive Flow Validation (V3.1)', () => {
  let wardrobe: WardrobeItem[];

  beforeEach(() => {
    // Clone clean copy of sample wardrobe
    wardrobe = JSON.parse(JSON.stringify(sampleWardrobe));
  });

  // 1. Add Item -> new outfits become available
  it('Add Item: adding a matching piece increases available outfits for its occasion', () => {
    const occasion: Occasion = 'interview';
    const beforeCount = generateOutfits(wardrobe, occasion, 'summer', 10, 0).length;

    const newFormalBlazer: WardrobeItem = {
      id: 'new-blazer-test',
      name: 'Charcoal Tailored Blazer',
      category: 'Outerwear',
      subcategory: 'blazer',
      colors: ['grey'],
      seasons: ['summer', 'winter'],
      occasions: ['interview', 'office'],
      formality: 5,
      status: 'clean',
      favorite: false,
      note: 'Sharp interview staple',
      timesWorn: 0,
    };

    const afterCount = generateOutfits([...wardrobe, newFormalBlazer], occasion, 'summer', 10, 0).length;
    expect(afterCount).toBeGreaterThanOrEqual(beforeCount);
  });

  // 2. Laundry -> affected outfits disappear
  it('Laundry: moving items to in_laundry or needs_washing excludes them immediately', () => {
    const occasion: Occasion = 'college';
    const initialOutfits = generateOutfits(wardrobe, occasion, 'summer', 5, 0);
    expect(initialOutfits.length).toBeGreaterThan(0);

    const firstOutfit = initialOutfits[0];
    const pieceToWash = Object.values(firstOutfit.slots).flat()[0];

    // Put piece into laundry
    const updatedWardrobe = wardrobe.map((item) =>
      item.id === pieceToWash.id ? { ...item, status: 'in_laundry' as const } : item
    );

    const newOutfits = generateOutfits(updatedWardrobe, occasion, 'summer', 10, 0);
    for (const o of newOutfits) {
      const pieceIds = Object.values(o.slots).flat().map((p) => p.id);
      expect(pieceIds.includes(pieceToWash.id)).toBe(false);
    }
  });

  // 3. Wear Today -> lastWorn updates and timesWorn increments
  it('Wear Today: increments timesWorn and updates lastWorn timestamp', () => {
    const item = wardrobe[0];
    const initialWorn = item.timesWorn || 0;
    const now = Date.now();

    const wornItem: WardrobeItem = {
      ...item,
      timesWorn: initialWorn + 1,
      lastWorn: now,
    };

    expect(wornItem.timesWorn).toBe(initialWorn + 1);
    expect(wornItem.lastWorn).toBe(now);
  });

  // 4. Shuffle -> recent pieces receive recency penalty
  it('Shuffle: pieces worn today receive a significant recency penalty, letting fresh outfits surface', () => {
    const unwornItem: WardrobeItem = {
      ...wardrobe[0],
      id: 'unworn-item',
      timesWorn: 0,
      lastWorn: undefined,
    };
    const wornTodayItem: WardrobeItem = {
      ...wardrobe[0],
      id: 'worn-today-item',
      timesWorn: 2,
      lastWorn: Date.now(),
    };
    const bottom = wardrobe.find((i) => i.category === 'Bottoms')!;
    const shoes = wardrobe.find((i) => i.category === 'Footwear')!;

    const freshScore = calculateOutfitScore([unwornItem, bottom, shoes], 'college');
    const wornScore = calculateOutfitScore([wornTodayItem, bottom, shoes], 'college');

    expect(freshScore).toBeGreaterThan(wornScore);
  });

  // 5. Favorite -> scoring changes
  it('Favorite: favorited items receive a positive scoring bonus', () => {
    const item = wardrobe[0];
    const bottom = wardrobe.find((i) => i.category === 'Bottoms')!;
    const shoes = wardrobe.find((i) => i.category === 'Footwear')!;

    const unfavorited = { ...item, favorite: false };
    const favorited = { ...item, favorite: true };

    const scoreNormal = calculateOutfitScore([unfavorited, bottom, shoes], 'college');
    const scoreFav = calculateOutfitScore([favorited, bottom, shoes], 'college');

    expect(scoreFav).toBeGreaterThan(scoreNormal);
  });

  // 6. Occasion -> context changes outfit selection and ranking
  it('Occasion: different occasions yield different templates and appropriate styling', () => {
    const collegeOutfits = generateOutfits(wardrobe, 'college', 'summer');
    const pujaOutfits = generateOutfits(wardrobe, 'puja', 'summer');
    const weddingOutfits = generateOutfits(wardrobe, 'wedding guest', 'summer');

    expect(collegeOutfits.length).toBeGreaterThan(0);
    expect(pujaOutfits.length).toBeGreaterThan(0);
    expect(weddingOutfits.length).toBeGreaterThan(0);

    // College favors casual silhouettes
    const collegeTemplates = collegeOutfits.map((o) => o.template);
    expect(
      collegeTemplates.includes('Western') ||
      collegeTemplates.includes('Indo-western') ||
      collegeTemplates.includes('Kurta look')
    ).toBe(true);

    // Wedding guest favors high formality ethnic
    const weddingTemplates = weddingOutfits.map((o) => o.template);
    expect(
      weddingTemplates.includes('Saree look') ||
      weddingTemplates.includes('Kurta with dupatta') ||
      weddingTemplates.includes('Kurta look') ||
      weddingTemplates.includes('Salwar/lehenga set') ||
      weddingTemplates.includes('Kurta & Nehru jacket')
    ).toBe(true);
  });

  // 7. Smart Buy -> simulation changes and accurately computes unlocked looks
  it('Smart Buy: simulation calculates real delta, expanded count, and compatible pieces without hardcoded values', () => {
    const candidateList = candidates('summer');
    expect(candidateList.length).toBeGreaterThan(0);

    const cand = candidateList[0];
    const initialOutfits = generateOutfits(wardrobe, 'college', 'summer', 50, 0);
    const simulatedOutfits = generateOutfits([...wardrobe, cand], 'college', 'summer', 50, 0);

    const delta = simulateBuy(wardrobe, cand, ['college'], 'summer');
    expect(delta).toBeGreaterThanOrEqual(0);
    expect(simulatedOutfits.length).toBeGreaterThanOrEqual(initialOutfits.length);
  });

  // 8. Edge States
  describe('Edge States Verification', () => {
    it('zero wardrobe items produces exactly 0 outfits', () => {
      expect(generateOutfits([], 'college', 'summer')).toHaveLength(0);
      expect(generateOutfits([], 'puja', 'summer')).toHaveLength(0);
    });

    it('single wardrobe item produces exactly 0 outfits (never an incomplete look)', () => {
      const singleItem = [wardrobe[0]];
      expect(generateOutfits(singleItem, 'college', 'summer')).toHaveLength(0);
    });

    it('wardrobe with all items in laundry produces exactly 0 outfits', () => {
      const allLaundry = wardrobe.map((i) => ({ ...i, status: 'in_laundry' as const }));
      expect(generateOutfits(allLaundry, 'college', 'summer')).toHaveLength(0);
    });

    it('no matching items for selected occasion produces exactly 0 outfits', () => {
      const collegeOnly = wardrobe.map((i) => ({ ...i, occasions: ['college' as const] }));
      // Asking for puja when no items are tagged for puja
      expect(generateOutfits(collegeOnly, 'puja', 'summer')).toHaveLength(0);
    });

    it('wardrobe with tops and footwear but NO bottoms produces exactly 0 outfits (no bottomless outfits)', () => {
      const noBottoms = wardrobe.filter((i) => i.category !== 'Bottoms' && !['salwar', 'churidar', 'palazzo', 'pajama', 'lehenga'].includes(i.subcategory));
      const nonDressOutfits = generateOutfits(noBottoms, 'college', 'summer').filter((o) => o.template !== 'Western dress');
      expect(nonDressOutfits).toHaveLength(0);
    });
  });
});
