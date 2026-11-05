import { WardrobeItem, Occasion, Season, ContextSnapshot, StylePreferences, PersonalStyleProfile } from '../../../types';
import { WEATHER_DELUGE_MUMBAI } from '../../evaluation/fixtures/weatherFixtures';
import { EnsembleClassification } from '../types';

export interface CompleteOutfitEvaluationCase {
  id: string;
  name: string;
  category:
    | 'traditional_indian'
    | 'indo_western_fusion'
    | 'western_casual_formal'
    | 'international_aesthetic'
    | 'pattern_color_interaction'
    | 'hard_constraints_weather'
    | 'uncertainty_sparse_wardrobe';
  pieces: WardrobeItem[];
  anchorItemId?: string;
  occasion: Occasion;
  season?: Season;
  context?: ContextSnapshot;
  preferences?: StylePreferences;
  styleProfile?: PersonalStyleProfile;
  expectedClassification: EnsembleClassification;
  expectedMinScore?: number;
  expectedMaxScore?: number;
  expectedHardIncompatible?: boolean;
  expectedPenalties?: string[];
  expectedBonuses?: string[];
  groundTruthRationale: string;
  sourceType: 'expert_fashion_curation' | 'synthetic_boundary_fixture';
}

const createItem = (overrides: Partial<WardrobeItem>): WardrobeItem => ({
  id: 'base-item',
  name: 'Base Item',
  category: 'Tops',
  subcategory: 'shirt',
  colors: ['white'],
  seasons: ['summer', 'monsoon', 'winter'],
  occasions: ['everyday', 'office', 'casual outing'],
  formality: 3,
  status: 'clean',
  favorite: false,
  note: '',
  timesWorn: 0,
  userVerified: true,
  ...overrides,
});

// ============================================================================
// VERIFIED ENSEMBLE WARDROBE FIXTURES
// ============================================================================

