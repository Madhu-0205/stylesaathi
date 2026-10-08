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
  Sliders,
  Check,
  Cloud,
  RefreshCw,
  WifiOff,
} from 'lucide-react';
import { useWardrobeContext } from '../context/WardrobeContext';
import { useAuth } from '../context/AuthContext';
import { AuthView } from '../components/auth/AuthView';
import { StylingMode } from '../types';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { syncService } from '../lib/sync/syncService';
import { Button } from '@/components/ui/button';
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

  const { user, isGuest, isAuthenticated, signOut } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [alertAction, setAlertAction] = useState<'clear' | 'reset' | 'reset_style' | null>(null);
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
    }
    setAlertAction(null);
  };

  return (
    <div className="pb-12 animate-fade-in space-y-4">
      {/* Compact Editorial Header: "YOU · Personal Archive" */}
      <header className="flex items-center justify-between border-b border-border pb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[9.5px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
              YOU
            </span>
          </div>
          <h1 className="mt-0.5 font-serif text-2xl sm:text-3xl font-normal text-(--ink) tracking-tight">
            Style &amp; Archive
          </h1>
          <p className="text-[11px] text-muted font-medium">
            {totalPieces} pieces · {favoritesCount} favorites · {savedOutfits.length} saved · {totalWears} wears
          </p>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          className="md:hidden flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted transition-colors hover:border-(--ink) hover:text-(--ink)"
          aria-label="Toggle theme"
        >
          {theme === 'light' ? '☾' : '☼'}
        </button>
      </header>

      {/* Account Profile Status Banner */}
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-(--ivory) border border-border text-(--ink) font-serif font-bold text-base">
              {user?.name ? user.name[0].toUpperCase() : user?.email ? user.email[0].toUpperCase() : <UserIcon className="h-5 w-5 text-(--burnished-gold)" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
                  {isAuthenticated ? 'STYLESAATHI MEMBER' : 'GUEST SESSION'}
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-(--burnished-gold)" />
                <span className="text-[10px] text-muted">Local-first</span>
              </div>
              <h2 className="text-sm font-semibold text-(--ink)">
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
                className="shadow-2xs font-semibold uppercase tracking-wider"
              >
                <span>Create Profile</span>
              </Button>
            )}
            {isAuthenticated && (
              <Button
                variant="outline"
                size="sm"
                onClick={signOut}
                className="gap-1.5 font-medium text-muted hover:text-(--ink)"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </Button>
            )}
          </div>
        </div>

        {/* Sync Status Bar */}
        <div className="mt-3 pt-3 border-t border-(--border)/60 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
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
              className="text-[10px] font-bold uppercase tracking-wider text-(--burnished-gold) hover:underline flex items-center gap-1"
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
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xs space-y-4">
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
                      className={`min-h-9 rounded-lg px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-all active:scale-95 ${
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
          </section>

          {/* Learned Style Brain Section */}
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xs space-y-4">
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
              <div className="rounded-xl border border-dashed border-border bg-(--ivory)/60 p-3.5 text-center">
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
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-(--ivory) px-2.5 py-1 text-xs font-semibold capitalize text-(--ink)"
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
                          className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium capitalize text-(--ink)"
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
                          className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium capitalize text-(--ink)"
                        >
                          {fit.replace(/_/g, ' ')} fit
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Style Phase Exploration */}
                {styleProfile.recentExplorations.length > 0 && (
                  <div className="rounded-xl border border-(--burnished-gold)/40 bg-(--ivory) p-2.5">
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-(--burnished-gold) mb-0.5">
                      RECENT EXPLORATION
                    </span>
                    <span className="text-[11.5px] text-(--ink)">
                      You&apos;ve recently been exploring {styleProfile.recentExplorations.join(', ')}.
                    </span>
                  </div>
                )}

                {/* Reset Learned Memory Button (User Control Principle) */}
                <div className="pt-2 border-t border-(--border)/60 flex justify-between items-center">
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
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xs">
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
                className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border text-xs font-semibold uppercase tracking-wider transition-all ${
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
                className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border text-xs font-semibold uppercase tracking-wider transition-all ${
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
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xs space-y-3">
            <div className="flex items-baseline justify-between border-b border-border pb-3 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
                WARDROBE DATA
              </span>
              <span className="text-[11px] text-muted">Archive controls</span>
            </div>

            <Button
              variant="secondary"
              size="lg"
              onClick={loadSample}
              className="w-full min-h-12 border border-(--ink) font-semibold uppercase tracking-wider gap-2 shadow-2xs"
            >
              <Sparkles className="h-3.5 w-3.5 text-(--burnished-gold)" />
              <span>Reload Sample Indian Wardrobe</span>
            </Button>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <Button
                variant="outline"
                size="default"
                onClick={() => setAlertAction('clear')}
                className="min-h-11 border-border text-muted hover:border-amber-600 hover:text-amber-700 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Clear Wardrobe</span>
              </Button>

              <Button
                variant="outline"
                size="default"
                onClick={() => setAlertAction('reset')}
                className="min-h-11 border-border text-muted hover:border-(--kumkum) hover:text-(--kumkum) transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Reset All</span>
              </Button>
            </div>
          </section>

          {/* Privacy Notice */}
          <section className="rounded-2xl border border-border bg-(--ivory)/60 p-5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-(--ink) mb-1.5">
              <Shield className="h-4 w-4 text-(--kumkum)" />
              <span>Local Wardrobe Privacy</span>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Your wardrobe photos, calendar outfit plans, and style preferences stay strictly on this device.
              Clothing images are stored in your browser&apos;s IndexedDB and metadata in local storage.
              No images are ever sent to external cloud servers.
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
                : 'Reset All StyleSaathi Data?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {alertAction === 'clear'
                ? 'This will clear all clothing pieces from your wardrobe archive. This action cannot be undone.'
                : alertAction === 'reset_style'
                ? 'This clears your behavioral feedback signals (wears, saves, passes) and returns recommendations to baseline preferences. Your wardrobe garments and calendar plans will not be affected.'
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
    </div>
  );
};


