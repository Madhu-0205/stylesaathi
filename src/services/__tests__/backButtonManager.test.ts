import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BackButtonManager, BackButtonPriority } from '../backButtonManager';

describe('BackButtonManager', () => {
  let manager: BackButtonManager;

  beforeEach(() => {
    manager = new BackButtonManager();
  });

  it('executes handlers in descending priority order', async () => {
    const callOrder: string[] = [];

    manager.register(
      BackButtonPriority.PRIMARY_TAB,
      () => {
        callOrder.push('primary_tab');
        return true;
      },
      'Primary Tab'
    );

    manager.register(
      BackButtonPriority.AI_SAATHI,
      () => {
        callOrder.push('ai_saathi');
        return false; // passes through
      },
      'AI Saathi'
    );

    manager.register(
      BackButtonPriority.GLOBAL_SHEET,
      () => {
        callOrder.push('global_sheet');
        return false; // passes through
      },
      'Global Sheet'
    );

    const handled = await manager.handleBack();

    expect(handled).toBe(true);
    expect(callOrder).toEqual(['ai_saathi', 'global_sheet', 'primary_tab']);
  });

  it('stops propagation once a higher-priority handler consumes the event', async () => {
    const tabHandler = vi.fn(() => true);
    const sheetHandler = vi.fn(() => true); // Consumes event

    manager.register(BackButtonPriority.PRIMARY_TAB, tabHandler, 'Tab');
    manager.register(BackButtonPriority.GLOBAL_SHEET, sheetHandler, 'Sheet');

    const handled = await manager.handleBack();

    expect(handled).toBe(true);
    expect(sheetHandler).toHaveBeenCalledTimes(1);
    expect(tabHandler).not.toHaveBeenCalled();
  });

  it('unregisters cleanly when cleanup function is invoked', async () => {
    const sheetHandler = vi.fn(() => true);
    const unregister = manager.register(BackButtonPriority.GLOBAL_SHEET, sheetHandler);

    expect(manager.getRegisteredCount()).toBe(1);
    unregister();
    expect(manager.getRegisteredCount()).toBe(0);

    const handled = await manager.handleBack();
    expect(handled).toBe(false);
    expect(sheetHandler).not.toHaveBeenCalled();
  });

  it('invokes root exit callback when all handlers pass or stack is empty', async () => {
    const rootExitMock = vi.fn();
    manager.setRootExitHandler(rootExitMock);

    manager.register(BackButtonPriority.GLOBAL_SHEET, () => false); // Not active

    const handled = await manager.handleBack();

    expect(handled).toBe(true);
    expect(rootExitMock).toHaveBeenCalledTimes(1);
  });

  it('survives handler errors without breaking subsequent lower priority handlers', async () => {
    const faultyHandler = vi.fn(() => {
      throw new Error('Component unmounted abruptly');
    });
    const fallbackHandler = vi.fn(() => true);

    manager.register(BackButtonPriority.GLOBAL_SHEET, faultyHandler);
    manager.register(BackButtonPriority.PRIMARY_TAB, fallbackHandler);

    const handled = await manager.handleBack();

    expect(handled).toBe(true);
    expect(faultyHandler).toHaveBeenCalledTimes(1);
    expect(fallbackHandler).toHaveBeenCalledTimes(1);
  });
});
