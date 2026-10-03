import { WardrobeItem, Occasion } from '../types';

export const harmony = (a: string[], b: string[]): number => {
  const neutral = [
    'black',
    'white',
    'cream',
    'beige',
    'navy',
    'brown',
    'grey',
    'silver',
    'gold',
  ];
  if (a.some((x) => neutral.includes(x)) || b.some((x) => neutral.includes(x))) return 2;
  if (a.some((x) => b.includes(x))) return 2;

  const pairs: [string, string][] = [
    ['blue', 'orange'],
    ['pink', 'green'],
    ['purple', 'yellow'],
    ['red', 'green'],
  ];

  if (
    a.some((x) =>
      b.some((y) => pairs.some(([p, q]) => (p === x && q === y) || (q === x && p === y)))
    )
  ) {
    return 1;
  }

  return -2;
};

const OCCASION_FORMALITY_TARGETS: Record<string, number> = {
  college: 2.0,
  everyday: 2.0,
  'casual outing': 2.2,
  travel: 2.0,
  date: 3.2,
  party: 3.8,
  office: 4.0,
  interview: 4.5,
  'family function': 3.8,
  'family gathering': 3.8,
  puja: 4.0,
  festive: 4.3,
  Diwali: 4.3,
  Eid: 4.3,
  Holi: 2.5,
  'wedding guest': 4.8,
  celebration: 4.8,
};

export const calculateOutfitScore = (
  pieces: WardrobeItem[],
  occasion: Occasion,
  seed = 0.5
): number => {
  let score = 0;

  // Color harmony between all pairs
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      score += harmony(pieces[i].colors, pieces[j].colors);
    }
  }

  // Formality consistency with nuanced occasion targets
  const avg = pieces.reduce((a, x) => a + x.formality, 0) / pieces.length;
  const target = OCCASION_FORMALITY_TARGETS[occasion] ?? (['office', 'wedding guest', 'Diwali', 'puja'].includes(occasion) ? 4 : 2.5);
  score -= Math.abs(avg - target) * 1.5;

  // Authentic cultural and occasion context appropriateness
  const hasEthnic = pieces.some((p) => p.category === 'Ethnic');
  const pieceColors = pieces.flatMap((p) => p.colors);

  if (['puja', 'festive', 'Diwali', 'Eid'].includes(occasion)) {
    if (hasEthnic) score += 1.0;
    const auspiciousColors = ['yellow', 'mustard', 'cream', 'white', 'gold', 'red', 'orange'];
    if (pieceColors.some((c) => auspiciousColors.includes(c))) {
      score += 0.8;
    }
  } else if (['wedding guest', 'celebration'].includes(occasion)) {
    if (hasEthnic) score += 1.5;
    const celebrationSubs = ['saree', 'lehenga', 'nehru jacket', 'juttis', 'anarkali', 'blouse'];
    if (pieces.some((p) => celebrationSubs.includes(p.subcategory || ''))) {
      score += 1.0;
    }
  } else if (['office', 'interview'].includes(occasion)) {
    const formalSubs = ['shirt', 'trousers', 'blazer', 'formal shoes', 'flats'];
    if (pieces.some((p) => formalSubs.includes(p.subcategory || ''))) {
      score += 0.8;
    }
  } else if (['college', 'casual outing', 'everyday'].includes(occasion)) {
    const casualSubs = ['t-shirt', 'jeans', 'sneakers', 'flats', 'sandals', 'kurti'];
    if (pieces.some((p) => casualSubs.includes(p.subcategory || ''))) {
      score += 0.6;
    }
  }

  // Favorite bonus
  score += pieces.filter((x) => x.favorite).length * 0.7;

  // Recent wear penalty: worn pieces receive a penalty so fresh outfits surface
  score -= pieces.reduce((a, x) => {
    let penalty = Math.min(x.timesWorn || 0, 6) * 0.12;
    if (x.lastWorn && Date.now() - x.lastWorn < 24 * 60 * 60 * 1000) {
      penalty += 0.8;
    }
    return a + penalty;
  }, 0);

  // Controlled seed randomness
  score += (seed - 0.5) * 0.5;

  return score;
};

export const getOutfitWhyReasons = (
  pieces: WardrobeItem[],
  occasion: Occasion,
  _score = 3
): string[] => {
  const reasons: string[] = [];

  // Reason 1: Silhouette and tonal balance
  const pieceColors = pieces.flatMap((p) => p.colors);
  const neutrals = ['black', 'white', 'cream', 'beige', 'navy', 'grey'];
  const hasNeutral = pieceColors.some((c) => neutrals.includes(c));

  if (hasNeutral) {
    reasons.push('Balanced proportions with versatile neutral tones');
  } else {
    reasons.push('Complementary color pairing with cohesive tonal harmony');
  }

  // Reason 2: Occasion-specific intelligence
  switch (occasion) {
    case 'college':
      reasons.push('Relaxed, breathable silhouette easy for a full campus day');
      break;
    case 'office':
      reasons.push('Structured lines and consistent formality suited for work');
      break;
    case 'interview':
      reasons.push('Crisp, tailored presentation conveying quiet confidence');
      break;
    case 'puja':
      reasons.push('Traditional aesthetic with respectful, auspicious tones');
      break;
    case 'wedding guest':
    case 'celebration':
      reasons.push('Elevated festive craftsmanship suited for celebrations');
      break;
    case 'festive':
    case 'Diwali':
    case 'Eid':
      reasons.push('Festive Indian silhouette with rich cultural grace');
      break;
    case 'date':
      reasons.push('Chic proportion with effortless, understated charm');
      break;
    case 'travel':
      reasons.push('Comfort-first layering ready for transit and walking');
      break;
    case 'family function':
    case 'family gathering':
      reasons.push('Refined ethnic styling ideal for family gatherings');
      break;
    default:
      reasons.push('Easy silhouette suited for everyday Indian routines');
      break;
  }

  // Reason 3: Wardrobe cohesion
  if (pieces.some((p) => p.favorite)) {
    reasons.push('Built around your favorite core wardrobe pieces');
  } else {
    reasons.push('Seamless pairing with your existing footwear and accessories');
  }

  return reasons.slice(0, 3);
};

export const generateOutfitWhy = (
  scoreOrPieces: number | WardrobeItem[],
  occasionOrScore?: Occasion | number,
  scoreMaybe?: number
): string => {
  if (Array.isArray(scoreOrPieces)) {
    const occ = (typeof occasionOrScore === 'string' ? occasionOrScore : 'casual outing') as Occasion;
    const score = typeof scoreMaybe === 'number' ? scoreMaybe : 3;
    const reasons = getOutfitWhyReasons(scoreOrPieces, occ, score);
    return reasons.join(' · ');
  }
  const score = typeof scoreOrPieces === 'number' ? scoreOrPieces : 3;
  if (score > 4) return 'Balanced colors with a strong, versatile base.';
  if (score > 1) return 'Easy color pairing with consistent formality.';
  return 'A relaxed mix with a simple focal piece.';
};
