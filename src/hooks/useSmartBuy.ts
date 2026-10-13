import { useMemo } from 'react';
import { useWardrobeContext } from '../context/WardrobeContext';
import { useWearAnalytics } from './useWearAnalytics';
import { useWeather } from '../context/WeatherContext';
import { computeWardrobeGaps } from '../engine/smartBuy';
import {
  WardrobeGapReport,
  WardrobeItem,
  OutfitPlan,
  PersonalStyleProfile,
  StylePreferences,
  ContextSnapshot,
} from '../types';
import { WearAnalyticsReport } from '../engine/analytics/types';

export interface UseSmartBuyOptions {
  referenceTimestamp?: number;
  injectedWardrobe?: WardrobeItem[];
  injectedWearAnalytics?: WearAnalyticsReport;
  injectedPlans?: OutfitPlan[];
  injectedStyleProfile?: PersonalStyleProfile;
  injectedPreferences?: StylePreferences;
  injectedContextSnapshot?: ContextSnapshot;
}

export function useSmartBuy(options?: UseSmartBuyOptions) {
  const {
    items: contextItems,
    preferences: contextPreferences,
    plans: contextPlans,
    styleProfile: contextStyleProfile,
  } = useWardrobeContext();

  const referenceTimestamp = useMemo(() => {
    return options?.referenceTimestamp ?? Date.now();
  }, [options?.referenceTimestamp]);

  const { report: contextWearAnalytics } = useWearAnalytics(referenceTimestamp);

  let weatherContext: ReturnType<typeof useWeather> | null = null;
  try {
    weatherContext = useWeather();
  } catch {
    // Graceful fallback when outside WeatherProvider
  }

  const wardrobe = options?.injectedWardrobe ?? contextItems;
  const wearAnalytics = options?.injectedWearAnalytics ?? contextWearAnalytics;
  const outfitPlans = options?.injectedPlans ?? contextPlans;
  const styleProfile = options?.injectedStyleProfile ?? contextStyleProfile;
  const stylePreferences = options?.injectedPreferences ?? contextPreferences;
  const contextSnapshot =
    options?.injectedContextSnapshot ??
    (weatherContext ? weatherContext.getContextForOccasion('everyday') : undefined);

  const report: WardrobeGapReport = useMemo(() => {
    return computeWardrobeGaps({
      wardrobe,
      wearAnalytics,
      outfitPlans,
      styleProfile,
      stylePreferences,
      contextSnapshot,
      referenceTimestamp,
    });
  }, [
    wardrobe,
    wearAnalytics,
    outfitPlans,
    styleProfile,
    stylePreferences,
    contextSnapshot,
    referenceTimestamp,
  ]);

  return {
    report,
    dataSufficiency: report.dataSufficiency,
    gaps: report.gaps,
    purchaseAssessment: report.purchaseAssessment,
    coverageSummary: report.coverageSummary,
    negativeEvidence: report.negativeEvidence,
  };
}
