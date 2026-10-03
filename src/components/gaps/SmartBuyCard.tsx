import React from 'react';
import { ArrowRight } from 'lucide-react';
import { SmartBuyRecommendation } from '../../types';
import { LazyImage } from '../common/LazyImage';

interface SmartBuyCardProps {
  recommendation: SmartBuyRecommendation;
  rank: number;
  onSeeCombinations: (rec: SmartBuyRecommendation) => void;
  isHero?: boolean;
}

export const SmartBuyCard: React.FC<SmartBuyCardProps> = ({
  recommendation,
  rank,
  onSeeCombinations,
  isHero = false,
}) => {
  const { candidate, newOutfitsUnlocked, reason, compatibleExistingItems } = recommendation;

  const compatibleNames = compatibleExistingItems
    .slice(0, 3)
    .map((i) => i.name)
    .join(' · ');

  return (
    <article
      className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-(--card) p-4 sm:p-5 transition-all duration-300 ${
        isHero
          ? 'border-(--kumkum)/60 shadow-2xs'
          : 'border-(--border) hover:border-(--ink)'
      }`}
    >
      <div>
        {/* Header Tag */}
        <div className="flex items-center justify-between border-b border-(--border) pb-2 mb-3">
          <span className="text-[9.5px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
            {isHero ? 'THE ONE TO ADD' : `STRATEGIC ADDITION 0${rank}`}
          </span>
          <span className="rounded-md bg-(--ivory) px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-(--burnished-gold) border border-(--border)">
            +{newOutfitsUnlocked} New Looks
          </span>
        </div>

        {/* Piece Preview & Details */}
        <div className="flex gap-3.5 items-start">
          <div className="relative aspect-4/5 w-20 shrink-0 overflow-hidden rounded-xl border border-(--border) bg-(--ivory)">
            <LazyImage
              src={candidate.photo}
              alt={candidate.name}
              category={candidate.category}
              subcategory={candidate.subcategory}
              colors={candidate.colors}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-102"
            />
          </div>

          <div className="min-w-0 flex-1">
            <h4 className="font-serif text-lg font-normal text-(--ink) leading-snug">
              {candidate.name}
            </h4>
            <span className="inline-block mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-(--muted)">
              {candidate.category} Staple
            </span>

            {/* Works with exact existing items */}
            {compatibleNames && (
              <div className="mt-2 text-[10px] text-(--muted) leading-relaxed">
                <span className="font-bold uppercase tracking-wider text-(--burnished-gold)">Works with: </span>
                <span className="text-(--ink) font-medium">{compatibleNames}</span>
              </div>
            )}
          </div>
        </div>

        {/* Stylist Rationale: "Why this piece" */}
        <div className="mt-3 rounded-xl bg-(--ivory) p-3 border border-(--border)/70">
          <span className="block text-[9px] font-bold uppercase tracking-[0.18em] text-(--burnished-gold)">
            WHY THIS PIECE
          </span>
          <p className="mt-1 text-xs text-(--ink) font-normal leading-relaxed">
            {reason}
          </p>
        </div>
      </div>

      {/* Action Button */}
      <div className="mt-3.5 pt-2.5 border-t border-(--border) flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-(--muted) font-medium">
          Wardrobe Expansion
        </span>
        <button
          type="button"
          onClick={() => onSeeCombinations(recommendation)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-(--ink) bg-(--ink) px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-(--paper) transition-all hover:bg-(--ink)/90 active:scale-95"
        >
          <span>See {newOutfitsUnlocked} Looks</span>
          <ArrowRight className="h-3.5 w-3.5 text-(--burnished-gold)" />
        </button>
      </div>
    </article>
  );
};

