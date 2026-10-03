import React, { useState } from 'react';
import { Sparkles, Bookmark, Check, Plus, RefreshCw } from 'lucide-react';
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
}

export const OutfitCard: React.FC<OutfitCardProps> = ({
  outfit,
  index,
  occasion,
  accessory,
  onOpenAccessoryDrawer,
  onMarkWorn,
  onSaveOutfit,
}) => {
  const [wornToday, setWornToday] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isWearing, setIsWearing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Extract core pieces from slots
  const allSlotEntries = Object.entries(outfit.slots);
  const primarySlot = allSlotEntries[0]; // e.g. top or dress
  const secondarySlots = allSlotEntries.slice(1); // e.g. bottom, footwear, dupatta

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

  return (
    <div className="relative overflow-hidden rounded-3xl border border-(--border) bg-(--card) p-4 shadow-sm transition-all animate-fade-in">
      {/* Header bar */}
      <div className="mb-3.5 flex items-center justify-between border-b border-(--border)/60 pb-2.5">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-(--accent)">
            {outfit.template}
          </span>
          <h3 className="text-base font-black tracking-tight text-(--text)">
            Look 0{index + 1}
          </h3>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-(--background) px-2.5 py-1 text-[11px] font-bold capitalize text-(--muted) border border-(--border)">
          <Sparkles className="h-3 w-3 text-(--accent)" />
          <span>{occasion}</span>
        </div>
      </div>

      {/* Editorial Clothing Layout */}
      <div className="space-y-2.5">
        {/* Main hero piece (Top, Dress, or Saree) */}
        {primarySlot && primarySlot[1][0] && (
          <div className="relative aspect-16/10 w-full overflow-hidden rounded-2xl border border-(--border)/70 bg-(--background)">
            <LazyImage
              src={primarySlot[1][0].photo}
              alt={primarySlot[1][0].name}
              category={primarySlot[1][0].category}
              subcategory={primarySlot[1][0].subcategory}
              colors={primarySlot[1][0].colors}
              className="h-full w-full"
            />
            <div className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
              {primarySlot[1][0].name}
            </div>
          </div>
        )}

        {/* Secondary Supporting Pieces Grid */}
        <div className="grid grid-cols-2 gap-2">
          {secondarySlots.map(([slotName, items]) => {
            const piece = items[0];
            if (!piece) return null;
            return (
              <div
                key={slotName}
                className="relative aspect-square overflow-hidden rounded-xl border border-(--border)/70 bg-(--background)"
              >
                <LazyImage
                  src={piece.photo}
                  alt={piece.name}
                  category={piece.category}
                  subcategory={piece.subcategory}
                  colors={piece.colors}
                  className="h-full w-full"
                />
                <div className="absolute bottom-1.5 left-1.5 right-1.5 truncate rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-xs">
                  {piece.name}
                </div>
              </div>
            );
          })}

          {/* Attached accessory tile or "+ Add Accessory" button */}
          {accessory ? (
            <div
              onClick={onOpenAccessoryDrawer}
              className="relative aspect-square overflow-hidden rounded-xl border border-(--accent)/50 bg-(--background) cursor-pointer group"
            >
              <LazyImage
                src={accessory.photo}
                alt={accessory.name}
                category={accessory.category}
                subcategory={accessory.subcategory}
                colors={accessory.colors}
                className="h-full w-full"
              />
              <div className="absolute top-1.5 right-1.5 rounded-full bg-(--accent) p-1 text-white shadow-xs">
                <RefreshCw className="h-2.5 w-2.5" />
              </div>
              <div className="absolute bottom-1.5 left-1.5 right-1.5 truncate rounded-md bg-(--accent) px-1.5 py-0.5 text-[9px] font-bold text-white">
                {accessory.name}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAccessoryDrawer}
              className="flex aspect-square flex-col items-center justify-center rounded-xl border-2 border-dashed border-(--border) bg-(--background)/50 p-2 text-center text-(--muted) transition-colors hover:border-(--accent) hover:text-(--accent) active:scale-95"
            >
              <Plus className="h-5 w-5" />
              <span className="mt-1 text-[10px] font-bold tracking-tight">Add Accessory</span>
            </button>
          )}
        </div>
      </div>

      {/* Editorial Styling Insight */}
      <div className="mt-3.5 rounded-2xl bg-(--background) p-3 border border-(--border)/60">
        <p className="text-xs italic text-(--muted) leading-relaxed">
          &ldquo;{outfit.why}&rdquo;
        </p>
      </div>

      {/* Action Buttons */}
      <div className="mt-3.5 flex gap-2">
        <button
          type="button"
          onClick={handleWoreClick}
          disabled={wornToday || isWearing}
          className={`flex-1 min-h-11 inline-flex items-center justify-center gap-1.5 rounded-2xl border text-xs font-bold transition-all ${
            wornToday
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'border-(--border) bg-(--card) text-(--text) hover:border-(--accent) active:scale-95'
          }`}
        >
          {wornToday ? (
            <>
              <Check className="h-3.5 w-3.5 stroke-3" />
              <span>Worn Today</span>
            </>
          ) : (
            <span>Wore this today</span>
          )}
        </button>

        <button
          type="button"
          onClick={handleSaveClick}
          disabled={saved || isSaving}
          className={`flex min-h-11 items-center justify-center gap-1.5 rounded-2xl px-4 text-xs font-bold transition-all ${
            saved
              ? 'bg-(--accent) text-white shadow-xs'
              : 'bg-(--accent) text-white shadow-xs hover:opacity-90 active:scale-95'
          }`}
        >
          <Bookmark className={`h-4 w-4 ${saved ? 'fill-white' : ''}`} />
          <span>{saved ? 'Saved' : 'Save'}</span>
        </button>
      </div>
    </div>
  );
};
