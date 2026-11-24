import React, { useMemo, useState, useEffect } from 'react';
import {
  Sun,
  CloudSun,
  Sparkles,
  Calendar,
  CheckCircle2,
  Bookmark,
  ArrowRight,
  RefreshCw,
  Plus,
  Shirt,
  Compass,
  Layers,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { useWardrobeContext } from '../context/WardrobeContext';
import { useWeather } from '../context/WeatherContext';
import { useAuth } from '../context/AuthContext';
import { WardrobeItem, GeneratedOutfit, RecommendedOutfit, Occasion, Season } from '../types';
import { recommendOutfits, deriveSeasonalContext } from '../engine';
import { ItemImage } from '../components/common/ItemImage';
import { Button } from '@/components/ui/button';
import { formatRecommendationScore } from '../utils/scoreFormatter';
import { classifyWeatherFreshness } from '../engine/ensemble/shadowEvaluator';
import { generateDailyEditorialHeader } from '../utils/editorialHeadlines';
import { DailyEditorialHero } from '../components/editorial/DailyEditorialHero';
import { AlternativeLooksStrip } from '../components/editorial/AlternativeLooksStrip';
import { StyleThreeWaysModal } from '../components/editorial/StyleThreeWaysModal';
import { DailyDiscoverySection } from '../components/editorial/DailyDiscoverySection';
import { DesignersEditView } from '../components/editorial/DesignersEditView';
import { OutfitFeedbackSheet } from '../components/feedback/OutfitFeedbackSheet';

export { formatRecommendationScore };

interface TodayScreenProps {
  onGoToDress: (anchorItem?: WardrobeItem, occasion?: string) => void;
  onGoToWardrobe: () => void;
  onGoToCalendar: () => void;
  onGoToInsights?: (view?: 'gaps' | 'analytics' | 'trends') => void;
  onOpenAddItem: () => void;
}

const getOutfitItems = (outfit?: GeneratedOutfit | null): WardrobeItem[] => {
  if (!outfit || !outfit.slots) return [];
  return Object.values(outfit.slots).flat();
};

const OCCASION_TABS: { key: Occasion; label: string }[] = [
  { key: 'college', label: 'College' },
  { key: 'office', label: 'Work' },
  { key: 'everyday', label: 'Everyday' },
  { key: 'festive', label: 'Festive' },
  { key: 'party', label: 'Evening' },
];

/**
 * Calibrates user's saved context preferences to Today editorial occasion.
 * Defaults to 'everyday' when preferences are missing or uncalibrated.
 */
const mapContextToOccasion = (ctx?: string): Occasion => {
  if (!ctx) return 'everyday';
  const c = ctx.toLowerCase().trim();
  if (c.includes('college') || c.includes('campus') || c.includes('university') || c.includes('study')) return 'college';
  if (c.includes('work') || c.includes('office') || c.includes('formal') || c.includes('professional')) return 'office';
  if (c.includes('festive') || c.includes('festival') || c.includes('pooja') || c.includes('diwali') || c.includes('wedding') || c.includes('celebration')) return 'festive';
  if (c.includes('party') || c.includes('evening') || c.includes('night') || c.includes('club')) return 'party';
  return 'everyday';
};

export const TodayScreen: React.FC<TodayScreenProps> = ({
  onGoToDress,
  onGoToWardrobe,
  onGoToCalendar,
  onGoToInsights,
  onOpenAddItem,
}) => {
  const {
    items,
    plans,
    savedOutfits,
    preferences,
    styleProfile,
    saveOutfit,
    markOutfitWornOnDate,
    showToast,
  } = useWardrobeContext();

  let weatherContext: ReturnType<typeof useWeather> | null = null;
  try {
    weatherContext = useWeather();
  } catch {
    // Weather provider not active
  }

  let user: { name?: string; email?: string } | null = null;
  try {
    const auth = useAuth();
    user = auth.user;
  } catch {
    // Auth context fallback
  }

  const calibratedDefaultOccasion = useMemo<Occasion>(() => {
    const primary = preferences?.preferredContexts?.[0];
    return mapContextToOccasion(primary);
  }, [preferences?.preferredContexts]);

  const [activeOccasion, setActiveOccasion] = useState<Occasion>(calibratedDefaultOccasion);
  const [hasManuallySwitchedOccasion, setHasManuallySwitchedOccasion] = useState(false);

  // Sync with preferences when they load or update, unless user manually chose another occasion this session
  useEffect(() => {
    if (!hasManuallySwitchedOccasion && calibratedDefaultOccasion) {
      setActiveOccasion(calibratedDefaultOccasion);
    }
  }, [calibratedDefaultOccasion, hasManuallySwitchedOccasion]);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshOffset, setRefreshOffset] = useState(0);
  const [spotlightOutfit, setSpotlightOutfit] = useState<GeneratedOutfit | null>(null);
  const [feedbackOutfit, setFeedbackOutfit] = useState<GeneratedOutfit | null>(null);
  const [styleThreeWaysAnchor, setStyleThreeWaysAnchor] = useState<WardrobeItem | null>(null);

  // Today's formatted date strings
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [today]);

  // Season derivation
  const season = useMemo<Season>(() => {
    return deriveSeasonalContext(today, weatherContext?.weather);
  }, [today, weatherContext?.weather]);

  // Today's scheduled plan if one exists
  const todayPlan = useMemo(() => {
    return plans.find((p) => p.date === todayStr);
  }, [plans, todayStr]);

  // Today's scheduled plan live integrity & revalidation against live wardrobe
  const todayPlanIntegrity = useMemo(() => {
    if (!todayPlan) return null;
    const pieces = getOutfitItems(todayPlan.outfit);
    const missingPieces: string[] = [];
    const laundryPieces: string[] = [];

    for (const p of pieces) {
      if (!p || !p.id) continue;
      const live = items.find((i) => i.id === p.id);
      if (!live) {
        missingPieces.push(p.name || 'Garment');
      } else if (live.status !== 'clean') {
        laundryPieces.push(live.name || 'Garment');
      }
    }

    return {
      pieces,
      isMissing: missingPieces.length > 0,
      missingPieces,
      hasLaundry: laundryPieces.length > 0,
      laundryPieces,
      isWearable: missingPieces.length === 0 && laundryPieces.length === 0,
    };
  }, [todayPlan, items]);

  // Next upcoming plan
  const nextUpcomingPlan = useMemo(() => {
    return plans
      .filter((p) => p.date > todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))[0] || null;
  }, [plans, todayStr]);

  // Clean garments count
  const cleanCount = useMemo(() => {
    return items.filter((i) => i.status === 'clean').length;
  }, [items]);

  // Underused "Forgotten Gem" for mindful wardrobe rotation (clean, worn <= 1 time)
  const forgottenGem = useMemo(() => {
    return items
      .filter((i) => i.status === 'clean' && (i.timesWorn || 0) <= 1)
      .sort((a, b) => (a.timesWorn || 0) - (b.timesWorn || 0))[0] || null;
  }, [items]);

  // Context snapshot for recommendations
  const contextSnapshot = useMemo(() => {
    if (weatherContext) {
      return weatherContext.getContextForOccasion(activeOccasion);
    }
    return undefined;
  }, [weatherContext, activeOccasion]);

  // Canonical 5-state weather freshness evaluation
  const weatherFreshness = useMemo(() => {
    return classifyWeatherFreshness(contextSnapshot);
  }, [contextSnapshot]);

  // Editorial masthead memo & headline generator
  const editorialHeader = useMemo(() => {
    return generateDailyEditorialHeader({
      date: today,
      weather: weatherContext?.weather,
      weatherFreshness,
      city: weatherContext?.location?.city,
      todayPlan,
      activeOccasion,
      cleanCount,
      userName: user?.name || null,
      season,
    });
  }, [
    today,
    weatherContext?.weather,
    weatherFreshness,
    weatherContext?.location?.city,
    todayPlan,
    activeOccasion,
    cleanCount,
    user?.name,
    season,
  ]);

  // Recent wear lookback (prevent repetitive suggestions within 3 days)
  const recentWornItemIds = useMemo(() => {
    const threeDaysAgo = Date.now() - 3 * 24 * 3600 * 1000;
    return items
      .filter((i) => i.lastWorn && i.lastWorn > threeDaysAgo)
      .map((i) => i.id);
  }, [items]);

  // Calendar lookahead: garments scheduled for tomorrow
  const plannedTomorrowItemIds = useMemo(() => {
    const tmrw = new Date(today);
    tmrw.setDate(tmrw.getDate() + 1);
    const tmrwStr = `${tmrw.getFullYear()}-${String(tmrw.getMonth() + 1).padStart(2, '0')}-${String(tmrw.getDate()).padStart(2, '0')}`;
    const tmrwPlan = plans.find((p) => p.date === tmrwStr);
    if (!tmrwPlan) return [];
    return Object.values(tmrwPlan.outfit.slots || {}).flat().map((i: any) => i.id);
  }, [today, plans]);

  // Daily suggestions generated by recommendation engine
  const dailySuggestions = useMemo(() => {
    if (items.length < 2) return [];
    try {
      return recommendOutfits({
        items,
        occasion: activeOccasion,
        season,
        localDate: todayStr,
        explorationSeedOffset: refreshOffset,
        preferences,
        styleProfile,
        context: contextSnapshot,
        limit: 4,
        allowPlanningMode: false,
        recentWornItemIds,
        plannedTomorrowItemIds,
      });
    } catch {
      return [];
    }
  }, [
    items,
    activeOccasion,
    season,
    todayStr,
    refreshOffset,
    preferences,
    styleProfile,
    contextSnapshot,
    recentWornItemIds,
    plannedTomorrowItemIds,
  ]);

  // Active Hero look: use spotlight selection if valid, fallback to first recommendation
  const heroOutfit = useMemo<RecommendedOutfit | GeneratedOutfit | null>(() => {
    if (spotlightOutfit) return spotlightOutfit;
    return dailySuggestions[0] || null;
  }, [spotlightOutfit, dailySuggestions]);

  // Alternative looks: all suggestions other than the current Hero look
  const alternativeOutfits = useMemo(() => {
    if (!heroOutfit) return [];
    return dailySuggestions.filter(
      (outfit) => (outfit.id || outfit.template) !== (heroOutfit.id || heroOutfit.template)
    );
  }, [dailySuggestions, heroOutfit]);

  const handleRefreshSuggestions = () => {
    setIsRefreshing(true);
    setSpotlightOutfit(null);
    setRefreshOffset((prev) => prev + 1);
    setTimeout(() => setIsRefreshing(false), 300);
  };

  const handleMarkWorn = async (outfit: GeneratedOutfit) => {
    try {
      await markOutfitWornOnDate(outfit, todayStr);
      showToast('Logged as worn today · Wardrobe rotation updated');
    } catch (e: any) {
      showToast(e?.message || 'Failed to record wear event');
    }
  };

  const handleSaveLook = async (outfit: GeneratedOutfit) => {
    try {
      await saveOutfit(outfit);
      showToast('Outfit archived to your Saved Looks');
    } catch (e: any) {
      showToast(e?.message || 'Failed to save outfit');
    }
  };

  return (
    <div className="pb-36 sm:pb-32 md:pb-12 animate-fade-in max-w-7xl mx-auto space-y-7 sm:space-y-9 w-full overflow-x-clip">
      {/* 1. EDITORIAL MASTHEAD & CONTEXT */}
      <header className="border-b border-border/80 pb-5 sm:pb-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="editorial-kicker text-(--kumkum) tracking-[0.22em]">
                {editorialHeader.kicker}
              </span>
              <span className="text-[10px] font-sans font-semibold text-(--burnished-gold) uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-(--burnished-gold)/10 border border-(--burnished-gold)/20">
                {editorialHeader.indianDayName}
              </span>
            </div>

            <div className="mt-1">
              <span className="font-serif text-lg sm:text-xl text-(--kumkum) font-normal italic">
                {editorialHeader.greeting}
              </span>
            </div>

            <h1 className="mt-0.5 editorial-hero text-3xl sm:text-4xl md:text-5xl text-(--ink) font-normal tracking-tight">
              {editorialHeader.headline}
            </h1>

            <p className="mt-1 text-xs sm:text-sm text-muted font-sans font-medium">
              {editorialHeader.formattedDate} · <span className="font-serif italic text-(--kumkum)">Aaj kya pehenna hai?</span>
            </p>
          </div>

          {/* Quick Stats Capsule */}
          <div className="flex items-center gap-2 text-xs font-sans text-muted">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-card border border-border shadow-2xs">
              <Shirt className="h-3.5 w-3.5 text-(--kumkum)" />
              <span className="font-semibold text-(--ink)">{cleanCount}</span>
              <span>ready in closet</span>
            </div>
            {savedOutfits.length > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-card border border-border shadow-2xs">
                <Bookmark className="h-3.5 w-3.5 text-(--burnished-gold)" />
                <span className="font-semibold text-(--ink)">{savedOutfits.length}</span>
                <span>saved</span>
              </div>
            )}
          </div>
        </div>

        {/* 2. REAL WEATHER CONTEXT & THERMAL ADVICE */}
        <div className="rounded-2xl glass-card specular-border p-4 border border-border/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-(--paper)/90">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-(--ivory) border border-border/80 text-(--burnished-gold) shadow-2xs">
              {weatherContext?.weather ? <Sun className="h-5 w-5" /> : <CloudSun className="h-5 w-5 text-muted" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-(--ink)">
                  {editorialHeader.weatherBadge}
                </span>
                {editorialHeader.weatherFreshnessLabel && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300 border border-stone-200 dark:border-stone-700">
                    {editorialHeader.weatherFreshnessLabel}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted font-sans mt-0.5 leading-relaxed">
                {editorialHeader.thermalAdvice}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onGoToDress()}
              className="min-h-11 px-4 rounded-full text-xs font-semibold gap-1.5 hover:border-(--kumkum) hover:text-(--kumkum) active:scale-95"
            >
              <Sparkles className="h-3.5 w-3.5 text-(--kumkum)" />
              <span>Open Atelier</span>
            </Button>
          </div>
        </div>
      </header>

      {/* 2.5 STYLIST ACTION COMPASS: "How Can StyleSaathi Help Me Today?" */}
      <section aria-label="Stylist Actions" className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('open-saathi-chat'))}
          className="p-3.5 rounded-2xl border border-border/80 bg-card/70 hover:bg-(--ivory) flex flex-col justify-between text-left transition-all specular-border couture-press group shadow-2xs cursor-pointer min-h-20"
        >
          <div className="flex items-center justify-between w-full">
            <span className="h-7 w-7 rounded-full bg-(--burnished-gold)/15 flex items-center justify-center text-(--burnished-gold)">
              <Sparkles className="h-3.5 w-3.5 animate-pulse" />
            </span>
            <ArrowRight className="h-3 w-3 text-muted group-hover:text-(--ink) transition-colors" />
          </div>
          <div>
            <span className="font-serif text-xs sm:text-sm font-semibold text-(--ink) block">Ask AI Stylist</span>
            <span className="text-[10px] text-muted font-sans block truncate">Personal style advice</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onGoToDress()}
          className="p-3.5 rounded-2xl border border-border/80 bg-card/70 hover:bg-(--ivory) flex flex-col justify-between text-left transition-all specular-border couture-press group shadow-2xs cursor-pointer min-h-20"
        >
          <div className="flex items-center justify-between w-full">
            <span className="h-7 w-7 rounded-full bg-(--kumkum)/15 flex items-center justify-center text-(--kumkum)">
              <Layers className="h-3.5 w-3.5" />
            </span>
            <ArrowRight className="h-3 w-3 text-muted group-hover:text-(--ink) transition-colors" />
          </div>
          <div>
            <span className="font-serif text-xs sm:text-sm font-semibold text-(--ink) block">Open Atelier</span>
            <span className="text-[10px] text-muted font-sans block truncate">Mix &amp; compose looks</span>
          </div>
        </button>

        <button
          type="button"
          onClick={onGoToWardrobe}
          className="p-3.5 rounded-2xl border border-border/80 bg-card/70 hover:bg-(--ivory) flex flex-col justify-between text-left transition-all specular-border couture-press group shadow-2xs cursor-pointer min-h-20"
        >
          <div className="flex items-center justify-between w-full">
            <span className="h-7 w-7 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
              <Shirt className="h-3.5 w-3.5" />
            </span>
            <ArrowRight className="h-3 w-3 text-muted group-hover:text-(--ink) transition-colors" />
          </div>
          <div>
            <span className="font-serif text-xs sm:text-sm font-semibold text-(--ink) block">My Wardrobe</span>
            <span className="text-[10px] text-muted font-sans block truncate">{items.length} catalogued pieces</span>
          </div>
        </button>

        <button
          type="button"
          onClick={onGoToCalendar}
          className="p-3.5 rounded-2xl border border-border/80 bg-card/70 hover:bg-(--ivory) flex flex-col justify-between text-left transition-all specular-border couture-press group shadow-2xs cursor-pointer min-h-20"
        >
          <div className="flex items-center justify-between w-full">
            <span className="h-7 w-7 rounded-full bg-blue-500/15 flex items-center justify-center text-blue-700 dark:text-blue-400">
              <Calendar className="h-3.5 w-3.5" />
            </span>
            <ArrowRight className="h-3 w-3 text-muted group-hover:text-(--ink) transition-colors" />
          </div>
          <div>
            <span className="font-serif text-xs sm:text-sm font-semibold text-(--ink) block">Style Calendar</span>
            <span className="text-[10px] text-muted font-sans block truncate">Plan ahead</span>
          </div>
        </button>
      </section>

      {/* 3. TODAY'S SCHEDULED LOOK (IF PLANNED) */}
      {todayPlan && (
        <section aria-label="Today's Scheduled Look" className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-(--kumkum)" />
              <h2 className="editorial-title text-xl text-(--ink) font-normal">
                Scheduled For Today
              </h2>
            </div>
            <button
              type="button"
              onClick={onGoToCalendar}
              className="inline-flex items-center gap-1 text-xs font-semibold text-(--burnished-gold) hover:underline cursor-pointer"
            >
              <span>View Calendar</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="rounded-3xl glass-card specular-border border border-border p-5 sm:p-6 shadow-sm bg-(--paper)/90">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-(--kumkum)/10 text-(--kumkum) border border-(--kumkum)/20">
                    {todayPlan.occasion || 'Day Look'}
                  </span>
                  {todayPlan.status === 'worn' ? (
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Worn Today</span>
                    </span>
                  ) : (
                    <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                      Planned
                    </span>
                  )}
                </div>

                <h3 className="font-serif text-2xl text-(--ink) font-normal">
                  {todayPlan.outfit.template || `${todayPlan.occasion} Outfit`}
                </h3>
                {todayPlan.outfit.why && (
                  <p className="text-xs text-muted font-sans italic">
                    "{todayPlan.outfit.why}"
                  </p>
                )}

                {todayPlanIntegrity?.isMissing && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[11px] font-medium text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-600" />
                    <span>Wardrobe integrity notice: {todayPlanIntegrity.missingPieces.join(', ')} is no longer in your closet.</span>
                  </div>
                )}
                {todayPlanIntegrity?.hasLaundry && !todayPlanIntegrity.isMissing && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                    <span>Laundry notice: {todayPlanIntegrity.laundryPieces.join(', ')} needs washing before wearing.</span>
                  </div>
                )}
              </div>

              {/* Garment Photography Grid */}
              <div className="flex items-center gap-2.5 overflow-x-auto py-1 no-scrollbar">
                {getOutfitItems(todayPlan.outfit).map((item) => (
                  <div
                    key={item.id}
                    className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl border border-border bg-(--card) shadow-2xs"
                  >
                    <ItemImage item={item} className="h-full w-full object-cover" />
                    <span className="absolute bottom-1 left-1 right-1 truncate rounded-sm bg-black/60 px-1 py-0.5 text-[8.5px] font-medium text-white backdrop-blur-xs">
                      {item.name}
                    </span>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                {todayPlan.status !== 'worn' && (
                  <Button
                    variant="default"
                    size="sm"
                    disabled={!todayPlanIntegrity?.isWearable}
                    onClick={() => handleMarkWorn(todayPlan.outfit)}
                    className="min-h-11 px-4 rounded-full gap-1.5 font-bold text-xs uppercase tracking-wider bg-accent text-white shadow-xs tactile-press disabled:opacity-50 disabled:cursor-not-allowed"
                    title={
                      todayPlanIntegrity?.isMissing
                        ? 'Cannot log wear: garment removed from closet'
                        : todayPlanIntegrity?.hasLaundry
                        ? 'Cannot log wear: pieces need washing'
                        : undefined
                    }
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Log as Worn</span>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onGoToDress(getOutfitItems(todayPlan.outfit)[0], todayPlan.occasion)}
                  className="min-h-11 px-4 rounded-full text-xs font-semibold"
                >
                  <span>Edit in Atelier</span>
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 4. OCCASION SWITCHER & CURATION CONTROL */}
      <section aria-label="Curated Recommendations" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-(--kumkum)" />
              <h2 className="editorial-title text-xl sm:text-2xl text-(--ink) font-normal">
                Curated For Your Day
              </h2>
            </div>
            <p className="text-xs text-muted font-sans mt-0.5">
              Balanced on color theory, silhouette proportions, and living microclimate.
            </p>
          </div>

          {/* Occasion Tabs & Shuffle */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {preferences?.preferredContexts?.[0] && (
              <span className="text-[10px] font-sans font-semibold text-muted uppercase tracking-wider hidden lg:inline mr-1">
                Saved: {preferences.preferredContexts[0]}
              </span>
            )}
            <div className="flex items-center rounded-full border border-border/80 bg-card/70 p-1 text-xs font-semibold overflow-x-auto">
              {OCCASION_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setActiveOccasion(tab.key);
                    setHasManuallySwitchedOccasion(true);
                    setSpotlightOutfit(null);
                  }}
                  className={`capitalize min-h-11 px-4 py-2 rounded-full transition-all text-xs cursor-pointer select-none active:scale-95 tactile-press inline-flex items-center justify-center ${
                    activeOccasion === tab.key
                      ? 'bg-(--ink) text-(--paper) shadow-2xs font-bold'
                      : 'text-muted hover:text-(--ink)'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleRefreshSuggestions}
              disabled={isRefreshing}
              className="flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-full border border-border text-muted hover:text-(--ink) hover:border-(--ink) active:scale-95 transition-all cursor-pointer"
              aria-label="Shuffle daily suggestions"
              title="Shuffle suggestions"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-(--kumkum)' : ''}`} />
            </button>
          </div>
        </div>

        {/* 5. DAILY EDITORIAL HERO LOOK */}
        {heroOutfit ? (
          <div className="space-y-6">
            <DailyEditorialHero
              outfit={heroOutfit}
              occasion={activeOccasion}
              onMarkWorn={handleMarkWorn}
              onSaveLook={handleSaveLook}
              onOpenInAtelier={onGoToDress}
              onOpenFeedback={(outfit) => setFeedbackOutfit(outfit)}
              onStyleThreeWays={(item) => setStyleThreeWaysAnchor(item)}
              onExploreAlternatives={() => {
                const el = document.getElementById('alternative-looks');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              onAskSaathi={(prompt) => {
                window.dispatchEvent(new CustomEvent('open-saathi-chat', { detail: { prompt } }));
              }}
              isPlannedToday={Boolean(todayPlan)}
            />

            {/* 6. ALTERNATIVE LOOKS STRIP */}
            {alternativeOutfits.length > 0 && (
              <AlternativeLooksStrip
                outfits={alternativeOutfits}
                activeOccasion={activeOccasion}
                onSelectHero={(outfit) => setSpotlightOutfit(outfit as GeneratedOutfit)}
                onMarkWorn={handleMarkWorn}
                onSaveLook={handleSaveLook}
                onOpenInAtelier={onGoToDress}
                onOpenFeedback={(outfit) => setFeedbackOutfit(outfit)}
                onStyleThreeWays={(item) => setStyleThreeWaysAnchor(item)}
              />
            )}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border/90 p-8 text-center space-y-3 bg-(--paper)/60">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-(--ivory) border border-border text-(--burnished-gold)">
              <Shirt className="h-6 w-6" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="font-serif text-lg sm:text-xl text-(--ink) font-normal">
                Your Wardrobe Canvas is Empty
              </h3>
              <p className="text-xs text-muted font-sans leading-relaxed">
                Add your first top and bottom or an ethnic one-piece to unlock tailored daily style recommendations.
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={onOpenAddItem}
                className="min-h-11 px-5 rounded-full text-xs font-bold uppercase tracking-wider bg-accent text-white active:scale-95 tactile-press"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                <span>Add First Garment</span>
              </Button>
            </div>
          </div>
        ) : cleanCount === 0 ? (
          <div className="rounded-3xl border border-dashed border-amber-500/40 p-8 text-center space-y-3 bg-(--paper)/60">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">
              <Shirt className="h-6 w-6" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="font-serif text-lg sm:text-xl text-(--ink) font-normal">
                Wardrobe in Laundry
              </h3>
              <p className="text-xs text-muted font-sans leading-relaxed">
                All garments in your closet are currently marked as needing wash. Wash a load to refresh your clean rotation, or open the Atelier in planning mode.
              </p>
            </div>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
              <Button
                variant="default"
                size="sm"
                onClick={onGoToWardrobe}
                className="min-h-11 px-5 rounded-full text-xs font-bold uppercase tracking-wider bg-accent text-white active:scale-95 tactile-press"
              >
                <span>Check Laundry in Closet</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onGoToDress(undefined, activeOccasion)}
                className="min-h-11 px-4 rounded-full text-xs font-semibold text-muted hover:text-(--ink) active:scale-95 tactile-press"
              >
                <span>Open Atelier (Planning Mode)</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-border/90 p-8 text-center space-y-3 bg-(--paper)/60">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-(--ivory) border border-border text-(--burnished-gold)">
              <Shirt className="h-6 w-6" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="font-serif text-lg sm:text-xl text-(--ink) font-normal">
                Complementary Pieces Needed
              </h3>
              <p className="text-xs text-muted font-sans leading-relaxed">
                You have {cleanCount} clean pieces ready, but need complementary items (such as bottoms or an ethnic one-piece) to form a complete {activeOccasion} ensemble.
              </p>
            </div>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
              <Button
                variant="default"
                size="sm"
                onClick={onOpenAddItem}
                className="min-h-11 px-5 rounded-full text-xs font-bold uppercase tracking-wider bg-accent text-white active:scale-95 tactile-press"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                <span>Add Complementary Piece</span>
              </Button>
              {activeOccasion !== 'everyday' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveOccasion('everyday')}
                  className="min-h-11 px-4 rounded-full text-xs font-semibold text-muted hover:text-(--ink) active:scale-95 tactile-press"
                >
                  <span>Try Everyday Occasion</span>
                </Button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 7. DAILY DISCOVERY: UNDERUSED PIECE, STYLIST'S WISDOM, CALENDAR PREPARATION */}
      <DailyDiscoverySection
        underusedItem={forgottenGem}
        upcomingPlan={nextUpcomingPlan}
        activeOccasion={activeOccasion}
        onStyleThreeWays={(item) => setStyleThreeWaysAnchor(item)}
        onOpenInAtelier={onGoToDress}
        onGoToCalendar={onGoToCalendar}
        onGoToWardrobe={onGoToWardrobe}
        onGoToTrends={onGoToInsights ? () => onGoToInsights('trends') : undefined}
      />

      {/* 8. THE DESIGNER'S EDIT & LIVING CRAFT PHILOSOPHIES */}
      <DesignersEditView onAskSaathi={() => onGoToDress()} />

      {/* 9. FOOTER ACTIONS */}
      <footer className="pt-4 border-t border-border/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenAddItem}
            className="min-h-11 px-4 rounded-full text-xs font-semibold gap-1.5"
          >
            <Plus className="h-3.5 w-3.5 text-(--kumkum)" />
            <span>Add Garment</span>
          </Button>

          {onGoToInsights && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onGoToInsights()}
                className="min-h-11 px-4 rounded-full text-xs font-semibold gap-1.5 text-muted hover:text-(--ink)"
              >
                <Compass className="h-3.5 w-3.5" />
                <span>Wardrobe Insights</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onGoToInsights('trends')}
                className="min-h-11 px-4 rounded-full text-xs font-semibold gap-1.5 text-(--burnished-gold) hover:text-(--ink)"
              >
                <Sparkles className="h-3.5 w-3.5 text-(--burnished-gold)" />
                <span>Trend Discovery</span>
              </Button>
            </>
          )}
        </div>

        <p className="text-[11px] text-muted font-sans">
          StyleSaathi 4.0 Personal Fashion Intelligence · 100% Local-first
        </p>
      </footer>

      {/* 10. STYLE THIS GARMENT THREE WAYS MODAL */}
      {styleThreeWaysAnchor && (
        <StyleThreeWaysModal
          anchorItem={styleThreeWaysAnchor}
          isOpen={Boolean(styleThreeWaysAnchor)}
          onClose={() => setStyleThreeWaysAnchor(null)}
          onMarkWorn={handleMarkWorn}
          onSaveLook={handleSaveLook}
          onOpenInAtelier={onGoToDress}
        />
      )}

      {/* 11. REAL-TIME OUTFIT FEEDBACK SHEET */}
      {feedbackOutfit && (
        <OutfitFeedbackSheet
          isOpen={Boolean(feedbackOutfit)}
          onClose={() => setFeedbackOutfit(null)}
          outfit={feedbackOutfit}
          occasion={activeOccasion}
          onFeedbackApplied={() => showToast('Feedback recorded · Style Brain updated')}
          onFeedbackUndone={() => showToast('Feedback undone')}
        />
      )}
    </div>
  );
};
