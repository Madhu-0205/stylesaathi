import React, { useState } from 'react';
import { ShoppingBag, ArrowUpRight } from 'lucide-react';
import { useSmartBuys } from '../hooks/useSmartBuys';
import { useWardrobeContext } from '../context/WardrobeContext';
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
    <div className="pb-12 animate-fade-in space-y-4">
      {/* Compact Editorial Header: "INSIGHT · Your wardrobe has a gap" */}
      <header className="flex items-center justify-between border-b border-(--border) pb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[9.5px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
              INSIGHT
            </span>
            <span className="text-[10px] text-(--muted) font-devanagari">
              वॉर्डरोब समझ
            </span>
          </div>
          <h1 className="mt-0.5 font-serif text-2xl sm:text-3xl font-normal text-(--ink) tracking-tight">
            Your wardrobe has a gap.
          </h1>
          <p className="text-[11px] text-(--muted) font-medium">
            {topsCount} tops · {bottomsCount} bottoms · {ethnicCount} ethnic pieces
          </p>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-(--border) text-(--muted) transition-colors hover:border-(--ink) hover:text-(--ink)"
          aria-label="Toggle theme"
        >
          {theme === 'light' ? '☾' : '☼'}
        </button>
      </header>

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
          {/* Stylist Insight Narrative: "GAP DIAGNOSIS" */}
          <section className="rounded-xl border border-(--border) bg-(--card) p-3.5 sm:p-4 shadow-2xs">
            <div className="flex items-baseline justify-between">
              <span className="text-[9.5px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
                GAP DIAGNOSIS
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-(--burnished-gold)">
                {biggestGapLabel}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-(--muted) font-normal leading-relaxed">
              {insight}
            </p>
          </section>

          {/* "THE ONE TO ADD" — Hero Smart Buy Recommendation */}
          {topRecommendation && (
            <section className="space-y-2">
              <div className="flex items-baseline justify-between px-0.5">
                <span className="text-[9.5px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
                  THE ONE TO ADD
                </span>
                <span className="text-[10.5px] text-(--muted)">
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

