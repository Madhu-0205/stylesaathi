import React, { useState } from 'react';
import { Search, Plus, Sparkles, Filter } from 'lucide-react';
import { useWardrobe } from '../hooks/useWardrobe';
import { Header } from '../components/common/Header';
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
      {/* Top Header */}
      <Header
        title="My Wardrobe"
        subtitle={`${stats.total} pieces · ${stats.clean} ready to wear`}
        theme={theme}
        onToggleTheme={toggleTheme}
        action={
          <button
            type="button"
            onClick={onOpenAddItem}
            className="flex min-h-11 items-center gap-1.5 rounded-2xl bg-(--accent) px-4 py-2 text-xs font-bold text-white shadow-xs transition-transform hover:opacity-95 active:scale-95"
          >
            <Plus className="h-4 w-4 stroke-3" />
            <span>Add</span>
          </button>
        }
      />

      {/* Search Input */}
      <div className="relative mb-3">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-(--muted) pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clothes by name, style, color..."
          className="w-full min-h-11 rounded-2xl border border-(--border) bg-(--card) pl-11 pr-4 text-xs font-medium text-(--text) outline-none transition-colors placeholder:text-(--muted) focus:border-(--accent)"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-(--muted) px-2 py-1"
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

      {/* Secondary Status & Favorite Filter Chips */}
      <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 py-0.5">
        <button
          type="button"
          onClick={() => setFavoriteOnly(!favoriteOnly)}
          className={`inline-flex min-h-9 items-center gap-1 rounded-full px-3.5 text-[11px] font-semibold transition-all ${
            favoriteOnly
              ? 'bg-(--accent) text-white shadow-xs'
              : 'border border-(--border) bg-(--card) text-(--muted) hover:text-(--text)'
          }`}
        >
          <span>Favorites ({stats.favorites})</span>
        </button>

        {(
          [
            { id: 'clean', label: `Clean (${stats.clean})` },
            { id: 'needs_washing', label: `Needs Wash (${stats.needsWashing})` },
            { id: 'in_laundry', label: `Laundry (${stats.inLaundry})` },
          ] as { id: Status; label: string }[]
        ).map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStatusFilter(statusFilter === s.id ? 'All' : s.id)}
            className={`inline-flex min-h-9 items-center gap-1 rounded-full px-3.5 text-[11px] font-semibold transition-all ${
              statusFilter === s.id
                ? 'bg-(--text) text-(--background) shadow-xs'
                : 'border border-(--border) bg-(--card) text-(--muted) hover:text-(--text)'
            }`}
          >
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      {/* Tiny Wardrobe Guidance Banner */}
      {items.length > 0 && items.length < 5 && (
        <div className="mb-4 rounded-3xl border border-(--accent)/30 bg-(--accent-light)/40 p-4 text-(--text)">
          <div className="flex items-center gap-2 text-xs font-bold text-(--accent)">
            <Sparkles className="h-4 w-4" />
            Your wardrobe is just getting started
          </div>
          <p className="mt-1 text-xs text-(--muted) leading-relaxed">
            Add 5–8 pieces (tops, bottoms, and footwear) so StyleSaathi can start crafting complete looks.
          </p>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="aspect-square animate-pulse rounded-3xl border border-(--border) bg-(--card)"
            />
          ))}
        </div>
      )}

      {/* Zero Wardrobe Empty State */}
      {!loading && items.length === 0 && (
        <EmptyState
          icon={<Plus className="h-7 w-7" />}
          title="Your wardrobe is empty"
          description="Add your first clothing piece or load the sample Indian wardrobe to explore StyleSaathi."
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
          description="None of your clothes match the selected search and filter criteria."
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

      {/* 2-Column Clothing Grid */}
      {!loading && filteredItems.length > 0 && (
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
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
