import { useMemo, useState, useEffect } from 'react';
import { useWardrobeContext } from '../context/WardrobeContext';
import { wearEventsRepository } from '../repositories/LocalStorageWearEventsRepository';
import { WearEvent } from '../types';
import {
  computeWearAnalytics,
  WearAnalyticsReport,
  StyleSnapshot,
} from '../engine/analytics';

export type AnalyticsTimeframe = '7d' | '30d' | '90d' | 'all';

export function useWearAnalytics(
  injectedReferenceTimestamp?: number,
  injectedWearEvents?: WearEvent[]
) {
  const { items } = useWardrobeContext();
  const [loadedWearEvents, setLoadedWearEvents] = useState<WearEvent[]>(injectedWearEvents || []);
  const [selectedTimeframe, setSelectedTimeframe] = useState<AnalyticsTimeframe>('30d');

  useEffect(() => {
    if (injectedWearEvents) {
      setLoadedWearEvents(injectedWearEvents);
      return;
    }
    let mounted = true;
    wearEventsRepository.getEvents().then((events) => {
      if (mounted) {
        setLoadedWearEvents(events || []);
      }
    });
    return () => {
      mounted = false;
    };
  }, [items, injectedWearEvents]);

  // Compute reference timestamp once (or use injected)
  const referenceTimestamp = useMemo(() => {
    return injectedReferenceTimestamp || Date.now();
  }, [injectedReferenceTimestamp]);

  const wearEvents = injectedWearEvents || loadedWearEvents;

  // Compute complete WearAnalyticsReport deterministically
  const report: WearAnalyticsReport = useMemo(() => {
    return computeWearAnalytics(items, wearEvents, referenceTimestamp);
  }, [items, wearEvents, referenceTimestamp]);

  // Map selected timeframe to corresponding StyleSnapshot
  const activeSnapshot: StyleSnapshot = useMemo(() => {
    switch (selectedTimeframe) {
      case '7d':
        return report.snapshots.weekly_7d;
      case '30d':
        return report.snapshots.recent_30d;
      case '90d':
        return report.snapshots.baseline_60d;
      case 'all':
      default:
        return report.snapshots.all_time;
    }
  }, [report, selectedTimeframe]);

  return {
    report,
    selectedTimeframe,
    setSelectedTimeframe,
    activeSnapshot,
    referenceTimestamp,
    rotation: report.rotation,
    concentration: report.concentration,
    evolution: report.evolution,
    mostWornItems: report.mostWornItems,
    dormantItems: report.dormantItems,
    orphans: report.orphans,
  };
}
