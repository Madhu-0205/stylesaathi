import React from 'react';
import { Shirt, Sparkles, Compass, User, Plus, Sun, Moon } from 'lucide-react';
import { NavTab } from './BottomNav';
import { StyleSaathiLogo } from '../brand/StyleSaathiLogo';

interface TopNavProps {
  currentTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
  onOpenAddItem: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const TABS: { id: NavTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'Wardrobe', label: 'WARDROBE', icon: Shirt },
  { id: 'Dress', label: 'DRESS', icon: Sparkles },
  { id: 'Insight', label: 'INSIGHT', icon: Compass },
  { id: 'You', label: 'YOU', icon: User },
];

export const TopNav: React.FC<TopNavProps> = ({
  currentTab,
  onChangeTab,
  onOpenAddItem,
  theme,
  toggleTheme,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-(--border) bg-(--card)/95 backdrop-blur-md transition-colors">
      <div className="mx-auto flex h-15 max-w-6xl xl:max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Official Brand Identity */}
        <div
          className="flex items-center cursor-pointer select-none py-1 hover:opacity-95 transition-opacity"
          onClick={() => onChangeTab('Wardrobe')}
          aria-label="StyleSaathi Home"
        >
          <StyleSaathiLogo variant="full" size="sm" showTagline={true} />
        </div>

        {/* Desktop / Tablet Navigation Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main Navigation">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChangeTab(tab.id)}
                className={`relative flex min-h-11 items-center gap-2 rounded-lg px-3 sm:px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all select-none ${
                  isActive
                    ? 'text-(--ink) bg-(--ivory) font-bold shadow-2xs'
                    : 'text-(--muted) hover:text-(--ink) hover:bg-(--ivory)/60'
                }`}
              >
                <Icon
                  className={`h-4 w-4 transition-colors ${
                    isActive ? 'text-(--kumkum) stroke-[2.2]' : 'stroke-[1.6]'
                  }`}
                />
                <span className="tracking-widest">{tab.label}</span>
                {isActive && (
                  <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full bg-(--kumkum)" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Global Desktop Actions */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-(--border) text-(--muted) transition-colors hover:border-(--ink) hover:text-(--ink)"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? (
              <Moon className="h-4 w-4 text-(--muted)" />
            ) : (
              <Sun className="h-4 w-4 text-(--burnished-gold)" />
            )}
          </button>

          <button
            type="button"
            onClick={onOpenAddItem}
            className="hidden sm:inline-flex min-h-11 items-center gap-1.5 rounded-full bg-(--accent) px-4 py-2 text-xs font-bold text-white shadow-2xs transition-transform hover:opacity-95 active:scale-95"
            aria-label="Add clothing piece"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>Add Piece</span>
          </button>
        </div>
      </div>
    </header>
  );
};
