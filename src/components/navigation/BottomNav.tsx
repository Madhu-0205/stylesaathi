import React from 'react';
import { Shirt, Sparkles, PieChart, User } from 'lucide-react';

export type NavTab = 'Wardrobe' | 'Dress Me' | 'Gaps' | 'Profile';

interface BottomNavProps {
  currentTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
}

const TABS: { id: NavTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'Wardrobe', label: 'Wardrobe', icon: Shirt },
  { id: 'Dress Me', label: 'Dress Me', icon: Sparkles },
  { id: 'Gaps', label: 'Gaps', icon: PieChart },
  { id: 'Profile', label: 'Profile', icon: User },
];

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onChangeTab }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-(--border) bg-(--card)/90 backdrop-blur-md shadow-lg">
      <div className="mx-auto grid max-w-md grid-cols-4 px-3 py-1.5 safe-nav-padding">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`group flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl py-1 text-center transition-all select-none active:scale-95 ${
                isActive ? 'text-(--accent) font-bold' : 'text-(--muted) font-medium hover:text-(--text)'
              }`}
            >
              <div
                className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                  isActive ? 'bg-(--accent)/10 text-(--accent)' : 'group-hover:bg-(--background)'
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              </div>
              <span className="text-[10px] tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
