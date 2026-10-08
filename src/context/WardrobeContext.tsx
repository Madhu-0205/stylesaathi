import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import {
  WardrobeItem,
  SavedOutfit,
  GeneratedOutfit,
  StylePreferences,
  OutfitPlan,
  PlanStatus,
  WearEvent,
  StyleSignalEvent,
  PersonalStyleProfile,
} from '../types';
import { wardrobeRepository } from '../repositories/LocalStorageWardrobeRepository';
import { preferencesRepository, DEFAULT_STYLE_PREFERENCES } from '../repositories/LocalStoragePreferencesRepository';
import { calendarRepository } from '../repositories/LocalStorageCalendarRepository';
import { wearEventsRepository } from '../repositories/LocalStorageWearEventsRepository';
import { styleSignalsRepository } from '../repositories/LocalStorageStyleSignalsRepository';
import { derivePersonalStyleProfile } from '../engine/styleBrain';
import { sampleWardrobe } from '../data/sampleWardrobe';
import { clearImages, deleteImage } from '../services/imageStore';
import { migrateLegacyPhotos } from '../services/migration';
import { syncQueue } from '../lib/sync/syncQueue';
import { syncService } from '../lib/sync/syncService';

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
  styleSignals: StyleSignalEvent[];
  styleProfile: PersonalStyleProfile;
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
  recordSignal: (signal: Omit<StyleSignalEvent, 'id' | 'userId' | 'createdAt'> | StyleSignalEvent) => Promise<void>;
  resetLearnedStyle: () => Promise<void>;
  refreshData: () => Promise<void>;
}

const WardrobeContext = createContext<WardrobeContextValue | null>(null);

