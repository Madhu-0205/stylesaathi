import React, { useState } from 'react';
import { Bookmark, Check, RefreshCw, Sparkles, Plus } from 'lucide-react';
import { GeneratedOutfit, WardrobeItem, Occasion } from '../../types';
import { LazyImage } from '../common/LazyImage';

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
  const primarySlot = allSlotEntries[0]; // e.g. top or dress
  const secondarySlots = allSlotEntries.slice(1); // e.g. bottom, footwear, dupatta

  // Form a readable piece list string
  const pieceNames = Object.values(outfit.slots)
    .flat()
    .map((p) => p.name);
  if (accessory) pieceNames.push(accessory.name);
  const pieceSummary = pieceNames.join(' · ');

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
    <article className="group relative overflow-hidden rounded-2xl border border-(--border) bg-(--card) p-5 sm:p-6 transition-all duration-300 animate-fade-in shadow-xs">
      {/* Top Editorial Header */}
      <div className="mb-4 flex items-baseline justify-between border-b border-(--border) pb-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
            LOOK 0{index + 1} · {occasion}
          </span>
          <h3 className="mt-0.5 font-serif text-2xl font-normal text-(--ink) tracking-tight">
            {lookTitle}
          </h3>
        </div>
        <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-(--muted)">
          {outfit.template}
        </span>
      </div>

      {/* Editorial Flat-Lay Visual Composition */}
      <div className="space-y-2.5">
        {/* Large Hero Garment (Top or Main Dress) */}
        {primarySlot && primarySlot[1][0] && (
          <div className="relative aspect-16/11 w-full overflow-hidden rounded-xl border border-(--border)/80 bg-(--ivory)">
            <LazyImage
              src={primarySlot[1][0].photo}
              alt={primarySlot[1][0].name}
              category={primarySlot[1][0].category}
              subcategory={primarySlot[1][0].subcategory}
              colors={primarySlot[1][0].colors}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-101"
            />
            <div className="absolute bottom-2.5 left-2.5 rounded-md bg-(--ink)/75 px-2 py-1 text-[10px] font-medium text-(--paper) backdrop-blur-xs tracking-wide">
              {primarySlot[1][0].name}
            </div>
            <div className="absolute top-2.5 right-2.5 text-[9px] font-bold uppercase tracking-wider text-(--muted) bg-(--paper)/80 px-2 py-0.5 rounded border border-(--border)/50">
              Hero Piece
            </div>
          </div>
        )}

        {/* Secondary Supporting Pieces (Bottom, Footwear, etc.) */}
        <div className="grid grid-cols-2 gap-2.5">
          {secondarySlots.map(([slotName, items]) => {
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
                <div className="absolute bottom-2 left-2 right-2 truncate rounded-md bg-(--ink)/75 px-2 py-0.5 text-[9px] font-medium text-(--paper) backdrop-blur-xs">
                  {piece.name}
                </div>
              </div>
            );
          })}

          {/* Accessory: "FINISH THE LOOK" */}
          {accessory ? (
            <div
              onClick={onOpenAccessoryDrawer}
              className="relative aspect-square overflow-hidden rounded-xl border border-(--burnished-gold) bg-(--ivory) cursor-pointer group/acc transition-all hover:border-(--kumkum)"
            >
              <LazyImage
                src={accessory.photo}
                alt={accessory.name}
                category={accessory.category}
                subcategory={accessory.subcategory}
                colors={accessory.colors}
                className="h-full w-full object-cover"
              />
              <div className="absolute top-2 right-2 rounded-full bg-(--burnished-gold) p-1 text-(--paper) shadow-xs">
                <RefreshCw className="h-2.5 w-2.5" />
              </div>
              <div className="absolute bottom-2 left-2 right-2 truncate rounded-md bg-(--ink)/85 px-1.5 py-0.5 text-[9px] font-medium text-(--paper)">
                {accessory.name}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAccessoryDrawer}
              className="flex aspect-square flex-col items-center justify-center rounded-xl border border-dashed border-(--border) bg-(--ivory)/40 p-3 text-center transition-colors hover:border-(--kumkum) hover:bg-(--ivory) active:scale-98"
            >
              <Plus className="h-4 w-4 text-(--burnished-gold)" />
              <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-(--ink)">
                Finish Look
              </span>
              <span className="text-[9px] text-(--muted) tracking-tight">
                Bag · Watch · Scarf
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Piece Summary */}
      <div className="mt-3.5 border-t border-(--border) pt-2.5">
        <p className="text-xs text-(--muted) font-medium tracking-tight">
          {pieceSummary}
        </p>
      </div>

      {/* Editorial Rationale: "WHY THIS WORKS" */}
      <div className="mt-3 rounded-xl bg-(--ivory) p-3.5 border border-(--border)/80">
        <span className="block text-[9px] font-bold uppercase tracking-[0.2em] text-(--burnished-gold)">
          WHY THIS WORKS
        </span>
        <p className="mt-1 font-serif text-sm italic text-(--ink) leading-relaxed">
          &ldquo;{outfit.why}&rdquo;
        </p>
      </div>

      {/* Tactile Wear Confirmation Message */}
      {wornToday && (
        <div className="mt-3 rounded-lg border border-emerald-300/60 bg-emerald-50/70 p-2.5 text-center text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 animate-fade-in">
          <span className="font-bold uppercase tracking-wider text-[10px]">Worn Today</span>
          <p className="text-[11px] text-emerald-800 dark:text-emerald-300 mt-0.5">
            Your wardrobe is learning your rhythm.
          </p>
        </div>
      )}

      {/* Editorial Actions: CHANGE LOOK / WORE THIS / SAVE */}
      <div className="mt-4 flex items-center gap-2 pt-1 border-t border-(--border)/60">
        {onChangeLook && (
          <button
            type="button"
            onClick={onChangeLook}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-(--border) bg-(--card) px-3 text-xs font-semibold text-(--muted) transition-all hover:border-(--ink) hover:text-(--ink) active:scale-95"
            title="Alternative combination"
          >
            <RefreshCw className="h-3.5 w-3.5 text-(--muted)" />
            <span className="hidden sm:inline">Change</span>
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
              <Check className="h-3.5 w-3.5 stroke-3" />
              <span>Worn Today</span>
            </>
          ) : (
            <span>Wore This Today</span>
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

