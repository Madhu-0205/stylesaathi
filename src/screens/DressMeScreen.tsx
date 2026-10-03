import React, { useState } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
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
  const [isShuffling, setIsShuffling] = useState(false);

  const handleShuffle = () => {
    setIsShuffling(true);
    shuffle();
    setTimeout(() => setIsShuffling(false), 400);
  };

  return (
    <div className="pb-12 animate-fade-in">
      <Header
        title="DRESS"
        subtitle="Intelligent styling from your existing closet"
        theme={theme}
        onToggleTheme={toggleTheme}
        action={
          <button
            type="button"
            onClick={handleShuffle}
            className="flex min-h-11 items-center gap-1.5 rounded-full border border-(--ink) bg-(--card) px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-(--ink) transition-all hover:bg-(--ink) hover:text-(--paper) active:scale-95"
            aria-label="Change styled combinations"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-(--burnished-gold) ${isShuffling ? 'animate-spin' : ''}`} />
            <span>Shuffle</span>
          </button>
        }
      />

      {/* Editorial Styling Direction / Hero Statement */}
      <div className="mb-6 border-b border-(--border) pb-5">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-(--kumkum)">
            STYLING DIRECTION
          </span>
          <div className="flex items-center gap-1.5 text-[11px] text-(--muted)">
            <span className="text-[9px] uppercase tracking-wider font-semibold">SEASON:</span>
            {SEASONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSeason(s as Season)}
                className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider transition-colors ${
                  season === s
                    ? 'font-bold text-(--kumkum) underline decoration-(--kumkum) decoration-1 underline-offset-4'
                    : 'text-(--muted) hover:text-(--ink)'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <h2 className="mt-1.5 font-serif text-3xl sm:text-4xl italic text-(--ink) tracking-tight">
          Aaj kya pehenna hai?
        </h2>
        <p className="mt-1 text-xs text-(--muted) font-normal leading-relaxed">
          Balanced proportions, complementary tones, and physical availability from your wardrobe.
        </p>

        {/* Occasion Horizontal Scroll */}
        <div className="mt-4">
          <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 py-1">
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
      </div>

      {/* Outfit Results Grid */}
      {outfits.length === 0 ? (
        <EmptyState
          icon={<AlertCircle className="h-7 w-7 text-(--kumkum)" />}
          title="Not enough clean pieces for this look yet"
          description={`Add clean tops, bottoms, and footwear suitable for ${occasion}, or check if pieces are currently in laundry.`}
          action={{
            label: 'Open Wardrobe',
            onClick: onGoToWardrobe,
          }}
        />
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between px-0.5 text-xs text-(--muted)">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em]">
              {outfits.length} STYLED {outfits.length === 1 ? 'LOOK' : 'LOOKS'}
            </span>
            <span className="text-[11px] font-serif italic">
              Tap shuffle to discover alternative pairings
            </span>
          </div>

          <div className="space-y-6">
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

