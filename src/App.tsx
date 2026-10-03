import React, { useState } from 'react';
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

export const App: React.FC = () => {
  const { onboarded, addItem, toast, clearToast, theme, toggleTheme } = useWardrobeContext();
  const [currentTab, setCurrentTab] = useState<NavTab>('Wardrobe');
  const [isAddOpen, setIsAddOpen] = useState(false);

  // First-time users see the 3-step editorial onboarding
  if (!onboarded) {
    return <OnboardingScreen />;
  }

  return (
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
  );
};
