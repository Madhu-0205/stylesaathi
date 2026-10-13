import { useState, useCallback, useMemo } from 'react';
import { useWardrobeContext } from '../context/WardrobeContext';
import { useWeather } from '../context/WeatherContext';
import {
  SaathiConversationState,
  SaathiToolContext,
  ClarificationOption,
  createInitialConversationState,
  processSaathiTurn,
} from '../engine/saathi';

export function useSaathi(injectedTimestamp?: number) {
  const {
    items,
    preferences,
    styleProfile,
    plans,
    savePlan,
    markOutfitWornOnDate,
  } = useWardrobeContext();

  let weatherContext: ReturnType<typeof useWeather> | null = null;
  try {
    weatherContext = useWeather();
  } catch {
    // Graceful fallback outside WeatherProvider
  }

  const [conversationState, setConversationState] = useState<SaathiConversationState>(() =>
    createInitialConversationState(`saathi_${Date.now()}`)
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const referenceTimestamp = useMemo(() => {
    return injectedTimestamp ?? Date.now();
  }, [injectedTimestamp]);

  const localDate = useMemo(() => {
    const d = new Date(referenceTimestamp);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
  }, [referenceTimestamp]);

  const weatherSnapshot = useMemo(() => {
    return weatherContext ? weatherContext.getContextForOccasion('everyday') : null;
  }, [weatherContext]);

  const toolContext: SaathiToolContext = useMemo(() => {
    return {
      wardrobe: items,
      preferences,
      styleProfile,
      plans,
      weatherSnapshot,
      referenceTimestamp,
      localDate,
      onSavePlan: savePlan,
      onRecordWear: markOutfitWornOnDate,
    };
  }, [
    items,
    preferences,
    styleProfile,
    plans,
    weatherSnapshot,
    referenceTimestamp,
    localDate,
    savePlan,
    markOutfitWornOnDate,
  ]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;
      setIsLoading(true);
      setError(null);

      try {
        const response = await processSaathiTurn(text, conversationState, toolContext);
        setConversationState(response.updatedState);
      } catch (err: any) {
        console.error('[useSaathi] Turn execution error:', err);
        setError(err.message || 'An unexpected error occurred during orchestration.');
      } finally {
        setIsLoading(false);
      }
    },
    [conversationState, toolContext, isLoading]
  );

  const confirmAction = useCallback(async () => {
    if (!conversationState.pendingConfirmation || isLoading) return;
    await sendMessage('yes');
  }, [conversationState.pendingConfirmation, isLoading, sendMessage]);

  const cancelAction = useCallback(async () => {
    if (!conversationState.pendingConfirmation || isLoading) return;
    await sendMessage('no');
  }, [conversationState.pendingConfirmation, isLoading, sendMessage]);

  const selectClarificationOption = useCallback(
    async (option: ClarificationOption) => {
      if (!conversationState.pendingClarification || isLoading) return;
      await sendMessage(option.value);
    },
    [conversationState.pendingClarification, isLoading, sendMessage]
  );

  const resetConversation = useCallback(() => {
    setConversationState(createInitialConversationState(`saathi_${Date.now()}`));
    setError(null);
  }, []);

  return {
    state: conversationState,
    messages: conversationState.messages,
    activeIntent: conversationState.activeIntent,
    pendingClarification: conversationState.pendingClarification,
    pendingConfirmation: conversationState.pendingConfirmation,
    lastDomainResult: conversationState.lastDomainResult,
    isLoading,
    error,
    sendMessage,
    confirmAction,
    cancelAction,
    selectClarificationOption,
    resetConversation,
  };
}
