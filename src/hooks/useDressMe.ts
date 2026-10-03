import { useState, useMemo, useCallback } from 'react';
import { useWardrobeContext } from '../context/WardrobeContext';
import { Occasion, Season, GeneratedOutfit, WardrobeItem } from '../types';
import { generateOutfits } from '../engine';

export function useDressMe() {
  const { items, updateItem, saveOutfit } = useWardrobeContext();
  const [occasion, setOccasion] = useState<Occasion>('college');
  const [season, setSeason] = useState<Season>('summer');
  const [seed, setSeed] = useState<number>(() => Math.random());
  const [activeAccessories, setActiveAccessories] = useState<Record<number, WardrobeItem | null>>({});

  // Generate 2-4 outfits for chosen occasion & season
  const outfits = useMemo(() => {
    return generateOutfits(items, occasion, season, 4, seed);
  }, [items, occasion, season, seed]);

  // Clean accessories available in wardrobe
  const availableAccessories = useMemo(() => {
    return items.filter((i) => i.category === 'Accessories' && i.status === 'clean');
  }, [items]);

  // Shuffle generates another valid combination
  const shuffle = useCallback(() => {
    setSeed(Math.random());
    setActiveAccessories({});
  }, []);

  // Attach or remove accessory from specific outfit index
  const setOutfitAccessory = useCallback((outfitIndex: number, accessory: WardrobeItem | null) => {
    setActiveAccessories((prev) => ({
      ...prev,
      [outfitIndex]: prev[outfitIndex]?.id === accessory?.id ? null : accessory,
    }));
  }, []);

  // Mark all pieces in outfit as worn today (increments timesWorn and records lastWorn)
  const markWoreOutfit = useCallback(
    async (outfit: GeneratedOutfit, accessory?: WardrobeItem | null) => {
      const allPieces = Object.values(outfit.slots).flat();
      if (accessory) {
        allPieces.push(accessory);
      }
      const now = Date.now();
      for (const piece of allPieces) {
        await updateItem(piece.id, {
          timesWorn: (piece.timesWorn || 0) + 1,
          lastWorn: now,
        });
      }
    },
    [updateItem]
  );

  return {
    occasion,
    setOccasion,
    season,
    setSeason,
    outfits,
    shuffle,
    availableAccessories,
    activeAccessories,
    setOutfitAccessory,
    markWoreOutfit,
    saveOutfit,
  };
}
