import React, { useState, useEffect, useCallback } from 'react';
import { useWardrobeContext } from './context/WardrobeContext';
import { useAuth } from './context/AuthContext';
import { BottomNav, NavTab } from './components/navigation/BottomNav';
import { TopNav } from './components/navigation/TopNav';
import { WardrobeScreen } from './screens/WardrobeScreen';
import { DressMeScreen } from './screens/DressMeScreen';
import { AuthView } from './components/auth/AuthView';
import { AddItemSheet } from './components/wardrobe/AddItemSheet';
import { Toast } from './components/common/Toast';
import { StyleSaathiLogo } from './components/brand/StyleSaathiLogo';
import { StyleSaathiLoadingOverlay } from './components/loading/StyleSaathiLoadingOverlay';
import { NeedleCommandBar } from './components/needle/NeedleCommandBar';
import { AISaathiChatView } from './components/saathi/AISaathiChatView';
import { Skeleton } from './components/common/Skeleton';
import { Sparkles } from 'lucide-react';
import { WardrobeItem } from './types';

// Route-level code splitting for non-initial screens
const TodayScreen = React.lazy(() =>
  import('./screens/TodayScreen').then((m) => ({ default: m.TodayScreen }))
);
const CalendarScreen = React.lazy(() =>
  import('./screens/CalendarScreen').then((m) => ({ default: m.CalendarScreen }))
);
const GapsScreen = React.lazy(() =>
  import('./screens/GapsScreen').then((m) => ({ default: m.GapsScreen }))
);
const ProfileScreen = React.lazy(() =>
  import('./screens/ProfileScreen').then((m) => ({ default: m.ProfileScreen }))
);
const OnboardingScreen = React.lazy(() =>
  import('./screens/OnboardingScreen').then((m) => ({ default: m.OnboardingScreen }))
);
const WardrobeSetupScreen = React.lazy(() =>
  import('./screens/WardrobeSetupScreen').then((m) => ({ default: m.WardrobeSetupScreen }))
);

import { useBackButton } from './hooks/useBackButton';
import { backButtonManager, BackButtonPriority } from './services/backButtonManager';
import { App as CapacitorApp, BackButtonListenerEvent } from '@capacitor/app';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';

const TAB_TO_HASH: Record<NavTab, string> = {
  Today: '#today',
  Wardrobe: '#wardrobe',
  Dress: '#dress',
  Calendar: '#calendar',
  Insight: '#insight',
  You: '#you',
};

const HASH_TO_TAB: Record<string, NavTab> = {
  '#today': 'Today',
  '#wardrobe': 'Wardrobe',
  '#dress': 'Dress',
  '#atelier': 'Dress',
  '#calendar': 'Calendar',
  '#insight': 'Insight',
  '#you': 'You',
  '#profile': 'You',
};

