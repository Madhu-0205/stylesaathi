import { useState, useMemo, useCallback } from 'react';
import { useWardrobeContext } from '../context/WardrobeContext';
import { useWeather } from '../context/WeatherContext';
import { Occasion, Season, GeneratedOutfit, WardrobeItem, RejectionReason, ContextSnapshot } from '../types';
import { generateOutfits, deriveSeasonalContext } from '../engine';

export function useDressMe(providedContext?: ContextSnapshot) {
  const {
    items,
    preferences,
    styleProfile,
    recordSignal,
    updateItem,
    saveOutfit,
    markOutfitWornOnDate,
  } = useWardrobeContext();

  let weatherContext: ReturnType<typeof useWeather> | null = null;
  try {
    weatherContext = useWeather();
  } catch {
    // Graceful fallback if called outside WeatherProvider
  }

  const [occasion, setOccasion] = useState<Occasion>('college');
  const [season, setSeason] = useState<Season>(() => {
    return deriveSeasonalContext(new Date(), weatherContext?.weather);
  });
  const [seed, setSeed] = useState<number>(() => Math.random());
  const [activeAccessories, setActiveAccessories] = useState<Record<number, WardrobeItem | null>>({});

  const contextSnapshot = useMemo(() => {
    if (providedContext) return providedContext;
    if (weatherContext) {
      return weatherContext.getContextForOccasion(occasion);
    }
    return undefined;
  }, [providedContext, weatherContext, occasion]);

  // Generate 2-4 outfits for chosen occasion & season with personal style preferences, learned brain profile, and climate context
  const outfits = useMemo(() => {
    return generateOutfits(items, occasion, season, 4, seed, preferences, styleProfile, contextSnapshot);
  }, [items, occasion, season, seed, preferences, styleProfile, contextSnapshot]);

  // Clean accessories available in wardrobe
  const availableAccessories = useMemo(() => {
    return items.filter((i) => i.category === 'Accessories' && i.status === 'clean');
  }, [items]);

  // Shuffle generates another valid combination and registers a weak skipped signal
  const shuffle = useCallback(() => {
    setSeed(Math.random());
    setActiveAccessories({});
  }, []);

  // Reject an outfit look with structured reason or lightweight dismissal
  const rejectOutfit = useCallback(
    async (outfit: GeneratedOutfit, reason?: RejectionReason) => {
      const pieceIds = Object.values(outfit.slots).flat().map((p) => p.id);
      await recordSignal({
        signalType: reason ? 'rejected' : 'dismissed',
        itemIds: pieceIds,
        occasion,
        season,
        rejectionReason: reason,
      });
      // Re-seed to immediately re-rank and surface next best look
      setSeed(Math.random());
    },
    [occasion, season, recordSignal]
  );

  // Attach or remove accessory from specific outfit index
  const setOutfitAccessory = useCallback((outfitIndex: number, accessory: WardrobeItem | null) => {
    setActiveAccessories((prev) => ({
      ...prev,
      [outfitIndex]: prev[outfitIndex]?.id === accessory?.id ? null : accessory,
    }));
  }, []);

  // Mark all pieces in outfit as worn today (increments timesWorn, records lastWorn, and emits wear signal)
  const markWoreOutfit = useCallback(
    async (outfit: GeneratedOutfit, accessory?: WardrobeItem | null) => {
      const todayStr = new Date().toISOString().split('T')[0];
      if (markOutfitWornOnDate) {
        await markOutfitWornOnDate(outfit, todayStr, accessory);
      } else {
        const allPieces = Object.values(outfit.slots).flat();
        if (accessory) {
          allPieces.push(accessory);
        }
        const now = Date.now();
        for (const piece of allPieces) {
          await updateItem(piece.id, {
            timesWorn: (piece.timesWorn || 0) + 1,
            lastWorn: now,
          });
        }
        await recordSignal({
          signalType: 'worn',
          itemIds: allPieces.map((p) => p.id),
          occasion,
          season,
        });
      }
    },
    [markOutfitWornOnDate, occasion, recordSignal, season, updateItem]
  );

  // Granular explanation of empty & edge states
  const emptyStateInfo = useMemo(() => {
    if (outfits.length > 0) return null;

    if (items.length === 0) {
      return {
        title: 'Your wardrobe is empty',
        description: 'Add your clothing pieces to start generating personalized outfit recommendations.',
        actionLabel: 'Open Wardrobe',
      };
    }

    const occasionItems = items.filter((i) => i.occasions.includes(occasion));
    const cleanOccasionItems = occasionItems.filter((i) => i.status === 'clean');

    if (occasionItems.length > 0 && cleanOccasionItems.length === 0) {
      return {
        title: 'All matching pieces are in laundry',
        description: `You have ${occasionItems.length} pieces tagged for ${occasion}, but they are currently in laundry or need washing. Mark them clean to unlock outfits.`,
        actionLabel: 'Manage Laundry',
      };
    }

    if (occasionItems.length === 0) {
      return {
        title: `No pieces tagged for ${occasion}`,
        description: `None of your current wardrobe pieces are tagged for ${occasion}. Update your item occasions or add new pieces in your wardrobe.`,
        actionLabel: 'View Wardrobe',
      };
    }

    const hasCleanFootwear = items.some(
      (i) => i.category === 'Footwear' && i.status === 'clean' && i.occasions.includes(occasion)
    );
    if (!hasCleanFootwear) {
      return {
        title: 'Clean footwear needed',
        description: `StyleSaathi builds complete ensembles. Add clean footwear suitable for ${occasion} to generate outfits.`,
        actionLabel: 'Add Footwear',
      };
    }

    const hasSaree = cleanOccasionItems.some((i) => i.subcategory === 'saree');
    const hasBlouse = cleanOccasionItems.some(
      (i) =>
        i.subcategory === 'blouse' ||
        (['crop top', 'top'].includes(i.subcategory) && i.formality >= 3)
    );
    if (hasSaree && !hasBlouse && cleanOccasionItems.length <= 3) {
      return {
        title: 'Saree requires a matching blouse',
        description: 'A complete saree look requires a blouse. Add a blouse to style your saree.',
        actionLabel: 'Add Blouse',
      };
    }

    const hasTop = cleanOccasionItems.some(
      (i) =>
        i.category === 'Tops' ||
        (i.category === 'Ethnic' && ['kurta', 'kurti', 'anarkali'].includes(i.subcategory)) ||
        i.category === 'Dresses'
    );
    const hasBottom = cleanOccasionItems.some(
      (i) =>
        i.category === 'Bottoms' ||
        (i.category === 'Ethnic' &&
          ['palazzo', 'churidar', 'salwar', 'pajama', 'leggings'].includes(i.subcategory))
    );

    if (!hasTop) {
      return {
        title: 'No compatible top found',
        description: `You have bottoms for ${occasion}, but no clean tops or kurtas. Add a top to complete the look.`,
        actionLabel: 'Add Top',
      };
    }

    if (
      !hasBottom &&
      !cleanOccasionItems.some((i) =>
        ['saree', 'anarkali', 'western dress', 'dress', 'salwar set'].includes(i.subcategory)
      )
    ) {
      return {
        title: 'No compatible bottom found',
        description: `You have tops for ${occasion}, but no clean matching bottoms. Add jeans, trousers, or ethnic bottoms.`,
        actionLabel: 'Add Bottom',
      };
    }

    return {
      title: 'No compatible combination for this look',
      description: `Your available clean pieces for ${occasion} in ${season} do not align with any outfit silhouette. Try another occasion or adjust clothing tags.`,
      actionLabel: 'Open Wardrobe',
    };
  }, [items, occasion, season, outfits.length]);

  return {
    occasion,
    setOccasion,
    season,
    setSeason,
    outfits,
    emptyStateInfo,
    shuffle,
    availableAccessories,
    activeAccessories,
    setOutfitAccessory,
    markWoreOutfit,
    saveOutfit,
    rejectOutfit,
    contextSnapshot,
  };
}
