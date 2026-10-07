import React, { useState, useEffect } from 'react';
import { useWardrobeContext } from './context/WardrobeContext';
import { useAuth } from './context/AuthContext';
import { BottomNav, NavTab } from './components/navigation/BottomNav';
import { TopNav } from './components/navigation/TopNav';
import { WardrobeScreen } from './screens/WardrobeScreen';
import { DressMeScreen } from './screens/DressMeScreen';
import { CalendarScreen } from './screens/CalendarScreen';
import { GapsScreen } from './screens/GapsScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { WardrobeSetupScreen } from './screens/WardrobeSetupScreen';
import { AuthView } from './components/auth/AuthView';
import { AddItemSheet } from './components/wardrobe/AddItemSheet';
import { Toast } from './components/common/Toast';
import { StyleSaathiLoadingOverlay } from './components/loading/StyleSaathiLoadingOverlay';
import { NeedleCommandBar } from './components/needle/NeedleCommandBar';

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
  const [isBooting, setIsBooting] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  const isContextLoading = loading || status === 'loading';

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
        <OnboardingScreen />
      ) : status === 'unauthenticated' ? (
        /* 2. Post-onboarding Authentication / Guest selection */
        <AuthView />
      ) : !setupCompleted ? (
        /* 3. Post-login Progressive Wardrobe Setup & Style Preferences */
        <WardrobeSetupScreen onComplete={() => setSetupCompleted(true)} />
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
              theme={theme}
              toggleTheme={toggleTheme}
            />
          </div>

          {/* Universal Responsive Application Container */}
          <div className="app-container safe-bottom px-3.5 sm:px-6 md:px-8 pt-3 sm:pt-4 md:pt-6">
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
                <CalendarScreen onGoToDress={() => setCurrentTab('Dress')} />
              )}
              {currentTab === 'Insight' && <GapsScreen />}
              {currentTab === 'You' && <ProfileScreen />}
            </main>

            {/* Global sticky 5-tab bottom navigation (mobile only) */}
            <BottomNav currentTab={currentTab} onChangeTab={setCurrentTab} />

            {/* Global Needle 3 On-Device Command Palette */}
            <NeedleCommandBar onNavigateTab={setCurrentTab} />

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

