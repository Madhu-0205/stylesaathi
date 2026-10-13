import { useEffect, useRef } from 'react';
import { backButtonManager, BackButtonHandler } from '../services/backButtonManager';

/**
 * Declarative hook for registering a component with the BackButtonManager.
 * 
 * @param priority Numerical priority (e.g. BackButtonPriority.GLOBAL_SHEET)
 * @param handler Function returning true if handled/dismissed, false otherwise
 * @param active Whether the handler is currently active (e.g. isModalOpen)
 * @param label Optional debug/diagnostic label
 */
export function useBackButton(
  priority: number,
  handler: BackButtonHandler,
  active: boolean = true,
  label?: string
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!active) return;

    const unregister = backButtonManager.register(
      priority,
      () => handlerRef.current(),
      label
    );

    return unregister;
  }, [priority, active, label]);
}
