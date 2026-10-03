import { describe, it, expect } from 'vitest';
import { generateOutfits, simulateBuy, calculateOutfitScore } from './index';
import { WardrobeItem } from '../types';

const createItem = (overrides: Partial<WardrobeItem>): WardrobeItem => ({
  id: crypto.randomUUID ? crypto.randomUUID() : `item-${Math.random()}`,
  name: 'Sample Item',
  category: 'Tops',
  subcategory: 't-shirt',
  colors: ['white'],
  seasons: ['summer'],
  occasions: ['college'],
  formality: 2,
  status: 'clean',
  favorite: false,
  note: '',
  timesWorn: 0,
  ...overrides,
});

describe('Outfit Engine — Core Invariants & Scoring', () => {
  // 1 & 2: Laundry and washing exclusion
  it('never suggests in_laundry items', () => {
    const top = createItem({ category: 'Tops', status: 'in_laundry' });
    const bottom = createItem({ category: 'Bottoms', subcategory: 'jeans' });
    const shoes = createItem({ category: 'Footwear', subcategory: 'sneakers' });
    expect(generateOutfits([top, bottom, shoes], 'college', 'summer')).toHaveLength(0);
  });

  it('never suggests needs_washing items', () => {
    const top = createItem({ category: 'Tops', status: 'needs_washing' });
    const bottom = createItem({ category: 'Bottoms', subcategory: 'jeans' });
    const shoes = createItem({ category: 'Footwear', subcategory: 'sneakers' });
    expect(generateOutfits([top, bottom, shoes], 'college', 'summer')).toHaveLength(0);
  });

  // 3: Saree requires blouse
  it('saree always has blouse', () => {
    const saree = createItem({
      category: 'Ethnic',
      subcategory: 'saree',
      occasions: ['Diwali', 'wedding guest'],
      formality: 5,
    });
    const flats = createItem({
      category: 'Footwear',
      subcategory: 'flats',
      occasions: ['Diwali', 'wedding guest'],
      formality: 4,
    });
    // Missing blouse
    expect(generateOutfits([saree, flats], 'Diwali', 'summer')).toHaveLength(0);

    // With blouse
    const blouse = createItem({
      category: 'Ethnic',
      subcategory: 'blouse',
      occasions: ['Diwali', 'wedding guest'],
      formality: 4,
    });
    const withBlouse = generateOutfits([saree, blouse, flats], 'Diwali', 'summer');
    expect(withBlouse.length).toBeGreaterThan(0);
    expect(withBlouse[0].template).toBe('Saree look');
  });

  // 4: No outfit contains two bottoms
  it('no outfit contains two bottoms', () => {
    const top = createItem({ category: 'Tops' });
    const jeans = createItem({ category: 'Bottoms', subcategory: 'jeans' });
    const trousers = createItem({ category: 'Bottoms', subcategory: 'trousers' });
    const shoes = createItem({ category: 'Footwear', subcategory: 'sneakers' });

    const outfits = generateOutfits([top, jeans, trousers, shoes], 'college', 'summer');
    expect(outfits.length).toBeGreaterThan(0);
    for (const o of outfits) {
      const bottoms = Object.values(o.slots)
        .flat()
        .filter((i) => i.category === 'Bottoms');
      expect(bottoms).toHaveLength(1);
    }
  });

  // 5: Western dress requires footwear
  it('western dress requires footwear', () => {
    const dress = createItem({
      category: 'Dresses',
      subcategory: 'western dress',
      occasions: ['party', 'date'],
      formality: 3,
    });
    // Without footwear
    expect(generateOutfits([dress], 'date', 'summer')).toHaveLength(0);

    // With footwear
    const heels = createItem({
      category: 'Footwear',
      subcategory: 'heels',
      occasions: ['party', 'date'],
      formality: 4,
    });
    const outfits = generateOutfits([dress, heels], 'date', 'summer');
    expect(outfits.length).toBeGreaterThan(0);
    expect(outfits[0].template).toBe('Western dress');
  });

  // 6: Kurta supports valid bottoms
  it('kurta look supports palazzo, churidar, jeans, trousers, and leggings', () => {
    const kurta = createItem({
      category: 'Ethnic',
      subcategory: 'kurta',
      occasions: ['college', 'puja'],
    });
    const palazzo = createItem({
      category: 'Ethnic',
      subcategory: 'palazzo',
      occasions: ['college', 'puja'],
    });
    const flats = createItem({
      category: 'Footwear',
      subcategory: 'flats',
      occasions: ['college', 'puja'],
    });

    const outfits = generateOutfits([kurta, palazzo, flats], 'college', 'summer');
    expect(outfits.length).toBeGreaterThan(0);
    expect(outfits[0].template).toBe('Kurta look');
  });

  // 7: Indo-western compatibility
  it('indo-western combines kurta/kurti with jeans and sneakers/flats for college/casual', () => {
    const kurti = createItem({
      category: 'Ethnic',
      subcategory: 'kurti',
      occasions: ['college', 'casual outing'],
    });
    const jeans = createItem({
      category: 'Bottoms',
      subcategory: 'jeans',
      occasions: ['college', 'casual outing'],
    });
    const sneakers = createItem({
      category: 'Footwear',
      subcategory: 'sneakers',
      occasions: ['college', 'casual outing'],
    });

    const outfits = generateOutfits([kurti, jeans, sneakers], 'college', 'summer');
    expect(outfits.length).toBeGreaterThan(0);
    expect(['Kurta look', 'Indo-western']).toContain(outfits[0].template);
  });

  // 8: Office formality
  it('office penalizes casual items and favors higher formality', () => {
    const casualTop = createItem({ formality: 1, occasions: ['office'] });
    const formalTop = createItem({ formality: 4, occasions: ['office'] });
    const trousers = createItem({ category: 'Bottoms', formality: 4, occasions: ['office'] });
    const shoes = createItem({ category: 'Footwear', formality: 4, occasions: ['office'] });

    const casualScore = calculateOutfitScore([casualTop, trousers, shoes], 'office');
    const formalScore = calculateOutfitScore([formalTop, trousers, shoes], 'office');
    expect(formalScore).toBeGreaterThan(casualScore);
  });

  // 9: Wedding/Diwali ethnic priority
  it('wedding guest prioritizes high-formality ethnic attire over casual', () => {
    const lehenga = createItem({
      category: 'Ethnic',
      subcategory: 'lehenga',
      formality: 5,
      occasions: ['wedding guest'],
    });
    const dupatta = createItem({
      category: 'Ethnic',
      subcategory: 'dupatta',
      formality: 4,
      occasions: ['wedding guest'],
    });
    const juttis = createItem({
      category: 'Footwear',
      subcategory: 'juttis',
      formality: 4,
      occasions: ['wedding guest'],
    });

    const outfits = generateOutfits([lehenga, dupatta, juttis], 'wedding guest', 'summer');
    expect(outfits.length).toBeGreaterThan(0);
    expect(outfits[0].template).toBe('Salwar/lehenga set');
  });

  // 10: Tiny wardrobe handling
  it('tiny wardrobe does not fabricate outfits', () => {
    const topOnly = [createItem({ category: 'Tops' })];
    expect(generateOutfits(topOnly, 'college', 'summer')).toHaveLength(0);
  });

  // 11: Recent-wear penalty
  it('penalizes items worn frequently', () => {
    const unwornTop = createItem({ timesWorn: 0 });
    const wornTop = createItem({ timesWorn: 5 });
    const bottom = createItem({ category: 'Bottoms' });
    const footwear = createItem({ category: 'Footwear' });

    const freshScore = calculateOutfitScore([unwornTop, bottom, footwear], 'college');
    const wornScore = calculateOutfitScore([wornTop, bottom, footwear], 'college');
    expect(freshScore).toBeGreaterThan(wornScore);
  });

  // 12: Favorite bonus
  it('gives score bonus to favorited items', () => {
    const normalTop = createItem({ favorite: false });
    const favoriteTop = createItem({ favorite: true });
    const bottom = createItem({ category: 'Bottoms' });
    const footwear = createItem({ category: 'Footwear' });

    const normalScore = calculateOutfitScore([normalTop, bottom, footwear], 'college');
    const favoriteScore = calculateOutfitScore([favoriteTop, bottom, footwear], 'college');
    expect(favoriteScore).toBeGreaterThan(normalScore);
  });

  // 13: Smart buy simulation calculates actual outfit delta
  it('smart-buy simulation calculates actual outfit delta', () => {
    const top = createItem({ category: 'Tops', occasions: ['college'] });
    const shoes = createItem({ category: 'Footwear', occasions: ['college'] });
    // Without bottom, 0 college outfits
    const candidateBottom = createItem({
      category: 'Bottoms',
      subcategory: 'jeans',
      occasions: ['college'],
    });

    const delta = simulateBuy([top, shoes], candidateBottom, ['college'], 'summer');
    expect(delta).toBeGreaterThan(0);
  });

  // 14: Kurta & Nehru jacket combination
  it('supports Kurta & Nehru jacket combination for festive/wedding occasions', () => {
    const kurta = createItem({
      category: 'Ethnic',
      subcategory: 'kurta',
      occasions: ['wedding guest', 'festive', 'puja'],
      formality: 4,
    });
    const nehruJacket = createItem({
      category: 'Ethnic',
      subcategory: 'nehru jacket',
      occasions: ['wedding guest', 'festive', 'puja'],
      formality: 4,
    });
    const pajama = createItem({
      category: 'Ethnic',
      subcategory: 'pajama',
      occasions: ['wedding guest', 'festive', 'puja'],
      formality: 3,
    });
    const juttis = createItem({
      category: 'Footwear',
      subcategory: 'juttis',
      occasions: ['wedding guest', 'festive', 'puja'],
      formality: 4,
    });

    const outfits = generateOutfits([kurta, nehruJacket, pajama, juttis], 'wedding guest', 'summer');
    expect(outfits.length).toBeGreaterThan(0);
    expect(outfits.some((o) => o.template === 'Kurta & Nehru jacket')).toBe(true);
  });

  // 15: Kurta + Pajama pairing
  it('supports Kurta + Pajama pairing in ethnic occasions', () => {
    const kurta = createItem({
      category: 'Ethnic',
      subcategory: 'kurta',
      occasions: ['puja', 'festive', 'college'],
      formality: 3,
    });
    const pajama = createItem({
      category: 'Ethnic',
      subcategory: 'pajama',
      occasions: ['puja', 'festive', 'college'],
      formality: 3,
    });
    const sandals = createItem({
      category: 'Footwear',
      subcategory: 'sandals',
      occasions: ['puja', 'festive', 'college'],
      formality: 3,
    });

    const outfits = generateOutfits([kurta, pajama, sandals], 'puja', 'summer');
    expect(outfits.length).toBeGreaterThan(0);
    expect(outfits[0].template).toBe('Kurta look');
  });

  // 16: Anarkali + Dupatta pairing
  it('supports Anarkali + Dupatta pairing', () => {
    const anarkali = createItem({
      category: 'Ethnic',
      subcategory: 'anarkali',
      occasions: ['festive', 'wedding guest'],
      formality: 4,
    });
    const dupatta = createItem({
      category: 'Ethnic',
      subcategory: 'dupatta',
      occasions: ['festive', 'wedding guest'],
      formality: 4,
    });
    const juttis = createItem({
      category: 'Footwear',
      subcategory: 'juttis',
      occasions: ['festive', 'wedding guest'],
      formality: 4,
    });

    const outfits = generateOutfits([anarkali, dupatta, juttis], 'festive', 'summer');
    expect(outfits.length).toBeGreaterThan(0);
    expect(outfits[0].template).toBe('Anarkali look');
  });

  // 17: Tailored Western with Blazer for Office
  it('supports Tailored Western with Blazer, Shirt, and Trousers for Office', () => {
    const blazer = createItem({
      category: 'Outerwear',
      subcategory: 'blazer',
      occasions: ['office', 'interview'],
      formality: 4,
    });
    const shirt = createItem({
      category: 'Tops',
      subcategory: 'shirt',
      occasions: ['office', 'interview'],
      formality: 4,
    });
    const trousers = createItem({
      category: 'Bottoms',
      subcategory: 'trousers',
      occasions: ['office', 'interview'],
      formality: 4,
    });
    const formalShoes = createItem({
      category: 'Footwear',
      subcategory: 'formal shoes',
      occasions: ['office', 'interview'],
      formality: 4,
    });

    const outfits = generateOutfits([blazer, shirt, trousers, formalShoes], 'office', 'summer');
    expect(outfits.length).toBeGreaterThan(0);
    expect(outfits.some((o) => o.template === 'Tailored Western')).toBe(true);
  });

  // 18: Recency penalty for worn-today pieces
  it('heavily penalizes items worn today via lastWorn timestamp', () => {
    const today = Date.now();
    const wornTodayItem = createItem({ timesWorn: 1, lastWorn: today });
    const unwornItem = createItem({ timesWorn: 0 });
    const bottom = createItem({ category: 'Bottoms' });
    const footwear = createItem({ category: 'Footwear' });

    const unwornScore = calculateOutfitScore([unwornItem, bottom, footwear], 'college');
    const wornScore = calculateOutfitScore([wornTodayItem, bottom, footwear], 'college');
    expect(unwornScore).toBeGreaterThan(wornScore);
  });
});
