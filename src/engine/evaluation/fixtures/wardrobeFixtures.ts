import { WardrobeItem } from '../../../types';

/**
 * Deterministic wardrobe items for StyleSaathi Phase G evaluation.
 * Every item has explicit provenance, verified attributes, and realistic styling characteristics.
 */

const baseItem = (overrides: Partial<WardrobeItem>): WardrobeItem => ({
  id: 'fixture-item',
  name: 'Fixture Item',
  category: 'Tops',
  subcategory: 'shirt',
  colors: ['white'],
  seasons: ['summer', 'monsoon', 'winter'],
  occasions: ['everyday'],
  formality: 3,
  status: 'clean',
  favorite: false,
  note: '',
  timesWorn: 0,
  userVerified: true,
  ...overrides,
});

// ============================================================================
// MEN'S WARDROBE FIXTURES
// ============================================================================

export const MEN_SHERWANI_CREAM = baseItem({
  id: 'm-sherwani-cream',
  name: 'Heritage Raw Silk Sherwani',
  category: 'Ethnic',
  subcategory: 'sherwani',
  colors: ['cream', 'gold'],
  fabric: 'silk',
  pattern: 'embroidered',
  formality: 5,
  occasions: ['wedding guest', 'celebration', 'festive', 'engagement', 'family function'],
});

export const MEN_CHURIDAR_GOLD = baseItem({
  id: 'm-churidar-gold',
  name: 'Dupion Silk Churidar',
  category: 'Ethnic',
  subcategory: 'churidar',
  colors: ['gold'],
  fabric: 'silk',
  pattern: 'solid',
  formality: 5,
  occasions: ['wedding guest', 'celebration', 'festive', 'engagement'],
});

export const MEN_JUTTIS_GOLD = baseItem({
  id: 'm-juttis-gold',
  name: 'Embroidered Mojari Juttis',
  category: 'Footwear',
  subcategory: 'juttis',
  colors: ['gold'],
  formality: 5,
  occasions: ['wedding guest', 'celebration', 'festive', 'puja'],
});

export const MEN_MUNDU_KASAVU = baseItem({
  id: 'm-mundu-kasavu',
  name: 'Kerala Handloom Kasavu Mundu',
  category: 'Ethnic',
  subcategory: 'dhoti',
  colors: ['cream', 'gold'],
  fabric: 'cotton',
  pattern: 'solid',
  formality: 4,
  occasions: ['puja', 'festive', 'celebration', 'wedding guest', 'family function', 'everyday'],
});

export const MEN_KURTA_CREAM_COTTON_SILK = baseItem({
  id: 'm-kurta-cream-silk',
  name: 'Cream Cotton-Silk Kurta',
  category: 'Ethnic',
  subcategory: 'kurta',
  colors: ['cream'],
  fabric: 'silk',
  pattern: 'solid',
  formality: 4,
  occasions: ['puja', 'festive', 'celebration', 'wedding guest', 'family function'],
});

export const MEN_SANDALS_BROWN = baseItem({
  id: 'm-sandals-brown',
  name: 'Leather Strapped Kolhapuri Sandals',
  category: 'Footwear',
  subcategory: 'kolhapuris',
  colors: ['brown'],
  formality: 3,
  occasions: ['puja', 'festive', 'casual outing', 'family function', 'everyday'],
});

export const MEN_BANDHGALA_CHARCOAL = baseItem({
  id: 'm-bandhgala-charcoal',
  name: 'Charcoal Tailored Bandhgala Jacket',
  category: 'Outerwear',
  subcategory: 'bandhgala',
  colors: ['grey', 'black'],
  fabric: 'wool',
  pattern: 'solid',
  formality: 5,
  occasions: ['interview', 'office', 'wedding guest', 'celebration', 'party'],
});

export const MEN_TROUSERS_BLACK_FORMAL = baseItem({
  id: 'm-trousers-black',
  name: 'Tailored Black Formal Trousers',
  category: 'Bottoms',
  subcategory: 'trousers',
  colors: ['black'],
  fabric: 'cotton',
  pattern: 'solid',
  formality: 5,
  occasions: ['interview', 'office', 'wedding guest', 'celebration', 'party'],
});

