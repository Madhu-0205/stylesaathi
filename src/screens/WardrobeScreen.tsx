import React, { useState, useMemo } from 'react';
import { Search, Plus, Sparkles, Heart, ArrowUpRight, Layers, LayoutGrid } from 'lucide-react';
import { useWardrobe } from '../hooks/useWardrobe';
import { Chip } from '../components/common/Chip';
import { ItemCard } from '../components/wardrobe/ItemCard';
import { ItemDetailSheet } from '../components/wardrobe/ItemDetailSheet';
import { SpatialGarmentRail } from '../components/wardrobe/SpatialGarmentRail';
import { EmptyState } from '../components/common/EmptyState';
import { WardrobeItemSkeleton } from '../components/common/Skeleton';
import { CATEGORIES } from '../data/taxonomy';
import { WardrobeItem, Status } from '../types';
import { StyleSaathiLogo } from '../components/brand/StyleSaathiLogo';
import { Button } from '@/components/ui/button';
import { ItemImage } from '../components/common/ItemImage';

import { useBackButton } from '../hooks/useBackButton';
import { BackButtonPriority } from '../services/backButtonManager';

interface WardrobeScreenProps {
  onOpenAddItem: () => void;
}

export const WardrobeScreen: React.FC<WardrobeScreenProps> = ({ onOpenAddItem }) => {
  const {
    items,
    loading,
    search,
    setSearch,
    selectedCategory,
    setSelectedCategory,
    statusFilter,
    setStatusFilter,
    favoriteOnly,
    setFavoriteOnly,
    filteredItems,
    stats,
    updateItem,
    deleteItem,
    theme,
    toggleTheme,
    loadSample,
  } = useWardrobe();

  const [selectedItem, setSelectedItem] = useState<WardrobeItem | null>(null);
  const [viewMode, setViewMode] = useState<'rail' | 'grid'>('rail');

  useBackButton(
    BackButtonPriority.SCREEN_MODAL,
    () => {
      setSelectedItem(null);
      return true;
    },
    selectedItem !== null,
    'Item Detail Sheet'
  );

  const handleToggleFavorite = async (e: React.MouseEvent, item: WardrobeItem) => {
    e.stopPropagation();
    await updateItem(item.id, { favorite: !item.favorite });
  };

  // Garments with verified photography
  const itemsWithPhotos = useMemo(() => {
    return items.filter((item) => Boolean(item.photo || item.photoId));
  }, [items]);

  const isDefaultView = !search && selectedCategory === 'All' && statusFilter === 'All' && !favoriteOnly;

  return (
    <div className="pb-28 sm:pb-24 md:pb-12 animate-fade-in max-w-7xl mx-auto">
      {/* Editorial Masthead */}
      <header className="mb-6 sm:mb-8 border-b border-border/70 pb-5 sm:pb-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="md:hidden">
                <StyleSaathiLogo variant="mark" size="xs" />
              </span>
              <span className="editorial-kicker text-(--burnished-gold) tracking-[0.25em]">
                WARDROBE · ATELIER ARCHIVE NO. 01
              </span>
            </div>

            <h1 className="editorial-hero text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-(--ink) font-normal tracking-tight leading-[1.05]">
              Personal Archive
            </h1>

            <p className="max-w-2xl text-xs sm:text-sm text-muted font-sans font-normal leading-relaxed pt-0.5">
              A curated taxonomy of your everyday staples and ceremonial silhouettes. Handloom weaves, tailoring, and footwear catalogued for mindful rotation.
            </p>

            <div className="flex items-center gap-3 pt-1 text-[11px] font-sans text-muted/90">
              <span className="font-semibold text-(--ink)">{stats.total} pieces in rotation</span>
              <span className="opacity-40">•</span>
              <span>{itemsWithPhotos.length} photographic plates</span>
              <span className="opacity-40">•</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-medium">{stats.clean} ready to wear</span>
            </div>
          </div>

          {/* Masthead Quick Actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              className="md:hidden flex h-9 w-9 min-h-11 min-w-11 items-center justify-center rounded-full border border-border bg-card/60 text-muted transition-colors hover:border-(--ink) hover:text-(--ink) active:scale-95 tactile-press"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? '☾' : '☼'}
            </button>

            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-needle-command'))}
              aria-label="Open on-device Stylist"
              className="md:hidden flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-card/80 px-3.5 text-xs font-semibold text-(--ink) shadow-2xs active:scale-95"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span className="font-serif">Stylist</span>
            </button>

            <Button
              size="sm"
              onClick={onOpenAddItem}
              aria-label="Add clothing item"
              className="flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-xs transition-transform hover:opacity-95 active:scale-95 tactile-press"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>Add Piece</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Featured Editorial Showcase (Garments with Real Photography) */}
      {isDefaultView && itemsWithPhotos.length > 0 && (
        <section aria-label="Curated Key Pieces" className="mb-10 sm:mb-12">
          <div className="mb-4 flex items-baseline justify-between border-b border-border/50 pb-2.5">
            <div>
              <span className="editorial-kicker text-(--burnished-gold)">CURATED REPERTOIRE</span>
              <h2 className="font-serif text-xl sm:text-2xl text-(--ink) font-normal tracking-tight">
                Signature Wardrobe Pieces
              </h2>
            </div>
            <span className="text-[11px] font-sans font-medium text-muted">
              {itemsWithPhotos.length} Photographic Plates
            </span>
          </div>

          {/* Asymmetric Editorial Hero Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6">
            {/* Primary Hero Spotlight Card (First Photo Garment) */}
            {itemsWithPhotos[0] && (
              <div
                role="button"
                tabIndex={0}
                aria-label={`View details for ${itemsWithPhotos[0].name}`}
                onClick={() => setSelectedItem(itemsWithPhotos[0])}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedItem(itemsWithPhotos[0]);
                  }
                }}
                className="group relative md:col-span-6 lg:col-span-5 flex flex-col justify-end overflow-hidden rounded-3xl border border-border bg-(--paper) p-4 sm:p-6 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer min-h-[380px] sm:min-h-[440px] specular-border"
              >
                {/* Full-bleed Fashion Photo Backdrop */}
                <div className="absolute inset-0 z-0">
                  <ItemImage
                    item={itemsWithPhotos[0]}
                    className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
                </div>

                {/* Floating Favorite Button */}
                <button
                  type="button"
                  aria-label={itemsWithPhotos[0].favorite ? 'Remove from favorites' : 'Add to favorites'}
                  onClick={(e) => handleToggleFavorite(e, itemsWithPhotos[0])}
                  className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full glass-pill text-white shadow-xs transition-transform hover:scale-110 active:scale-95"
                >
                  <Heart
                    className={`h-4 w-4 ${
                      itemsWithPhotos[0].favorite ? 'fill-accent stroke-accent' : 'stroke-white'
                    }`}
                  />
                </button>

                {/* Hero Editorial Caption */}
                <div className="relative z-10 text-white space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-white/20 backdrop-blur-md px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white border border-white/30">
                      Signature Look
                    </span>
                    <span className="text-[10.5px] uppercase tracking-wider text-white/80 font-sans">
                      {itemsWithPhotos[0].category}
                    </span>
                  </div>

                  <h3 className="font-serif text-2xl sm:text-3xl font-normal tracking-tight text-white leading-tight">
                    {itemsWithPhotos[0].name}
                  </h3>

                  <p className="text-xs text-white/80 font-sans line-clamp-1">
                    {itemsWithPhotos[0].fabric ? `${itemsWithPhotos[0].fabric} · ` : ''}
                    {itemsWithPhotos[0].occasions.slice(0, 3).join(', ')}
                  </p>

                  <div className="pt-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-amber-200 group-hover:translate-x-1 transition-transform">
                    <span>Inspect Garment Plate</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </div>
            )}

            {/* Companion Photo Grid (Next 4 photo pieces) */}
            <div className="md:col-span-6 lg:col-span-7 grid grid-cols-2 gap-3 sm:gap-4">
              {itemsWithPhotos.slice(1, 5).map((photoItem) => (
                <div
                  key={photoItem.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`View details for ${photoItem.name}`}
                  onClick={() => setSelectedItem(photoItem)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedItem(photoItem);
                    }
                  }}
                  className="group relative flex flex-col justify-end overflow-hidden rounded-2xl border border-border bg-(--paper) p-3 sm:p-4 shadow-2xs hover:shadow-sm transition-all duration-300 cursor-pointer min-h-[180px] sm:min-h-[210px] specular-border"
                >
                  <div className="absolute inset-0 z-0">
                    <ItemImage
                      item={photoItem}
                      className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  </div>

                  <button
                    type="button"
                    aria-label={photoItem.favorite ? 'Remove from favorites' : 'Add to favorites'}
                    onClick={(e) => handleToggleFavorite(e, photoItem)}
                    className="absolute right-2.5 top-2.5 z-10 flex h-9 w-9 items-center justify-center rounded-full glass-pill text-white shadow-2xs transition-transform hover:scale-110 active:scale-95"
                  >
                    <Heart
                      className={`h-3.5 w-3.5 ${
                        photoItem.favorite ? 'fill-accent stroke-accent' : 'stroke-white'
                      }`}
                    />
                  </button>

                  <div className="relative z-10 text-white space-y-0.5">
                    <span className="text-[8.5px] uppercase tracking-widest text-white/75 font-sans block">
                      {photoItem.subcategory || photoItem.category}
                    </span>
                    <h4 className="font-serif text-base sm:text-lg font-normal tracking-tight text-white leading-tight line-clamp-1">
                      {photoItem.name}
                    </h4>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Quiet, Refined Filter Architecture */}
      <section aria-label="Wardrobe Filtering" className="mb-6 space-y-3">
        {/* Minimalist Search Input */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search archive by garment, textile, color, or occasion..."
            className="w-full min-h-11 rounded-2xl border border-border bg-card/70 pl-11 pr-12 text-base md:text-xs font-medium text-(--text) outline-none transition-colors placeholder:text-muted focus:border-accent focus:bg-card shadow-2xs"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex min-h-11 min-w-11 items-center justify-center text-[11px] font-bold text-muted hover:text-(--ink) transition-colors active:scale-95"
              aria-label="Clear search"
            >
              Clear
            </button>
          )}
        </div>

        {/* Category Pills (Quiet Horizontal Scroll) */}
        <div className="no-scrollbar -mx-3.5 sm:-mx-6 md:mx-0 flex gap-2 overflow-x-auto px-3.5 sm:px-6 md:px-0 py-1 md:flex-wrap scroll-fade-mask-end md:mask-none">
          <Chip
            label="All"
            count={stats.total}
            active={selectedCategory === 'All'}
            onClick={() => setSelectedCategory('All')}
          />
          {CATEGORIES.map((cat) => (
            <Chip
              key={cat}
              label={cat}
              count={stats.byCategory[cat]}
              active={selectedCategory === cat}
              onClick={() => setSelectedCategory(cat)}
            />
          ))}
        </div>

        {/* Secondary Care & Status Filter Bar */}
        <div className="no-scrollbar -mx-3.5 sm:-mx-6 md:mx-0 flex gap-2 overflow-x-auto px-3.5 sm:px-6 md:px-0 py-0.5 md:flex-wrap scroll-fade-mask-end md:mask-none items-center">
          <button
            type="button"
            onClick={() => setFavoriteOnly(!favoriteOnly)}
            aria-pressed={favoriteOnly}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[10.5px] font-semibold tracking-wider uppercase transition-all duration-150 ease-out whitespace-nowrap active:scale-[0.97] focus-editorial ${
              favoriteOnly
                ? 'border border-(--kumkum) bg-(--kumkum) text-white shadow-2xs'
                : 'border border-border bg-card/60 text-muted hover:border-(--ink)'
            }`}
          >
            <span>Favorites ({stats.favorites})</span>
          </button>

          {(
            [
              { id: 'clean', label: `Clean (${stats.clean})` },
              { id: 'needs_washing', label: `Needs Wash (${stats.needsWashing})` },
              { id: 'in_laundry', label: `In Laundry (${stats.inLaundry})` },
            ] as { id: Status; label: string }[]
          ).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStatusFilter(statusFilter === s.id ? 'All' : s.id)}
              aria-pressed={statusFilter === s.id}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[10.5px] font-semibold tracking-wider uppercase transition-all duration-150 ease-out whitespace-nowrap active:scale-[0.97] focus-editorial ${
                statusFilter === s.id
                  ? 'border border-(--ink) bg-(--ink) text-(--paper) shadow-2xs font-bold'
                  : 'border border-border bg-card/60 text-muted hover:border-(--ink)'
              }`}
            >
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Catalog Registry Header */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-baseline justify-between border-b border-border/60 pb-3 mt-4 sm:mt-6 gap-2">
        <div>
          <span className="editorial-kicker text-muted">ARCHIVAL REGISTRY</span>
          <h3 className="font-serif text-lg sm:text-xl text-(--ink) font-normal tracking-tight">
            All Garments & Swatches
          </h3>
        </div>

        <div className="flex items-center gap-3">
          {/* Dual View Mode Switcher */}
          <div className="flex items-center rounded-full border border-border/80 bg-card/60 p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('rail')}
              aria-pressed={viewMode === 'rail'}
              className={`flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-all tactile-press ${
                viewMode === 'rail'
                  ? 'bg-(--ink) text-(--paper) shadow-2xs'
                  : 'text-muted hover:text-(--ink)'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Studio Rail</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-pressed={viewMode === 'grid'}
              className={`flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-all tactile-press ${
                viewMode === 'grid'
                  ? 'bg-(--ink) text-(--paper) shadow-2xs'
                  : 'text-muted hover:text-(--ink)'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Grid</span>
            </button>
          </div>

          <span className="text-[11px] font-sans font-medium text-muted hidden sm:inline">
            {filteredItems.length} {filteredItems.length === 1 ? 'Piece' : 'Pieces'}
          </span>
        </div>
      </div>

      {/* Loading Skeletons */}
      {loading && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <WardrobeItemSkeleton key={n} />
          ))}
        </div>
      )}

      {/* Zero Items Empty State */}
      {!loading && items.length === 0 && (
        <EmptyState
          title="Your wardrobe is waiting"
          description="Start with one piece you love wearing, or load the sample Indian collection to explore."
          action={{
            label: 'Load Sample Wardrobe',
            onClick: loadSample,
          }}
        />
      )}

      {/* Filtered Empty State */}
      {!loading && items.length > 0 && filteredItems.length === 0 && (
        <EmptyState
          title="No pieces found"
          description="None of your garments match the active filter criteria."
          action={{
            label: 'Reset Filters',
            onClick: () => {
              setSearch('');
              setSelectedCategory('All');
              setStatusFilter('All');
              setFavoriteOnly(false);
            },
          }}
        />
      )}

      {/* Spatial Studio Rail View (Default) */}
      {!loading && filteredItems.length > 0 && viewMode === 'rail' && (
        <div className="space-y-8">
          <SpatialGarmentRail
            items={filteredItems}
            onSelectItem={setSelectedItem}
            onToggleFavorite={handleToggleFavorite}
            onUpdateItem={updateItem}
          />

          {/* Connected Catalog Overview Strip */}
          <div className="pt-4 border-t border-border/50">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="editorial-kicker text-muted">COMPLETE CATALOG</span>
                <h4 className="font-serif text-lg text-(--ink) font-normal">All Wardrobe Pieces</h4>
              </div>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className="text-xs font-semibold text-(--burnished-gold) hover:underline flex items-center gap-1 min-h-11 px-2"
              >
                <span>View full grid ({filteredItems.length})</span>
                <LayoutGrid className="h-3 w-3" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {filteredItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onSelect={setSelectedItem}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Complete Archival Grid View */}
      {!loading && filteredItems.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {filteredItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onSelect={setSelectedItem}
              onToggleFavorite={handleToggleFavorite}
            />
          ))}
        </div>
      )}

      {/* Detail Bottom Sheet */}
      <ItemDetailSheet
        item={selectedItem}
        isOpen={Boolean(selectedItem)}
        onClose={() => setSelectedItem(null)}
        onUpdate={updateItem}
        onDelete={deleteItem}
      />
    </div>
  );
};