export const App: React.FC = () => {
  const {
    onboarded,
    setOnboarded,
    loading,
    setupCompleted,
    setSetupCompleted,
    addItem,
    toast,
    clearToast,
    theme,
    toggleTheme,
  } = useWardrobeContext();

  const { status, continueAsGuest } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>('Today');
  const [insightView, setInsightView] = useState<'gaps' | 'analytics' | 'trends'>('gaps');
  const [anchorItemForDress, setAnchorItemForDress] = useState<WardrobeItem | undefined>(undefined);
  const [initialSaathiPrompt, setInitialSaathiPrompt] = useState<string | undefined>(undefined);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSaathiOpen, setIsSaathiOpen] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  // Synchronize active tab with URL hash on boot for refresh preservation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.toLowerCase();
      if (HASH_TO_TAB[hash]) {
        setCurrentTab(HASH_TO_TAB[hash]);
      }
    }
  }, []);

  // Update URL hash when tab changes, preserving #atelier sub-route
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const targetHash = TAB_TO_HASH[currentTab];
      if (currentTab === 'Today' && window.location.hash && window.location.hash !== '#today' && HASH_TO_TAB[window.location.hash.toLowerCase()]) {
        return;
      }
      if (currentTab === 'Dress' && window.location.hash.toLowerCase() === '#atelier') {
        return;
      }
      if (window.location.hash !== targetHash) {
        window.history.replaceState(null, '', targetHash);
      }
    }
  }, [currentTab]);

  // Handle browser back/forward or manual hash change
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase();
      if (HASH_TO_TAB[hash] && HASH_TO_TAB[hash] !== currentTab) {
        setCurrentTab(HASH_TO_TAB[hash]);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, [currentTab]);

  const handleOnboardingChoice = useCallback(
    async (destination: 'stylist' | 'wardrobe' | 'inspiration') => {
      if (status === 'unauthenticated' && continueAsGuest) {
        try {
          await continueAsGuest();
        } catch (e) {
          console.warn('Guest login error during onboarding choice:', e);
        }
      }
      setOnboarded(true);
      setSetupCompleted(true);
      if (destination === 'stylist') {
        setCurrentTab('Today');
        setIsSaathiOpen(true);
      } else if (destination === 'wardrobe') {
        setCurrentTab('Wardrobe');
        setIsSaathiOpen(false);
      } else if (destination === 'inspiration') {
        setCurrentTab('Insight');
        setInsightView('trends');
        setIsSaathiOpen(false);
      }
    },
    [status, continueAsGuest, setOnboarded, setSetupCompleted]
  );

  // Wire back button hierarchy for root overlays and tab state
  useBackButton(
    BackButtonPriority.AI_SAATHI,
    () => {
      setIsSaathiOpen(false);
      return true;
    },
    isSaathiOpen,
    'AI Saathi Drawer'
  );

  useBackButton(
    BackButtonPriority.GLOBAL_SHEET,
    () => {
      setIsAddOpen(false);
      return true;
    },
    isAddOpen,
    'Add Item Sheet'
  );

  useBackButton(
    BackButtonPriority.PRIMARY_TAB,
    () => {
      setCurrentTab('Today');
      return true;
    },
    currentTab !== 'Today',
    'Return to Today Tab'
  );

  const isListenerRegisteringRef = React.useRef(false);

  // Native Android hardware/gesture back button integration
  useEffect(() => {
    let isMounted = true;
    let listenerHandle: PluginListenerHandle | undefined;

    const setupNativeBackButton = async () => {
      // 1. Guard against non-native / browser environments to preserve web back navigation
      const isNative =
        typeof Capacitor !== 'undefined' &&
        typeof Capacitor.isNativePlatform === 'function' &&
        Capacitor.isNativePlatform();

      if (!isNative || isListenerRegisteringRef.current) {
        return;
      }

      isListenerRegisteringRef.current = true;

      try {
        // 2. Register native Capacitor backButton listener
        const handle = await CapacitorApp.addListener('backButton', async (_event: BackButtonListenerEvent) => {
          try {
            // 3. Delegate to backButtonManager priority stack
            const handled = await backButtonManager.handleBack();
            if (!handled) {
              // 4. No registered overlay or secondary state consumed event -> exit/minimize app
              if (typeof CapacitorApp.exitApp === 'function') {
                await CapacitorApp.exitApp();
              }
            }
          } catch (err) {
            console.error('[BackButton] Error processing back event:', err);
          }
        });

        if (!isMounted) {
          handle.remove();
          isListenerRegisteringRef.current = false;
        } else {
          listenerHandle = handle;
        }
      } catch (err) {
        console.warn('[BackButton] Failed to register native back button listener:', err);
        isListenerRegisteringRef.current = false;
      }
    };

    setupNativeBackButton();

    return () => {
      isMounted = false;
      isListenerRegisteringRef.current = false;
      if (listenerHandle) {
        listenerHandle.remove();
        listenerHandle = undefined;
      }
    };
  }, []);

  const isContextLoading = loading || status === 'loading';

  useEffect(() => {
    const handleOpenSaathi = (e: any) => {
      if (e?.detail?.prompt) {
        setInitialSaathiPrompt(e.detail.prompt);
      }
      setIsSaathiOpen(true);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'j' || e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        setIsSaathiOpen((prev) => !prev);
      }
    };
    window.addEventListener('open-saathi-chat', handleOpenSaathi);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('open-saathi-chat', handleOpenSaathi);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    // When initial context repository hydration finishes, transition smoothly into the application
    if (!isContextLoading) {
      const timer = setTimeout(() => {
        setIsFadingOut(true);
        const exitTimer = setTimeout(() => {
          setIsBooting(false);
        }, 400);
        return () => clearTimeout(exitTimer);
      }, 750); // Graceful 750ms entrance ensures garments settle naturally without delaying the user
      return () => clearTimeout(timer);
    }
  }, [isContextLoading]);

  return (
    <>
      {/* Editorial Wardrobe Boot Animation */}
      {isBooting && (
        <StyleSaathiLoadingOverlay
          isVisible={isBooting}
          isFadingOut={isFadingOut}
          statusText="Opening wardrobe archive…"
        />
      )}

      {/* 1. First-time users see the choice-driven editorial welcome */}
      {!onboarded ? (
        <React.Suspense fallback={<div className="min-h-dvh flex items-center justify-center p-6"><Skeleton className="h-48 w-full max-w-sm rounded-2xl" /></div>}>
          <OnboardingScreen onSelectChoice={handleOnboardingChoice} />
        </React.Suspense>
      ) : status === 'unauthenticated' ? (
        /* 2. Post-onboarding Authentication / Guest selection */
        <AuthView />
      ) : !setupCompleted ? (
        /* 3. Post-login Progressive Wardrobe Setup & Style Preferences */
        <React.Suspense fallback={<div className="min-h-dvh flex items-center justify-center p-6"><Skeleton className="h-64 w-full max-w-md rounded-2xl" /></div>}>
          <WardrobeSetupScreen onComplete={() => setSetupCompleted(true)} />
        </React.Suspense>
      ) : (
        /* 4. Complete V4 Companion Workspace */
        <div className="min-h-dvh bg-background text-(--text) transition-colors">
          {/* Desktop & Tablet Top Navigation (hidden on mobile) */}
          <div className="hidden md:block">
            <TopNav
              currentTab={currentTab}
              onChangeTab={setCurrentTab}
              onOpenAddItem={() => setIsAddOpen(true)}
              onOpenNeedle={() => window.dispatchEvent(new CustomEvent('open-needle-command'))}
              onOpenSaathi={() => setIsSaathiOpen(true)}
              theme={theme}
              toggleTheme={toggleTheme}
            />
          </div>

          {/* Mobile Top Navigation & Accessible AI Companion Header (hidden on desktop where TopNav provides actions) */}
          <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-3.5 py-2.5 bg-(--background)/90 backdrop-blur-md border-b border-border/50 safe-top">
            <div
              className="flex items-center cursor-pointer select-none py-1 hover:opacity-90 transition-opacity"
              onClick={() => setCurrentTab('Today')}
              aria-label="StyleSaathi Home"
            >
              <StyleSaathiLogo variant="mark" size="xs" showTagline={false} />
            </div>

            {/* Global Coordinated AI Companion Hub */}
            <aside
              role="region"
              aria-label="AI Companions"
              className="safe-floating-ai flex items-center rounded-full glass-pill p-1 shadow-2xs border border-(--burnished-gold)/40"
            >
              <button
                type="button"
                onClick={() => setIsSaathiOpen(true)}
                aria-label="Open AI Saathi conversation"
                className="flex min-h-11 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-(--ink) transition-colors hover:bg-(--ivory) active:scale-95"
              >
                <Sparkles className="h-4 w-4 text-(--burnished-gold) animate-pulse" />
                <span className="font-serif">AI Saathi</span>
              </button>

              <div className="h-4 w-px bg-border/80 mx-0.5" aria-hidden="true" />

              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('open-needle-command'))}
                aria-label="Open Ask AI command palette (Command + K)"
                className="flex min-h-11 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-(--ink) transition-colors hover:bg-(--ivory) active:scale-95"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span className="font-serif">Ask AI</span>
              </button>
            </aside>
          </header>

          {/* Universal Responsive Application Container */}
          <div className="app-container safe-bottom px-3.5 sm:px-6 md:px-8">
            <main className="w-full">
              <div key={currentTab} className="animate-page-enter">
                {currentTab === 'Today' && (
                  <React.Suspense fallback={<div className="space-y-4 py-4"><Skeleton className="h-12 w-48 rounded-xl" /><Skeleton className="h-72 w-full rounded-2xl" /></div>}>
                    <TodayScreen
                      onGoToDress={(anchorItem) => {
                        setAnchorItemForDress(anchorItem);
                        setCurrentTab('Dress');
                      }}
                      onGoToWardrobe={() => setCurrentTab('Wardrobe')}
                      onGoToCalendar={() => setCurrentTab('Calendar')}
                      onGoToInsights={(view) => {
                        setInsightView(view || 'gaps');
                        setCurrentTab('Insight');
                      }}
                      onOpenAddItem={() => setIsAddOpen(true)}
                    />
                  </React.Suspense>
                )}
                {currentTab === 'Wardrobe' && (
                  <WardrobeScreen
                    onOpenAddItem={() => setIsAddOpen(true)}
                    onGoToDress={(anchorItem) => {
                      if (anchorItem) setAnchorItemForDress(anchorItem);
                      setCurrentTab('Dress');
                    }}
                  />
                )}
                {currentTab === 'Dress' && (
                  <DressMeScreen
                    onGoToWardrobe={() => setCurrentTab('Wardrobe')}
                    onGoToCalendar={() => setCurrentTab('Calendar')}
                    initialAnchorItem={anchorItemForDress}
                    onClearInitialAnchor={() => setAnchorItemForDress(undefined)}
                  />
                )}
                {currentTab === 'Calendar' && (
                  <React.Suspense fallback={<div className="space-y-4 py-4"><Skeleton className="h-12 w-48 rounded-xl" /><Skeleton className="h-72 w-full rounded-2xl" /></div>}>
                    <CalendarScreen onGoToDress={() => setCurrentTab('Dress')} />
                  </React.Suspense>
                )}
                {currentTab === 'Insight' && (
                  <React.Suspense fallback={<div className="space-y-4 py-4"><Skeleton className="h-12 w-48 rounded-xl" /><Skeleton className="h-64 w-full rounded-2xl" /></div>}>
                    <GapsScreen
                      initialView={insightView}
                      onGoToDress={(anchorItem) => {
                        if (anchorItem) setAnchorItemForDress(anchorItem);
                        setCurrentTab('Dress');
                      }}
                    />
                  </React.Suspense>
                )}
                {currentTab === 'You' && (
                  <React.Suspense fallback={<div className="space-y-4 py-4"><Skeleton className="h-12 w-48 rounded-xl" /><Skeleton className="h-64 w-full rounded-2xl" /></div>}>
                    <ProfileScreen onNavigateTab={setCurrentTab} />
                  </React.Suspense>
                )}
              </div>
            </main>

            {/* Global sticky 5-tab bottom navigation (mobile only) */}
            <BottomNav currentTab={currentTab} onChangeTab={setCurrentTab} />

            {/* Global Needle 3 On-Device Command Palette */}
            <NeedleCommandBar onNavigateTab={setCurrentTab} />

            <AISaathiChatView
              isOpen={isSaathiOpen}
              onClose={() => setIsSaathiOpen(false)}
              initialPrompt={initialSaathiPrompt}
              onClearInitialPrompt={() => setInitialSaathiPrompt(undefined)}
              onPlanLook={() => {
                setIsSaathiOpen(false);
                setCurrentTab('Calendar');
              }}
              onOpenInAtelier={(anchorItem) => {
                setIsSaathiOpen(false);
                if (anchorItem) setAnchorItemForDress(anchorItem);
                setCurrentTab('Dress');
              }}
            />

            {/* Global Add Item Sheet / Dialog */}
            <AddItemSheet
              isOpen={isAddOpen}
              onClose={() => setIsAddOpen(false)}
              onAddItem={addItem}
            />

            {/* Global Toast Notifications */}
            <Toast message={toast} onClose={clearToast} />
          </div>
        </div>
      )}
    </>
  );
};

