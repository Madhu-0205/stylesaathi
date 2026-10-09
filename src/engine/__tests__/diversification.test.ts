import { describe, it, expect } from 'vitest';
import { GeneratedOutfit, WardrobeItem } from '../../types';
import {
  calculateOutfitDistance,
  isNearClone,
  suppressNearClones,
  DIVERSIFICATION_DISTANCE_THRESHOLD,
} from '../diversification';

const mockItem = (id: string, name: string, category: any, subcategory: string, colors: string[]): WardrobeItem => ({
  id,
  name,
  category,
  subcategory: subcategory as any,
  colors,
  seasons: ['summer'],
  occasions: ['office'],
  formality: 3,
  status: 'clean',
  favorite: false,
  note: '',
  timesWorn: 1,
});

describe('Diversification & Multi-Dimensional Distance', () => {
  const shirtWhite = mockItem('top-1', 'White Shirt', 'Tops', 'shirt', ['white']);
  const shirtBlue = mockItem('top-2', 'Blue Shirt', 'Tops', 'shirt', ['blue']);
  const kurtiYellow = mockItem('top-3', 'Yellow Kurti', 'Ethnic', 'kurti', ['yellow']);

  const pantsBlack = mockItem('bot-1', 'Black Pants', 'Bottoms', 'trousers', ['black']);
  const pantsNavy = mockItem('bot-2', 'Navy Pants', 'Bottoms', 'trousers', ['navy']);
  const palazzoWhite = mockItem('bot-3', 'White Palazzo', 'Ethnic', 'palazzo', ['white']);

  const outfitA: GeneratedOutfit = {
    template: 'Western casual',
    slots: {
      top: [shirtWhite],
      bottom: [pantsBlack],
    },
    score: 4.5,
    why: 'Classic white shirt and black pants',
  };

  const outfitB_nearClone: GeneratedOutfit = {
    template: 'Western casual',
    slots: {
      top: [shirtWhite],
      bottom: [pantsNavy], // Same shirt, almost same trousers silhouette and colors
    },
    score: 4.3,
    why: 'White shirt and navy pants',
  };

  const outfitC_diverse: GeneratedOutfit = {
    template: 'Kurta with dupatta',
    slots: {
      top: [kurtiYellow],
      bottom: [palazzoWhite],
    },
    score: 4.1,
    why: 'Ethnic yellow kurti and palazzo',
  };

  it('calculates zero distance for identical outfits', () => {
    const dist = calculateOutfitDistance(outfitA, outfitA);
    expect(dist).toBe(0);
  });

  it('detects near-clones when outfits differ only minimally', () => {
    const dist = calculateOutfitDistance(outfitA, outfitB_nearClone);
    // Same template, 50% garment overlap
    expect(isNearClone(outfitA, outfitB_nearClone)).toBe(true);
    expect(dist).toBeLessThan(DIVERSIFICATION_DISTANCE_THRESHOLD);
  });

  it('calculates high distance for diverse silhouettes and color palettes', () => {
    const dist = calculateOutfitDistance(outfitA, outfitC_diverse);
    expect(dist).toBeGreaterThanOrEqual(DIVERSIFICATION_DISTANCE_THRESHOLD);
    expect(isNearClone(outfitA, outfitC_diverse)).toBe(false);
  });

  it('suppresses near-clones from candidate list, preserving distinct alternatives', () => {
    const pool = [outfitA, outfitB_nearClone, outfitC_diverse];
    const diversified = suppressNearClones(pool, DIVERSIFICATION_DISTANCE_THRESHOLD);

    // outfitB_nearClone should be suppressed because it is a clone of higher-scoring outfitA
    expect(diversified.length).toBe(2);
    expect(diversified[0]).toBe(outfitA);
    expect(diversified[1]).toBe(outfitC_diverse);
  });
});
