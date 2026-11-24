import React from 'react';
import { Shirt, Sparkles, Calendar, Compass, User, Plus, Sun, Moon } from 'lucide-react';
import { NavTab } from './BottomNav';
import { StyleSaathiLogo } from '../brand/StyleSaathiLogo';

interface TopNavProps {
  currentTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
  onOpenAddItem: () => void;
  onOpenNeedle?: () => void;
  onOpenSaathi?: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const TABS: { id: NavTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'Today', label: 'TODAY', icon: Sun },
  { id: 'Wardrobe', label: 'WARDROBE', icon: Shirt },
  { id: 'Dress', label: 'DRESS', icon: Sparkles },
  { id: 'Calendar', label: 'CALENDAR', icon: Calendar },
  { id: 'Insight', label: 'INSIGHT', icon: Compass },
  { id: 'You', label: 'YOU', icon: User },
];

export const TopNav: React.FC<TopNavProps> = ({
  currentTab,
  onChangeTab,
  onOpenAddItem,
  onOpenNeedle,
  onOpenSaathi,
  theme,
  toggleTheme,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full glass-header border-b border-border/60 transition-colors backdrop-blur-xl bg-(--background)/85 overflow-x-clip">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Official Editorial Brand Identity */}
        <div
          className="flex items-center cursor-pointer select-none py-1 hover:opacity-90 transition-opacity"
          onClick={() => onChangeTab('Today')}
          aria-label="StyleSaathi Home"
        >
          <StyleSaathiLogo variant="full" size="sm" showTagline={true} />
        </div>

        {/* Floating Capsule Desktop Navigation */}
        <nav
          className="flex items-center gap-1 p-1.5 rounded-full bg-(--card)/85 dark:bg-white/5 border border-border/80 shadow-xs specular-border backdrop-blur-md"
          aria-label="Main Navigation"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChangeTab(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex min-h-11 items-center gap-1.5 lg:gap-2 rounded-full px-2.5 lg:px-3.5 xl:px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-all duration-200 select-none active:scale-95 tactile-press-sm ${
                  isActive
                    ? 'text-(--ink) bg-(--paper) font-bold shadow-xs border border-border/80'
                    : 'text-muted hover:text-(--ink) hover:bg-(--paper)/40 border border-transparent'
                }`}
              >
                <Icon
                  className={`h-3.5 w-3.5 transition-colors ${
                    isActive ? 'text-(--kumkum) stroke-[2.2]' : 'stroke-[1.6]'
                  }`}
                />
                <span>{tab.label}</span>
                {isActive && (
                  <span className="h-1 w-1 rounded-full bg-(--kumkum)" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Global Desktop Actions */}
        <div className="flex items-center gap-2.5">
          {onOpenSaathi && (
            <button
              type="button"
              onClick={onOpenSaathi}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-(--burnished-gold)/40 bg-(--burnished-gold)/10 px-4 py-2 text-xs font-semibold text-(--ink) shadow-2xs backdrop-blur-sm transition-all hover:bg-(--burnished-gold)/20 active:scale-95"
              aria-label="Open AI Saathi conversation"
            >
              <Sparkles className="h-3.5 w-3.5 text-(--burnished-gold)" />
              <span className="font-serif tracking-wide">AI Saathi</span>
            </button>
          )}

          {onOpenNeedle && (
            <button
              type="button"
              onClick={onOpenNeedle}
              className="hidden md:inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-2 text-xs font-medium text-muted-foreground shadow-2xs backdrop-blur-sm transition-all hover:border-primary/40 hover:text-foreground active:scale-95"
              aria-label="Open AI Stylist (Command + K)"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
              <span className="font-serif tracking-wide">Ask Stylist…</span>
              <kbd className="ml-1 rounded border border-border bg-(--ivory) dark:bg-(--border)/60 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted dark:text-(--ink)">
                ⌘K
              </kbd>
            </button>
          )}

          <button
            type="button"
            onClick={toggleTheme}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border bg-card/60 text-muted transition-all hover:border-(--ink) hover:text-(--ink) active:scale-95"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? (
              <Moon className="h-4 w-4 text-muted" />
            ) : (
              <Sun className="h-4 w-4 text-(--burnished-gold)" />
            )}
          </button>

          <button
            type="button"
            onClick={onOpenAddItem}
            className="hidden sm:inline-flex min-h-11 items-center gap-1.5 rounded-full bg-accent px-5 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-xs transition-all hover:opacity-95 active:scale-95"
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
