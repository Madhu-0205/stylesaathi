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
  Tops: ['t-shirt', 'shirt', 'top', 'crop top', 'hoodie', 'sweater'],
  Bottoms: [
    'jeans',
    'trousers',
    'salwar',
    'churidar',
    'palazzo',
    'pajama',
    'shorts',
    'skirt',
    'leggings',
    'joggers',
  ],
  Ethnic: [
    'kurta',
    'kurti',
    'anarkali',
    'saree',
    'blouse',
    'lehenga',
    'salwar',
    'salwar set',
    'sherwani',
    'palazzo',
    'churidar',
    'pajama',
    'dupatta',
    'nehru jacket',
  ],
  Dresses: ['dress', 'western dress', 'co-ord set'],
  Outerwear: ['jacket', 'blazer', 'shrug'],
  Footwear: [
    'sneakers',
    'formal shoes',
    'loafers',
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
  'everyday',
  'office',
  'interview',
  'casual outing',
  'date',
  'party',
  'family function',
  'family gathering',
  'puja',
  'festive',
  'wedding guest',
  'celebration',
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

export const FABRICS = [
  'cotton',
  'linen',
  'khadi',
  'silk',
  'chiffon',
  'georgette',
  'denim',
  'wool',
  'rayon',
  'viscose',
  'organza',
  'velvet',
  'satin',
  'crepe',
  'chanderi',
  'banarasi',
  'mulmul',
  'tussar',
  'modal',
  'polyblend',
] as const;

export const PATTERNS = [
  'solid',
  'striped',
  'checked',
  'floral',
  'ikat',
  'bandhani',
  'block_print',
  'kalamkari',
  'chikankari',
  'embroidered',
  'polka_dot',
  'geometric',
  'abstract',
  'zari_brocade',
] as const;

export const SILHOUETTES = [
  'slim',
  'regular',
  'relaxed',
  'oversized',
  'straight',
  'a_line',
  'flared',
  'anarkali',
  'tailored',
] as const;

export const CULTURAL_CONTEXTS = [
  'traditional',
  'contemporary',
  'fusion',
  'ceremonial',
  'everyday_ethnic',
] as const;
