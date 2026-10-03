import React, { useState } from 'react';
import { Sparkles, ShoppingBag, Lightbulb } from 'lucide-react';
import { useSmartBuys } from '../hooks/useSmartBuys';
import { useWardrobeContext } from '../context/WardrobeContext';
import { Header } from '../components/common/Header';
import { CategoryBalanceBar } from '../components/gaps/CategoryBalanceBar';
import { OccasionCoverageList } from '../components/gaps/OccasionCoverageList';
import { SmartBuyCard } from '../components/gaps/SmartBuyCard';
import { CombinationsModal } from '../components/gaps/CombinationsModal';
import { EmptyState } from '../components/common/EmptyState';
import { SmartBuyRecommendation } from '../types';

export const GapsScreen: React.FC = () => {
  const { theme, toggleTheme, items, loadSample } = useWardrobeContext();
  const { categoryBalance, occasionCoverage, smartBuys, insight } = useSmartBuys('summer');
  const [selectedRec, setSelectedRec] = useState<SmartBuyRecommendation | null>(null);

  return (
    <div className="pb-8 animate-fade-in space-y-5">
      {/* Top Header */}
      <Header
        title="Wardrobe Gaps"
        subtitle="Buy less. Unlock more outfits."
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Intelligence Insight Banner */}
      <div className="rounded-3xl border border-[var(--accent)]/30 bg-[var(--accent-light)]/40 p-4 sm:p-5">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
          <Lightbulb className="h-4 w-4" />
          <span>Wardrobe Intelligence</span>
        </div>
        <p className="mt-1.5 text-xs sm:text-sm font-medium text-[var(--text)] leading-relaxed">
          {insight}
        </p>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-7 w-7" />}
          title="Add items to see your gaps"
          description="Once you add clothes or load the sample wardrobe, StyleSaathi simulates which additions unlock the most new looks."
          action={{
            label: 'Load Sample Wardrobe',
            onClick: loadSample,
          }}
        />
      ) : (
        <>
          {/* Category Distribution */}
          <CategoryBalanceBar balance={categoryBalance} />

          {/* Occasion Readiness Checklist */}
          <OccasionCoverageList coverage={occasionCoverage} />

          {/* Smart Buys Section */}
          <div className="pt-2">
            <div className="mb-3 px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent)]">
                Smart Buy Recommendations
              </span>
              <h3 className="mt-0.5 text-lg font-black text-[var(--text)] tracking-tight">
                Buy smarter
              </h3>
              <p className="text-xs text-[var(--muted)]">
                Ranked by the number of new outfit combinations each piece unlocks with what you already own.
              </p>
            </div>

            {smartBuys.length === 0 ? (
              <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 text-center text-xs text-[var(--muted)]">
                Your wardrobe is already well-balanced for the current season.
              </div>
            ) : (
              <div className="grid gap-3.5 sm:grid-cols-2">
                {smartBuys.slice(0, 8).map((rec, i) => (
                  <SmartBuyCard
                    key={rec.candidate.id}
                    recommendation={rec}
                    rank={i + 1}
                    onSeeCombinations={setSelectedRec}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Combinations Preview Modal */}
      <CombinationsModal
        recommendation={selectedRec}
        isOpen={Boolean(selectedRec)}
        onClose={() => setSelectedRec(null)}
      />
    </div>
  );
};
