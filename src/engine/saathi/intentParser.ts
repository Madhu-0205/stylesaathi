import { Occasion, Season, Category, Subcategory } from '../../types';
import { SaathiIntent, SaathiIntentResult, SaathiEntities, MissingContext } from './types';

// Canonical occasion mapping
const OCCASIONS_MAP: Record<string, Occasion> = {
  // Explicit compound expressions (highest match fidelity)
  'college presentation': 'office',
  'campus presentation': 'office',
  'university presentation': 'office',
  'class presentation': 'office',
  'academic presentation': 'office',
  'formal presentation': 'office',
  'business presentation': 'office',
  'client presentation': 'office',

  'college interview': 'interview',
  'campus interview': 'interview',
  'placement interview': 'interview',
  'campus placement': 'interview',
  'job interview': 'interview',
  'mock interview': 'interview',

  'formal meeting': 'office',
  'business meeting': 'office',
  'client meeting': 'office',
  'board meeting': 'office',

  'casual college event': 'college',
  'casual college': 'college',
  'casual campus': 'college',
  'college event': 'college',
  'college fest': 'college',

  'traditional wedding': 'wedding guest',
  'wedding reception': 'wedding guest',
  'wedding ceremony': 'wedding guest',
  'traditional celebration': 'celebration',
  'cultural function': 'family function',
  'cultural event': 'family function',

  'casual event': 'casual outing',
  'casual outing': 'casual outing',
  'casual meetup': 'casual outing',

  // Base occasion mappings
  college: 'college',
  uni: 'college',
  university: 'college',
  campus: 'college',
  class: 'college',
  classes: 'college',
  lecture: 'college',

  school: 'school',
  coaching: 'school',
  tuition: 'school',

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
  pitch: 'office',
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
  'house party': 'party',
  'college party': 'party',
  'office party': 'party',
  club: 'party',
  clubbing: 'party',
  celebration: 'celebration',
  'birthday party': 'celebration',
  birthday: 'celebration',

  gathering: 'family gathering',
  'family gathering': 'family gathering',
  function: 'family function',
  'family function': 'family function',
  'office event': 'office',

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
  haldi: 'wedding guest',
  marriage: 'wedding guest',

  engagement: 'engagement',
  roka: 'engagement',
  sagai: 'engagement',
  sagayi: 'engagement',
  'ring ceremony': 'engagement',
};

