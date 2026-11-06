import React, { useState } from 'react';
import { Bookmark, Check, RefreshCw, Plus, Calendar, ThumbsDown, X, Layers } from 'lucide-react';
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
  anchorItem?: WardrobeItem | null;
  onOpenAccessoryDrawer: () => void;
  onMarkWorn: (outfit: GeneratedOutfit, accessory: WardrobeItem | null) => Promise<void>;
  onSaveOutfit: (outfit: GeneratedOutfit) => Promise<unknown>;
  onChangeLook?: () => void;
  onPlanLook?: (outfit: GeneratedOutfit) => void;
  onRejectLook?: (outfit: GeneratedOutfit, reason?: RejectionReason) => Promise<void>;
  onOpenInAtelier?: (outfit: GeneratedOutfit) => void;
  onInspectItem?: (item: WardrobeItem) => void;
}

export const OutfitCard: React.FC<OutfitCardProps> = ({
  outfit,
  index,
  occasion,
  accessory,
  context,
  anchorItem,
  onOpenAccessoryDrawer,
  onMarkWorn,
  onSaveOutfit,
  onChangeLook,
  onPlanLook,
  onRejectLook,
  onOpenInAtelier,
  onInspectItem,
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
  const whyReasons = outfit.explanation?.reasons?.length
    ? outfit.explanation.reasons
    : getOutfitWhyReasons(allPieces, occasion, outfit.score, preferences, styleProfile, context);

  const handleWoreClick = async () => {
    if (wornToday) return;
    setIsWearing(true);
    try {
      await onMarkWorn(outfit, accessory);
      setWornToday(true);
    } catch {
      // Rejection handled by onMarkWorn / markOutfitWornOnDate safeguard toast
    } finally {
      setIsWearing(false);
    }
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

  const roleBadges: Record<string, { label: string; className: string }> = {
    best_match: { label: 'Best Match', className: 'text-(--burnished-gold) border-(--burnished-gold)/40 bg-(--paper)/90' },
    alternative: { label: 'Alternative', className: 'text-(--ink)/80 border-border bg-card' },
    explore: { label: 'Explore', className: 'text-(--kumkum) border-(--kumkum)/30 bg-(--kumkum)/5' },
  };

  return (
    <article className="group relative overflow-hidden rounded-3xl glass-card specular-border p-4 sm:p-6 transition-[border-color,box-shadow] duration-200 hover:border-muted/60 animate-fade-in shadow-xs hover:shadow-md">
      {/* Top Editorial Header */}
      <div className="mb-3 flex items-baseline justify-between border-b border-border/80 pb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="editorial-kicker text-(--kumkum)">
              LOOK 0{index + 1} · {occasion}
            </span>
            {outfit.role && roleBadges[outfit.role] && (
              <span className={`text-[8.5px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${roleBadges[outfit.role].className}`}>
                {roleBadges[outfit.role].label}
              </span>
            )}
          </div>
          <h3 className="mt-0.5 editorial-headline text-2xl sm:text-3xl font-normal text-(--ink) tracking-tight">
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
              <div
                role={onInspectItem ? 'button' : undefined}
                tabIndex={onInspectItem ? 0 : undefined}
                onClick={() => onInspectItem?.(primarySlot[1][0])}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && onInspectItem) {
                    e.preventDefault();
                    onInspectItem(primarySlot[1][0]);
                  }
                }}
                className={`col-span-7 relative aspect-3/4 overflow-hidden rounded-xl border border-border/80 bg-(--ivory) ${
                  onInspectItem ? 'cursor-pointer hover:border-muted group/hero' : ''
                }`}
                title={onInspectItem ? `Inspect ${primarySlot[1][0].name}` : undefined}
              >
                <ItemImage
                  item={primarySlot[1][0]}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.01]"
                />
                <div className="absolute bottom-2 left-2 right-2 truncate rounded-md bg-(--ink)/85 px-2 py-1 text-[10px] font-medium text-(--paper) backdrop-blur-xs tracking-wide">
                  {primarySlot[1][0].name}
                </div>
                <div className="absolute top-2 left-2 text-[8.5px] font-bold uppercase tracking-wider text-(--burnished-gold) bg-(--paper)/95 px-1.5 py-0.5 rounded border border-border/50 shadow-2xs">
                  {anchorItem && primarySlot[1][0].id === anchorItem.id ? '✦ Anchor Piece' : 'Hero Piece'}
                </div>
                {primarySlot[1][0].fabric && (
                  <div className="absolute top-2 right-2 text-[8.5px] font-medium text-muted bg-(--paper)/95 px-1.5 py-0.5 rounded border border-border/50 capitalize shadow-2xs">
                    {primarySlot[1][0].fabric}
                  </div>
                )}
              </div>
            )}

            {/* Secondary Supporting Pieces Stack (Right ~42% width) */}
            <div className="col-span-5 flex flex-col gap-2 h-full">
              {secondarySlots.length <= 2 ? (
                secondarySlots.map(([slotName, items]) => {
                  const piece = items[0];
                  if (!piece) return null;
                  return (
                    <div
                      key={slotName}
                      role={onInspectItem ? 'button' : undefined}
                      tabIndex={onInspectItem ? 0 : undefined}
                      onClick={() => onInspectItem?.(piece)}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && onInspectItem) {
                          e.preventDefault();
                          onInspectItem(piece);
                        }
                      }}
                      className={`relative flex-1 min-h-0 h-full overflow-hidden rounded-xl border border-border/80 bg-(--ivory) ${
                        onInspectItem ? 'cursor-pointer hover:border-muted' : ''
                      }`}
                      title={onInspectItem ? `Inspect ${piece.name}` : undefined}
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
                    <div
                      role={onInspectItem ? 'button' : undefined}
                      tabIndex={onInspectItem ? 0 : undefined}
                      onClick={() => onInspectItem?.(secondarySlots[0][1][0])}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && onInspectItem) {
                          e.preventDefault();
                          onInspectItem(secondarySlots[0][1][0]);
                        }
                      }}
                      className={`relative flex-1 min-h-0 h-full overflow-hidden rounded-xl border border-border/80 bg-(--ivory) ${
                        onInspectItem ? 'cursor-pointer hover:border-muted' : ''
                      }`}
                      title={onInspectItem ? `Inspect ${secondarySlots[0][1][0].name}` : undefined}
                    >
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
                  <div className="grid grid-cols-2 gap-1.5 flex-1 min-h-0">
                    {secondarySlots.slice(1).map(([slotName, items]) => {
                      const piece = items[0];
                      if (!piece) return null;
                      return (
                        <div
                          key={slotName}
                          role={onInspectItem ? 'button' : undefined}
                          tabIndex={onInspectItem ? 0 : undefined}
                          onClick={() => onInspectItem?.(piece)}
                          onKeyDown={(e) => {
                            if ((e.key === 'Enter' || e.key === ' ') && onInspectItem) {
                              e.preventDefault();
                              onInspectItem(piece);
                            }
                          }}
                          className={`relative h-full overflow-hidden rounded-xl border border-border/80 bg-(--ivory) ${
                            onInspectItem ? 'cursor-pointer hover:border-muted' : ''
                          }`}
                          title={onInspectItem ? `Inspect ${piece.name}` : undefined}
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

            {/* Editorial Rationale: Transparent Output Contract */}
            <div className="mt-2.5 rounded-2xl bg-(--ivory) p-4 border border-border/80 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="block text-[9.5px] font-bold uppercase tracking-[0.2em] text-(--burnished-gold)">
                  WHY THIS WORKS
                </span>
                {outfit.explanation?.confidenceLevel && (
                  <span className="text-[8.5px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-(--paper) border border-border text-muted shadow-2xs">
                    {outfit.explanation.confidenceLevel} CONFIDENCE
                  </span>
                )}
              </div>
              <div className="gold-accent-rule my-1" />

              {/* Storytelling: Anchor Garment Identification */}
              <div className="text-[11px] text-(--ink) font-medium flex items-center gap-1.5 pb-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                <span className="truncate">
                  <strong className="font-semibold text-(--burnished-gold)">Anchor:</strong>{' '}
                  {anchorItem?.name || primarySlot?.[1]?.[0]?.name || 'Hero Piece'}
                </span>
              </div>

              {/* Storytelling: Occasion & Style Calibration */}
              <div className="text-[11px] text-muted font-sans flex items-center gap-1.5 pb-1">
                <span className="h-1.5 w-1.5 rounded-full bg-muted/60 shrink-0" />
                <span>
                  <strong className="text-(--ink)">Occasion Fit:</strong> Tailored for {occasion}
                </span>
              </div>

              <ul className="space-y-1 text-xs text-(--ink)">
                {whyReasons.map((reason, i) => (
                  <li key={`${reason}-${i}`} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-(--burnished-gold)" />
                    <span className="leading-snug text-[11.5px]">{reason}</span>
                  </li>
                ))}
              </ul>
              {outfit.explanation?.culturalRationale && (
                <div className="pt-2 border-t border-border/50 text-[11px] text-(--kumkum)">
                  <span className="font-semibold">Cultural Rationale:</span> {outfit.explanation.culturalRationale}
                </div>
              )}
              {outfit.explanation?.weatherComfortRationale && (
                <div className="pt-1.5 border-t border-border/50 text-[11px] text-muted">
                  <span className="font-semibold text-(--ink)">Climate &amp; Comfort:</span> {outfit.explanation.weatherComfortRationale}
                </div>
              )}
              {outfit.explanation?.assumptions && outfit.explanation.assumptions.length > 0 && (
                <div className="pt-1.5 border-t border-border/50 text-[10.5px] text-muted italic">
                  <span>Assumptions: {outfit.explanation.assumptions.join(' ')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Editorial Actions: CHANGE LOOK / WEAR TODAY / SAVE / NOT FOR ME */}
          <div className="flex items-center gap-2 pt-2 border-t border-border/60">
            {onChangeLook && (
              <button
                type="button"
                onClick={onChangeLook}
                className="flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-xs font-semibold text-muted transition-all hover:border-(--ink) hover:text-(--ink) active:scale-95 tactile-press"
                title="Alternative combination"
              >
                <RefreshCw className="h-3.5 w-3.5 text-muted" />
                <span className="hidden sm:inline">Shuffle</span>
              </button>
            )}

            {onOpenInAtelier && (
              <button
                type="button"
                onClick={() => onOpenInAtelier(outfit)}
                className="flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 text-xs font-semibold text-amber-900 dark:text-amber-200 transition-all hover:bg-amber-500/20 active:scale-95 tactile-press"
                title="Open in 3D Atelier"
                aria-label="Open in 3D Atelier"
              >
                <Layers className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span className="hidden sm:inline">3D Atelier</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleWoreClick}
              disabled={wornToday || isWearing}
              className={`flex-1 min-h-11 inline-flex items-center justify-center gap-1.5 rounded-full border text-xs font-semibold tracking-wide transition-all tactile-press ${
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
                className="flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold text-muted transition-all hover:border-(--burnished-gold) hover:text-(--ink) active:scale-95 tactile-press"
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
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-all tactile-press ${
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
                className={`flex min-h-11 items-center justify-center gap-1 rounded-full border px-2.5 text-xs font-semibold transition-all tactile-press ${
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
            <div className="mt-2.5 rounded-2xl border border-border/80 bg-(--ivory) p-3.5 animate-fade-in space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="editorial-kicker text-(--kumkum)">
                  Why doesn&apos;t this look work for you?
                </span>
                <button
                  type="button"
                  onClick={() => setShowFeedback(false)}
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-xs text-muted hover:text-(--ink) hover:bg-card"
                  aria-label="Dismiss feedback dialog"
                >
                  <X className="h-3.5 w-3.5" />
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
                    className="min-h-11 rounded-xl border border-border bg-card px-3 py-2 text-[11px] font-semibold text-(--ink) transition-all hover:border-(--kumkum) hover:text-(--kumkum) active:scale-95 tactile-press-sm select-none"
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-border/60 text-[10.5px]">
                <button
                  type="button"
                  onClick={async () => {
                    setShowFeedback(false);
                    await onRejectLook(outfit);
                  }}
                  className="min-h-11 flex items-center text-muted hover:text-(--ink) underline py-1 tactile-press-sm"
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

