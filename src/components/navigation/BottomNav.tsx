import React from 'react';
import { Shirt, Sparkles, Compass, User, Calendar, type LucideIcon } from 'lucide-react';

export type NavTab = 'Wardrobe' | 'Dress' | 'Calendar' | 'Insight' | 'You';

interface BottomNavProps {
  currentTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
}

const TABS: { id: NavTab; label: string; icon: LucideIcon }[] = [
  { id: 'Wardrobe', label: 'WARDROBE', icon: Shirt },
  { id: 'Dress', label: 'DRESS', icon: Sparkles },
  { id: 'Calendar', label: 'CALENDAR', icon: Calendar },
  { id: 'Insight', label: 'INSIGHT', icon: Compass },
  { id: 'You', label: 'YOU', icon: User },
];

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onChangeTab }) => {
  const handleTabClick = (tabId: NavTab) => {
    if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
      try {
        navigator.vibrate(8);
      } catch {
        // Ignore haptic errors on unsupported environments
      }
    }
    onChangeTab(tabId);
  };

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-3 left-3 right-3 sm:left-6 sm:right-6 max-w-md mx-auto z-40 md:hidden rounded-full glass-nav p-1 shadow-lg specular-border transition-all"
    >
      <div className="grid grid-cols-5 gap-1 safe-nav-padding">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(tab.id)}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-full px-1 py-1 text-center transition-[transform,background-color,color] duration-200 ease-out select-none active:scale-95 tactile-press-sm focus-editorial ${
                isActive
                  ? 'bg-(--ivory) dark:bg-white/10 text-(--ink) font-bold shadow-2xs'
                  : 'text-muted font-medium hover:text-(--ink) hover:bg-(--ivory)/50'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Icon
                  className={`h-4 w-4 transition-colors ${
                    isActive ? 'stroke-[2.2] text-(--kumkum)' : 'stroke-[1.6]'
                  }`}
                />
              </div>
              <span className={`text-[8.5px] tracking-wider transition-colors uppercase ${isActive ? 'text-(--ink)' : 'text-muted'}`}>
                {tab.label}
              </span>
              <div
                className={`h-1 w-1 rounded-full transition-transform duration-200 ease-out ${
                  isActive ? 'bg-(--kumkum) scale-100' : 'bg-transparent scale-0'
                }`}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
};
