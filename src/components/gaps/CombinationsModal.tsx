import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
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
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Unlocked Combinations">
      <div className="space-y-5">
        {/* Candidate Card Header */}
        <div className="flex items-center gap-3.5 rounded-3xl border border-(--accent)/40 bg-(--accent-light)/40 p-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-(--border) bg-(--background)">
            <LazyImage
              src={candidate.photo}
              alt={candidate.name}
              category={candidate.category}
              subcategory={candidate.subcategory}
              colors={candidate.colors}
            />
          </div>
          <div className="min-w-0 flex-1">
            <span className="rounded-full bg-(--accent) px-2 py-0.5 text-[10px] font-bold text-white shadow-2xs">
              +{newOutfitsUnlocked} New Outfits
            </span>
            <h4 className="mt-1 truncate text-sm font-black text-(--text)">
              {candidate.name}
            </h4>
            <p className="text-xs font-semibold text-(--muted)">
              Estimated: {candidate.priceRange || '₹1,200–₹2,400'}
            </p>
          </div>
        </div>

        {/* Why this piece matters */}
        <div className="rounded-2xl border border-(--border) bg-(--background) p-3.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-(--accent)">
            Why this piece
          </span>
          <p className="mt-1 text-xs text-(--text) font-medium leading-relaxed">
            {reason}
          </p>
        </div>

        {/* Pairs with your existing pieces */}
        {compatibleExistingItems.length > 0 && (
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-(--muted) mb-2">
              Pairs with clothes you already own
            </h5>
            <div className="grid grid-cols-4 gap-2">
              {compatibleExistingItems.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col items-center rounded-xl border border-(--border) bg-(--card) p-1.5"
                >
                  <div className="aspect-square w-full overflow-hidden rounded-lg bg-(--background)">
                    <LazyImage
                      src={item.photo}
                      alt={item.name}
                      category={item.category}
                      subcategory={item.subcategory}
                      colors={item.colors}
                    />
                  </div>
                  <span className="mt-1 truncate w-full text-center text-[9px] font-semibold text-(--text)">
                    {item.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Preview Outfits Gallery */}
        <div>
          <h5 className="text-xs font-bold uppercase tracking-wider text-(--muted) mb-2.5">
            Preview of Unlocked Looks
          </h5>
          <div className="space-y-3">
            {previewOutfits.length === 0 ? (
              <p className="text-xs text-(--muted)">
                Adds {newOutfitsUnlocked} combination variations across Indian occasions.
              </p>
            ) : (
              previewOutfits.map((outfit, idx) => {
                const pieces = Object.values(outfit.slots).flat();
                return (
                  <div
                    key={idx}
                    className="rounded-2xl border border-(--border) bg-(--background) p-3"
                  >
                    <div className="flex items-center justify-between text-[11px] font-bold text-(--accent) mb-2">
                      <span>{outfit.template}</span>
                      <span className="text-(--muted) font-normal">&ldquo;{outfit.why}&rdquo;</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {pieces.map((p) => {
                        const isCandidatePiece = p.id === candidate.id;
                        return (
                          <div
                            key={p.id}
                            className={`flex flex-col items-center rounded-xl p-1.5 border ${
                              isCandidatePiece
                                ? 'border-(--accent) bg-(--accent-light)/50'
                                : 'border-(--border) bg-(--card)'
                            }`}
                          >
                            <div className="aspect-square w-full overflow-hidden rounded-lg bg-(--background)">
                              <LazyImage
                                src={p.photo}
                                alt={p.name}
                                category={p.category}
                                subcategory={p.subcategory}
                                colors={p.colors}
                              />
                            </div>
                            <span
                              className={`mt-1 truncate w-full text-center text-[9px] font-bold ${
                                isCandidatePiece ? 'text-(--accent)' : 'text-(--text)'
                              }`}
                            >
                              {p.name} {isCandidatePiece && '★'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full min-h-12 rounded-2xl bg-(--text) px-4 py-3 text-xs font-bold text-(--background) shadow-xs hover:opacity-90 active:scale-95"
        >
          Got It
        </button>
      </div>
    </BottomSheet>
  );
};
