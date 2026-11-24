import { useState, useMemo, useCallback } from 'react';
import { useWardrobeContext } from '../context/WardrobeContext';
import { Category, Status, Season, Occasion } from '../types';
import { CATEGORIES } from '../data/taxonomy';

export function useWardrobe() {
  const context = useWardrobeContext();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<Status | 'All'>('All');
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [colorFilter, setColorFilter] = useState<string>('All');
  const [seasonFilter, setSeasonFilter] = useState<Season | 'All'>('All');
  const [occasionFilter, setOccasionFilter] = useState<Occasion | 'All'>('All');

  const resetFilters = useCallback(() => {
    setSearch('');
    setSelectedCategory('All');
    setStatusFilter('All');
    setFavoriteOnly(false);
    setColorFilter('All');
    setSeasonFilter('All');
    setOccasionFilter('All');
  }, []);

  const hasActiveFilters = useMemo(() => {
    return Boolean(
      search.trim() ||
      selectedCategory !== 'All' ||
      statusFilter !== 'All' ||
      favoriteOnly ||
      colorFilter !== 'All' ||
      seasonFilter !== 'All' ||
      occasionFilter !== 'All'
    );
  }, [search, selectedCategory, statusFilter, favoriteOnly, colorFilter, seasonFilter, occasionFilter]);

  const filteredItems = useMemo(() => {
    return context.items.filter((item) => {
      // Category match
      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false;
      }
      // Status match
      if (statusFilter !== 'All' && item.status !== statusFilter) {
        return false;
      }
      // Favorite match
      if (favoriteOnly && !item.favorite) {
        return false;
      }
      // Color match
      if (colorFilter !== 'All') {
        const itemColorsLower = (item.colors || []).map((c) => c.toLowerCase());
        if (!itemColorsLower.includes(colorFilter.toLowerCase())) {
          return false;
        }
      }
      // Season match
      if (seasonFilter !== 'All') {
        if (!item.seasons || !item.seasons.includes(seasonFilter)) {
          return false;
        }
      }
      // Occasion match
      if (occasionFilter !== 'All') {
        if (!item.occasions || !item.occasions.includes(occasionFilter)) {
          return false;
        }
      }
      // Search match (operates on real garment attributes and existing metadata)
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesName = (item.name || '').toLowerCase().includes(query);
        const matchesSub = (item.subcategory || '').toLowerCase().includes(query);
        const matchesCat = (item.category || '').toLowerCase().includes(query);
        const matchesColor = (item.colors || []).some((c) => c.toLowerCase().includes(query));
        const matchesFabric = (item.fabric || '').toLowerCase().includes(query);
        const matchesNote = (item.note || '').toLowerCase().includes(query);
        const matchesOccasion = (item.occasions || []).some((occ) => occ.toLowerCase().includes(query));
        const matchesSeason = (item.seasons || []).some((s) => s.toLowerCase().includes(query));
        const matchesBrand = (item.brand || '').toLowerCase().includes(query);

        if (
          !matchesName &&
          !matchesSub &&
          !matchesCat &&
          !matchesColor &&
          !matchesFabric &&
          !matchesNote &&
          !matchesOccasion &&
          !matchesSeason &&
          !matchesBrand
        ) {
          return false;
        }
      }
      return true;
    });
  }, [
    context.items,
    selectedCategory,
    statusFilter,
    favoriteOnly,
    colorFilter,
    seasonFilter,
    occasionFilter,
    search,
  ]);

  const stats = useMemo(() => {
    const counts: Record<Category, number> = {
      Tops: 0,
      Bottoms: 0,
      Ethnic: 0,
      Dresses: 0,
      Outerwear: 0,
      Footwear: 0,
      Accessories: 0,
    };
    for (const cat of CATEGORIES) {
      counts[cat] = context.items.filter((i) => i.category === cat).length;
    }

    // Extract unique colors present in actual wardrobe
    const colorSet = new Set<string>();
    for (const item of context.items) {
      for (const col of item.colors || []) {
        if (col && col.trim()) {
          colorSet.add(col.trim().toLowerCase());
        }
      }
    }

    return {
      total: context.items.length,
      clean: context.items.filter((i) => i.status === 'clean').length,
      needsWashing: context.items.filter((i) => i.status === 'needs_washing').length,
      inLaundry: context.items.filter((i) => i.status === 'in_laundry').length,
      favorites: context.items.filter((i) => i.favorite).length,
      byCategory: counts,
      availableColors: Array.from(colorSet).sort(),
    };
  }, [context.items]);

  return {
    ...context,
    search,
    setSearch,
    selectedCategory,
    setSelectedCategory,
    statusFilter,
    setStatusFilter,
    favoriteOnly,
    setFavoriteOnly,
    colorFilter,
    setColorFilter,
    seasonFilter,
    setSeasonFilter,
    occasionFilter,
    setOccasionFilter,
    resetFilters,
    hasActiveFilters,
    filteredItems,
    stats,
  };
}
