// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OnboardingScreen } from '../screens/OnboardingScreen';

const mockLoadSample = vi.fn().mockResolvedValue(undefined);
const mockSetOnboarded = vi.fn();
const mockSetSetupCompleted = vi.fn();
const mockUpdatePreferences = vi.fn().mockResolvedValue(undefined);
const mockSetStyleVibes = vi.fn();
const mockContinueAsGuest = vi.fn().mockResolvedValue(undefined);

vi.mock('../context/WardrobeContext', () => ({
  useWardrobeContext: () => ({
    loadSample: mockLoadSample,
    setOnboarded: mockSetOnboarded,
    setSetupCompleted: mockSetSetupCompleted,
    styleVibes: ['Royal Heritage', 'Indo-Western'],
    setStyleVibes: mockSetStyleVibes,
    preferences: { preferredContexts: ['everyday', 'office'] },
    updatePreferences: mockUpdatePreferences,
  }),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    status: 'unauthenticated',
    continueAsGuest: mockContinueAsGuest,
  }),
}));

describe('Phase 3: Choice-Driven Editorial Welcome Experience', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
      container = null;
    }
  });

  it('1. Renders official editorial welcome headlines and brand presentation in HTML', () => {
    const html = renderToString(<OnboardingScreen />);
    expect(html).toContain('Welcome to your personal style world.');
    expect(html).toContain('Discover your style. Explore your wardrobe. Find inspiration.');
    expect(html).toContain('STYLESAATHI');
  });

  it('2. Presents three distinct, equally meaningful choice portals', () => {
    const html = renderToString(<OnboardingScreen />);
    expect(html).toContain('welcome-portal-stylist');
    expect(html).toContain('welcome-portal-wardrobe');
    expect(html).toContain('welcome-portal-inspiration');
    expect(html).toContain('Meet Your Personal Stylist');
    expect(html).toContain('Explore Your Wardrobe');
    expect(html).toContain('Explore Fashion Inspiration');
  });

  it('3. Selecting "Meet Your Personal Stylist" portal invokes choice handler with stylist destination', async () => {
    const handleChoice = vi.fn();
    await act(async () => {
      root?.render(<OnboardingScreen onSelectChoice={handleChoice} />);
    });

    const stylistPortal = container?.querySelector('[data-testid="welcome-portal-stylist"]') as HTMLButtonElement;
    expect(stylistPortal).not.toBeNull();

    await act(async () => {
      stylistPortal.click();
    });

    expect(handleChoice).toHaveBeenCalledWith('stylist');
    expect(mockSetOnboarded).toHaveBeenCalledWith(true);
    expect(mockSetSetupCompleted).toHaveBeenCalledWith(true);
    expect(mockContinueAsGuest).toHaveBeenCalled();
  });

  it('4. Selecting "Explore Your Wardrobe" portal invokes choice handler with wardrobe destination (zero Today detour)', async () => {
    const handleChoice = vi.fn();
    await act(async () => {
      root?.render(<OnboardingScreen onSelectChoice={handleChoice} />);
    });

    const wardrobePortal = container?.querySelector('[data-testid="welcome-portal-wardrobe"]') as HTMLButtonElement;
    expect(wardrobePortal).not.toBeNull();

    await act(async () => {
      wardrobePortal.click();
    });

    expect(handleChoice).toHaveBeenCalledWith('wardrobe');
    expect(mockSetOnboarded).toHaveBeenCalledWith(true);
    expect(mockSetSetupCompleted).toHaveBeenCalledWith(true);
  });

  it('5. Selecting "Explore Fashion Inspiration" portal invokes choice handler with inspiration destination (zero Today detour)', async () => {
    const handleChoice = vi.fn();
    await act(async () => {
      root?.render(<OnboardingScreen onSelectChoice={handleChoice} />);
    });

    const inspirationPortal = container?.querySelector('[data-testid="welcome-portal-inspiration"]') as HTMLButtonElement;
    expect(inspirationPortal).not.toBeNull();

    await act(async () => {
      inspirationPortal.click();
    });

    expect(handleChoice).toHaveBeenCalledWith('inspiration');
    expect(mockSetOnboarded).toHaveBeenCalledWith(true);
    expect(mockSetSetupCompleted).toHaveBeenCalledWith(true);
  });

  it('6. Strict Sample Separation: Demo capsule is default and calls loadSample', async () => {
    const handleChoice = vi.fn();
    await act(async () => {
      root?.render(<OnboardingScreen onSelectChoice={handleChoice} />);
    });

    const wardrobePortal = container?.querySelector('[data-testid="welcome-portal-wardrobe"]') as HTMLButtonElement;
    await act(async () => {
      wardrobePortal.click();
    });

    expect(mockLoadSample).toHaveBeenCalledTimes(1);
  });

  it('7. Clean Personal Closet selection bypasses loadSample completely', async () => {
    const handleChoice = vi.fn();
    await act(async () => {
      root?.render(<OnboardingScreen onSelectChoice={handleChoice} />);
    });

    const emptyOption = container?.querySelector('[data-testid="wardrobe-mode-empty"]') as HTMLButtonElement;
    expect(emptyOption).not.toBeNull();

    await act(async () => {
      emptyOption.click();
    });

    const wardrobePortal = container?.querySelector('[data-testid="welcome-portal-wardrobe"]') as HTMLButtonElement;
    await act(async () => {
      wardrobePortal.click();
    });

    expect(mockLoadSample).not.toHaveBeenCalled();
    expect(handleChoice).toHaveBeenCalledWith('wardrobe');
  });
});
