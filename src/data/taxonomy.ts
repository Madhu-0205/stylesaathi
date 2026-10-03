import { Category, Subcategory, Season, Occasion, Status } from '../types';

export const CATEGORIES: Category[] = [
  'Tops',
  'Bottoms',
  'Ethnic',
  'Dresses',
  'Outerwear',
  'Footwear',
  'Accessories',
];

export const SUBCATEGORIES: Record<Category, Subcategory[]> = {
  Tops: ['t-shirt', 'shirt', 'crop top', 'hoodie', 'sweater'],
  Bottoms: ['jeans', 'trousers', 'shorts', 'skirt', 'leggings', 'joggers'],
  Ethnic: [
    'kurta',
    'kurti',
    'saree',
    'blouse',
    'lehenga',
    'salwar set',
    'sherwani',
    'palazzo',
    'churidar',
    'dupatta',
    'nehru jacket',
  ],
  Dresses: ['western dress', 'co-ord set'],
  Outerwear: ['jacket', 'blazer', 'shrug'],
  Footwear: [
    'sneakers',
    'formal shoes',
    'heels',
    'flats',
    'sandals',
    'juttis',
    'kolhapuris',
  ],
  Accessories: ['bag', 'watch', 'jewellery', 'belt', 'sunglasses', 'scarf'],
};

export const SEASONS: Season[] = ['summer', 'monsoon', 'winter'];

export const OCCASIONS: Occasion[] = [
  'college',
  'office',
  'casual outing',
  'date',
  'party',
  'family function',
  'wedding guest',
  'Diwali',
  'Holi',
  'Eid',
  'puja',
  'travel',
];

export const STATUSES: Status[] = ['clean', 'needs_washing', 'in_laundry'];

export const STYLE_VIBES = ['Casual', 'Ethnic-loving', 'Indo-western', 'Minimal'] as const;

export const COLOR_PALETTE = [
  'white',
  'black',
  'cream',
  'beige',
  'navy',
  'blue',
  'olive',
  'mustard',
  'pink',
  'green',
  'brown',
  'gold',
  'silver',
  'red',
  'purple',
  'grey',
];
