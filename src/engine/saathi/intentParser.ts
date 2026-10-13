import { Occasion, Season, Category, Subcategory } from '../../types';
import { SaathiIntent, SaathiIntentResult, SaathiEntities, MissingContext } from './types';

// Canonical occasion mapping
const OCCASIONS_MAP: Record<string, Occasion> = {
  college: 'college',
  uni: 'college',
  university: 'college',
  campus: 'college',
  class: 'college',
  classes: 'college',
  lecture: 'college',

  everyday: 'everyday',
  daily: 'everyday',
  routine: 'everyday',
  regular: 'everyday',
  errand: 'everyday',
  errands: 'everyday',

  office: 'office',
  work: 'office',
  corporate: 'office',
  meeting: 'office',
  presentation: 'office',
  client: 'office',

  interview: 'interview',

  casual: 'casual outing',
  outing: 'casual outing',
  brunch: 'casual outing',
  cafe: 'casual outing',
  coffee: 'casual outing',
  lunch: 'casual outing',
  hangout: 'casual outing',
  shopping: 'casual outing',

  date: 'date',
  dinner: 'date',
  romantic: 'date',

  party: 'party',
  club: 'party',
  clubbing: 'party',
  celebration: 'celebration',

  gathering: 'family gathering',
  'family gathering': 'family gathering',
  function: 'family function',
  'family function': 'family function',

  puja: 'puja',
  pooja: 'puja',
  temple: 'puja',
  mandir: 'puja',
  havan: 'puja',

  festive: 'festive',
  festival: 'festive',
  diwali: 'Diwali',
  deepavali: 'Diwali',
  eid: 'Eid',
  holi: 'Holi',

  wedding: 'wedding guest',
  shaadi: 'wedding guest',
  reception: 'wedding guest',
  sangeet: 'wedding guest',
  mehendi: 'wedding guest',
  marriage: 'wedding guest',
};

const COLORS = [
  'black',
  'white',
  'navy',
  'blue',
  'red',
  'green',
  'yellow',
  'pink',
  'beige',
  'brown',
  'grey',
  'gray',
  'maroon',
  'olive',
  'cream',
  'rust',
  'mustard',
  'burgundy',
  'charcoal',
  'orange',
  'purple',
  'gold',
  'silver',
];

const SUBCATEGORIES_MAP: Record<string, { category: Category; subcategory: Subcategory }> = {
  // Tops
  shirt: { category: 'Tops', subcategory: 'shirt' },
  't-shirt': { category: 'Tops', subcategory: 't-shirt' },
  tshirt: { category: 'Tops', subcategory: 't-shirt' },
  tee: { category: 'Tops', subcategory: 't-shirt' },
  top: { category: 'Tops', subcategory: 'top' },
  blouse: { category: 'Tops', subcategory: 'crop top' },
  'crop top': { category: 'Tops', subcategory: 'crop top' },

  // Bottoms
  jeans: { category: 'Bottoms', subcategory: 'jeans' },
  trousers: { category: 'Bottoms', subcategory: 'trousers' },
  pants: { category: 'Bottoms', subcategory: 'trousers' },
  chinos: { category: 'Bottoms', subcategory: 'trousers' },
  shorts: { category: 'Bottoms', subcategory: 'shorts' },
  skirt: { category: 'Bottoms', subcategory: 'skirt' },
  palazzo: { category: 'Bottoms', subcategory: 'palazzo' },
  joggers: { category: 'Bottoms', subcategory: 'joggers' },

  // Ethnic
  kurta: { category: 'Ethnic', subcategory: 'kurta' },
  kurti: { category: 'Ethnic', subcategory: 'kurta' },
  saree: { category: 'Ethnic', subcategory: 'saree' },
  sari: { category: 'Ethnic', subcategory: 'saree' },
  lehenga: { category: 'Ethnic', subcategory: 'lehenga' },
  dupatta: { category: 'Ethnic', subcategory: 'dupatta' },
  'nehru jacket': { category: 'Ethnic', subcategory: 'nehru jacket' },
  anarkali: { category: 'Ethnic', subcategory: 'anarkali' },
  'salwar set': { category: 'Ethnic', subcategory: 'salwar set' },

  // Footwear
  sneakers: { category: 'Footwear', subcategory: 'sneakers' },
  shoes: { category: 'Footwear', subcategory: 'formal shoes' },
  'formal shoes': { category: 'Footwear', subcategory: 'formal shoes' },
  oxfords: { category: 'Footwear', subcategory: 'formal shoes' },
  derbies: { category: 'Footwear', subcategory: 'formal shoes' },
  loafers: { category: 'Footwear', subcategory: 'loafers' },
  flats: { category: 'Footwear', subcategory: 'flats' },
  sandals: { category: 'Footwear', subcategory: 'sandals' },
  heels: { category: 'Footwear', subcategory: 'heels' },
  juttis: { category: 'Footwear', subcategory: 'juttis' },
  mojris: { category: 'Footwear', subcategory: 'juttis' },
  boots: { category: 'Footwear', subcategory: 'formal shoes' },

  // Outerwear
  jacket: { category: 'Outerwear', subcategory: 'jacket' },
  blazer: { category: 'Outerwear', subcategory: 'blazer' },
  cardigan: { category: 'Outerwear', subcategory: 'sweater' },
  sweater: { category: 'Outerwear', subcategory: 'sweater' },
  shrug: { category: 'Outerwear', subcategory: 'shrug' },

  // Dresses
  dress: { category: 'Dresses', subcategory: 'dress' },
  'maxi dress': { category: 'Dresses', subcategory: 'dress' },
};

