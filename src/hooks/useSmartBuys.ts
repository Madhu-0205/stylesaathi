import { useMemo } from 'react';
import { useWardrobeContext } from '../context/WardrobeContext';
import { Season, Category, Occasion, SmartBuyRecommendation, GeneratedOutfit } from '../types';
import { simulateBuy, generateOutfits, signature } from '../engine';
import { candidates } from '../data/candidates';
import { CATEGORIES, OCCASIONS } from '../data/taxonomy';

export function useSmartBuys(season: Season = 'summer') {
  const { items } = useWardrobeContext();

  // Category distribution
  const categoryBalance = useMemo(() => {
    const total = Math.max(1, items.length);
    return CATEGORIES.map((cat) => {
      const catItems = items.filter((i) => i.category === cat);
      return {
        category: cat,
        count: catItems.length,
        percentage: Math.round((catItems.length / total) * 100),
        sampleItem: catItems[0] || null,
      };
    });
  }, [items]);

  // Occasion coverage calculated from real outfit engine
  const occasionCoverage = useMemo(() => {
    return OCCASIONS.map((occ) => {
      const possible = generateOutfits(items, occ, season, 1);
      return {
        occasion: occ,
        isCovered: possible.length > 0,
        outfitCount: possible.length,
      };
    });
  }, [items, season]);

  // Candidate purchases simulation ranked by new outfits unlocked
  const smartBuys = useMemo<SmartBuyRecommendation[]>(() => {
    if (items.length === 0) return [];

    const candidateList = candidates(season);
    const baselineSignatures = new Set(
      OCCASIONS.flatMap((o) =>
        generateOutfits(items, o, season, 50, 0).map((outfit) => signature(outfit))
      )
    );

    const recommendations: SmartBuyRecommendation[] = [];

    for (const cand of candidateList) {
      const delta = simulateBuy(items, cand, OCCASIONS, season);
      if (delta > 0) {
        // Calculate preview outfits that specifically include the candidate
        const simulatedOutfits = OCCASIONS.flatMap((o) =>
          generateOutfits([...items, cand], o, season, 2, 0)
        );
        const unlockedPreviews: GeneratedOutfit[] = [];
        for (const out of simulatedOutfits) {
          if (!baselineSignatures.has(signature(out))) {
            const hasCand = Object.values(out.slots)
              .flat()
              .some((p) => p.id === cand.id);
            if (hasCand && !unlockedPreviews.some((u) => signature(u) === signature(out))) {
              unlockedPreviews.push(out);
            }
          }
          if (unlockedPreviews.length >= 3) break;
        }

        // Find existing wardrobe pieces that pair with this candidate
        const compatibleItems = items.filter(
          (i) =>
            i.status === 'clean' &&
            (cand.category === 'Bottoms'
              ? i.category === 'Tops' || i.category === 'Ethnic'
              : cand.category === 'Tops'
              ? i.category === 'Bottoms'
              : cand.category === 'Ethnic'
              ? i.category === 'Bottoms' || i.category === 'Ethnic'
              : true)
        ).slice(0, 4);

        recommendations.push({
          candidate: cand,
          baselineOutfitCount: baselineSignatures.size,
          simulatedOutfitCount: baselineSignatures.size + delta,
          newOutfitsUnlocked: delta,
          compatibleExistingItems: compatibleItems,
          previewOutfits: unlockedPreviews,
          reason: cand.note || 'Fills a versatile wardrobe gap across Indian occasions.',
        });
      }
    }

    return recommendations.sort((a, b) => b.newOutfitsUnlocked - a.newOutfitsUnlocked);
  }, [items, season]);

  // Insight summary
  const insight = useMemo(() => {
    const topCount = items.filter((i) => i.category === 'Tops').length;
    const bottomCount = items.filter((i) => i.category === 'Bottoms').length;
    const ethnicCount = items.filter((i) => i.category === 'Ethnic').length;

    if (items.length < 5) {
      return 'Add at least 5-8 pieces to unlock meaningful wardrobe gap insights.';
    }

    if (topCount > bottomCount * 2) {
      return `You have ${topCount} tops but only ${bottomCount} bottoms. Adding versatile bottoms will unlock the highest number of new outfit combinations.`;
    }

    if (ethnicCount < 3) {
      return 'Your wardrobe is western-heavy. Adding a versatile kurta or dupatta will unlock traditional festive looks for Diwali and pujas.';
    }

    return 'Your wardrobe has a solid baseline. Check the smart recommendations below to unlock even more versatility.';
  }, [items]);

  return {
    categoryBalance,
    occasionCoverage,
    smartBuys,
    insight,
  };
}