export const ENSEMBLE_FIXTURE_ITEMS = {
  // Traditional Indian
  kanjivaramSareeRed: createItem({
    id: 'kanjivaram-saree-red',
    name: 'Kanjivaram Crimson Zari Saree',
    category: 'Ethnic',
    subcategory: 'saree',
    colors: ['red', 'gold'],
    fabric: 'silk',
    pattern: 'zari_brocade',
    formality: 5,
    occasions: ['wedding guest', 'celebration', 'festive', 'puja'],
  }),
  silkBlouseGold: createItem({
    id: 'silk-blouse-gold',
    name: 'Raw Silk Gold Blouse',
    category: 'Ethnic',
    subcategory: 'blouse',
    colors: ['gold'],
    fabric: 'silk',
    pattern: 'solid',
    formality: 5,
    occasions: ['wedding guest', 'celebration', 'festive', 'puja'],
  }),
  goldJuttis: createItem({
    id: 'gold-juttis',
    name: 'Embroidered Zari Juttis',
    category: 'Footwear',
    subcategory: 'juttis',
    colors: ['gold'],
    fabric: 'polyblend',
    pattern: 'embroidered',
    formality: 4.5,
    occasions: ['wedding guest', 'celebration', 'festive', 'puja'],
  }),
  chikankariKurtaWhite: createItem({
    id: 'chikankari-kurta-white',
    name: 'Lucknowi Chikankari White Kurta',
    category: 'Ethnic',
    subcategory: 'kurta',
    colors: ['white'],
    fabric: 'cotton',
    pattern: 'embroidered',
    formality: 3.5,
    occasions: ['puja', 'festive', 'everyday', 'family gathering'],
  }),
  cottonChuridarWhite: createItem({
    id: 'cotton-churidar-white',
    name: 'Pure Cotton Churidar',
    category: 'Ethnic',
    subcategory: 'churidar',
    colors: ['white'],
    fabric: 'cotton',
    pattern: 'solid',
    formality: 3.5,
    occasions: ['puja', 'festive', 'everyday'],
  }),
  yellowChiffonDupatta: createItem({
    id: 'yellow-chiffon-dupatta',
    name: 'Auspicious Mustard Yellow Dupatta',
    category: 'Ethnic',
    subcategory: 'dupatta',
    colors: ['yellow'],
    fabric: 'chiffon',
    pattern: 'solid',
    formality: 3.5,
    occasions: ['puja', 'festive'],
  }),
  ivorySherwani: createItem({
    id: 'ivory-sherwani',
    name: 'Ivory Raw Silk Sherwani',
    category: 'Ethnic',
    subcategory: 'sherwani',
    colors: ['ivory', 'gold'],
    fabric: 'silk',
    pattern: 'embroidered',
    formality: 5,
    occasions: ['wedding guest', 'celebration'],
  }),
  goldSilkChuridar: createItem({
    id: 'gold-silk-churidar',
    name: 'Tussar Silk Gold Churidar',
    category: 'Ethnic',
    subcategory: 'churidar',
    colors: ['gold'],
    fabric: 'silk',
    pattern: 'solid',
    formality: 4.8,
    occasions: ['wedding guest', 'celebration'],
  }),

  // Indo-Western Fusion
  mustardKurtiCotton: createItem({
    id: 'mustard-kurti-cotton',
    name: 'Short Cotton Handblock Kurti',
    category: 'Ethnic',
    subcategory: 'kurti',
    colors: ['mustard'],
    fabric: 'cotton',
    pattern: 'solid',
    formality: 2.5,
    occasions: ['college', 'casual outing', 'everyday'],
  }),
  slimBlueJeans: createItem({
    id: 'slim-blue-jeans',
    name: 'Indigo Slim Fit Denim Jeans',
    category: 'Bottoms',
    subcategory: 'jeans',
    colors: ['navy', 'blue'],
    fabric: 'denim',
    pattern: 'solid',
    formality: 2.0,
    occasions: ['college', 'casual outing', 'everyday'],
  }),
  whiteSneakers: createItem({
    id: 'white-sneakers',
    name: 'Classic White Leather Sneakers',
    category: 'Footwear',
    subcategory: 'sneakers',
    colors: ['white'],
    fabric: 'polyblend',
    pattern: 'solid',
    formality: 2.0,
    occasions: ['college', 'casual outing', 'everyday'],
  }),
  khadiNehruJacket: createItem({
    id: 'khadi-nehru-jacket',
    name: 'Charcoal Khadi Nehru Jacket',
    category: 'Outerwear',
    subcategory: 'nehru jacket',
    colors: ['charcoal', 'grey'],
    fabric: 'khadi',
    pattern: 'solid',
    formality: 3.8,
    occasions: ['office', 'festive', 'family gathering'],
  }),
  linenShirtWhite: createItem({
    id: 'linen-shirt-white',
    name: 'Relaxed White Linen Shirt',
    category: 'Tops',
    subcategory: 'shirt',
    colors: ['white'],
    fabric: 'linen',
    pattern: 'solid',
    formality: 3.0,
    occasions: ['office', 'casual outing', 'date'],
  }),
  chinosBeige: createItem({
    id: 'chinos-beige',
    name: 'Tailored Beige Cotton Chinos',
    category: 'Bottoms',
    subcategory: 'trousers',
    colors: ['beige'],
    fabric: 'cotton',
    pattern: 'solid',
    formality: 3.2,
    occasions: ['office', 'casual outing', 'date'],
  }),
  brownLoafers: createItem({
    id: 'brown-loafers',
    name: 'Dark Brown Leather Loafers',
    category: 'Footwear',
    subcategory: 'loafers',
    colors: ['brown'],
    fabric: 'polyblend',
    pattern: 'solid',
    formality: 3.5,
    occasions: ['office', 'casual outing', 'date'],
  }),

  // Western Formal & Casual
  navyTailoredBlazer: createItem({
    id: 'navy-tailored-blazer',
    name: 'Navy Structured Wool Blazer',
    category: 'Outerwear',
    subcategory: 'blazer',
    colors: ['navy'],
    fabric: 'wool',
    pattern: 'solid',
    formality: 4.2,
    occasions: ['office', 'interview', 'date'],
  }),
  tailoredTrousersNavy: createItem({
    id: 'tailored-trousers-navy',
    name: 'Navy Wool Tailored Trousers',
    category: 'Bottoms',
    subcategory: 'trousers',
    colors: ['navy'],
    fabric: 'wool',
    pattern: 'solid',
    formality: 4.2,
    occasions: ['office', 'interview'],
  }),
  oxfordFormalShoes: createItem({
    id: 'oxford-formal-shoes',
    name: 'Black Calfskin Oxford Shoes',
    category: 'Footwear',
    subcategory: 'formal shoes',
    colors: ['black'],
    fabric: 'polyblend',
    pattern: 'solid',
    formality: 4.5,
    occasions: ['office', 'interview'],
  }),
  basicWhiteTee: createItem({
    id: 'basic-white-tee',
    name: 'Crew Neck White Cotton T-Shirt',
    category: 'Tops',
    subcategory: 't-shirt',
    colors: ['white'],
    fabric: 'cotton',
    pattern: 'solid',
    formality: 1.8,
    occasions: ['college', 'everyday', 'casual outing'],
  }),

  // International Aesthetics (Korean / Japanese)
  oversizedBoxyTee: createItem({
    id: 'oversized-boxy-tee',
    name: 'Heavyweight Drop-Shoulder Oversized Tee',
    category: 'Tops',
    subcategory: 't-shirt',
    colors: ['grey'],
    fabric: 'cotton',
    pattern: 'solid',
    fit: 'oversized',
    formality: 2.0,
    occasions: ['college', 'casual outing'],
  }),
  wideBalloonPants: createItem({
    id: 'wide-balloon-pants',
    name: 'Pleated Wide Balloon Pants',
    category: 'Bottoms',
    subcategory: 'trousers',
    colors: ['black'],
    fabric: 'cotton',
    pattern: 'solid',
    fit: 'oversized',
    formality: 2.2,
    occasions: ['college', 'casual outing'],
  }),
  chunkySneakersBlack: createItem({
    id: 'chunky-sneakers-black',
    name: 'Technical Platform Sneakers',
    category: 'Footwear',
    subcategory: 'sneakers',
    colors: ['black', 'white'],
    fabric: 'polyblend',
    pattern: 'solid',
    formality: 2.0,
    occasions: ['college', 'casual outing'],
  }),

  // Clashing & Extreme Fixtures
  floralBlouseMagenta: createItem({
    id: 'floral-blouse-magenta',
    name: 'Vibrant Magenta Tropical Floral Blouse',
    category: 'Tops',
    subcategory: 'top',
    colors: ['magenta'],
    fabric: 'polyblend',
    pattern: 'floral',
    formality: 3.0,
    occasions: ['casual outing'],
  }),
  geometricTrousersGreen: createItem({
    id: 'geometric-trousers-green',
    name: 'Emerald Geometric Diamond Trousers',
    category: 'Bottoms',
    subcategory: 'trousers',
    colors: ['green', 'yellow'],
    fabric: 'polyblend',
    pattern: 'geometric',
    formality: 3.0,
    occasions: ['casual outing'],
  }),
  neonOrangeFlipFlops: createItem({
    id: 'neon-orange-flip-flops',
    name: 'Neon Orange Beach Flip Flops',
    category: 'Footwear',
    subcategory: 'sandals',
    colors: ['orange'],
    fabric: 'polyblend',
    pattern: 'solid',
    formality: 1.0,
    occasions: ['everyday'],
  }),
  dirtyLinenShirtInLaundry: createItem({
    id: 'dirty-linen-shirt-laundry',
    name: 'Stained Linen Shirt in Hamper',
    category: 'Tops',
    subcategory: 'shirt',
    colors: ['beige'],
    fabric: 'linen',
    status: 'in_laundry',
    formality: 3.0,
    occasions: ['everyday'],
  }),
  unlabelledCameraPhoto: createItem({
    id: 'unlabelled-camera-photo',
    name: 'IMG_20261106_RawUpload.jpg',
    category: 'Tops',
    subcategory: 'shirt',
    colors: [],
    fabric: undefined,
    pattern: undefined,
    userVerified: false,
    aiConfidence: 0.2,
    formality: 2.5,
    occasions: ['everyday'],
  }),
};

