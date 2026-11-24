import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, Calendar, Pin, Bookmark, X, Sparkles, Layers, ChevronLeft, ChevronRight, Sun, Moon } from 'lucide-react';
import { useDressMe } from '../hooks/useDressMe';
import { useWardrobeContext } from '../context/WardrobeContext';
import { Chip } from '../components/common/Chip';
import { OutfitCard } from '../components/dressme/OutfitCard';
import { OutfitAtelierStage } from '../components/dressme/OutfitAtelierStage';
import { ItemDetailSheet } from '../components/wardrobe/ItemDetailSheet';
import { AccessoryDrawer } from '../components/dressme/AccessoryDrawer';
import { EmptyState } from '../components/common/EmptyState';
import { OutfitCardSkeleton } from '../components/common/Skeleton';
import { PlanLookModal } from '../components/calendar/PlanLookModal';
import { WeatherStatusBar } from '../components/weather/WeatherStatusBar';
import { Occasion, Season, GeneratedOutfit, WardrobeItem } from '../types';
import { OCCASIONS, SEASONS } from '../data/taxonomy';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ItemImage } from '../components/common/ItemImage';
import { SelectAnchorModal } from '../components/dressme/SelectAnchorModal';
import { SavedOutfitsModal } from '../components/dressme/SavedOutfitsModal';
import { useBackButton } from '../hooks/useBackButton';
import { BackButtonPriority } from '../services/backButtonManager';

interface DressMeScreenProps {
  onGoToWardrobe: () => void;
  onGoToCalendar?: () => void;
  initialAnchorItem?: WardrobeItem | null;
  onClearInitialAnchor?: () => void;
}

