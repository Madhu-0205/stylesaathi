import { WardrobeItem, Occasion, Season } from '../types';
import { Template } from './outfitTemplates';

export const sub = (i: WardrobeItem): string => i.subcategory || '';

export const compatible = (slot: string, i: WardrobeItem, t: Template): boolean => {
  if (t.name === 'Western' && slot === 'top') return i.category === 'Tops';
  if (t.name === 'Western' && slot === 'bottom') return i.category === 'Bottoms';
  if (t.name === 'Western' && slot === 'footwear') return i.category === 'Footwear';

  if (t.name === 'Tailored Western' && slot === 'outerwear')
    return ['blazer', 'jacket'].includes(sub(i)) || i.category === 'Outerwear';
  if (t.name === 'Tailored Western' && slot === 'top') return i.category === 'Tops';
  if (t.name === 'Tailored Western' && slot === 'bottom') return ['trousers', 'jeans'].includes(sub(i));
  if (t.name === 'Tailored Western' && slot === 'footwear') return i.category === 'Footwear';

  if (t.name === 'Western dress' && slot === 'dress') return i.category === 'Dresses';

  if (t.name === 'Kurta look' && slot === 'top')
    return ['kurta', 'kurti', 'anarkali'].includes(sub(i));
  if (t.name === 'Kurta look' && slot === 'bottom')
    return ['jeans', 'palazzo', 'churidar', 'salwar', 'leggings', 'trousers', 'pajama'].includes(sub(i));
  if (t.name === 'Kurta look' && slot === 'footwear') return i.category === 'Footwear';
  if (t.name === 'Kurta look' && slot === 'dupatta') return sub(i) === 'dupatta';
  if (t.name === 'Kurta look' && slot === 'jacket') return sub(i) === 'nehru jacket';

  if (t.name === 'Kurta with dupatta' && slot === 'top')
    return ['kurta', 'kurti', 'anarkali'].includes(sub(i));
  if (t.name === 'Kurta with dupatta' && slot === 'bottom')
    return ['salwar', 'churidar', 'palazzo', 'pajama', 'leggings', 'trousers', 'jeans'].includes(sub(i));
  if (t.name === 'Kurta with dupatta' && slot === 'dupatta') return sub(i) === 'dupatta';
  if (t.name === 'Kurta with dupatta' && slot === 'footwear') return i.category === 'Footwear';

  if (t.name === 'Kurta & Nehru jacket' && slot === 'top')
    return ['kurta', 'kurti'].includes(sub(i));
  if (t.name === 'Kurta & Nehru jacket' && slot === 'jacket') return sub(i) === 'nehru jacket';
  if (t.name === 'Kurta & Nehru jacket' && slot === 'bottom')
    return ['churidar', 'pajama', 'salwar', 'trousers', 'jeans', 'palazzo'].includes(sub(i));
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
    return ['kurta', 'kurti', 'top', 'anarkali'].includes(sub(i));
  if (t.name === 'Indo-western' && slot === 'bottom')
    return ['jeans', 'trousers', 'shorts', 'skirt', 'palazzo', 'salwar'].includes(sub(i));
  if (t.name === 'Indo-western' && slot === 'footwear')
    return ['sneakers', 'flats', 'sandals', 'juttis', 'kolhapuris'].includes(sub(i)) || i.category === 'Footwear';

  if (t.name === 'Indo-western tailored' && slot === 'outerwear')
    return ['blazer', 'jacket'].includes(sub(i)) || i.category === 'Outerwear';
  if (t.name === 'Indo-western tailored' && slot === 'top')
    return ['kurta', 'kurti', 'top'].includes(sub(i));
  if (t.name === 'Indo-western tailored' && slot === 'bottom')
    return ['jeans', 'trousers'].includes(sub(i));
  if (t.name === 'Indo-western tailored' && slot === 'footwear')
    return ['sneakers', 'flats', 'formal shoes', 'kolhapuris', 'juttis', 'loafers'].includes(sub(i)) || i.category === 'Footwear';

  if (slot === 'footwear') return i.category === 'Footwear';
  if (slot === 'outerwear') return i.category === 'Outerwear';
  if (slot === 'accessory') return i.category === 'Accessories';

  return false;
};

export const occasionFit = (i: WardrobeItem, o: Occasion): boolean => i.occasions.includes(o);

export const seasonFit = (i: WardrobeItem, s: Season): boolean => i.seasons.includes(s);
