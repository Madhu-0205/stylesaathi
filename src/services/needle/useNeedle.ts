import { useState, useEffect, useCallback } from 'react';
import { needleService, NeedleDomainContext } from './needleService';
import { NeedleState, NeedleExecutionResult } from './needleTypes';
import { useWardrobeContext } from '../../context/WardrobeContext';

export function useNeedle() {
  const [state, setState] = useState<NeedleState>(needleService.getState());
  const wardrobe = useWardrobeContext();

  useEffect(() => {
    const unsubscribe = needleService.subscribe(setState);
    return () => unsubscribe();
  }, []);

  const getDomainContext = useCallback((): NeedleDomainContext => {
    return {
      items: wardrobe.items || [],
      preferences: wardrobe.preferences,
      plans: wardrobe.plans,
      savePlan: wardrobe.savePlan,
      updateItem: wardrobe.updateItem,
      markOutfitWornOnDate: wardrobe.markOutfitWornOnDate,
    };
  }, [
    wardrobe.items,
    wardrobe.preferences,
    wardrobe.plans,
    wardrobe.savePlan,
    wardrobe.updateItem,
    wardrobe.markOutfitWornOnDate,
  ]);

  const initialize = useCallback(
    async (options?: { modelUrl?: string; forceReload?: boolean }) => {
      return needleService.initialize(options);
    },
    []
  );

  const execute = useCallback(
    async (query: string): Promise<NeedleExecutionResult> => {
      return needleService.executeCommand(query, getDomainContext());
    },
    [getDomainContext]
  );

  const confirm = useCallback(
    async (actionId: string): Promise<NeedleExecutionResult> => {
      return needleService.confirmAction(actionId, getDomainContext());
    },
    [getDomainContext]
  );

  const cancel = useCallback((actionId: string) => {
    needleService.cancelAction(actionId);
  }, []);

  return {
    state,
    initialize,
    execute,
    confirm,
    cancel,
  };
}