const FABRICS = [
  'cotton',
  'linen',
  'silk',
  'wool',
  'denim',
  'polyblend',
  'polyester',
  'chiffon',
  'georgette',
  'khadi',
  'mulmul',
  'crepe',
  'viscose',
  'rayon',
  'velvet',
];

/**
 * Utility to normalize string entity inputs.
 */
export function normalizeEntityInput(input: string): string {
  return input.trim().toLowerCase();
}

/**
 * Fast deterministic intent and entity extractor (< 0.2ms latency).
 */
export function parseSaathiIntent(query: string): SaathiIntentResult {
  const normalized = normalizeEntityInput(query);
  const entities: SaathiEntities = {};
  const missingInformation: MissingContext[] = [];

  // 1. Detect Confirmation / Rejection responses
  const yesMatches = [
    'yes',
    'yeah',
    'yep',
    'sure',
    'confirm',
    'proceed',
    'do it',
    'please do',
    'looks good',
    'go ahead',
    'okay',
    'ok',
    'save it',
    'plan it',
    'record it',
  ];
  const noMatches = [
    'no',
    'nope',
    'nah',
    'cancel',
    'stop',
    'abort',
    "don't",
    'do not',
    'nevermind',
    'leave it',
  ];

  if (yesMatches.includes(normalized) || normalized === 'yes please') {
    entities.confirmationStatus = 'confirmed';
    return {
      intent: 'CONFIRMATION_RESPONSE',
      confidence: 1.0,
      entities,
      missingInformation: [],
      rawQuery: query,
    };
  }

  if (noMatches.includes(normalized) || normalized === 'no thanks') {
    entities.confirmationStatus = 'cancelled';
    return {
      intent: 'CONFIRMATION_RESPONSE',
      confidence: 1.0,
      entities,
      missingInformation: [],
      rawQuery: query,
    };
  }

  // 2. Extract relative date
  if (normalized.includes('tomorrow')) {
    entities.relativeDate = 'tomorrow';
    entities.date = 'tomorrow';
  } else if (normalized.includes('today') || normalized.includes('tonight')) {
    entities.relativeDate = 'today';
    entities.date = 'today';
  } else if (normalized.includes('weekend')) {
    entities.relativeDate = 'this_weekend';
    entities.date = 'this weekend';
  }

  // 3. Extract Occasion
  for (const [kw, occ] of Object.entries(OCCASIONS_MAP)) {
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    if (regex.test(normalized)) {
      entities.occasion = occ;
      break;
    }
  }

  // 4. Extract Color
  for (const c of COLORS) {
    const regex = new RegExp(`\\b${c}\\b`, 'i');
    if (regex.test(normalized)) {
      entities.color = c;
      break;
    }
  }

  // 5. Extract Category and Subcategory
  for (const [kw, spec] of Object.entries(SUBCATEGORIES_MAP)) {
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    if (regex.test(normalized)) {
      entities.category = spec.category;
      entities.subcategory = spec.subcategory;
      entities.garmentType = spec.subcategory;
      entities.garmentCategory = spec.category;
      entities.wardrobeItemName = `${entities.color ? entities.color + ' ' : ''}${kw}`;
      break;
    }
  }

  // 6. Extract Fabric
  for (const f of FABRICS) {
    const regex = new RegExp(`\\b${f}\\b`, 'i');
    if (regex.test(normalized)) {
      entities.fabric = f;
      break;
    }
  }

  // 7. Intent Classification via Deterministic Priority Patterns
  let intent: SaathiIntent = 'UNKNOWN';
  let confidence = 0.0;

  // A. Plan Outfit (Calendar scheduling)
  if (
    /plan (this |an? |my )?(outfit|look)/i.test(normalized) ||
    /schedule (this |an? |my )?(look|outfit)/i.test(normalized) ||
    /add .*to calendar/i.test(normalized)
  ) {
    intent = 'PLAN_OUTFIT';
    confidence = 0.95;
    if (!entities.occasion) {
      missingInformation.push({
        field: 'occasion',
        reason: 'Specify the occasion for the scheduled look.',
        critical: true,
      });
    }
  }
  // B. Purchase Assessment & Smart Buy
  else if (
    /buy/i.test(normalized) ||
    /purchase/i.test(normalized) ||
    /shopping/i.test(normalized) ||
    /do i need (a |an |any )?(new )?/i.test(normalized)
  ) {
    intent = 'ASSESS_PURCHASE_NEED';
    confidence = 0.95;
  }
  // C. Wardrobe Gaps
  else if (
    /wardrobe gaps?/i.test(normalized) ||
    /shortages?/i.test(normalized) ||
    /missing/i.test(normalized) ||
    /gap report/i.test(normalized)
  ) {
    intent = 'CHECK_WARDROBE_GAPS';
    confidence = 0.95;
  }
  // D. Wear Analytics
  else if (
    /wear analytics/i.test(normalized) ||
    /wear stats/i.test(normalized) ||
    /rotation/i.test(normalized) ||
    /cost per wear/i.test(normalized) ||
    /dormant/i.test(normalized) ||
    /never worn/i.test(normalized) ||
    /least worn/i.test(normalized) ||
    /most worn/i.test(normalized) ||
    /unworn/i.test(normalized)
  ) {
    intent = 'ANALYZE_WEAR';
    confidence = 0.95;
  }
  // E. Style Brain & Personal Profile
  else if (
    /style (profile|brain|aesthetic|vibe)/i.test(normalized) ||
    /style preferences?/i.test(normalized) ||
    /color preferences?/i.test(normalized) ||
    /fashion style/i.test(normalized) ||
    /what do i like/i.test(normalized) ||
    /learned preference/i.test(normalized)
  ) {
    intent = 'UNDERSTAND_STYLE';
    confidence = 0.9;
  }
  // F. Style This Item (Anchor Constraint)
  else if (
    /style (this|my)/i.test(normalized) ||
    /how (do|can) i style/i.test(normalized) ||
    /can i (wear|pair|style) (my|this)/i.test(normalized) ||
    /pair (with|my)/i.test(normalized) ||
    /what (goes|works) with/i.test(normalized) ||
    /wear with (my|this)/i.test(normalized)
  ) {
    intent = 'STYLE_ITEM';
    confidence = 0.95;
    if (!entities.subcategory && !entities.category) {
      missingInformation.push({
        field: 'wardrobeItemId',
        reason: 'Specify which garment from your wardrobe you would like to style.',
        critical: true,
      });
    }
  }
  // G. General Fashion & Cultural Knowledge (Phase 6)
  else if (
    /can i (wear|pair)/i.test(normalized) ||
    /how (do|can) i pair/i.test(normalized) ||
    /what fabrics/i.test(normalized) ||
    /fabrics work/i.test(normalized) ||
    /how to wear a saree/i.test(normalized) ||
    /traditional etiquette/i.test(normalized) ||
    /indian fashion/i.test(normalized) ||
    /rule for/i.test(normalized) ||
    /saree with sneakers/i.test(normalized)
  ) {
    intent = 'GENERAL_FASHION_QUESTION';
    confidence = 0.85;
  }
  // H. Weather & Context
  else if (
    /weather/i.test(normalized) ||
    /is it raining/i.test(normalized) ||
    /temperature/i.test(normalized) ||
    /how hot is it/i.test(normalized) ||
    /forecast/i.test(normalized) ||
    /climate context/i.test(normalized)
  ) {
    intent = 'CHECK_WEATHER';
    confidence = 0.95;
  }
  // I. Record Wear
  else if (
    /i wore/i.test(normalized) ||
    /wore today/i.test(normalized) ||
    /log wear/i.test(normalized) ||
    /record wear/i.test(normalized) ||
    /mark .*as worn/i.test(normalized)
  ) {
    intent = 'RECORD_WEAR';
    confidence = 0.9;
  }
  // J. User Behavioral Feedback (Phase 3 Integration)
  else if (
    /love this/i.test(normalized) ||
    /looks great/i.test(normalized) ||
    /perfect match/i.test(normalized) ||
    /amazing/i.test(normalized)
  ) {
    intent = 'FEEDBACK_POSITIVE';
    confidence = 0.9;
  }
  else if (
    /don't like/i.test(normalized) ||
    /hate this/i.test(normalized) ||
    /dislike/i.test(normalized) ||
    /terrible/i.test(normalized)
  ) {
    intent = 'FEEDBACK_NEGATIVE';
    confidence = 0.9;
  }
  // K. Explain Recommendation
  else if (
    /why (did you|is this|you) recommend/i.test(normalized) ||
    /why this (outfit|look)/i.test(normalized) ||
    /explain why/i.test(normalized) ||
    /why this/i.test(normalized) ||
    /explain this outfit/i.test(normalized) ||
    /reason for this/i.test(normalized)
  ) {
    intent = 'EXPLAIN_RECOMMENDATION';
    confidence = 0.95;
  }
  // L. Wardrobe Search & Inventory Check
  else if (
    /show (my |all )?(wardrobe|closet|clothes|items)/i.test(normalized) ||
    /view (my )?(wardrobe|closet|inventory)/i.test(normalized) ||
    /list (my |all )?(wardrobe|clothes|items)/i.test(normalized) ||
    /what clothes do i have/i.test(normalized) ||
    /find (my|all)/i.test(normalized) ||
    /search (closet|wardrobe)/i.test(normalized) ||
    /do i have (a |any )/i.test(normalized) ||
    /how many (shirts|trousers|shoes|kurtas|clothes|items)/i.test(normalized) ||
    /closet inventory/i.test(normalized)
  ) {
    intent = 'CHECK_WARDROBE';
    confidence = 0.9;
  }
  // M. Recommend Outfit
  else if (
    /what should i wear/i.test(normalized) ||
    /what to wear/i.test(normalized) ||
    /pick clothes/i.test(normalized) ||
    /look ideas/i.test(normalized) ||
    /suggest (an? )?(outfit|look|clothes)/i.test(normalized) ||
    /recommend (an? )?(outfit|look|clothes)/i.test(normalized) ||
    /dress me/i.test(normalized) ||
    /outfit for/i.test(normalized) ||
    /look for/i.test(normalized)
  ) {
    intent = 'RECOMMEND_OUTFIT';
    confidence = 0.9;
    if (!entities.occasion) {
      missingInformation.push({
        field: 'occasion',
        reason: 'Tell me the occasion so I can recommend the right structural look.',
        critical: false,
      });
    }
  }
  // N. Single occasion keyword fallback (e.g. user just inputs "college" or "office" or "party")
  else if (entities.occasion) {
    intent = 'CLARIFICATION_RESPONSE';
    confidence = 0.85;
    entities.clarificationValue = entities.occasion;
  }
  // O. Single garment mention fallback (e.g. "my black jeans")
  else if (entities.subcategory) {
    intent = 'CHECK_WARDROBE';
    confidence = 0.7;
  }
  // L. Recommend Outfit
  else if (
    /what should i wear/i.test(normalized) ||
    /suggest (an? )?(outfit|look)/i.test(normalized) ||
    /recommend (an? )?(outfit|look)/i.test(normalized) ||
    /dress me/i.test(normalized) ||
    /outfit for/i.test(normalized) ||
    /look for/i.test(normalized)
  ) {
    intent = 'RECOMMEND_OUTFIT';
    confidence = 0.9;
    if (!entities.occasion) {
      missingInformation.push({
        field: 'occasion',
        reason: 'Tell me the occasion so I can recommend the right structural look.',
        critical: false,
      });
    }
  }
  // M. Single occasion keyword fallback (e.g. user just inputs "college" or "office" or "party")
  else if (entities.occasion) {
    intent = 'CLARIFICATION_RESPONSE';
    confidence = 0.85;
    entities.clarificationValue = entities.occasion;
  }
  // N. Single garment mention fallback (e.g. "my black jeans")
  else if (entities.subcategory) {
    intent = 'CHECK_WARDROBE';
    confidence = 0.7;
  }

  return {
    intent,
    confidence,
    entities,
    missingInformation,
    rawQuery: query,
  };
}
