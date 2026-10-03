import { WardrobeItem, Occasion } from '../types';

export const harmony = (a: string[], b: string[]): number => {
  const neutral = [
    'black',
    'white',
    'cream',
    'beige',
    'navy',
    'brown',
    'tan',
    'grey',
    'silver',
    'gold',
  ];
  if (a.some((x) => neutral.includes(x)) || b.some((x) => neutral.includes(x))) return 2;
  if (a.some((x) => b.includes(x))) return 2;

  const harmonicPairs: [string, string][] = [
    ['blue', 'orange'],
    ['blue', 'yellow'],
    ['blue', 'green'],
    ['pink', 'green'],
    ['pink', 'yellow'],
    ['pink', 'orange'],
    ['pink', 'purple'],
    ['pink', 'teal'],
    ['purple', 'yellow'],
    ['purple', 'gold'],
    ['red', 'green'],
    ['red', 'gold'],
    ['red', 'yellow'],
    ['mustard', 'navy'],
    ['mustard', 'pink'],
    ['mustard', 'olive'],
    ['mustard', 'teal'],
    ['mustard', 'rust'],
    ['olive', 'rust'],
    ['olive', 'mustard'],
    ['olive', 'beige'],
    ['teal', 'coral'],
    ['teal', 'peach'],
  ];

  if (
    a.some((x) =>
      b.some((y) => harmonicPairs.some(([p, q]) => (p === x && q === y) || (q === x && p === y)))
    )
  ) {
    return 1.5;
  }

  return -1.5;
};

const OCCASION_FORMALITY_TARGETS: Record<string, number> = {
  college: 1.8,
  everyday: 2.0,
  'casual outing': 2.2,
  travel: 2.0,
  'family gathering': 3.2,
  puja: 3.6,
  date: 3.2,
  party: 3.8,
  office: 3.8,
  'family function': 4.0,
  festive: 4.2,
  Diwali: 4.3,
  Eid: 4.3,
  Holi: 2.2,
  interview: 4.5,
  celebration: 4.6,
  'wedding guest': 4.8,
};

