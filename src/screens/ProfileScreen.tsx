import React, { useState } from 'react';
import {
  Sun,
  Moon,
  Shield,
  RotateCcw,
  Trash2,
  Sparkles,
  User as UserIcon,
  LogOut,
  Check,
  Cloud,
  RefreshCw,
  WifiOff,
  Bookmark,
} from 'lucide-react';
import { useWardrobeContext } from '../context/WardrobeContext';
import { useAuth } from '../context/AuthContext';
import { AuthView } from '../components/auth/AuthView';
import { StylingMode, GeneratedOutfit } from '../types';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { syncService } from '../lib/sync/syncService';
import { Button } from '@/components/ui/button';
import { SavedOutfitsModal } from '../components/dressme/SavedOutfitsModal';
import { PlanLookModal } from '../components/calendar/PlanLookModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const CONTEXT_OPTIONS = [
  'College',
  'Work',
  'Everyday',
  'Family gatherings',
  'Festive occasions',
  'Weddings',
  'Mixed',
];

const AESTHETIC_OPTIONS = [
  { id: 'Minimal', label: 'Minimal', desc: 'Clean silhouettes & understated palette' },
  { id: 'Classic', label: 'Classic', desc: 'Timeless tailored pieces & structured polish' },
  { id: 'Contemporary', label: 'Contemporary', desc: 'Modern cuts, crisp shapes & modern ease' },
  { id: 'Traditional', label: 'Traditional', desc: 'Heritage Indian weaves, rich crafts & ethnic grace' },
  { id: 'Indo-Western', label: 'Indo-Western', desc: 'Effortless fusion of kurtis, denim & overlays' },
  { id: 'Relaxed', label: 'Relaxed', desc: 'Breathable comfort, soft drapes & fluid fits' },
  { id: 'Statement', label: 'Statement', desc: 'Vibrant hues, bold accents & artistic drama' },
];

const STYLING_MODES: { id: StylingMode; title: string; desc: string }[] = [
  { id: 'simple', title: 'Keep it simple', desc: 'Reliable, low-effort pairings you can trust daily' },
  { id: 'variety', title: 'Give me variety', desc: 'Balanced rotation to maximize everything you own' },
  { id: 'experiment', title: 'Help me experiment', desc: 'Creative, fresh combinations outside your usual picks' },
];

const INTERNATIONAL_INSPIRATIONS: {
  id: 'korean_contemporary_streetwear' | 'japanese_relaxed_workwear' | 'european_tailored_smart';
  title: string;
  desc: string;
}[] = [
  {
    id: 'korean_contemporary_streetwear',
    title: 'South Korean Streetwear',
    desc: 'Oversized layering, neat cuffs & street-smart ease',
  },
  {
    id: 'japanese_relaxed_workwear',
    title: 'Japanese Minimalism & Workwear',
    desc: 'Artisanal textures, relaxed tailoring & natural khadi resonance',
  },
  {
    id: 'european_tailored_smart',
    title: 'European Tailored Smart',
    desc: 'Sharp lines, architectural structure & clean formal drape',
  },
];

const AGE_BAND_CHOICES: {
  id: 'adult_18_plus' | 'teen_14_17';
  label: string;
  desc: string;
}[] = [
  { id: 'adult_18_plus', label: 'Adult (18+)', desc: 'Standard adult styling & full occasion flexibility' },
  { id: 'teen_14_17', label: 'Teen (14–17)', desc: 'Age-appropriate safeguards & campus-compliant dress codes' },
];

const PRESENTATION_CHOICES: {
  id: 'all' | 'masculine' | 'feminine' | 'androgynous';
  label: string;
}[] = [
  { id: 'all', label: 'All / Fluid' },
  { id: 'feminine', label: 'Womenswear' },
  { id: 'masculine', label: 'Menswear' },
  { id: 'androgynous', label: 'Androgynous' },
];

