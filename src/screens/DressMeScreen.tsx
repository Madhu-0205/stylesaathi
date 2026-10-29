import React, { useState } from 'react';
import { RefreshCw, AlertCircle, Calendar, Pin, Bookmark, X, Sparkles } from 'lucide-react';
import { useDressMe } from '../hooks/useDressMe';
import { useWardrobeContext } from '../context/WardrobeContext';
import { Chip } from '../components/common/Chip';
import { OutfitCard } from '../components/dressme/OutfitCard';
import { AccessoryDrawer } from '../components/dressme/AccessoryDrawer';
import { EmptyState } from '../components/common/EmptyState';
import { OutfitCardSkeleton } from '../components/common/Skeleton';
import { PlanLookModal } from '../components/calendar/PlanLookModal';
import { WeatherStatusBar } from '../components/weather/WeatherStatusBar';
import { Occasion, Season, GeneratedOutfit } from '../types';
import { OCCASIONS, SEASONS } from '../data/taxonomy';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ItemImage } from '../components/common/ItemImage';
import { SelectAnchorModal } from '../components/dressme/SelectAnchorModal';
import { SavedOutfitsModal } from '../components/dressme/SavedOutfitsModal';

interface DressMeScreenProps {
  onGoToWardrobe: () => void;
  onGoToCalendar?: () => void;
}

