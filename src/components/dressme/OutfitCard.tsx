import React, { useState } from 'react';
import { Bookmark, Check, RefreshCw, Plus, Calendar, ThumbsDown } from 'lucide-react';
import { GeneratedOutfit, WardrobeItem, Occasion, RejectionReason, ContextSnapshot } from '../../types';
import { ItemImage } from '../common/ItemImage';
import { getOutfitWhyReasons } from '../../engine/scoring';
import { useWardrobeContext } from '../../context/WardrobeContext';

const REJECTION_OPTIONS: { reason: RejectionReason; label: string }[] = [
  { reason: 'not_my_style', label: 'Not my style' },
  { reason: 'too_hot', label: 'Too hot' },
  { reason: 'too_cold', label: 'Too cold' },
  { reason: 'too_formal', label: 'Too formal' },
  { reason: 'too_casual', label: 'Too casual' },
  { reason: 'wrong_color', label: 'Wrong color' },
  { reason: 'wrong_pattern', label: 'Wrong pattern' },
  { reason: 'wrong_fit', label: 'Wrong fit' },
  { reason: 'dislike_combination', label: 'Dislike combo' },
  { reason: 'other', label: 'Other' },
];

interface OutfitCardProps {
  outfit: GeneratedOutfit;
  index: number;
  occasion: Occasion;
  accessory: WardrobeItem | null;
  context?: ContextSnapshot;
  onOpenAccessoryDrawer: () => void;
  onMarkWorn: (outfit: GeneratedOutfit, accessory: WardrobeItem | null) => Promise<void>;
  onSaveOutfit: (outfit: GeneratedOutfit) => Promise<any>;
  onChangeLook?: () => void;
  onPlanLook?: (outfit: GeneratedOutfit) => void;
  onRejectLook?: (outfit: GeneratedOutfit, reason?: RejectionReason) => Promise<void>;
}

