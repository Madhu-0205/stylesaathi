import { CandidateItem, Season, Occasion } from '../types';

interface CandidateDef {
  name: string;
  category: CandidateItem['category'];
  subcategory: CandidateItem['subcategory'];
  colors: string[];
  formality: number;
  priceRange: string;
  reason?: string;
}

const candidateDefs: CandidateDef[] = [
  {
    name: 'Black straight trousers',
    category: 'Bottoms',
    subcategory: 'trousers',
    colors: ['black'],
    formality: 4,
    priceRange: '₹1,200–₹2,500',
    reason: 'Pairs with your white tee, linen shirt, and blazers for office and dates.',
  },
  {
    name: 'White leather sneakers',
    category: 'Footwear',
    subcategory: 'sneakers',
    colors: ['white'],
    formality: 2,
    priceRange: '₹1,500–₹3,500',
    reason: 'Instantly modernizes kurtas, jeans, and casual dresses.',
  },
  {
    name: 'Beige linen palazzo',
    category: 'Ethnic',
    subcategory: 'palazzo',
    colors: ['beige'],
    formality: 2,
    priceRange: '₹900–₹1,800',
    reason: 'Fills the ethnic bottoms gap for both college and festive occasions.',
  },
  {
    name: 'Classic denim jacket',
    category: 'Outerwear',
    subcategory: 'jacket',
    colors: ['blue'],
    formality: 3,
    priceRange: '₹1,500–₹3,000',
    reason: 'Adds layering depth to dresses, kurtas, and casual tees.',
  },
  {
    name: 'Cream embroidered dupatta',
    category: 'Ethnic',
    subcategory: 'dupatta',
    colors: ['cream'],
    formality: 3,
    priceRange: '₹600–₹1,400',
    reason: 'Unlocks complete festive sets with your existing solid kurtas.',
  },
  {
    name: 'Olive straight trousers',
    category: 'Bottoms',
    subcategory: 'trousers',
    colors: ['olive'],
    formality: 3,
    priceRange: '₹1,200–₹2,400',
    reason: 'Adds an earthy neutral to rotate with jeans and black pants.',
  },
  {
    name: 'Black structured blazer',
    category: 'Outerwear',
    subcategory: 'blazer',
    colors: ['black'],
    formality: 4,
    priceRange: '₹2,200–₹4,500',
    reason: 'Elevates casual outfits into office and evening ready looks.',
  },
  {
    name: 'Pastel green cotton kurta',
    category: 'Ethnic',
    subcategory: 'kurta',
    colors: ['green'],
    formality: 3,
    priceRange: '₹800–₹1,800',
    reason: 'Matches with white churidar, cream palazzo, or blue straight jeans.',
  },
  {
    name: 'Black leather pointed flats',
    category: 'Footwear',
    subcategory: 'flats',
    colors: ['black'],
    formality: 3,
    priceRange: '₹900–₹2,000',
    reason: 'Versatile low-profile footwear for ethnic, office, and date looks.',
  },
  {
    name: 'Blue straight-fit jeans',
    category: 'Bottoms',
    subcategory: 'jeans',
    colors: ['blue'],
    formality: 2,
    priceRange: '₹1,400–₹2,800',
    reason: 'Essential staple that pairs with all tops, shirts, and kurtis.',
  },
  {
    name: 'Embroidered festive juttis',
    category: 'Footwear',
    subcategory: 'juttis',
    colors: ['gold', 'mustard'],
    formality: 4,
    priceRange: '₹1,200–₹2,500',
    reason: 'Completes traditional Indian outfits for Diwali, weddings, and pujas.',
  },
  {
    name: 'Black tailored kurta',
    category: 'Ethnic',
    subcategory: 'kurta',
    colors: ['black'],
    formality: 3,
    priceRange: '₹900–₹1,900',
    reason: 'Sleek Indo-western foundation piece for evening outings.',
  },
  {
    name: 'White linen button-down shirt',
    category: 'Tops',
    subcategory: 'shirt',
    colors: ['white'],
    formality: 3,
    priceRange: '₹1,100–₹2,400',
    reason: 'Timeless smart-casual piece wearable open or tucked.',
  },
  {
    name: 'Tan leather sandals',
    category: 'Footwear',
    subcategory: 'sandals',
    colors: ['brown'],
    formality: 2,
    priceRange: '₹800–₹1,600',
    reason: 'Breezy everyday footwear for summer and casual outings.',
  },
  {
    name: 'Navy Nehru jacket',
    category: 'Ethnic',
    subcategory: 'nehru jacket',
    colors: ['navy'],
    formality: 4,
    priceRange: '₹1,800–₹3,500',
    reason: 'Instantly formalizes any plain kurta for family functions.',
  },
  {
    name: 'Gold statement jewellery set',
    category: 'Accessories',
    subcategory: 'jewellery',
    colors: ['gold'],
    formality: 4,
    priceRange: '₹600–₹1,800',
    reason: 'Brings festive sparkle to sarees, lehengas, and kurtas.',
  },
  {
    name: 'White fitted churidar',
    category: 'Ethnic',
    subcategory: 'churidar',
    colors: ['white'],
    formality: 3,
    priceRange: '₹600–₹1,200',
    reason: 'Traditional bottom pairing for straight-cut ethnic kurtas.',
  },
  {
    name: 'Beige structured shoulder bag',
    category: 'Accessories',
    subcategory: 'bag',
    colors: ['beige'],
    formality: 3,
    priceRange: '₹1,200–₹2,800',
    reason: 'Polished accessory for college, office, and weekend dates.',
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
  '₹900–₹2,200';
