import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Heart,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  ShieldAlert,
  RotateCw,
} from 'lucide-react';
import { WardrobeItem } from '../../types';
import { ItemImage } from '../common/ItemImage';
import { Button } from '@/components/ui/button';

export interface SpatialGarmentRailProps {
  items: WardrobeItem[];
  onSelectItem: (item: WardrobeItem) => void;
  onToggleFavorite: (e: React.MouseEvent, item: WardrobeItem) => void;
  onUpdateItem?: (id: string, updates: Partial<WardrobeItem>) => Promise<void>;
  className?: string;
}

export type MaterialProfileType = 'lustrous' | 'matte' | 'structured' | 'sheer' | 'neutral';

export interface MaterialGlintProfile {
  type: MaterialProfileType;
  label: string;
  sheenGradient: string;
  rimHighlight: string;
  badgeBg: string;
  badgeText: string;
}

/**
 * Derives restrained physical material lighting based purely on genuine garment metadata.
 * Never invents fabric properties or simulates unsupported textures.
 */
export function getMaterialGlintProfile(fabric?: string, category?: string): MaterialGlintProfile {
  const f = (fabric || '').toLowerCase();
  const c = (category || '').toLowerCase();

  // Lustrous Weaves: Silk, Chanderi, Banarasi, Tussar, Satin, Velvet, Brocade
  if (
    f.includes('silk') ||
    f.includes('chanderi') ||
    f.includes('banarasi') ||
    f.includes('tussar') ||
    f.includes('satin') ||
    f.includes('velvet') ||
    f.includes('brocade') ||
    f.includes('zari')
  ) {
    return {
      type: 'lustrous',
      label: 'Lustrous Weave',
      sheenGradient:
        'linear-gradient(118deg, transparent 20%, rgba(254, 243, 199, 0.16) 45%, rgba(255, 255, 255, 0.28) 50%, rgba(254, 243, 199, 0.16) 55%, transparent 80%)',
      rimHighlight: 'rgba(245, 158, 11, 0.35)',
      badgeBg: 'bg-amber-500/15 border-amber-400/40 text-amber-700 dark:text-amber-300',
      badgeText: 'Lustrous Finish',
    };
  }

  // Matte Natural Fibres: Cotton, Linen, Khadi, Mulmul
  if (
    f.includes('cotton') ||
    f.includes('linen') ||
    f.includes('khadi') ||
    f.includes('mulmul') ||
    f.includes('flax')
  ) {
    return {
      type: 'matte',
      label: 'Matte Natural Fibre',
      sheenGradient:
        'linear-gradient(180deg, rgba(255, 255, 255, 0.10) 0%, transparent 35%, rgba(0, 0, 0, 0.10) 100%)',
      rimHighlight: 'rgba(255, 255, 255, 0.20)',
      badgeBg: 'bg-stone-500/15 border-stone-400/30 text-stone-700 dark:text-stone-300',
      badgeText: 'Natural Weave',
    };
  }

  // Structured Textures: Denim, Wool, Tweed, Corduroy, Leather, Outerwear, Footwear
  if (
    f.includes('denim') ||
    f.includes('wool') ||
    f.includes('tweed') ||
    f.includes('corduroy') ||
    f.includes('leather') ||
    c.includes('footwear') ||
    c.includes('jacket')
  ) {
    return {
      type: 'structured',
      label: 'Structured Texture',
      sheenGradient:
        'linear-gradient(90deg, rgba(255, 255, 255, 0.10) 0%, transparent 20%, transparent 80%, rgba(255, 255, 255, 0.08) 100%)',
      rimHighlight: 'rgba(180, 83, 9, 0.30)',
      badgeBg: 'bg-indigo-500/15 border-indigo-400/30 text-indigo-700 dark:text-indigo-300',
      badgeText: 'Structured Fit',
    };
  }

  // Fluid / Sheer Weaves: Chiffon, Georgette, Organza, Crepe, Rayon, Viscose, Modal
  if (
    f.includes('chiffon') ||
    f.includes('georgette') ||
    f.includes('organza') ||
    f.includes('crepe') ||
    f.includes('rayon') ||
    f.includes('viscose') ||
    f.includes('modal')
  ) {
    return {
      type: 'sheer',
      label: 'Airy & Draped',
      sheenGradient:
        'linear-gradient(135deg, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0.04) 50%, transparent 100%)',
      rimHighlight: 'rgba(236, 72, 153, 0.25)',
      badgeBg: 'bg-rose-500/15 border-rose-400/30 text-rose-700 dark:text-rose-300',
      badgeText: 'Fluid Draped',
    };
  }

  // Neutral Fallback
  return {
    type: 'neutral',
    label: 'Atelier Textile',
    sheenGradient:
      'linear-gradient(120deg, transparent 30%, rgba(255, 255, 255, 0.12) 50%, transparent 70%)',
    rimHighlight: 'rgba(255, 255, 255, 0.15)',
    badgeBg: 'bg-muted/20 border-border text-muted',
    badgeText: 'Textile Plate',
  };
}

