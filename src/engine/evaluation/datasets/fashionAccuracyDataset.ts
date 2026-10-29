import { EvaluationCase } from '../types';
import {
  WEATHER_HOT_HUMID_MUMBAI,
  WEATHER_HOT_HUMID_CHENNAI,
  WEATHER_HOT_DRY_JAIPUR,
  WEATHER_COLD_DELHI_WINTER,
  WEATHER_DELUGE_MUMBAI,
  WEATHER_THUNDERSTORM_BANGALORE,
  WEATHER_MILD_DRIZZLE,
  WEATHER_UNAVAILABLE,
} from '../fixtures/weatherFixtures';
import {
  MEN_SHERWANI_CREAM,
  MEN_CHURIDAR_GOLD,
  MEN_JUTTIS_GOLD,
  MEN_MUNDU_KASAVU,
  MEN_KURTA_CREAM_COTTON_SILK,
  MEN_SANDALS_BROWN,
  MEN_BANDHGALA_CHARCOAL,
  MEN_TROUSERS_BLACK_FORMAL,
  MEN_FORMAL_OXFORDS,
  MEN_KHADI_KURTA_INDIGO,
  MEN_PAJAMA_WHITE,
  MEN_JEANS_DARK_DENIM,
  MEN_SNEAKERS_WHITE,
  MEN_NEHRU_JACKET_TUSSAR,
  MEN_CASUAL_TEE_WHITE,
  MEN_CASUAL_HOODIE_GREY,
  MEN_CASUAL_SHORTS_NAVY,
  WOMEN_KANJEEVARAM_SAREE_RED,
  WOMEN_SILK_BLOUSE_GOLD,
  WOMEN_HEELS_METALLIC,
  WOMEN_CHIKANKARI_KURTI_LAVENDER,
  WOMEN_PALAZZO_WHITE_COTTON,
  WOMEN_MOJARIS_SILVER,
  WOMEN_LEHENGA_EMERALD,
  WOMEN_CHOLI_BLOUSE_EMERALD,
  WOMEN_DUPATTA_GOLD_NET,
  WOMEN_CHANDERI_SAREE_MINT,
  WOMEN_BLOUSE_RAW_SILK_GREEN,
  WOMEN_ANARKALI_NAVY_MODEST,
  WOMEN_CHURIDAR_NAVY,
  WOMEN_DUPATTA_CHIFFON_NAVY,
  WOMEN_TAILORED_BLAZER_NAVY,
  WOMEN_FORMAL_SHIRT_WHITE,
  WOMEN_TROUSERS_NAVY,
  WOMEN_LOAFERS_BLACK,
  WOMEN_CROP_TOP_RED,
  WOMEN_SHORTS_DENIM_DISTRESSED,
  WOMEN_BLACK_WESTERN_DRESS,
  OVERSIZED_BOXY_TEE_BEIGE,
  RELAXED_WIDE_LEG_CHINOS_OLIVE,
  JAPANESE_CHORE_JACKET_INDIGO,
  EUROPEAN_TRENCH_COAT_CAMEL,
  DIRTY_SHIRT_IN_LAUNDRY,
  DIRTY_KURTA_NEEDS_WASHING,
  WOOL_SWEATER_MUSTARD,
  SUEDE_LOAFERS_BROWN,
  UNKNOWN_FABRIC_TOP,
  SOLITARY_SAREE_NO_BLOUSE,
} from '../fixtures/wardrobeFixtures';

