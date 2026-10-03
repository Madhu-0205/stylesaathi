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
            <span className="text-[10px] text-(--muted) font-devanagari">
              तुम्हारी वॉर्डरोब
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
            className="flex h-9 w-9 items-center justify-center rounded-full border border-(--border) text-(--muted) transition-colors hover:border-(--ink) hover:text-(--ink)"
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

      {/* Search Input */}
      <div className="relative mb-3.5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-(--muted) pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search garments by name, color, fabric..."
          className="w-full min-h-11 rounded-xl border border-(--border) bg-(--card)/60 pl-10 pr-4 text-xs font-medium text-(--text) outline-none transition-colors placeholder:text-(--muted) focus:border-(--accent) focus:bg-(--card)"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-(--muted) px-2 py-1"
          >
            Clear
          </button>
        )}
      </div>

      {/* Horizontal Category Chips */}
      <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 py-1">
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
      <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 py-0.5">
        <button
          type="button"
          onClick={() => setFavoriteOnly(!favoriteOnly)}
          className={`inline-flex min-h-8.5 items-center gap-1 rounded-lg px-3 text-[10px] font-semibold tracking-wider uppercase transition-all whitespace-nowrap ${
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
            className={`inline-flex min-h-8.5 items-center gap-1 rounded-lg px-3 text-[10px] font-semibold tracking-wider uppercase transition-all whitespace-nowrap ${
              statusFilter === s.id
                ? 'border border-(--ink) bg-(--ink) text-(--paper) shadow-2xs'
                : 'border border-(--border) bg-(--card) text-(--muted) hover:border-(--ink)'
            }`}
          >
            <span>{s.label}</span>
          </button>
        ))}
      </div>


      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {[1, 2, 3, 4].map((n) => (
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

      {/* 2-Column Editorial Garment Grid */}
      {!loading && filteredItems.length > 0 && (
        <div className="grid grid-cols-2 gap-x-3.5 gap-y-5 sm:grid-cols-3">
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
