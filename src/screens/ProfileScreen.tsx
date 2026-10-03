import React from 'react';
import { Sun, Moon, Shield, Sparkles, RotateCcw, Trash2 } from 'lucide-react';
import { useWardrobeContext } from '../context/WardrobeContext';
import { Header } from '../components/common/Header';
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
  const mostWorn = [...items].sort((a, b) => b.timesWorn - a.timesWorn)[0];

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
    <div className="pb-8 animate-fade-in space-y-5">
      {/* Top Header */}
      <Header
        title="Your Profile"
        subtitle="Wardrobe statistics and personal preferences."
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Stats Summary Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4 text-center">
          <span className="text-2xl font-black text-[var(--text)] sm:text-3xl">
            {totalPieces}
          </span>
          <span className="block mt-1 text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
            Total Pieces
          </span>
        </div>

        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4 text-center">
          <span className="text-2xl font-black text-[var(--accent)] sm:text-3xl">
            {favoritesCount}
          </span>
          <span className="block mt-1 text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
            Favorites
          </span>
        </div>

        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4 text-center">
          <span className="text-2xl font-black text-[var(--text)] sm:text-3xl">
            {savedOutfits.length}
          </span>
          <span className="block mt-1 text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
            Saved Looks
          </span>
        </div>

        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4 text-center">
          <span className="text-2xl font-black text-[var(--text)] sm:text-3xl">
            {totalWears}
          </span>
          <span className="block mt-1 text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
            Total Wears
          </span>
        </div>
      </div>

      {/* Most Worn Highlight */}
      {mostWorn && mostWorn.timesWorn > 0 && (
        <div className="flex items-center justify-between rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent)]">
              Most Worn Piece
            </span>
            <h4 className="mt-0.5 text-sm font-bold text-[var(--text)]">
              {mostWorn.name}
            </h4>
            <span className="text-xs text-[var(--muted)]">
              Logged {mostWorn.timesWorn} times across your styled looks
            </span>
          </div>
          <span className="rounded-full bg-[var(--accent-light)] px-3 py-1 text-xs font-bold text-[var(--accent)]">
            {mostWorn.timesWorn} wears
          </span>
        </div>
      )}

      {/* Style Vibe Preferences */}
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text)] mb-1">
          Style Preferences
        </h3>
        <p className="text-xs text-[var(--muted)] mb-3">
          Tap to toggle your current aesthetic priorities.
        </p>
        <div className="flex flex-wrap gap-2">
          {STYLE_VIBES.map((vibe) => {
            const isSelected = styleVibes.includes(vibe);
            return (
              <button
                key={vibe}
                type="button"
                onClick={() => toggleVibe(vibe)}
                className={`min-h-[38px] rounded-full px-4 text-xs font-bold transition-all ${
                  isSelected
                    ? 'bg-[var(--accent)] text-white shadow-xs'
                    : 'border border-[var(--border)] bg-[var(--background)] text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                {vibe}
              </button>
            );
          })}
        </div>
      </div>

      {/* Appearance Section */}
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text)] mb-1">
          Appearance
        </h3>
        <p className="text-xs text-[var(--muted)] mb-3">
          Switch between warm editorial cream and sleek dark mode.
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => theme === 'dark' && toggleTheme()}
            className={`flex min-h-[46px] items-center justify-center gap-2 rounded-2xl border text-xs font-bold transition-all ${
              theme === 'light'
                ? 'border-[var(--accent)] bg-[var(--accent-light)]/60 text-[var(--accent)]'
                : 'border-[var(--border)] bg-[var(--background)] text-[var(--muted)]'
            }`}
          >
            <Sun className="h-4 w-4" />
            <span>Light (Cream)</span>
          </button>

          <button
            type="button"
            onClick={() => theme === 'light' && toggleTheme()}
            className={`flex min-h-[46px] items-center justify-center gap-2 rounded-2xl border text-xs font-bold transition-all ${
              theme === 'dark'
                ? 'border-[var(--accent)] bg-[var(--accent-light)]/60 text-[var(--accent)]'
                : 'border-[var(--border)] bg-[var(--background)] text-[var(--muted)]'
            }`}
          >
            <Moon className="h-4 w-4" />
            <span>Dark (Charcoal)</span>
          </button>
        </div>
      </div>

      {/* Privacy Notice */}
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-1.5">
          <Shield className="h-4 w-4 text-[var(--accent)]" />
          <span>Local-First Privacy</span>
        </div>
        <p className="text-xs text-[var(--muted)] leading-relaxed">
          Your wardrobe items and photos stay strictly on this device in the MVP.
          Photos are stored in your browser&apos;s IndexedDB and metadata in localStorage.
          No images or data are sent to external cloud servers.
        </p>
      </div>

      {/* Actions */}
      <div className="space-y-2.5 pt-2">
        <button
          type="button"
          onClick={loadSample}
          className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-xs font-bold text-[var(--text)] transition-colors hover:border-[var(--accent)] active:scale-95"
        >
          <Sparkles className="h-4 w-4 text-[var(--accent)]" />
          <span>Load Sample Indian Wardrobe</span>
        </button>

        <button
          type="button"
          onClick={handleResetWardrobe}
          className="w-full min-h-[46px] flex items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-xs font-bold text-[var(--muted)] hover:text-amber-600 transition-colors active:scale-95"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Reset Wardrobe Items</span>
        </button>

        <button
          type="button"
          onClick={handleResetAll}
          className="w-full min-h-[46px] flex items-center justify-center gap-2 rounded-2xl border border-red-200/60 bg-transparent px-4 py-2.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-950/20 active:scale-95"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Reset All Data</span>
        </button>
      </div>
    </div>
  );
};