export const DressMeScreen: React.FC<DressMeScreenProps> = ({ onGoToWardrobe, onGoToCalendar }) => {
  const { items, theme, toggleTheme, plans, savedOutfits } = useWardrobeContext();
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
    rejectOutfit,
    contextSnapshot,
    anchorItem,
    setAnchorItem,
    laundryWarning,
  } = useDressMe();

  const [activeDrawerOutfitIndex, setActiveDrawerOutfitIndex] = useState<number | null>(null);
  const [isShuffling, setIsShuffling] = useState(false);
  const [planningOutfit, setPlanningOutfit] = useState<GeneratedOutfit | null>(null);
  const [showAnchorModal, setShowAnchorModal] = useState(false);
  const [showSavedOutfitsModal, setShowSavedOutfitsModal] = useState(false);

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
    <div className="pb-28 sm:pb-24 md:pb-8 animate-fade-in max-w-7xl mx-auto">
      {/* Luxury Editorial Header: "What feels like you today?" */}
      <header className="mb-4 flex items-start justify-between border-b border-border/80 pb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="editorial-kicker text-(--kumkum)">
              DRESS ME · DAILY EDIT
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-(--burnished-gold)/10 text-(--burnished-gold) border border-(--burnished-gold)/30">
              Personalized
            </span>
          </div>
          <h1 className="mt-1 editorial-hero text-2xl sm:text-4xl lg:text-5xl text-(--ink) tracking-tight leading-none">
            What feels like you today?
          </h1>
          <p className="mt-1.5 text-xs text-muted font-medium">
            <span className="font-serif italic text-(--kumkum)">Aaj kya pehenna hai?</span> · Styled around your wardrobe · Curated for how you like to dress
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 pt-1">
          <button
            type="button"
            onClick={toggleTheme}
            className="md:hidden flex h-9 w-9 min-h-11 min-w-11 items-center justify-center rounded-full border border-border text-muted transition-colors hover:border-(--ink) hover:text-(--ink) active:scale-95 tactile-press"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? '☾' : '☼'}
          </button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSavedOutfitsModal(true)}
            className="min-h-11 rounded-full shadow-2xs font-semibold uppercase tracking-wider gap-1.5 px-3.5 tactile-press"
            aria-label="Open saved looks"
          >
            <Bookmark className="h-3.5 w-3.5 text-(--burnished-gold)" />
            <span>Saved</span>
            <span className="text-[10px] text-muted">({savedOutfits.length})</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleShuffle}
            className="min-h-11 rounded-full shadow-2xs font-semibold uppercase tracking-wider gap-1.5 px-3.5 tactile-press"
            aria-label="Shuffle combinations"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-(--burnished-gold) ${isShuffling ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Shuffle</span>
          </Button>
        </div>
      </header>

      {/* India-First Weather & Climate Context Bar */}
      <WeatherStatusBar />

      {/* Tomorrow Shortcut Bar */}
      {tomorrowPlan ? (
        <div className="mb-3 rounded-2xl border border-(--burnished-gold)/40 bg-(--ivory) p-3.5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2.5">
            <Calendar className="h-4 w-4 text-(--burnished-gold)" />
            <div className="text-left">
              <Badge variant="gold" className="text-[9px] px-1.5 py-0 mb-0.5">
                TOMORROW · LOOK READY
              </Badge>
              <span className="text-xs font-serif font-medium text-(--ink) block">
                {tomorrowPlan.outfit.template} ({tomorrowPlan.occasion})
              </span>
            </div>
          </div>
          {onGoToCalendar && (
            <Button
              variant="outline"
              size="sm"
              onClick={onGoToCalendar}
              className="text-[10px] font-semibold uppercase tracking-wider h-8 px-3 rounded-full"
            >
              View in Calendar
            </Button>
          )}
        </div>
      ) : (
        <div className="mb-3 rounded-2xl glass-card p-3.5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2.5">
            <Calendar className="h-4 w-4 text-muted" />
            <div className="text-left">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted block">
                TOMORROW · {tomorrow.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
              <span className="text-xs text-muted">
                Already know what you're wearing?
              </span>
            </div>
          </div>
          {outfits.length > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setPlanningOutfit(outfits[0])}
              className="text-[10px] font-semibold uppercase tracking-wider h-8 px-3 rounded-full shadow-2xs"
            >
              Plan Tomorrow
            </Button>
          )}
        </div>
      )}

      {/* Anchor Garment Status Banner or Quick Stylist Launcher */}
      {anchorItem ? (
        <div className="mb-3.5 flex items-center justify-between p-3 sm:p-3.5 rounded-2xl border border-(--burnished-gold)/50 bg-(--burnished-gold)/10 shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-border bg-(--paper)">
              <ItemImage item={anchorItem} className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] uppercase tracking-wider font-bold text-(--burnished-gold) block">
                  LOCKED ANCHOR PIECE
                </span>
                <span className="text-[9px] uppercase tracking-wider text-muted font-sans">
                  • {anchorItem.category}
                </span>
              </div>
              <h4 className="font-serif text-sm sm:text-base font-normal text-(--ink) truncate">
                {anchorItem.name}
              </h4>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowAnchorModal(true)}
              className="text-[11px] font-semibold text-muted hover:text-(--ink) px-3 py-1.5 rounded-full border border-border bg-card/70 transition-colors"
            >
              Change
            </button>
            <button
              type="button"
              onClick={() => setAnchorItem(null)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:text-(--kumkum) hover:bg-(--kumkum)/10 transition-colors"
              aria-label="Clear anchor piece"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-3.5 flex items-center justify-between p-2.5 sm:p-3 rounded-2xl border border-dashed border-border/80 bg-(--card)/40">
          <div className="flex items-center gap-2">
            <Pin className="h-3.5 w-3.5 text-(--burnished-gold)" />
            <span className="text-xs text-muted font-sans">
              Want to build an ensemble around a specific piece?
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowAnchorModal(true)}
            className="flex min-h-11 items-center gap-1.5 rounded-full bg-(--paper) border border-border px-3.5 py-1 text-xs font-semibold text-(--ink) shadow-2xs hover:border-(--burnished-gold) active:scale-95 transition-all"
          >
            <Sparkles className="h-3.5 w-3.5 text-(--burnished-gold)" />
            <span>Style Around Piece</span>
          </button>
        </div>
      )}

      {/* Laundry Warning Banner (Anchor Piece) */}
      {laundryWarning && (
        <div className="mb-3.5 flex items-center gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300 font-medium">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>{laundryWarning}. You can still style and schedule this outfit for later.</span>
        </div>
      )}

      {/* Context Controls: Occasions + Seasons */}
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
        <div className="flex flex-wrap items-center justify-between gap-2 px-0.5 text-[11px] text-muted">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted">
              CLIMATE:
            </span>
            <div className="inline-flex rounded-xl border border-border bg-card p-0.5">
              {SEASONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeason(s as Season)}
                  aria-pressed={season === s}
                  className={`inline-flex min-h-11 items-center justify-center rounded-lg px-3.5 text-[10.5px] uppercase font-bold tracking-wider transition-colors focus-editorial ${
                    season === s
                      ? 'bg-(--ink) text-(--paper) shadow-2xs'
                      : 'text-muted hover:text-(--ink)'
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

      {/* Outfit Results */}
      {isShuffling ? (
        <div className="space-y-4">
          <OutfitCardSkeleton />
          <OutfitCardSkeleton />
        </div>
      ) : outfits.length === 0 ? (
        <EmptyState
          icon={<AlertCircle className="h-7 w-7 text-(--kumkum)" />}
          title={emptyStateInfo?.title || 'Not enough clean pieces for this look yet'}
          description={
            emptyStateInfo?.description ||
            `Add clean pieces suitable for ${occasion}, or check if matching garments are currently in laundry.`
          }
          action={{
            label: emptyStateInfo?.actionLabel || 'Open Wardrobe',
            onClick: emptyStateInfo?.actionLabel === 'Clear Anchor' ? () => setAnchorItem(null) : onGoToWardrobe,
          }}
        />
      ) : (
        <div className="space-y-4">
          {outfits.map((outfit, index) => (
            <OutfitCard
              key={`${outfit.template}-${index}-${season}-${occasion}-${anchorItem?.id || 'none'}`}
              outfit={outfit}
              index={index}
              occasion={occasion}
              accessory={activeAccessories[index] || null}
              context={contextSnapshot}
              onOpenAccessoryDrawer={() => setActiveDrawerOutfitIndex(index)}
              onMarkWorn={markWoreOutfit}
              onSaveOutfit={saveOutfit}
              onChangeLook={handleShuffle}
              onPlanLook={(o) => setPlanningOutfit(o)}
              onRejectLook={rejectOutfit}
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

      {/* Select Anchor Garment Modal */}
      <SelectAnchorModal
        isOpen={showAnchorModal}
        onClose={() => setShowAnchorModal(false)}
        items={items}
        selectedAnchor={anchorItem}
        onSelectAnchor={(item) => setAnchorItem(item)}
        onClearAnchor={() => setAnchorItem(null)}
      />

      {/* Saved Looks Lookbook Modal */}
      <SavedOutfitsModal
        isOpen={showSavedOutfitsModal}
        onClose={() => setShowSavedOutfitsModal(false)}
        onPlanLook={(savedOutfit) => setPlanningOutfit(savedOutfit)}
      />
    </div>
  );
};
