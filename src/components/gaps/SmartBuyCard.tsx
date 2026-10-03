import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { SmartBuyRecommendation } from '../../types';
import { LazyImage } from '../common/LazyImage';

interface SmartBuyCardProps {
  recommendation: SmartBuyRecommendation;
  rank: number;
  onSeeCombinations: (rec: SmartBuyRecommendation) => void;
}

export const SmartBuyCard: React.FC<SmartBuyCardProps> = ({
  recommendation,
  rank,
  onSeeCombinations,
}) => {
  const { candidate, newOutfitsUnlocked, reason } = recommendation;

  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-xs transition-all hover:border-[var(--accent)] hover:shadow-md">
      {/* Top section */}
      <div>
        <div className="flex items-start gap-3.5">
          {/* Candidate Image Tile */}
          <div className="relative aspect-square h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--background)]">
            <LazyImage
              src={candidate.photo}
              alt={candidate.name}
              category={candidate.category}
              subcategory={candidate.subcategory}
              colors={candidate.colors}
            />
            <span className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-black text-white shadow-2xs">
              #{rank}
            </span>
          </div>

          {/* Details */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="rounded-full bg-[var(--accent-light)] px-2 py-0.5 text-[10px] font-black text-[var(--accent)] border border-[var(--accent)]/30">
                +{newOutfitsUnlocked} outfits unlocked
              </span>
            </div>
            <h4 className="mt-1 truncate text-sm font-black text-[var(--text)]">
              {candidate.name}
            </h4>
            <p className="text-xs font-bold text-[var(--muted)]">
              {candidate.priceRange || '₹1,200–₹2,500'}
            </p>
          </div>
        </div>

        {/* Reason */}
        <p className="mt-3 text-xs text-[var(--muted)] line-clamp-2 leading-relaxed">
          {reason}
        </p>
      </div>

      {/* Action CTA */}
      <div className="mt-3.5 pt-3 border-t border-[var(--border)]/60 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-[var(--muted)] capitalize">
          {candidate.category} staple
        </span>
        <button
          type="button"
          onClick={() => onSeeCombinations(recommendation)}
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[var(--background)] px-3 py-1.5 text-xs font-bold text-[var(--accent)] transition-all hover:bg-[var(--accent)] hover:text-white active:scale-95"
        >
          <span>See combinations</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
