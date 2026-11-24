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
  StyleDNAProfile,
  FabricType,
  SilhouetteFit,
} from '../types';
import { wardrobeRepository } from '../repositories/LocalStorageWardrobeRepository';
import { preferencesRepository, DEFAULT_STYLE_PREFERENCES } from '../repositories/LocalStoragePreferencesRepository';
import { calendarRepository } from '../repositories/LocalStorageCalendarRepository';
import { wearEventsRepository } from '../repositories/LocalStorageWearEventsRepository';
import { styleSignalsRepository } from '../repositories/LocalStorageStyleSignalsRepository';
import { derivePersonalStyleProfile } from '../engine/styleBrain';
import { deriveStyleDNAProfile } from '../engine/styleDNA';
import { validateOutfitWearability } from '../engine/hardConstraints';
import { sampleWardrobe } from '../data/sampleWardrobe';
import { isDemoItem, isDemoOutfit, getDemoWardrobe } from '../services/demoWardrobeService';
import { clearImages, deleteImage } from '../services/imageStore';
import { migrateLegacyPhotos } from '../services/migration';
import { syncQueue } from '../lib/sync/syncQueue';
import { syncService } from '../lib/sync/syncService';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

const SETTINGS_KEY = 'stylesaathi-settings-v1';

interface SettingsData {
  theme: 'light' | 'dark';
  onboarded: boolean;
  styleVibes: string[];
  setupCompleted?: boolean;
}

