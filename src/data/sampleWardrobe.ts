import { WardrobeItem, Occasion, Season } from '../types';
import { getWardrobeAsset } from '../assets/wardrobe';

const id = (s: string) => `sample-${s}`;
const allSeason: Season[] = ['summer', 'monsoon', 'winter'];
const casual: Occasion[] = ['college', 'casual outing', 'travel'];
const ethnic: Occasion[] = [
  'family function',
  'wedding guest',
  'Diwali',
  'Holi',
  'Eid',
  'puja',
];

interface RawItemDef {
  key: string;
  name: string;
  category: WardrobeItem['category'];
  subcategory: WardrobeItem['subcategory'];
  colors: string[];
  seasons: Season[];
  occasions: Occasion[];
  formality: number;
  fabric?: WardrobeItem['fabric'];
  pattern?: WardrobeItem['pattern'];
  fit?: WardrobeItem['fit'];
  purchasePrice?: number;
  culturalContext?: WardrobeItem['culturalContext'];
}

const rawSampleData: RawItemDef[] = [
  // TOPS (5 items)
  {
    key: 'white-tee',
    name: 'White relaxed tee',
    category: 'Tops',
    subcategory: 't-shirt',
    colors: ['white'],
    seasons: allSeason,
    occasions: [...casual, 'date'],
    formality: 2,
  },
  {
    key: 'black-tee',
    name: 'Black oversized tee',
    category: 'Tops',
    subcategory: 't-shirt',
    colors: ['black'],
    seasons: allSeason,
    occasions: casual,
    formality: 2,
  },
  {
    key: 'blue-shirt',
    name: 'Sky blue shirt',
    category: 'Tops',
    subcategory: 'shirt',
    colors: ['blue'],
    seasons: allSeason,
    occasions: ['college', 'office', 'casual outing', 'date', 'travel'],
    formality: 3,
  },
  {
    key: 'cream-shirt',
    name: 'Cream linen shirt',
    category: 'Tops',
    subcategory: 'shirt',
    colors: ['cream'],
    seasons: ['summer', 'monsoon'],
    occasions: ['college', 'office', 'date', 'travel'],
    formality: 3,
  },
  {
    key: 'olive-crop',
    name: 'Olive crop top',
    category: 'Tops',
    subcategory: 'crop top',
    colors: ['olive'],
    seasons: ['summer', 'monsoon'],
    occasions: ['college', 'casual outing', 'date'],
    formality: 2,
  },

  // BOTTOMS (4 items — intentional gap: fewer bottoms than tops)
  {
    key: 'blue-jeans',
    name: 'Blue straight jeans',
    category: 'Bottoms',
    subcategory: 'jeans',
    colors: ['blue'],
    seasons: allSeason,
    occasions: [...casual, 'date'],
    formality: 2,
  },
  {
    key: 'black-trousers',
    name: 'Black trousers',
    category: 'Bottoms',
    subcategory: 'trousers',
    colors: ['black'],
    seasons: allSeason,
    occasions: ['office', 'party', 'date', 'family function'],
    formality: 4,
  },
  {
    key: 'beige-pants',
    name: 'Beige trousers',
    category: 'Bottoms',
    subcategory: 'trousers',
    colors: ['beige'],
    seasons: allSeason,
    occasions: ['office', 'college', 'casual outing'],
    formality: 3,
  },
  {
    key: 'olive-joggers',
    name: 'Olive joggers',
    category: 'Bottoms',
    subcategory: 'joggers',
    colors: ['olive'],
    seasons: ['summer', 'monsoon', 'winter'],
    occasions: ['college', 'travel', 'casual outing'],
    formality: 2,
  },

  // ETHNIC (8 items)
  {
    key: 'white-kurta',
    name: 'White cotton kurta',
    category: 'Ethnic',
    subcategory: 'kurta',
    colors: ['white'],
    seasons: allSeason,
    occasions: [...ethnic, 'college'],
    formality: 3,
  },
  {
    key: 'blue-kurti',
    name: 'Indigo kurti',
    category: 'Ethnic',
    subcategory: 'kurti',
    colors: ['blue'],
    seasons: allSeason,
    occasions: [...ethnic, 'college'],
    formality: 3,
  },
  {
    key: 'cream-palazzo',
    name: 'Cream palazzo',
    category: 'Ethnic',
    subcategory: 'palazzo',
    colors: ['cream'],
    seasons: allSeason,
    occasions: [...ethnic, 'casual outing'],
    formality: 2,
  },
  {
    key: 'white-churidar',
    name: 'White churidar',
    category: 'Ethnic',
    subcategory: 'churidar',
    colors: ['white'],
    seasons: allSeason,
    occasions: ethnic,
    formality: 3,
  },
  {
    key: 'mustard-dupatta',
    name: 'Mustard dupatta',
    category: 'Ethnic',
    subcategory: 'dupatta',
    colors: ['mustard'],
    seasons: allSeason,
    occasions: ethnic,
    formality: 3,
  },
  {
    key: 'black-saree',
    name: 'Black saree',
    category: 'Ethnic',
    subcategory: 'saree',
    colors: ['black'],
    seasons: ['winter', 'monsoon'],
    occasions: ethnic,
    formality: 5,
  },
  {
    key: 'pink-blouse',
    name: 'Pink blouse',
    category: 'Ethnic',
    subcategory: 'blouse',
    colors: ['pink'],
    seasons: allSeason,
    occasions: ethnic,
    formality: 4,
  },
  {
    key: 'navy-lehenga',
    name: 'Navy lehenga',
    category: 'Ethnic',
    subcategory: 'lehenga',
    colors: ['navy'],
    seasons: ['winter', 'monsoon'],
    occasions: ['wedding guest', 'Diwali', 'Eid', 'family function'],
    formality: 5,
  },

  // DRESSES (2 items)
  {
    key: 'floral-dress',
    name: 'Floral midi dress',
    category: 'Dresses',
    subcategory: 'western dress',
    colors: ['pink', 'cream'],
    seasons: ['summer', 'monsoon'],
    occasions: ['date', 'party', 'casual outing'],
    formality: 3,
  },
  {
    key: 'black-coord',
    name: 'Black co-ord set',
    category: 'Dresses',
    subcategory: 'co-ord set',
    colors: ['black'],
    seasons: allSeason,
    occasions: ['date', 'party', 'travel'],
    formality: 3,
  },

  // OUTERWEAR (2 items)
  {
    key: 'denim-jacket',
    name: 'Denim jacket',
    category: 'Outerwear',
    subcategory: 'jacket',
    colors: ['blue'],
    seasons: allSeason,
    occasions: ['college', 'casual outing', 'date', 'travel'],
    formality: 3,
  },
  {
    key: 'black-blazer',
    name: 'Black blazer',
    category: 'Outerwear',
    subcategory: 'blazer',
    colors: ['black'],
    seasons: ['winter', 'monsoon'],
    occasions: ['office', 'party', 'date'],
    formality: 4,
  },

  // FOOTWEAR (4 items)
  {
    key: 'white-sneakers',
    name: 'White sneakers',
    category: 'Footwear',
    subcategory: 'sneakers',
    colors: ['white'],
    seasons: allSeason,
    occasions: ['college', 'casual outing', 'date', 'travel'],
    formality: 2,
  },
  {
    key: 'black-flats',
    name: 'Black flats',
    category: 'Footwear',
    subcategory: 'flats',
    colors: ['black'],
    seasons: allSeason,
    occasions: [...ethnic, 'office', 'date'],
    formality: 3,
  },
  {
    key: 'juttis',
    name: 'Embroidered juttis',
    category: 'Footwear',
    subcategory: 'juttis',
    colors: ['mustard', 'pink'],
    seasons: allSeason,
    occasions: ethnic,
    formality: 4,
  },
  {
    key: 'brown-sandals',
    name: 'Brown sandals',
    category: 'Footwear',
    subcategory: 'sandals',
    colors: ['brown'],
    seasons: ['summer', 'monsoon'],
    occasions: ['college', 'casual outing', 'travel', ...ethnic],
    formality: 2,
  },

  // ACCESSORIES (3 items)
  {
    key: 'tote',
    name: 'Canvas tote',
    category: 'Accessories',
    subcategory: 'bag',
    colors: ['cream'],
    seasons: allSeason,
    occasions: ['college', 'casual outing', 'travel'],
    formality: 1,
  },
  {
    key: 'watch',
    name: 'Everyday watch',
    category: 'Accessories',
    subcategory: 'watch',
    colors: ['black', 'silver'],
    seasons: allSeason,
    occasions: ['college', 'office', 'date', 'travel'],
    formality: 2,
  },
  {
    key: 'gold-jewellery',
    name: 'Gold jewellery set',
    category: 'Accessories',
    subcategory: 'jewellery',
    colors: ['gold'],
    seasons: allSeason,
    occasions: ethnic,
    formality: 4,
  },
];

export const sampleWardrobe: WardrobeItem[] = rawSampleData.map((x) => ({
  id: id(x.key),
  name: x.name,
  photo: getWardrobeAsset(id(x.key)),
  category: x.category,
  subcategory: x.subcategory,
  colors: x.colors,
  seasons: x.seasons,
  occasions: x.occasions,
  formality: x.formality,
  status: 'clean',
  favorite: ['white-kurta', 'white-sneakers', 'black-trousers'].includes(x.key),
  note: x.key === 'white-kurta' ? 'Dry clean recommended' : '',
  timesWorn: Math.floor(Math.random() * 3),
  fabric: x.fabric,
  pattern: x.pattern,
  fit: x.fit,
  purchasePrice: x.purchasePrice,
  culturalContext: x.culturalContext,
  userVerified: true,
  aiConfidence: 0.95,
}));
