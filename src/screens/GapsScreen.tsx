import React, { useState } from 'react';
import { ShoppingBag, ArrowUpRight } from 'lucide-react';
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

  // Breakdown counts for editorial summary
  const topsCount = items.filter((i) => i.category === 'Tops').length;
  const bottomsCount = items.filter((i) => i.category === 'Bottoms').length;
  const ethnicCount = items.filter((i) => i.category === 'Ethnic').length;
  const dressesCount = items.filter((i) => i.category === 'Dresses').length;

  const topRecommendation = smartBuys[0] || null;
  const secondaryRecommendations = smartBuys.slice(1, 6);

  // Determine biggest gap label
  const biggestGapLabel =
    topsCount > bottomsCount * 2
      ? 'BOTTOMS'
      : ethnicCount < 3
      ? 'ETHNIC ENSEMBLES'
      : 'LAYERED SILHOUETTES';

  return (
    <div className="pb-12 animate-fade-in space-y-6">
      {/* Top Header */}
      <Header
        title="INSIGHT"
        subtitle="Wardrobe intelligence & gap analysis"
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-7 w-7 text-(--kumkum)" />}
          title="Your wardrobe insight is waiting"
          description="Once you add your clothing pieces or load the sample collection, StyleSaathi will simulate which single additions unlock the most new looks."
          action={{
            label: 'Load Sample Wardrobe',
            onClick: loadSample,
          }}
        />
      ) : (
        <>
          {/* Editorial Wardrobe Narrative Overview */}
          <section className="border-b border-(--border) pb-4">
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-(--kumkum)">
              YOUR WARDROBE
            </span>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-(--muted)">
              <span className="text-sm font-serif italic text-(--ink)">
                {topsCount} tops
              </span>
              <span className="text-(--border)">·</span>
              <span className="text-sm font-serif italic text-(--ink)">
                {bottomsCount} bottoms
              </span>
              <span className="text-(--border)">·</span>
              <span className="text-sm font-serif italic text-(--ink)">
                {ethnicCount} ethnic pieces
              </span>
              {dressesCount > 0 && (
                <>
                  <span className="text-(--border)">·</span>
                  <span className="text-sm font-serif italic text-(--ink)">
                    {dressesCount} dresses
                  </span>
                </>
              )}
            </div>
          </section>

          {/* Stylist Insight Narrative: "YOUR BIGGEST GAP" */}
          <section className="rounded-2xl border border-(--border) bg-(--card) p-5 sm:p-6 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-(--kumkum)">
              YOUR BIGGEST GAP
            </span>
            <h3 className="mt-1 font-serif text-2xl font-normal text-(--ink) tracking-tight">
              {biggestGapLabel}
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-(--muted) font-normal leading-relaxed">
              {insight}
            </p>
          </section>

          {/* "THE ONE TO ADD" — Hero Smart Buy Recommendation */}
          {topRecommendation && (
            <section className="space-y-3">
              <div className="flex items-baseline justify-between px-0.5">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
                    RECOMMENDED PURCHASE
                  </span>
                  <h3 className="mt-0.5 font-serif text-2xl font-normal text-(--ink)">
                    The One To Add
                  </h3>
                </div>
                <span className="text-[11px] text-(--muted)">
                  Highest combination multiplier
                </span>
              </div>

              <SmartBuyCard
                recommendation={topRecommendation}
                rank={1}
                onSeeCombinations={setSelectedRec}
                isHero={true}
              />
            </section>
          )}

          {/* Secondary Smart Additions */}
          {secondaryRecommendations.length > 0 && (
            <section className="space-y-3 pt-2">
              <div className="flex items-baseline justify-between px-0.5 border-b border-(--border) pb-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-(--muted)">
                  OTHER STRATEGIC ADDITIONS
                </span>
                <span className="text-[11px] text-(--muted)">
                  Ranked by new outfits unlocked
                </span>
              </div>

              <div className="grid gap-3.5 sm:grid-cols-2">
                {secondaryRecommendations.map((rec, i) => (
                  <SmartBuyCard
                    key={rec.candidate.id}
                    recommendation={rec}
                    rank={i + 2}
                    onSeeCombinations={setSelectedRec}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Category Distribution Proportions */}
          <CategoryBalanceBar balance={categoryBalance} />

          {/* Occasion Readiness Checklist */}
          <OccasionCoverageList coverage={occasionCoverage} />
        </>
      )}

      {/* Combinations Lookbook Modal */}
      <CombinationsModal
        recommendation={selectedRec}
        isOpen={Boolean(selectedRec)}
        onClose={() => setSelectedRec(null)}
      />
    </div>
  );
};

