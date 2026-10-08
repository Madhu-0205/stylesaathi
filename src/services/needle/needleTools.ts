import {
  Occasion,
  Season,
  Category,
  Status,
} from '../../types';
import {
  NeedleToolName,
  RawNeedleToolCall,
  ValidatedToolCall,
  NeedleEngineSource,
  isNeedleToolName,
  getConfidenceTier,
} from './needleTypes';

const OCCASION_SYNONYMS: Record<string, Occasion> = {
  // college / uni
  college: 'college',
  uni: 'college',
  university: 'college',
  campus: 'college',
  lecture: 'college',
  class: 'college',
  school: 'college',

  // everyday
  everyday: 'everyday',
  daily: 'everyday',
  routine: 'everyday',
  errand: 'everyday',
  errands: 'everyday',
  home: 'everyday',

  // office
  office: 'office',
  work: 'office',
  formal: 'office',
  corporate: 'office',
  meeting: 'office',
  presentation: 'office',

  // interview
  interview: 'interview',
  'job interview': 'interview',

  // casual outing
  'casual outing': 'casual outing',
  casual: 'casual outing',
  outing: 'casual outing',
  hangout: 'casual outing',
  brunch: 'casual outing',
  cafe: 'casual outing',
  coffee: 'casual outing',
  lunch: 'casual outing',
  shopping: 'casual outing',

  // date
  date: 'date',
  romantic: 'date',
  'dinner date': 'date',
  dinner: 'date',

  // party
  party: 'party',
  club: 'party',
  clubbing: 'party',
  'night out': 'party',
  cocktail: 'party',

  // family function
  'family function': 'family function',
  function: 'family function',
  'family gathering': 'family gathering',
  gathering: 'family gathering',

  // religious / puja
  puja: 'puja',
  pooja: 'puja',
  temple: 'puja',
  mandir: 'puja',
  havan: 'puja',
  aarti: 'puja',

  // festive & festivals
  festive: 'festive',
  festival: 'festive',
  celebration: 'celebration',
  diwali: 'Diwali',
  deepavali: 'Diwali',
  holi: 'Holi',
  eid: 'Eid',

  // wedding guest
  'wedding guest': 'wedding guest',
  wedding: 'wedding guest',
  shaadi: 'wedding guest',
  marriage: 'wedding guest',
  reception: 'wedding guest',
  sangeet: 'wedding guest',
  mehendi: 'wedding guest',

  // travel
  travel: 'travel',
  trip: 'travel',
  flight: 'travel',
  vacation: 'travel',
  airport: 'travel',
};

const DESTRUCTIVE_KEYWORDS = [
  'delete',
  'remove',
  'clear',
  'wipe',
  'reset',
  'drop',
  'destroy',
  'purge',
  'truncate',
  'discard',
];

export function normalizeOccasion(input: unknown): Occasion | null {
  if (typeof input !== 'string') return null;
  const cleaned = input.trim().toLowerCase();
  if (!cleaned) return null;

  if (cleaned in OCCASION_SYNONYMS) {
    return OCCASION_SYNONYMS[cleaned];
  }

  // Check matching case-insensitively with canonical Occasion values
  const canonicalOccasions: Occasion[] = [
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
    'Diwali',
    'Holi',
    'Eid',
    'travel',
  ];

  const found = canonicalOccasions.find((occ) => occ.toLowerCase() === cleaned);
  return found || null;
}

export function normalizeDate(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const cleaned = input.trim().toLowerCase();
  if (!cleaned) return null;

  const now = new Date();

  if (cleaned === 'today') {
    return formatDateISO(now);
  }

  if (cleaned === 'tomorrow') {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return formatDateISO(tomorrow);
  }

  if (cleaned === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return formatDateISO(yesterday);
  }

  // Validate YYYY-MM-DD
  const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const parsed = new Date(cleaned);
    if (!isNaN(parsed.getTime())) {
      return cleaned;
    }
  }

  return null;
}

function formatDateISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isDestructiveAction(
  _toolName: string,
  args: Record<string, unknown>,
  query?: string
): boolean {
  const queryLower = (query || '').toLowerCase();
  for (const kw of DESTRUCTIVE_KEYWORDS) {
    if (queryLower.includes(kw)) {
      return true;
    }
  }

  for (const value of Object.values(args)) {
    if (typeof value === 'string') {
      const valLower = value.toLowerCase();
      for (const kw of DESTRUCTIVE_KEYWORDS) {
        if (valLower.includes(kw)) {
          return true;
        }
      }
    }
  }

  return false;
}

export type ValidationResult =
  | { valid: true; toolCall: ValidatedToolCall }
  | { valid: false; error: string };

