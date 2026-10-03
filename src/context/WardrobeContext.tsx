import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { WardrobeItem, SavedOutfit, GeneratedOutfit, StylePreferences, OutfitPlan, PlanStatus } from '../types';
import { wardrobeRepository } from '../repositories/LocalStorageWardrobeRepository';
import { preferencesRepository, DEFAULT_STYLE_PREFERENCES } from '../repositories/LocalStoragePreferencesRepository';
import { calendarRepository } from '../repositories/LocalStorageCalendarRepository';
import { sampleWardrobe } from '../data/sampleWardrobe';
import { clearImages, deleteImage } from '../services/imageStore';
import { migrateLegacyPhotos } from '../services/migration';

const SETTINGS_KEY = 'stylesaathi-settings-v1';

interface SettingsData {
  theme: 'light' | 'dark';
  onboarded: boolean;
  styleVibes: string[];
  setupCompleted?: boolean;
}

interface WardrobeContextValue {
  items: WardrobeItem[];
  loading: boolean;
  theme: 'light' | 'dark';
  onboarded: boolean;
  styleVibes: string[];
  setupCompleted: boolean;
  savedOutfits: SavedOutfit[];
  preferences: StylePreferences;
  plans: OutfitPlan[];
  toast: string | null;
  showToast: (msg: string) => void;
  clearToast: () => void;
  addItem: (item: WardrobeItem) => Promise<void>;
  updateItem: (id: string, patch: Partial<WardrobeItem>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  loadSample: () => Promise<void>;
  resetWardrobe: () => Promise<void>;
  resetAll: () => Promise<void>;
  toggleTheme: () => void;
  setOnboarded: (val: boolean) => void;
  setStyleVibes: (vibes: string[]) => void;
  setSetupCompleted: (val: boolean) => void;
  updatePreferences: (patch: Partial<StylePreferences>) => Promise<void>;
  savePlan: (plan: Omit<OutfitPlan, 'id' | 'createdAt' | 'updatedAt'> | OutfitPlan) => Promise<OutfitPlan>;
  deletePlan: (id: string) => Promise<void>;
  updatePlanStatus: (id: string, status: PlanStatus) => Promise<void>;
  markOutfitWornOnDate: (outfit: GeneratedOutfit, dateStr: string, accessory?: WardrobeItem | null) => Promise<void>;
  saveOutfit: (outfit: GeneratedOutfit, name?: string) => Promise<SavedOutfit>;
  deleteSavedOutfit: (id: string) => Promise<void>;
}

const WardrobeContext = createContext<WardrobeContextValue | null>(null);

export const WardrobeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [preferences, setPreferences] = useState<StylePreferences>(DEFAULT_STYLE_PREFERENCES);
  const [plans, setPlans] = useState<OutfitPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  // Settings state (theme, onboarded, styleVibes, setupCompleted)
  const [settings, setSettings] = useState<SettingsData>(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { theme: 'light', onboarded: false, styleVibes: ['Casual'], setupCompleted: false };
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

  // Load items, saved outfits, preferences, and plans on mount + execute safe migration
  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      const [loadedItems, loadedOutfits, loadedPrefs, loadedPlans] = await Promise.all([
        wardrobeRepository.getItems(),
        wardrobeRepository.getSavedOutfits(),
        preferencesRepository.getPreferences(),
        calendarRepository.getPlans(),
      ]);

      // Run safe idempotent migration from base64 photos to IndexedDB
      const { migratedItems, hasChanges } = await migrateLegacyPhotos(loadedItems);
      if (hasChanges) {
        for (const itm of migratedItems) {
          await wardrobeRepository.updateItem(itm.id, itm);
        }
        setItems(migratedItems);
      } else {
        setItems(loadedItems);
      }

      setSavedOutfits(loadedOutfits);
      if (loadedPrefs) setPreferences(loadedPrefs);
      if (loadedPlans) setPlans(loadedPlans);
    } catch (err) {
      console.warn('Error refreshing wardrobe data:', err);
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

  const deleteItem = useCallback(
    async (id: string) => {
      try {
        const itemToDelete = items.find((i) => i.id === id);
        if (itemToDelete?.photoId) {
          await deleteImage(itemToDelete.photoId);
        }
        await deleteImage(id);
      } catch (err) {
        console.warn('Failed to clean up image for item', id, err);
      }
      await wardrobeRepository.deleteItem(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    },
    [items]
  );

  const loadSample = useCallback(async () => {
    setLoading(true);
    try {
      await clearImages();
    } catch (err) {
      console.warn('Failed to clear images during loadSample:', err);
    }
    await wardrobeRepository.clear();
    for (const item of sampleWardrobe) {
      await wardrobeRepository.addItem(item);
    }
    setItems(sampleWardrobe);
    setSettings((s) => ({ ...s, onboarded: true }));
    setLoading(false);
  }, []);

  const resetWardrobe = useCallback(async () => {
    try {
      await clearImages();
    } catch (err) {
      console.warn('Failed to clear images during resetWardrobe:', err);
    }
    await wardrobeRepository.clear();
    setItems([]);
    setSavedOutfits([]);
  }, []);

  const resetAll = useCallback(async () => {
    try {
      await clearImages();
    } catch (err) {
      console.warn('Failed to clear images during resetAll:', err);
    }
    await wardrobeRepository.clear();
    await preferencesRepository.clear();
    await calendarRepository.clear();
    setItems([]);
    setSavedOutfits([]);
    setPreferences(DEFAULT_STYLE_PREFERENCES);
    setPlans([]);
    setSettings({ theme: 'light', onboarded: false, styleVibes: [], setupCompleted: false });
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

  const setSetupCompleted = useCallback((val: boolean) => {
    setSettings((s) => ({ ...s, setupCompleted: val }));
  }, []);

  const updatePreferences = useCallback(
    async (patch: Partial<StylePreferences>) => {
      const updated: StylePreferences = {
        ...preferences,
        ...patch,
        updatedAt: Date.now(),
      };
      await preferencesRepository.savePreferences(updated);
      setPreferences(updated);
    },
    [preferences]
  );

  const savePlan = useCallback(
    async (planData: Omit<OutfitPlan, 'id' | 'createdAt' | 'updatedAt'> | OutfitPlan) => {
      const id =
        'id' in planData && planData.id
          ? planData.id
          : `plan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const fullPlan: OutfitPlan = {
        ...planData,
        id,
        createdAt: 'createdAt' in planData ? planData.createdAt : Date.now(),
        updatedAt: Date.now(),
      };
      await calendarRepository.savePlan(fullPlan);
      setPlans((prev) => {
        const idx = prev.findIndex((p) => p.date === fullPlan.date || p.id === fullPlan.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = fullPlan;
          return copy;
        }
        return [...prev, fullPlan];
      });
      return fullPlan;
    },
    []
  );

  const deletePlan = useCallback(async (id: string) => {
    await calendarRepository.deletePlan(id);
    setPlans((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const updatePlanStatus = useCallback(async (id: string, status: PlanStatus) => {
    await calendarRepository.updatePlanStatus(id, status);
    setPlans((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status, updatedAt: Date.now() } : p))
    );
  }, []);

  const markOutfitWornOnDate = useCallback(
    async (outfit: GeneratedOutfit, dateStr: string, accessory?: WardrobeItem | null) => {
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
      // If a plan exists for this date, update its status to 'worn'
      const existingPlan = plans.find((p) => p.date === dateStr);
      if (existingPlan) {
        await updatePlanStatus(existingPlan.id, 'worn');
      } else {
        // Create a worn plan record for this date in Style Calendar
        await savePlan({
          date: dateStr,
          outfit,
          accessory,
          occasion: 'everyday',
          status: 'worn',
        });
      }
    },
    [plans, savePlan, updateItem, updatePlanStatus]
  );

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
      setupCompleted: Boolean(settings.setupCompleted),
      savedOutfits,
      preferences,
      plans,
      toast,
      showToast,
      clearToast,
      addItem,
      updateItem,
      deleteItem,
      loadSample,
      resetWardrobe,
      resetAll,
      toggleTheme,
      setOnboarded,
      setStyleVibes,
      setSetupCompleted,
      updatePreferences,
      savePlan,
      deletePlan,
      updatePlanStatus,
      markOutfitWornOnDate,
      saveOutfit,
      deleteSavedOutfit,
    }),
    [
      items,
      loading,
      settings,
      savedOutfits,
      preferences,
      plans,
      toast,
      showToast,
      clearToast,
      addItem,
      updateItem,
      deleteItem,
      loadSample,
      resetWardrobe,
      resetAll,
      toggleTheme,
      setOnboarded,
      setStyleVibes,
      setSetupCompleted,
      updatePreferences,
      savePlan,
      deletePlan,
      updatePlanStatus,
      markOutfitWornOnDate,
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