export const FASHION_ACCURACY_EVALUATION_DATASET: readonly EvaluationCase[] = Object.freeze([
  // ==========================================================================
  // 1. TRADITIONAL INDIAN ATTIRE & CEREMONIAL ENSEMBLES
  // ==========================================================================
  {
    id: 'case-01-men-wedding-host-sherwani',
    name: 'Men Ceremonial Wedding Host Sherwani Ensemble',
    category: 'traditional_indian',
    ageBand: 'adult_18_plus',
    presentationPreference: 'masculine',
    userPreferences: {
      stylingMode: 'variety',
      preferredAesthetics: ['Traditional'],
      updatedAt: 1729000000000,
    },
    wardrobe: [
      MEN_SHERWANI_CREAM,
      MEN_CHURIDAR_GOLD,
      MEN_JUTTIS_GOLD,
      MEN_CASUAL_TEE_WHITE,
      MEN_JEANS_DARK_DENIM,
      MEN_SNEAKERS_WHITE,
      DIRTY_KURTA_NEEDS_WASHING,
    ],
    occasion: 'wedding guest',
    season: 'winter',
    weatherFixture: WEATHER_COLD_DELHI_WINTER,
    culturalSignals: {
      regionalTradition: 'north',
      userRole: 'host',
    },
    explicitConstraints: {
      mustIncludeItemIds: ['m-sherwani-cream', 'm-churidar-gold', 'm-juttis-gold'],
      mustExcludeItemIds: ['edge-kurta-wash', 'm-tee-white', 'm-shorts-navy'],
      minFormality: 4.5,
    },
    expectedCompatibility: {
      acceptableTemplates: ['Sherwani look'],
      expectedFabrics: ['silk'],
      expectedEvidenceSources: ['cultural'],
    },
    knownUnacceptableOutcomes: [
      'Recommending casual t-shirt or sneakers for a ceremonial wedding host',
      'Selecting dirty kurta that needs washing',
      'Hallucinating accessories not present in wardrobe',
    ],
    humanReviewCriteria: {
      culturalNuanceDescription:
        'North Indian wedding host attire requires regal, elevated formality (Sherwani/Achkan with Churidar and handcrafted Juttis). Casual pieces and footwear (sneakers) represent severe cultural disrespect.',
      regionalSpecificity: 'North Indian / Delhi ceremonial wedding traditions.',
      expertReviewStatus: 'approved',
    },
  },

  {
    id: 'case-02-women-wedding-guest-kanjeevaram',
    name: 'Women South Indian Wedding Guest Kanjeevaram Saree',
    category: 'traditional_indian',
    ageBand: 'adult_18_plus',
    presentationPreference: 'feminine',
    userPreferences: {
      stylingMode: 'variety',
      preferredAesthetics: ['Traditional'],
      updatedAt: 1729000000000,
    },
    wardrobe: [
      WOMEN_KANJEEVARAM_SAREE_RED,
      WOMEN_SILK_BLOUSE_GOLD,
      WOMEN_HEELS_METALLIC,
      WOMEN_CROP_TOP_RED,
      WOMEN_SHORTS_DENIM_DISTRESSED,
      WOMEN_BLACK_WESTERN_DRESS,
    ],
    occasion: 'wedding guest',
    season: 'summer',
    weatherFixture: WEATHER_HOT_HUMID_CHENNAI,
    culturalSignals: {
      regionalTradition: 'south',
      userRole: 'guest',
    },
    explicitConstraints: {
      mustIncludeItemIds: ['w-saree-kanjeevaram-red', 'w-blouse-gold'],
      minFormality: 4.5,
    },
    expectedCompatibility: {
      acceptableTemplates: ['Saree look'],
      expectedCraftsOrPatterns: ['zari_brocade'],
      expectedFabrics: ['silk'],
      expectedEvidenceSources: ['cultural'],
    },
    knownUnacceptableOutcomes: [
      'Recommending black western dress or distressed denim cutoffs for South Indian wedding guest',
      'Recommending saree without the required matching blouse',
    ],
    humanReviewCriteria: {
      culturalNuanceDescription:
        'South Indian wedding guest decorum prioritizes auspicious colors (crimson, gold, yellow) and master handwoven silks (Kanjeevaram) with traditional temple motifs. Black is strictly frowned upon at traditional South Indian weddings.',
      regionalSpecificity: 'Tamil Nadu / Karnataka wedding tradition.',
      expertReviewStatus: 'approved',
    },
  },

  {
    id: 'case-03-women-festive-lehenga-celebration',
    name: 'Women Grand Festive Celebration Lehenga Ensemble',
    category: 'traditional_indian',
    ageBand: 'adult_18_plus',
    presentationPreference: 'feminine',
    userPreferences: {
      stylingMode: 'variety',
      preferredAesthetics: ['Traditional'],
      updatedAt: 1729000000000,
    },
    wardrobe: [
      WOMEN_LEHENGA_EMERALD,
      WOMEN_CHOLI_BLOUSE_EMERALD,
      WOMEN_DUPATTA_GOLD_NET,
      WOMEN_HEELS_METALLIC,
      WOMEN_FORMAL_SHIRT_WHITE,
      WOMEN_TROUSERS_NAVY,
    ],
    occasion: 'celebration',
    season: 'winter',
    weatherFixture: WEATHER_COLD_DELHI_WINTER,
    culturalSignals: {
      regionalTradition: 'north',
      userRole: 'key_family',
    },
    explicitConstraints: {
      mustIncludeItemIds: ['w-lehenga-emerald', 'w-choli-emerald', 'w-dupatta-gold'],
      minFormality: 4.5,
    },
    expectedCompatibility: {
      acceptableTemplates: ['Lehenga ensemble'],
      expectedFabrics: ['banarasi', 'velvet'],
    },
    knownUnacceptableOutcomes: [
      'Incomplete lehenga ensemble missing blouse or dupatta',
      'Pairing corporate trousers with festive lehenga blouse',
    ],
    humanReviewCriteria: {
      culturalNuanceDescription:
        'Banarasi zari brocade lehenga with coordinating velvet choli and structured dupatta drape provides regal weight and thermal insulation suitable for North Indian winter celebrations.',
      regionalSpecificity: 'North / West celebratory grand events.',
      expertReviewStatus: 'approved',
    },
  },

  // ==========================================================================
  // 2. REGIONAL INDIAN TRADITIONS & CRAFTSMANSHIP
  // ==========================================================================
  {
    id: 'case-04-men-south-mundu-temple-puja',
    name: 'Men South Indian Temple Puja with Kasavu Mundu',
    category: 'regional_traditions',
    ageBand: 'adult_18_plus',
    presentationPreference: 'masculine',
    userPreferences: {
      stylingMode: 'variety',
      preferredAesthetics: ['Traditional'],
      regionalInterests: ['south'],
      updatedAt: 1729000000000,
    },
    wardrobe: [
      MEN_MUNDU_KASAVU,
      MEN_KURTA_CREAM_COTTON_SILK,
      MEN_SANDALS_BROWN,
      MEN_JEANS_DARK_DENIM,
      MEN_CASUAL_HOODIE_GREY,
      MEN_SNEAKERS_WHITE,
    ],
    occasion: 'puja',
    season: 'summer',
    weatherFixture: WEATHER_HOT_HUMID_CHENNAI,
    culturalSignals: {
      regionalTradition: 'south',
    },
    explicitConstraints: {
      mustIncludeItemIds: ['m-mundu-kasavu', 'm-kurta-cream-silk', 'm-sandals-brown'],
      mustExcludeItemIds: ['m-jeans-dark', 'm-hoodie-grey', 'm-sneakers-white'],
    },
    expectedCompatibility: {
      acceptableTemplates: ['Dhoti & Kurta look'],
      expectedEvidenceSources: ['cultural'],
    },
    knownUnacceptableOutcomes: [
      'Wearing sneakers or denim jeans inside a traditional South Indian temple sanctum',
      'Wearing dark grey fleece hoodie for humid devotional puja',
    ],
    humanReviewCriteria: {
      culturalNuanceDescription:
        'Kerala / Tamil temple decorum requires unstitched or draped lower garments (Kasavu Mundu / Veshti) in cream and gold with pure natural fibers. Footwear must be slip-on sandals easily removed at temple gates; western footwear/denim is culturally inappropriate.',
      regionalSpecificity: 'Kerala / Tamil Nadu temple ritual decorum.',
      expertReviewStatus: 'approved',
    },
  },

  {
    id: 'case-05-women-lucknowi-chikankari-summer',
    name: 'Women Lucknowi Chikankari Handloom in Hot/Humid Weather',
    category: 'regional_traditions',
    ageBand: 'adult_18_plus',
    presentationPreference: 'feminine',
    userPreferences: {
      stylingMode: 'simple',
      preferredAesthetics: ['Ethnic-loving'],
      regionalInterests: ['north'],
      updatedAt: 1729000000000,
    },
    wardrobe: [
      WOMEN_CHIKANKARI_KURTI_LAVENDER,
      WOMEN_PALAZZO_WHITE_COTTON,
      WOMEN_MOJARIS_SILVER,
      WOMEN_BLACK_WESTERN_DRESS,
      WOMEN_HEELS_METALLIC,
    ],
    occasion: 'everyday',
    season: 'summer',
    weatherFixture: WEATHER_HOT_HUMID_MUMBAI,
    culturalSignals: {
      regionalTradition: 'north',
    },
    explicitConstraints: {
      mustIncludeItemIds: ['w-kurti-chikankari-lavender', 'w-palazzo-white'],
    },
    expectedCompatibility: {
      acceptableTemplates: ['Kurta look', 'Indo-western'],
      expectedCraftsOrPatterns: ['chikankari'],
      expectedFabrics: ['mulmul', 'cotton'],
      expectedEvidenceSources: ['weather', 'cultural'],
    },
    knownUnacceptableOutcomes: [
      'Recommending synthetic black crepe dress in 33°C / 88% humidity Mumbai weather',
      'Ignoring the high thermal breathability of Lucknowi mulmul cotton',
    ],
    humanReviewCriteria: {
      culturalNuanceDescription:
        'Awadhi Chikankari on fine mulmul muslin was historically developed for extreme subcontinental heat and humidity, offering air permeability and understated pastel grace.',
      regionalSpecificity: 'Awadh / Uttar Pradesh textile heritage.',
      expertReviewStatus: 'approved',
    },
  },

  {
    id: 'case-06-women-central-chanderi-smart-ethnic',
    name: 'Women Handwoven Chanderi Saree for Professional Ethnic Setting',
    category: 'regional_traditions',
    ageBand: 'adult_18_plus',
    presentationPreference: 'feminine',
    userPreferences: {
      stylingMode: 'variety',
      preferredAesthetics: ['Traditional', 'Minimal'],
      regionalInterests: ['central'],
      updatedAt: 1729000000000,
    },
    wardrobe: [
      WOMEN_CHANDERI_SAREE_MINT,
      WOMEN_BLOUSE_RAW_SILK_GREEN,
      WOMEN_MOJARIS_SILVER,
      WOMEN_CROP_TOP_RED,
      WOMEN_SHORTS_DENIM_DISTRESSED,
    ],
    occasion: 'office',
    season: 'summer',
    weatherFixture: WEATHER_HOT_DRY_JAIPUR,
    culturalSignals: {
      regionalTradition: 'central',
    },
    explicitConstraints: {
      mustIncludeItemIds: ['w-saree-chanderi-mint', 'w-blouse-raw-silk-green'],
      minFormality: 3.5,
    },
    expectedCompatibility: {
      acceptableTemplates: ['Saree look'],
      expectedFabrics: ['chanderi', 'silk'],
    },
    knownUnacceptableOutcomes: [
      'Suggesting casual crop tops or denim shorts for corporate office',
      'Omitting matching blouse from saree drape',
    ],
    humanReviewCriteria: {
      culturalNuanceDescription:
        'Madhya Pradesh Chanderi handlooms combine gossamer silk warp with fine cotton weft, yielding a lightweight, translucent sheen ideal for professional and cultural gatherings.',
      regionalSpecificity: 'Central India (Madhya Pradesh) handloom tradition.',
      expertReviewStatus: 'approved',
    },
  },

  // ==========================================================================
  // 3. CAMPUS, SCHOOL & TEEN SAFETY (AGES 14-17)
  // ==========================================================================
  {
    id: 'case-07-teen-girl-school-safeguard',
    name: 'Teen Girl School/Coaching Dress Code Safeguard (Age 15)',
    category: 'campus_teen_safety',
    ageBand: 'teen_14_17',
    presentationPreference: 'feminine',
    userPreferences: {
      stylingMode: 'simple',
      ageBand: 'teen_14_17',
      preferredAesthetics: ['Casual'],
      updatedAt: 1729000000000,
    },
    wardrobe: [
      WOMEN_CHIKANKARI_KURTI_LAVENDER,
      WOMEN_PALAZZO_WHITE_COTTON,
      WOMEN_MOJARIS_SILVER,
      WOMEN_CROP_TOP_RED,
      WOMEN_SHORTS_DENIM_DISTRESSED,
    ],
    occasion: 'school',
    season: 'summer',
    explicitConstraints: {
      teenSafeguardActive: true,
      forbidSubcategories: ['crop top', 'shorts'],
    },
    expectedCompatibility: {
      acceptableTemplates: ['Kurta look'],
    },
    knownUnacceptableOutcomes: [
      'Recommending crop top or distressed denim shorts for school/coaching day',
      'Generating judgmental, body-shaming, or appearance-rating feedback in explanations',
    ],
    humanReviewCriteria: {
      culturalNuanceDescription:
        'Indian secondary school / coaching institute dress codes require modest, respectful silhouettes (kurtis, trousers, salwars, modest tees). Teen safety logic must protectively filter adult cuts without body-shaming or appearance ratings.',
      regionalSpecificity: 'Pan-Indian educational decorum for minors (14-17).',
      expertReviewStatus: 'approved',
    },
  },

  {
    id: 'case-08-teen-boy-school-campus-compliance',
    name: 'Teen Boy School Campus Attire & Informal Filter (Age 16)',
    category: 'campus_teen_safety',
    ageBand: 'teen_14_17',
    presentationPreference: 'masculine',
    userPreferences: {
      stylingMode: 'simple',
      ageBand: 'teen_14_17',
      preferredAesthetics: ['Casual'],
      updatedAt: 1729000000000,
    },
    wardrobe: [
      MEN_CASUAL_TEE_WHITE,
      MEN_JEANS_DARK_DENIM,
      MEN_SNEAKERS_WHITE,
      MEN_CASUAL_SHORTS_NAVY,
      MEN_SHERWANI_CREAM,
      MEN_CHURIDAR_GOLD,
    ],
    occasion: 'school',
    season: 'summer',
    explicitConstraints: {
      teenSafeguardActive: true,
      forbidSubcategories: ['shorts', 'sherwani'],
      maxFormality: 3.0,
    },
    expectedCompatibility: {
      acceptableTemplates: ['Western'],
    },
    knownUnacceptableOutcomes: [
      'Recommending gym/casual shorts for school classes',
      'Recommending wedding sherwani for high school campus',
    ],
    humanReviewCriteria: {
      culturalNuanceDescription:
        'Indian school campus decorum mandates full-length bottoms (trousers or full denim). Ceremonial formalwear like sherwanis is comical on campus, while shorts violate institutional decorum.',
      regionalSpecificity: 'Pan-Indian high school institutional decorum.',
      expertReviewStatus: 'approved',
    },
  },

  {
    id: 'case-09-college-indo-western-student',
    name: 'College Student Everyday Indo-Western Fusion',
    category: 'contemporary_indo_western',
    ageBand: 'adult_18_plus',
    presentationPreference: 'all',
    userPreferences: {
      stylingMode: 'variety',
      preferredAesthetics: ['Indo-western', 'Casual'],
      updatedAt: 1729000000000,
    },
    wardrobe: [
      MEN_KHADI_KURTA_INDIGO,
      MEN_JEANS_DARK_DENIM,
      MEN_SNEAKERS_WHITE,
      MEN_SHERWANI_CREAM,
      MEN_FORMAL_OXFORDS,
    ],
    occasion: 'college',
    season: 'summer',
    explicitConstraints: {
      mustIncludeItemIds: ['m-kurta-khadi-indigo', 'm-jeans-dark', 'm-sneakers-white'],
      mustExcludeItemIds: ['m-sherwani-cream'],
    },
    expectedCompatibility: {
      acceptableTemplates: ['Indo-western', 'Kurta look'],
    },
    knownUnacceptableOutcomes: [
      'Recommending heavy royal sherwani for regular college classes',
      'Demanding formal patent oxfords with casual college jeans',
    ],
    humanReviewCriteria: {
      culturalNuanceDescription:
        'Indo-Western fusion pairing a breathable cotton/khadi kurta with dark denim and clean sneakers is the quintessential modern Indian university campus staple — functional, dignified, and youth-oriented.',
      regionalSpecificity: 'Modern Indian metropolitan college culture.',
      expertReviewStatus: 'approved',
    },
  },

  // ==========================================================================
  // 4. PROFESSIONAL, INTERVIEW & CORPORATE SETTINGS
  // ==========================================================================
  {
    id: 'case-10-men-corporate-interview-bandhgala',
    name: 'Men Executive Interview Architectural Bandhgala Look',
    category: 'professional_interview',
    ageBand: 'adult_18_plus',
    presentationPreference: 'masculine',
    userPreferences: {
      stylingMode: 'simple',
      preferredAesthetics: ['Minimal', 'Traditional'],
      updatedAt: 1729000000000,
    },
    wardrobe: [
      MEN_BANDHGALA_CHARCOAL,
      MEN_TROUSERS_BLACK_FORMAL,
      MEN_FORMAL_OXFORDS,
      MEN_CASUAL_TEE_WHITE,
      MEN_JEANS_DARK_DENIM,
      MEN_SNEAKERS_WHITE,
    ],
    occasion: 'interview',
    season: 'winter',
    weatherFixture: WEATHER_COLD_DELHI_WINTER,
    explicitConstraints: {
      mustIncludeItemIds: ['m-bandhgala-charcoal', 'm-trousers-black', 'm-oxfords-black'],
      minFormality: 4.5,
    },
    expectedCompatibility: {
      acceptableTemplates: ['Bandhgala look', 'Tailored Western'],
    },
    knownUnacceptableOutcomes: [
      'Recommending sneakers or t-shirt for executive job interview',
      'Failing to pair structured trousers with bandhgala jacket',
    ],
    humanReviewCriteria: {
      culturalNuanceDescription:
        'In corporate and diplomatic India, the Bandhgala (Jodhpuri suit) is universally recognized alongside western bespoke 2-piece suits as top-tier executive formalwear.',
      regionalSpecificity: 'Pan-Indian corporate and diplomatic formal decorum.',
      expertReviewStatus: 'approved',
    },
  },

  {
    id: 'case-11-women-executive-interview-tailored-western',
    name: 'Women Leadership Corporate Interview Tailored Western Look',
    category: 'professional_interview',
    ageBand: 'adult_18_plus',
    presentationPreference: 'feminine',
    userPreferences: {
      stylingMode: 'simple',
      preferredAesthetics: ['Minimal'],
      updatedAt: 1729000000000,
    },
    wardrobe: [
      WOMEN_TAILORED_BLAZER_NAVY,
      WOMEN_FORMAL_SHIRT_WHITE,
      WOMEN_TROUSERS_NAVY,
      WOMEN_LOAFERS_BLACK,
      WOMEN_CROP_TOP_RED,
      WOMEN_SHORTS_DENIM_DISTRESSED,
      WOMEN_HEELS_METALLIC,
    ],
    occasion: 'interview',
    season: 'winter',
    weatherFixture: WEATHER_COLD_DELHI_WINTER,
    explicitConstraints: {
      mustIncludeItemIds: ['w-blazer-navy', 'w-shirt-white', 'w-trousers-navy', 'w-loafers-black'],
      minFormality: 4.5,
    },
    expectedCompatibility: {
      acceptableTemplates: ['Tailored Western'],
    },
    knownUnacceptableOutcomes: [
      'Pairing party metallic heels or casual crop top with formal corporate interview suit',
      'Selecting denim cutoffs for corporate interview',
    ],
    humanReviewCriteria: {
      culturalNuanceDescription:
        'Corporate leadership interviews require sharp architectural lines, neutral color blocking (navy, white, black), and closed-toe formal footwear.',
      regionalSpecificity: 'Indian MNC / banking corporate standards.',
      expertReviewStatus: 'approved',
    },
  },

  // ==========================================================================
  // 5. FESTIVALS & RITUAL DRESS CODES
  // ==========================================================================
  {
    id: 'case-12-women-puja-auspicious-decorum',
    name: 'Women Devotional Puja Auspicious Decorum & Black Tone Rejection',
    category: 'festivals_ceremonies',
    ageBand: 'adult_18_plus',
    presentationPreference: 'feminine',
    userPreferences: {
      stylingMode: 'variety',
      preferredAesthetics: ['Traditional'],
      updatedAt: 1729000000000,
    },
    wardrobe: [
      WOMEN_KANJEEVARAM_SAREE_RED,
      WOMEN_SILK_BLOUSE_GOLD,
      WOMEN_MOJARIS_SILVER,
      WOMEN_BLACK_WESTERN_DRESS,
      WOMEN_CROP_TOP_RED,
    ],
    occasion: 'puja',
    season: 'summer',
    explicitConstraints: {
      mustIncludeItemIds: ['w-saree-kanjeevaram-red', 'w-blouse-gold'],
      mustExcludeItemIds: ['w-dress-black'],
    },
    expectedCompatibility: {
      acceptableTemplates: ['Saree look'],
      expectedEvidenceSources: ['cultural'],
    },
    knownUnacceptableOutcomes: [
      'Recommending black dress for devotional Hindu puja ceremony',
      'Selecting crop top or exposing cuts during sacred prayer rites',
    ],
    humanReviewCriteria: {
      culturalNuanceDescription:
        'In Hindu devotional rituals (puja/havan), black is traditionally inauspicious and strictly avoided. Crimson red, turmeric yellow, saffron orange, and gold represent sacred auspiciousness.',
      regionalSpecificity: 'Pan-Indian devotional ritual decorum.',
      expertReviewStatus: 'approved',
    },
  },

  {
    id: 'case-13-women-eid-modest-pastel-mulmul',
    name: 'Women Eid Family Gathering Modest Pastel Mulmul Kurti',
    category: 'festivals_ceremonies',
    ageBand: 'adult_18_plus',
    presentationPreference: 'feminine',
    userPreferences: {
      stylingMode: 'variety',
      preferredAesthetics: ['Traditional'],
      updatedAt: 1729000000000,
    },
    wardrobe: [
      WOMEN_ANARKALI_NAVY_MODEST,
      WOMEN_CHURIDAR_NAVY,
      WOMEN_DUPATTA_CHIFFON_NAVY,
      WOMEN_MOJARIS_SILVER,
      WOMEN_CROP_TOP_RED,
      WOMEN_SHORTS_DENIM_DISTRESSED,
    ],
    occasion: 'Eid',
    season: 'summer',
    weatherFixture: WEATHER_HOT_HUMID_MUMBAI,
    culturalSignals: {
      festivalContext: 'Eid',
      declaredModestyLevel: 'high',
    },
    explicitConstraints: {
      mustIncludeItemIds: ['w-anarkali-navy', 'w-churidar-navy', 'w-dupatta-chiffon-navy'],
      forbidSubcategories: ['crop top', 'shorts'],
    },
    expectedCompatibility: {
      acceptableTemplates: ['Anarkali look', 'Kurta with dupatta'],
      expectedEvidenceSources: ['cultural'],
    },
    knownUnacceptableOutcomes: [
      'Recommending revealing crop top or shorts when user declared high modesty for Eid',
      'Omitting dupatta when high modesty is declared for festive family gathering',
    ],
    humanReviewCriteria: {
      culturalNuanceDescription:
        'Eid celebrations emphasize modest, graceful silhouettes (Anarkali, Kurta with fluid Dupatta) with refined embroidery or pastel tones celebrating community warmth and respect.',
      regionalSpecificity: 'South Asian Muslim festival decorum.',
      expertReviewStatus: 'approved',
    },
  },

  // ==========================================================================
  // 6. CLIMATE EXTREMES & MONSOON HAZARD PROTECTION
  // ==========================================================================
  {
    id: 'case-14-delicate-silk-monsoon-deluge-hazard',
    name: 'Monsoon Torrential Deluge Delicate Silk & Suede Block',
    category: 'climate_extremes',
    ageBand: 'adult_18_plus',
    presentationPreference: 'all',
    userPreferences: {
      stylingMode: 'simple',
      updatedAt: 1729000000000,
    },
    wardrobe: [
      MEN_KHADI_KURTA_INDIGO,
      MEN_PAJAMA_WHITE,
      MEN_SANDALS_BROWN,
      MEN_SHERWANI_CREAM, // Silk: Hazard in torrential rain!
      MEN_CHURIDAR_GOLD,  // Silk: Hazard in torrential rain!
      SUEDE_LOAFERS_BROWN, // Suede: Hazard in torrential rain!
    ],
    occasion: 'everyday',
    season: 'monsoon',
    weatherFixture: WEATHER_DELUGE_MUMBAI,
    explicitConstraints: {
      noClimateHazards: true,
      mustExcludeItemIds: ['m-sherwani-cream', 'm-churidar-gold', 'edge-loafers-suede'],
    },
    expectedCompatibility: {
      acceptableTemplates: ['Kurta look'],
      expectedFabrics: ['khadi', 'cotton'],
      expectedEvidenceSources: ['weather'],
    },
    knownUnacceptableOutcomes: [
      'Recommending pure silk garments or suede footwear in 28mm active torrential downpour',
      'Fabricating dry weather conditions during active monsoon hazard',
    ],
    humanReviewCriteria: {
      culturalNuanceDescription:
        'Pure silk, raw silk, and suede are irrevocably damaged by muddy rainwater during subcontinental monsoon deluges. Handloom cotton, khadi, and quick-drying washable fabrics are essential monsoon safeguards.',
      regionalSpecificity: 'Indian monsoon meteorology (Mumbai, Coastal Konkan, Kerala).',
      expertReviewStatus: 'approved',
    },
  },

  {
    id: 'case-15-hot-dry-desert-breathability',
    name: 'Rajasthan Peak Summer Hot/Dry Natural Fiber Comfort',
    category: 'climate_extremes',
    ageBand: 'adult_18_plus',
    presentationPreference: 'masculine',
    userPreferences: {
      stylingMode: 'simple',
      updatedAt: 1729000000000,
    },
    wardrobe: [
      MEN_KHADI_KURTA_INDIGO,
      MEN_PAJAMA_WHITE,
      MEN_SANDALS_BROWN,
      WOOL_SWEATER_MUSTARD, // Unbearable in 43°C heat
      MEN_CASUAL_HOODIE_GREY, // Heavy fleece in desert summer
    ],
    occasion: 'everyday',
    season: 'summer',
    weatherFixture: WEATHER_HOT_DRY_JAIPUR,
    explicitConstraints: {
      mustIncludeItemIds: ['m-kurta-khadi-indigo', 'm-pajama-white', 'm-sandals-brown'],
      mustExcludeItemIds: ['edge-sweater-wool', 'm-hoodie-grey'],
    },
    expectedCompatibility: {
      acceptableTemplates: ['Kurta look'],
      expectedFabrics: ['khadi', 'cotton'],
      expectedEvidenceSources: ['weather'],
    },
    knownUnacceptableOutcomes: [
      'Recommending heavy wool sweater or fleece hoodie in 43°C Rajasthan heat',
      'Ignoring extreme thermal discomfort penalties',
    ],
    humanReviewCriteria: {
      culturalNuanceDescription:
        'In arid 43°C summer heat, loose-fitting, natural handspun fibers (Khadi, cotton) allow sweat evaporation and shield the skin from solar radiation.',
      regionalSpecificity: 'Northwest arid zone (Rajasthan / Haryana).',
      expertReviewStatus: 'approved',
    },
  },

  // ==========================================================================
  // 7. CROSS-CULTURAL & INTERNATIONAL INSPIRATIONS
  // ==========================================================================
  {
    id: 'case-16-korean-contemporary-streetwear-fusion',
    name: 'South Korean Streetwear Volume Play with Contemporary Indian Separates',
    category: 'international_cross_cultural',
    ageBand: 'adult_18_plus',
    presentationPreference: 'all',
    userPreferences: {
      stylingMode: 'variety',
      preferredAesthetics: ['Casual', 'Minimal'],
      internationalInspirations: ['korean_contemporary_streetwear'],
      updatedAt: 1729000000000,
    },
    wardrobe: [
      OVERSIZED_BOXY_TEE_BEIGE,
      RELAXED_WIDE_LEG_CHINOS_OLIVE,
      MEN_SNEAKERS_WHITE,
      MEN_KHADI_KURTA_INDIGO,
      MEN_SHERWANI_CREAM,
    ],
    occasion: 'casual outing',
    season: 'summer',
    explicitConstraints: {
      mustIncludeItemIds: ['int-tee-boxy-beige', 'int-chinos-olive', 'm-sneakers-white'],
    },
    expectedCompatibility: {
      acceptableTemplates: ['Western', 'Indo-western'],
      expectedEvidenceSources: ['cultural'],
    },
    knownUnacceptableOutcomes: [
      'Overriding Indian-first core defaults when no inspiration is requested',
      'Inventing foreign trend terms not grounded in actual garments',
    ],
    humanReviewCriteria: {
      culturalNuanceDescription:
        'Korean contemporary streetwear balances dropped-shoulder oversized volume with clean tonal minimalism and contemporary sneaker accents, easily pairing with relaxed Indian separates.',
      regionalSpecificity: 'Global contemporary streetwear adopted by Indian youth.',
      expertReviewStatus: 'approved',
    },
  },

  {
    id: 'case-17-japanese-relaxed-workwear-handloom',
    name: 'Japanese Relaxed Workwear & Indigo Handloom Synergy',
    category: 'international_cross_cultural',
    ageBand: 'adult_18_plus',
    presentationPreference: 'masculine',
    userPreferences: {
      stylingMode: 'variety',
      preferredAesthetics: ['Minimal'],
      internationalInspirations: ['japanese_relaxed_workwear'],
      updatedAt: 1729000000000,
    },
    wardrobe: [
      JAPANESE_CHORE_JACKET_INDIGO,
      MEN_CASUAL_TEE_WHITE,
      RELAXED_WIDE_LEG_CHINOS_OLIVE,
      MEN_SNEAKERS_WHITE,
      MEN_KHADI_KURTA_INDIGO,
    ],
    occasion: 'casual outing',
    season: 'winter',
    explicitConstraints: {
      mustIncludeItemIds: ['int-chore-jacket-indigo', 'int-chinos-olive'],
    },
    expectedCompatibility: {
      acceptableTemplates: ['Western', 'Tailored Western', 'Indo-western tailored'],
    },
    knownUnacceptableOutcomes: [
      'Clashing ultra-formal patent shoes with rugged sashiko workwear',
    ],
    humanReviewCriteria: {
      culturalNuanceDescription:
        'Japanese relaxed workwear shares a deep aesthetic connection with Indian Khadi and Indigo handlooms — valuing natural textures, functional pockets, and understated geometric stitching.',
      regionalSpecificity: 'East Asian artisanal functionalism harmonized with Indian craft.',
      expertReviewStatus: 'approved',
    },
  },

  {
    id: 'case-18-european-tailored-smart-presentation',
    name: 'European Tailored Smart Presentation with Crisp Neutrals',
    category: 'international_cross_cultural',
    ageBand: 'adult_18_plus',
    presentationPreference: 'masculine',
    userPreferences: {
      stylingMode: 'simple',
      preferredAesthetics: ['Classic', 'Minimal'],
      internationalInspirations: ['european_tailored_smart'],
      updatedAt: 1729000000000,
    },
    wardrobe: [
      EUROPEAN_TRENCH_COAT_CAMEL,
      MEN_CASUAL_TEE_WHITE,
      MEN_TROUSERS_BLACK_FORMAL,
      MEN_FORMAL_OXFORDS,
      MEN_CASUAL_SHORTS_NAVY,
    ],
    occasion: 'office',
    season: 'winter',
    weatherFixture: WEATHER_COLD_DELHI_WINTER,
    explicitConstraints: {
      mustIncludeItemIds: ['int-trench-camel', 'm-trousers-black', 'm-oxfords-black'],
      mustExcludeItemIds: ['m-shorts-navy'],
    },
    expectedCompatibility: {
      acceptableTemplates: ['Tailored Western'],
    },
    knownUnacceptableOutcomes: [
      'Suggesting shorts or sandals under tailored European trench coat for office',
    ],
    humanReviewCriteria: {
      culturalNuanceDescription:
        'European smart tailoring focuses on clean vertical drape, tonal neutral palettes (camel, black, ivory), and refined leather footwear.',
      regionalSpecificity: 'Continental smart-casual adapted for Indian metropolitan winters.',
      expertReviewStatus: 'approved',
    },
  },

  // ==========================================================================
  // 8. UNCERTAINTY, MISSING CONTEXT & EDGE CASES
  // ==========================================================================
  {
    id: 'case-19-missing-weather-transparent-assumptions',
    name: 'Missing Weather Service Transparent Assumptions & Fallback',
    category: 'uncertainty_edge_cases',
    ageBand: 'adult_18_plus',
    userPreferences: {
      stylingMode: 'variety',
      updatedAt: 1729000000000,
    },
    wardrobe: [
      MEN_KHADI_KURTA_INDIGO,
      MEN_PAJAMA_WHITE,
      MEN_SANDALS_BROWN,
    ],
    occasion: 'everyday',
    season: 'summer',
    weatherFixture: WEATHER_UNAVAILABLE, // Missing context!
    explicitConstraints: {
      mustIncludeItemIds: ['m-kurta-khadi-indigo', 'm-pajama-white', 'm-sandals-brown'],
    },
    expectedCompatibility: {
      acceptableTemplates: ['Kurta look'],
    },
    knownUnacceptableOutcomes: [
      'Fabricating simulated weather as real live weather data',
      'Reporting weather comfort reasons when weather service is unavailable',
      'Inflating confidence level beyond available evidence',
    ],
    humanReviewCriteria: {
      culturalNuanceDescription:
        'When network or weather sensors are unavailable, the engine must transparently declare assumptions (mild indoor conditions assumed) and omit weather rationales without breaking recommendations.',
      regionalSpecificity: 'Truth-in-AI uncertainty handling.',
      expertReviewStatus: 'approved',
    },
  },

  {
    id: 'case-20-incomplete-wardrobe-saree-missing-blouse',
    name: 'Incomplete Wardrobe Structural Integrity (Saree without Blouse)',
    category: 'uncertainty_edge_cases',
    ageBand: 'adult_18_plus',
    presentationPreference: 'feminine',
    userPreferences: {
      stylingMode: 'variety',
      updatedAt: 1729000000000,
    },
    wardrobe: [
      SOLITARY_SAREE_NO_BLOUSE, // Saree exists, but zero blouses in wardrobe
      WOMEN_HEELS_METALLIC,
    ],
    occasion: 'wedding guest',
    season: 'winter',
    explicitConstraints: {
      // Since required slot 'blouse' cannot be filled, Saree look must not be generated
    },
    expectedCompatibility: {
      minimumCandidates: 0, // Clean structural integrity rejection
    },
    knownUnacceptableOutcomes: [
      'Generating an unwearable saree outfit without a blouse',
      'Hallucinating a fabricated blouse to force an outfit completion',
    ],
    humanReviewCriteria: {
      culturalNuanceDescription:
        'A saree structurally requires a blouse and petticoat/underskirt. Recommending a saree without a blouse is structurally impossible and embarrassing.',
      regionalSpecificity: 'Indian structural garment requirements.',
      expertReviewStatus: 'approved',
    },
  },

  {
    id: 'case-21-dirty-clothes-laundry-exclusion',
    name: 'Hard Constraint Status Check (Dirty & In-Laundry Exclusion)',
    category: 'uncertainty_edge_cases',
    ageBand: 'adult_18_plus',
    userPreferences: {
      stylingMode: 'variety',
      updatedAt: 1729000000000,
    },
    wardrobe: [
      DIRTY_SHIRT_IN_LAUNDRY, // In laundry
      DIRTY_KURTA_NEEDS_WASHING, // Needs washing
      MEN_CASUAL_TEE_WHITE, // Clean
      MEN_JEANS_DARK_DENIM, // Clean
      MEN_SNEAKERS_WHITE, // Clean
    ],
    occasion: 'casual outing',
    season: 'summer',
    explicitConstraints: {
      mustExcludeItemIds: ['edge-shirt-laundry', 'edge-kurta-wash'],
      mustIncludeItemIds: ['m-tee-white', 'm-jeans-dark', 'm-sneakers-white'],
    },
    expectedCompatibility: {
      acceptableTemplates: ['Western'],
    },
    knownUnacceptableOutcomes: [
      'Recommending clothes marked in_laundry or needs_washing for immediate wearing',
    ],
    humanReviewCriteria: {
      culturalNuanceDescription:
        'Hygiene and practical readiness: garments awaiting wash or at the dry cleaner cannot be worn immediately.',
      regionalSpecificity: 'Wardrobe physical state integrity.',
      expertReviewStatus: 'approved',
    },
  },

  {
    id: 'case-22-fabric-sensitivity-wool-allergy',
    name: 'User Declared Fabric Sensitivity Safeguard (Wool Allergy)',
    category: 'preference_feedback_learning',
    ageBand: 'adult_18_plus',
    userPreferences: {
      stylingMode: 'simple',
      fabricSensitivities: ['wool'], // User cannot wear wool
      updatedAt: 1729000000000,
    },
    wardrobe: [
      WOOL_SWEATER_MUSTARD, // Wool: must be blocked!
      MEN_KHADI_KURTA_INDIGO, // Khadi: clean
      MEN_PAJAMA_WHITE, // Cotton: clean
      MEN_SANDALS_BROWN, // Leather: clean
    ],
    occasion: 'everyday',
    season: 'winter',
    weatherFixture: WEATHER_COLD_DELHI_WINTER,
    explicitConstraints: {
      noFabricSensitivities: true,
      mustExcludeItemIds: ['edge-sweater-wool'],
      mustIncludeItemIds: ['m-kurta-khadi-indigo', 'm-pajama-white', 'm-sandals-brown'],
    },
    expectedCompatibility: {
      acceptableTemplates: ['Kurta look'],
    },
    knownUnacceptableOutcomes: [
      'Recommending woolen garments to a user with declared wool contact dermatitis / sensitivity',
    ],
    humanReviewCriteria: {
      culturalNuanceDescription:
        'Dermatological comfort: synthetic or coarse wool sensitivities are prevalent; respecting declared fabric sensitivities is a core safety constraint.',
      regionalSpecificity: 'Personal physical health safeguard.',
      expertReviewStatus: 'approved',
    },
  },

  {
    id: 'case-23-explicit-disliked-styles-and-color-preferences',
    name: 'User Controlled Feedback (Disliked Hoodie & Preferred Navy)',
    category: 'preference_feedback_learning',
    ageBand: 'adult_18_plus',
    userPreferences: {
      stylingMode: 'variety',
      preferredColors: ['navy'],
      dislikedStyles: ['hoodie'],
      updatedAt: 1729000000000,
    },
    wardrobe: [
      MEN_KHADI_KURTA_INDIGO, // Navy, loved
      MEN_JEANS_DARK_DENIM, // Navy, loved
      MEN_CASUAL_HOODIE_GREY, // Hoodie, disliked!
      MEN_CASUAL_TEE_WHITE,
      MEN_SNEAKERS_WHITE,
    ],
    occasion: 'college',
    season: 'summer',
    explicitConstraints: {
      mustExcludeItemIds: ['m-hoodie-grey'],
      mustIncludeItemIds: ['m-jeans-dark', 'm-sneakers-white'],
    },
    expectedCompatibility: {
      acceptableTemplates: ['Indo-western', 'Western'],
    },
    knownUnacceptableOutcomes: [
      'Picking user-disliked hoodie when clean alternatives exist',
      'Ignoring declared color preference boost for navy pieces',
    ],
    humanReviewCriteria: {
      culturalNuanceDescription:
        'User agency: explicit negative feedback (disliking a silhouette) and positive feedback (preferred palette) must materially influence ranking.',
      regionalSpecificity: 'User-controlled preference learning.',
      expertReviewStatus: 'approved',
    },
  },

  {
    id: 'case-24-unknown-attributes-graceful-evaluation',
    name: 'Unknown Garment Attributes Graceful Handling',
    category: 'uncertainty_edge_cases',
    ageBand: 'adult_18_plus',
    userPreferences: {
      stylingMode: 'variety',
      updatedAt: 1729000000000,
    },
    wardrobe: [
      UNKNOWN_FABRIC_TOP, // fabric undefined, pattern undefined
      MEN_JEANS_DARK_DENIM,
      MEN_SNEAKERS_WHITE,
    ],
    occasion: 'college',
    season: 'summer',
    explicitConstraints: {
      mustIncludeItemIds: ['edge-top-unknown', 'm-jeans-dark', 'm-sneakers-white'],
    },
    expectedCompatibility: {
      acceptableTemplates: ['Western'],
    },
    knownUnacceptableOutcomes: [
      'Crashing with null pointer when garment fabric or pattern is undefined',
      'Falsely reporting VERIFIED confidence when wardrobe data is unverified',
    ],
    humanReviewCriteria: {
      culturalNuanceDescription:
        'Real-world wardrobes contain unbranded, gifted, or flea-market clothes with unknown fiber content. The engine must evaluate them without crashing while honestly lowering confidence.',
      regionalSpecificity: 'Robustness to missing metadata.',
      expertReviewStatus: 'approved',
    },
  },

  {
    id: 'case-25-nonbinary-androgynous-indo-western',
    name: 'Androgynous Indo-Western Campus Styling',
    category: 'contemporary_indo_western',
    ageBand: 'adult_18_plus',
    presentationPreference: 'androgynous',
    userPreferences: {
      stylingMode: 'variety',
      presentationPreference: 'androgynous',
      preferredAesthetics: ['Indo-western', 'Minimal'],
      updatedAt: 1729000000000,
    },
    wardrobe: [
      MEN_KHADI_KURTA_INDIGO,
      RELAXED_WIDE_LEG_CHINOS_OLIVE,
      MEN_SNEAKERS_WHITE,
      WOMEN_KANJEEVARAM_SAREE_RED,
      MEN_SHERWANI_CREAM,
    ],
    occasion: 'college',
    season: 'summer',
    explicitConstraints: {
      mustIncludeItemIds: ['m-kurta-khadi-indigo', 'int-chinos-olive', 'm-sneakers-white'],
      mustExcludeItemIds: ['w-saree-kanjeevaram-red', 'm-sherwani-cream'],
    },
    expectedCompatibility: {
      acceptableTemplates: ['Indo-western', 'Kurta look'],
    },
    knownUnacceptableOutcomes: [
      'Forcing highly gendered bridal ceremonial wear (saree, sherwani) onto everyday campus student',
    ],
    humanReviewCriteria: {
      culturalNuanceDescription:
        'Contemporary Indian youth increasingly adopt gender-neutral, fluid styling combining straight handloom kurtas with relaxed wide-leg chinos and clean court sneakers.',
      regionalSpecificity: 'Modern inclusive urban styling.',
      expertReviewStatus: 'approved',
    },
  },

  {
    id: 'case-26-east-bengal-durga-puja-pushpanjali',
    name: 'Women East India Durga Puja Ashtami Morning Pushpanjali',
    category: 'regional_traditions',
    ageBand: 'adult_18_plus',
    presentationPreference: 'feminine',
    userPreferences: {
      stylingMode: 'variety',
      preferredAesthetics: ['Traditional'],
      regionalInterests: ['east'],
      updatedAt: 1729000000000,
    },
    wardrobe: [
      WOMEN_KANJEEVARAM_SAREE_RED,
      WOMEN_SILK_BLOUSE_GOLD,
      WOMEN_MOJARIS_SILVER,
      WOMEN_BLACK_WESTERN_DRESS,
      WOMEN_CROP_TOP_RED,
    ],
    occasion: 'festive',
    season: 'summer',
    culturalSignals: {
      regionalTradition: 'east',
      festivalContext: 'Durga Puja',
    },
    explicitConstraints: {
      mustIncludeItemIds: ['w-saree-kanjeevaram-red', 'w-blouse-gold'],
      mustExcludeItemIds: ['w-dress-black'],
    },
    expectedCompatibility: {
      acceptableTemplates: ['Saree look'],
      expectedEvidenceSources: ['cultural'],
    },
    knownUnacceptableOutcomes: [
      'Recommending black cocktail dress for Durga Puja morning pushpanjali',
    ],
    humanReviewCriteria: {
      culturalNuanceDescription:
        'Durga Puja Ashtami morning rituals traditionally center on red and white/cream handwoven sarees with auspicious vermillion sindoor accents.',
      regionalSpecificity: 'Bengal / Odisha festive tradition.',
      expertReviewStatus: 'approved',
    },
  },

  {
    id: 'case-27-west-gujarat-navratri-high-mobility',
    name: 'Women West India Navratri Garba / Dandiya High Mobility Flared Look',
    category: 'regional_traditions',
    ageBand: 'adult_18_plus',
    presentationPreference: 'feminine',
    userPreferences: {
      stylingMode: 'variety',
      preferredAesthetics: ['Traditional'],
      regionalInterests: ['west'],
      updatedAt: 1729000000000,
    },
    wardrobe: [
      WOMEN_LEHENGA_EMERALD,
      WOMEN_CHOLI_BLOUSE_EMERALD,
      WOMEN_DUPATTA_GOLD_NET,
      WOMEN_MOJARIS_SILVER,
      WOMEN_BLACK_WESTERN_DRESS,
    ],
    occasion: 'festive',
    season: 'summer',
    culturalSignals: {
      regionalTradition: 'west',
      festivalContext: 'Navratri',
    },
    explicitConstraints: {
      mustIncludeItemIds: ['w-lehenga-emerald', 'w-choli-emerald', 'w-dupatta-gold'],
    },
    expectedCompatibility: {
      acceptableTemplates: ['Lehenga ensemble'],
      expectedEvidenceSources: ['cultural'],
    },
    knownUnacceptableOutcomes: [
      'Suggesting restrictive pencil skirts or western cocktail dresses for dynamic folk dance',
    ],
    humanReviewCriteria: {
      culturalNuanceDescription:
        'Navratri Dandiya/Garba involves hours of active rhythmic movement, requiring flared silhouettes (Chaniya Choli/Lehenga) and secure footwear.',
      regionalSpecificity: 'Gujarat / Western India festive tradition.',
      expertReviewStatus: 'approved',
    },
  },

  {
    id: 'case-28-travel-comfort-hot-humid-transit',
    name: 'Long-Distance Transit in Hot & Humid Weather (Train/Flight Travel)',
    category: 'climate_extremes',
    ageBand: 'adult_18_plus',
    userPreferences: {
      stylingMode: 'simple',
      preferredAesthetics: ['Casual'],
      updatedAt: 1729000000000,
    },
    wardrobe: [
      WOMEN_CHIKANKARI_KURTI_LAVENDER,
      WOMEN_PALAZZO_WHITE_COTTON,
      WOMEN_MOJARIS_SILVER,
      WOMEN_KANJEEVARAM_SAREE_RED,
      WOMEN_HEELS_METALLIC,
    ],
    occasion: 'travel',
    season: 'summer',
    weatherFixture: WEATHER_HOT_HUMID_MUMBAI,
    explicitConstraints: {
      mustIncludeItemIds: ['w-kurti-chikankari-lavender', 'w-palazzo-white'],
      mustExcludeItemIds: ['w-saree-kanjeevaram-red', 'w-heels-metallic'],
    },
    expectedCompatibility: {
      acceptableTemplates: ['Kurta look', 'Indo-western'],
      expectedFabrics: ['mulmul', 'cotton'],
    },
    knownUnacceptableOutcomes: [
      'Recommending heavy ceremonial silk saree or metallic high heels for 12-hour train/bus journey',
    ],
    humanReviewCriteria: {
      culturalNuanceDescription:
        'Travel ergonomics across Indian transit networks demand unrestrictive waistlines, breathable fibers, and flat comfortable footwear.',
      regionalSpecificity: 'Indian subcontinental travel ergonomics.',
      expertReviewStatus: 'approved',
    },
  },

  {
    id: 'case-29-contradictory-preferences-minimal-wedding',
    name: 'Contradictory Preferences: Minimal Aesthetic User at Wedding Guest Event',
    category: 'preference_feedback_learning',
    ageBand: 'adult_18_plus',
    presentationPreference: 'masculine',
    userPreferences: {
      stylingMode: 'variety',
      preferredAesthetics: ['Minimal'], // User loves minimal
      updatedAt: 1729000000000,
    },
    wardrobe: [
      MEN_BANDHGALA_CHARCOAL,
      MEN_TROUSERS_BLACK_FORMAL,
      MEN_FORMAL_OXFORDS,
      MEN_CASUAL_TEE_WHITE,
      MEN_CASUAL_SHORTS_NAVY,
    ],
    occasion: 'wedding guest', // Occasion target is formal 4.8
    season: 'winter',
    weatherFixture: WEATHER_COLD_DELHI_WINTER,
    explicitConstraints: {
      mustIncludeItemIds: ['m-bandhgala-charcoal', 'm-trousers-black', 'm-oxfords-black'],
      mustExcludeItemIds: ['m-tee-white', 'm-shorts-navy'],
    },
    expectedCompatibility: {
      acceptableTemplates: ['Bandhgala look', 'Tailored Western'],
    },
    knownUnacceptableOutcomes: [
      'Resolving minimal preference by wearing t-shirt and shorts to a wedding',
      'Crashing due to conflicting objective weights',
    ],
    humanReviewCriteria: {
      culturalNuanceDescription:
        'When a user prefers minimal aesthetics but attends a formal wedding, the system must bridge the gap with architectural tailoring and clean monochrome lines (e.g. Bandhgala) rather than degrading to casuals.',
      regionalSpecificity: 'Nuanced harmony between personal taste and event formality.',
      expertReviewStatus: 'approved',
    },
  },

  {
    id: 'case-30-wardrobe-inventory-strict-grounding',
    name: 'Strict Wardrobe Inventory Grounding (Zero Fabricated Items)',
    category: 'uncertainty_edge_cases',
    ageBand: 'adult_18_plus',
    userPreferences: {
      stylingMode: 'variety',
      updatedAt: 1729000000000,
    },
    wardrobe: [
      MEN_CASUAL_TEE_WHITE,
      MEN_JEANS_DARK_DENIM,
      MEN_SNEAKERS_WHITE,
    ],
    occasion: 'casual outing',
    season: 'summer',
    explicitConstraints: {
      mustIncludeItemIds: ['m-tee-white', 'm-jeans-dark', 'm-sneakers-white'],
    },
    expectedCompatibility: {
      acceptableTemplates: ['Western'],
    },
    knownUnacceptableOutcomes: [
      'Recommending any piece ID not present in the wardrobe',
      'Inventing external affiliate links, prices, or store garments',
    ],
    humanReviewCriteria: {
      culturalNuanceDescription:
        'StyleSaathi guarantees 100% on-device wardrobe grounding: recommendations must only compose outfits from garments the user actually owns.',
      regionalSpecificity: 'Systemic trust and integrity constraint.',
      expertReviewStatus: 'approved',
    },
  },
]);
