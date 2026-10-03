import React, { useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { useWardrobe } from '../hooks/useWardrobe';
import { Chip } from '../components/common/Chip';
import { ItemCard } from '../components/wardrobe/ItemCard';
import { ItemDetailSheet } from '../components/wardrobe/ItemDetailSheet';
import { EmptyState } from '../components/common/EmptyState';
import { CATEGORIES } from '../data/taxonomy';
import { WardrobeItem, Category, Status } from '../types';

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

  const handleToggleFavorite = async (e: React.MouseEvent, item: WardrobeItem) => {
    e.stopPropagation();
    await updateItem(item.id, { favorite: !item.favorite });
  };

  return (
    <div className="pb-8 animate-fade-in">
      {/* Compact Fashion Archive Header */}
      <header className="mb-3 flex items-center justify-between border-b border-(--border) pb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[9.5px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
              WARDROBE
            </span>
          </div>
          <h1 className="mt-0.5 font-serif text-2xl sm:text-3xl font-normal text-(--ink) tracking-tight">
            Personal Archive
          </h1>
          <p className="text-[11px] text-(--muted) font-medium">
            {stats.total} pieces in rotation · {stats.clean} ready to wear
          </p>
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
            onClick={onOpenAddItem}
            aria-label="Add clothing item"
            className="flex min-h-9 items-center gap-1.5 rounded-full bg-(--accent) px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs transition-transform hover:opacity-95 active:scale-95"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>Add Piece</span>
          </button>
        </div>
      </header>

      {/* Search Input and Filters */}
      <div className="mb-4 space-y-2.5 md:space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-(--muted) pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search garments by name, color, fabric..."
            className="w-full min-h-11 rounded-xl border border-(--border) bg-(--card)/60 pl-10 pr-12 text-xs font-medium text-(--text) outline-none transition-colors placeholder:text-(--muted) focus:border-(--accent) focus:bg-(--card)"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-1 top-1/2 -translate-y-1/2 flex min-h-11 min-w-11 items-center justify-center text-[11px] font-bold text-(--muted) hover:text-(--ink) transition-colors active:scale-95"
              aria-label="Clear search"
            >
              Clear
            </button>
          )}
        </div>

        {/* Category Filter Chips */}
        <div className="no-scrollbar -mx-3.5 sm:-mx-6 md:mx-0 flex gap-2 overflow-x-auto px-3.5 sm:px-6 md:px-0 py-1 md:flex-wrap">
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

        {/* Secondary Status & Favorite Filters */}
        <div className="no-scrollbar -mx-3.5 sm:-mx-6 md:mx-0 flex gap-2 overflow-x-auto px-3.5 sm:px-6 md:px-0 py-0.5 md:flex-wrap">
          <button
            type="button"
            onClick={() => setFavoriteOnly(!favoriteOnly)}
            className={`inline-flex min-h-8.5 items-center gap-1 rounded-lg px-3 text-[10px] font-semibold tracking-wider uppercase transition-all whitespace-nowrap active:scale-95 ${
              favoriteOnly
                ? 'border border-(--kumkum) bg-(--kumkum) text-white shadow-2xs'
                : 'border border-(--border) bg-(--card) text-(--muted) hover:border-(--ink)'
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
              className={`inline-flex min-h-8.5 items-center gap-1 rounded-lg px-3 text-[10px] font-semibold tracking-wider uppercase transition-all whitespace-nowrap active:scale-95 ${
                statusFilter === s.id
                  ? 'border border-(--ink) bg-(--ink) text-(--paper) shadow-2xs'
                  : 'border border-(--border) bg-(--card) text-(--muted) hover:border-(--ink)'
              }`}
            >
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="aspect-4/5 animate-pulse rounded-2xl border border-(--border) bg-(--card)"
            />
          ))}
        </div>
      )}

      {/* Zero Wardrobe Empty State */}
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

      {/* Responsive Garment Grid: 2-col on phone, 3-col on tablet, 4-col on desktop, 5-col on wide desktop */}
      {!loading && filteredItems.length > 0 && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-x-4 sm:gap-y-5 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
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
