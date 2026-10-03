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

  // Formality consistency
  const avg = pieces.reduce((a, x) => a + x.formality, 0) / pieces.length;
  const isHighFormality = ['office', 'wedding guest', 'Diwali', 'puja'].includes(occasion);
  const target = isHighFormality ? 4 : 2.5;
  score -= Math.abs(avg - target) * 1.5;

  // Favorite bonus
  score += pieces.filter((x) => x.favorite).length * 0.7;

  // Recent wear penalty
  score -= pieces.reduce((a, x) => a + Math.min(x.timesWorn, 6), 0) * 0.08;

  // Controlled seed randomness
  score += (seed - 0.5) * 0.5;

  return score;
};

export const generateOutfitWhy = (score: number): string => {
  if (score > 4) return 'Balanced colors with a strong, versatile base.';
  if (score > 1) return 'Easy color pairing with consistent formality.';
  return 'A relaxed mix with a simple focal piece.';
};
