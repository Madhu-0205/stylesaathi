import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { WardrobeItem, SavedOutfit, GeneratedOutfit } from '../types';
import { wardrobeRepository } from '../repositories/LocalStorageWardrobeRepository';
import { sampleWardrobe } from '../data/sampleWardrobe';

const SETTINGS_KEY = 'stylesaathi-settings-v1';

interface SettingsData {
  theme: 'light' | 'dark';
  onboarded: boolean;
  styleVibes: string[];
}

interface WardrobeContextValue {
  items: WardrobeItem[];
  loading: boolean;
  theme: 'light' | 'dark';
  onboarded: boolean;
  styleVibes: string[];
  savedOutfits: SavedOutfit[];
  addItem: (item: WardrobeItem) => Promise<void>;
  updateItem: (id: string, patch: Partial<WardrobeItem>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  loadSample: () => Promise<void>;
  resetWardrobe: () => Promise<void>;
  resetAll: () => Promise<void>;
  toggleTheme: () => void;
  setOnboarded: (val: boolean) => void;
  setStyleVibes: (vibes: string[]) => void;
  saveOutfit: (outfit: GeneratedOutfit, name?: string) => Promise<SavedOutfit>;
  deleteSavedOutfit: (id: string) => Promise<void>;
}

const WardrobeContext = createContext<WardrobeContextValue | null>(null);

export const WardrobeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [loading, setLoading] = useState(true);

  // Settings state (theme, onboarded, styleVibes)
  const [settings, setSettings] = useState<SettingsData>(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { theme: 'light', onboarded: false, styleVibes: ['Casual'] };
  });

  // Sync settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  // Apply dark mode class to document
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', settings.theme === 'dark');
    }
  }, [settings.theme]);

  // Load items and saved outfits on mount
  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      const [loadedItems, loadedOutfits] = await Promise.all([
        wardrobeRepository.getItems(),
        wardrobeRepository.getSavedOutfits(),
      ]);
      setItems(loadedItems);
      setSavedOutfits(loadedOutfits);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const addItem = useCallback(async (item: WardrobeItem) => {
    await wardrobeRepository.addItem(item);
    setItems((prev) => [item, ...prev.filter((i) => i.id !== item.id)]);
  }, []);

  const updateItem = useCallback(async (id: string, patch: Partial<WardrobeItem>) => {
    await wardrobeRepository.updateItem(id, patch);
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const deleteItem = useCallback(async (id: string) => {
    await wardrobeRepository.deleteItem(id);
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const loadSample = useCallback(async () => {
    setLoading(true);
    await wardrobeRepository.clear();
    for (const item of sampleWardrobe) {
      await wardrobeRepository.addItem(item);
    }
    setItems(sampleWardrobe);
    setSettings((s) => ({ ...s, onboarded: true }));
    setLoading(false);
  }, []);

  const resetWardrobe = useCallback(async () => {
    await wardrobeRepository.clear();
    setItems([]);
    setSavedOutfits([]);
  }, []);

  const resetAll = useCallback(async () => {
    await wardrobeRepository.clear();
    setItems([]);
    setSavedOutfits([]);
    setSettings({ theme: 'light', onboarded: false, styleVibes: [] });
  }, []);

  const toggleTheme = useCallback(() => {
    setSettings((s) => ({ ...s, theme: s.theme === 'light' ? 'dark' : 'light' }));
  }, []);

  const setOnboarded = useCallback((val: boolean) => {
    setSettings((s) => ({ ...s, onboarded: val }));
  }, []);

  const setStyleVibes = useCallback((vibes: string[]) => {
    setSettings((s) => ({ ...s, styleVibes: vibes }));
  }, []);

  const saveOutfit = useCallback(async (outfit: GeneratedOutfit, name?: string) => {
    const saved = await wardrobeRepository.saveOutfit(outfit, name);
    setSavedOutfits((prev) => [saved, ...prev]);
    return saved;
  }, []);

  const deleteSavedOutfit = useCallback(async (id: string) => {
    await wardrobeRepository.deleteSavedOutfit(id);
    setSavedOutfits((prev) => prev.filter((o) => o.id !== id));
  }, []);

  const value = useMemo<WardrobeContextValue>(
    () => ({
      items,
      loading,
      theme: settings.theme,
      onboarded: settings.onboarded,
      styleVibes: settings.styleVibes,
      savedOutfits,
      addItem,
      updateItem,
      deleteItem,
      loadSample,
      resetWardrobe,
      resetAll,
      toggleTheme,
      setOnboarded,
      setStyleVibes,
      saveOutfit,
      deleteSavedOutfit,
    }),
    [
      items,
      loading,
      settings,
      savedOutfits,
      addItem,
      updateItem,
      deleteItem,
      loadSample,
      resetWardrobe,
      resetAll,
      toggleTheme,
      setOnboarded,
      setStyleVibes,
      saveOutfit,
      deleteSavedOutfit,
    ]
  );

  return <WardrobeContext.Provider value={value}>{children}</WardrobeContext.Provider>;
};

export const useWardrobeContext = (): WardrobeContextValue => {
  const ctx = useContext(WardrobeContext);
  if (!ctx) {
    throw new Error('useWardrobeContext must be used within a WardrobeProvider');
  }
  return ctx;
};