export const MEN_FORMAL_OXFORDS = baseItem({
  id: 'm-oxfords-black',
  name: 'Polished Black Leather Oxfords',
  category: 'Footwear',
  subcategory: 'formal shoes',
  colors: ['black'],
  formality: 5,
  occasions: ['interview', 'office', 'wedding guest'],
});

export const MEN_KHADI_KURTA_INDIGO = baseItem({
  id: 'm-kurta-khadi-indigo',
  name: 'Handspun Indigo Khadi Kurta',
  category: 'Ethnic',
  subcategory: 'kurta',
  colors: ['navy', 'blue'],
  fabric: 'khadi',
  pattern: 'solid',
  formality: 3,
  occasions: ['college', 'casual outing', 'everyday', 'office', 'family function'],
});

export const MEN_PAJAMA_WHITE = baseItem({
  id: 'm-pajama-white',
  name: 'Breathable Cotton Pajama',
  category: 'Ethnic',
  subcategory: 'pajama',
  colors: ['white'],
  fabric: 'cotton',
  pattern: 'solid',
  formality: 3,
  occasions: ['puja', 'festive', 'family function', 'everyday', 'college'],
});

export const MEN_JEANS_DARK_DENIM = baseItem({
  id: 'm-jeans-dark',
  name: 'Dark Navy Slim Jeans',
  category: 'Bottoms',
  subcategory: 'jeans',
  colors: ['navy'],
  fabric: 'denim',
  pattern: 'solid',
  formality: 2,
  occasions: ['college', 'casual outing', 'everyday', 'travel'],
});

export const MEN_SNEAKERS_WHITE = baseItem({
  id: 'm-sneakers-white',
  name: 'Minimalist White Leather Court Sneakers',
  category: 'Footwear',
  subcategory: 'sneakers',
  colors: ['white'],
  formality: 2,
  occasions: ['college', 'casual outing', 'everyday', 'travel'],
});

export const MEN_NEHRU_JACKET_TUSSAR = baseItem({
  id: 'm-nehru-tussar',
  name: 'Mustard Tussar Silk Nehru Jacket',
  category: 'Ethnic',
  subcategory: 'nehru jacket',
  colors: ['mustard', 'gold'],
  fabric: 'tussar',
  pattern: 'solid',
  formality: 4,
  occasions: ['wedding guest', 'celebration', 'festive', 'puja', 'family function'],
});

export const MEN_CASUAL_TEE_WHITE = baseItem({
  id: 'm-tee-white',
  name: 'Organic Cotton Crewneck Tee',
  category: 'Tops',
  subcategory: 't-shirt',
  colors: ['white'],
  fabric: 'cotton',
  pattern: 'solid',
  formality: 1,
  occasions: ['college', 'casual outing', 'everyday'],
});

export const MEN_CASUAL_HOODIE_GREY = baseItem({
  id: 'm-hoodie-grey',
  name: 'Relaxed Fleece Hoodie',
  category: 'Tops',
  subcategory: 'hoodie',
  colors: ['grey'],
  fabric: 'cotton',
  pattern: 'solid',
  formality: 1,
  occasions: ['college', 'casual outing', 'everyday'],
});

export const MEN_CASUAL_SHORTS_NAVY = baseItem({
  id: 'm-shorts-navy',
  name: 'Cotton Chino Shorts',
  category: 'Bottoms',
  subcategory: 'shorts',
  colors: ['navy'],
  fabric: 'cotton',
  pattern: 'solid',
  formality: 1,
  occasions: ['casual outing', 'everyday'],
});

// ============================================================================
// WOMEN'S WARDROBE FIXTURES
// ============================================================================

export const WOMEN_KANJEEVARAM_SAREE_RED = baseItem({
  id: 'w-saree-kanjeevaram-red',
  name: 'Crimson Kanjeevaram Temple Border Silk Saree',
  category: 'Ethnic',
  subcategory: 'saree',
  colors: ['red', 'gold'],
  fabric: 'silk',
  pattern: 'zari_brocade',
  formality: 5,
  occasions: ['wedding guest', 'celebration', 'festive', 'puja', 'family function'],
});