export const WardrobeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [preferences, setPreferences] = useState<StylePreferences>(DEFAULT_STYLE_PREFERENCES);
  const [plans, setPlans] = useState<OutfitPlan[]>([]);
  const [wearEvents, setWearEvents] = useState<WearEvent[]>([]);
  const [styleSignals, setStyleSignals] = useState<StyleSignalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const styleProfile = useMemo(() => {
    return derivePersonalStyleProfile(styleSignals, wearEvents, items, preferences);
  }, [styleSignals, wearEvents, items, preferences]);

  const [settings, setSettings] = useState<SettingsData>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(SETTINGS_KEY);
        if (raw) return JSON.parse(raw);
      }
    } catch {}
    return {
      theme: 'light',
      onboarded: false,
      styleVibes: [],
      setupCompleted: false,
    };
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      }
    } catch (e) {
      console.error('Failed to save settings to localStorage', e);
    }
  }, [settings]);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.theme]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  const refreshData = useCallback(async () => {
    try {
      const [loadedItems, loadedOutfits, loadedPrefs, loadedPlans, loadedWear, loadedSignals] = await Promise.all([
        wardrobeRepository.getItems(),
        wardrobeRepository.getSavedOutfits(),
        preferencesRepository.getPreferences(),
        calendarRepository.getPlans(),
        wearEventsRepository.getEvents(),
        styleSignalsRepository.getSignals(),
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
      setWearEvents(loadedWear || []);
      setStyleSignals(loadedSignals || []);
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

    try {
      let imageMutId: string | undefined;
      const user = syncService.getCurrentUser();
      const userId = user?.id || 'guest';
      if (item.photoId) {
        const imgMutation = await syncQueue.enqueue({
          entityType: 'wardrobe_image',
          entityId: item.photoId,
          operation: 'UPLOAD_IMAGE',
          payload: {
            itemId: item.id,
            photoId: item.photoId,
            storagePath: `wardrobe/${userId}/${item.id}/${item.photoId}.jpg`,
          },
        });
        imageMutId = imgMutation.id;
      }

      await syncQueue.enqueue({
        entityType: 'wardrobe_item',
        entityId: item.id,
        operation: 'UPSERT',
        payload: item,
        dependencies: imageMutId ? [imageMutId] : [],
      });

      syncService.processQueue();
    } catch (err) {
      console.warn('Sync enqueue failed for addItem:', err);
    }
  }, []);

  const updateItem = useCallback(async (id: string, patch: Partial<WardrobeItem>) => {
    await wardrobeRepository.updateItem(id, patch);
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));

    try {
      const updated = await wardrobeRepository.getItem(id);
      if (updated) {
        await syncQueue.enqueue({
          entityType: 'wardrobe_item',
          entityId: id,
          operation: 'UPSERT',
          payload: updated,
        });
        syncService.processQueue();
      }
    } catch (err) {
      console.warn('Sync enqueue failed for updateItem:', err);
    }
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

      try {
        await syncQueue.enqueue({
          entityType: 'wardrobe_item',
          entityId: id,
          operation: 'DELETE',
          payload: { id, deletedAt: Date.now() },
        });
        syncService.processQueue();
      } catch (err) {
        console.warn('Sync enqueue failed for deleteItem:', err);
      }
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
    await styleSignalsRepository.clear();
    setItems([]);
    setSavedOutfits([]);
    setPreferences(DEFAULT_STYLE_PREFERENCES);
    setPlans([]);
    setWearEvents([]);
    setStyleSignals([]);
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

      try {
        const user = syncService.getCurrentUser();
        await syncQueue.enqueue({
          entityType: 'style_preferences',
          entityId: user?.id || 'preferences',
          operation: 'UPSERT',
          payload: updated,
        });
        syncService.processQueue();
      } catch (err) {
        console.warn('Sync enqueue failed for preferences:', err);
      }
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

      try {
        await syncQueue.enqueue({
          entityType: 'calendar_plan',
          entityId: fullPlan.id,
          operation: 'UPSERT',
          payload: fullPlan,
        });
        syncService.processQueue();
      } catch (err) {
        console.warn('Sync enqueue failed for savePlan:', err);
      }
      return fullPlan;
    },
    []
  );

  const deletePlan = useCallback(
    async (id: string) => {
      const planToDelete = plans.find((p) => p.id === id);
      await calendarRepository.deletePlan(id);
      setPlans((prev) => prev.filter((p) => p.id !== id));

      try {
        await syncQueue.enqueue({
          entityType: 'calendar_plan',
          entityId: id,
          operation: 'DELETE',
          payload: { id, date: planToDelete?.date || '', deletedAt: Date.now() },
        });
        syncService.processQueue();
      } catch (err) {
        console.warn('Sync enqueue failed for deletePlan:', err);
      }
    },
    [plans]
  );

  const updatePlanStatus = useCallback(
    async (id: string, status: PlanStatus) => {
      await calendarRepository.updatePlanStatus(id, status);
      setPlans((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status, updatedAt: Date.now() } : p))
      );

      try {
        const plan = await calendarRepository.getPlanByDate(
          plans.find((p) => p.id === id)?.date || ''
        );
        if (plan) {
          await syncQueue.enqueue({
            entityType: 'calendar_plan',
            entityId: id,
            operation: 'UPSERT',
            payload: plan,
          });
          syncService.processQueue();
        }
      } catch (err) {
        console.warn('Sync enqueue failed for updatePlanStatus:', err);
      }
    },
    [plans]
  );

  const recordSignal = useCallback(
    async (signalInput: Omit<StyleSignalEvent, 'id' | 'userId' | 'createdAt'> | StyleSignalEvent) => {
      const user = syncService.getCurrentUser();
      const userId = user?.id || 'local';
      const now = Date.now();
      const eventId =
        'id' in signalInput && signalInput.id
          ? signalInput.id
          : typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `signal-${now}-${Math.random().toString(36).slice(2, 9)}`;

      const fullSignal: StyleSignalEvent = {
        ...signalInput,
        id: eventId,
        userId,
        createdAt: 'createdAt' in signalInput && signalInput.createdAt ? signalInput.createdAt : now,
      };

      await styleSignalsRepository.addSignal(fullSignal);
      setStyleSignals((prev) => {
        if (prev.some((s) => s.id === fullSignal.id)) return prev;
        return [...prev, fullSignal];
      });

      try {
        await syncQueue.enqueue({
          entityType: 'style_signal',
          entityId: eventId,
          operation: 'APPEND_SIGNAL',
          payload: fullSignal,
        });
        syncService.processQueue();
      } catch (err) {
        console.warn('Sync enqueue failed for recordSignal:', err);
      }
    },
    []
  );

  const resetLearnedStyle = useCallback(async () => {
    await styleSignalsRepository.clear();
    setStyleSignals([]);
  }, []);

  const markOutfitWornOnDate = useCallback(
    async (outfit: GeneratedOutfit, dateStr: string, accessory?: WardrobeItem | null) => {
      const allPieces = Object.values(outfit.slots).flat();
      if (accessory) {
        allPieces.push(accessory);
      }
      const now = Date.now();
      const user = syncService.getCurrentUser();
      const userId = user?.id || 'local';
      const newWearEvents: WearEvent[] = [];

      for (const piece of allPieces) {
        const nextTimesWorn = (piece.timesWorn || 0) + 1;
        await updateItem(piece.id, {
          timesWorn: nextTimesWorn,
          lastWorn: now,
        });

        // RULE 5: Wear events are append-only.
        // Use a client-generated stable UUID/event ID.
        const eventId =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `wear-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

        const wearEvent: WearEvent = {
          id: eventId,
          userId,
          wardrobeItemId: piece.id,
          plannedDate: dateStr,
          wornAt: now,
          createdAt: now,
        };

        newWearEvents.push(wearEvent);

        try {
          await wearEventsRepository.addEvent(wearEvent);
          await syncQueue.enqueue({
            entityType: 'wear_event',
            entityId: eventId,
            operation: 'APPEND_WEAR',
            payload: wearEvent,
          });
        } catch (err) {
          console.warn('Failed to record wear event:', err);
        }
      }

      setWearEvents((prev) => [...prev, ...newWearEvents]);

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

      // Record behavioral style signal
      await recordSignal({
        signalType: 'worn',
        itemIds: allPieces.map((p) => p.id),
        occasion: existingPlan?.occasion || 'everyday',
      });

      syncService.processQueue();
    },
    [plans, recordSignal, savePlan, updateItem, updatePlanStatus]
  );

  const saveOutfit = useCallback(async (outfit: GeneratedOutfit, name?: string) => {
    const saved = await wardrobeRepository.saveOutfit(outfit, name);
    setSavedOutfits((prev) => [saved, ...prev]);

    // Record behavioral style signal
    const pieceIds = Object.values(outfit.slots).flat().map((p) => p.id);
    await recordSignal({
      signalType: 'saved',
      outfitId: saved.id,
      itemIds: pieceIds,
    });

    try {
      await syncQueue.enqueue({
        entityType: 'saved_outfit',
        entityId: saved.id,
        operation: 'UPSERT',
        payload: saved,
      });
      syncService.processQueue();
    } catch (err) {
      console.warn('Sync enqueue failed for saveOutfit:', err);
    }
    return saved;
  }, [recordSignal]);

  const deleteSavedOutfit = useCallback(async (id: string) => {
    await wardrobeRepository.deleteSavedOutfit(id);
    setSavedOutfits((prev) => prev.filter((o) => o.id !== id));

    try {
      await syncQueue.enqueue({
        entityType: 'saved_outfit',
        entityId: id,
        operation: 'DELETE',
        payload: { id, deletedAt: Date.now() },
      });
      syncService.processQueue();
    } catch (err) {
      console.warn('Sync enqueue failed for deleteSavedOutfit:', err);
    }
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
      styleSignals,
      styleProfile,
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
      recordSignal,
      resetLearnedStyle,
      refreshData,
    }),
    [
      items,
      loading,
      settings.theme,
      settings.onboarded,
      settings.styleVibes,
      settings.setupCompleted,
      savedOutfits,
      preferences,
      plans,
      styleSignals,
      styleProfile,
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
      recordSignal,
      resetLearnedStyle,
      refreshData,
    ]
  );

  return <WardrobeContext.Provider value={value}>{children}</WardrobeContext.Provider>;
};

export const useWardrobe = (): WardrobeContextValue => {
  const ctx = useContext(WardrobeContext);
  if (!ctx) {
    throw new Error('useWardrobe must be used within a WardrobeProvider');
  }
  return ctx;
};

export const useWardrobeContext = useWardrobe;

