import React, { useState } from 'react';
import { Plus, Check, ArrowRight, Sparkles, Shirt } from 'lucide-react';
import { useWardrobeContext } from '../context/WardrobeContext';
import { StyleSaathiLogo } from '../components/brand/StyleSaathiLogo';
import { AddItemSheet } from '../components/wardrobe/AddItemSheet';
import { ItemImage } from '../components/common/ItemImage';
import { WardrobeItem, StylingMode } from '../types';

interface WardrobeSetupScreenProps {
  onComplete: () => void;
}

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
  { id: 'Minimal', label: 'Minimal', desc: 'Clean, understated, uncluttered silhouettes' },
  { id: 'Classic', label: 'Classic', desc: 'Timeless tailored pieces with enduring polish' },
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

export const WardrobeSetupScreen: React.FC<WardrobeSetupScreenProps> = ({ onComplete }) => {
  const { items, addItem, loadSample, preferences, updatePreferences, setSetupCompleted } = useWardrobeContext();
  const [subStep, setSubStep] = useState<'rail' | 'preferences' | 'ready'>('rail');
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Style preferences draft state
  const [selectedContexts, setSelectedContexts] = useState<string[]>(
    preferences.preferredContexts.length > 0 ? preferences.preferredContexts : ['Everyday', 'Work']
  );
  const [selectedAesthetics, setSelectedAesthetics] = useState<string[]>(
    preferences.preferredAesthetics.length > 0 ? preferences.preferredAesthetics : ['Contemporary', 'Indo-Western']
  );
  const [stylingMode, setStylingMode] = useState<StylingMode>(preferences.stylingMode || 'variety');

  // Progressive milestone calculations
  const count = items.length;
  const target = 4;
  const canProceed = count >= 2;

  const getMilestoneText = () => {
    if (count === 0) return "Let's start with something you love.";
    if (count === 1) return 'A beginning.';
    if (count === 2) return 'We can start building looks.';
    if (count === 3) return 'Your wardrobe is taking shape.';
    return 'Your StyleSpace is ready.';
  };

  const handleToggleContext = (ctx: string) => {
    setSelectedContexts((prev) =>
      prev.includes(ctx) ? prev.filter((c) => c !== ctx) : [...prev, ctx]
    );
  };

  const handleToggleAesthetic = (aes: string) => {
    setSelectedAesthetics((prev) =>
      prev.includes(aes) ? prev.filter((a) => a !== aes) : [...prev, aes]
    );
  };

  const handleSavePreferences = async () => {
    await updatePreferences({
      preferredContexts: selectedContexts.length > 0 ? selectedContexts : ['Everyday'],
      preferredAesthetics: selectedAesthetics.length > 0 ? selectedAesthetics : ['Contemporary'],
      stylingMode,
    });
    setSubStep('ready');
  };

  const handleFinalFinish = () => {
    setSetupCompleted(true);
    onComplete();
  };

  const handleUseSample = async () => {
    await loadSample();
    setSubStep('preferences');
  };

  // =========================================================================
  // SUB-STEP 1: PROGRESSIVE WARDROBE RAIL
  // =========================================================================
  if (subStep === 'rail') {
    return (
      <div className="w-full max-w-xl mx-auto flex min-h-[100dvh] flex-col justify-between p-5 sm:p-8 animate-fade-in bg-(--background)">
        {/* Header */}
        <div className="flex items-center justify-between pt-2 border-b border-(--border) pb-3">
          <StyleSaathiLogo variant="full" size="sm" showTagline={true} />
          <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-(--burnished-gold)">
            {Math.min(count, target)} / {target} PIECES
          </span>
        </div>

        {/* Centerpiece: Progressive Wardrobe Rail */}
        <div className="my-auto py-6">
          <div className="text-center mb-6">
            <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-(--kumkum)">
              WARDROBE INTRODUCTION
            </span>
            <h1 className="mt-2 font-serif text-3xl sm:text-4xl font-normal text-(--ink) tracking-tight">
              LET'S MEET YOUR WARDROBE.
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-(--muted) leading-relaxed max-w-md mx-auto">
              Add a few pieces you already love. We'll start styling from what you actually own.
            </p>
            <div className="mt-3 inline-block rounded-full bg-(--ivory) border border-(--border) px-3 py-1 text-xs font-serif italic text-(--ink)">
              "{getMilestoneText()}"
            </div>
          </div>

          {/* Architectural Wardrobe Rail Visual */}
          <div className="relative mx-auto max-w-md rounded-2xl border border-(--border) bg-(--card) p-5 sm:p-6 shadow-xs">
            {/* Top Brass Rail */}
            <div className="relative mb-6">
              <div className="h-1 w-full rounded-full bg-gradient-to-r from-(--burnished-gold)/60 via-(--ink) to-(--burnished-gold)/60" />
              <div className="absolute -left-1 -top-1 h-3 w-3 rounded-full bg-(--burnished-gold) shadow-2xs" />
              <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-(--burnished-gold) shadow-2xs" />
            </div>

            {/* 4 Hanging Garment Slots */}
            <div className="grid grid-cols-4 gap-2 sm:gap-3">
              {[0, 1, 2, 3].map((slotIdx) => {
                const item = items[slotIdx] as WardrobeItem | undefined;
                return (
                  <div key={slotIdx} className="flex flex-col items-center">
                    {/* Hanger Hook */}
                    <div className="h-4 w-0.5 bg-(--burnished-gold) mb-0.5" />

                    {/* Garment Card or Empty Slot */}
                    {item ? (
                      <div className="relative aspect-3/4 w-full overflow-hidden rounded-xl border border-(--border) bg-(--ivory) shadow-2xs animate-reveal">
                        <ItemImage item={item} className="h-full w-full object-contain p-1" />
                        <div className="absolute bottom-0 inset-x-0 bg-(--card)/90 backdrop-blur-xs py-0.5 px-1 text-center">
                          <span className="block text-[8px] font-bold uppercase truncate text-(--ink)">
                            {item.name || item.subcategory}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsAddOpen(true)}
                        className="group flex aspect-3/4 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-(--border) bg-(--background)/50 transition-all hover:border-(--ink) hover:bg-(--ivory) active:scale-95"
                        aria-label="Add wardrobe item"
                      >
                        <Plus className="h-4 w-4 text-(--muted) group-hover:text-(--ink) transition-colors" />
                        <span className="mt-1 text-[8px] font-bold uppercase tracking-wider text-(--muted) group-hover:text-(--ink)">
                          SLOT {slotIdx + 1}
                        </span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="space-y-3 pb-4">
          {canProceed && (
            <div className="rounded-xl border border-(--burnished-gold)/40 bg-(--ivory) p-3 text-center animate-fade-in shadow-2xs">
              <span className="text-[9.5px] font-bold uppercase tracking-[0.2em] text-(--kumkum) block">
                WE CAN START BUILDING LOOKS.
              </span>
              <p className="mt-0.5 text-xs text-(--muted)">
                We have enough pieces to begin styling outfits. You can continue adding pieces or proceed to personalize.
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={() => setIsAddOpen(true)}
              className={`flex-1 flex min-h-12 items-center justify-center gap-2.5 rounded-xl border px-4 py-3 text-xs sm:text-sm font-semibold uppercase tracking-wider transition-all active:scale-[0.98] shadow-2xs ${
                canProceed
                  ? 'border-(--border) bg-(--card) text-(--ink) hover:border-(--ink)'
                  : 'border-(--ink) bg-(--ink) text-(--paper) hover:opacity-95'
              }`}
            >
              <Plus className="h-4 w-4 text-(--burnished-gold)" />
              <span>Add {count === 0 ? 'Your First Piece' : 'Another Piece'}</span>
            </button>

            {canProceed && (
              <button
                type="button"
                onClick={() => setSubStep('preferences')}
                className="flex-1 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-(--ink) bg-(--ink) px-4 py-3 text-xs sm:text-sm font-semibold uppercase tracking-wider text-(--paper) transition-all hover:opacity-95 active:scale-[0.98] shadow-2xs"
              >
                <span>Continue Styling</span>
                <ArrowRight className="h-4 w-4 text-(--burnished-gold)" />
              </button>
            )}
          </div>

          {count === 0 && (
            <button
              type="button"
              onClick={handleUseSample}
              className="w-full text-center text-xs font-serif italic text-(--muted) hover:text-(--ink) transition-colors pt-1"
            >
              Or start with curated 25-piece sample wardrobe →
            </button>
          )}
        </div>

        {/* Add Item Bottom Sheet */}
        <AddItemSheet
          isOpen={isAddOpen}
          onClose={() => setIsAddOpen(false)}
          onAddItem={async (newItem) => {
            await addItem(newItem);
            setIsAddOpen(false);
            if (count + 1 >= target) {
              setSubStep('preferences');
            }
          }}
        />
      </div>
    );
  }

  // =========================================================================
  // SUB-STEP 2: PERSONAL STYLE PREFERENCES
  // =========================================================================
  if (subStep === 'preferences') {
    return (
      <div className="w-full max-w-xl mx-auto flex min-h-[100dvh] flex-col justify-between p-5 sm:p-8 animate-fade-in bg-(--background)">
        {/* Header */}
        <div className="flex items-center justify-between pt-2 border-b border-(--border) pb-3">
          <StyleSaathiLogo variant="full" size="sm" showTagline={true} />
          <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-(--burnished-gold)">
            STYLE PROFILE
          </span>
        </div>

        {/* Preferences Form */}
        <div className="my-auto py-6 space-y-6">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-(--kumkum)">
              PERSONALIZATION
            </span>
            <h1 className="mt-1 font-serif text-3xl font-normal text-(--ink) tracking-tight">
              TELL US A LITTLE ABOUT YOUR STYLE.
            </h1>
            <p className="mt-1 text-xs text-(--muted) leading-relaxed">
              We tailor outfit recommendations to the way you actually live and dress.
            </p>
          </div>

          {/* Section 1: Contexts */}
          <div className="rounded-2xl border border-(--border) bg-(--card) p-4 sm:p-5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-(--muted) block mb-3">
              I USUALLY DRESS FOR:
            </span>
            <div className="flex flex-wrap gap-2">
              {CONTEXT_OPTIONS.map((ctx) => {
                const active = selectedContexts.includes(ctx);
                return (
                  <button
                    key={ctx}
                    type="button"
                    onClick={() => handleToggleContext(ctx)}
                    className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all active:scale-95 ${
                      active
                        ? 'border border-(--ink) bg-(--ink) text-(--paper) shadow-2xs'
                        : 'border border-(--border) bg-(--background) text-(--muted) hover:border-(--ink)'
                    }`}
                  >
                    {active && <Check className="h-3 w-3 text-(--burnished-gold)" />}
                    <span>{ctx}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Aesthetics */}
          <div className="rounded-2xl border border-(--border) bg-(--card) p-4 sm:p-5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-(--muted) block mb-3">
              WHAT FEELS MOST LIKE YOU?
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {AESTHETIC_OPTIONS.map((opt) => {
                const active = selectedAesthetics.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleToggleAesthetic(opt.id)}
                    className={`flex flex-col text-left p-3 rounded-xl border transition-all active:scale-[0.98] ${
                      active
                        ? 'border-(--ink) bg-(--ivory) text-(--ink) shadow-2xs'
                        : 'border-(--border) bg-(--background) text-(--muted) hover:border-(--ink)'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold uppercase tracking-wider text-(--ink)">
                        {opt.label}
                      </span>
                      {active && <Check className="h-3.5 w-3.5 text-(--kumkum)" />}
                    </div>
                    <span className="mt-1 text-[10px] text-(--muted) leading-relaxed">
                      {opt.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Styling Mode */}
          <div className="rounded-2xl border border-(--border) bg-(--card) p-4 sm:p-5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-(--muted) block mb-3">
              HOW SHOULD STYLESAATHI STYLE YOU?
            </span>
            <div className="space-y-2">
              {STYLING_MODES.map((mode) => {
                const active = stylingMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setStylingMode(mode.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all active:scale-[0.99] ${
                      active
                        ? 'border-(--ink) bg-(--ivory) shadow-2xs'
                        : 'border-(--border) bg-(--background) hover:border-(--ink)'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-(--ink) block">
                        {mode.title}
                      </span>
                      <span className="text-[10px] text-(--muted)">
                        {mode.desc}
                      </span>
                    </div>
                    <div
                      className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                        active ? 'border-(--ink) bg-(--ink)' : 'border-(--border)'
                      }`}
                    >
                      {active && <div className="h-1.5 w-1.5 rounded-full bg-(--burnished-gold)" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 pb-4">
          <button
            type="button"
            onClick={handleSavePreferences}
            className="w-full flex min-h-12 items-center justify-center gap-2 rounded-xl border border-(--ink) bg-(--ink) px-4 py-3 text-xs sm:text-sm font-semibold uppercase tracking-wider text-(--paper) transition-all hover:opacity-95 active:scale-[0.98] shadow-2xs"
          >
            <span>Save My Preferences</span>
            <ArrowRight className="h-4 w-4 text-(--burnished-gold)" />
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // SUB-STEP 3: STYLESPACE READY MOMENT
  // =========================================================================
  return (
    <div className="w-full max-w-xl mx-auto flex min-h-[100dvh] flex-col justify-between p-5 sm:p-8 animate-fade-in bg-(--background)">
      {/* Header */}
      <div className="flex items-center justify-between pt-2 border-b border-(--border) pb-3">
        <StyleSaathiLogo variant="full" size="sm" showTagline={true} />
        <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-(--kumkum)">
          READY TO STYLE
        </span>
      </div>

      {/* Main Ready Card */}
      <div className="my-auto py-8 text-center">
        <div className="rounded-3xl border border-(--border) bg-(--card) p-6 sm:p-10 shadow-xs">
          <div className="mb-4 inline-flex items-center justify-center h-12 w-12 rounded-full bg-(--ivory) border border-(--border) text-(--kumkum)">
            <Sparkles className="h-6 w-6 text-(--burnished-gold)" />
          </div>

          <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-(--kumkum) block">
            CONCIERGE ONBOARDING
          </span>

          <h1 className="mt-2 font-serif text-3xl sm:text-4xl font-normal text-(--ink) tracking-tight">
            YOUR STYLESPACE IS READY.
          </h1>

          <p className="mt-2 text-xs sm:text-sm text-(--muted) leading-relaxed max-w-sm mx-auto font-normal">
            Your wardrobe is starting to become yours.
          </p>

          {/* Garments Mosaic Preview */}
          <div className="mt-6 -mx-2 flex justify-center gap-2 overflow-hidden px-4 py-2">
            {items.slice(0, 5).map((itm, i) => (
              <div
                key={itm.id || i}
                className="h-20 w-16 rounded-xl border border-(--border) bg-(--ivory) overflow-hidden shadow-2xs shrink-0"
              >
                <ItemImage item={itm} className="h-full w-full object-contain p-1" />
              </div>
            ))}
          </div>

          <div className="mt-4 text-[11px] font-serif italic text-(--muted)">
            {items.length} pieces curated · Styled around how you actually dress
          </div>
        </div>
      </div>

      {/* Enter Action */}
      <div className="pb-4">
        <button
          type="button"
          onClick={handleFinalFinish}
          className="w-full flex min-h-12 items-center justify-center gap-2 rounded-xl border border-(--ink) bg-(--ink) px-4 py-3 text-xs sm:text-sm font-semibold uppercase tracking-wider text-(--paper) transition-all hover:opacity-95 active:scale-[0.98] shadow-2xs"
        >
          <span>Enter My Wardrobe</span>
          <ArrowRight className="h-4 w-4 text-(--burnished-gold)" />
        </button>
      </div>
    </div>
  );
};
