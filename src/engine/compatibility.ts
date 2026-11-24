import { WardrobeItem, Occasion, Season } from '../types';
import { Template } from './outfitTemplates';

export const sub = (i: WardrobeItem): string => i.subcategory || '';

export const compatible = (slot: string, i: WardrobeItem, t: Template): boolean => {
  if (t.name === 'Western' && slot === 'top') return i.category === 'Tops';
  if (t.name === 'Western' && slot === 'bottom') return i.category === 'Bottoms';
  if (t.name === 'Western' && slot === 'footwear') return i.category === 'Footwear';

  if (t.name === 'Tailored Western' && slot === 'outerwear')
    return (['blazer', 'jacket'].includes(sub(i)) || i.category === 'Outerwear') && sub(i) !== 'bandhgala';
  if (t.name === 'Tailored Western' && slot === 'top') return i.category === 'Tops';
  if (t.name === 'Tailored Western' && slot === 'bottom') return ['trousers', 'jeans'].includes(sub(i));
  if (t.name === 'Tailored Western' && slot === 'footwear') return i.category === 'Footwear';

  if (t.name === 'Western dress' && slot === 'dress') return i.category === 'Dresses';

  if (t.name === 'Kurta look' && slot === 'top')
    return ['kurta', 'kurti', 'anarkali'].includes(sub(i));
  if (t.name === 'Kurta look' && slot === 'bottom')
    return ['jeans', 'palazzo', 'churidar', 'salwar', 'leggings', 'trousers', 'pajama', 'dhoti', 'lungi'].includes(sub(i));
  if (t.name === 'Kurta look' && slot === 'footwear') return i.category === 'Footwear';
  if (t.name === 'Kurta look' && slot === 'dupatta') return sub(i) === 'dupatta';
  if (t.name === 'Kurta look' && slot === 'jacket') return sub(i) === 'nehru jacket';

  if (t.name === 'Kurta with dupatta' && slot === 'top')
    return ['kurta', 'kurti', 'anarkali'].includes(sub(i));
  if (t.name === 'Kurta with dupatta' && slot === 'bottom')
    return ['salwar', 'churidar', 'palazzo', 'pajama', 'leggings', 'trousers', 'jeans', 'dhoti'].includes(sub(i));
  if (t.name === 'Kurta with dupatta' && slot === 'dupatta') return sub(i) === 'dupatta';
  if (t.name === 'Kurta with dupatta' && slot === 'footwear') return i.category === 'Footwear';

  if (t.name === 'Kurta & Nehru jacket' && slot === 'top')
    return ['kurta', 'kurti'].includes(sub(i));
  if (t.name === 'Kurta & Nehru jacket' && slot === 'jacket') return sub(i) === 'nehru jacket';
  if (t.name === 'Kurta & Nehru jacket' && slot === 'bottom')
    return ['churidar', 'pajama', 'salwar', 'trousers', 'jeans', 'palazzo', 'dhoti'].includes(sub(i));
  if (t.name === 'Kurta & Nehru jacket' && slot === 'footwear') return i.category === 'Footwear';

  if (t.name === 'Saree look' && slot === 'saree') return sub(i) === 'saree';
  if (t.name === 'Saree look' && slot === 'blouse')
    return sub(i) === 'blouse' || (['crop top', 'top'].includes(sub(i)) && i.formality >= 3);

  if (t.name === 'Salwar/lehenga set' && slot === 'set')
    return ['salwar set', 'lehenga'].includes(sub(i));
  if (t.name === 'Salwar/lehenga set' && slot === 'dupatta') return sub(i) === 'dupatta';

  if (t.name === 'Lehenga ensemble' && slot === 'blouse')
    return ['blouse', 'crop top', 'top'].includes(sub(i));
  if (t.name === 'Lehenga ensemble' && slot === 'lehenga') return sub(i) === 'lehenga';
  if (t.name === 'Lehenga ensemble' && slot === 'dupatta') return sub(i) === 'dupatta';
  if (t.name === 'Lehenga ensemble' && slot === 'footwear') return i.category === 'Footwear';

  if (t.name === 'Anarkali look' && slot === 'top')
    return sub(i) === 'anarkali';
  if (t.name === 'Anarkali look' && slot === 'dupatta') return sub(i) === 'dupatta';
  if (t.name === 'Anarkali look' && slot === 'bottom')
    return ['churidar', 'leggings', 'salwar', 'palazzo', 'pajama'].includes(sub(i));
  if (t.name === 'Anarkali look' && slot === 'footwear') return i.category === 'Footwear';

  if (t.name === 'Indo-western' && slot === 'top')
    return ['kurta', 'kurti', 'anarkali'].includes(sub(i)) || (sub(i) === 'top' && i.category === 'Ethnic');
  if (t.name === 'Indo-western' && slot === 'bottom')
    return ['jeans', 'trousers', 'shorts', 'skirt', 'palazzo', 'salwar', 'dhoti'].includes(sub(i));
  if (t.name === 'Indo-western' && slot === 'footwear')
    return ['sneakers', 'flats', 'sandals', 'juttis', 'kolhapuris'].includes(sub(i)) || i.category === 'Footwear';

  if (t.name === 'Indo-western tailored' && slot === 'outerwear')
    return ['blazer', 'jacket', 'bandhgala'].includes(sub(i)) || i.category === 'Outerwear';
  if (t.name === 'Indo-western tailored' && slot === 'top')
    return ['kurta', 'kurti', 'top'].includes(sub(i));
  if (t.name === 'Indo-western tailored' && slot === 'bottom')
    return ['jeans', 'trousers'].includes(sub(i));
  if (t.name === 'Indo-western tailored' && slot === 'footwear')
    return ['sneakers', 'flats', 'formal shoes', 'kolhapuris', 'juttis', 'loafers'].includes(sub(i)) || i.category === 'Footwear';

  if (t.name === 'Sherwani look' && slot === 'top')
    return ['sherwani', 'achkan'].includes(sub(i));
  if (t.name === 'Sherwani look' && slot === 'bottom')
    return ['churidar', 'pajama', 'dhoti', 'trousers'].includes(sub(i));
  if (t.name === 'Sherwani look' && slot === 'dupatta') return sub(i) === 'dupatta';
  if (t.name === 'Sherwani look' && slot === 'footwear') return i.category === 'Footwear';

  if (t.name === 'Dhoti & Kurta look' && slot === 'top')
    return ['kurta', 'kurti', 'angrakha', 'shirt'].includes(sub(i));
  if (t.name === 'Dhoti & Kurta look' && slot === 'bottom')
    return ['dhoti', 'lungi'].includes(sub(i));
  if (t.name === 'Dhoti & Kurta look' && slot === 'jacket')
    return sub(i) === 'nehru jacket' || sub(i) === 'blazer';
  if (t.name === 'Dhoti & Kurta look' && slot === 'dupatta') return sub(i) === 'dupatta';
  if (t.name === 'Dhoti & Kurta look' && slot === 'footwear') return i.category === 'Footwear';

  if (t.name === 'Bandhgala look' && slot === 'top')
    return ['bandhgala'].includes(sub(i)) || (sub(i) === 'blazer' && i.category === 'Ethnic');
  if (t.name === 'Bandhgala look' && slot === 'bottom')
    return ['trousers', 'churidar', 'pajama'].includes(sub(i));
  if (t.name === 'Bandhgala look' && slot === 'footwear') return i.category === 'Footwear';

  if (slot === 'footwear') return i.category === 'Footwear';
  if (slot === 'outerwear') return i.category === 'Outerwear';
  if (slot === 'accessory') return i.category === 'Accessories';

  return false;
};

export const occasionFit = (i: WardrobeItem, o: Occasion): boolean => {
  if (!i || !Array.isArray(i.occasions) || i.occasions.length === 0 || !o) {
    return false;
  }
  return i.occasions.includes(o);
};

export type SeasonFitResult = boolean | null;

/**
 * StyleSaathi 4.0.2 (P2-B): Safe season compatibility evaluator.
 * - Returns true if the garment explicitly matches the target season or is 'all year' / 'all_year'.
 * - Returns false if the garment has valid season metadata that does NOT include the target season.
 * - Returns null if the garment's seasons metadata is absent, null, undefined, or empty (neutral/unknown).
 */
export const seasonFit = (i: WardrobeItem, s: Season): boolean | null => {
  if (!i || !i.seasons || !Array.isArray(i.seasons) || i.seasons.length === 0) {
    return null;
  }
  if (!s) {
    return null;
  }
  const normalizedSeasons = i.seasons.map((season) => (season || '').toLowerCase().trim());
  const normalizedTarget = (s || '').toLowerCase().trim();

  if (normalizedSeasons.includes('all year') || normalizedSeasons.includes('all_year')) {
    return true;
  }

  return normalizedSeasons.includes(normalizedTarget);
};
