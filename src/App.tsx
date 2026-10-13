import React, { useState, useEffect } from 'react';
import { useWardrobeContext } from './context/WardrobeContext';
import { useAuth } from './context/AuthContext';
import { BottomNav, NavTab } from './components/navigation/BottomNav';
import { TopNav } from './components/navigation/TopNav';
import { WardrobeScreen } from './screens/WardrobeScreen';
import { DressMeScreen } from './screens/DressMeScreen';
import { AuthView } from './components/auth/AuthView';
import { AddItemSheet } from './components/wardrobe/AddItemSheet';
import { Toast } from './components/common/Toast';
import { StyleSaathiLoadingOverlay } from './components/loading/StyleSaathiLoadingOverlay';
import { NeedleCommandBar } from './components/needle/NeedleCommandBar';
import { AISaathiChatView } from './components/saathi/AISaathiChatView';
import { Skeleton } from './components/common/Skeleton';
import { Sparkles } from 'lucide-react';

// Route-level code splitting for non-initial screens
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
import { BackButtonPriority } from './services/backButtonManager';

export const App: React.FC = () => {
  const {
    onboarded,
    loading,
    setupCompleted,
    setSetupCompleted,
    addItem,
    toast,
    clearToast,
    theme,
    toggleTheme,
  } = useWardrobeContext();

  const { status } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>('Wardrobe');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSaathiOpen, setIsSaathiOpen] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

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
      setCurrentTab('Wardrobe');
      return true;
    },
    currentTab !== 'Wardrobe',
    'Return to Wardrobe Tab'
  );

  const isContextLoading = loading || status === 'loading';

  useEffect(() => {
    const handleOpenSaathi = () => setIsSaathiOpen((prev) => !prev);
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
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

      {/* 1. First-time users see the 3-step editorial onboarding */}
      {!onboarded ? (
        <React.Suspense fallback={<div className="min-h-dvh flex items-center justify-center p-6"><Skeleton className="h-48 w-full max-w-sm rounded-2xl" /></div>}>
          <OnboardingScreen />
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

          {/* Universal Responsive Application Container */}
          <div className="app-container safe-top safe-bottom px-3.5 sm:px-6 md:px-8">
            <main className="w-full">
              {currentTab === 'Wardrobe' && (
                <WardrobeScreen onOpenAddItem={() => setIsAddOpen(true)} />
              )}
              {currentTab === 'Dress' && (
                <DressMeScreen
                  onGoToWardrobe={() => setCurrentTab('Wardrobe')}
                  onGoToCalendar={() => setCurrentTab('Calendar')}
                />
              )}
              {currentTab === 'Calendar' && (
                <React.Suspense fallback={<div className="space-y-4 py-4"><Skeleton className="h-12 w-48 rounded-xl" /><Skeleton className="h-72 w-full rounded-2xl" /></div>}>
                  <CalendarScreen onGoToDress={() => setCurrentTab('Dress')} />
                </React.Suspense>
              )}
              {currentTab === 'Insight' && (
                <React.Suspense fallback={<div className="space-y-4 py-4"><Skeleton className="h-12 w-48 rounded-xl" /><Skeleton className="h-64 w-full rounded-2xl" /></div>}>
                  <GapsScreen />
                </React.Suspense>
              )}
              {currentTab === 'You' && (
                <React.Suspense fallback={<div className="space-y-4 py-4"><Skeleton className="h-12 w-48 rounded-xl" /><Skeleton className="h-64 w-full rounded-2xl" /></div>}>
                  <ProfileScreen />
                </React.Suspense>
              )}
            </main>

            {/* Global sticky 5-tab bottom navigation (mobile only) */}
            <BottomNav currentTab={currentTab} onChangeTab={setCurrentTab} />

            {/* Global Needle 3 On-Device Command Palette */}
            <NeedleCommandBar onNavigateTab={setCurrentTab} />

            {/* Global AI Saathi Conversational Companion */}
            <button
              type="button"
              onClick={() => setIsSaathiOpen(true)}
              aria-label="Open AI Saathi conversation"
              className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-30 flex min-h-11 items-center gap-2 rounded-full border border-(--burnished-gold)/40 bg-card px-3.5 py-2 text-xs font-bold text-(--ink) shadow-md backdrop-blur-md transition-all hover:bg-(--ivory) active:scale-95"
            >
              <Sparkles className="h-4 w-4 text-(--burnished-gold) animate-pulse" />
              <span className="font-serif">AI Saathi</span>
            </button>

            <AISaathiChatView
              isOpen={isSaathiOpen}
              onClose={() => setIsSaathiOpen(false)}
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

