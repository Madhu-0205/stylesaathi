import { useState, useMemo, useCallback } from 'react';
import { useWardrobeContext } from '../context/WardrobeContext';
import { useWeather } from '../context/WeatherContext';
import { Occasion, Season, GeneratedOutfit, WardrobeItem, RejectionReason, ContextSnapshot, MissingOutfitRequirement, StylePreferences } from '../types';
import { recommendOutfitsWithTelemetry, deriveSeasonalContext } from '../engine';
import { validateOutfitWearability } from '../engine/hardConstraints';

export type StylingAestheticId =
  | 'all'
  | 'minimalist'
  | 'indo_western'
  | 'contemporary_casual'
  | 'traditional'
  | 'office_tailored'
  | 'streetwear'
  | 'festive';

export interface StylingAestheticOption {
  id: StylingAestheticId;
  label: string;
  mappedAesthetics: string[];
  description: string;
}

export const STYLING_AESTHETICS: StylingAestheticOption[] = [
  {
    id: 'all',
    label: 'All Aesthetics',
    mappedAesthetics: [],
    description: 'Curate across all aesthetic expressions',
  },
  {
    id: 'minimalist',
    label: 'Minimalist & Quiet Luxury',
    mappedAesthetics: ['Minimal', 'Classic'],
    description: 'Clean unembellished lines, tonal balance, and quiet refinement',
  },
  {
    id: 'indo_western',
    label: 'Indo-Western',
    mappedAesthetics: ['Indo-Western'],
    description: 'Seamless fusion of ethnic silhouettes with contemporary western pieces',
  },
  {
    id: 'contemporary_casual',
    label: 'Contemporary Casual',
    mappedAesthetics: ['Casual', 'Relaxed'],
    description: 'Effortless everyday styling built for modern daily movement',
  },
  {
    id: 'traditional',
    label: 'Indian Traditional',
    mappedAesthetics: ['Traditional', 'Ethnic-loving'],
    description: 'Heritage handlooms, classic drapes, and celebratory elegance',
  },
  {
    id: 'office_tailored',
    label: 'Office & Tailored',
    mappedAesthetics: ['Classic'],
    description: 'Sharp structures, tailored silhouettes, and professional confidence',
  },
  {
    id: 'streetwear',
    label: 'Streetwear',
    mappedAesthetics: ['Streetwear', 'Relaxed'],
    description: 'Urban silhouettes, relaxed layering, and sneaker-led styling',
  },
  {
    id: 'festive',
    label: 'Festive & Celebration',
    mappedAesthetics: ['Traditional', 'Statement'],
    description: 'Rich celebratory palettes, metallic accents, and festive grandeur',
  },
];

export type FormalityPreference = 'auto' | 'relaxed' | 'balanced' | 'elevated';