const COLORS = [
  'olive',
  'burgundy',
  'charcoal',
  'mustard',
  'maroon',
  'rust',
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
  'cream',
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
  kurti: { category: 'Ethnic', subcategory: 'kurti' },
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
 * Computes occasion specificity score to resolve conflicting occasion keywords.
 * Compound phrases (e.g. "college presentation", "job interview") and high-stakes
 * activities (presentation, interview, wedding) take precedence over general environment settings (college, office).
 */
export function getOccasionSpecificity(kw: string, _occ: Occasion): number {
  const lower = kw.toLowerCase();
  // Compound multi-word phrases have highest specificity
  if (lower.includes(' ')) {
    return 150 + lower.length;
  }
  // High-stakes specific activities
  if (['interview'].includes(lower)) return 110;
  if (['presentation', 'pitch'].includes(lower)) return 105;
  if (['wedding', 'shaadi', 'reception', 'sangeet', 'mehendi', 'haldi', 'marriage', 'engagement', 'roka', 'sagai', 'sagayi'].includes(lower)) return 100;
  if (['puja', 'pooja', 'diwali', 'deepavali', 'eid', 'holi', 'festive', 'festival', 'temple', 'mandir', 'havan'].includes(lower)) return 95;
  // Social / evening gatherings
  if (['date', 'dinner', 'romantic'].includes(lower)) return 85;
  if (['party', 'club', 'clubbing', 'celebration', 'birthday'].includes(lower)) return 80;
  if (['gathering', 'function'].includes(lower)) return 75;
  // Professional settings
  if (['office', 'work', 'corporate', 'meeting', 'client'].includes(lower)) return 70;
  // Broad environment / institutional settings (settings where presentations, interviews, classes happen)
  if (['college', 'campus', 'university', 'uni', 'class', 'classes', 'lecture', 'school', 'coaching', 'tuition'].includes(lower)) return 40;
  // Casual base
  if (['casual', 'outing', 'brunch', 'cafe', 'coffee', 'lunch', 'hangout', 'shopping'].includes(lower)) return 35;
  if (['everyday', 'daily', 'routine', 'regular', 'errand', 'errands'].includes(lower)) return 30;

  return 50;
}

const PRECOMPILED_OCCASIONS = [
  ...Object.entries(OCCASIONS_MAP)
    .filter(([kw]) => kw.includes(' '))
    .sort((a, b) => b[0].length - a[0].length),
  ...Object.entries(OCCASIONS_MAP).filter(([kw]) => !kw.includes(' ')),
].map(([kw, occ]) => ({
  kw,
  occ,
  regex: new RegExp(`\\b${kw}\\b`, 'i'),
  specificity: getOccasionSpecificity(kw, occ),
  isContext: kw.includes(' ') || kw === 'birthday' || kw === 'reception' || kw === 'puja',
})).sort((a, b) => b.specificity - a.specificity);

interface MatchedOccasion {
  kw: string;
  occ: Occasion;
  start: number;
  end: number;
  specificity: number;
  isContext: boolean;
}

function extractOccasionMatches(text: string): MatchedOccasion[] {
  const matches: MatchedOccasion[] = [];
  for (const entry of PRECOMPILED_OCCASIONS) {
    const m = text.match(entry.regex);
    if (m && m.index !== undefined) {
      matches.push({
        kw: entry.kw,
        occ: entry.occ,
        start: m.index,
        end: m.index + m[0].length,
        specificity: entry.specificity,
        isContext: entry.isContext,
      });
    }
  }

  // Filter out subsumed matches (e.g. "college" is subsumed if "college presentation" matched the span)
  const nonSubsumed = matches.filter((cand) => {
    return !matches.some(
      (other) =>
        other !== cand &&
        other.start <= cand.start &&
        other.end >= cand.end &&
        other.kw.length > cand.kw.length
    );
  });

  nonSubsumed.sort((a, b) => b.specificity - a.specificity);
  return nonSubsumed;
}

const PRECOMPILED_COLORS = COLORS.map((c) => ({
  color: c,
  regex: new RegExp(`\\b${c}\\b`, 'i'),
}));

const PRECOMPILED_SUBCATEGORIES = Object.entries(SUBCATEGORIES_MAP).map(([kw, spec]) => ({
  kw,
  spec,
  regex: new RegExp(`\\b${kw}\\b`, 'i'),
}));

const PRECOMPILED_FABRICS = FABRICS.map((f) => ({
  fabric: f,
  regex: new RegExp(`\\b${f}\\b`, 'i'),
}));

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

  if (noMatches.includes(normalized) || normalized === 'no thanks' || normalized === 'cancel that') {
    entities.confirmationStatus = 'cancelled';
    return {
      intent: 'CONFIRMATION_RESPONSE',
      confidence: 1.0,
      entities,
      missingInformation: [],
      rawQuery: query,
    };
  }

  // Detect user correction (e.g. "No, I meant for an interview", "Actually I meant office", "No, I meant a birthday party")
  if (
    /^(no|nah|nope)[,\s]+(i meant|i mean|actually|rather|instead|it'?s|this is|for)\b/i.test(normalized) ||
    /\b(i meant|meant for|actually this is for|actually for|rather for|instead of|change to)\b/i.test(normalized) ||
    /^(actually|rather|instead)\b/i.test(normalized)
  ) {
    entities.isCorrection = true;
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
  } else if (/next week/i.test(normalized)) {
    entities.relativeDate = 'specific_date';
    entities.date = 'next week';
  }

  // 2b. Extract Ordinal / Look Selection
  if (/\b(first|1st)\b/i.test(normalized) || /\blook\s*1\b/i.test(normalized)) {
    entities.lookIndex = 0;
    entities.ordinalRef = 'first';
  } else if (/\b(second|2nd)\b/i.test(normalized) || /\blook\s*2\b/i.test(normalized)) {
    entities.lookIndex = 1;
    entities.ordinalRef = 'second';
  } else if (/\b(third|3rd)\b/i.test(normalized) || /\blook\s*3\b/i.test(normalized)) {
    entities.lookIndex = 2;
    entities.ordinalRef = 'third';
  } else if (/\b(last)\b/i.test(normalized)) {
    entities.ordinalRef = 'last';
  }

  // 2c. Extract Aesthetic and Refinements
  if (/\b(more elegant|more sophisticated|more classy|classier|elegance)\b/i.test(normalized)) {
    entities.refinementType = 'more_elegant';
    entities.aesthetic = 'elegant';
  } else if (/\b(more formal|dressier|business formal)\b/i.test(normalized)) {
    entities.refinementType = 'more_formal';
    entities.aesthetic = 'formal';
  } else if (/\b(more casual|more relaxed|less formal)\b/i.test(normalized)) {
    entities.refinementType = 'more_casual';
    entities.aesthetic = 'casual';
  } else if (/\b(more minimal|minimal|minimalist|clean and simple|capsule)\b/i.test(normalized)) {
    entities.refinementType = 'more_minimal';
    entities.aesthetic = 'minimalist';
  } else if (/\b(premium|quiet luxury|luxury|elevated)\b/i.test(normalized)) {
    entities.aesthetic = 'premium';
  }

  // 2d. Extract Anti-Repetition intent flag
  if (
    /don'?t want to repeat/i.test(normalized) ||
    /don'?t repeat/i.test(normalized) ||
    /not (what i wore|repeat)/i.test(normalized) ||
    /avoid repeating/i.test(normalized) ||
    /something different from (yesterday|last time)/i.test(normalized)
  ) {
    entities.antiRepetition = true;
    entities.avoidRecentDays = 1;
  }

  // 2e. Extract Constraint Removal & Anchor Unlock
  const removeRoleMatch = normalized.match(
    /\b(?:without|remove|drop|exclude|no)\s+(?:the\s+|a\s+|an\s+|any\s+)?(jacket|blazer|cardigan|sweater|shrug|coat|layer|outerwear|shoes|footwear|sneakers|heels|flats|boots|top|shirt|t-shirt|tee|kurti|kurta|bottom|jeans|trousers|pants|dupatta|scarf|accessory|accessories)\b/i
  );
  if (removeRoleMatch) {
    const itemWord = removeRoleMatch[1].toLowerCase();
    if (['jacket', 'blazer', 'cardigan', 'sweater', 'shrug', 'coat', 'layer', 'outerwear'].includes(itemWord)) {
      entities.removedRole = 'layer';
    } else if (['shoes', 'footwear', 'sneakers', 'heels', 'flats', 'boots'].includes(itemWord)) {
      entities.removedRole = 'footwear';
    } else if (['top', 'shirt', 't-shirt', 'tee', 'kurti', 'kurta'].includes(itemWord)) {
      entities.removedRole = 'top';
    } else if (['bottom', 'jeans', 'trousers', 'pants'].includes(itemWord)) {
      entities.removedRole = 'bottom';
    } else if (['dupatta', 'scarf', 'accessory', 'accessories'].includes(itemWord)) {
      entities.removedRole = 'accessories';
    }
  }

  if (
    /\b(unlock anchor|no anchor|remove anchor|don'?t keep (?:the )?(?:jeans|trousers|pants|top|shirt|item|piece)|change everything|start fresh|any (?:jeans|trousers|pants|bottom|top))\b/i.test(normalized) ||
    /\bwithout (?:keeping|locking) (?:any|the) (?:piece|item|anchor)\b/i.test(normalized)
  ) {
    entities.unlockedAnchor = true;
  }

  // 3. Extract Occasion & Multi-Occasion Transitions
  const transitionMatch = normalized.match(
    /\b(followed by|then|after that|afterwards|later)\b/i
  );

  if (transitionMatch && transitionMatch.index !== undefined) {
    const primaryPart = normalized.substring(0, transitionMatch.index).trim();
    const secondaryPart = normalized
      .substring(transitionMatch.index + transitionMatch[0].length)
      .trim();

    const primaryMatches = extractOccasionMatches(primaryPart);
    const secondaryMatches = extractOccasionMatches(secondaryPart);

    if (primaryMatches.length > 0) {
      entities.occasion = primaryMatches[0].occ;
      entities.occasionContext = `${primaryMatches[0].kw} ${transitionMatch[0]} ${secondaryMatches[0]?.kw || 'casual'}`;
    }
    if (secondaryMatches.length > 0) {
      entities.secondaryOccasion = secondaryMatches[0].occ;
    }
  } else {
    const allMatches = extractOccasionMatches(normalized);
    // If query is a formality refinement ("more casual", "less formal"), don't treat the word "casual" as a new occasion
    const filteredMatches = allMatches.filter((m) => {
      if (m.kw.toLowerCase() === 'casual' && entities.refinementType === 'more_casual') {
        return false;
      }
      return true;
    });

    if (filteredMatches.length > 0) {
      const topMatch = filteredMatches[0];
      entities.occasion = topMatch.occ;

      // If there was a co-occurring institution/setting (e.g. presentation at college, interview at college)
      const settingMatch = filteredMatches.find((m) =>
        ['college', 'campus', 'university', 'office', 'school'].includes(m.kw.toLowerCase())
      );
      if (settingMatch && settingMatch !== topMatch) {
        entities.occasionContext = `${settingMatch.kw} ${topMatch.kw}`;
      } else if (topMatch.isContext) {
        entities.occasionContext = topMatch.kw;
      }
    }
  }

  // 4. Extract Color
  for (const entry of PRECOMPILED_COLORS) {
    if (entry.regex.test(normalized)) {
      entities.color = entry.color;
      break;
    }
  }

  // 5. Extract Category and Subcategory
  const matchedGarments: Array<{ kw: string; spec: { category: Category; subcategory: Subcategory } }> = [];
  for (const entry of PRECOMPILED_SUBCATEGORIES) {
    if (entry.regex.test(normalized)) {
      matchedGarments.push({ kw: entry.kw, spec: entry.spec });
    }
  }

  if (matchedGarments.length > 0) {
    // If the input has "wear X with Y", make sure X is the primary garment
    const primary = matchedGarments[0];
    entities.category = primary.spec.category;
    entities.subcategory = primary.spec.subcategory;
    entities.garmentType = primary.spec.subcategory;
    entities.garmentCategory = primary.spec.category;
    entities.wardrobeItemName = `${entities.color ? entities.color + ' ' : ''}${primary.kw}`;
    entities.anchorGarmentName = entities.wardrobeItemName;
    entities.requestedGarmentName = entities.wardrobeItemName;

    if (matchedGarments.length > 1) {
      entities.pairingItemNames = matchedGarments.map((m) => m.kw);
    }
  }

  // Extract explicit garment phrase candidate (e.g. "neon green velvet poncho", "denim jacket")
  const canIWearMatch = normalized.match(
    /\b(?:can\s+(?:i|you)|could\s+(?:i|you)|is\s+it\s+okay\s+to|should\s+i|may\s+i|please|would\s+you)\s+(?:wear|pair|style|use|put\s+on)\s+(?:my\s+|a\s+|an\s+|the\s+|this\s+)?([a-z0-9\s\-]+?)(?:\s+(?:with\s+(?:this|that|it|my\b)|instead|for|today|tonight)|\?|\.|$)/i
  );
  const directMatch = normalized.match(
    /\b(?:wear|pair|style|use)\s+(?:my\s+|a\s+|an\s+|the\s+|this\s+)([a-z0-9\s\-]+?)(?:\s+(?:with\s+(?:this|that|it)|instead|for|today|tonight)|\?|\.|$)/i
  );
  const haveMatch = normalized.match(
    /\b(?:do\s+i\s+have|do\s+you\s+see|find|check\s+for)\s+(?:my\s+|a\s+|an\s+|the\s+|any\s+)?([a-z0-9\s\-]+?)(?:\s+(?:in\s+(?:my\s+)?(?:wardrobe|closet))|\?|\.|$)/i
  );

  const matchCandidate = (canIWearMatch && canIWearMatch[1]) || (directMatch && directMatch[1]) || (haveMatch && haveMatch[1]);
  if (matchCandidate) {
    const candidate = matchCandidate.trim();
    const lower = candidate.toLowerCase();
    const forbiddenTerms = ['this', 'that', 'it', 'something', 'anything', 'clothes', 'outfit', 'look', 'pieces'];
    if (candidate.length > 2 && !forbiddenTerms.includes(lower)) {
      entities.requestedGarmentName = candidate;
      entities.wardrobeItemName = candidate;
      entities.anchorGarmentName = candidate;
    }
  }

  // 6. Extract Fabric
  for (const entry of PRECOMPILED_FABRICS) {
    if (entry.regex.test(normalized)) {
      entities.fabric = entry.fabric;
      break;
    }
  }

  // 7. Intent Classification via Deterministic Priority Patterns
  let intent: SaathiIntent = 'UNKNOWN';
  let confidence = 0.0;

  // A. Weather & Context (Priority over general questions: "What is the weather outside today?")
  if (
    !/what fabrics|fabrics work|fabrics for/i.test(normalized) &&
    (
      /weather/i.test(normalized) ||
      /is it raining/i.test(normalized) ||
      /temperature/i.test(normalized) ||
      /how hot is it/i.test(normalized) ||
      /forecast/i.test(normalized) ||
      /climate context/i.test(normalized)
    )
  ) {
    intent = 'CHECK_WEATHER';
    confidence = 0.95;
  }
  // B. Plan Outfit (Calendar scheduling)
  else if (
    /plan (this |an? |my )?(outfit|look)/i.test(normalized) ||
    /schedule (this |the |an? |my )?(first|second|third|1st|2nd|3rd|last)?\s*(look|outfit)/i.test(normalized) ||
    /add .*to calendar/i.test(normalized) ||
    /put .*on (my )?calendar/i.test(normalized)
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
  // C. Record Wear
  else if (
    /i wore/i.test(normalized) ||
    /wore today/i.test(normalized) ||
    /log wear/i.test(normalized) ||
    /record wear/i.test(normalized) ||
    /mark .*as worn/i.test(normalized) ||
    /log (this |the )?(first|second|third|1st|2nd|3rd|last)?\s*(look|outfit)?\s*as worn/i.test(normalized) ||
    /record (this |the )?(first|second|third|1st|2nd|3rd|last)?\s*(look|outfit)?\s*as worn/i.test(normalized)
  ) {
    intent = 'RECORD_WEAR';
    confidence = 0.95;
  }
  // D. Anti-Repetition
  else if (
    entities.antiRepetition ||
    /don'?t want to repeat/i.test(normalized) ||
    /don'?t repeat/i.test(normalized) ||
    /avoid repeating/i.test(normalized) ||
    /something different from (yesterday|last time)/i.test(normalized)
  ) {
    intent = 'ANTI_REPETITION';
    confidence = 0.95;
  }
  // E0. Explicit No Purchase Request (Precedence over purchase assessment)
  else if (
    /\b(don'?t|do not|never|no)\s+(want to\s+)?(buy|purchase|shopping)\b/i.test(normalized) ||
    /\b(no buying|not buying|zero purchases?)\b/i.test(normalized) ||
    /\b(don'?t|do not)\s+suggest\s+(any\s+)?(buy|purchase|shopping)\b/i.test(normalized)
  ) {
    intent = 'EXPLICIT_NO_PURCHASE';
    confidence = 0.98;
    entities.explicitNoPurchase = true;
  }
  // E0b. Explicit Wardrobe-Only Constraint ("Only use clothes from my wardrobe", "Don't suggest anything I don't own")
  else if (
    /\b(only use|use only|strictly use)\s+(clothes|items|pieces)?\s*(from|in)\s+(my\s+)?(wardrobe|closet)\b/i.test(normalized) ||
    /\b(don'?t|do not|never)\s+suggest\s+(anything|clothes|items)\s+(i don'?t own|not in my (wardrobe|closet))\b/i.test(normalized) ||
    /\buse my existing (clothes|wardrobe|items)\b/i.test(normalized) ||
    /\bonly (from|in) my (wardrobe|closet)\b/i.test(normalized)
  ) {
    intent = 'WARDROBE_ONLY_QUERY';
    confidence = 0.98;
    entities.wardrobeOnly = true;
  }
  // E1. Purchase Assessment & Smart Buy (Occasion or general purchase evaluation)
  else if (
    /\b(should i buy|worth buying|do i (actually )?need to buy|do i need (a |an |any )?(new )?|is anything i (have|need) to buy|anything (i have to|to) buy|is there anything to buy|need to buy anything)\b/i.test(normalized) ||
    (/\b(buy|purchase|shopping)\b/i.test(normalized) && !/\b(don'?t|do not|never|no)\b/i.test(normalized))
  ) {
    intent = 'ASSESS_PURCHASE_NEED';
    confidence = 0.95;
  }
  // E2a. Formality / Aesthetic Refinement ("Make it more formal", "Make it more casual", "Make it less formal", "Make it more minimal")
  else if (
    entities.refinementType &&
    entities.refinementType !== 'more_elegant' &&
    (/\b(make it|make this|make.*look|look more|make my.*outfit|turn this into|dressier|less formal|more formal|more casual|more minimal|something more (formal|casual|minimal))\b/i.test(normalized) ||
     /^(make it\s+)?(more formal|more casual|less formal|more minimal)$/i.test(normalized.trim()))
  ) {
    intent = 'REFINE_OUTFIT';
    confidence = 0.96;
  }
  // E2b. Show Alternative Look ("Show another look", "Next look", "Different look", "unlock anchor", "no anchor")
  else if (
    entities.unlockedAnchor ||
    /\b(something else|another (look|outfit)|different (look|outfit)|next (look|outfit))\b/i.test(normalized) ||
    (/\b(show (an? )?(other|another|different)|another option|different option)\b/i.test(normalized) &&
     !/\b(for (the|my)?\s*(top|bottom|shoes|footwear|layer|jacket|blazer|pants|trousers|shirt))\b/i.test(normalized))
  ) {
    intent = 'SHOW_ALTERNATIVE';
    confidence = 0.96;
    const sameGarmentMatch = normalized.match(/\b(the\s+)?same\s+([a-z\-]+)\b/i);
    if (sameGarmentMatch) {
      entities.anchorGarmentName = sameGarmentMatch[2].toLowerCase();
    }
  }
  // E2c. Swap Specific Piece / Anchor Retention / Role Removal
  else if (
    entities.removedRole !== undefined ||
    /\b(without|remove|drop|exclude|no)\s+(the\s+|my\s+)?(jacket|blazer|cardigan|sweater|shrug|coat|layer|outerwear|shoes|footwear|sneakers|heels|flats|boots|bottom|jeans|trousers|pants|top|shirt)\b/i.test(normalized) ||
    /\b(different|change|swap|another|replace|substitute)\s+(the\s+|my\s+)?(footwear|shoes|sneakers|heels|juttis|flats|loafers|bottom|bottoms|pants|trousers|jeans|skirt|palazzo|shorts|top|shirt|t-shirt|tee|kurta|kurti|blouse|layer|jacket|blazer)\b/i.test(normalized) ||
    /\bshow another option for\s+(the\s+|my\s+)?(footwear|shoes|sneakers|heels|juttis|flats|loafers|bottom|bottoms|pants|trousers|jeans|skirt|palazzo|shorts|top|shirt|t-shirt|tee|kurta|kurti|blouse|layer|jacket|blazer)\b/i.test(normalized) ||
    /\buse the same\b.*\bbut different\b/i.test(normalized) ||
    (/\b(keep|retain|don'?t change|do not change|preserve|same)\s+(the\s+|this\s+|my\s+)?(same\s+)?(jeans|trousers|pants|bottoms?|kurta|kurti|shirt|t-shirt|tee|top|blouse|shoes|footwear|sneakers|juttis|flats|loafers|jacket|blazer|saree|dupatta|accessory)\b/i.test(normalized) &&
     !/something else/i.test(normalized))
  ) {
    intent = 'SWAP_PIECE';
    confidence = 0.96;
    if (/\b(different|change|swap|another|replace|substitute|show another option for)\s+(the\s+|my\s+)?(footwear|shoes|sneakers|heels|juttis|flats|loafers)\b/i.test(normalized)) {
      entities.swapRole = 'footwear';
    } else if (/\b(different|change|swap|another|replace|substitute|show another option for)\s+(the\s+|my\s+)?(bottom|bottoms|pants|trousers|jeans|skirt|palazzo|shorts)\b/i.test(normalized)) {
      entities.swapRole = 'bottom';
    } else if (/\b(different|change|swap|another|replace|substitute|show another option for)\s+(the\s+|my\s+)?(top|shirt|t-shirt|tee|kurta|kurti|blouse)\b/i.test(normalized)) {
      entities.swapRole = 'top';
    } else if (/\b(different|change|swap|another|replace|substitute|show another option for)\s+(the\s+|my\s+)?(layer|outerwear|jacket|blazer|cardigan|sweater|shrug)\b/i.test(normalized)) {
      entities.swapRole = 'layer';
    }

    const keepMatch = normalized.match(/\b(keep|retain|don'?t change|do not change|preserve|use the same)\s+(the\s+|this\s+|my\s+)?(same\s+)?(jeans|trousers|pants|bottoms?|kurta|kurti|shirt|t-shirt|tee|top|blouse|shoes|footwear|sneakers|juttis|flats|loafers|jacket|blazer|saree|dupatta|accessory)\b/i);
    if (keepMatch) {
      const garment = keepMatch[4].toLowerCase();
      entities.keptPieceName = garment;
      if (['jeans', 'trousers', 'pants', 'bottom', 'bottoms', 'palazzo', 'shorts', 'skirt'].includes(garment)) {
        entities.keptPieceRole = 'bottom';
      } else if (['top', 'shirt', 't-shirt', 'tee', 'kurta', 'kurti', 'blouse'].includes(garment)) {
        entities.keptPieceRole = 'top';
      } else if (['shoes', 'footwear', 'sneakers', 'juttis', 'flats', 'loafers', 'heels'].includes(garment)) {
        entities.keptPieceRole = 'footwear';
      } else if (['jacket', 'blazer', 'layer', 'outerwear'].includes(garment)) {
        entities.keptPieceRole = 'layer';
      }
      entities.anchorGarmentName = garment;
    }
  }
  // F. Wardrobe Gaps
  else if (
    /wardrobe gaps?/i.test(normalized) ||
    /shortages?/i.test(normalized) ||
    /missing/i.test(normalized) ||
    /gap report/i.test(normalized) ||
    /what is missing from my wardrobe/i.test(normalized)
  ) {
    intent = 'CHECK_WARDROBE_GAPS';
    confidence = 0.95;
  }
  // G. Wear Analytics
  else if (
    /wear analytics/i.test(normalized) ||
    /wear stats/i.test(normalized) ||
    /rotation/i.test(normalized) ||
    /cost per wear/i.test(normalized) ||
    /dormant/i.test(normalized) ||
    /never worn/i.test(normalized) ||
    /least worn/i.test(normalized) ||
    /most worn/i.test(normalized) ||
    /what do i wear (most|often|least)/i.test(normalized) ||
    /wear most often/i.test(normalized) ||
    /unworn/i.test(normalized)
  ) {
    intent = 'ANALYZE_WEAR';
    confidence = 0.95;
  }
  // H. Style Brain & Personal Profile
  else if (
    /style (profile|brain|aesthetic|vibe|dna)/i.test(normalized) ||
    /styling (aesthetic|preferences?|profile|dna|style)/i.test(normalized) ||
    /aesthetic preferences?/i.test(normalized) ||
    /style preferences?/i.test(normalized) ||
    /color preferences?/i.test(normalized) ||
    /fashion style/i.test(normalized) ||
    /what do i like/i.test(normalized) ||
    /learned preference/i.test(normalized)
  ) {
    intent = 'UNDERSTAND_STYLE';
    confidence = 0.9;
  }
  // I. Color Pairing Advice
  else if (
    /trouser colou?rs?/i.test(normalized) ||
    /colou?r combinations? for/i.test(normalized) ||
    /(what|which) colou?rs? (go|work|pair|match)\s+(well\s+)?with/i.test(normalized) ||
    /colou?rs? (that )?(go|work|pair|match)\s+(well\s+)?with/i.test(normalized) ||
    /colou?rs? pair well with/i.test(normalized) ||
    /pair well with/i.test(normalized)
  ) {
    intent = 'COLOR_PAIRING';
    confidence = 0.95;
  }
  // J. Premium / Quiet Luxury Upgrade
  else if (
    /(make this|make.*look|look more|make my.*outfit|make it) (more )?(premium|expensive|elevated|luxurious|elegant|formal|classy)/i.test(normalized) ||
    (!/(tell me|what is|explain)/i.test(normalized) && /\bquiet luxury\b/i.test(normalized)) ||
    /\belevate (my |this )?(look|outfit|style)\b/i.test(normalized) ||
    /\b(more elegant|more sophisticated)\b/i.test(normalized)
  ) {
    intent = 'PREMIUM_UPGRADE';
    confidence = 0.95;
  }
  // K1. Style 3 Ways
  else if (
    /(3|three) ways/i.test(normalized) ||
    /three looks/i.test(normalized) ||
    /3 looks/i.test(normalized) ||
    /3 styles/i.test(normalized) ||
    /style .*in (3|three) ways/i.test(normalized)
  ) {
    intent = 'STYLE_3_WAYS';
    confidence = 0.98;
    if (!entities.subcategory && !entities.category && !entities.requestedGarmentName) {
      missingInformation.push({
        field: 'wardrobeItemId',
        reason: 'Specify which garment from your wardrobe you would like to style 3 ways.',
        critical: true,
      });
    }
  }
  // K2. College & Campus Outfit (StyleSaathi 4.0.2 - P1-A)
  else if (
    !/presentation|interview|formal|meeting/i.test(normalized) &&
    entities.occasion !== 'office' &&
    entities.occasion !== 'interview' &&
    !/^(recommend|suggest)\b/i.test(normalized) &&
    (
      /\b(college|campus|university)\s+(outfit|look|wear|fit|clothes|dressing)\b/i.test(normalized) ||
      /what\s+(should|can|to)\s+(i\s+)?wear\s+(to|for)\s+(college|campus|university)/i.test(normalized) ||
      /what to wear (to|for) (college|campus|university)/i.test(normalized) ||
      /(outfit|look)\s+(ideas?\s+)?for\s+(college|campus|university)/i.test(normalized) ||
      /dress\s+me\s+for\s+(college|campus|university)/i.test(normalized) ||
      /style\s+(me\s+)?for\s+(college|campus|university)/i.test(normalized)
    )
  ) {
    intent = 'COLLEGE_OUTFIT';
    confidence = 0.96;
    entities.occasion = 'college';
  }
  // K3. Job Interview Outfit (StyleSaathi 4.0.2 - P1-A)
  else if (
    (entities.isCorrection && entities.occasion === 'interview') ||
    (!/^(recommend|suggest)\b/i.test(normalized) &&
    (
      /\b(interview|job interview|placement interview)\s+(outfit|look|wear|fit|clothes|dressing)\b/i.test(normalized) ||
      /what\s+(should|can|to)\s+(i\s+)?wear\s+(to|for)\s+(an?\s+)?(interview|job interview)/i.test(normalized) ||
      /what to wear (to|for) (an?\s+)?(interview|job interview)/i.test(normalized) ||
      /(outfit|look)\s+(ideas?\s+)?for\s+(an?\s+)?(interview|job interview)/i.test(normalized) ||
      /dress\s+me\s+for\s+(an?\s+)?(interview|job interview)/i.test(normalized) ||
      /style\s+(me\s+)?for\s+(an?\s+)?(interview|job interview)/i.test(normalized)
    ))
  ) {
    intent = 'INTERVIEW_OUTFIT';
    confidence = 0.96;
    entities.occasion = 'interview';
  }
  // K4. Indo-Western & Fusion Styling
  else if (
    /\bindo[- ]?western\b/i.test(normalized) ||
    /\bfusion (look|outfit|style)\b/i.test(normalized) ||
    /style .*indo[- ]?western/i.test(normalized)
  ) {
    intent = 'INDO_WESTERN';
    confidence = 0.96;
  }
  // K5. Saree Styling
  else if (
    /\b(saree|sari) styling\b/i.test(normalized) ||
    /style (a |my )?(saree|sari)/i.test(normalized) ||
    /how to style (a |my )?(saree|sari)/i.test(normalized) ||
    /saree drape/i.test(normalized)
  ) {
    intent = 'SAREE_STYLING';
    confidence = 0.96;
  }
  // K6. Minimalist Outfit
  else if (
    /\bminimal(ist)? (look|outfit|style|fit)\b/i.test(normalized) ||
    /clean (and |&) simple (look|outfit)/i.test(normalized) ||
    /\bcapsule (look|outfit)\b/i.test(normalized)
  ) {
    intent = 'MINIMALIST_OUTFIT';
    confidence = 0.95;
  }
  // K7. Restyle Underused / Neglected Garments
  else if (
    /\brestyle (underused|dormant|unworn|neglected)\b/i.test(normalized) ||
    /what haven't i worn/i.test(normalized) ||
    /items i haven't worn/i.test(normalized) ||
    /dormant items/i.test(normalized)
  ) {
    intent = 'RESTYLE_UNDERUSED';
    confidence = 0.95;
  }
  // K8. Style This Item (Anchor Constraint: "I want to wear my blue kurti", "Style my black jeans", "Can you style a neon green velvet poncho with this?")
  else if (
    /style (this|my|the|that|a|an)/i.test(normalized) ||
    /how (do|can) (i|we) style/i.test(normalized) ||
    /\bcan\s+i\s+wear\s+(?:my|this|the)\b/i.test(normalized) ||
    /\bcan\s+(?:you|we)\s+(?:wear|pair|style)\b/i.test(normalized) ||
    /\bcould\s+(?:you|we)\s+(?:wear|pair|style)\b/i.test(normalized) ||
    /\bcan\s+i\s+style\b/i.test(normalized) ||
    /pair (with|my|that)/i.test(normalized) ||
    /what (goes|works) with (this|my|that)/i.test(normalized) ||
    /wear with (my|this|that)/i.test(normalized) ||
    /\b(and\s+|i\s+)?(want|'d like)\s+to wear\s+(my|this|the|that|a|an)\b/i.test(normalized) ||
    /\bwant to wear (my|this|the|that|a|an)\b/i.test(normalized) ||
    /\b(wear|use|style) (my|this|the) .*(for|to|tonight|today|with)?/i.test(normalized) ||
    /\b(style|use) (a|an) .*(for|to|tonight|today|with)?/i.test(normalized) ||
    /\banchor (with|around)\b/i.test(normalized)
  ) {
    intent = 'STYLE_ITEM';
    confidence = 0.95;
    if (!entities.subcategory && !entities.category && !entities.requestedGarmentName) {
      missingInformation.push({
        field: 'wardrobeItemId',
        reason: 'Specify which garment from your wardrobe you would like to style.',
        critical: true,
      });
    }
  }
  // L1. Explain Recommendation
  else if (
    /why (did you|is this|you) recommend/i.test(normalized) ||
    /why this (outfit|look)/i.test(normalized) ||
    /explain why/i.test(normalized) ||
    /why this\b/i.test(normalized) ||
    /why the (first|second|third|1st|2nd|3rd|last)/i.test(normalized) ||
    /explain this outfit/i.test(normalized) ||
    /reason for this/i.test(normalized)
  ) {
    intent = 'EXPLAIN_RECOMMENDATION';
    confidence = 0.95;
  }
  // L2. General Fashion & Cultural Knowledge (Phase 6 & Living Craft Traditions)
  else if (
    /(tell me about|what is|explain|history of)\s+/i.test(normalized) ||
    /can i (wear|pair)/i.test(normalized) ||
    /how (do|can) i pair/i.test(normalized) ||
    /what fabrics/i.test(normalized) ||
    /fabrics work/i.test(normalized) ||
    /how to wear a saree/i.test(normalized) ||
    /traditional etiquette/i.test(normalized) ||
    /indian fashion/i.test(normalized) ||
    /rule for/i.test(normalized) ||
    /saree with sneakers/i.test(normalized) ||
    /\b(chanderi|chikankari|banarasi brocade|ajrakh|pashmina|mulmul|pochampally ikat|khadi denim)\b/i.test(normalized)
  ) {
    intent = 'GENERAL_FASHION_QUESTION';
    confidence = 0.9;
  }
  // M. User Behavioral Feedback
  else if (
    /love this/i.test(normalized) ||
    /looks great/i.test(normalized) ||
    /perfect match/i.test(normalized) ||
    /amazing/i.test(normalized) ||
    /i (like|prefer|pick|choose)\b/i.test(normalized)
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
  // N. Wardrobe Search & Inventory Check
  else if (
    /show (my |all )?(wardrobe|closet|clothes|items)/i.test(normalized) ||
    /view (my )?(wardrobe|closet|inventory)/i.test(normalized) ||
    /list (my |all )?(wardrobe|clothes|items)/i.test(normalized) ||
    /what clothes do i have/i.test(normalized) ||
    /which of my (existing )?clothes (are suitable|work|can i wear|do i have)/i.test(normalized) ||
    /(what|which) clothes (are suitable|work) for/i.test(normalized) ||
    /(what is|what's|what clothes are|show|list).*(in laundry|dirty|unwashed)/i.test(normalized) ||
    /\b(laundry list|dirty clothes|clothes in laundry)\b/i.test(normalized) ||
    /find (my|all)/i.test(normalized) ||
    /search (closet|wardrobe)/i.test(normalized) ||
    /do i have (a |any )/i.test(normalized) ||
    /how many (shirts|trousers|shoes|kurtas|clothes|items)/i.test(normalized) ||
    /closet inventory/i.test(normalized)
  ) {
    intent = 'CHECK_WARDROBE';
    confidence = 0.9;
    if (/(in laundry|dirty|unwashed)/i.test(normalized)) {
      entities.status = 'in_laundry';
    }
  }
  // O. Recommend Outfit
  else if (
    /what should i wear/i.test(normalized) ||
    /what to wear/i.test(normalized) ||
    /pick clothes/i.test(normalized) ||
    /look ideas/i.test(normalized) ||
    /outfit ideas?/i.test(normalized) ||
    /suggest (an? )?(outfit|look|clothes)/i.test(normalized) ||
    /recommend (an? )?(outfit|look|clothes)/i.test(normalized) ||
    /dress me/i.test(normalized) ||
    /outfit for/i.test(normalized) ||
    /look for/i.test(normalized) ||
    /i (want|need) (a |an )?.*(outfit|look|fit)/i.test(normalized) ||
    /i have (a |an )?.*(wedding|party|meeting|presentation|interview|event|function|puja|date|dinner|reception|celebration)/i.test(normalized) ||
    /going to (a |an )?.*(wedding|party|meeting|presentation|interview|event|function|puja|date|dinner|reception|celebration)/i.test(normalized) ||
    (entities.isCorrection && entities.occasion) ||
    (entities.occasion && normalized.split(/\s+/).length >= 2)
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
  // P. Single occasion keyword fallback (e.g. user just inputs "college" or "office" or "party")
  else if (entities.occasion) {
    intent = 'CLARIFICATION_RESPONSE';
    confidence = 0.85;
    entities.clarificationValue = entities.occasion;
  }
  // Q. Single garment mention fallback (e.g. "my black jeans")
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
