import React, { useState } from 'react';
import { RefreshCw, AlertCircle, Calendar } from 'lucide-react';
import { useDressMe } from '../hooks/useDressMe';
import { useWardrobeContext } from '../context/WardrobeContext';
import { Chip } from '../components/common/Chip';
import { OutfitCard } from '../components/dressme/OutfitCard';
import { AccessoryDrawer } from '../components/dressme/AccessoryDrawer';
import { EmptyState } from '../components/common/EmptyState';
import { PlanLookModal } from '../components/calendar/PlanLookModal';
import { OCCASIONS, SEASONS } from '../data/taxonomy';
import { Occasion, Season, GeneratedOutfit } from '../types';

interface DressMeScreenProps {
  onGoToWardrobe: () => void;
  onGoToCalendar?: () => void;
}

export const DressMeScreen: React.FC<DressMeScreenProps> = ({ onGoToWardrobe, onGoToCalendar }) => {
  const { theme, toggleTheme, plans } = useWardrobeContext();
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
  const [planningOutfit, setPlanningOutfit] = useState<GeneratedOutfit | null>(null);

  // Tomorrow calculation
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  const tomorrowPlan = plans.find((p) => p.date === tomorrowStr);

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
            className="md:hidden flex h-9 w-9 items-center justify-center rounded-full border border-(--border) text-(--muted) transition-colors hover:border-(--ink) hover:text-(--ink)"
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

      {/* Tomorrow Shortcut Bar */}
      {tomorrowPlan ? (
        <div className="mb-3 rounded-xl border border-(--burnished-gold)/40 bg-(--ivory) p-3 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2.5">
            <Calendar className="h-4 w-4 text-(--burnished-gold)" />
            <div className="text-left">
              <span className="text-[9px] font-bold uppercase tracking-wider text-(--kumkum) block">
                TOMORROW · LOOK READY
              </span>
              <span className="text-xs font-serif font-medium text-(--ink)">
                {tomorrowPlan.outfit.template} ({tomorrowPlan.occasion})
              </span>
            </div>
          </div>
          {onGoToCalendar && (
            <button
              type="button"
              onClick={onGoToCalendar}
              className="rounded-lg border border-(--border) bg-(--card) px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-(--ink) hover:bg-(--ivory)"
            >
              View in Calendar
            </button>
          )}
        </div>
      ) : (
        <div className="mb-3 rounded-xl border border-(--border)/80 bg-(--card) p-3 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2.5">
            <Calendar className="h-4 w-4 text-(--muted)" />
            <div className="text-left">
              <span className="text-[9px] font-bold uppercase tracking-wider text-(--muted) block">
                TOMORROW · {tomorrow.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
              <span className="text-xs text-(--muted)">
                Already know what you're wearing?
              </span>
            </div>
          </div>
          {outfits.length > 0 && (
            <button
              type="button"
              onClick={() => setPlanningOutfit(outfits[0])}
              className="rounded-lg border border-(--ink) bg-(--ink) px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-(--paper) hover:opacity-90 active:scale-95 shadow-2xs"
            >
              Plan Tomorrow
            </button>
          )}
        </div>
      )}

      {/* Ultra-Compact Context Controls: Occasions + Seasons in one unified bar */}
      <div className="mb-4 space-y-2.5 border-b border-(--border)/70 pb-3">
        {/* Occasion Selector Chips */}
        <div className="no-scrollbar -mx-3.5 sm:-mx-6 md:mx-0 flex gap-1.5 overflow-x-auto px-3.5 sm:px-6 md:px-0 py-0.5 md:flex-wrap">
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
              onPlanLook={(o) => setPlanningOutfit(o)}
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

      {/* Plan This Look Modal */}
      {planningOutfit && (
        <PlanLookModal
          isOpen={planningOutfit !== null}
          onClose={() => setPlanningOutfit(null)}
          outfit={planningOutfit}
          accessory={
            activeDrawerOutfitIndex !== null ? activeAccessories[activeDrawerOutfitIndex] || null : null
          }
          occasion={occasion}
        />
      )}
    </div>
  );
};