export function useDressMe(providedContext?: ContextSnapshot, allowPlanningMode: boolean = false) {
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
  const [anchorItem, setAnchorItem] = useState<WardrobeItem | null>(null);
  const [explorationSeedOffset, setExplorationSeedOffset] = useState<number>(0);
  const [activeAccessories, setActiveAccessories] = useState<Record<number, WardrobeItem | null>>({});

  // Styling brief studio controls: Aesthetic & Formality preferences
  const [selectedAesthetic, setSelectedAesthetic] = useState<StylingAestheticId>('all');
  const [formalityPreference, setFormalityPreference] = useState<FormalityPreference>('auto');

  const contextSnapshot = useMemo(() => {
    if (providedContext) return providedContext;
    if (weatherContext) {
      return weatherContext.getContextForOccasion(occasion);
    }
    return undefined;
  }, [providedContext, weatherContext, occasion]);

  const isWeatherUnavailable = useMemo(() => {
    if (!weatherContext?.weather) return true;
    if (contextSnapshot?.source === 'unavailable' || contextSnapshot?.source === 'simulated') return true;
    return false;
  }, [weatherContext, contextSnapshot]);

  const localDate = useMemo(() => {
    return contextSnapshot?.date || new Date().toISOString().split('T')[0];
  }, [contextSnapshot]);

  // Formality numerical target
  const targetFormality = useMemo<number | undefined>(() => {
    switch (formalityPreference) {
      case 'relaxed':
        return 1.8;
      case 'balanced':
        return 3.0;
      case 'elevated':
        return 4.5;
      case 'auto':
      default:
        return undefined;
    }
  }, [formalityPreference]);

  // Merge selected styling brief aesthetic into effective preferences
  const effectivePreferences = useMemo<StylePreferences | undefined>(() => {
    if (selectedAesthetic === 'all') return preferences;
    const option = STYLING_AESTHETICS.find((a) => a.id === selectedAesthetic);
    if (!option || option.mappedAesthetics.length === 0) return preferences;

    const baseAesthetics = preferences?.preferredAesthetics || [];
    const combined = Array.from(new Set([...option.mappedAesthetics, ...baseAesthetics]));
    return {
      ...(preferences || {
        preferredContexts: [],
        preferredAesthetics: [],
        stylingMode: 'variety',
        updatedAt: Date.now(),
      }),
      preferredAesthetics: combined,
    } as StylePreferences;
  }, [preferences, selectedAesthetic]);

  // Recent worn pieces lookback (anti-repetition penalty)
  const recentWornItemIds = useMemo(() => {
    const twoDaysAgo = Date.now() - 48 * 3600 * 1000;
    return items
      .filter((i) => (i.lastWorn && i.lastWorn > twoDaysAgo) || (i.timesWorn && i.timesWorn > 0))
      .map((i) => i.id);
  }, [items]);

  // Check laundry status for anchor item
  const laundryWarning = useMemo<string | null>(() => {
    if (!anchorItem) return null;
    if (anchorItem.status === 'needs_washing') {
      return 'Needs Washing · Clean before wearing today';
    }
    if (anchorItem.status === 'in_laundry') {
      return 'In Laundry · Clean before wearing today';
    }
    return null;
  }, [anchorItem]);

  // Generate top-4 curated recommendations (Best Match, Alternative, Explore, Underused) with Recommendation Engine 2.0
  const recommendationResult = useMemo(() => {
    return recommendOutfitsWithTelemetry({
      items,
      occasion,
      season,
      localDate,
      explorationSeedOffset,
      preferences: effectivePreferences,
      styleProfile,
      context: contextSnapshot,
      limit: 4,
      anchorItemId: anchorItem?.id,
      allowPlanningMode,
      targetFormality,
      recentWornItemIds,
    });
  }, [
    items,
    occasion,
    season,
    localDate,
    explorationSeedOffset,
    effectivePreferences,
    styleProfile,
    contextSnapshot,
    anchorItem,
    allowPlanningMode,
    targetFormality,
    recentWornItemIds,
  ]);

  const outfits = useMemo(() => {
    return recommendationResult.set.outfits || [];
  }, [recommendationResult]);

  const missingRequirements = useMemo<MissingOutfitRequirement[]>(() => {
    return recommendationResult.set.missingRequirements || [];
  }, [recommendationResult]);

  // Clean accessories available in wardrobe
  const availableAccessories = useMemo(() => {
    return items.filter((i) => i.category === 'Accessories' && i.status === 'clean');
  }, [items]);

  // Shuffle increments deterministic exploration seed offset and registers a weak skipped signal
  const shuffle = useCallback(() => {
    setExplorationSeedOffset((prev) => prev + 1);
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
      // Increment seed offset to deterministically cycle to next alternative/explore look
      setExplorationSeedOffset((prev) => prev + 1);
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
        const wearCheck = validateOutfitWearability(outfit, accessory);
        if (!wearCheck.canWear) {
          throw new Error(wearCheck.error);
        }
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

    if (missingRequirements.length > 0) {
      const primaryMissing = missingRequirements[0];
      let actionLabel = 'Add Items';
      let title = primaryMissing.templateName || 'Wardrobe requirement missing';

      if (primaryMissing.templateId === 'unwashed_anchor') {
        title = 'Anchor Item Unavailable';
        actionLabel = 'Manage Laundry';
      } else if (primaryMissing.missingRole === 'footwear') {
        title = 'Clean footwear needed';
        actionLabel = 'Add Footwear';
      } else if (primaryMissing.missingRole === 'bottom') {
        title = 'No compatible bottom found';
        actionLabel = 'Add Bottom';
      } else if (primaryMissing.missingRole === 'top') {
        const isSareeAnchor =
          anchorItem?.subcategory === 'saree' ||
          primaryMissing.templateName?.toLowerCase().includes('saree');
        title = isSareeAnchor ? 'Saree requires a matching blouse' : 'No compatible top found';
        actionLabel = isSareeAnchor ? 'Add Blouse' : 'Add Top';
      } else if (anchorItem) {
        actionLabel = 'Clear Anchor';
      }

      return {
        title,
        description: primaryMissing.explanation,
        actionLabel,
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

    if (anchorItem) {
      return {
        title: `No matching looks for ${anchorItem.name}`,
        description: `StyleSaathi could not build a complete ensemble around this piece for ${occasion} in ${season}. Try changing the occasion or clear the anchor to explore other pieces.`,
        actionLabel: 'Clear Anchor',
      };
    }

    return {
      title: 'No compatible combination for this look',
      description: `Your available clean pieces for ${occasion} in ${season} do not align with any outfit silhouette. Try another occasion or adjust clothing tags.`,
      actionLabel: 'Open Wardrobe',
    };
  }, [items, occasion, season, outfits.length, anchorItem, missingRequirements]);

  return {
    occasion,
    setOccasion,
    season,
    setSeason,
    outfits,
    missingRequirements,
    emptyStateInfo,
    shuffle,
    availableAccessories,
    activeAccessories,
    setOutfitAccessory,
    markWoreOutfit,
    saveOutfit,
    rejectOutfit,
    contextSnapshot,
    anchorItem,
    setAnchorItem,
    laundryWarning,
    selectedAesthetic,
    setSelectedAesthetic,
    formalityPreference,
    setFormalityPreference,
    isWeatherUnavailable,
    STYLING_AESTHETICS,
  };
}