export const calculateOutfitScore = (
  pieces: WardrobeItem[],
  occasion: Occasion,
  seed = 0.5
): number => {
  let score = 0;

  // Color harmony normalized by number of pairs so outfit size does not artificially inflate scores
  const numPairs = (pieces.length * (pieces.length - 1)) / 2;
  let harmonySum = 0;
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      harmonySum += harmony(pieces[i].colors, pieces[j].colors);
    }
  }
  score += numPairs > 0 ? (harmonySum / numPairs) * 3 : 0;

  // Formality consistency with nuanced occasion targets
  const avg = pieces.reduce((a, x) => a + x.formality, 0) / pieces.length;
  const target = OCCASION_FORMALITY_TARGETS[occasion] ?? 2.5;
  score -= Math.abs(avg - target) * 1.5;

  // Authentic cultural and occasion context appropriateness
  const hasEthnic = pieces.some((p) => p.category === 'Ethnic');
  const pieceColors = pieces.flatMap((p) => p.colors);
  const pieceSubs = pieces.map((p) => p.subcategory || '');

  // 1. Devotional / Puja Context (Traditional modesty & auspicious tones; avoid black)
  if (occasion === 'puja') {
    if (hasEthnic) score += 1.2;
    const auspiciousColors = ['yellow', 'mustard', 'cream', 'white', 'gold', 'red', 'orange', 'pink'];
    if (pieceColors.some((c) => auspiciousColors.includes(c))) {
      score += 1.0;
    }
    // Modest draping / chunni is culturally revered during devotional puja
    if (pieceSubs.includes('dupatta')) {
      score += 0.8;
    }
    // Cultural decorum: black is traditionally avoided in devotional rituals
    if (pieceColors.includes('black')) {
      score -= 1.5;
    }
    if (pieceSubs.some((s) => ['juttis', 'kolhapuris', 'flats', 'sandals'].includes(s))) {
      score += 0.5;
    } else if (pieceSubs.includes('sneakers')) {
      score -= 0.8;
    }
  }
  // 2. Wedding Guest Context (Opulent festive craftsmanship, highest formality)
  else if (occasion === 'wedding guest') {
    if (hasEthnic) score += 1.8;
    const weddingSubs = ['saree', 'lehenga', 'nehru jacket', 'sherwani', 'anarkali', 'blouse', 'dupatta'];
    if (pieces.some((p) => weddingSubs.includes(p.subcategory || ''))) {
      score += 1.2;
    }
    if (pieceSubs.some((s) => ['juttis', 'kolhapuris', 'heels'].includes(s))) {
      score += 0.8;
    }
    // Casual items strongly penalized for a wedding
    const casualSubs = ['t-shirt', 'shorts', 'hoodie', 'sneakers', 'joggers'];
    if (pieceSubs.some((s) => casualSubs.includes(s))) {
      score -= 2.0;
    }
  }
  // 3. Celebration & Festive (Diwali, Eid, Family Functions)
  else if (['festive', 'Diwali', 'Eid', 'celebration', 'family function'].includes(occasion)) {
    if (hasEthnic) score += 1.2;
    const festiveSubs = ['saree', 'kurta', 'lehenga', 'nehru jacket', 'anarkali', 'juttis', 'dupatta'];
    if (pieceSubs.some((s) => festiveSubs.includes(s))) {
      score += 0.8;
    }
  }
  // 4. Family Gathering (Comfortably polished: smart casual or relaxed ethnic)
  else if (occasion === 'family gathering') {
    const familySubs = ['kurta', 'kurti', 'shirt', 'trousers', 'churidar', 'palazzo', 'loafers', 'flats', 'sandals'];
    if (pieceSubs.some((s) => familySubs.includes(s))) {
      score += 0.8;
    }
    if (pieceSubs.includes('lehenga') || pieceSubs.includes('sherwani')) {
      score -= 1.0;
    }
  }
  // 5. Office & Corporate (Structured lines, business polish, professional ethnic/western)
  else if (occasion === 'office') {
    const formalSubs = ['shirt', 'trousers', 'blazer', 'formal shoes', 'loafers', 'flats'];
    if (pieceSubs.some((s) => formalSubs.includes(s))) {
      score += 1.0;
    }
    const officeEthnic = ['saree', 'kurta'];
    if (pieceSubs.some((s) => officeEthnic.includes(s))) {
      score += 0.6;
    }
    if (pieceSubs.some((s) => ['shorts', 'hoodie', 'lehenga', 'sherwani'].includes(s))) {
      score -= 1.8;
    }
  }
  // 6. Interview (Strict formality, no casual footwear)
  else if (occasion === 'interview') {
    const interviewSubs = ['blazer', 'shirt', 'trousers', 'formal shoes', 'flats'];
    if (pieceSubs.some((s) => interviewSubs.includes(s))) {
      score += 1.5;
    }
    if (pieceSubs.some((s) => ['sneakers', 'sandals', 'shorts', 't-shirt'].includes(s))) {
      score -= 2.0;
    }
  }
  // 7. College (Comfort-first campus wear, kurti-jeans, sneakers, tees)
  else if (occasion === 'college') {
    const collegeSubs = ['t-shirt', 'jeans', 'kurti', 'palazzo', 'sneakers', 'flats', 'sandals', 'trousers'];
    if (pieceSubs.some((s) => collegeSubs.includes(s))) {
      score += 1.0;
    }
    if (pieceSubs.some((s) => ['blazer', 'lehenga', 'sherwani', 'saree'].includes(s))) {
      score -= 1.8;
    }
  }
  // 8. Everyday (Effortless ease)
  else if (occasion === 'everyday' || occasion === 'casual outing') {
    const everydaySubs = ['t-shirt', 'jeans', 'kurti', 'kurta', 'sneakers', 'flats', 'sandals'];
    if (pieceSubs.some((s) => everydaySubs.includes(s))) {
      score += 0.8;
    }
  }

  // Contextual footwear pairing for saree
  if (pieceSubs.includes('saree')) {
    if (pieceSubs.some((s) => ['juttis', 'kolhapuris', 'heels', 'flats', 'sandals'].includes(s))) {
      score += 0.6;
    } else if (pieceSubs.includes('sneakers')) {
      score -= 1.2;
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
