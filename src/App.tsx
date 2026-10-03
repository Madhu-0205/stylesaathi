import React, { useState, useEffect } from 'react';
import { useWardrobeContext } from './context/WardrobeContext';
import { BottomNav, NavTab } from './components/navigation/BottomNav';
import { TopNav } from './components/navigation/TopNav';
import { WardrobeScreen } from './screens/WardrobeScreen';
import { DressMeScreen } from './screens/DressMeScreen';
import { GapsScreen } from './screens/GapsScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { AddItemSheet } from './components/wardrobe/AddItemSheet';
import { Toast } from './components/common/Toast';
import { StyleSaathiLoadingOverlay } from './components/loading/StyleSaathiLoadingOverlay';

export const App: React.FC = () => {
  const { onboarded, loading, addItem, toast, clearToast, theme, toggleTheme } = useWardrobeContext();
  const [currentTab, setCurrentTab] = useState<NavTab>('Wardrobe');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // When initial context repository hydration finishes, transition smoothly into the application
    if (!loading) {
      const timer = setTimeout(() => {
        setIsFadingOut(true);
        const exitTimer = setTimeout(() => {
          setIsBooting(false);
        }, 400);
        return () => clearTimeout(exitTimer);
      }, 750); // Graceful 750ms entrance ensures garments settle naturally without delaying the user
      return () => clearTimeout(timer);
    }
  }, [loading]);

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

      {/* First-time users see the 3-step editorial onboarding */}
      {!onboarded ? (
        <OnboardingScreen />
      ) : (
    <div className="min-h-[100dvh] bg-(--background) text-(--text) transition-colors">
      {/* Desktop & Tablet Top Navigation (hidden on mobile) */}
      <div className="hidden md:block">
        <TopNav
          currentTab={currentTab}
          onChangeTab={setCurrentTab}
          onOpenAddItem={() => setIsAddOpen(true)}
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
            <DressMeScreen onGoToWardrobe={() => setCurrentTab('Wardrobe')} />
          )}
          {currentTab === 'Insight' && <GapsScreen />}
          {currentTab === 'You' && <ProfileScreen />}
        </main>

        {/* Global sticky 4-tab bottom navigation (mobile only) */}
        <BottomNav currentTab={currentTab} onChangeTab={setCurrentTab} />

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