export const DressMeScreen: React.FC<DressMeScreenProps> = ({
  onGoToWardrobe,
  onGoToCalendar,
  initialAnchorItem,
  onClearInitialAnchor,
}) => {
  const { items, theme, toggleTheme, plans, savedOutfits, updateItem, deleteItem, styleVibes } = useWardrobeContext();
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
    selectedAesthetic,
    setSelectedAesthetic,
    formalityPreference,
    setFormalityPreference,
    isWeatherUnavailable,
    STYLING_AESTHETICS,
  } = useDressMe();

  const [activeDrawerOutfitIndex, setActiveDrawerOutfitIndex] = useState<number | null>(null);
  const [isShuffling, setIsShuffling] = useState(false);
  const [planningOutfit, setPlanningOutfit] = useState<GeneratedOutfit | null>(null);
  const [showAnchorModal, setShowAnchorModal] = useState(false);
  const [showSavedOutfitsModal, setShowSavedOutfitsModal] = useState(false);
  const [viewMode, setViewMode] = useState<'daily' | 'atelier'>('daily');
  const [inspectedItem, setInspectedItem] = useState<WardrobeItem | null>(null);
  const [activeLookIndex, setActiveLookIndex] = useState<number>(0);
  const [revealLayout, setRevealLayout] = useState<'showcase' | 'feed'>('showcase');

  useEffect(() => {
    setActiveLookIndex(0);
  }, [occasion, season, anchorItem?.id, selectedAesthetic, formalityPreference]);

  useEffect(() => {
    if (initialAnchorItem) {
      setAnchorItem(initialAnchorItem);
      setViewMode('atelier');
      onClearInitialAnchor?.();
    }
  }, [initialAnchorItem, setAnchorItem, onClearInitialAnchor]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash.toLowerCase() === '#atelier') {
      setViewMode('atelier');
    }
  }, []);

  useBackButton(
    BackButtonPriority.SCREEN_MODAL,
    () => {
      setInspectedItem(null);
      return true;
    },
    inspectedItem !== null,
    'Atelier Item Detail Sheet'
  );

  // Tomorrow calculation
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  const tomorrowPlan = plans.find((p) => p.date === tomorrowStr);

  const handleShuffle = () => {
    setIsShuffling(true);
    setActiveLookIndex(0);
    shuffle();
    setTimeout(() => setIsShuffling(false), 400);
  };

  return (
    <div className="pb-36 sm:pb-32 md:pb-8 animate-fade-in max-w-7xl mx-auto w-full overflow-x-clip">
      {/* Luxury Editorial Header: "What feels like you today?" */}
      <header className="mb-4 flex flex-col md:flex-row md:items-start md:justify-between border-b border-border/80 pb-3.5 gap-4">
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

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* Dual Experience Switcher: Daily Edit vs 3D Atelier */}
          <div className="flex items-center rounded-full border border-border/80 bg-card/60 p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('daily')}
              aria-pressed={viewMode === 'daily'}
              className={`flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all tactile-press ${
                viewMode === 'daily'
                  ? 'bg-(--ink) text-(--paper) shadow-2xs'
                  : 'text-muted hover:text-(--ink)'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>Daily Edit</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('atelier')}
              aria-pressed={viewMode === 'atelier'}
              className={`flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all tactile-press ${
                viewMode === 'atelier'
                  ? 'bg-(--ink) text-(--paper) shadow-2xs'
                  : 'text-muted hover:text-(--ink)'
              }`}
            >
              <Layers className="h-3.5 w-3.5 text-amber-500" />
              <span>Atelier (3D)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="md:hidden flex h-9 w-9 min-h-11 min-w-11 items-center justify-center rounded-full border border-border text-muted transition-colors hover:border-(--ink) hover:text-(--ink) active:scale-95 tactile-press"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
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

      {/* Weather Context Honest Fallback Notice (if live forecast is unavailable) */}
      {isWeatherUnavailable && (
        <div className="mb-3 flex items-center justify-between px-3 py-2 rounded-xl bg-(--card)/60 border border-border/70 text-[11px] text-muted shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-(--burnished-gold) shrink-0" />
            <span className="font-sans">
              <strong className="text-(--ink)">Climate Context:</strong> Seasonal Climate Average Fallback (Live forecast unavailable · Calibrated for {season}).
            </span>
          </div>
          <span className="text-[9.5px] uppercase font-bold tracking-wider text-(--burnished-gold) shrink-0 hidden sm:inline">
            Local Calibration
          </span>
        </div>
      )}

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
            {viewMode === 'daily' && (
              <button
                type="button"
                onClick={() => setViewMode('atelier')}
                className="flex min-h-11 items-center gap-1 text-[11px] font-semibold text-(--burnished-gold) hover:text-(--ink) px-3 py-1.5 rounded-full border border-(--burnished-gold)/40 bg-card/70 transition-colors tactile-press"
              >
                <Layers className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">3D Atelier</span>
              </button>
            )}
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
            onClick={() => {
              setShowAnchorModal(true);
              setViewMode('atelier');
            }}
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

      {/* Studio Styling Brief Controls: Aesthetics + Formality */}
      <div className="mb-4 rounded-2xl glass-card border border-border/80 p-3.5 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <span className="editorial-kicker text-(--burnished-gold) tracking-[0.16em]">
            STYLING BRIEF · ATELIER CALIBRATION
          </span>
          <span className="text-[10px] text-muted font-sans hidden sm:inline">
            Aesthetic direction &amp; formality balance
          </span>
        </div>

        {/* Aesthetic Direction Selector */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted">
              Aesthetic Direction:
            </span>
            <span className="text-[10.5px] text-(--burnished-gold) font-medium italic">
              {STYLING_AESTHETICS.find((a) => a.id === selectedAesthetic)?.label}
            </span>
          </div>
          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5 md:flex-wrap">
            {STYLING_AESTHETICS.map((aes) => {
              const isSelected = selectedAesthetic === aes.id;
              return (
                <button
                  key={aes.id}
                  type="button"
                  onClick={() => setSelectedAesthetic(aes.id)}
                  aria-pressed={isSelected}
                  className={`inline-flex min-h-11 items-center justify-center rounded-full px-3.5 text-xs font-semibold tracking-wide transition-all tactile-press ${
                    isSelected
                      ? 'bg-(--ink) text-(--paper) shadow-2xs'
                      : 'border border-border/80 bg-card/70 text-muted hover:border-(--burnished-gold)/60 hover:text-(--ink)'
                  }`}
                  title={aes.description}
                >
                  {aes.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Formality & Balance Dial */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/50 text-[11px]">
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted">
            Formality Dial:
          </span>
          <div className="inline-flex rounded-xl border border-border bg-card p-0.5 shadow-2xs">
            {(
              [
                { id: 'auto', label: 'Auto (Occasion)' },
                { id: 'relaxed', label: 'Relaxed (1-2)' },
                { id: 'balanced', label: 'Balanced (3)' },
                { id: 'elevated', label: 'Elevated (4-5)' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFormalityPreference(f.id)}
                aria-pressed={formalityPreference === f.id}
                className={`inline-flex min-h-11 items-center justify-center rounded-lg px-2.5 sm:px-3 text-[10.5px] font-semibold transition-all tactile-press ${
                  formalityPreference === f.id
                    ? 'bg-(--ink) text-(--paper) shadow-2xs'
                    : 'text-muted hover:text-(--ink)'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Context Controls: Occasions + Seasons */}
      <div className="mb-4 space-y-2.5 border-b border-(--border)/70 pb-3">
        {/* Missing Context Guidance */}
        {(!styleVibes || styleVibes.length === 0) && (
          <div className="flex items-center justify-between p-2.5 rounded-xl border border-dashed border-border/70 bg-card/30 text-xs text-muted">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span className="text-[11px]">Set your personal style vibes to unlock deeper aesthetic curation</span>
            </div>
            <button
              type="button"
              onClick={onGoToWardrobe}
              className="min-h-11 inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-semibold text-(--burnished-gold) hover:underline hover:bg-(--ivory) shrink-0 tactile-press"
            >
              Refine Profile
            </button>
          </div>
        )}

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

      {/* View Content: 3D Atelier vs Daily Edit Stream */}
      {viewMode === 'atelier' ? (
        <div className="space-y-6">
          <OutfitAtelierStage
            anchorItem={anchorItem}
            onSelectAnchor={() => setShowAnchorModal(true)}
            onUnlockAnchor={() => setAnchorItem(null)}
            outfit={outfits[0] || null}
            allOutfits={outfits}
            accessory={activeAccessories[0] || null}
            onSelectAccessory={(acc) => setOutfitAccessory(0, acc)}
            availableAccessories={availableAccessories}
            occasion={occasion}
            season={season}
            onSaveOutfit={saveOutfit}
            onMarkWorn={markWoreOutfit}
            onPlanLook={(o) => setPlanningOutfit(o)}
            onInspectItem={(item) => setInspectedItem(item)}
            context={contextSnapshot}
          />

          {outfits.length > 1 && (
            <div className="pt-2">
              <div className="flex items-center justify-between mb-3">
                <span className="editorial-kicker text-muted">
                  COORDINATED ENSEMBLE VARIANTS ({outfits.length})
                </span>
                <span className="text-[11px] font-sans text-muted">
                  Swipe or tap to explore alternative compositions
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {outfits.slice(1).map((outfit, index) => (
                  <OutfitCard
                    key={`${outfit.template}-${index + 1}-${season}-${occasion}-${anchorItem?.id || 'none'}`}
                    outfit={outfit}
                    index={index + 1}
                    occasion={occasion}
                    accessory={activeAccessories[index + 1] || null}
                    context={contextSnapshot}
                    onOpenAccessoryDrawer={() => setActiveDrawerOutfitIndex(index + 1)}
                    onMarkWorn={markWoreOutfit}
                    onSaveOutfit={saveOutfit}
                    onChangeLook={handleShuffle}
                    onPlanLook={(o) => setPlanningOutfit(o)}
                    onRejectLook={rejectOutfit}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : isShuffling ? (
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
          {/* Cinematic Reveal Controller Bar */}
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-2xl bg-card/70 border border-border/80 backdrop-blur-xs">
            <div className="flex items-center gap-2">
              <span className="editorial-kicker text-(--burnished-gold) tracking-[0.16em]">
                {revealLayout === 'showcase'
                  ? `LOOK 0${Math.min(activeLookIndex + 1, outfits.length)} OF 0${outfits.length} · CINEMATIC SPOTLIGHT`
                  : `DAILY CURATION (${outfits.length} LOOKS)`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {revealLayout === 'showcase' && outfits.length > 1 && (
                <div className="flex items-center rounded-full border border-border bg-card p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setActiveLookIndex((p) => Math.max(0, p - 1))}
                    disabled={activeLookIndex === 0}
                    aria-label="Previous revealed look"
                    className="flex h-7 w-7 min-h-11 min-w-11 items-center justify-center rounded-full text-muted hover:text-(--ink) disabled:opacity-30 transition-all tactile-press"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-1.5 font-mono text-[11px] font-semibold text-(--ink)">
                    {activeLookIndex + 1}/{outfits.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveLookIndex((p) => Math.min(outfits.length - 1, p + 1))}
                    disabled={activeLookIndex >= outfits.length - 1}
                    aria-label="Next revealed look"
                    className="flex h-7 w-7 min-h-11 min-w-11 items-center justify-center rounded-full text-muted hover:text-(--ink) disabled:opacity-30 transition-all tactile-press"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* View Layout Switcher: Spotlight vs All Looks */}
              <div className="flex items-center rounded-full border border-border bg-card p-0.5 text-[10.5px] font-bold uppercase tracking-wider shadow-2xs">
                <button
                  type="button"
                  onClick={() => setRevealLayout('showcase')}
                  aria-pressed={revealLayout === 'showcase'}
                  className={`min-h-11 px-3 rounded-full transition-colors tactile-press ${
                    revealLayout === 'showcase'
                      ? 'bg-(--ink) text-(--paper) shadow-2xs'
                      : 'text-muted hover:text-(--ink)'
                  }`}
                >
                  Spotlight
                </button>
                <button
                  type="button"
                  onClick={() => setRevealLayout('feed')}
                  aria-pressed={revealLayout === 'feed'}
                  className={`min-h-11 px-3 rounded-full transition-colors tactile-press ${
                    revealLayout === 'feed'
                      ? 'bg-(--ink) text-(--paper) shadow-2xs'
                      : 'text-muted hover:text-(--ink)'
                  }`}
                >
                  All Looks
                </button>
              </div>
            </div>
          </div>

          {revealLayout === 'showcase' ? (
            <div className="space-y-4">
              {/* Spotlight Revealed Outfit Card */}
              {outfits[activeLookIndex] && (
                <div key={`spotlight-${activeLookIndex}-${outfits[activeLookIndex].template}`} className="animate-fade-in">
                  <OutfitCard
                    outfit={outfits[activeLookIndex]}
                    index={activeLookIndex}
                    occasion={occasion}
                    accessory={activeAccessories[activeLookIndex] || null}
                    context={contextSnapshot}
                    anchorItem={anchorItem}
                    onOpenAccessoryDrawer={() => setActiveDrawerOutfitIndex(activeLookIndex)}
                    onMarkWorn={markWoreOutfit}
                    onSaveOutfit={saveOutfit}
                    onChangeLook={handleShuffle}
                    onPlanLook={(o) => setPlanningOutfit(o)}
                    onRejectLook={rejectOutfit}
                    onOpenInAtelier={(o) => {
                      const heroPiece = Object.values(o.slots)[0]?.[0];
                      if (heroPiece) setAnchorItem(heroPiece);
                      setViewMode('atelier');
                    }}
                    onInspectItem={(item) => setInspectedItem(item)}
                  />
                </div>
              )}

              {/* Parallel Looks Cinematic Navigation Ribbon */}
              {outfits.length > 1 && (
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <span className="editorial-kicker text-muted">
                      PARALLEL CURATIONS ({outfits.length})
                    </span>
                    <span className="text-[10.5px] text-muted font-sans">
                      Select thumbnail to reveal full styling
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {outfits.map((look, i) => {
                      const isSelected = i === activeLookIndex;
                      const heroPiece = Object.values(look.slots)[0]?.[0];
                      return (
                        <button
                          key={`${look.template}-${i}`}
                          type="button"
                          onClick={() => setActiveLookIndex(i)}
                          aria-label={`Switch to Look 0${i + 1}: ${look.template}`}
                          className={`group relative flex items-center gap-2.5 p-2 rounded-2xl border text-left transition-all active:scale-[0.98] ${
                            isSelected
                              ? 'border-amber-400 bg-amber-500/10 ring-2 ring-amber-400/30'
                              : 'border-border bg-card/70 hover:border-muted'
                          }`}
                        >
                          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-border bg-(--ivory)">
                            {heroPiece && (
                              <ItemImage item={heroPiece} className="h-full w-full object-cover" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[9px] uppercase tracking-wider font-bold text-(--burnished-gold) block">
                              Look 0{i + 1}
                            </span>
                            <span className="font-serif text-xs font-normal text-(--ink) truncate block">
                              {look.template.replace(/_/g, ' ')}
                            </span>
                            <span className="text-[9.5px] text-muted truncate block">
                              {Object.values(look.slots).flat().length} pieces
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
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
                  anchorItem={anchorItem}
                  onOpenAccessoryDrawer={() => setActiveDrawerOutfitIndex(index)}
                  onMarkWorn={markWoreOutfit}
                  onSaveOutfit={saveOutfit}
                  onChangeLook={handleShuffle}
                  onPlanLook={(o) => setPlanningOutfit(o)}
                  onRejectLook={rejectOutfit}
                  onOpenInAtelier={(o) => {
                    const heroPiece = Object.values(o.slots)[0]?.[0];
                    if (heroPiece) setAnchorItem(heroPiece);
                    setViewMode('atelier');
                  }}
                  onInspectItem={(item) => setInspectedItem(item)}
                />
              ))}
            </div>
          )}
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
        onSelectAnchor={(item) => {
          setAnchorItem(item);
          setViewMode('atelier');
        }}
        onClearAnchor={() => setAnchorItem(null)}
      />

      {/* Saved Looks Lookbook Modal */}
      <SavedOutfitsModal
        isOpen={showSavedOutfitsModal}
        onClose={() => setShowSavedOutfitsModal(false)}
        onPlanLook={(savedOutfit) => setPlanningOutfit(savedOutfit)}
        onOpenInAtelier={(savedOutfit) => {
          const pieces = Object.values(savedOutfit.slots).flat();
          const hero =
            pieces.find(
              (p) => p.category === 'Ethnic' || p.category === 'Tops' || p.category === 'Bottoms'
            ) || pieces[0];
          if (hero) {
            setAnchorItem(hero);
          }
          setViewMode('atelier');
          setShowSavedOutfitsModal(false);
        }}
      />

      {/* Atelier Item Inspection Detail Sheet */}
      <ItemDetailSheet
        item={inspectedItem}
        isOpen={Boolean(inspectedItem)}
        onClose={() => setInspectedItem(null)}
        onUpdate={updateItem}
        onDelete={deleteItem}
      />
    </div>
  );
};
