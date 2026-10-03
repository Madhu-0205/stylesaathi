import React from 'react';
import { SmartBuyRecommendation } from '../../types';
import { BottomSheet } from '../common/BottomSheet';
import { LazyImage } from '../common/LazyImage';

interface CombinationsModalProps {
  recommendation: SmartBuyRecommendation | null;
  isOpen: boolean;
  onClose: () => void;
}

export const CombinationsModal: React.FC<CombinationsModalProps> = ({
  recommendation,
  isOpen,
  onClose,
}) => {
  if (!recommendation) return null;

  const { candidate, newOutfitsUnlocked, previewOutfits, compatibleExistingItems, reason } =
    recommendation;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="NEW LOOKS UNLOCKED">
      <div className="space-y-6 pb-4">
        {/* Candidate Stylist Spotlight */}
        <div className="rounded-2xl border border-(--burnished-gold)/50 bg-(--ivory) p-4">
          <div className="flex items-center gap-4">
            <div className="h-20 w-16 shrink-0 overflow-hidden rounded-xl border border-(--border) bg-(--paper)">
              <LazyImage
                src={candidate.photo}
                alt={candidate.name}
                category={candidate.category}
                subcategory={candidate.subcategory}
                colors={candidate.colors}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
                THE STAPLE PIECE
              </span>
              <h4 className="font-serif text-lg font-normal text-(--ink)">
                {candidate.name}
              </h4>
              <p className="text-xs text-(--muted) font-medium">
                {candidate.priceRange || '₹1,299–₹1,999'} · Unlocks {newOutfitsUnlocked} combinations
              </p>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-(--border)/70">
            <p className="font-serif text-xs italic text-(--ink) leading-relaxed">
              &ldquo;{reason}&rdquo;
            </p>
          </div>
        </div>

        {/* Pairs with your existing pieces */}
        {compatibleExistingItems.length > 0 && (
          <div>
            <div className="flex items-baseline justify-between mb-2.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-(--muted)">
                PAIRS WITH YOUR CLOSET
              </span>
              <span className="text-[11px] text-(--muted)">
                {compatibleExistingItems.length} matching pieces
              </span>
            </div>
            <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 py-1">
              {compatibleExistingItems.map((item) => (
                <div
                  key={item.id}
                  className="w-20 shrink-0 flex flex-col items-center rounded-xl border border-(--border) bg-(--card) p-1.5"
                >
                  <div className="aspect-square w-full overflow-hidden rounded-lg bg-(--ivory)">
                    <LazyImage
                      src={item.photo}
                      alt={item.name}
                      category={item.category}
                      subcategory={item.subcategory}
                      colors={item.colors}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <span className="mt-1.5 truncate w-full text-center text-[10px] font-medium text-(--ink)">
                    {item.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Editorial Gallery of Unlocked Outfits */}
        <div className="space-y-3">
          <div className="flex items-baseline justify-between border-b border-(--border) pb-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
              SIMULATED LOOKBOOK
            </span>
            <span className="text-[11px] text-(--muted)">
              {previewOutfits.length} featured {previewOutfits.length === 1 ? 'look' : 'looks'}
            </span>
          </div>

          {previewOutfits.length === 0 ? (
            <p className="text-xs text-(--muted) py-4 text-center italic">
              Adds {newOutfitsUnlocked} valid styling variations across your occasion calendar.
            </p>
          ) : (
            <div className="space-y-4">
              {previewOutfits.map((outfit, idx) => {
                const pieces = Object.values(outfit.slots).flat();
                return (
                  <article
                    key={idx}
                    className="rounded-2xl border border-(--border) bg-(--card) p-4 space-y-3 shadow-2xs"
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="font-serif text-sm font-semibold tracking-tight text-(--ink)">
                        LOOK 0{idx + 1}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-(--muted)">
                        {outfit.template}
                      </span>
                    </div>

                    {/* Pieces Grid */}
                    <div className="grid grid-cols-3 gap-2">
                      {pieces.map((p) => {
                        const isCandidatePiece = p.id === candidate.id;
                        return (
                          <div
                            key={p.id}
                            className={`relative flex flex-col overflow-hidden rounded-xl border p-1.5 transition-all ${
                              isCandidatePiece
                                ? 'border-(--burnished-gold) bg-(--ivory)'
                                : 'border-(--border) bg-(--paper)'
                            }`}
                          >
                            <div className="aspect-square w-full overflow-hidden rounded-lg bg-(--ivory)">
                              <LazyImage
                                src={p.photo}
                                alt={p.name}
                                category={p.category}
                                subcategory={p.subcategory}
                                colors={p.colors}
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <span
                              className={`mt-1.5 truncate text-center text-[10px] ${
                                isCandidatePiece
                                  ? 'font-bold text-(--kumkum)'
                                  : 'font-medium text-(--ink)'
                              }`}
                            >
                              {p.name}
                            </span>
                            {isCandidatePiece && (
                              <div className="absolute top-2 right-2 rounded bg-(--burnished-gold) px-1 py-0.2 text-[8px] font-bold uppercase tracking-wider text-(--paper)">
                                New
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <p className="font-serif text-xs italic text-(--muted) border-t border-(--border)/60 pt-2">
                      &ldquo;{outfit.why}&rdquo;
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full min-h-12 rounded-xl border border-(--ink) bg-(--ink) px-4 py-3 text-xs font-semibold uppercase tracking-wider text-(--paper) shadow-sm transition-all hover:bg-(--ink)/90 active:scale-98"
        >
          Close Lookbook
        </button>
      </div>
    </BottomSheet>
  );
};

