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

  // Breakdown compatible pieces by category for genuine wardrobe intelligence
  const compatibleTops = compatibleExistingItems.filter(
    (i) => i.category === 'Tops' || i.category === 'Dresses'
  ).length;
  const compatibleBottoms = compatibleExistingItems.filter(
    (i) => i.category === 'Bottoms'
  ).length;
  const compatibleEthnic = compatibleExistingItems.filter(
    (i) => i.category === 'Ethnic'
  ).length;

  return (
    <article
      className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-(--card) p-5 transition-all duration-300 ${
        isHero
          ? 'border-(--kumkum)/60 shadow-sm'
          : 'border-(--border) hover:border-(--ink)'
      }`}
    >
      <div>
        {/* Header Tag */}
        <div className="flex items-center justify-between border-b border-(--border) pb-2.5 mb-3.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
            {isHero ? 'THE ONE TO ADD' : `RECOMMENDATION 0${rank}`}
          </span>
          <span className="rounded bg-(--ivory) px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-(--burnished-gold) border border-(--border)">
            +{newOutfitsUnlocked} New Looks
          </span>
        </div>

        {/* Piece Preview & Details */}
        <div className="flex gap-4 items-start">
          <div className="relative aspect-4/5 w-24 shrink-0 overflow-hidden rounded-xl border border-(--border) bg-(--ivory)">
            <LazyImage
              src={candidate.photo}
              alt={candidate.name}
              category={candidate.category}
              subcategory={candidate.subcategory}
              colors={candidate.colors}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-103"
            />
          </div>

          <div className="min-w-0 flex-1">
            <h4 className="font-serif text-lg sm:text-xl font-normal text-(--ink) leading-snug">
              {candidate.name}
            </h4>
            <p className="mt-1 text-xs font-semibold text-(--muted)">
              {candidate.priceRange || '₹1,299–₹1,999'}
            </p>

            {/* Works with summary */}
            {compatibleExistingItems.length > 0 && (
              <div className="mt-2 text-[10px] font-medium text-(--muted) uppercase tracking-wide">
                <span>Works with: </span>
                <span className="text-(--ink) font-semibold">
                  {compatibleTops > 0 && `${compatibleTops} tops `}
                  {compatibleBottoms > 0 && `${compatibleBottoms} bottoms `}
                  {compatibleEthnic > 0 && `${compatibleEthnic} ethnic`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Stylist Rationale: "WHY THIS ONE" */}
        <div className="mt-3.5 rounded-xl bg-(--ivory) p-3 border border-(--border)/70">
          <span className="block text-[9px] font-bold uppercase tracking-[0.18em] text-(--burnished-gold)">
            WHY THIS ONE
          </span>
          <p className="mt-0.5 font-serif text-xs italic text-(--ink) leading-relaxed">
            &ldquo;{reason}&rdquo;
          </p>
        </div>
      </div>

      {/* Action Button */}
      <div className="mt-4 pt-3 border-t border-(--border) flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-(--muted) font-medium">
          {candidate.category} Staple
        </span>
        <button
          type="button"
          onClick={() => onSeeCombinations(recommendation)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-(--ink) bg-(--ink) px-4 py-2 text-xs font-semibold uppercase tracking-wider text-(--paper) transition-all hover:bg-(--ink)/90 active:scale-95"
        >
          <span>See {newOutfitsUnlocked} Looks</span>
          <ArrowRight className="h-3.5 w-3.5 text-(--burnished-gold)" />
        </button>
      </div>
    </article>
  );
};

