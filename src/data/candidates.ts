import { CandidateItem, Season, Occasion } from '../types';

interface CandidateDef {
  name: string;
  category: CandidateItem['category'];
  subcategory: CandidateItem['subcategory'];
  colors: string[];
  formality: number;
  priceRange?: string;
  reason?: string;
}

const candidateDefs: CandidateDef[] = [
  {
    name: 'Black straight trousers',
    category: 'Bottoms',
    subcategory: 'trousers',
    colors: ['black'],
    formality: 4,
    reason: 'Versatile neutral foundation that anchors structured office and smart-casual looks.',
  },
  {
    name: 'White leather sneakers',
    category: 'Footwear',
    subcategory: 'sneakers',
    colors: ['white'],
    formality: 2,
    reason: 'Contemporary neutral footwear that transitions smoothly between ethnic, casual, and travel looks.',
  },
  {
    name: 'Beige linen palazzo',
    category: 'Ethnic',
    subcategory: 'palazzo',
    colors: ['beige'],
    formality: 2,
    reason: 'Breathable wide-leg bottom that expands styling flexibility for relaxed and daytime occasions.',
  },
  {
    name: 'Classic denim jacket',
    category: 'Outerwear',
    subcategory: 'jacket',
    colors: ['blue'],
    formality: 3,
    reason: 'Adds versatile layering structure across dresses, tops, and casual silhouettes.',
  },
  {
    name: 'Cream embroidered dupatta',
    category: 'Ethnic',
    subcategory: 'dupatta',
    colors: ['cream'],
    formality: 3,
    reason: 'Completes traditional multi-piece festive silhouettes with existing plain kurtas.',
  },
  {
    name: 'Olive straight trousers',
    category: 'Bottoms',
    subcategory: 'trousers',
    colors: ['olive'],
    formality: 3,
    reason: 'Adds an earthy neutral bottom option to diversify daily rotations.',
  },
  {
    name: 'Black structured blazer',
    category: 'Outerwear',
    subcategory: 'blazer',
    colors: ['black'],
    formality: 4,
    reason: 'Sharp tailoring piece that elevates casual separates into formal and evening looks.',
  },
  {
    name: 'Pastel green cotton kurta',
    category: 'Ethnic',
    subcategory: 'kurta',
    colors: ['green'],
    formality: 3,
    reason: 'Breathable daytime ethnic upper for everyday wear and casual gatherings.',
  },
  {
    name: 'Black leather pointed flats',
    category: 'Footwear',
    subcategory: 'flats',
    colors: ['black'],
    formality: 3,
    reason: 'Low-profile footwear bridging formal tailoring and traditional ethnic ensembles.',
  },
  {
    name: 'Blue straight-fit jeans',
    category: 'Bottoms',
    subcategory: 'jeans',
    colors: ['blue'],
    formality: 2,
    reason: 'Essential denim foundation anchoring everyday and casual looks.',
  },
  {
    name: 'Embroidered festive juttis',
    category: 'Footwear',
    subcategory: 'juttis',
    colors: ['gold', 'mustard'],
    formality: 4,
    reason: 'Traditional handcrafted footwear for festive occasions, weddings, and cultural celebrations.',
  },
  {
    name: 'Black tailored kurta',
    category: 'Ethnic',
    subcategory: 'kurta',
    colors: ['black'],
    formality: 3,
    reason: 'Sleek modern foundation piece for Indo-western evening styling.',
  },
  {
    name: 'White linen button-down shirt',
    category: 'Tops',
    subcategory: 'shirt',
    colors: ['white'],
    formality: 3,
    reason: 'Timeless breathable upper wearable as a standalone shirt or lightweight layer.',
  },
  {
    name: 'Tan leather sandals',
    category: 'Footwear',
    subcategory: 'sandals',
    colors: ['brown'],
    formality: 2,
    reason: 'Warm-weather footwear for warm days and casual outings.',
  },
  {
    name: 'Navy Nehru jacket',
    category: 'Ethnic',
    subcategory: 'nehru jacket',
    colors: ['navy'],
    formality: 4,
    reason: 'Traditional layering vest that formalizes solid kurtas for family celebrations.',
  },
  {
    name: 'Gold statement jewellery set',
    category: 'Accessories',
    subcategory: 'jewellery',
    colors: ['gold'],
    formality: 4,
    reason: 'Accent accessory adding festive refinement to celebratory outfits.',
  },
  {
    name: 'White fitted churidar',
    category: 'Ethnic',
    subcategory: 'churidar',
    colors: ['white'],
    formality: 3,
    reason: 'Classic fitted ethnic bottom designed to pair with knee-length kurtas.',
  },
  {
    name: 'Beige structured shoulder bag',
    category: 'Accessories',
    subcategory: 'bag',
    colors: ['beige'],
    formality: 3,
    reason: 'Functional structured accessory complementing campus, office, and weekend engagements.',
  },
];

const allOccasions: Occasion[] = [
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

export const candidates = (season: Season): CandidateItem[] =>
  candidateDefs.map((d, i) => ({
    id: `candidate-${i}`,
    name: d.name,
    category: d.category,
    subcategory: d.subcategory,
    colors: d.colors,
    seasons: [season, 'summer', 'monsoon', 'winter'],
    occasions: allOccasions,
    formality: d.formality,
    priceRange: d.priceRange,
    note: d.reason || '',
    status: 'clean',
    favorite: false,
    timesWorn: 0,
  }));

export const candidatePrice = (name: string): string =>
  candidateDefs.find((x) => x.name.toLowerCase() === name.toLowerCase())?.priceRange ??
  'Essential Staple';