export const WOMEN_SILK_BLOUSE_GOLD = baseItem({
  id: 'w-blouse-gold',
  name: 'Tailored Gold Silk Blouse',
  category: 'Ethnic',
  subcategory: 'blouse',
  colors: ['gold'],
  fabric: 'silk',
  pattern: 'solid',
  formality: 5,
  occasions: ['wedding guest', 'celebration', 'festive', 'puja', 'family function'],
});

export const WOMEN_HEELS_METALLIC = baseItem({
  id: 'w-heels-metallic',
  name: 'Block Metallic Gold Heels',
  category: 'Footwear',
  subcategory: 'heels',
  colors: ['gold'],
  formality: 4,
  occasions: ['wedding guest', 'celebration', 'party'],
});

export const WOMEN_CHIKANKARI_KURTI_LAVENDER = baseItem({
  id: 'w-kurti-chikankari-lavender',
  name: 'Lucknowi Chikankari Mulmul Kurti',
  category: 'Ethnic',
  subcategory: 'kurti',
  colors: ['pink', 'white'],
  fabric: 'mulmul',
  pattern: 'chikankari',
  formality: 3,
  occasions: ['college', 'office', 'casual outing', 'everyday', 'festive', 'Eid'],
});

export const WOMEN_PALAZZO_WHITE_COTTON = baseItem({
  id: 'w-palazzo-white',
  name: 'Flowing White Cotton Palazzo',
  category: 'Bottoms',
  subcategory: 'palazzo',
  colors: ['white'],
  fabric: 'cotton',
  pattern: 'solid',
  formality: 3,
  occasions: ['college', 'office', 'casual outing', 'everyday', 'festive'],
});

export const WOMEN_MOJARIS_SILVER = baseItem({
  id: 'w-mojaris-silver',
  name: 'Handcrafted Silver Thread Mojaris',
  category: 'Footwear',
  subcategory: 'flats',
  colors: ['silver'],
  formality: 3,
  occasions: ['college', 'casual outing', 'festive', 'puja'],
});

export const WOMEN_LEHENGA_EMERALD = baseItem({
  id: 'w-lehenga-emerald',
  name: 'Emerald Zari Brocade Lehenga',
  category: 'Ethnic',
  subcategory: 'lehenga',
  colors: ['green', 'gold'],
  fabric: 'banarasi',
  pattern: 'zari_brocade',
  formality: 5,
  occasions: ['wedding guest', 'celebration', 'festive'],
});

export const WOMEN_CHOLI_BLOUSE_EMERALD = baseItem({
  id: 'w-choli-emerald',
  name: 'Embroidered Velvet Crop Blouse',
  category: 'Ethnic',
  subcategory: 'blouse',
  colors: ['green'],
  fabric: 'velvet',
  pattern: 'embroidered',
  formality: 5,
  occasions: ['wedding guest', 'celebration', 'festive'],
});

export const WOMEN_DUPATTA_GOLD_NET = baseItem({
  id: 'w-dupatta-gold',
  name: 'Zari Border Gold Net Dupatta',
  category: 'Ethnic',
  subcategory: 'dupatta',
  colors: ['gold'],
  fabric: 'organza',
  pattern: 'zari_brocade',
  formality: 5,
  occasions: ['wedding guest', 'celebration', 'festive', 'puja'],
});

export const WOMEN_CHANDERI_SAREE_MINT = baseItem({
  id: 'w-saree-chanderi-mint',
  name: 'Handwoven Mint Green Chanderi Saree',
  category: 'Ethnic',
  subcategory: 'saree',
  colors: ['green', 'gold'],
  fabric: 'chanderi',
  pattern: 'geometric',
  formality: 4,
  occasions: ['office', 'festive', 'family function', 'puja'],
});

export const WOMEN_BLOUSE_RAW_SILK_GREEN = baseItem({
  id: 'w-blouse-raw-silk-green',
  name: 'Forest Green Raw Silk Blouse',
  category: 'Ethnic',
  subcategory: 'blouse',
  colors: ['green'],
  fabric: 'silk',
  pattern: 'solid',
  formality: 4,
  occasions: ['office', 'festive', 'family function', 'puja'],
});

