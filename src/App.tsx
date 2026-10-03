import React, { useState } from 'react';
import { useWardrobeContext } from './context/WardrobeContext';
import { BottomNav, NavTab } from './components/navigation/BottomNav';
import { WardrobeScreen } from './screens/WardrobeScreen';
import { DressMeScreen } from './screens/DressMeScreen';
import { GapsScreen } from './screens/GapsScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { AddItemSheet } from './components/wardrobe/AddItemSheet';

export const App: React.FC = () => {
  const { onboarded, addItem } = useWardrobeContext();
  const [currentTab, setCurrentTab] = useState<NavTab>('Wardrobe');
  const [isAddOpen, setIsAddOpen] = useState(false);

  // First-time users see the 3-step editorial onboarding
  if (!onboarded) {
    return <OnboardingScreen />;
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Centered mobile-first shell (max-w-[440px] on desktop) */}
      <div className="mobile-shell safe-bottom px-4 pt-4 sm:px-6">
        <main>
          {currentTab === 'Wardrobe' && (
            <WardrobeScreen onOpenAddItem={() => setIsAddOpen(true)} />
          )}
          {currentTab === 'Dress Me' && (
            <DressMeScreen onGoToWardrobe={() => setCurrentTab('Wardrobe')} />
          )}
          {currentTab === 'Gaps' && <GapsScreen />}
          {currentTab === 'Profile' && <ProfileScreen />}
        </main>

        {/* Global sticky 4-tab bottom navigation */}
        <BottomNav currentTab={currentTab} onChangeTab={setCurrentTab} />

        {/* Global Add Item Sheet */}
        <AddItemSheet
          isOpen={isAddOpen}
          onClose={() => setIsAddOpen(false)}
          onAddItem={addItem}
        />
      </div>
    </div>
  );
};