export const ProfileScreen: React.FC = () => {
  const {
    items,
    savedOutfits,
    theme,
    toggleTheme,
    preferences,
    updatePreferences,
    styleProfile,
    resetLearnedStyle,
    loadSample,
    resetWardrobe,
    resetAll,
    showToast,
  } = useWardrobeContext();

  const { user, isGuest, isAuthenticated, signOut, deleteAccount } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [planningOutfit, setPlanningOutfit] = useState<GeneratedOutfit | null>(null);
  const [alertAction, setAlertAction] = useState<'clear' | 'reset' | 'reset_style' | 'delete_account' | null>(null);
  const { statusLabel, isOnline, status: syncStatus, pendingCount } = useSyncStatus();

  // Metrics
  const totalPieces = items.length;
  const favoritesCount = items.filter((i) => i.favorite).length;
  const totalWears = items.reduce((acc, i) => acc + (i.timesWorn || 0), 0);

  const handleToggleContext = async (ctx: string) => {
    const prev = preferences.preferredContexts || [];
    const next = prev.includes(ctx) ? prev.filter((c) => c !== ctx) : [...prev, ctx];
    await updatePreferences({ preferredContexts: next.length > 0 ? next : ['Everyday'] });
    showToast('Context preferences updated');
  };

  const handleToggleAesthetic = async (aes: string) => {
    const prev = preferences.preferredAesthetics || [];
    const next = prev.includes(aes) ? prev.filter((a) => a !== aes) : [...prev, aes];
    await updatePreferences({ preferredAesthetics: next.length > 0 ? next : ['Contemporary'] });
    showToast('Aesthetic preferences updated');
  };

  const handleChangeMode = async (mode: StylingMode) => {
    await updatePreferences({ stylingMode: mode });
    showToast(`Styling mode: ${mode}`);
  };

  const handleToggleInternationalInspiration = async (
    id: 'korean_contemporary_streetwear' | 'japanese_relaxed_workwear' | 'european_tailored_smart',
  ) => {
    const prev = preferences.internationalInspirations || [];
    const next = prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id];
    await updatePreferences({ internationalInspirations: next });
    showToast('Style inspirations updated');
  };

  const handleSetAgeBand = async (ageBand: 'adult_18_plus' | 'teen_14_17') => {
    await updatePreferences({ ageBand });
    showToast(ageBand === 'teen_14_17' ? 'Teen safety active (Ages 14–17)' : 'Age profile updated');
  };

  const handleSetPresentation = async (presentationPreference: 'all' | 'masculine' | 'feminine' | 'androgynous') => {
    await updatePreferences({ presentationPreference });
    showToast('Presentation preference updated');
  };

  const handleConfirmAction = async () => {
    if (alertAction === 'clear') {
      await resetWardrobe();
      showToast('Wardrobe cleared');
    } else if (alertAction === 'reset') {
      await resetAll();
      showToast('All data reset');
    } else if (alertAction === 'reset_style') {
      await resetLearnedStyle();
      showToast('Learned style memory reset');
    } else if (alertAction === 'delete_account') {
      try {
        await deleteAccount();
        showToast('Your account and all associated data have been permanently erased.');
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to delete account. Please try again.';
        showToast(errorMsg);
      }
    }
    setAlertAction(null);
  };

  return (
    <div className="pb-28 sm:pb-24 md:pb-8 animate-fade-in space-y-4">
      {/* Compact Editorial Header: "YOU · Personal Archive" */}
      <header className="flex items-center justify-between border-b border-border/80 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="editorial-kicker text-(--kumkum)">
              YOU
            </span>
          </div>
          <h1 className="mt-0.5 editorial-hero text-2xl sm:text-3xl font-normal text-(--ink) tracking-tight">
            Style &amp; Archive
          </h1>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted font-medium mt-1">
            <span>{totalPieces} pieces</span>
            <span>·</span>
            <span>{favoritesCount} favorites</span>
            <span>·</span>
            <button
              type="button"
              onClick={() => setShowSavedModal(true)}
              className="inline-flex items-center gap-1 text-(--burnished-gold) font-semibold hover:underline cursor-pointer"
            >
              <Bookmark className="h-3 w-3" />
              <span>{savedOutfits.length} saved looks</span>
            </button>
            <span>·</span>
            <span>{totalWears} wears</span>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          className="md:hidden flex h-9 w-9 min-h-11 min-w-11 items-center justify-center rounded-full border border-border text-muted transition-colors hover:border-(--ink) hover:text-(--ink) active:scale-95 tactile-press"
          aria-label="Toggle theme"
        >
          {theme === 'light' ? '☾' : '☼'}
        </button>
      </header>

      {/* Account Profile Status Banner */}
      <section className="rounded-3xl glass-card specular-border p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-(--ivory) border border-border text-(--ink) font-serif font-bold text-base shadow-2xs">
              {user?.name ? user.name[0].toUpperCase() : user?.email ? user.email[0].toUpperCase() : <UserIcon className="h-5 w-5 text-(--burnished-gold)" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="editorial-kicker text-(--kumkum)">
                  {isAuthenticated ? 'STYLESAATHI MEMBER' : 'GUEST SESSION'}
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-(--burnished-gold)" />
                <span className="text-[10px] text-muted">Local-first</span>
              </div>
              <h2 className="text-base font-semibold text-(--ink)">
                {user?.name || user?.email || 'Guest Stylist'}
              </h2>
              {user?.email && user?.name && (
                <p className="text-xs text-muted">{user.email}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {isGuest && (
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowAuthModal(true)}
                className="min-h-11 shadow-2xs font-semibold uppercase tracking-wider tactile-press"
              >
                <span>Create Profile</span>
              </Button>
            )}
            {isAuthenticated && (
              <Button
                variant="outline"
                size="sm"
                onClick={signOut}
                className="min-h-11 gap-1.5 font-medium text-muted hover:text-(--ink) tactile-press"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </Button>
            )}
          </div>
        </div>

        {/* Sync Status Bar */}
        <div className="mt-4 pt-3 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <div className="flex items-center gap-2">
            {!isOnline ? (
              <WifiOff className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            ) : syncStatus === 'syncing' ? (
              <RefreshCw className="h-3.5 w-3.5 text-(--burnished-gold) animate-spin shrink-0" />
            ) : (
              <Cloud className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            )}
            <span className="text-[11px] font-medium">{statusLabel}</span>
          </div>

          {isAuthenticated && (pendingCount > 0 || !isOnline) && (
            <button
              type="button"
              onClick={() => syncService.processQueue()}
              disabled={syncStatus === 'syncing'}
              className="text-[10px] font-bold uppercase tracking-wider text-(--burnished-gold) hover:underline flex items-center gap-1 min-h-8"
            >
              <span>Sync now</span>
            </button>
          )}
        </div>
      </section>

      {/* Main Profile Grid: Style DNA & Archive Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 items-start">
        {/* Left Column: Style DNA & Styling Mode */}
        <div className="space-y-4">
          {/* Aesthetic & Context Preferences */}
          <section className="rounded-3xl glass-card specular-border p-5 sm:p-6 shadow-2xs space-y-4">
            <div className="flex items-baseline justify-between border-b border-border pb-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
                STYLE PREFERENCES
              </span>
              <span className="text-[11px] text-muted">Personalized DNA</span>
            </div>

            {/* Contexts */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-2">
                I Usually Dress For
              </label>
              <div className="flex flex-wrap gap-1.5">
                {CONTEXT_OPTIONS.map((ctx) => {
                  const isSelected = preferences.preferredContexts?.includes(ctx);
                  return (
                    <button
                      key={ctx}
                      type="button"
                      onClick={() => handleToggleContext(ctx)}
                      className={`min-h-11 rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-[transform,background-color,border-color,color,box-shadow] duration-150 ease-out select-none active:scale-[0.97] focus-editorial ${
                        isSelected
                          ? 'border border-(--ink) bg-(--ink) text-(--paper) shadow-2xs'
                          : 'border border-border bg-card text-muted hover:border-(--ink)'
                      }`}
                    >
                      {ctx}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Aesthetics */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-2">
                Aesthetics That Feel Most Like You
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {AESTHETIC_OPTIONS.map((aes) => {
                  const isSelected = preferences.preferredAesthetics?.includes(aes.id);
                  return (
                    <button
                      key={aes.id}
                      type="button"
                      onClick={() => handleToggleAesthetic(aes.id)}
                      className={`flex flex-col text-left p-2.5 rounded-xl border transition-all active:scale-98 ${
                        isSelected
                          ? 'border-(--kumkum) bg-(--ivory) shadow-2xs'
                          : 'border-border bg-card hover:border-(--ink)'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-serif font-semibold text-(--ink)">
                          {aes.label}
                        </span>
                        {isSelected && <Check className="h-3.5 w-3.5 text-(--kumkum)" />}
                      </div>
                      <span className="text-[10px] text-muted line-clamp-1 mt-0.5">
                        {aes.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Styling Mode */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-2">
                How Should StyleSaathi Style You?
              </label>
              <div className="grid grid-cols-1 gap-2">
                {STYLING_MODES.map((mode) => {
                  const isSelected = preferences.stylingMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => handleChangeMode(mode.id)}
                      className={`flex items-start justify-between p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-(--burnished-gold) bg-(--ivory) shadow-2xs'
                          : 'border-border bg-card hover:border-(--ink)'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-semibold text-(--ink)">
                          {mode.title}
                        </div>
                        <div className="text-[11px] text-muted mt-0.5">
                          {mode.desc}
                        </div>
                      </div>
                      {isSelected && (
                        <span className="h-2 w-2 rounded-full bg-(--burnished-gold) shrink-0 mt-1" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Age Band & Teen Safety Safeguards */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted">
                  Age &amp; Safety Profile
                </label>
                <span className="text-[10px] text-(--burnished-gold) font-medium">Safe styling for ages 14+</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {AGE_BAND_CHOICES.map((b) => {
                  const isSelected = (preferences.ageBand || 'adult_18_plus') === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => handleSetAgeBand(b.id)}
                      className={`flex flex-col text-left p-3 rounded-xl border transition-all active:scale-98 ${
                        isSelected
                          ? 'border-(--kumkum) bg-(--ivory) shadow-2xs'
                          : 'border-border bg-card hover:border-(--ink)'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-(--ink)">{b.label}</span>
                        {isSelected && <Check className="h-3.5 w-3.5 text-(--kumkum)" />}
                      </div>
                      <span className="text-[10.5px] text-muted mt-0.5">{b.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Garment Presentation Preference */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-2">
                Garment Presentation
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESENTATION_CHOICES.map((p) => {
                  const isSelected = (preferences.presentationPreference || 'all') === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSetPresentation(p.id)}
                      className={`min-h-11 rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all select-none active:scale-[0.97] ${
                        isSelected
                          ? 'border border-(--ink) bg-(--ink) text-(--paper) shadow-2xs'
                          : 'border border-border bg-card text-muted hover:border-(--ink)'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* International Style Inspirations (Indian-First Anchor) */}
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted">
                  International Style Inspiration
                </label>
                <span className="text-[9.5px] text-muted italic">Indian fashion remains primary anchor</span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {INTERNATIONAL_INSPIRATIONS.map((sys) => {
                  const isSelected = preferences.internationalInspirations?.includes(sys.id);
                  return (
                    <button
                      key={sys.id}
                      type="button"
                      onClick={() => handleToggleInternationalInspiration(sys.id)}
                      className={`flex items-start justify-between p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-(--kumkum) bg-(--ivory) shadow-2xs'
                          : 'border-border bg-card hover:border-(--ink)'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-semibold text-(--ink)">{sys.title}</div>
                        <div className="text-[11px] text-muted mt-0.5">{sys.desc}</div>
                      </div>
                      {isSelected ? (
                        <Check className="h-4 w-4 text-(--kumkum) shrink-0 mt-0.5" />
                      ) : (
                        <span className="h-3 w-3 rounded-full border border-border shrink-0 mt-1" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Learned Style Brain Section */}
          <section className="rounded-3xl glass-card specular-border p-5 sm:p-6 shadow-2xs space-y-4">
            <div className="flex items-baseline justify-between border-b border-border pb-3">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-(--burnished-gold)" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
                  LEARNED STYLE BRAIN
                </span>
              </div>
              <span className="text-[10px] text-muted">
                {styleProfile.totalSignalsCount >= 3
                  ? `${Math.round(styleProfile.overallConfidence * 100)}% Confidence · ${styleProfile.totalSignalsCount} Signals`
                  : 'Observing Habits'}
              </span>
            </div>

            {styleProfile.totalSignalsCount < 3 ? (
              <div className="rounded-2xl border border-dashed border-border bg-(--ivory)/60 p-4 text-center">
                <p className="text-xs text-(--ink) font-medium">Style intuition is taking shape</p>
                <p className="text-[11px] text-muted mt-1 leading-relaxed">
                  As you wear, plan, save, or pass on outfits in Dress Me, StyleSaathi privately learns which colors, fabrics, and fits you naturally reach for.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5 text-xs">
                {/* Top Colors */}
                {styleProfile.topColors.length > 0 && (
                  <div>
                    <span className="block text-[9.5px] font-bold uppercase tracking-wider text-muted mb-1.5">
                      Colors You Gravitate Toward
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {styleProfile.topColors.map((color) => (
                        <span
                          key={color}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-(--ivory) px-2.5 py-1 text-xs font-semibold capitalize text-(--ink)"
                        >
                          <span className="h-2 w-2 rounded-full border border-black/10" style={{ backgroundColor: color }} />
                          <span>{color}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preferred Fabrics */}
                {styleProfile.topFabrics.length > 0 && (
                  <div>
                    <span className="block text-[9.5px] font-bold uppercase tracking-wider text-muted mb-1.5">
                      Go-To Fabrics &amp; Textures
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {styleProfile.topFabrics.map((fabric) => (
                        <span
                          key={fabric}
                          className="rounded-xl border border-border bg-card px-2.5 py-1 text-xs font-medium capitalize text-(--ink)"
                        >
                          {fabric.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preferred Silhouettes */}
                {styleProfile.topFits.length > 0 && (
                  <div>
                    <span className="block text-[9.5px] font-bold uppercase tracking-wider text-muted mb-1.5">
                      Preferred Silhouettes &amp; Fits
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {styleProfile.topFits.map((fit) => (
                        <span
                          key={fit}
                          className="rounded-xl border border-border bg-card px-2.5 py-1 text-xs font-medium capitalize text-(--ink)"
                        >
                          {fit.replace(/_/g, ' ')} fit
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Style Phase Exploration */}
                {styleProfile.recentExplorations.length > 0 && (
                  <div className="rounded-2xl border border-(--burnished-gold)/40 bg-(--ivory) p-3">
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-(--burnished-gold) mb-0.5">
                      RECENT EXPLORATION
                    </span>
                    <span className="text-[11.5px] text-(--ink)">
                      You&apos;ve recently been exploring {styleProfile.recentExplorations.join(', ')}.
                    </span>
                  </div>
                )}

                {/* Reset Learned Memory Button (User Control Principle) */}
                <div className="pt-2 border-t border-border/60 flex justify-between items-center">
                  <span className="text-[10px] text-muted">
                    Explicit preferences above always override learned memory.
                  </span>
                  <button
                    type="button"
                    onClick={() => setAlertAction('reset_style')}
                    className="text-[11px] font-semibold text-(--kumkum) hover:underline"
                  >
                    Reset Style Memory
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Appearance & Archive Management */}
        <div className="space-y-4">
          {/* Appearance Section */}
          <section className="rounded-3xl glass-card specular-border p-5 sm:p-6 shadow-2xs">
            <div className="flex items-baseline justify-between border-b border-border pb-3 mb-3.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
                APPEARANCE
              </span>
              <span className="text-[11px] text-muted">Theme palette</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => theme === 'dark' && toggleTheme()}
                className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border text-xs font-semibold uppercase tracking-wider transition-all tactile-press ${
                  theme === 'light'
                    ? 'border-(--ink) bg-(--ink) text-(--paper)'
                    : 'border-border bg-card text-muted hover:border-(--ink)'
                }`}
              >
                <Sun className="h-4 w-4 text-(--burnished-gold)" />
                <span>Light (Ivory)</span>
              </button>

              <button
                type="button"
                onClick={() => theme === 'light' && toggleTheme()}
                className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border text-xs font-semibold uppercase tracking-wider transition-all tactile-press ${
                  theme === 'dark'
                    ? 'border-(--kumkum) bg-(--kumkum) text-white'
                    : 'border-border bg-card text-muted hover:border-(--ink)'
                }`}
              >
                <Moon className="h-4 w-4" />
                <span>Dark (Charcoal)</span>
              </button>
            </div>
          </section>

          {/* Wardrobe Management Actions */}
          <section className="rounded-3xl glass-card specular-border p-5 sm:p-6 shadow-2xs space-y-3">
            <div className="flex items-baseline justify-between border-b border-border pb-3 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
                WARDROBE DATA
              </span>
              <span className="text-[11px] text-muted">Archive controls</span>
            </div>

            <Button
              variant="outline"
              size="lg"
              onClick={() => setShowSavedModal(true)}
              className="w-full min-h-12 border-border font-semibold uppercase tracking-wider gap-2 shadow-2xs tactile-press hover:border-(--ink)"
            >
              <Bookmark className="h-3.5 w-3.5 text-(--burnished-gold)" />
              <span>Browse Saved Looks ({savedOutfits.length})</span>
            </Button>

            <Button
              variant="secondary"
              size="lg"
              onClick={loadSample}
              className="w-full min-h-12 border border-(--ink) font-semibold uppercase tracking-wider gap-2 shadow-2xs tactile-press"
            >
              <Sparkles className="h-3.5 w-3.5 text-(--burnished-gold)" />
              <span>Reload Sample Indian Wardrobe</span>
            </Button>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <Button
                variant="outline"
                size="default"
                onClick={() => setAlertAction('clear')}
                className="min-h-11 border-border text-muted hover:border-amber-600 hover:text-amber-700 transition-colors tactile-press"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Clear Wardrobe</span>
              </Button>

              <Button
                variant="outline"
                size="default"
                onClick={() => setAlertAction('reset')}
                className="min-h-11 border-border text-muted hover:border-(--kumkum) hover:text-(--kumkum) transition-colors tactile-press"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Reset All</span>
              </Button>

              <Button
                variant="outline"
                size="default"
                onClick={() => setAlertAction('delete_account')}
                className="col-span-2 min-h-11 border-red-300 text-red-700 hover:bg-red-50 hover:border-red-500 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30 transition-colors tactile-press"
              >
                <Trash2 className="h-3.5 w-3.5 text-(--kumkum)" />
                <span>Permanently Delete Account &amp; Data</span>
              </Button>
            </div>
          </section>

          {/* Privacy Notice */}
          <section className="rounded-3xl border border-border bg-(--ivory)/60 p-5 sm:p-6">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-(--ink) mb-1.5">
              <Shield className="h-4 w-4 text-(--kumkum)" />
              <span>Local Wardrobe Privacy</span>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Your wardrobe photos, calendar outfit plans, and style preferences stay strictly on this device.
              Clothing images are stored in your browser&apos;s IndexedDB and metadata in local storage.
              No images are ever sent to external cloud servers without your explicit account sync.
            </p>
          </section>
        </div>
      </div>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={alertAction !== null} onOpenChange={(open) => !open && setAlertAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {alertAction === 'clear'
                ? 'Clear Wardrobe?'
                : alertAction === 'reset_style'
                ? 'Reset Learned Style Memory?'
                : alertAction === 'delete_account'
                ? 'Permanently Delete Account?'
                : 'Reset All StyleSaathi Data?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {alertAction === 'clear'
                ? 'This will clear all clothing pieces from your wardrobe archive. This action cannot be undone.'
                : alertAction === 'reset_style'
                ? 'This clears your behavioral feedback signals (wears, saves, passes) and returns recommendations to baseline preferences. Your wardrobe garments and calendar plans will not be affected.'
                : alertAction === 'delete_account'
                ? 'This will permanently erase your StyleSaathi account, all wardrobe garments, photos, style history, and calendar plans from the cloud and this device. This action is irreversible and cannot be undone.'
                : 'This will reset all your wardrobe garments, styling preferences, and calendar plans, returning you to the beginning.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleConfirmAction}>
              {alertAction === 'clear'
                ? 'Clear Wardrobe'
                : alertAction === 'reset_style'
                ? 'Reset Style Memory'
                : alertAction === 'delete_account'
                ? 'Permanently Delete Account'
                : 'Reset Everything'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Auth Modal for Guest Users upgrading to an account */}
      {showAuthModal && (
        <AuthView
          isModal={true}
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => {
            setShowAuthModal(false);
            showToast('Welcome to your StyleSaathi profile!');
          }}
        />
      )}

      {/* Saved Outfits Lookbook Modal */}
      <SavedOutfitsModal
        isOpen={showSavedModal}
        onClose={() => setShowSavedModal(false)}
        onPlanLook={(outfit) => {
          setPlanningOutfit(outfit);
        }}
      />

      {/* Plan Look Modal from Saved Outfits */}
      {planningOutfit && (
        <PlanLookModal
          isOpen={true}
          onClose={() => setPlanningOutfit(null)}
          outfit={planningOutfit}
          occasion="everyday"
        />
      )}
    </div>
  );
};