export const WOMEN_ANARKALI_NAVY_MODEST = baseItem({
  id: 'w-anarkali-navy',
  name: 'Full-Sleeve Navy Floor Anarkali',
  category: 'Ethnic',
  subcategory: 'anarkali',
  colors: ['navy', 'gold'],
  fabric: 'georgette',
  pattern: 'embroidered',
  formality: 4,
  occasions: ['festive', 'celebration', 'family function', 'Eid', 'wedding guest'],
});

export const WOMEN_CHURIDAR_NAVY = baseItem({
  id: 'w-churidar-navy',
  name: 'Cotton Lycra Navy Churidar',
  category: 'Ethnic',
  subcategory: 'churidar',
  colors: ['navy'],
  fabric: 'cotton',
  pattern: 'solid',
  formality: 4,
  occasions: ['festive', 'celebration', 'family function'],
});

export const WOMEN_DUPATTA_CHIFFON_NAVY = baseItem({
  id: 'w-dupatta-chiffon-navy',
  name: 'Fluid Navy Chiffon Dupatta',
  category: 'Ethnic',
  subcategory: 'dupatta',
  colors: ['navy'],
  fabric: 'chiffon',
  pattern: 'solid',
  formality: 4,
  occasions: ['festive', 'celebration', 'family function', 'Eid'],
});

export const WOMEN_TAILORED_BLAZER_NAVY = baseItem({
  id: 'w-blazer-navy',
  name: 'Structured Navy Single-Breasted Blazer',
  category: 'Outerwear',
  subcategory: 'blazer',
  colors: ['navy'],
  fabric: 'cotton',
  pattern: 'solid',
  formality: 5,
  occasions: ['interview', 'office'],
});

export const WOMEN_FORMAL_SHIRT_WHITE = baseItem({
  id: 'w-shirt-white',
  name: 'Crisp Poplin Cotton White Formal Shirt',
  category: 'Tops',
  subcategory: 'shirt',
  colors: ['white'],
  fabric: 'cotton',
  pattern: 'solid',
  formality: 5,
  occasions: ['interview', 'office'],
});

export const WOMEN_TROUSERS_NAVY = baseItem({
  id: 'w-trousers-navy',
  name: 'High-Waist Tailored Navy Trousers',
  category: 'Bottoms',
  subcategory: 'trousers',
  colors: ['navy'],
  fabric: 'cotton',
  pattern: 'solid',
  formality: 5,
  occasions: ['interview', 'office'],
});

export const WOMEN_LOAFERS_BLACK = baseItem({
  id: 'w-loafers-black',
  name: 'Polished Black Leather Loafers',
  category: 'Footwear',
  subcategory: 'loafers',
  colors: ['black'],
  formality: 4,
  occasions: ['interview', 'office', 'college'],
});

export const WOMEN_CROP_TOP_RED = baseItem({
  id: 'w-crop-top-red',
  name: 'Ribbed Red Casual Crop Top',
  category: 'Tops',
  subcategory: 'crop top',
  colors: ['red'],
  fabric: 'cotton',
  pattern: 'solid',
  formality: 1,
  occasions: ['casual outing', 'party'],
});

export const WOMEN_SHORTS_DENIM_DISTRESSED = baseItem({
  id: 'w-shorts-denim',
  name: 'Distressed Blue Denim Cutoffs',
  category: 'Bottoms',
  subcategory: 'shorts',
  colors: ['blue'],
  fabric: 'denim',
  pattern: 'solid',
  formality: 1,
  occasions: ['casual outing'],
});

export const WOMEN_BLACK_WESTERN_DRESS = baseItem({
  id: 'w-dress-black',
  name: 'Sleek Black Cocktail Dress',
  category: 'Dresses',
  subcategory: 'dress',
  colors: ['black'],
  fabric: 'crepe',
  pattern: 'solid',
  formality: 4,
  occasions: ['party', 'date'],
});

// ============================================================================
// CROSS-CULTURAL & INTERNATIONAL STYLE INSPIRATION PIECES
// ============================================================================

export const OVERSIZED_BOXY_TEE_BEIGE = baseItem({
  id: 'int-tee-boxy-beige',
  name: 'Heavyweight Boxy Dropped-Shoulder Tee',
  category: 'Tops',
  subcategory: 't-shirt',
  colors: ['beige'],
  fabric: 'cotton',
  pattern: 'solid',
  fit: 'oversized',
  formality: 2,
  occasions: ['college', 'casual outing', 'everyday'],
});

