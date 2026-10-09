import React, { useState } from 'react';
import {
  Pin,
  RefreshCw,
  Bookmark,
  Check,
  AlertTriangle,
  Sparkles,
  Info,
  ThumbsDown,
  Layers,
} from 'lucide-react';
import { WardrobeItem, Occasion, RejectionReason } from '../../types';
import { OCCASIONS } from '../../data/taxonomy';
import { BottomSheet } from '../common/BottomSheet';
import { ItemImage } from '../common/ItemImage';
import { Chip } from '../common/Chip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useStyleThisItem } from '../../hooks/useStyleThisItem';

export interface StyleItemSheetProps {
  anchorItem: WardrobeItem | null;
  isOpen: boolean;
  onClose: () => void;
}

const REJECTION_OPTIONS: { reason: RejectionReason; label: string }[] = [
  { reason: 'not_my_style', label: 'Not my style' },
  { reason: 'too_formal', label: 'Too formal' },
  { reason: 'too_casual', label: 'Too casual' },
  { reason: 'dislike_combination', label: 'Dislike combo' },
  { reason: 'other', label: 'Other' },
];

export const StyleItemSheet: React.FC<StyleItemSheetProps> = ({
  anchorItem,
  isOpen,
  onClose,
}) => {
  if (!anchorItem) return null;

  const {
    occasion,
    setOccasion,
    outfits,
    activeOutfit,
    activeRoleIndex,
    setActiveRoleIndex,
    missingRequirements,
    laundryWarning,
    shuffle,
    woreToday,
    saveLook,
    rejectLook,
  } = useStyleThisItem(anchorItem);

  const [wornSuccess, setWornSuccess] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showRejectMenu, setShowRejectMenu] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);

  const handleShuffle = () => {
    setIsShuffling(true);
    shuffle();
    setTimeout(() => setIsShuffling(false), 300);
  };

  const handleWearToday = async () => {
    if (!activeOutfit) return;
    await woreToday(activeOutfit);
    setWornSuccess(true);
    setTimeout(() => setWornSuccess(false), 2500);
  };

  const handleSaveLook = async () => {
    if (!activeOutfit) return;
    await saveLook(activeOutfit);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleReject = async (reason?: RejectionReason) => {
    if (!activeOutfit) return;
    await rejectLook(activeOutfit, reason);
    setShowRejectMenu(false);
  };

  const roles = [
    { label: 'Best Match', index: 0 },
    { label: 'Alternative', index: 1 },
    { label: 'Explore', index: 2 },
  ];

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="STYLE THIS ITEM">
      <div className="space-y-4 pb-8 max-w-md mx-auto">
        {/* Anchor Garment Hero Header */}
        <div className="flex items-center gap-3.5 rounded-2xl border border-border bg-(--paper) p-3 shadow-xs">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-border bg-(--ivory)">
            <ItemImage
              item={anchorItem}
              className="h-full w-full object-contain p-1"
            />
            <div
              className="absolute top-1 left-1 flex items-center justify-center rounded-full bg-(--ink) p-1 text-(--paper) shadow-xs"
              title="Anchor Garment"
            >
              <Pin className="h-3 w-3 fill-(--burnished-gold) text-(--burnished-gold)" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge
                variant="outline"
                className="border-(--burnished-gold)/40 bg-(--burnished-gold)/10 text-(--ink) text-[9px] font-bold uppercase tracking-wider"
              >
                <Pin className="h-2.5 w-2.5 mr-1 text-(--burnished-gold)" />
                Anchor Piece · Locked
              </Badge>
              <span className="text-[10px] uppercase tracking-wider text-muted font-medium">
                {anchorItem.category}
              </span>
            </div>
            <h3 className="font-serif text-base font-normal text-(--ink) truncate mt-0.5">
              {anchorItem.name}
            </h3>
            <p className="text-[11px] text-muted italic capitalize truncate">
              {anchorItem.colors?.[0] || 'neutral'} {anchorItem.subcategory || ''}
            </p>
          </div>
        </div>

        {/* Laundry Policy Prominent Warning Banner */}
        {laundryWarning && (
          <div
            role="alert"
            className="flex items-center gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-300 font-medium"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="flex-1 text-[11px] leading-tight">
              <span className="font-bold">{laundryWarning}</span>
              <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                Styling this item for planning. Clean it before wearing.
              </p>
            </div>
          </div>
        )}

        {/* Occasion Selector Chips */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted block mb-1.5">
            STYLING OCCASION
          </label>
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {OCCASIONS.map((occ) => (
              <Chip
                key={occ}
                label={occ}
                active={occasion === occ}
                onClick={() => setOccasion(occ as Occasion)}
              />
            ))}
          </div>
        </div>

        {/* Curated Outfits vs Sparse Wardrobe Guidance */}
        {outfits.length > 0 && activeOutfit ? (
          <div className="space-y-3.5 pt-1">
            {/* Role Switcher Tabs */}
            <div className="flex items-center justify-between border-b border-border pb-1">
              <div className="flex gap-1">
                {roles.slice(0, outfits.length).map((r) => (
                  <button
                    key={r.label}
                    type="button"
                    onClick={() => setActiveRoleIndex(r.index)}
                    className={`min-h-11 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                      activeRoleIndex === r.index
                        ? 'bg-(--ink) text-(--paper) shadow-xs'
                        : 'text-muted hover:text-(--ink) hover:bg-(--ivory)'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleShuffle}
                aria-label="Shuffle look variations"
                className="flex min-h-11 items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-muted hover:text-(--ink) transition-colors active:scale-95"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isShuffling ? 'animate-spin' : ''}`}
                />
                <span>Shuffle</span>
              </button>
            </div>

            {/* Look Explanation Card */}
            <div className="rounded-xl border border-border/80 bg-(--paper) p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-serif text-sm font-semibold text-(--ink)">
                  {activeOutfit.explanation?.headline || 'Curated Anchored Look'}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-(--burnished-gold)">
                  {activeOutfit.template}
                </span>
              </div>
              {activeOutfit.explanation?.reasons && activeOutfit.explanation.reasons.length > 0 && (
                <ul className="space-y-1 text-xs text-muted">
                  {activeOutfit.explanation.reasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[11px] leading-relaxed">
                      <span className="text-(--burnished-gold) mt-0.5">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Styled Outfit Pieces Grid */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted block">
                COMPOSITE ENSEMBLE
              </label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(activeOutfit.slots).flatMap(([slotName, pieces]) =>
                  pieces.map((piece) => {
                    const isAnchor = piece.id === anchorItem.id;
                    return (
                      <div
                        key={`${slotName}-${piece.id}`}
                        className={`flex items-center gap-2.5 rounded-xl border p-2 transition-colors ${
                          isAnchor
                            ? 'border-(--burnished-gold) bg-(--burnished-gold)/5 ring-1 ring-(--burnished-gold)/30'
                            : 'border-border bg-(--paper)'
                        }`}
                      >
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-(--ivory)">
                          <ItemImage
                            item={piece}
                            className="h-full w-full object-contain p-0.5"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            {isAnchor ? (
                              <span className="text-[8px] font-bold uppercase tracking-wider text-(--burnished-gold)">
                                Anchor
                              </span>
                            ) : (
                              <span className="text-[8px] font-bold uppercase tracking-wider text-muted">
                                {slotName}
                              </span>
                            )}
                          </div>
                          <p className="font-serif text-xs font-normal text-(--ink) truncate">
                            {piece.name}
                          </p>
                          <p className="text-[10px] text-muted truncate capitalize">
                            {piece.colors?.[0] || ''} {piece.subcategory || piece.category}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Actions Bar (44px+ touch targets) */}
            <div className="space-y-2 pt-2">
              <div className="flex gap-2">
                <Button
                  size="lg"
                  onClick={handleWearToday}
                  disabled={wornSuccess}
                  className="flex-1 min-h-12 font-semibold tracking-wider uppercase rounded-xl focus-editorial"
                >
                  {wornSuccess ? (
                    <>
                      <Check className="h-4 w-4 mr-1.5 text-emerald-400" />
                      Logged for Today
                    </>
                  ) : (
                    'Wear Today'
                  )}
                </Button>

                <button
                  type="button"
                  onClick={handleSaveLook}
                  disabled={savedSuccess}
                  aria-label="Save outfit look"
                  className="flex min-h-12 w-12 items-center justify-center rounded-xl border border-border bg-(--paper) text-(--ink) transition-colors hover:bg-(--ivory) focus-editorial active:scale-95"
                >
                  {savedSuccess ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Bookmark className="h-4 w-4 text-(--ink)" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowRejectMenu(!showRejectMenu)}
                  aria-label="Not for me"
                  className="flex min-h-12 w-12 items-center justify-center rounded-xl border border-border bg-(--paper) text-muted transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400 focus-editorial active:scale-95"
                >
                  <ThumbsDown className="h-4 w-4" />
                </button>
              </div>

              {/* Feedback reason dropdown if requested */}
              {showRejectMenu && (
                <div className="rounded-xl border border-border bg-(--paper) p-2.5 space-y-1.5 animate-fade-in">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                    Tell us why to improve styling:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {REJECTION_OPTIONS.map((opt) => (
                      <button
                        key={opt.reason}
                        type="button"
                        onClick={() => handleReject(opt.reason)}
                        className="px-2.5 py-1 rounded-md border border-border bg-(--ivory) text-[11px] font-medium text-(--ink) hover:bg-(--ink) hover:text-(--paper) transition-colors"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Sparse Wardrobe / Missing Role Guidance */
          <div className="rounded-2xl border border-dashed border-border bg-(--paper)/60 p-5 text-center space-y-3 my-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-(--ivory) text-(--burnished-gold)">
              <Layers className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h4 className="font-serif text-base font-normal text-(--ink)">
                Complete Your Ensemble
              </h4>
              <p className="text-xs text-muted max-w-xs mx-auto leading-relaxed">
                {missingRequirements && missingRequirements.length > 0
                  ? missingRequirements[0].explanation
                  : `Your ${anchorItem.name} needs compatible wardrobe companions to create a complete look for ${occasion}.`}
              </p>
            </div>

            {missingRequirements && missingRequirements.length > 0 && (
              <div className="pt-2 border-t border-border/80 text-left space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-(--ink)">Missing Requirement:</span>
                  <Badge variant="outline" className="capitalize text-[10px] font-bold">
                    {missingRequirements[0].missingRole} ({missingRequirements[0].expectedCategory})
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {missingRequirements[0].compatibleSubcategories.map((sc) => (
                    <span
                      key={sc}
                      className="inline-block rounded-md bg-(--ivory) px-2 py-0.5 text-[10px] font-medium text-muted capitalize border border-border/60"
                    >
                      {sc}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </BottomSheet>
  );
};