export const SpatialGarmentRail: React.FC<SpatialGarmentRailProps> = ({
  items,
  onSelectItem,
  onToggleFavorite,
  onUpdateItem,
  className = '',
}) => {
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Micro-interaction action feedback states
  const [hasWornFeedback, setHasWornFeedback] = useState<boolean>(false);
  const [favoritePingId, setFavoritePingId] = useState<string | null>(null);
  const [laundrySafeguardPrompt, setLaundrySafeguardPrompt] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number>(0);
  const lastXRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const velocityRef = useRef<number>(0);
  const isPointerDownRef = useRef<boolean>(false);
  const dragDistanceRef = useRef<number>(0);

  // Viewport-aware spacing & dimension
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 640;
    }
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

  // Ensure activeIndex is within bounds if items change
  useEffect(() => {
    if (items.length === 0) {
      setActiveIndex(0);
    } else if (activeIndex >= items.length) {
      setActiveIndex(Math.max(0, items.length - 1));
    }
    // Reset laundry prompt on garment change
    setLaundrySafeguardPrompt(false);
  }, [items.length, activeIndex]);

  const activeItem = useMemo(() => {
    if (items.length === 0) return null;
    return items[Math.min(activeIndex, items.length - 1)];
  }, [items, activeIndex]);

  // Active item material profile
  const activeMaterial = useMemo(() => {
    if (!activeItem) return null;
    return getMaterialGlintProfile(activeItem.fabric, activeItem.category);
  }, [activeItem]);

  // Card layout geometry: mobile width 240px, desktop 280px
  const cardWidth = isMobile ? 240 : 280;
  const cardSpacing = isMobile ? 200 : 240;

  // Navigation helpers
  const goToNext = useCallback(() => {
    setActiveIndex((prev) => Math.min(prev + 1, items.length - 1));
  }, [items.length]);

  const goToPrev = useCallback(() => {
    setActiveIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  // Tactical Favorite Micro-interaction
  const handleFavoriteClick = (e: React.MouseEvent, item: WardrobeItem) => {
    e.stopPropagation();
    setFavoritePingId(item.id);
    setTimeout(() => setFavoritePingId(null), 600);
    onToggleFavorite(e, item);
  };

  // Tactical Quick Wear with Laundry Safeguard
  const handleQuickWear = async (e: React.MouseEvent, item: WardrobeItem) => {
    e.stopPropagation();
    if (!onUpdateItem) return;

    // Laundry Safeguard: prevent accidental wear logging if garment is in laundry
    if (item.status === 'in_laundry') {
      setLaundrySafeguardPrompt(true);
      return;
    }

    try {
      await onUpdateItem(item.id, {
        timesWorn: (item.timesWorn || 0) + 1,
        lastWorn: Date.now(),
      });
      setHasWornFeedback(true);
      setLaundrySafeguardPrompt(false);
      setTimeout(() => setHasWornFeedback(false), 2400);
    } catch {
      // silently handle
    }
  };

  // 1-Tap Laundry Override: Mark Clean & Log Wear
  const handleMarkCleanAndWear = async (e: React.MouseEvent, item: WardrobeItem) => {
    e.stopPropagation();
    if (!onUpdateItem) return;
    try {
      await onUpdateItem(item.id, {
        status: 'clean',
        timesWorn: (item.timesWorn || 0) + 1,
        lastWorn: Date.now(),
      });
      setLaundrySafeguardPrompt(false);
      setHasWornFeedback(true);
      setTimeout(() => setHasWornFeedback(false), 2400);
    } catch {
      // silently handle
    }
  };

  // Pointer & Drag Gesture Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (items.length <= 1) return;
    isPointerDownRef.current = true;
    startXRef.current = e.clientX;
    lastXRef.current = e.clientX;
    lastTimeRef.current = performance.now();
    velocityRef.current = 0;
    dragDistanceRef.current = 0;
    setIsDragging(true);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return;
    const currentX = e.clientX;
    const now = performance.now();
    const dt = Math.max(now - lastTimeRef.current, 1);
    const dx = currentX - lastXRef.current;

    velocityRef.current = dx / dt;
    lastXRef.current = currentX;
    lastTimeRef.current = now;

    const totalDx = currentX - startXRef.current;
    dragDistanceRef.current = Math.abs(totalDx);

    // Apply soft resistance at boundaries
    let effectiveOffset = totalDx;
    if (activeIndex === 0 && totalDx > 0) {
      effectiveOffset = totalDx * 0.35;
    } else if (activeIndex === items.length - 1 && totalDx < 0) {
      effectiveOffset = totalDx * 0.35;
    }

    setDragOffset(effectiveOffset);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;
    setIsDragging(false);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const totalDx = dragOffset;
    const velocity = velocityRef.current;
    const threshold = 35; // drag distance threshold

    let targetShift = 0;
    if (Math.abs(velocity) > 0.4 || Math.abs(totalDx) > threshold) {
      if (velocity < -0.4 || totalDx < -threshold) {
        targetShift = 1;
      } else if (velocity > 0.4 || totalDx > threshold) {
        targetShift = -1;
      }
    }

    const newIndex = Math.max(0, Math.min(items.length - 1, activeIndex + targetShift));
    setActiveIndex(newIndex);
    setDragOffset(0);
  };

  // Keyboard accessibility
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      goToNext();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      goToPrev();
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(items.length - 1);
    } else if ((e.key === 'Enter' || e.key === ' ') && activeItem) {
      e.preventDefault();
      onSelectItem(activeItem);
    } else if ((e.key === 'f' || e.key === 'F') && activeItem) {
      e.preventDefault();
      handleFavoriteClick(e as unknown as React.MouseEvent, activeItem);
    } else if ((e.key === 'w' || e.key === 'W') && activeItem) {
      e.preventDefault();
      handleQuickWear(e as unknown as React.MouseEvent, activeItem);
    }
  };

  if (items.length === 0) {
    return null;
  }

  // Visible window for performance
  const visibleRange = isMobile ? 3 : 5;
  const startIndex = Math.max(0, activeIndex - visibleRange);
  const endIndex = Math.min(items.length - 1, activeIndex + visibleRange);

  return (
    <section
      aria-label="Interactive 3D Spatial Garment Rail"
      className={`relative select-none overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-b from-card/90 via-card/50 to-card/90 backdrop-blur-md shadow-sm transition-all p-3.5 sm:p-6 mb-8 ${className}`}
    >
      {/* Studio Header & Spatial Status */}
      <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4 sm:mb-6">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">
            <Layers className="h-3.5 w-3.5" />
          </div>
          <div>
            <span className="editorial-kicker text-(--burnished-gold) tracking-[0.2em] text-[10px]">
              SPATIAL STUDIO · HANGING RAIL
            </span>
            <h3 className="font-serif text-lg sm:text-xl text-(--ink) font-normal tracking-tight">
              Interactive Atelier Rail
            </h3>
          </div>
        </div>

        {/* Counter Pill & Material Cue */}
        <div className="flex items-center gap-2">
          {activeMaterial && (
            <span
              className={`hidden sm:inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[9.5px] font-semibold tracking-wider uppercase border ${activeMaterial.badgeBg}`}
            >
              <span>{activeMaterial.badgeText}</span>
            </span>
          )}
          <span className="rounded-full bg-(--paper) border border-border/80 px-3 py-1 font-mono text-xs font-semibold text-(--ink) shadow-2xs">
            {String(activeIndex + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* Architectural Brushed Brass Overhead Clothing Rail */}
      <div className="relative mx-auto w-full max-w-4xl px-4 pt-1 pb-3">
        {/* Brass Rail Bar */}
        <div className="relative h-2 sm:h-2.5 w-full rounded-full bg-gradient-to-r from-amber-800/40 via-amber-400 to-amber-800/40 shadow-[0_2px_12px_rgba(217,119,6,0.35)] border-t border-amber-200/60">
          {/* Left Rail Stanchion Cap */}
          <div className="absolute -left-2 -top-1.5 h-5 w-4 rounded-full bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 shadow-md border border-amber-200/50" />
          {/* Right Rail Stanchion Cap */}
          <div className="absolute -right-2 -top-1.5 h-5 w-4 rounded-full bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 shadow-md border border-amber-200/50" />
          {/* Metallic cylindrical highlight line */}
          <div className="absolute inset-x-4 top-0.5 h-0.5 rounded-full bg-white/40" />
        </div>
      </div>

      {/* 3D Spatial Stage Viewport */}
      <div
        ref={containerRef}
        role="region"
        tabIndex={0}
        aria-roledescription="carousel"
        aria-label={`Spatial rail. Currently viewing item ${activeIndex + 1} of ${items.length}: ${activeItem?.name || ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        className="relative h-[410px] sm:h-[470px] w-full overflow-hidden cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-2xl touch-pan-y"
        style={{
          perspective: '1100px',
          perspectiveOrigin: '50% 35%',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Screen Reader Live Region */}
        <div className="sr-only" aria-live="polite">
          {activeItem
            ? `Active garment: ${activeItem.name}, ${activeItem.category}, ${activeItem.fabric || 'Textile'}, Status: ${activeItem.status}. ${activeMaterial ? activeMaterial.label : ''}`
            : ''}
        </div>

        {/* Ambient Floor Reflection & Radial Contact Shadow */}
        <div
          className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 h-8 w-64 sm:w-80 rounded-full bg-black/25 dark:bg-black/60 blur-xl transition-all duration-300"
          style={{
            transform: `translateX(-50%) scale(${isDragging ? 0.9 : 1})`,
          }}
        />

        {/* Garment Rail Track */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{
            transformStyle: 'preserve-3d',
          }}
        >
          {items.map((item, index) => {
            if (index < startIndex || index > endIndex) {
              return null;
            }

            const diff = index - activeIndex;
            const itemOffset = diff * cardSpacing + dragOffset;
            const normalizedDist = itemOffset / cardSpacing;
            const isActive = index === activeIndex;

            // Material profile for this individual piece
            const material = getMaterialGlintProfile(item.fabric, item.category);

            // CSS 3D Transformation Math
            let rotateYDeg = 0;
            let translateZPx = 0;
            let translateYPx = 0;
            let scaleVal = 1;
            let opacityVal = 1;
            let filterVal = 'none';

            if (prefersReducedMotion) {
              rotateYDeg = 0;
              translateZPx = 0;
              translateYPx = isActive ? -4 : 0;
              scaleVal = isActive ? 1.02 : 0.95;
              opacityVal = Math.max(0.4, 1 - Math.abs(normalizedDist) * 0.25);
              filterVal = 'none';
            } else {
              // Milestone B: Enhanced Spatial 3D Physics
              // - Active center: faces user at rotateY(0deg), translates forward in Z-space (+55px), lifts slightly (-6px)
              // - Left items: angled toward right at +22deg, recessed in Z-space (-40px)
              // - Right items: angled toward left at -22deg, recessed in Z-space (-40px)
              rotateYDeg = Math.max(-28, Math.min(28, -normalizedDist * 22));
              translateZPx = Math.max(-70, 55 - Math.abs(normalizedDist) * 60);
              translateYPx = isActive ? -6 : 0;
              scaleVal = Math.max(0.85, 1.05 - Math.abs(normalizedDist) * 0.1);
              // Profile garments stay visibly present without disappearing (minimum 40% opacity)
              opacityVal = Math.max(0.40, 1 - Math.abs(normalizedDist) * 0.24);

              // Restrained depth-of-field soft focus for distant pieces beyond center
              if (Math.abs(normalizedDist) > 1.4) {
                filterVal = 'blur(1px)';
              }
            }

            const zIndexVal = Math.round(50 - Math.abs(normalizedDist) * 10);

            return (
              <article
                key={item.id}
                aria-roledescription="slide"
                aria-label={`${index + 1} of ${items.length}: ${item.name}`}
                aria-hidden={!isActive}
                data-testid={`spatial-card-${item.id}`}
                data-active={isActive ? 'true' : 'false'}
                onClick={() => {
                  if (dragDistanceRef.current < 6) {
                    if (isActive) {
                      onSelectItem(item);
                    } else {
                      setActiveIndex(index);
                    }
                  }
                }}
                className={`absolute top-2 flex flex-col items-center pointer-events-auto cursor-pointer transition-shadow duration-300 ${
                  isActive ? 'drop-shadow-2xl' : 'drop-shadow-md'
                }`}
                style={{
                  width: `${cardWidth}px`,
                  transform: `translate3d(calc(${itemOffset}px), ${translateYPx}px, ${translateZPx}px) rotateY(${rotateYDeg}deg) scale3d(${scaleVal}, ${scaleVal}, 1)`,
                  zIndex: zIndexVal,
                  opacity: opacityVal,
                  filter: filterVal,
                  transition: isDragging
                    ? 'none'
                    : 'transform 480ms cubic-bezier(0.16, 1, 0.3, 1), opacity 350ms ease, filter 350ms ease',
                  transformStyle: 'preserve-3d',
                  backfaceVisibility: 'hidden',
                  willChange: 'transform, opacity',
                }}
              >
                {/* Brass Hanger Assembly connecting rail to garment card */}
                <div
                  className="flex flex-col items-center shrink-0 -mb-1 transition-transform duration-300"
                  style={{
                    transform: isDragging
                      ? `rotate(${Math.max(-4, Math.min(4, dragOffset * 0.03))}deg)`
                      : 'rotate(0deg)',
                  }}
                >
                  {/* Brass Hook Loop with highlight sheen */}
                  <div className="relative h-6 w-5 rounded-t-full border-2 border-b-0 border-amber-400/80 bg-transparent shadow-xs">
                    {isActive && (
                      <div className="absolute top-0 right-0.5 h-2 w-0.5 rounded-full bg-white/70" />
                    )}
                  </div>
                  {/* Contoured Hanger Shoulder Bar */}
                  <div className="relative h-2 w-28 sm:w-36 rounded-full bg-gradient-to-r from-amber-800/80 via-amber-400 to-amber-800/80 shadow-xs border-t border-amber-200/50">
                    <div className="absolute left-1/2 -top-1 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-amber-300" />
                  </div>
                </div>

                {/* Garment Card Body */}
                <div
                  className={`group relative flex flex-col w-full overflow-hidden rounded-2xl border transition-all duration-300 ${
                    isActive
                      ? 'border-amber-400/70 ring-2 ring-amber-400/35 shadow-2xl bg-(--card)'
                      : 'border-border/70 hover:border-muted/80 bg-(--card)/90'
                  }`}
                >
                  {/* Aspect Ratio Garment Frame */}
                  <div className="relative aspect-4/5 w-full overflow-hidden bg-(--background)/50">
                    <ItemImage
                      item={item}
                      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                    />

                    {/* Milestone B: Material-Aware Lighting & Specular Sheen */}
                    {isActive && (
                      <>
                        {/* Static Material Sheen Gradient */}
                        <div
                          className="pointer-events-none absolute inset-0 mix-blend-overlay transition-opacity duration-500"
                          style={{ background: material.sheenGradient }}
                        />

                        {/* Restrained One-Shot Material Glint on Selection */}
                        {!prefersReducedMotion && (
                          <div
                            key={`glint-${item.id}`}
                            className="pointer-events-none absolute -inset-full animate-material-glint"
                            style={{
                              background:
                                'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.25) 50%, transparent 100%)',
                            }}
                          />
                        )}
                      </>
                    )}

                    {/* Gradient Depth Vignette */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Top Accession Pills */}
                    <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between gap-1 z-10">
                      <span className="rounded-full bg-black/60 backdrop-blur-md px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-200 border border-white/15">
                        #{String(index + 1).padStart(2, '0')}
                      </span>

                      {/* Care status indicator */}
                      {item.status !== 'clean' && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[8.5px] font-bold tracking-wider uppercase backdrop-blur-md shadow-2xs ${
                            item.status === 'needs_washing'
                              ? 'bg-amber-100/90 text-amber-900 border border-amber-300 dark:bg-amber-950/80 dark:text-amber-300'
                              : 'bg-stone-200/90 text-stone-700 border border-stone-300 dark:bg-stone-800/80 dark:text-stone-300'
                          }`}
                        >
                          {item.status === 'needs_washing' ? 'Needs Wash' : 'In Laundry'}
                        </span>
                      )}
                    </div>

                    {/* Floating Tactical Favorite Button with Ping Feedback */}
                    <div className="absolute right-2.5 bottom-2.5 z-20">
                      {favoritePingId === item.id && (
                        <span className="absolute inset-0 rounded-full bg-amber-400 animate-fav-ping pointer-events-none" />
                      )}
                      <button
                        type="button"
                        aria-label={item.favorite ? 'Remove from favorites' : 'Add to favorites'}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => handleFavoriteClick(e, item)}
                        className="relative flex h-10 w-10 min-h-11 min-w-11 items-center justify-center rounded-full glass-pill text-white shadow-xs transition-transform hover:scale-110 active:scale-90 tactile-press"
                      >
                        <Heart
                          className={`h-4 w-4 transition-colors ${
                            item.favorite
                              ? 'fill-accent stroke-accent'
                              : 'stroke-white group-hover:stroke-accent'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Bottom Caption Overlay */}
                    <div className="absolute bottom-2.5 left-2.5 right-14 z-10 text-white space-y-0.5">
                      <span className="text-[8.5px] uppercase tracking-widest text-amber-200/90 font-sans block truncate">
                        {item.subcategory || item.category}
                      </span>
                      <h4 className="font-serif text-base sm:text-lg font-normal tracking-tight text-white leading-tight truncate">
                        {item.name}
                      </h4>
                    </div>
                  </div>

                  {/* Under-Card Metadata Strip with Material Badge */}
                  <div className="p-2.5 sm:p-3 bg-card/95 border-t border-border/50 text-[11px] font-sans flex items-center justify-between text-muted">
                    <span className="truncate max-w-[130px]">
                      {item.fabric ? `${item.fabric}` : item.category}
                    </span>
                    <span className="font-mono text-[10px] text-muted/80">
                      Worn {item.timesWorn || 0}×
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* Tactical Navigation Chevrons */}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            goToPrev();
          }}
          disabled={activeIndex === 0}
          aria-label="Previous garment in rail"
          className="absolute left-2 top-1/2 -translate-y-1/2 z-40 flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-full glass-pill border border-border/80 text-(--ink) shadow-md transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:pointer-events-none tactile-press"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            goToNext();
          }}
          disabled={activeIndex === items.length - 1}
          aria-label="Next garment in rail"
          className="absolute right-2 top-1/2 -translate-y-1/2 z-40 flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-full glass-pill border border-border/80 text-(--ink) shadow-md transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:pointer-events-none tactile-press"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Active Garment Spotlight & Tactical Command Bar */}
      {activeItem && (
        <div className="mt-4 pt-4 border-t border-border/70 animate-fade-in">
          {/* Milestone B: Laundry Safeguard Notification Banner */}
          {laundrySafeguardPrompt && activeItem.status === 'in_laundry' && (
            <div className="mb-3 p-3 rounded-xl border border-amber-300 bg-amber-50/90 dark:bg-amber-950/60 dark:border-amber-700 flex items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200 animate-fade-in">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Laundry Safeguard:</strong> This piece is catalogued as in laundry.
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => handleMarkCleanAndWear(e, activeItem)}
                className="flex items-center gap-1 rounded-full bg-amber-600 px-3 py-1 text-[11px] font-bold text-white shadow-xs hover:bg-amber-700 active:scale-95 transition-all tactile-press shrink-0"
              >
                <RotateCw className="h-3 w-3" />
                <span>Mark Clean & Wear</span>
              </button>
            </div>
          )}

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-(--paper) p-4 rounded-2xl border border-border/80 shadow-2xs">
            {/* Metadata & Status */}
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="rounded-full bg-(--burnished-gold)/15 px-2.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 border border-amber-400/30">
                  {activeItem.category}
                </span>

                {activeMaterial && (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[9.5px] font-semibold tracking-wider uppercase border ${activeMaterial.badgeBg}`}
                  >
                    {activeMaterial.label}
                  </span>
                )}

                {activeItem.fabric && (
                  <span className="text-[11px] text-muted font-sans">
                    Textile: <strong className="text-(--ink) font-medium">{activeItem.fabric}</strong>
                  </span>
                )}
                <span className="opacity-30">•</span>
                <span className="text-[11px] text-muted font-sans">
                  Occasions: {activeItem.occasions.slice(0, 2).join(', ')}
                </span>
              </div>

              <h4 className="font-serif text-xl sm:text-2xl text-(--ink) font-normal tracking-tight leading-snug truncate">
                {activeItem.name}
              </h4>

              <div className="flex items-center gap-3 text-[11px] text-muted pt-0.5">
                <span className="inline-flex items-center gap-1 font-medium">
                  {activeItem.status === 'clean' ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-emerald-700 dark:text-emerald-300">Clean & Ready</span>
                    </>
                  ) : activeItem.status === 'needs_washing' ? (
                    <>
                      <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      <span className="text-amber-700 dark:text-amber-300">Needs Washing</span>
                    </>
                  ) : (
                    <>
                      <Clock className="h-3.5 w-3.5 text-stone-500" />
                      <span>In Laundry</span>
                    </>
                  )}
                </span>
                <span className="opacity-40">•</span>
                <span>Worn {activeItem.timesWorn || 0} times</span>
              </div>
            </div>

            {/* Tactical Actions */}
            <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0">
              {/* Quick Wear Button with Laundry Safeguard */}
              {onUpdateItem && (
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => handleQuickWear(e, activeItem)}
                  className={`flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-xs font-semibold shadow-2xs active:scale-95 transition-all tactile-press ${
                    hasWornFeedback
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200'
                      : activeItem.status === 'in_laundry'
                      ? 'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                      : 'border-border bg-card text-(--ink) hover:border-(--ink)'
                  }`}
                  aria-label={`Log wearing ${activeItem.name}`}
                >
                  {hasWornFeedback ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Worn Today (+1)</span>
                    </>
                  ) : activeItem.status === 'in_laundry' ? (
                    <>
                      <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                      <span>In Laundry</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                      <span>Log Wear (+1)</span>
                    </>
                  )}
                </button>
              )}

              {/* Inspect Details Button */}
              <Button
                size="sm"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onSelectItem(activeItem)}
                aria-label={`Inspect ${activeItem.name} details`}
                className="flex min-h-11 items-center gap-1.5 rounded-full bg-(--ink) px-5 py-2 text-xs font-bold uppercase tracking-wider text-(--paper) shadow-xs hover:opacity-95 active:scale-95 tactile-press"
              >
                <span>Inspect Piece</span>
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