export const RELAXED_WIDE_LEG_CHINOS_OLIVE = baseItem({
  id: 'int-chinos-olive',
  name: 'Pleated Wide-Leg Cotton Chinos',
  category: 'Bottoms',
  subcategory: 'trousers',
  colors: ['olive'],
  fabric: 'cotton',
  pattern: 'solid',
  fit: 'relaxed',
  formality: 3,
  occasions: ['college', 'office', 'casual outing', 'everyday'],
});

export const JAPANESE_CHORE_JACKET_INDIGO = baseItem({
  id: 'int-chore-jacket-indigo',
  name: 'Sashiko-Stitched Indigo Chore Jacket',
  category: 'Outerwear',
  subcategory: 'jacket',
  colors: ['blue', 'navy'],
  fabric: 'cotton',
  pattern: 'geometric',
  fit: 'relaxed',
  formality: 3,
  occasions: ['casual outing', 'everyday', 'college'],
});

export const EUROPEAN_TRENCH_COAT_CAMEL = baseItem({
  id: 'int-trench-camel',
  name: 'Double-Breasted Camel Trench Coat',
  category: 'Outerwear',
  subcategory: 'jacket',
  colors: ['beige', 'brown'],
  fabric: 'cotton',
  pattern: 'solid',
  fit: 'tailored',
  formality: 4,
  occasions: ['office', 'travel', 'interview'],
});

// ============================================================================
// DIRTY, SENSITIVE, HAZARDOUS & EDGE-CASE FIXTURES
// ============================================================================

export const DIRTY_SHIRT_IN_LAUNDRY = baseItem({
  id: 'edge-shirt-laundry',
  name: 'Sky Blue Crisp Shirt',
  category: 'Tops',
  subcategory: 'shirt',
  colors: ['blue'],
  fabric: 'cotton',
  status: 'in_laundry', // Un-plannable / Dirty!
  formality: 4,
  occasions: ['interview', 'office'],
});

export const DIRTY_KURTA_NEEDS_WASHING = baseItem({
  id: 'edge-kurta-wash',
  name: 'Maroon Festive Silk Kurta',
  category: 'Ethnic',
  subcategory: 'kurta',
  colors: ['maroon'],
  fabric: 'silk',
  status: 'needs_washing', // Dirty!
  formality: 4,
  occasions: ['festive', 'wedding guest'],
});

export const WOOL_SWEATER_MUSTARD = baseItem({
  id: 'edge-sweater-wool',
  name: 'Chunky Pure Merino Wool Sweater',
  category: 'Tops',
  subcategory: 'sweater',
  colors: ['mustard'],
  fabric: 'wool', // Sensitivity trigger
  status: 'clean',
  formality: 2,
  occasions: ['everyday', 'casual outing'],
});

export const SUEDE_LOAFERS_BROWN = baseItem({
  id: 'edge-loafers-suede',
  name: 'Italian Brown Suede Loafers',
  category: 'Footwear',
  subcategory: 'loafers',
  colors: ['brown'],
  fabric: 'suede' as any, // Deluge hazard
  status: 'clean',
  formality: 4,
  occasions: ['office', 'casual outing', 'date'],
});

export const UNKNOWN_FABRIC_TOP = baseItem({
  id: 'edge-top-unknown',
  name: 'Unbranded Flea Market Graphic Top',
  category: 'Tops',
  subcategory: 'top',
  colors: ['grey'],
  fabric: undefined, // Missing/unknown fabric attribute
  pattern: undefined,
  userVerified: false,
  formality: 2,
  occasions: ['college', 'casual outing'],
});

export const SOLITARY_SAREE_NO_BLOUSE = baseItem({
  id: 'edge-solitary-saree',
  name: 'Grandmother Heirloom Patola Saree',
  category: 'Ethnic',
  subcategory: 'saree',
  colors: ['red', 'mustard'],
  fabric: 'silk',
  pattern: 'ikat',
  formality: 5,
  occasions: ['wedding guest', 'festive', 'celebration'],
});

