import React from 'react';
import { Shirt, Sparkles, Compass, User } from 'lucide-react';

export type NavTab = 'Wardrobe' | 'Dress' | 'Insight' | 'You';

interface BottomNavProps {
  currentTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
}

const TABS: { id: NavTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'Wardrobe', label: 'WARDROBE', icon: Shirt },
  { id: 'Dress', label: 'DRESS', icon: Sparkles },
  { id: 'Insight', label: 'INSIGHT', icon: Compass },
  { id: 'You', label: 'YOU', icon: User },
];

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onChangeTab }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-(--border) bg-(--card)/95 backdrop-blur-md">
      <div className="mx-auto grid max-w-110 grid-cols-4 px-2 py-2 safe-nav-padding">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              aria-label={tab.label}
              className={`flex min-h-12 flex-col items-center justify-center gap-1 text-center transition-all select-none active:scale-95 ${
                isActive
                  ? 'text-(--text) font-bold'
                  : 'text-(--muted) font-medium hover:text-(--text)'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Icon
                  className={`h-4.5 w-4.5 transition-colors ${
                    isActive ? 'stroke-[2.2] text-(--accent)' : 'stroke-[1.6]'
                  }`}
                />
              </div>
              <span className={`text-[9px] tracking-widest transition-colors ${isActive ? 'text-(--text)' : 'text-(--muted)'}`}>
                {tab.label}
              </span>
              {/* Subtle textile dot active indicator */}
              <div
                className={`h-1 w-1 rounded-full transition-all ${
                  isActive ? 'bg-(--accent) scale-100' : 'bg-transparent scale-0'
                }`}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
};