export const OutfitCard: React.FC<OutfitCardProps> = ({
  outfit,
  index,
  occasion,
  accessory,
  context,
  onOpenAccessoryDrawer,
  onMarkWorn,
  onSaveOutfit,
  onChangeLook,
  onPlanLook,
  onRejectLook,
}) => {
  const { preferences, styleProfile } = useWardrobeContext();
  const [wornToday, setWornToday] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isWearing, setIsWearing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  // Extract core pieces from slots
  const allSlotEntries = Object.entries(outfit.slots);
  const primarySlot = allSlotEntries[0]; // e.g. top or dress or saree
  const secondarySlots = allSlotEntries.slice(1); // e.g. bottom, footwear, dupatta, jacket

  // Form a readable piece list string
  const allPieces = Object.values(outfit.slots).flat();
  const pieceNames = allPieces.map((p) => p.name);
  if (accessory) pieceNames.push(accessory.name);
  const pieceSummary = pieceNames.join(' · ');

  // Get 2-3 concise editorial why reasons, informed by Personal Style Brain and Climate Context
  const whyReasons = getOutfitWhyReasons(allPieces, occasion, outfit.score, preferences, styleProfile, context);

  const handleWoreClick = async () => {
    if (wornToday) return;
    setIsWearing(true);
    await onMarkWorn(outfit, accessory);
    setIsWearing(false);
    setWornToday(true);
  };

  const handleSaveClick = async () => {
    if (saved) return;
    setIsSaving(true);
    await onSaveOutfit(outfit);
    setIsSaving(false);
    setSaved(true);
  };

  // Editorial look title
  const editorialTitles = [
    'The Understated Classic',
    'The Modern Proportion',
    'The Weekend Tailoring',
    'The Contemporary Drape',
    'The Effortless Fusion',
    'The Everyday Silhouette',
  ];
  const lookTitle = editorialTitles[index % editorialTitles.length];

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 sm:p-5 transition-all duration-300 animate-fade-in shadow-2xs">
      {/* Top Editorial Header */}
      <div className="mb-3 flex items-baseline justify-between border-b border-border pb-2.5">
        <div>
          <span className="text-[9.5px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
            LOOK 0{index + 1} · {occasion}
          </span>
          <h3 className="mt-0.5 font-serif text-xl sm:text-2xl font-normal text-(--ink) tracking-tight">
            {lookTitle}
          </h3>
        </div>
        <span className="text-[9.5px] font-medium uppercase tracking-[0.14em] text-muted">
          {outfit.template}
        </span>
      </div>

      {/* Universal Responsive Composition:
          - Phone (<768px): Vertical stack with asymmetric visual hero + supporting stack
          - Tablet / Desktop (>=768px): Two-region composition with Look on left, Styling Info + Actions on right
      */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-6 items-start">
        {/* Left Region: Visual Composition (Hero Garment + Supporting Garments) */}
        <div className="md:col-span-7">
          <div className="grid grid-cols-12 gap-2 sm:gap-2.5">
            {/* Large Primary Hero Garment (Left ~58% width on phone, proportional on desktop) */}
            {primarySlot && primarySlot[1][0] && (
              <div className="col-span-7 relative aspect-3/4 overflow-hidden rounded-xl border border-(--border)/80 bg-(--ivory)">
                <ItemImage
                  item={primarySlot[1][0]}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-101"
                />
                <div className="absolute bottom-2 left-2 right-2 truncate rounded-md bg-(--ink)/80 px-2 py-1 text-[10px] font-medium text-(--paper) backdrop-blur-xs tracking-wide">
                  {primarySlot[1][0].name}
                </div>
                <div className="absolute top-2 left-2 text-[8.5px] font-bold uppercase tracking-wider text-(--burnished-gold) bg-(--paper)/90 px-1.5 py-0.5 rounded border border-(--border)/50">
                  Hero Piece
                </div>
              </div>
            )}

            {/* Secondary Supporting Pieces Stack (Right ~42% width) */}
            <div className="col-span-5 flex flex-col gap-2">
              {secondarySlots.length <= 2 ? (
                secondarySlots.map(([slotName, items]) => {
                  const piece = items[0];
                  if (!piece) return null;
                  return (
                    <div
                      key={slotName}
                      className="relative flex-1 min-h-24 overflow-hidden rounded-xl border border-(--border)/80 bg-(--ivory)"
                    >
                      <ItemImage
                        item={piece}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute bottom-1.5 left-1.5 right-1.5 truncate rounded bg-(--ink)/80 px-1.5 py-0.5 text-[9px] font-medium text-(--paper) backdrop-blur-xs">
                        {piece.name}
                      </div>
                    </div>
                  );
                })
              ) : (
                <>
                  {/* First secondary piece (e.g. Kurta / Top) */}
                  {secondarySlots[0] && secondarySlots[0][1][0] && (
                    <div className="relative flex-1 min-h-24 overflow-hidden rounded-xl border border-(--border)/80 bg-(--ivory)">
                      <ItemImage
                        item={secondarySlots[0][1][0]}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute bottom-1.5 left-1.5 right-1.5 truncate rounded bg-(--ink)/80 px-1.5 py-0.5 text-[9px] font-medium text-(--paper) backdrop-blur-xs">
                        {secondarySlots[0][1][0].name}
                      </div>
                    </div>
                  )}
                  {/* Remaining secondary pieces side-by-side (e.g. Bottom + Footwear) */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {secondarySlots.slice(1).map(([slotName, items]) => {
                      const piece = items[0];
                      if (!piece) return null;
                      return (
                        <div
                          key={slotName}
                          className="relative aspect-square overflow-hidden rounded-xl border border-(--border)/80 bg-(--ivory)"
                        >
                          <ItemImage
                            item={piece}
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute bottom-1 left-1 right-1 truncate rounded bg-(--ink)/80 px-1 py-0.5 text-[8px] font-medium text-(--paper) backdrop-blur-xs">
                            {piece.name}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Region: Styling Information & Actions */}
        <div className="md:col-span-5 flex flex-col justify-between h-full space-y-3">
          <div>
            {/* Piece Summary & Optional Accessory Accent Row */}
            <div className="flex items-center justify-between gap-2 border-b md:border-t-0 border-t border-border pt-2 md:pt-0 pb-2">
              <p className="text-[11px] text-muted font-medium tracking-tight truncate flex-1">
                {pieceSummary}
              </p>

              {accessory ? (
                <button
                  type="button"
                  onClick={onOpenAccessoryDrawer}
                  className="inline-flex shrink-0 min-h-11 items-center gap-1.5 rounded-xl border border-(--burnished-gold) bg-(--ivory) px-3 py-1.5 text-[11px] font-semibold text-(--ink) transition-colors hover:border-(--kumkum) focus-editorial active:scale-95"
                  title="Change accessory"
                >
                  <span className="text-[9px] uppercase font-bold text-(--burnished-gold)">ACCENT:</span>
                  <span className="truncate max-w-28">{accessory.name}</span>
                  <RefreshCw className="h-3 w-3 text-(--burnished-gold)" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenAccessoryDrawer}
                  className="inline-flex shrink-0 min-h-11 items-center gap-1.5 rounded-xl border border-dashed border-border bg-(--ivory)/60 px-3 py-1.5 text-[11px] font-semibold text-muted transition-colors hover:border-(--kumkum) hover:text-(--ink) focus-editorial active:scale-95"
                >
                  <Plus className="h-3 w-3 text-(--burnished-gold)" />
                  <span>Finish Look</span>
                </button>
              )}
            </div>

            {/* Editorial Rationale: "WHY THIS WORKS" — 2–3 concise bullets */}
            <div className="mt-2.5 rounded-xl bg-(--ivory) p-3.5 border border-(--border)/80">
              <span className="block text-[9px] font-bold uppercase tracking-[0.2em] text-(--burnished-gold)">
                WHY THIS WORKS
              </span>
              <ul className="mt-1.5 space-y-1 text-xs text-(--ink)">
                {whyReasons.map((reason, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-(--burnished-gold)" />
                    <span className="leading-snug text-[11.5px]">{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Editorial Actions: CHANGE LOOK / WEAR TODAY / SAVE / NOT FOR ME */}
          <div className="flex items-center gap-2 pt-2 border-t border-(--border)/60">
            {onChangeLook && (
              <button
                type="button"
                onClick={onChangeLook}
                className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-muted transition-all hover:border-(--ink) hover:text-(--ink) active:scale-95"
                title="Alternative combination"
              >
                <RefreshCw className="h-3.5 w-3.5 text-muted" />
                <span className="hidden sm:inline">Shuffle</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleWoreClick}
              disabled={wornToday || isWearing}
              className={`flex-1 min-h-11 inline-flex items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold tracking-wide transition-all ${
                wornToday
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 cursor-default'
                  : 'border-(--ink) bg-(--ink) text-(--paper) hover:bg-(--ink)/90 active:scale-98'
              }`}
            >
              {wornToday ? (
                <>
                  <Check className="h-3.5 w-3.5 stroke-3 text-emerald-600 dark:text-emerald-400" />
                  <span>Worn Today</span>
                </>
              ) : (
                <span>Wear Today</span>
              )}
            </button>

            {onPlanLook && (
              <button
                type="button"
                onClick={() => onPlanLook(outfit)}
                className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-muted transition-all hover:border-(--burnished-gold) hover:text-(--ink) active:scale-95"
                title="Plan this look on Style Calendar"
              >
                <Calendar className="h-3.5 w-3.5 text-(--burnished-gold)" />
                <span>Plan</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSaveClick}
              disabled={saved || isSaving}
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-3.5 text-xs font-semibold transition-all ${
                saved
                  ? 'border-(--kumkum) bg-(--kumkum) text-white'
                  : 'border-border bg-card text-muted hover:border-(--kumkum) hover:text-(--kumkum) active:scale-95'
              }`}
              title={saved ? 'Saved to Favorites' : 'Save Look'}
            >
              <Bookmark className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} />
              <span>{saved ? 'Saved' : 'Save'}</span>
            </button>

            {onRejectLook && (
              <button
                type="button"
                onClick={() => setShowFeedback((prev) => !prev)}
                className={`flex min-h-11 items-center justify-center gap-1 rounded-xl border px-2.5 text-xs font-semibold transition-all ${
                  showFeedback
                    ? 'border-(--kumkum) bg-(--kumkum)/10 text-(--kumkum)'
                    : 'border-border bg-card text-muted hover:border-(--kumkum) hover:text-(--kumkum) active:scale-95'
                }`}
                title="Not for me (refine style)"
                aria-label="Not for me"
              >
                <ThumbsDown className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Pass</span>
              </button>
            )}
          </div>

          {/* Structured Feedback Drawer (Low Friction 1-2 Taps) */}
          {showFeedback && onRejectLook && (
            <div className="mt-2.5 rounded-xl border border-(--border)/80 bg-(--ivory) p-3 animate-fade-in space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[9.5px] font-bold uppercase tracking-wider text-(--kumkum)">
                  Why doesn't this look work for you?
                </span>
                <button
                  type="button"
                  onClick={() => setShowFeedback(false)}
                  className="text-xs text-muted hover:text-(--ink) px-1"
                  aria-label="Dismiss feedback dialog"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {REJECTION_OPTIONS.map(({ reason, label }) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={async () => {
                      setShowFeedback(false);
                      await onRejectLook(outfit, reason);
                    }}
                    className="min-h-8 rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-(--ink) transition-all hover:border-(--kumkum) hover:text-(--kumkum) active:scale-95"
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="pt-1.5 flex items-center justify-between border-t border-(--border)/60 text-[10.5px]">
                <button
                  type="button"
                  onClick={async () => {
                    setShowFeedback(false);
                    await onRejectLook(outfit);
                  }}
                  className="text-muted hover:text-(--ink) underline py-1"
                >
                  Just dismiss without reason
                </button>
                <span className="text-muted italic">Teaches your StyleSaathi</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
};