interface WardrobeContextValue {
  items: WardrobeItem[];
  isDemoMode: boolean;
  enterDemoMode: () => void;
  exitDemoMode: () => void;
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
  styleDNA: StyleDNAProfile;
  correctDNAPreference: (
    dimension: 'color' | 'fabric' | 'pattern' | 'fit' | 'category' | 'styleFamily' | 'occasion' | 'aesthetic',
    key: string,
    targetAffinity: number
  ) => Promise<void>;
  removeDNAPreference: (
    dimension: 'color' | 'fabric' | 'pattern' | 'fit',
    key: string
  ) => Promise<void>;
  confirmDNAPreference: (
    dimension: 'color' | 'fabric' | 'pattern' | 'fit',
    key: string
  ) => Promise<void>;
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
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        return window.sessionStorage?.getItem('stylesaathi_demo_mode') === 'true' ||
               window.localStorage?.getItem('stylesaathi_demo_mode') === 'true';
      } catch {
        return false;
      }
    }
    return false;
  });
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [preferences, setPreferences] = useState<StylePreferences>(DEFAULT_STYLE_PREFERENCES);
  const [plans, setPlans] = useState<OutfitPlan[]>([]);
  const [wearEvents, setWearEvents] = useState<WearEvent[]>([]);
  const [styleSignals, setStyleSignals] = useState<StyleSignalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const enterDemoMode = useCallback(() => {
    setIsDemoMode(true);
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage?.setItem('stylesaathi_demo_mode', 'true');
      }
    } catch {}
    setToast('Switched to Demonstration Mode · Read-Only Capsule');
  }, []);

  const exitDemoMode = useCallback(() => {
    setIsDemoMode(false);
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage?.removeItem('stylesaathi_demo_mode');
        window.localStorage?.removeItem('stylesaathi_demo_mode');
      }
    } catch {}
    setToast('Exited Demonstration Mode · Personal Wardrobe Restored');
  }, []);

  const displayedItems = useMemo(() => {
    if (isDemoMode) {
      return getDemoWardrobe();
    }
    return items;
  }, [isDemoMode, items]);

  const styleProfile = useMemo(() => {
    return derivePersonalStyleProfile(styleSignals, wearEvents, displayedItems, preferences);
  }, [styleSignals, wearEvents, displayedItems, preferences]);

  const styleDNA = useMemo(() => {
    return deriveStyleDNAProfile(styleProfile, displayedItems, wearEvents, preferences, styleSignals);
  }, [styleProfile, displayedItems, wearEvents, preferences, styleSignals]);

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
    const isDark = settings.theme === 'dark';
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // 1. Browser Chrome: Synchronize all theme-color meta tags to prevent stale media-query overrides
    const themeColor = isDark ? '#141312' : '#F7F2E9';
    const metaThemeColors = document.querySelectorAll('meta[name="theme-color"]');
    metaThemeColors.forEach((meta) => {
      meta.setAttribute('content', themeColor);
    });

    // 2. Native Android / Capacitor Status Bar runtime sync without altering native project files
    try {
      if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('StatusBar')) {
        StatusBar.setBackgroundColor({ color: themeColor }).catch(() => {});
        StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light }).catch(() => {});
      }
    } catch {
      // Graceful no-op in browser and test environments
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
    if (isDemoMode || isDemoItem(item)) {
      setToast('Cannot add items in Demonstration Mode');
      return;
    }
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
  }, [isDemoMode]);

  const updateItem = useCallback(async (id: string, patch: Partial<WardrobeItem>) => {
    if (isDemoMode || isDemoItem(id)) {
      setToast('Demonstration items are read-only');
      return;
    }
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
  }, [isDemoMode]);

  const deleteItem = useCallback(
    async (id: string) => {
      if (isDemoMode || isDemoItem(id)) {
        setToast('Demonstration items cannot be deleted');
        return;
      }
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
    [isDemoMode, items]
  );

  const loadSample = useCallback(async () => {
    enterDemoMode();
    setSettings((s) => ({ ...s, onboarded: true }));
  }, [enterDemoMode]);

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
      if (isDemoMode) {
        setToast('Cannot update preferences in Demonstration Mode');
        return;
      }
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
      if (
        isDemoMode ||
        ('outfit' in planData && isDemoOutfit(planData.outfit)) ||
        ('accessory' in planData && planData.accessory && isDemoItem(planData.accessory))
      ) {
        setToast('Cannot schedule outfits in Demonstration Mode');
        return planData as OutfitPlan;
      }
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
      if (
        isDemoMode ||
        ('itemIds' in signalInput && signalInput.itemIds?.some((id) => isDemoItem(id))) ||
        ('outfitId' in signalInput && signalInput.outfitId && isDemoItem(signalInput.outfitId))
      ) {
        return;
      }
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

  const correctDNAPreference = useCallback(
    async (
      dimension: 'color' | 'fabric' | 'pattern' | 'fit' | 'category' | 'styleFamily' | 'occasion' | 'aesthetic',
      key: string,
      targetAffinity: number
    ) => {
      if (isDemoMode) {
        setToast('Cannot alter Style DNA in Demonstration Mode');
        return;
      }
      // 1. If it maps directly to explicit StylePreferences, update preferences
      if (dimension === 'color') {
        const prev = preferences.preferredColors || [];
        const norm = key.toLowerCase();
        let next: string[];
        if (targetAffinity > 0.2) {
          next = prev.includes(norm) ? prev : [...prev, norm];
        } else {
          next = prev.filter((c) => c.toLowerCase() !== norm);
        }
        await updatePreferences({ preferredColors: next });
      } else if (dimension === 'fit') {
        const prev = preferences.preferredFits || [];
        const fitKey = key as SilhouetteFit;
        let next: SilhouetteFit[];
        if (targetAffinity > 0.2) {
          next = prev.includes(fitKey) ? prev : [...prev, fitKey];
        } else {
          next = prev.filter((f) => f !== fitKey);
        }
        await updatePreferences({ preferredFits: next });
      } else if (dimension === 'fabric') {
        const prev = preferences.fabricSensitivities || [];
        const fabKey = key as FabricType;
        let next: FabricType[];
        if (targetAffinity < -0.3) {
          next = prev.includes(fabKey) ? prev : [...prev, fabKey];
        } else {
          next = prev.filter((f) => f !== fabKey);
        }
        await updatePreferences({ fabricSensitivities: next });
      } else if (dimension === 'styleFamily' || dimension === 'aesthetic') {
        const prevPref = preferences.preferredAesthetics || [];
        const prevDis = preferences.dislikedStyles || [];
        if (targetAffinity > 0.2) {
          await updatePreferences({
            preferredAesthetics: prevPref.includes(key) ? prevPref : [...prevPref, key],
            dislikedStyles: prevDis.filter((d) => d.toLowerCase() !== key.toLowerCase()),
          });
        } else if (targetAffinity < -0.2) {
          await updatePreferences({
            preferredAesthetics: prevPref.filter((a) => a.toLowerCase() !== key.toLowerCase()),
            dislikedStyles: prevDis.includes(key) ? prevDis : [...prevDis, key],
          });
        }
      }

      // 2. Persist diagnostic explicit signal
      await recordSignal({
        signalType: targetAffinity > 0 ? 'favorited' : 'rejected',
        itemIds: [],
        rejectionReason: targetAffinity < 0 ? 'not_my_style' : undefined,
        note: `Explicit user calibration for ${dimension}: ${key} (${targetAffinity})`,
      });

      setToast(`Style DNA updated: ${key}`);
    },
    [preferences, updatePreferences, recordSignal]
  );

  const removeDNAPreference = useCallback(
    async (dimension: 'color' | 'fabric' | 'pattern' | 'fit', key: string) => {
      if (isDemoMode) {
        setToast('Cannot alter Style DNA in Demonstration Mode');
        return;
      }
      if (dimension === 'color') {
        const prev = preferences.preferredColors || [];
        const next = prev.filter((c) => c.toLowerCase() !== key.toLowerCase());
        await updatePreferences({ preferredColors: next });
      } else if (dimension === 'fit') {
        const prev = preferences.preferredFits || [];
        const next = prev.filter((f) => f !== key);
        await updatePreferences({ preferredFits: next });
      } else if (dimension === 'fabric') {
        const prev = preferences.fabricSensitivities || [];
        const next = prev.filter((f) => f !== key);
        await updatePreferences({ fabricSensitivities: next });
      }
      setToast(`Removed ${key} from Style DNA`);
    },
    [preferences, updatePreferences]
  );

  const confirmDNAPreference = useCallback(
    async (dimension: 'color' | 'fabric' | 'pattern' | 'fit', key: string) => {
      await correctDNAPreference(dimension, key, 0.85);
      setToast(`Confirmed ${key} in Style DNA`);
    },
    [correctDNAPreference]
  );

  const markOutfitWornOnDate = useCallback(
    async (outfit: GeneratedOutfit, dateStr: string, accessory?: WardrobeItem | null) => {
      if (isDemoMode || isDemoOutfit(outfit) || (accessory && isDemoItem(accessory))) {
        showToast('Cannot record wear events in Demonstration Mode');
        return;
      }
      const allPieces = Object.values(outfit.slots).flat();
      if (accessory) {
        allPieces.push(accessory);
      }

      // 1. LIVE WARDROBE GROUNDING: Verify every piece still exists in the user's active wardrobe
      const missingPieces = allPieces.filter((p) => !items.some((live) => live.id === p.id));
      if (missingPieces.length > 0) {
        const names = missingPieces.map((p) => p.name || 'Unknown item').join(', ');
        const errorMsg = `Cannot log wear: Garment "${names}" no longer exists in your wardrobe.`;
        showToast(errorMsg);
        throw new Error(errorMsg);
      }

      // 2. Map all pieces to their live counterparts in current wardrobe
      const livePieces = allPieces.map((p) => items.find((live) => live.id === p.id)!);

      // 3. LAUNDRY HARD CONSTRAINT: Actual wear logging is strictly blocked for unwashed garments.
      // Planning mode allows styling exploration, but wear confirmation requires clean garments from live state.
      const unwearablePieces = livePieces.filter((p) => p.status !== 'clean');
      if (unwearablePieces.length > 0) {
        const names = unwearablePieces.map((p) => p.name).join(', ');
        const errorMsg = `Cannot log wear: ${names} ${unwearablePieces.length === 1 ? 'needs' : 'need'} washing before wearing.`;
        showToast(errorMsg);
        throw new Error(errorMsg);
      }

      const liveSlots: Record<string, WardrobeItem[]> = {};
      for (const [slotKey, slotItems] of Object.entries(outfit.slots)) {
        liveSlots[slotKey] = slotItems.map((p) => items.find((live) => live.id === p.id)!);
      }
      const liveAccessory = accessory ? items.find((live) => live.id === accessory.id) || null : null;
      const wearCheck = validateOutfitWearability({ ...outfit, slots: liveSlots }, liveAccessory);
      if (!wearCheck.canWear) {
        showToast(wearCheck.error!);
        throw new Error(wearCheck.error);
      }

      const now = Date.now();
      const user = syncService.getCurrentUser();
      const userId = user?.id || 'local';
      const newWearEvents: WearEvent[] = [];

      for (const piece of livePieces) {
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
    if (isDemoMode || isDemoOutfit(outfit)) {
      setToast('Cannot save outfits in Demonstration Mode');
      return null as any;
    }
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
      items: displayedItems,
      isDemoMode,
      enterDemoMode,
      exitDemoMode,
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
      styleDNA,
      correctDNAPreference,
      removeDNAPreference,
      confirmDNAPreference,
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
      displayedItems,
      isDemoMode,
      enterDemoMode,
      exitDemoMode,
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
      styleDNA,
      correctDNAPreference,
      removeDNAPreference,
      confirmDNAPreference,
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

export const useWardrobeSafe = (): WardrobeContextValue | null => {
  return useContext(WardrobeContext);
};

export const useWardrobe = (): WardrobeContextValue => {
  const ctx = useContext(WardrobeContext);
  if (!ctx) {
    throw new Error('useWardrobe must be used within a WardrobeProvider');
  }
  return ctx;
};

export const useWardrobeContext = useWardrobe;

