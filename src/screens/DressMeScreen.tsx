import React, { useState } from 'react';
import { Shuffle, Sparkles, AlertCircle } from 'lucide-react';
import { useDressMe } from '../hooks/useDressMe';
import { useWardrobeContext } from '../context/WardrobeContext';
import { Header } from '../components/common/Header';
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
    shuffle,
    availableAccessories,
    activeAccessories,
    setOutfitAccessory,
    markWoreOutfit,
    saveOutfit,
  } = useDressMe();

  const [activeDrawerOutfitIndex, setActiveDrawerOutfitIndex] = useState<number | null>(null);

  return (
    <div className="pb-8 animate-fade-in">
      <Header
        title="Dress Me"
        subtitle="Only pieces you already own."
        theme={theme}
        onToggleTheme={toggleTheme}
        action={
          <button
            type="button"
            onClick={shuffle}
            className="flex min-h-11 items-center gap-1.5 rounded-2xl border border-(--border) bg-(--card) px-3.5 py-2 text-xs font-bold text-(--text) transition-transform hover:border-(--accent) active:scale-95"
          >
            <Shuffle className="h-3.5 w-3.5 text-(--accent)" />
            <span>Shuffle</span>
          </button>
        }
      />

      {/* Hero Greeting */}
      <div className="mb-5 rounded-3xl border border-(--border) bg-(--card) p-5">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-(--accent)">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Styling Assistant</span>
        </div>
        <h2 className="mt-1 text-2xl font-black text-(--text) tracking-tight">
          Aaj kya pehenna hai?
        </h2>
        <p className="mt-1 text-xs text-(--muted) font-medium">
          Choose an occasion and season to generate styled editorial looks.
        </p>

        {/* Occasion Chips (Horizontal Scroll) */}
        <div className="mt-4">
          <label className="text-[11px] font-bold uppercase tracking-wider text-(--muted)">
            Occasion
          </label>
          <div className="no-scrollbar -mx-2 mt-2 flex gap-1.5 overflow-x-auto px-2 py-0.5">
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

        {/* Season Selector */}
        <div className="mt-3.5 pt-3 border-t border-(--border)/60 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-(--muted)">
            Season
          </span>
          <div className="flex gap-1.5">
            {SEASONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSeason(s as Season)}
                className={`min-h-9 rounded-full px-3 text-xs font-semibold capitalize transition-all ${
                  season === s
                    ? 'bg-(--accent) text-white shadow-xs'
                    : 'border border-(--border) bg-(--background) text-(--muted) hover:text-(--text)'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Outfit Results Grid */}
      {outfits.length === 0 ? (
        <EmptyState
          icon={<AlertCircle className="h-7 w-7" />}
          title="Not enough clean pieces for this look yet"
          description={`Add clean tops, bottoms, and footwear suitable for ${occasion}, or check if items are marked in laundry.`}
          action={{
            label: 'Open Wardrobe',
            onClick: onGoToWardrobe,
          }}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-(--muted)">
              {outfits.length} Styled {outfits.length === 1 ? 'Look' : 'Looks'} Found
            </span>
            <span className="text-xs text-(--muted)">
              Tap shuffle for alternatives
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {outfits.map((outfit, index) => (
              <OutfitCard
                key={`${outfit.template}-${index}`}
                outfit={outfit}
                index={index}
                occasion={occasion}
                accessory={activeAccessories[index] || null}
                onOpenAccessoryDrawer={() => setActiveDrawerOutfitIndex(index)}
                onMarkWorn={markWoreOutfit}
                onSaveOutfit={saveOutfit}
              />
            ))}
          </div>
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
