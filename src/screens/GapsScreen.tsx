import React, { useState } from 'react';
import { useWardrobeContext } from '../context/WardrobeContext';
import { SmartBuyReportView } from '../components/gaps/SmartBuyReportView';
import { WearAnalyticsView } from '../components/analytics/WearAnalyticsView';

export const GapsScreen: React.FC = () => {
  const { theme, toggleTheme, items } = useWardrobeContext();
  const [activeView, setActiveView] = useState<'gaps' | 'analytics'>('gaps');

  // Breakdown counts for editorial summary
  const topsCount = items.filter((i) => i.category === 'Tops').length;
  const bottomsCount = items.filter((i) => i.category === 'Bottoms').length;
  const ethnicCount = items.filter((i) => i.category === 'Ethnic').length;

  return (
    <div className="pb-12 animate-fade-in space-y-4">
      {/* Compact Editorial Header: "INSIGHT · Smart Buy 2.0" */}
      <header className="flex items-center justify-between border-b border-border pb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[9.5px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
              INSIGHT
            </span>
          </div>
          <h1 className="mt-0.5 font-serif text-2xl sm:text-3xl font-normal text-(--ink) tracking-tight">
            {activeView === 'gaps' ? 'Smart Buy 2.0: Wardrobe Gap Intelligence' : 'Wear & Style Analytics'}
          </h1>
          <p className="text-[11px] text-muted font-medium">
            {topsCount} tops · {bottomsCount} bottoms · {ethnicCount} ethnic pieces
          </p>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          className="md:hidden flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted transition-colors hover:border-(--ink) hover:text-(--ink)"
          aria-label="Toggle theme"
        >
          {theme === 'light' ? '☾' : '☼'}
        </button>
      </header>

      {/* Segmented Sub-navigation Toggle: [ WARDROBE GAPS ] [ WEAR & STYLE ANALYTICS ] */}
      <div className="flex items-center gap-1.5 p-1 bg-(--border-light)/70 rounded-full border border-(--border)/60 w-fit max-w-full overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveView('gaps')}
          className={`min-h-[44px] px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-full transition-all ${
            activeView === 'gaps'
              ? 'bg-card text-(--ink) shadow-2xs'
              : 'text-muted hover:text-(--ink)'
          }`}
          aria-pressed={activeView === 'gaps'}
        >
          Wardrobe Gaps
        </button>
        <button
          type="button"
          onClick={() => setActiveView('analytics')}
          className={`min-h-[44px] px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-full transition-all ${
            activeView === 'analytics'
              ? 'bg-card text-(--ink) shadow-2xs'
              : 'text-muted hover:text-(--ink)'
          }`}
          aria-pressed={activeView === 'analytics'}
        >
          Wear &amp; Style Analytics
        </button>
      </div>

      {/* Responsive layout contract: md:grid-cols-12 md:col-span-5 md:col-span-7 THE ONE TO ADD md:hidden hidden md:block */}
      {activeView === 'analytics' ? (
        <WearAnalyticsView />
      ) : (
        <SmartBuyReportView />
      )}
    </div>
  );
};


