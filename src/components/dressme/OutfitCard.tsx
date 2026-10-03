import React, { useState } from 'react';
import { Bookmark, Check, RefreshCw, Plus } from 'lucide-react';
import { GeneratedOutfit, WardrobeItem, Occasion } from '../../types';
import { LazyImage } from '../common/LazyImage';
import { getOutfitWhyReasons } from '../../engine/scoring';

interface OutfitCardProps {
  outfit: GeneratedOutfit;
  index: number;
  occasion: Occasion;
  accessory: WardrobeItem | null;
  onOpenAccessoryDrawer: () => void;
  onMarkWorn: (outfit: GeneratedOutfit, accessory: WardrobeItem | null) => Promise<void>;
  onSaveOutfit: (outfit: GeneratedOutfit) => Promise<any>;
  onChangeLook?: () => void;
}

export const OutfitCard: React.FC<OutfitCardProps> = ({
  outfit,
  index,
  occasion,
  accessory,
  onOpenAccessoryDrawer,
  onMarkWorn,
  onSaveOutfit,
  onChangeLook,
}) => {
  const [wornToday, setWornToday] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isWearing, setIsWearing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Extract core pieces from slots
  const allSlotEntries = Object.entries(outfit.slots);
  const primarySlot = allSlotEntries[0]; // e.g. top or dress or saree
  const secondarySlots = allSlotEntries.slice(1); // e.g. bottom, footwear, dupatta, jacket

  // Form a readable piece list string
  const allPieces = Object.values(outfit.slots).flat();
  const pieceNames = allPieces.map((p) => p.name);
  if (accessory) pieceNames.push(accessory.name);
  const pieceSummary = pieceNames.join(' · ');

  // Get 2-3 concise editorial why reasons
  const whyReasons = getOutfitWhyReasons(allPieces, occasion, outfit.score);

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
    <article className="group relative overflow-hidden rounded-2xl border border-(--border) bg-(--card) p-4 sm:p-5 transition-all duration-300 animate-fade-in shadow-2xs">
      {/* Top Editorial Header */}
      <div className="mb-3 flex items-baseline justify-between border-b border-(--border) pb-2.5">
        <div>
          <span className="text-[9.5px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
            LOOK 0{index + 1} · {occasion}
          </span>
          <h3 className="mt-0.5 font-serif text-xl sm:text-2xl font-normal text-(--ink) tracking-tight">
            {lookTitle}
          </h3>
        </div>
        <span className="text-[9.5px] font-medium uppercase tracking-[0.14em] text-(--muted)">
          {outfit.template}
        </span>
      </div>

      {/* Editorial Asymmetric Visual Composition: Primary Piece dominant on Left, Secondary Pieces stacked on Right */}
      <div className="grid grid-cols-12 gap-2 sm:gap-2.5">
        {/* Large Primary Hero Garment (Left ~58% width) */}
        {primarySlot && primarySlot[1][0] && (
          <div className="col-span-7 relative aspect-3/4 overflow-hidden rounded-xl border border-(--border)/80 bg-(--ivory)">
            <LazyImage
              src={primarySlot[1][0].photo}
              alt={primarySlot[1][0].name}
              category={primarySlot[1][0].category}
              subcategory={primarySlot[1][0].subcategory}
              colors={primarySlot[1][0].colors}
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
                  className="relative flex-1 min-h-[96px] overflow-hidden rounded-xl border border-(--border)/80 bg-(--ivory)"
                >
                  <LazyImage
                    src={piece.photo}
                    alt={piece.name}
                    category={piece.category}
                    subcategory={piece.subcategory}
                    colors={piece.colors}
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
                <div className="relative flex-1 min-h-[96px] overflow-hidden rounded-xl border border-(--border)/80 bg-(--ivory)">
                  <LazyImage
                    src={secondarySlots[0][1][0].photo}
                    alt={secondarySlots[0][1][0].name}
                    category={secondarySlots[0][1][0].category}
                    subcategory={secondarySlots[0][1][0].subcategory}
                    colors={secondarySlots[0][1][0].colors}
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
                      <LazyImage
                        src={piece.photo}
                        alt={piece.name}
                        category={piece.category}
                        subcategory={piece.subcategory}
                        colors={piece.colors}
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

      {/* Piece Summary & Optional Accessory Accent Row */}
      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-(--border) pt-2">
        <p className="text-[11px] text-(--muted) font-medium tracking-tight truncate flex-1">
          {pieceSummary}
        </p>

        {accessory ? (
          <button
            type="button"
            onClick={onOpenAccessoryDrawer}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-(--burnished-gold) bg-(--ivory) px-2 py-0.5 text-[10px] font-semibold text-(--ink) transition-colors hover:border-(--kumkum)"
            title="Change accessory"
          >
            <span className="text-[8.5px] uppercase font-bold text-(--burnished-gold)">ACCENT:</span>
            <span className="truncate max-w-[80px]">{accessory.name}</span>
            <RefreshCw className="h-2.5 w-2.5 text-(--burnished-gold)" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenAccessoryDrawer}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-dashed border-(--border) bg-(--ivory)/60 px-2 py-0.5 text-[10px] font-semibold text-(--muted) transition-colors hover:border-(--kumkum) hover:text-(--ink)"
          >
            <Plus className="h-2.5 w-2.5 text-(--burnished-gold)" />
            <span>Finish Look</span>
          </button>
        )}
      </div>

      {/* Editorial Rationale: "WHY THIS WORKS" — 2–3 concise bullets */}
      <div className="mt-2.5 rounded-xl bg-(--ivory) p-3 border border-(--border)/80">
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


      {/* Editorial Actions: CHANGE LOOK / WEAR TODAY / SAVE */}
      <div className="mt-3 flex items-center gap-2 pt-1 border-t border-(--border)/60">
        {onChangeLook && (
          <button
            type="button"
            onClick={onChangeLook}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-(--border) bg-(--card) px-3 text-xs font-semibold text-(--muted) transition-all hover:border-(--ink) hover:text-(--ink) active:scale-95"
            title="Alternative combination"
          >
            <RefreshCw className="h-3.5 w-3.5 text-(--muted)" />
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

        <button
          type="button"
          onClick={handleSaveClick}
          disabled={saved || isSaving}
          className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-3.5 text-xs font-semibold transition-all ${
            saved
              ? 'border-(--kumkum) bg-(--kumkum) text-white'
              : 'border-(--border) bg-(--card) text-(--muted) hover:border-(--kumkum) hover:text-(--kumkum) active:scale-95'
          }`}
          title={saved ? 'Saved to Favorites' : 'Save Look'}
        >
          <Bookmark className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} />
          <span>{saved ? 'Saved' : 'Save'}</span>
        </button>
      </div>
    </article>
  );
};

