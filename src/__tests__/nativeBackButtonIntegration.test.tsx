// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, Root } from 'react-dom/client';
import { act } from 'react';
import { backButtonManager, BackButtonPriority } from '../services/backButtonManager';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { App } from '../App';

// Mock Capacitor Core & App
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => true),
    getPlatform: vi.fn(() => 'android'),
  },
}));

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(),
    exitApp: vi.fn(),
  },
}));

// Mock minimal context hooks needed by App.tsx
vi.mock('../context/WardrobeContext', () => ({
  useWardrobeContext: vi.fn(() => ({
    onboarded: true,
    loading: false,
    setupCompleted: true,
    setSetupCompleted: vi.fn(),
    addItem: vi.fn(),
    toast: null,
    clearToast: vi.fn(),
    theme: 'light',
    toggleTheme: vi.fn(),
    items: [],
  })),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    status: 'authenticated',
    user: { id: 'test-user', email: 'test@example.com' },
  })),
}));

// Mock child screens and heavy components to keep integration test focused on navigation lifecycle
vi.mock('../screens/WardrobeScreen', () => ({
  WardrobeScreen: () => <div data-testid="wardrobe-screen" />,
}));
vi.mock('../screens/DressMeScreen', () => ({
  DressMeScreen: () => <div data-testid="dressme-screen" />,
}));
vi.mock('../components/loading/StyleSaathiLoadingOverlay', () => ({
  StyleSaathiLoadingOverlay: () => null,
}));
vi.mock('../components/needle/NeedleCommandBar', () => ({
  NeedleCommandBar: () => null,
}));

describe('StyleSaathi 3.0 — Native Android Back Button Integration', () => {
  let container: HTMLDivElement;
  let root: Root;
  let registeredListenerCallback: ((event: any) => Promise<void>) | null = null;
  let mockHandleRemove: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    backButtonManager.clear();
    registeredListenerCallback = null;
    mockHandleRemove = vi.fn();

    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(CapacitorApp.addListener).mockImplementation((eventName: string, callback: any) => {
      if (eventName === 'backButton') {
        registeredListenerCallback = callback;
      }
      return Promise.resolve({
        remove: mockHandleRemove,
      } as any);
    });
    vi.mocked(CapacitorApp.exitApp).mockResolvedValue(undefined as any);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    backButtonManager.clear();
  });

  it('1. Highest-priority handler executes first when native backButton event fires', async () => {
    const executionOrder: string[] = [];

    // Register handlers at different priority tiers
    backButtonManager.register(
      BackButtonPriority.PRIMARY_TAB,
      () => {
        executionOrder.push('primary_tab_tier_50');
        return true;
      },
      'Tab Handler'
    );

    backButtonManager.register(
      BackButtonPriority.GLOBAL_SHEET,
      () => {
        executionOrder.push('global_sheet_tier_80');
        return false; // passes through
      },
      'Global Sheet Handler'
    );

    backButtonManager.register(
      BackButtonPriority.AI_SAATHI,
      () => {
        executionOrder.push('ai_saathi_tier_90');
        return false; // passes through
      },
      'AI Saathi Handler'
    );

    await act(async () => {
      root.render(<App />);
    });

    expect(CapacitorApp.addListener).toHaveBeenCalledWith('backButton', expect.any(Function));
    expect(registeredListenerCallback).not.toBeNull();

    // Trigger the registered native listener
    await act(async () => {
      await registeredListenerCallback!({ canGoBack: true });
    });

    // Verify execution order strictly descends from highest to lowest priority
    expect(executionOrder).toEqual([
      'ai_saathi_tier_90',
      'global_sheet_tier_80',
      'primary_tab_tier_50',
    ]);
    // Since primary_tab consumed the event, exitApp must NOT be called
    expect(CapacitorApp.exitApp).not.toHaveBeenCalled();
  });

  it('2. Lower-priority handlers do not execute after an event is consumed', async () => {
    const sheetHandler = vi.fn(() => true); // Consumes event at tier 80
    const tabHandler = vi.fn(() => true);   // Tier 50 handler

    backButtonManager.register(BackButtonPriority.PRIMARY_TAB, tabHandler, 'Tab Handler');
    backButtonManager.register(BackButtonPriority.GLOBAL_SHEET, sheetHandler, 'Sheet Handler');

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await registeredListenerCallback!({ canGoBack: true });
    });

    expect(sheetHandler).toHaveBeenCalledTimes(1);
    expect(tabHandler).not.toHaveBeenCalled();
    expect(CapacitorApp.exitApp).not.toHaveBeenCalled();
  });

  it('3. Back navigation invokes exitApp when no overlay or secondary view is active', async () => {
    await act(async () => {
      root.render(<App />);
    });

    // In default render, user is on 'Wardrobe' tab with no modals or sheets open.
    // Therefore, no handler consumes the back event.
    await act(async () => {
      await registeredListenerCallback!({ canGoBack: false });
    });

    // App must cleanly exit / minimize
    expect(CapacitorApp.exitApp).toHaveBeenCalledTimes(1);
  });

  it('4. Multiple renders do not register duplicate native listeners', async () => {
    await act(async () => {
      root.render(<App />);
    });

    expect(CapacitorApp.addListener).toHaveBeenCalledTimes(1);

    // Re-render App instance
    await act(async () => {
      root.render(<App />);
    });

    // addListener should remain called exactly once due to hook guard & [] dependency
    expect(CapacitorApp.addListener).toHaveBeenCalledTimes(1);
  });

  it('5. Unmounting cleans up the native listener handle', async () => {
    await act(async () => {
      root.render(<App />);
    });

    expect(CapacitorApp.addListener).toHaveBeenCalledTimes(1);
    expect(mockHandleRemove).not.toHaveBeenCalled();

    // Unmount App
    act(() => {
      root.unmount();
    });

    expect(mockHandleRemove).toHaveBeenCalledTimes(1);
  });

  it('6. Registration failure does not crash the application and logs a warning', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(CapacitorApp.addListener).mockRejectedValueOnce(
      new Error('Native plugin unavailable or destroyed')
    );

    // Should mount gracefully without throwing
    await act(async () => {
      root.render(<App />);
    });

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[BackButton] Failed to register native back button listener'),
      expect.any(Error)
    );

    consoleWarnSpy.mockRestore();
  });

  it('7. Browser behavior remains intact when isNativePlatform is false', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

    await act(async () => {
      root.render(<App />);
    });

    // On standard web browser, Capacitor backButton listener must NOT be registered
    expect(CapacitorApp.addListener).not.toHaveBeenCalled();
  });
});
