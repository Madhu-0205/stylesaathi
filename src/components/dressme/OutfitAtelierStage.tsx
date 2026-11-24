import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Pin,
  Lock,
  Unlock,
  Bookmark,
  Check,
  Calendar,
  Sparkles,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  RefreshCw,
  Layers,
  ShieldCheck,
  AlertCircle,
  Eye,
  X,
  Plus,
} from 'lucide-react';
import { GeneratedOutfit, WardrobeItem, Occasion, Season, ContextSnapshot } from '../../types';
import { ItemImage } from '../common/ItemImage';
import { Button } from '@/components/ui/button';
import { getOutfitWhyReasons } from '../../engine/scoring';
import { useWardrobeContext } from '../../context/WardrobeContext';
import { getCompatibilityDescriptor } from '../../utils/scoreFormatter';

export interface OutfitAtelierStageProps {
  anchorItem: WardrobeItem | null;
  onSelectAnchor: () => void;
  onUnlockAnchor: () => void;
  outfit: GeneratedOutfit | null;
  allOutfits: GeneratedOutfit[];
  accessory: WardrobeItem | null;
  onSelectAccessory: (acc: WardrobeItem | null) => void;
  availableAccessories: WardrobeItem[];
  occasion: Occasion;
  season: Season;
  onSaveOutfit: (outfit: GeneratedOutfit) => Promise<unknown>;
  onMarkWorn: (outfit: GeneratedOutfit, accessory: WardrobeItem | null) => Promise<void>;
  onPlanLook?: (outfit: GeneratedOutfit) => void;
  onInspectItem?: (item: WardrobeItem) => void;
  context?: ContextSnapshot;
  className?: string;
}

