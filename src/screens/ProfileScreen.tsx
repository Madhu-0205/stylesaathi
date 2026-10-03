import React from 'react';
import { Sun, Moon, Shield, RotateCcw, Trash2, Sparkles } from 'lucide-react';
import { useWardrobeContext } from '../context/WardrobeContext';
import { STYLE_VIBES } from '../data/taxonomy';

export const ProfileScreen: React.FC = () => {
  const {
    items,
    savedOutfits,
    theme,
    toggleTheme,
    styleVibes,
    setStyleVibes,
    loadSample,
    resetWardrobe,
    resetAll,
  } = useWardrobeContext();

  // Metrics
  const totalPieces = items.length;
  const favoritesCount = items.filter((i) => i.favorite).length;
  const totalWears = items.reduce((acc, i) => acc + (i.timesWorn || 0), 0);

  const toggleVibe = (vibe: string) => {
    if (styleVibes.includes(vibe)) {
      setStyleVibes(styleVibes.filter((v) => v !== vibe));
    } else {
      setStyleVibes([...styleVibes, vibe]);
    }
  };

  const handleResetWardrobe = async () => {
    if (confirm('Clear all clothing items in your wardrobe?')) {
      await resetWardrobe();
    }
  };

  const handleResetAll = async () => {
    if (confirm('Reset all data including style preferences and return to onboarding?')) {
      await resetAll();
    }
  };

  return (
    <div className="pb-12 animate-fade-in space-y-4">
      {/* Compact Editorial Header: "YOU · Personal Archive" */}
      <header className="flex items-center justify-between border-b border-(--border) pb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[9.5px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
              YOU
            </span>
            <span className="text-[10px] text-(--muted) font-devanagari">
              आपकी शैली
            </span>
          </div>
          <h1 className="mt-0.5 font-serif text-2xl sm:text-3xl font-normal text-(--ink) tracking-tight">
            Style & Archive
          </h1>
          <p className="text-[11px] text-(--muted) font-medium">
            {totalPieces} pieces · {favoritesCount} favorites · {savedOutfits.length} saved · {totalWears} wears
          </p>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-(--border) text-(--muted) transition-colors hover:border-(--ink) hover:text-(--ink)"
          aria-label="Toggle theme"
        >
          {theme === 'light' ? '☾' : '☼'}
        </button>
      </header>

      {/* Style Preferences Section */}
      <section className="rounded-2xl border border-(--border) bg-(--card) p-5 sm:p-6 shadow-2xs">
        <div className="flex items-baseline justify-between border-b border-(--border) pb-3 mb-3.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
            STYLE PREFERENCES
          </span>
          <span className="text-[11px] text-(--muted)">Aesthetic direction</span>
        </div>
        <p className="text-xs text-(--muted) mb-3">
          Select the aesthetics that guide your everyday outfit curation.
        </p>
        <div className="flex flex-wrap gap-2">
          {STYLE_VIBES.map((vibe) => {
            const isSelected = styleVibes.includes(vibe);
            return (
              <button
                key={vibe}
                type="button"
                onClick={() => toggleVibe(vibe)}
                className={`min-h-10 rounded-lg px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all active:scale-95 ${
                  isSelected
                    ? 'border border-(--ink) bg-(--ink) text-(--paper) shadow-2xs'
                    : 'border border-(--border) bg-(--card) text-(--muted) hover:border-(--ink)'
                }`}
              >
                {vibe}
              </button>
            );
          })}
        </div>
      </section>

      {/* Appearance Section */}
      <section className="rounded-2xl border border-(--border) bg-(--card) p-5 sm:p-6 shadow-2xs">
        <div className="flex items-baseline justify-between border-b border-(--border) pb-3 mb-3.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
            APPEARANCE
          </span>
          <span className="text-[11px] text-(--muted)">Theme palette</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => theme === 'dark' && toggleTheme()}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border text-xs font-semibold uppercase tracking-wider transition-all ${
              theme === 'light'
                ? 'border-(--ink) bg-(--ink) text-(--paper)'
                : 'border-(--border) bg-(--card) text-(--muted) hover:border-(--ink)'
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
                : 'border-(--border) bg-(--card) text-(--muted) hover:border-(--ink)'
            }`}
          >
            <Moon className="h-4 w-4" />
            <span>Dark (Charcoal)</span>
          </button>
        </div>
      </section>

      {/* Privacy Notice */}
      <section className="rounded-2xl border border-(--border) bg-(--ivory)/60 p-5">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-(--ink) mb-1.5">
          <Shield className="h-4 w-4 text-(--kumkum)" />
          <span>Local Wardrobe Privacy</span>
        </div>
        <p className="text-xs text-(--muted) leading-relaxed">
          Your wardrobe photos and styling history stay strictly on this device.
          Photos are stored in your browser&apos;s IndexedDB and metadata in local storage.
          No images are ever sent to external cloud servers.
        </p>
      </section>

      {/* Wardrobe Management Actions */}
      <section className="space-y-2.5 pt-1">
        <button
          type="button"
          onClick={loadSample}
          className="w-full min-h-12 flex items-center justify-center gap-2 rounded-xl border border-(--ink) bg-(--paper) px-4 py-3 text-xs font-semibold uppercase tracking-wider text-(--ink) transition-colors hover:bg-(--ink) hover:text-(--paper) active:scale-98"
        >
          <Sparkles className="h-3.5 w-3.5 text-(--burnished-gold)" />
          <span>Reload Sample Indian Wardrobe</span>
        </button>

        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleResetWardrobe}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-(--border) bg-(--card) px-3 py-2 text-xs font-medium text-(--muted) hover:border-amber-600 hover:text-amber-700 transition-colors active:scale-95"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Clear Wardrobe</span>
          </button>

          <button
            type="button"
            onClick={handleResetAll}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-(--border) bg-(--card) px-3 py-2 text-xs font-medium text-(--muted) hover:border-(--kumkum) hover:text-(--kumkum) transition-colors active:scale-95"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Reset All</span>
          </button>
        </div>
      </section>
    </div>
  );
};

