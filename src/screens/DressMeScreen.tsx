import React, { useState } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { useDressMe } from '../hooks/useDressMe';
import { useWardrobeContext } from '../context/WardrobeContext';
import { Chip } from '../components/common/Chip';
import { OutfitCard } from '../components/dressme/OutfitCard';
import { AccessoryDrawer } from '../components/dressme/AccessoryDrawer';
import { EmptyState } from '../components/common/EmptyState';
import { OCCASIONS, SEASONS } from '../data/taxonomy';
import { Occasion, Season } from '../types';

interface DressMeScreenProps {
  onGoToWardrobe: () => void;
}

export const DressMeScreen: React.FC<DressMeScreenProps> = ({ onGoToWardrobe }) => {
  const { theme, toggleTheme } = useWardrobeContext();
  const {
    occasion,
    setOccasion,
    season,
    setSeason,
    outfits,
    emptyStateInfo,
    shuffle,
    availableAccessories,
    activeAccessories,
    setOutfitAccessory,
    markWoreOutfit,
    saveOutfit,
  } = useDressMe();

  const [activeDrawerOutfitIndex, setActiveDrawerOutfitIndex] = useState<number | null>(null);
  const [isShuffling, setIsShuffling] = useState(false);

  const handleShuffle = () => {
    setIsShuffling(true);
    shuffle();
    setTimeout(() => setIsShuffling(false), 400);
  };

  return (
    <div className="pb-12 animate-fade-in">
      {/* Compact Editorial Header: "Aaj kya pehenna hai?" + Actions */}
      <header className="mb-3 flex items-center justify-between border-b border-(--border) pb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[9.5px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
              DRESS ME
            </span>
          </div>
          <h1 className="mt-0.5 font-serif text-2xl sm:text-3xl italic text-(--ink) tracking-tight">
            Aaj kya pehenna hai?
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-(--border) text-(--muted) transition-colors hover:border-(--ink) hover:text-(--ink)"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? '☾' : '☼'}
          </button>

          <button
            type="button"
            onClick={handleShuffle}
            className="flex min-h-9 items-center gap-1.5 rounded-full border border-(--ink) bg-(--card) px-3 py-1 text-xs font-semibold uppercase tracking-wider text-(--ink) transition-all hover:bg-(--ink) hover:text-(--paper) active:scale-95 shadow-2xs"
            aria-label="Shuffle combinations"
          >
            <RefreshCw className={`h-3 w-3 text-(--burnished-gold) ${isShuffling ? 'animate-spin' : ''}`} />
            <span>Shuffle</span>
          </button>
        </div>
      </header>

      {/* Ultra-Compact Context Controls: Occasions + Seasons in one unified bar */}
      <div className="mb-3.5 space-y-2 border-b border-(--border)/70 pb-2.5">
        {/* Occasion Selector Chips */}
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 py-0.5">
          {OCCASIONS.map((occ) => (
            <Chip
              key={occ}
              label={occ}
              active={occasion === occ}
              onClick={() => setOccasion(occ as Occasion)}
            />
          ))}
        </div>

        {/* Season Inline Switcher */}
        <div className="flex items-center justify-between px-0.5 text-[11px] text-(--muted)">
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-(--muted)">
              CLIMATE:
            </span>
            <div className="inline-flex rounded-lg border border-(--border) bg-(--card) p-0.5">
              {SEASONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeason(s as Season)}
                  className={`rounded-md px-2 py-0.5 text-[10px] uppercase font-semibold tracking-wider transition-colors ${
                    season === s
                      ? 'bg-(--ink) text-(--paper) shadow-2xs'
                      : 'text-(--muted) hover:text-(--ink)'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-(--kumkum)">
            {outfits.length} {outfits.length === 1 ? 'LOOK' : 'LOOKS'}
          </span>
        </div>
      </div>

      {/* Outfit Results: The Outfit Dominates Immediately */}
      {outfits.length === 0 ? (
        <EmptyState
          icon={<AlertCircle className="h-7 w-7 text-(--kumkum)" />}
          title={emptyStateInfo?.title || 'Not enough clean pieces for this look yet'}
          description={
            emptyStateInfo?.description ||
            `Add clean pieces suitable for ${occasion}, or check if matching garments are currently in laundry.`
          }
          action={{
            label: emptyStateInfo?.actionLabel || 'Open Wardrobe',
            onClick: onGoToWardrobe,
          }}
        />
      ) : (
        <div className="space-y-4">
          {outfits.map((outfit, index) => (
            <OutfitCard
              key={`${outfit.template}-${index}-${season}-${occasion}`}
              outfit={outfit}
              index={index}
              occasion={occasion}
              accessory={activeAccessories[index] || null}
              onOpenAccessoryDrawer={() => setActiveDrawerOutfitIndex(index)}
              onMarkWorn={markWoreOutfit}
              onSaveOutfit={saveOutfit}
              onChangeLook={handleShuffle}
            />
          ))}
        </div>
      )}

      {/* Accessory Selector Drawer */}
      <AccessoryDrawer
        isOpen={activeDrawerOutfitIndex !== null}
        onClose={() => setActiveDrawerOutfitIndex(null)}
        accessories={availableAccessories}
        currentAccessory={
          activeDrawerOutfitIndex !== null ? activeAccessories[activeDrawerOutfitIndex] || null : null
        }
        onSelectAccessory={(acc) => {
          if (activeDrawerOutfitIndex !== null) {
            setOutfitAccessory(activeDrawerOutfitIndex, acc);
          }
        }}
      />
    </div>
  );
};

