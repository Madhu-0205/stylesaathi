import { useState, useMemo } from 'react';
import { useWardrobeContext } from '../context/WardrobeContext';
import { Category, Status } from '../types';
import { CATEGORIES } from '../data/taxonomy';

export function useWardrobe() {
  const context = useWardrobeContext();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<Status | 'All'>('All');
  const [favoriteOnly, setFavoriteOnly] = useState(false);

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
      // Search match (name, subcategory, color)
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(query);
        const matchesSub = item.subcategory?.toLowerCase().includes(query);
        const matchesColor = item.colors.some((c) => c.toLowerCase().includes(query));
        if (!matchesName && !matchesSub && !matchesColor) {
          return false;
        }
      }
      return true;
    });
  }, [context.items, selectedCategory, statusFilter, favoriteOnly, search]);

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
    return {
      total: context.items.length,
      clean: context.items.filter((i) => i.status === 'clean').length,
      needsWashing: context.items.filter((i) => i.status === 'needs_washing').length,
      inLaundry: context.items.filter((i) => i.status === 'in_laundry').length,
      favorites: context.items.filter((i) => i.favorite).length,
      byCategory: counts,
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
    filteredItems,
    stats,
  };
}
