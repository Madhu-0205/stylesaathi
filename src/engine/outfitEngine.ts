import { WardrobeItem, Occasion, GeneratedOutfit, Season, StylePreferences } from '../types';
import { TEMPLATES } from './outfitTemplates';
import { compatible, occasionFit, seasonFit } from './compatibility';
import { calculateOutfitScore, generateOutfitWhy } from './scoring';

export function generateOutfits(
  items: WardrobeItem[],
  occasion: Occasion,
  season: Season,
  limit = 4,
  seed = Math.random(),
  preferences?: StylePreferences
): GeneratedOutfit[] {
  // Never suggest laundry items or items needing washing
  const eligible = items.filter(
    (i) => i.status === 'clean' && seasonFit(i, season) && occasionFit(i, occasion)
  );

  const occasionTemplates = TEMPLATES.filter((t) => {
    if (t.name === 'Indo-western') {
      return ['college', 'casual outing', 'everyday', 'date', 'travel', 'party'].includes(occasion);
    }
    if (t.name === 'Indo-western tailored') {
      return ['office', 'date', 'party', 'college', 'casual outing', 'family function', 'family gathering'].includes(occasion);
    }
    if (t.name === 'Kurta & Nehru jacket') {
      return ['wedding guest', 'celebration', 'festive', 'Diwali', 'Eid', 'family function', 'family gathering', 'puja'].includes(occasion);
    }
    if (t.name === 'Tailored Western') {
      return ['office', 'interview', 'date', 'party', 'family function', 'family gathering', 'celebration'].includes(occasion);
    }
    if (t.name === 'Lehenga ensemble') {
      return ['wedding guest', 'celebration', 'festive', 'Diwali', 'family function'].includes(occasion);
    }
    if (t.name === 'Kurta with dupatta') {
      return [
        'puja',
        'festive',
        'wedding guest',
        'celebration',
        'Diwali',
        'Eid',
        'family function',
        'family gathering',
        'office',
        'college',
        'everyday',
      ].includes(occasion);
    }
    if (t.name === 'Western dress') {
      return !['puja', 'wedding guest'].includes(occasion);
    }
    return true;
  });

  const results: GeneratedOutfit[] = [];

  for (const t of occasionTemplates) {
    const slots: Record<string, WardrobeItem[]> = {};

    for (const [slot] of Object.entries(t.required)) {
      slots[slot] = eligible.filter((i) => compatible(slot, i, t));
    }

    for (const [slot] of Object.entries(t.optional)) {
      slots[slot] = eligible.filter((i) => compatible(slot, i, t));
    }

    // Required slot cannot be empty
    if (Object.keys(t.required).some((k) => slots[k]?.length === 0)) {
      continue;
    }

    const keys = Object.keys(t.required);
    const combos = (
      idx: number,
      chosen: Record<string, WardrobeItem[]>
    ): Record<string, WardrobeItem[]>[] => {
      if (idx === keys.length) return [chosen];
      const k = keys[idx];
      return slots[k]
        .slice(0, 8)
        .flatMap((i) => combos(idx + 1, { ...chosen, [k]: [i] }));
    };

    for (const c of combos(0, {})) {
      const all = Object.values(c).flat();
      // Ensure no duplicate items across slots
      if (new Set(all.map((x) => x.id)).size !== all.length) continue;

      const score = calculateOutfitScore(all, occasion, seed, preferences);
      const why = generateOutfitWhy(all, occasion, score, preferences);

      results.push({
        template: t.name,
        slots: c,
        score,
        why,
      });
    }
  }

  const sorted = results.sort((a, b) => b.score - a.score);
  const out: GeneratedOutfit[] = [];
  const main = (o: GeneratedOutfit) => Object.values(o.slots)[0]?.[0]?.id;

  for (const o of sorted) {
    if (!out.some((x) => main(x) === main(o))) {
      out.push(o);
    }
  }

  return out.slice(0, limit);
}

export const signature = (o: GeneratedOutfit): string =>
  Object.values(o.slots)
    .flat()
    .map((i) => i.id)
    .sort()
    .join('|');

export function simulateBuy(
  items: WardrobeItem[],
  candidate: WardrobeItem,
  occasionList: Occasion[],
  season: Season
): number {
  const before = new Set(
    occasionList.flatMap((o) => generateOutfits(items, o, season, 100, 0).map((o) => signature(o)))
  );
  const after = new Set(
    occasionList.flatMap((o) =>
      generateOutfits([...items, candidate], o, season, 100, 0).map((o) => signature(o))
    )
  );

  return [...after].filter((x) => !before.has(x)).length;
}
