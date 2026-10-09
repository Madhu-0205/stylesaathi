import { useState, useMemo, useCallback } from 'react';
import { useWardrobeContext } from '../context/WardrobeContext';
import { useWeather } from '../context/WeatherContext';
import {
  WardrobeItem,
  Occasion,
  Season,
  ContextSnapshot,
  RecommendedOutfit,
  MissingOutfitRequirement,
  RejectionReason,
  GeneratedOutfit,
} from '../types';
import { recommendOutfitsWithTelemetry, deriveSeasonalContext } from '../engine';

export interface UseStyleThisItemResult {
  anchorItem: WardrobeItem | null;
  occasion: Occasion;
  setOccasion: (occ: Occasion) => void;
  season: Season;
  outfits: RecommendedOutfit[];
  activeOutfit: RecommendedOutfit | null;
  activeRoleIndex: number;
  setActiveRoleIndex: (idx: number) => void;
  missingRequirements: MissingOutfitRequirement[] | null;
  laundryWarning: string | null;
  isLoading: boolean;
  shuffle: () => void;
  woreToday: (outfit: GeneratedOutfit) => Promise<void>;
  saveLook: (outfit: GeneratedOutfit) => Promise<void>;
  rejectLook: (outfit: GeneratedOutfit, reason?: RejectionReason) => Promise<void>;
}

export function useStyleThisItem(
  anchorItem: WardrobeItem | null,
  providedContext?: ContextSnapshot
): UseStyleThisItemResult {
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

  // Smart occasion default: preferentially use anchor's primary occasion if defined
  const initialOccasion = useMemo<Occasion>(() => {
    if (anchorItem && anchorItem.occasions && anchorItem.occasions.length > 0) {
      return anchorItem.occasions[0];
    }
    return 'college';
  }, [anchorItem]);

  const [occasion, setOccasion] = useState<Occasion>(initialOccasion);
  const [explorationSeedOffset, setExplorationSeedOffset] = useState<number>(0);
  const [activeRoleIndex, setActiveRoleIndex] = useState<number>(0);

  const season = useMemo<Season>(() => {
    return deriveSeasonalContext(new Date(), weatherContext?.weather);
  }, [weatherContext]);

  const contextSnapshot = useMemo(() => {
    if (providedContext) return providedContext;
    if (weatherContext) {
      return weatherContext.getContextForOccasion(occasion);
    }
    return undefined;
  }, [providedContext, weatherContext, occasion]);

  const localDate = useMemo(() => {
    return contextSnapshot?.date || new Date().toISOString().split('T')[0];
  }, [contextSnapshot]);

  // Explicit Laundry Policy check for the anchor item
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

  // Compute anchor-constrained recommendation
  const recommendationResult = useMemo(() => {
    if (!anchorItem) {
      return null;
    }

    return recommendOutfitsWithTelemetry({
      items,
      occasion,
      season,
      localDate,
      explorationSeedOffset,
      preferences,
      styleProfile,
      context: contextSnapshot,
      limit: 3,
      anchorItemId: anchorItem.id,
    });
  }, [
    anchorItem,
    items,
    occasion,
    season,
    localDate,
    explorationSeedOffset,
    preferences,
    styleProfile,
    contextSnapshot,
  ]);

  const outfits = useMemo(() => {
    return recommendationResult?.set.outfits || [];
  }, [recommendationResult]);

  const missingRequirements = useMemo(() => {
    return recommendationResult?.set.missingRequirements || null;
  }, [recommendationResult]);

  const activeOutfit = useMemo(() => {
    if (outfits.length === 0) return null;
    return outfits[activeRoleIndex] || outfits[0] || null;
  }, [outfits, activeRoleIndex]);

  // Deterministically cycle candidate pool around the anchor
  const shuffle = useCallback(() => {
    setExplorationSeedOffset((prev) => prev + 1);
  }, []);

  // Reject outfit with structured feedback and increment offset
  const rejectLook = useCallback(
    async (outfit: GeneratedOutfit, reason?: RejectionReason) => {
      const pieceIds = Object.values(outfit.slots).flat().map((p) => p.id);
      await recordSignal({
        signalType: reason ? 'rejected' : 'dismissed',
        itemIds: pieceIds,
        occasion,
        season,
        rejectionReason: reason,
      });
      setExplorationSeedOffset((prev) => prev + 1);
    },
    [occasion, season, recordSignal]
  );

  // Wear Today action
  const woreToday = useCallback(
    async (outfit: GeneratedOutfit) => {
      const todayStr = new Date().toISOString().split('T')[0];
      if (markOutfitWornOnDate) {
        await markOutfitWornOnDate(outfit, todayStr);
      } else {
        const allPieces = Object.values(outfit.slots).flat();
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
    [markOutfitWornOnDate, occasion, season, updateItem, recordSignal]
  );

  // Save outfit look
  const handleSaveLook = useCallback(
    async (outfit: GeneratedOutfit) => {
      if (saveOutfit) {
        await saveOutfit(outfit);
      }
    },
    [saveOutfit]
  );

  return {
    anchorItem,
    occasion,
    setOccasion,
    season,
    outfits,
    activeOutfit,
    activeRoleIndex,
    setActiveRoleIndex,
    missingRequirements,
    laundryWarning,
    isLoading: false,
    shuffle,
    woreToday,
    saveLook: handleSaveLook,
    rejectLook,
  };
}