export function validateAndNormalizeToolCall(
  raw: RawNeedleToolCall,
  confidence: number,
  originalQuery?: string,
  engine?: NeedleEngineSource,
  reasoning?: string
): ValidationResult {
  if (!isNeedleToolName(raw.name)) {
    return {
      valid: false,
      error: `Unknown tool "${raw.name}". Supported tools: recommend_outfit, search_wardrobe, record_wear, create_style_plan, search_style_preferences`,
    };
  }

  const rawArgs = (raw.arguments && typeof raw.arguments === 'object' ? raw.arguments : {}) as Record<string, unknown>;
  const toolName: NeedleToolName = raw.name;
  let normalizedArgs: Record<string, unknown> = {};
  let explanation = '';

  switch (toolName) {
    case 'recommend_outfit': {
      const occasion = normalizeOccasion(rawArgs.occasion);
      if (!occasion) {
        return {
          valid: false,
          error: `Missing or invalid occasion: "${String(rawArgs.occasion || '')}". Please specify an occasion like college, office, party, or casual outing.`,
        };
      }

      let season: Season | undefined;
      if (typeof rawArgs.season === 'string') {
        const s = rawArgs.season.toLowerCase();
        if (s === 'summer' || s === 'monsoon' || s === 'winter') {
          season = s as Season;
        }
      }

      const style = typeof rawArgs.style === 'string' && rawArgs.style.trim() ? rawArgs.style.trim() : undefined;

      normalizedArgs = {
        occasion,
        ...(style ? { style } : {}),
        ...(season ? { season } : {}),
      };

      explanation = `Recommend an outfit for ${occasion}${style ? ` in ${style} style` : ''}${season ? ` (${season})` : ''}.`;
      break;
    }

    case 'search_wardrobe': {
      const validCategories: Category[] = [
        'Tops',
        'Bottoms',
        'Ethnic',
        'Dresses',
        'Outerwear',
        'Footwear',
        'Accessories',
      ];
      let category: Category | undefined;
      if (typeof rawArgs.category === 'string') {
        const cat = validCategories.find((c) => c.toLowerCase() === (rawArgs.category as string).toLowerCase());
        if (cat) category = cat;
      }

      let status: Status | undefined;
      if (typeof rawArgs.status === 'string') {
        const stat = rawArgs.status.toLowerCase();
        if (stat === 'clean' || stat === 'needs_washing' || stat === 'in_laundry') {
          status = stat as Status;
        }
      }

      const color = typeof rawArgs.color === 'string' && rawArgs.color.trim() ? rawArgs.color.trim() : undefined;
      const subcategory = typeof rawArgs.subcategory === 'string' && rawArgs.subcategory.trim() ? rawArgs.subcategory.trim() : undefined;

      normalizedArgs = {
        ...(category ? { category } : {}),
        ...(subcategory ? { subcategory } : {}),
        ...(color ? { color } : {}),
        ...(status ? { status } : {}),
      };

      explanation = `Search wardrobe items${category ? ` in category "${category}"` : ''}${color ? ` with color "${color}"` : ''}${subcategory ? ` (${subcategory})` : ''}.`;
      break;
    }

    case 'record_wear': {
      const itemName = typeof rawArgs.itemName === 'string' ? rawArgs.itemName.trim() : '';
      if (!itemName) {
        return {
          valid: false,
          error: 'Missing required itemName to record wear.',
        };
      }

      const rawDate = typeof rawArgs.date === 'string' ? rawArgs.date : 'today';
      const date = normalizeDate(rawDate) || normalizeDate('today')!;

      normalizedArgs = {
        itemName,
        date,
      };

      explanation = `Record wear for "${itemName}" on ${date}.`;
      break;
    }

    case 'create_style_plan': {
      const date = normalizeDate(rawArgs.date);
      if (!date) {
        return {
          valid: false,
          error: `Missing or invalid date: "${String(rawArgs.date || '')}". Provide a date like "today", "tomorrow", or "YYYY-MM-DD".`,
        };
      }

      const occasion = normalizeOccasion(rawArgs.occasion);
      if (!occasion) {
        return {
          valid: false,
          error: `Missing or invalid occasion: "${String(rawArgs.occasion || '')}".`,
        };
      }

      const notes = typeof rawArgs.notes === 'string' && rawArgs.notes.trim() ? rawArgs.notes.trim() : undefined;

      normalizedArgs = {
        date,
        occasion,
        ...(notes ? { notes } : {}),
      };

      explanation = `Schedule look for ${occasion} on ${date}.`;
      break;
    }

    case 'search_style_preferences': {
      const validTypes = ['contexts', 'aesthetics', 'stylingMode', 'all'] as const;
      let preferenceType: 'contexts' | 'aesthetics' | 'stylingMode' | 'all' = 'all';

      if (typeof rawArgs.preferenceType === 'string') {
        const pt = rawArgs.preferenceType.toLowerCase();
        if (validTypes.includes(pt as any)) {
          preferenceType = pt as any;
        }
      }

      normalizedArgs = { preferenceType };
      explanation = `Inspect style preferences (${preferenceType}).`;
      break;
    }
  }

  const confidenceTier = getConfidenceTier(confidence);
  const isDestructive = isDestructiveAction(toolName, normalizedArgs, originalQuery);
  const requiresConfirmation = isDestructive || confidenceTier === 'MEDIUM';

  const toolCall: ValidatedToolCall = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: toolName,
    arguments: normalizedArgs,
    confidence,
    confidenceLevel: confidenceTier,
    isDestructive,
    requiresConfirmation,
    explanation,
    engine,
    reasoning,
  };

  return {
    valid: true,
    toolCall,
  };
}