export const OutfitAtelierStage: React.FC<OutfitAtelierStageProps> = ({
  anchorItem,
  onSelectAnchor,
  onUnlockAnchor,
  outfit,
  allOutfits,
  accessory,
  onSelectAccessory,
  availableAccessories,
  occasion,
  season,
  onSaveOutfit,
  onMarkWorn,
  onPlanLook,
  onInspectItem,
  context,
  className = '',
}) => {
  const { preferences, styleProfile } = useWardrobeContext();

  const [currentOutfitIndex, setCurrentOutfitIndex] = useState<number>(0);
  const [slotOverrides, setSlotOverrides] = useState<Record<string, WardrobeItem>>({});
  const [removedSlots, setRemovedSlots] = useState<Set<string>>(new Set());

  // Action feedback states
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isWearing, setIsWearing] = useState<boolean>(false);
  const [wornToday, setWornToday] = useState<boolean>(false);
  const [activeSlotKey, setActiveSlotKey] = useState<string | null>(null);

  // Viewport & Reduced Motion tracking
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined') return window.innerWidth < 640;
    return true;
  });
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);

  useEffect(() => {
    const checkMotion = () => {
      if (typeof window !== 'undefined' && window.matchMedia) {
        setPrefersReducedMotion(
          window.matchMedia('(prefers-reduced-motion: reduce)').matches
        );
      }
    };
    checkMotion();

    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
      checkMotion();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // When anchor or allOutfits change, reset overrides and index
  useEffect(() => {
    setCurrentOutfitIndex(0);
    setSlotOverrides({});
    setRemovedSlots(new Set());
    setIsSaved(false);
    setWornToday(false);
  }, [anchorItem?.id, allOutfits.length]);

  // Active base outfit from recommendation engine
  const baseOutfit = useMemo(() => {
    if (allOutfits.length === 0) return outfit;
    return allOutfits[Math.min(currentOutfitIndex, allOutfits.length - 1)] || outfit;
  }, [allOutfits, currentOutfitIndex, outfit]);

  // Aggregate all unique compatible candidates per slot from engine's recommendations
  const slotCandidates = useMemo(() => {
    const map: Record<string, WardrobeItem[]> = {};
    for (const o of allOutfits) {
      for (const [slotKey, pieces] of Object.entries(o.slots)) {
        if (!map[slotKey]) map[slotKey] = [];
        for (const p of pieces) {
          if (!map[slotKey].some((existing) => existing.id === p.id)) {
            map[slotKey].push(p);
          }
        }
      }
    }
    return map;
  }, [allOutfits]);

  // Active composed slots after user overrides & slot removals
  const activeSlots = useMemo(() => {
    if (!baseOutfit) {
      if (anchorItem) {
        const slotName = anchorItem.category.toLowerCase();
        return { [slotName]: [anchorItem] };
      }
      return {};
    }
    const composed: Record<string, WardrobeItem[]> = {};

    for (const [slotKey, pieces] of Object.entries(baseOutfit.slots)) {
      if (removedSlots.has(slotKey)) continue;

      if (slotOverrides[slotKey]) {
        composed[slotKey] = [slotOverrides[slotKey]];
      } else {
        composed[slotKey] = pieces;
      }
    }
    return composed;
  }, [baseOutfit, slotOverrides, removedSlots, anchorItem]);

  // Active composed outfit object for saving, wearing, and planning
  const currentComposedOutfit = useMemo<GeneratedOutfit | null>(() => {
    if (!baseOutfit) return null;
    return {
      ...baseOutfit,
      slots: activeSlots,
    };
  }, [baseOutfit, activeSlots]);

  // Collect all pieces in composition
  const allEnsemblePieces = useMemo(() => {
    const pieces = Object.values(activeSlots).flat();
    if (accessory) pieces.push(accessory);
    return pieces;
  }, [activeSlots, accessory]);

  // Grounded why reasons from existing scoring engine
  const whyReasons = useMemo(() => {
    if (allEnsemblePieces.length === 0) return [];
    if (baseOutfit?.explanation?.reasons?.length) {
      return baseOutfit.explanation.reasons;
    }
    return getOutfitWhyReasons(
      allEnsemblePieces,
      occasion,
      baseOutfit?.score || 85,
      preferences,
      styleProfile,
      context
    );
  }, [allEnsemblePieces, baseOutfit, occasion, preferences, styleProfile, context]);

  // Filtered why reasons without empty strings
  const displayWhyReasons = useMemo(() => {
    return whyReasons.filter((r) => typeof r === 'string' && r.trim().length > 0);
  }, [whyReasons]);

  // Descriptive compatibility presentation tier
  const compatibilityDescriptor = useMemo(() => {
    return getCompatibilityDescriptor(baseOutfit?.score);
  }, [baseOutfit?.score]);

  // Normalized compatibility match percentage (50% - 100%)
  const matchPercentage = useMemo(() => {
    if (!baseOutfit?.score) return 92;
    const raw = baseOutfit.score;
    const normalized = raw <= 10 ? Math.round(raw * 10) : Math.round(raw);
    return Math.max(50, Math.min(100, normalized));
  }, [baseOutfit?.score]);

  // Next / Previous ensemble navigation
  const cycleEnsemble = useCallback(
    (direction: 'next' | 'prev') => {
      if (allOutfits.length <= 1) return;
      setCurrentOutfitIndex((prev) => {
        if (direction === 'next') {
          return (prev + 1) % allOutfits.length;
        } else {
          return (prev - 1 + allOutfits.length) % allOutfits.length;
        }
      });
      setSlotOverrides({});
      setRemovedSlots(new Set());
    },
    [allOutfits.length]
  );

  // Cycle alternative candidates within a specific slot
  const cycleSlotItem = useCallback(
    (slotKey: string, direction: 'next' | 'prev') => {
      const candidates = slotCandidates[slotKey];
      if (!candidates || candidates.length <= 1) return;

      const currentPiece =
        slotOverrides[slotKey] || activeSlots[slotKey]?.[0] || candidates[0];
      const currentIndex = candidates.findIndex((c) => c.id === currentPiece.id);

      let nextIndex = 0;
      if (direction === 'next') {
        nextIndex = (currentIndex + 1) % candidates.length;
      } else {
        nextIndex = (currentIndex - 1 + candidates.length) % candidates.length;
      }

      setSlotOverrides((prev) => ({
        ...prev,
        [slotKey]: candidates[nextIndex],
      }));
    },
    [slotCandidates, slotOverrides, activeSlots]
  );

  // Remove a slot piece (e.g. optional layer, dupatta, jacket)
  const handleRemoveSlot = (slotKey: string) => {
    // Never allow removing the anchor slot
    const piece = activeSlots[slotKey]?.[0];
    if (piece?.id === anchorItem?.id) return;

    setRemovedSlots((prev) => new Set([...prev, slotKey]));
  };

  // Restore a removed slot
  const handleRestoreSlot = (slotKey: string) => {
    setRemovedSlots((prev) => {
      const next = new Set(prev);
      next.delete(slotKey);
      return next;
    });
  };

  // Save composed outfit to lookbook
  const handleSaveClick = async () => {
    if (!currentComposedOutfit || isSaved) return;
    try {
      await onSaveOutfit(currentComposedOutfit);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch {
      // silently handle
    }
  };

  // Log wear today
  const handleWearClick = async () => {
    if (!currentComposedOutfit || wornToday) return;
    setIsWearing(true);
    try {
      await onMarkWorn(currentComposedOutfit, accessory);
      setWornToday(true);
      setTimeout(() => setWornToday(false), 3500);
    } catch {
      // Rejection handled by onMarkWorn / markOutfitWornOnDate safeguard toast
    } finally {
      setIsWearing(false);
    }
  };

  // Reset to original engine recommendation
  const handleResetEnsemble = () => {
    setSlotOverrides({});
    setRemovedSlots(new Set());
    onSelectAccessory(null);
  };

  // Shuffle unlocked coordinating pieces using compatible alternatives
  const handleShuffleUnlocked = useCallback(() => {
    const newOverrides: Record<string, WardrobeItem> = {};
    for (const [slotKey, candidates] of Object.entries(slotCandidates)) {
      const currentPiece = slotOverrides[slotKey] || activeSlots[slotKey]?.[0];
      const isAnchor = currentPiece?.id === anchorItem?.id;
      if (!isAnchor && candidates.length > 1) {
        const alternatives = candidates.filter((c) => c.id !== currentPiece?.id);
        const randomAlternative = alternatives[Math.floor(Math.random() * alternatives.length)];
        if (randomAlternative) {
          newOverrides[slotKey] = randomAlternative;
        }
      }
    }
    setSlotOverrides((prev) => ({ ...prev, ...newOverrides }));
  }, [slotCandidates, slotOverrides, activeSlots, anchorItem?.id]);

  // Keyboard navigation for Atelier stage
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      cycleEnsemble('next');
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      cycleEnsemble('prev');
    } else if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      handleSaveClick();
    } else if (e.key === 'w' || e.key === 'W') {
      e.preventDefault();
      handleWearClick();
    }
  };

  // Render empty stage when no anchor is locked
  if (!anchorItem) {
    return (
      <section
        aria-label="Outfit Atelier Empty Stage"
        className={`relative overflow-hidden rounded-3xl border border-dashed border-(--burnished-gold)/40 bg-gradient-to-b from-card/90 via-(--ivory)/30 to-card/90 p-6 sm:p-10 text-center shadow-xs ${className}`}
      >
        <div className="mx-auto max-w-md space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 shadow-2xs">
            <Layers className="h-7 w-7 stroke-[1.5]" />
          </div>

          <div className="space-y-1.5">
            <span className="editorial-kicker text-(--burnished-gold) tracking-[0.25em]">
              OUTFIT ATELIER · 3D COMPOSITION
            </span>
            <h3 className="font-serif text-2xl sm:text-3xl text-(--ink) font-normal tracking-tight">
              Lock an Anchor Piece
            </h3>
            <p className="text-xs sm:text-sm text-muted font-sans max-w-sm mx-auto leading-relaxed">
              Choose a hero garment from your wardrobe — a handloom kurta, tailored trousers, or signature jacket. The Atelier will build and layer harmonized silhouettes around it in 3D depth.
            </p>
          </div>

          <div className="pt-2">
            <Button
              onClick={onSelectAnchor}
              className="min-h-11 rounded-full bg-(--ink) text-(--paper) font-semibold uppercase tracking-wider px-6 text-xs shadow-sm hover:opacity-95 active:scale-95 tactile-press"
              aria-label="Select anchor garment to begin composition"
            >
              <Pin className="h-3.5 w-3.5 mr-2 text-amber-300" />
              <span>Choose Anchor Garment</span>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  // Slot keys present in current composition
  const slotEntries = Object.entries(activeSlots);

  return (
    <section
      role="region"
      tabIndex={0}
      aria-label={`Outfit Atelier Stage for ${anchorItem.name}`}
      onKeyDown={handleKeyDown}
      className={`relative select-none overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-b from-card/95 via-(--paper) to-card/95 backdrop-blur-md shadow-sm p-4 sm:p-6 mb-8 transition-all ${className}`}
    >
      {/* Atelier Stage Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/70 pb-3.5 mb-5 gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-700 dark:text-amber-300 shadow-2xs">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="editorial-kicker text-(--burnished-gold) tracking-[0.2em]">
                OUTFIT ATELIER · 3D SPATIAL COMPOSITION
              </span>
              <span className="rounded-full bg-(--kumkum)/10 text-(--kumkum) text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 border border-(--kumkum)/20">
                {occasion}
              </span>
            </div>
            <h3 className="font-serif text-xl sm:text-2xl text-(--ink) font-normal tracking-tight">
              {baseOutfit?.template
                ? baseOutfit.template.replace(/_/g, ' ').toUpperCase()
                : 'Curated Ensemble'}
            </h3>
          </div>
        </div>

        {/* Ensemble Cycler & Anchor Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {allOutfits.length > 1 && (
            <div className="flex items-center rounded-full border border-border/80 bg-card/80 p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => cycleEnsemble('prev')}
                aria-label="Previous outfit combination"
                className="flex h-9 w-9 min-h-11 min-w-11 items-center justify-center rounded-full text-muted hover:text-(--ink) active:scale-90 transition-all tactile-press"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 font-mono text-xs font-semibold text-(--ink)">
                {currentOutfitIndex + 1} / {allOutfits.length}
              </span>
              <button
                type="button"
                onClick={() => cycleEnsemble('next')}
                aria-label="Next outfit combination"
                className="flex h-9 w-9 min-h-11 min-w-11 items-center justify-center rounded-full text-muted hover:text-(--ink) active:scale-90 transition-all tactile-press"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Change Anchor Button */}
          <button
            type="button"
            onClick={onSelectAnchor}
            className="flex min-h-11 items-center gap-1.5 rounded-full border border-border/80 bg-card/80 px-3.5 text-xs font-semibold text-(--ink) hover:border-(--burnished-gold) shadow-2xs active:scale-95 transition-all tactile-press"
            aria-label="Change locked anchor piece"
          >
            <Lock className="h-3.5 w-3.5 text-amber-500" />
            <span className="hidden sm:inline">Change</span>
          </button>

          {/* Unlock Anchor Button */}
          <button
            type="button"
            onClick={onUnlockAnchor}
            className="flex min-h-11 items-center gap-1.5 rounded-full border border-border/80 bg-card/80 px-3.5 text-xs font-semibold text-(--kumkum) hover:bg-(--kumkum)/5 shadow-2xs active:scale-95 transition-all tactile-press"
            aria-label="Unlock anchor piece"
          >
            <Unlock className="h-3.5 w-3.5 text-(--kumkum)" />
            <span>Unlock</span>
          </button>
        </div>
      </div>

      {/* 3D Spatial Composition Stage */}
      <div
        className="relative w-full rounded-2xl bg-gradient-to-b from-(--background)/60 via-(--paper) to-(--background)/60 border border-border/60 p-4 sm:p-6 overflow-hidden"
        style={{
          perspective: '1100px',
          perspectiveOrigin: '50% 40%',
          transformStyle: 'preserve-3d',
          minHeight: isMobile ? '430px' : '480px',
        }}
      >
        {/* Soft Radial Ambient Spotlight on Stage */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(254,243,199,0.22),transparent_70%)]" />

        {/* Floor Depth Shadow beneath layered composition */}
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 h-10 w-3/4 rounded-full bg-black/25 dark:bg-black/60 blur-2xl" />

        {/* 3D Staggered Ensemble Layer Grid */}
        <div
          className="relative z-10 mx-auto max-w-4xl flex flex-wrap items-center justify-center gap-3 sm:gap-6 py-4"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {slotEntries.length === 0 && (
            <div className="text-center py-10 px-4 max-w-sm mx-auto">
              <AlertCircle className="h-6 w-6 text-amber-500 mx-auto mb-2" />
              <p className="font-serif text-base text-(--ink)">No clean coordinating pieces for this occasion</p>
              <p className="text-xs text-muted mt-1 font-sans">
                Try switching the occasion filter or select another anchor piece.
              </p>
            </div>
          )}

          {slotEntries.map(([slotKey, pieces], index) => {
            const piece = pieces[0];
            if (!piece) return null;

            const isAnchor = piece.id === anchorItem.id;
            const candidates = slotCandidates[slotKey] || [];
            const hasAlternatives = candidates.length > 1 && !isAnchor;

            // 3D Staggered Depth Physics:
            // - Anchor piece is elevated front-and-center (translateZ: 60px, scale 1.04)
            // - Coordinating pieces stagger naturally around it (translateZ: 25px - 45px)
            let translateZPx = 30;
            let rotateYDeg = 0;
            let scaleVal = 0.98;

            if (isAnchor) {
              translateZPx = 60;
              rotateYDeg = 0;
              scaleVal = 1.04;
            } else if (!prefersReducedMotion) {
              // Stagger angles and depths based on slot position
              const offsetFromCenter = index - Math.floor(slotEntries.length / 2);
              rotateYDeg = Math.max(-14, Math.min(14, offsetFromCenter * -7));
              translateZPx = Math.max(20, 48 - Math.abs(offsetFromCenter) * 12);
              scaleVal = 0.96;
            }

            return (
              <div
                key={`${slotKey}-${piece.id}`}
                data-testid={`atelier-slot-${slotKey}`}
                data-anchor={isAnchor ? 'true' : 'false'}
                className={`relative flex flex-col items-center rounded-2xl border transition-all duration-400 ${
                  isAnchor
                    ? 'border-amber-400 ring-2 ring-amber-400/40 shadow-xl bg-(--card)'
                    : 'border-border/80 hover:border-muted/90 bg-(--card)/90 shadow-md'
                }`}
                style={{
                  width: isMobile ? '160px' : '200px',
                  transform: prefersReducedMotion
                    ? 'none'
                    : `translate3d(0px, 0px, ${translateZPx}px) rotateY(${rotateYDeg}deg) scale3d(${scaleVal}, ${scaleVal}, 1)`,
                  transformStyle: 'preserve-3d',
                  backfaceVisibility: 'hidden',
                  zIndex: isAnchor ? 40 : 20 - index,
                  transition:
                    'transform 450ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 300ms ease, border-color 300ms ease',
                }}
              >
                {/* Slot Tag Ribbon */}
                <div className="w-full flex items-center justify-between px-2.5 py-1.5 bg-card/90 border-b border-border/50 text-[9px] font-bold uppercase tracking-wider rounded-t-2xl">
                  <span className={isAnchor ? 'text-amber-600 dark:text-amber-300 font-extrabold flex items-center gap-1' : 'text-muted'}>
                    {isAnchor && <Pin className="h-3 w-3 fill-amber-500 text-amber-500" />}
                    <span>{isAnchor ? 'ANCHOR' : slotKey}</span>
                  </span>

                  {/* Remove optional slot action */}
                  {!isAnchor && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSlot(slotKey)}
                      aria-label={`Remove ${slotKey} layer: ${piece.name}`}
                      className="text-muted hover:text-(--kumkum) p-0.5 rounded-full transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Garment Image Frame */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onInspectItem?.(piece)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onInspectItem?.(piece);
                    }
                  }}
                  className="relative aspect-4/5 w-full overflow-hidden bg-(--background)/60 cursor-pointer group"
                  aria-label={`Inspect ${piece.name}`}
                >
                  <ItemImage
                    item={piece}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />

                  {/* Subtle specular glint for anchor piece */}
                  {isAnchor && (
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-amber-200/20 mix-blend-overlay" />
                  )}

                  {/* Hover Inspect Cue */}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1 backdrop-blur-2xs">
                    <Eye className="h-3.5 w-3.5" />
                    <span>Inspect</span>
                  </div>
                </div>

                {/* Under-Card Metadata & Cycler Arrows */}
                <div className="w-full p-2.5 bg-card/95 rounded-b-2xl border-t border-border/40 text-[11px] font-sans">
                  <div className="flex items-center justify-between gap-1">
                    <h5
                      title={piece.name}
                      className="font-serif text-xs sm:text-sm font-normal text-(--ink) leading-tight truncate"
                    >
                      {piece.name}
                    </h5>
                  </div>

                  <span className="text-[10px] text-muted truncate block pt-0.5">
                    {piece.fabric ? `${piece.fabric} · ` : ''}{piece.category}
                  </span>

                  {/* Alternative Candidate Cycler */}
                  {hasAlternatives && (
                    <div className="mt-2 pt-1.5 border-t border-border/40 flex items-center justify-between text-[10px]">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          cycleSlotItem(slotKey, 'prev');
                        }}
                        aria-label={`Previous ${slotKey} option`}
                        className="flex h-6 w-6 min-h-11 min-w-11 items-center justify-center rounded-full text-muted hover:text-(--ink) active:scale-90 transition-all tactile-press"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-[9.5px] font-mono text-muted/80">
                        {candidates.findIndex((c) => c.id === piece.id) + 1} of {candidates.length}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          cycleSlotItem(slotKey, 'next');
                        }}
                        aria-label={`Next ${slotKey} option`}
                        className="flex h-6 w-6 min-h-11 min-w-11 items-center justify-center rounded-full text-muted hover:text-(--ink) active:scale-90 transition-all tactile-press"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Optional Accessory Slot */}
          {accessory ? (
            <div
              data-testid="atelier-slot-accessory"
              className="relative flex flex-col items-center rounded-2xl border border-border/80 bg-(--card)/90 shadow-md"
              style={{
                width: isMobile ? '160px' : '200px',
                transform: prefersReducedMotion
                  ? 'none'
                  : 'translate3d(0px, 0px, 35px) rotateY(-8deg) scale3d(0.96, 0.96, 1)',
                zIndex: 15,
              }}
            >
              <div className="w-full flex items-center justify-between px-2.5 py-1.5 bg-card/90 border-b border-border/50 text-[9px] font-bold uppercase tracking-wider rounded-t-2xl">
                <span className="text-muted">ACCESSORY</span>
                <button
                  type="button"
                  onClick={() => onSelectAccessory(null)}
                  aria-label="Remove accessory"
                  className="text-muted hover:text-(--kumkum) p-0.5 rounded-full transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>

              <div
                role="button"
                tabIndex={0}
                onClick={() => onInspectItem?.(accessory)}
                className="relative aspect-4/5 w-full overflow-hidden bg-(--background)/60 cursor-pointer group"
                aria-label={`Inspect ${accessory.name}`}
              >
                <ItemImage
                  item={accessory}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>

              <div className="w-full p-2.5 bg-card/95 rounded-b-2xl border-t border-border/40 text-[11px] font-sans">
                <h5 className="font-serif text-xs sm:text-sm font-normal text-(--ink) leading-tight truncate">
                  {accessory.name}
                </h5>
                <span className="text-[10px] text-muted truncate block pt-0.5">
                  {accessory.subcategory || accessory.category}
                </span>
              </div>
            </div>
          ) : availableAccessories.length > 0 ? (
            <div
              className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/40 p-4 text-center"
              style={{ width: isMobile ? '140px' : '160px', minHeight: '200px' }}
            >
              <Sparkles className="h-5 w-5 text-amber-500 mb-1.5" />
              <span className="text-xs font-serif text-(--ink) block">Add Accessory</span>
              <span className="text-[10px] text-muted block mb-3">Watch, bag or jewellery</span>
              <button
                type="button"
                onClick={() => onSelectAccessory(availableAccessories[0])}
                className="flex min-h-11 items-center gap-1 rounded-full border border-border bg-card px-3 text-[11px] font-semibold text-(--ink) hover:border-(--ink) shadow-2xs active:scale-95 transition-all"
              >
                <Plus className="h-3 w-3" />
                <span>Choose</span>
              </button>
            </div>
          ) : null}

          {/* Restorable Slots Drawer / Pills */}
          {removedSlots.size > 0 && (
            <div className="w-full flex items-center justify-center gap-2 pt-2">
              <span className="text-[11px] text-muted font-sans">Restore removed layer:</span>
              {Array.from(removedSlots).map((slotKey) => (
                <button
                  key={slotKey}
                  type="button"
                  onClick={() => handleRestoreSlot(slotKey)}
                  className="flex min-h-11 items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-(--ink) hover:border-(--ink) shadow-2xs active:scale-95 transition-all"
                >
                  <Plus className="h-3 w-3 text-amber-500" />
                  <span className="capitalize">{slotKey}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Outfit Rationale & Compatibility Panel */}
      <div className="mt-5 space-y-4 pt-4 border-t border-border/70">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-(--paper) p-4 rounded-2xl border border-border/80 shadow-2xs">
          {/* Harmony Score & Why This Works */}
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider flex items-center gap-1 ${compatibilityDescriptor.badgeClass}`}
                title={compatibilityDescriptor.heuristicNote}
              >
                <ShieldCheck className="h-3 w-3" />
                <span>{compatibilityDescriptor.label} • {matchPercentage}% Compatibility Match</span>
              </span>

              <span className="text-[11px] text-muted font-sans">
                {allEnsemblePieces.length} Coordinated Pieces
              </span>
            </div>

            {displayWhyReasons.length > 0 && (
              <div className="pt-1 flex flex-wrap gap-1.5">
                {displayWhyReasons.slice(0, 3).map((reason, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-(--background) border border-border/80 px-2.5 py-0.5 text-[10.5px] text-(--ink)/90 font-sans"
                  >
                    ✦ {reason}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center shrink-0 flex-wrap">
            {/* Shuffle Unlocked Action */}
            <button
              type="button"
              onClick={handleShuffleUnlocked}
              aria-label="Shuffle unlocked coordinating pieces"
              className="flex min-h-11 items-center gap-1.5 rounded-full border border-border/80 bg-card px-3.5 text-xs font-semibold text-(--ink) hover:border-(--burnished-gold) shadow-2xs active:scale-95 transition-all tactile-press"
            >
              <RefreshCw className="h-3.5 w-3.5 text-(--burnished-gold)" />
              <span>Shuffle Unlocked</span>
            </button>

            {/* Reset Action */}
            {(Object.keys(slotOverrides).length > 0 || removedSlots.size > 0 || accessory) && (
              <button
                type="button"
                onClick={handleResetEnsemble}
                className="flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-xs font-semibold text-muted hover:text-(--ink) hover:border-(--ink) shadow-2xs active:scale-95 transition-all"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Tactical Action Bar: Save to Lookbook, Wear Today, Plan in Calendar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Save to Lookbook Button */}
            <Button
              size="sm"
              onClick={handleSaveClick}
              disabled={isSaved}
              aria-label="Save this outfit to your lookbook"
              className={`flex min-h-11 items-center gap-1.5 rounded-full px-5 text-xs font-semibold uppercase tracking-wider shadow-xs transition-all active:scale-95 tactile-press ${
                isSaved
                  ? 'bg-emerald-600 text-white'
                  : 'bg-card border border-border text-(--ink) hover:border-(--ink)'
              }`}
            >
              {isSaved ? (
                <>
                  <Check className="h-4 w-4 stroke-[2.5]" />
                  <span>Saved to Lookbook!</span>
                </>
              ) : (
                <>
                  <Bookmark className="h-4 w-4 text-(--burnished-gold)" />
                  <span>Save Look</span>
                </>
              )}
            </Button>

            {/* Log Worn Today Button */}
            <Button
              size="sm"
              onClick={handleWearClick}
              disabled={wornToday || isWearing}
              aria-label="Log that you wore this ensemble today"
              className={`flex min-h-11 items-center gap-1.5 rounded-full px-5 text-xs font-semibold uppercase tracking-wider shadow-xs transition-all active:scale-95 tactile-press ${
                wornToday
                  ? 'bg-emerald-600 text-white'
                  : 'bg-card border border-border text-(--ink) hover:border-(--ink)'
              }`}
            >
              {wornToday ? (
                <>
                  <Check className="h-4 w-4 stroke-[2.5]" />
                  <span>Worn Today (+1)</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span>{isWearing ? 'Logging...' : 'Log Wear (+1)'}</span>
                </>
              )}
            </Button>

            {/* Plan Look in Calendar */}
            {onPlanLook && currentComposedOutfit && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onPlanLook(currentComposedOutfit)}
                aria-label="Plan this outfit in calendar"
                className="flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-xs font-semibold text-(--ink) hover:border-(--ink) shadow-2xs active:scale-95 transition-all"
              >
                <Calendar className="h-3.5 w-3.5 text-muted" />
                <span>Plan in Calendar</span>
              </Button>
            )}
          </div>

          <span className="text-[11px] font-sans font-medium text-muted">
            Anchor: <strong className="text-(--ink)">{anchorItem.name}</strong>
          </span>
        </div>
      </div>
    </section>
  );
};
