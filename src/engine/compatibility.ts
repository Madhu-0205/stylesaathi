import { WardrobeItem, Occasion, Season } from '../types';
import { Template } from './outfitTemplates';

export const sub = (i: WardrobeItem): string => i.subcategory || '';

export const compatible = (slot: string, i: WardrobeItem, t: Template): boolean => {
  if (t.name === 'Western' && slot === 'top') return i.category === 'Tops';
  if (t.name === 'Western' && slot === 'bottom') return i.category === 'Bottoms';
  if (t.name === 'Western' && slot === 'footwear') return i.category === 'Footwear';

  if (t.name === 'Western dress' && slot === 'dress') return i.category === 'Dresses';

  if (t.name === 'Kurta look' && slot === 'top') return ['kurta', 'kurti'].includes(sub(i));
  if (t.name === 'Kurta look' && slot === 'bottom')
    return ['jeans', 'palazzo', 'churidar', 'leggings', 'trousers'].includes(sub(i));
  if (t.name === 'Kurta look' && slot === 'footwear') return i.category === 'Footwear';
  if (t.name === 'Kurta look' && slot === 'dupatta') return sub(i) === 'dupatta';
  if (t.name === 'Kurta look' && slot === 'jacket') return sub(i) === 'nehru jacket';

  if (t.name === 'Saree look' && slot === 'saree') return sub(i) === 'saree';
  if (t.name === 'Saree look' && slot === 'blouse') return sub(i) === 'blouse';

  if (t.name === 'Salwar/lehenga set' && slot === 'set')
    return ['salwar set', 'lehenga'].includes(sub(i));
  if (t.name === 'Salwar/lehenga set' && slot === 'dupatta') return sub(i) === 'dupatta';

  if (t.name === 'Indo-western' && slot === 'top') return ['kurta', 'kurti'].includes(sub(i));
  if (t.name === 'Indo-western' && slot === 'bottom') return ['jeans', 'trousers'].includes(sub(i));
  if (t.name === 'Indo-western' && slot === 'footwear')
    return ['sneakers', 'flats'].includes(sub(i));

  if (slot === 'footwear') return i.category === 'Footwear';
  if (slot === 'outerwear') return i.category === 'Outerwear';
  if (slot === 'accessory') return i.category === 'Accessories';

  return false;
};

export const occasionFit = (i: WardrobeItem, o: Occasion): boolean => i.occasions.includes(o);

export const seasonFit = (i: WardrobeItem, s: Season): boolean => i.seasons.includes(s);