// ============================================================================
// COMPLETE OUTFIT EVALUATION CASES (N = 22)
// ============================================================================

export const COMPLETE_OUTFIT_EVALUATION_DATASET: CompleteOutfitEvaluationCase[] = [
  // 1. Traditional Indian Ensembles
  {
    id: 'ens-trad-01',
    name: 'Ceremonial Kanjivaram Saree with Gold Blouse and Juttis',
    category: 'traditional_indian',
    pieces: [
      ENSEMBLE_FIXTURE_ITEMS.kanjivaramSareeRed,
      ENSEMBLE_FIXTURE_ITEMS.silkBlouseGold,
      ENSEMBLE_FIXTURE_ITEMS.goldJuttis,
    ],
    anchorItemId: 'kanjivaram-saree-red',
    occasion: 'wedding guest',
    season: 'winter',
    expectedClassification: 'highly_compatible',
    expectedMinScore: 8.5,
    groundTruthRationale:
      'Archetypal South Indian wedding attire: crimson zari silk saree with structured gold blouse and matching footwear.',
    sourceType: 'expert_fashion_curation',
  },
  {
    id: 'ens-trad-02',
    name: 'Men Ceremonial Ivory Sherwani with Gold Silk Churidar and Juttis',
    category: 'traditional_indian',
    pieces: [
      ENSEMBLE_FIXTURE_ITEMS.ivorySherwani,
      ENSEMBLE_FIXTURE_ITEMS.goldSilkChuridar,
      ENSEMBLE_FIXTURE_ITEMS.goldJuttis,
    ],
    anchorItemId: 'ivory-sherwani',
    occasion: 'wedding guest',
    season: 'winter',
    expectedClassification: 'highly_compatible',
    expectedMinScore: 8.5,
    groundTruthRationale:
      'Classic North Indian groom/guest ensemble: textured raw silk sherwani anchored by lustrous churidar and footwear.',
    sourceType: 'expert_fashion_curation',
  },
  {
    id: 'ens-trad-03',
    name: 'Puja Chikankari Kurta with White Churidar and Yellow Auspicious Dupatta',
    category: 'traditional_indian',
    pieces: [
      ENSEMBLE_FIXTURE_ITEMS.chikankariKurtaWhite,
      ENSEMBLE_FIXTURE_ITEMS.cottonChuridarWhite,
      ENSEMBLE_FIXTURE_ITEMS.yellowChiffonDupatta,
    ],
    occasion: 'puja',
    season: 'summer',
    expectedClassification: 'highly_compatible',
    expectedMinScore: 8.0,
    expectedBonuses: ['Devotional decorum'],
    groundTruthRationale:
      'Pristine white cotton Lucknowi chikankari with traditional white bottoms accented by sacred mustard yellow for religious ritual.',
    sourceType: 'expert_fashion_curation',
  },

  // 2. Indo-Western Fusion
  {
    id: 'ens-fuse-01',
    name: 'Campus Indo-Western: Cotton Kurti with Slim Denim and White Sneakers',
    category: 'indo_western_fusion',
    pieces: [
      ENSEMBLE_FIXTURE_ITEMS.mustardKurtiCotton,
      ENSEMBLE_FIXTURE_ITEMS.slimBlueJeans,
      ENSEMBLE_FIXTURE_ITEMS.whiteSneakers,
    ],
    anchorItemId: 'mustard-kurti-cotton',
    occasion: 'college',
    season: 'summer',
    expectedClassification: 'highly_compatible',
    expectedMinScore: 8.0,
    expectedBonuses: ['Indo-Western fusion bridge'],
    groundTruthRationale:
      'The definitive modern Indian college uniform: breathable mustard kurti grounded by classic indigo denim and clean sneakers.',
    sourceType: 'expert_fashion_curation',
  },
  {
    id: 'ens-fuse-02',
    name: 'Contemporary Layering: Khadi Nehru Jacket over Linen Shirt and Chinos',
    category: 'indo_western_fusion',
    pieces: [
      ENSEMBLE_FIXTURE_ITEMS.khadiNehruJacket,
      ENSEMBLE_FIXTURE_ITEMS.linenShirtWhite,
      ENSEMBLE_FIXTURE_ITEMS.chinosBeige,
      ENSEMBLE_FIXTURE_ITEMS.brownLoafers,
    ],
    anchorItemId: 'khadi-nehru-jacket',
    occasion: 'office',
    season: 'summer',
    expectedClassification: 'highly_compatible',
    expectedMinScore: 8.2,
    groundTruthRationale:
      'Sophisticated pan-Indian smart casual: textured handloom khadi vest elevates neutral Western linen shirt and tailored chinos.',
    sourceType: 'expert_fashion_curation',
  },

  // 3. Western Casual & Formal
  {
    id: 'ens-west-01',
    name: 'Classic Everyday: White Tee, Slim Blue Jeans, White Sneakers',
    category: 'western_casual_formal',
    pieces: [
      ENSEMBLE_FIXTURE_ITEMS.basicWhiteTee,
      ENSEMBLE_FIXTURE_ITEMS.slimBlueJeans,
      ENSEMBLE_FIXTURE_ITEMS.whiteSneakers,
    ],
    occasion: 'everyday',
    season: 'summer',
    expectedClassification: 'highly_compatible',
    expectedMinScore: 8.0,
    groundTruthRationale:
      'Timeless casual aesthetic: neutral white crew neck, blue denim, and white sneakers with balanced proportions.',
    sourceType: 'expert_fashion_curation',
  },
  {
    id: 'ens-west-02',
    name: 'Executive Tailoring: Navy Wool Blazer, Trousers, Oxford Shoes',
    category: 'western_casual_formal',
    pieces: [
      ENSEMBLE_FIXTURE_ITEMS.navyTailoredBlazer,
      ENSEMBLE_FIXTURE_ITEMS.linenShirtWhite,
      ENSEMBLE_FIXTURE_ITEMS.tailoredTrousersNavy,
      ENSEMBLE_FIXTURE_ITEMS.oxfordFormalShoes,
    ],
    anchorItemId: 'navy-tailored-blazer',
    occasion: 'interview',
    season: 'winter',
    expectedClassification: 'highly_compatible',
    expectedMinScore: 8.5,
    groundTruthRationale:
      'Corporate formal suit: monochromatic navy wool coordinate with crisp white shirt and formal black oxfords.',
    sourceType: 'expert_fashion_curation',
  },

  // 4. International Aesthetics (Korean / Japanese)
  {
    id: 'ens-intl-01',
    name: 'Korean Streetwear Drape with Active Streetwear Preference',
    category: 'international_aesthetic',
    pieces: [
      ENSEMBLE_FIXTURE_ITEMS.oversizedBoxyTee,
      ENSEMBLE_FIXTURE_ITEMS.wideBalloonPants,
      ENSEMBLE_FIXTURE_ITEMS.chunkySneakersBlack,
    ],
    occasion: 'casual outing',
    season: 'summer',
    preferences: {
      preferredAesthetics: ['streetwear', 'korean_aesthetic'],
      stylingMode: 'balanced',
    } as any,
    expectedClassification: 'highly_compatible',
    expectedMinScore: 8.0,
    expectedBonuses: ['Intentional relaxed volume'],
    groundTruthRationale:
      'Seoul streetwear silhouette: intentional oversized proportions validated by user aesthetic preference.',
    sourceType: 'expert_fashion_curation',
  },
  {
    id: 'ens-intl-02',
    name: 'Korean Relaxed Volume without Aesthetic Preference (Volume Collision)',
    category: 'international_aesthetic',
    pieces: [
      ENSEMBLE_FIXTURE_ITEMS.oversizedBoxyTee,
      ENSEMBLE_FIXTURE_ITEMS.wideBalloonPants,
      ENSEMBLE_FIXTURE_ITEMS.chunkySneakersBlack,
    ],
    occasion: 'casual outing',
    season: 'summer',
    preferences: {
      preferredAesthetics: ['classic'],
      stylingMode: 'balanced',
    } as any,
    expectedClassification: 'neutral',
    expectedMaxScore: 6.5,
    expectedPenalties: ['Volume collision'],
    groundTruthRationale:
      'Under conventional classic styling rules, unanchored oversized top + oversized bottoms triggers a volume collision penalty.',
    sourceType: 'expert_fashion_curation',
  },

  // 5. Pattern & Color Interactions (Clashes & Harmonizers)
  {
    id: 'ens-clash-01',
    name: 'Competing Busy Statement Prints Clash',
    category: 'pattern_color_interaction',
    pieces: [
      ENSEMBLE_FIXTURE_ITEMS.floralBlouseMagenta,
      ENSEMBLE_FIXTURE_ITEMS.geometricTrousersGreen,
      ENSEMBLE_FIXTURE_ITEMS.whiteSneakers,
    ],
    occasion: 'casual outing',
    expectedClassification: 'clashing',
    expectedMaxScore: 4.8,
    expectedPenalties: ['Pattern clutter'],
    groundTruthRationale:
      'Catastrophic pattern clash: bold tropical floral competing with geometric print trousers creates optical vibration.',
    sourceType: 'expert_fashion_curation',
  },
  {
    id: 'ens-clash-02',
    name: 'Extreme Formality Dissonance: Executive Suit with Neon Flip Flops',
    category: 'pattern_color_interaction',
    pieces: [
      ENSEMBLE_FIXTURE_ITEMS.navyTailoredBlazer,
      ENSEMBLE_FIXTURE_ITEMS.linenShirtWhite,
      ENSEMBLE_FIXTURE_ITEMS.tailoredTrousersNavy,
      ENSEMBLE_FIXTURE_ITEMS.neonOrangeFlipFlops,
    ],
    occasion: 'interview',
    expectedClassification: 'clashing',
    expectedMaxScore: 4.8,
    expectedPenalties: ['Weakest link penalty', 'Severe formality dissonance'],
    groundTruthRationale:
      'Weakest link safeguard: a high-scoring 4.5 formality suit ruined by 1.0 neon beach flip flops must be decisively penalized.',
    sourceType: 'expert_fashion_curation',
  },

  // 6. Hard Constraints & Climate Hazards
  {
    id: 'ens-hard-01',
    name: 'Unwearable Laundry Item Rejection',
    category: 'hard_constraints_weather',
    pieces: [
      ENSEMBLE_FIXTURE_ITEMS.dirtyLinenShirtInLaundry,
      ENSEMBLE_FIXTURE_ITEMS.chinosBeige,
      ENSEMBLE_FIXTURE_ITEMS.brownLoafers,
    ],
    occasion: 'everyday',
    expectedClassification: 'hard_incompatible',
    expectedHardIncompatible: true,
    expectedMaxScore: 0.0,
    groundTruthRationale:
      'Physical wearability impossibility: garments currently in laundry are non-compensatory hard rejects.',
    sourceType: 'expert_fashion_curation',
  },
  {
    id: 'ens-hard-02',
    name: 'Active Monsoon Deluge Silk Hazard',
    category: 'hard_constraints_weather',
    pieces: [
      ENSEMBLE_FIXTURE_ITEMS.kanjivaramSareeRed,
      ENSEMBLE_FIXTURE_ITEMS.silkBlouseGold,
      ENSEMBLE_FIXTURE_ITEMS.goldJuttis,
    ],
    occasion: 'wedding guest',
    season: 'monsoon',
    context: {
      ...WEATHER_DELUGE_MUMBAI,
      occasion: 'wedding guest',
    },
    expectedClassification: 'hard_incompatible',
    expectedHardIncompatible: true,
    expectedMaxScore: 0.0,
    groundTruthRationale:
      'Severe weather preservation: delicate non-washable pure silk saree is destroyed by torrential Mumbai monsoon rain.',
    sourceType: 'expert_fashion_curation',
  },

  // 7. Uncertainty & Missing Metadata Neutrality
  {
    id: 'ens-uncert-01',
    name: 'Unlabelled Camera Upload Evaluated Neutrally',
    category: 'uncertainty_sparse_wardrobe',
    pieces: [
      ENSEMBLE_FIXTURE_ITEMS.unlabelledCameraPhoto,
      ENSEMBLE_FIXTURE_ITEMS.slimBlueJeans,
      ENSEMBLE_FIXTURE_ITEMS.whiteSneakers,
    ],
    occasion: 'everyday',
    expectedClassification: 'neutral',
    expectedMinScore: 4.5,
    expectedMaxScore: 6.0,
    groundTruthRationale:
      'Bayesian neutrality: missing garment attributes shrink toward neutral prior mean (5.0/10) without false rejection.',
    sourceType: 'synthetic_boundary_fixture',
  },
];
